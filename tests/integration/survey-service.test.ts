import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClient, type Survey, type SurveyStatus } from "../../src/generated/prisma/client";
import {
  requireOpenSurvey,
  SurveyNotFoundError,
  SurveyNotOpenError,
  updateSurveyStatus,
  withOpenSurvey,
} from "../../src/lib/survey-service";

const connectionString = process.env.DATABASE_URL;
const client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const observer = new Pool({ connectionString });
const statuses = ["DRAFT", "OPEN", "CLOSED"] as const;
let institutionId: string;
let survey: Survey;

// Concurrent transactions need committed synthetic setup. It is removed after
// each test, and the existing runner discards the entire PostgreSQL 17 container.
beforeAll(async () => {
  const version = await observer.query("SHOW server_version_num");
  expect(Math.floor(Number(version.rows[0].server_version_num) / 10000)).toBe(17);
});
beforeEach(async () => {
  const institution = await client.institution.create({ data: { name: "Synthetic Institution" } });
  institutionId = institution.id;
  const program = await client.program.create({ data: { institutionId, name: "Synthetic Program" } });
  survey = await client.survey.create({ data: { name: "Synthetic Survey", referenceProgramId: program.id } });
});
afterEach(async () => {
  await client.survey.deleteMany({ where: { referenceProgram: { institutionId } } });
  await client.program.deleteMany({ where: { institutionId } });
  await client.institution.delete({ where: { id: institutionId } });
});
afterAll(async () => { await client.$disconnect(); await observer.end(); });

async function waitForBlockedSurveyQuery(blockerPid: number) {
  // Observe a real PostgreSQL lock wait rather than assuming elapsed time proves it.
  await expect.poll(async () => {
    const result = await observer.query(
      `SELECT query FROM pg_stat_activity
       WHERE $1 = ANY(pg_blocking_pids(pid)) AND wait_event_type = 'Lock'`,
      [blockerPid],
    );
    return result.rows.map(row => row.query as string).some(query => /Survey/.test(query) && /FOR UPDATE/.test(query));
  }, { timeout: 3000 }).toBe(true);
}

describe("Survey status domain service", () => {
  it("retains the schema default DRAFT", async () => {
    expect(survey.status).toBe("DRAFT");
  });

  it.each(["DRAFT", "CLOSED"] as const)("%s rejects confirmed-response work without running it", async status => {
    await updateSurveyStatus(client, survey.id, status);
    const before = await client.survey.findUniqueOrThrow({ where: { id: survey.id } });
    const operation = vi.fn();
    await expect(withOpenSurvey(client, survey.id, operation)).rejects.toMatchObject({
      name: "SurveyNotOpenError", surveyId: survey.id, status,
    });
    await expect(withOpenSurvey(client, survey.id, operation)).rejects.toBeInstanceOf(SurveyNotOpenError);
    expect(operation).not.toHaveBeenCalled();
    expect(await client.survey.findUniqueOrThrow({ where: { id: survey.id } })).toEqual(before);
  });

  it("OPEN passes the reusable transaction-scoped guard and returns the operation result", async () => {
    await updateSurveyStatus(client, survey.id, "OPEN");
    const result = await withOpenSurvey(client, survey.id, async (tx, lockedSurvey) => {
      expect(lockedSurvey).toEqual({ id: survey.id, referenceProgramId: survey.referenceProgramId, status: "OPEN" });
      expect(await requireOpenSurvey(tx, survey.id)).toEqual(lockedSurvey);
      return "eligible";
    });
    expect(result).toBe("eligible");
  });

  it("rejects a missing Survey with an explicit domain error in both entry points", async () => {
    const surveyId = randomUUID();
    const before = await client.survey.findUniqueOrThrow({ where: { id: survey.id } });
    const operation = vi.fn();
    for (const action of [
      () => withOpenSurvey(client, surveyId, operation),
      () => updateSurveyStatus(client, surveyId, "OPEN"),
    ]) {
      await expect(action()).rejects.toBeInstanceOf(SurveyNotFoundError);
      await expect(action()).rejects.toMatchObject({ name: "SurveyNotFoundError", surveyId });
    }
    expect(operation).not.toHaveBeenCalled();
    expect(await client.survey.findUniqueOrThrow({ where: { id: survey.id } })).toEqual(before);
  });

  it.each(statuses.flatMap(from => statuses.map(to => [from, to] as const)))(
    "allows %s -> %s without adding transition restrictions or changing the reference Program",
    async (from, to) => {
      await updateSurveyStatus(client, survey.id, from);
      await client.survey.update({ where: { id: survey.id }, data: { updatedAt: new Date("2000-01-01T00:00:00Z") } });
      const result = await updateSurveyStatus(client, survey.id, to);
      expect(result).toMatchObject({
        id: survey.id, name: survey.name, referenceProgramId: survey.referenceProgramId,
        createdAt: survey.createdAt, status: to,
      });
      expect(result.updatedAt.getTime()).toBeGreaterThan(new Date("2000-01-01T00:00:00Z").getTime());
      expect(await client.survey.findUniqueOrThrow({ where: { id: survey.id } })).toEqual(result);
    },
  );

  it("rolls back a failed status update", async () => {
    await expect(updateSurveyStatus(client, survey.id, "INVALID" as SurveyStatus)).rejects.toThrow();
    expect(await client.survey.findUniqueOrThrow({ where: { id: survey.id } })).toEqual(survey);
  });

  it("rolls back associated database work when the OPEN operation fails", async () => {
    await updateSurveyStatus(client, survey.id, "OPEN");
    const before = await client.survey.findUniqueOrThrow({ where: { id: survey.id } });
    const failure = new Error("Synthetic operation failure");
    await expect(withOpenSurvey(client, survey.id, async tx => {
      await tx.survey.update({ where: { id: survey.id }, data: { name: "Synthetic temporary name" } });
      throw failure;
    })).rejects.toBe(failure);
    expect(await client.survey.findUniqueOrThrow({ where: { id: survey.id } })).toEqual(before);
  });

  it("returns success only after associated work commits and releases its row lock", async () => {
    await updateSurveyStatus(client, survey.id, "OPEN");
    const result = await withOpenSurvey(client, survey.id, async tx => {
      await tx.survey.update({ where: { id: survey.id }, data: { name: "Synthetic committed name" } });
      // Another connection still sees the old committed value during the operation.
      const beforeCommit = await observer.query('SELECT name FROM "Survey" WHERE id = $1', [survey.id]);
      expect(beforeCommit.rows[0].name).toBe(survey.name);
      return "committed";
    });
    expect(result).toBe("committed");
    const db = await observer.connect();
    try {
      await db.query("BEGIN");
      const committed = await db.query('SELECT name FROM "Survey" WHERE id = $1 FOR UPDATE NOWAIT', [survey.id]);
      expect(committed.rows[0].name).toBe("Synthetic committed name");
    } finally { await db.query("ROLLBACK"); db.release(); }
  });

  it("holds the checked OPEN state until the operation transaction finishes, blocking a status update", async () => {
    await updateSurveyStatus(client, survey.id, "OPEN");
    const checked = Promise.withResolvers<number>();
    const release = Promise.withResolvers<void>();
    const work = withOpenSurvey(client, survey.id, async tx => {
      const [{ pid }] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
      checked.resolve(pid);
      await release.promise;
      expect((await tx.survey.findUniqueOrThrow({ where: { id: survey.id } })).status).toBe("OPEN");
      await tx.survey.update({ where: { id: survey.id }, data: { name: "Synthetic guarded work" } });
      return "finished";
    });
    let closing: ReturnType<typeof updateSurveyStatus> | undefined;
    try {
      const pid = await checked.promise;
      closing = updateSurveyStatus(client, survey.id, "CLOSED");
      await waitForBlockedSurveyQuery(pid);
      expect((await client.survey.findUniqueOrThrow({ where: { id: survey.id } })).status).toBe("OPEN");
      release.resolve();
      expect(await work).toBe("finished");
      expect((await closing).status).toBe("CLOSED");
      expect(await client.survey.findUniqueOrThrow({ where: { id: survey.id } })).toMatchObject({
        status: "CLOSED", name: "Synthetic guarded work", referenceProgramId: survey.referenceProgramId,
      });
    } finally { release.resolve(); await Promise.allSettled([work, closing]); }
  });

  it("waits for a concurrent status transaction and rejects the newly committed CLOSED state", async () => {
    await updateSurveyStatus(client, survey.id, "OPEN");
    const db = await observer.connect();
    let check: Promise<unknown> | undefined;
    const operation = vi.fn();
    try {
      await db.query("BEGIN");
      await db.query('SELECT id FROM "Survey" WHERE id = $1 FOR UPDATE', [survey.id]);
      await db.query('UPDATE "Survey" SET status = $1 WHERE id = $2', ["CLOSED", survey.id]);
      const pid = (await db.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
      check = withOpenSurvey(client, survey.id, operation);
      const rejected = expect(check).rejects.toMatchObject({ name: "SurveyNotOpenError", status: "CLOSED" });
      await waitForBlockedSurveyQuery(pid);
      expect(operation).not.toHaveBeenCalled();
      await db.query("COMMIT");
      await rejected;
      expect(operation).not.toHaveBeenCalled();
    } finally { await db.query("ROLLBACK"); db.release(); await Promise.allSettled([check]); }
  });

  it("serializes concurrent status updates behind the same Survey row lock", async () => {
    const db = await observer.connect();
    let update: ReturnType<typeof updateSurveyStatus> | undefined;
    try {
      await db.query("BEGIN");
      await db.query('SELECT id FROM "Survey" WHERE id = $1 FOR UPDATE', [survey.id]);
      await db.query('UPDATE "Survey" SET status = $1 WHERE id = $2', ["CLOSED", survey.id]);
      const pid = (await db.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
      update = updateSurveyStatus(client, survey.id, "OPEN");
      await waitForBlockedSurveyQuery(pid);
      await db.query("COMMIT");
      expect((await update).status).toBe("OPEN");
      expect((await client.survey.findUniqueOrThrow({ where: { id: survey.id } })).status).toBe("OPEN");
    } finally { await db.query("ROLLBACK"); db.release(); await Promise.allSettled([update]); }
  });
});
