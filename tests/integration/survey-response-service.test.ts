import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient, type Degree, type Survey, type SurveyResponse } from "../../src/generated/prisma/client";
import { updateSurveyStatus } from "../../src/lib/survey-service";
import {
  createConfirmedSurveyResponse,
  type CreateConfirmedSurveyResponseInput,
} from "../../src/lib/survey-response-service";

const connectionString = process.env.DATABASE_URL;
const client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const observer = new Pool({ connectionString });
let institutionId: string;
let alumniIds: string[];
let survey: Survey;
let degree: Degree;
let input: CreateConfirmedSurveyResponseInput;

async function createAlumni() {
  const alumni = await client.alumni.create({ data: {} });
  alumniIds.push(alumni.id);
  return alumni;
}

async function createDegree(alumniId: string) {
  return client.degree.create({ data: {
    alumniId, programId: survey.referenceProgramId, level: "BACHELOR",
    status: "COMPLETED", graduationYear: 2020,
  } });
}

// Committed synthetic setup allows independent concurrent connections. Cleanup
// removes responses before Alumni; the runner also discards the entire database.
beforeAll(async () => {
  const version = await observer.query("SHOW server_version_num");
  expect(Math.floor(Number(version.rows[0].server_version_num) / 10000)).toBe(17);
});
beforeEach(async () => {
  alumniIds = [];
  const institution = await client.institution.create({ data: { name: "Synthetic Response Institution" } });
  institutionId = institution.id;
  const program = await client.program.create({ data: { institutionId, name: "Synthetic Response Program" } });
  survey = await client.survey.create({ data: { name: "Synthetic Response Survey", referenceProgramId: program.id } });
  survey = await updateSurveyStatus(client, survey.id, "OPEN");
  const alumni = await createAlumni();
  degree = await createDegree(alumni.id);
  input = { surveyId: survey.id, alumniId: alumni.id, referenceDegreeId: degree.id, referenceDegreeConfirmed: true };
});
afterEach(async () => {
  await client.surveyResponse.deleteMany({ where: { alumniId: { in: alumniIds } } });
  await client.alumni.deleteMany({ where: { id: { in: alumniIds } } });
  await client.survey.deleteMany({ where: { referenceProgram: { institutionId } } });
  await client.program.deleteMany({ where: { institutionId } });
  await client.institution.delete({ where: { id: institutionId } });
});
afterAll(async () => { await client.$disconnect(); await observer.end(); });

async function rejectsWithoutChanges(request: CreateConfirmedSurveyResponseInput, error: Record<string, unknown>) {
  const before = {
    survey: await client.survey.findUniqueOrThrow({ where: { id: survey.id } }),
    degree: await client.degree.findUniqueOrThrow({ where: { id: degree.id } }),
    responses: await client.surveyResponse.findMany({ where: { surveyId: survey.id } }),
  };
  await expect(createConfirmedSurveyResponse(client, request)).rejects.toMatchObject(error);
  expect(await client.survey.findUniqueOrThrow({ where: { id: survey.id } })).toEqual(before.survey);
  expect(await client.degree.findUniqueOrThrow({ where: { id: degree.id } })).toEqual(before.degree);
  expect(await client.surveyResponse.findMany({ where: { surveyId: survey.id } })).toEqual(before.responses);
}

async function blockedQueries(blockerPid: number) {
  const result = await observer.query<{ pid: number; query: string }>(
    // PostgreSQL may queue a second waiter behind the first (a soft blocker).
    // Follow the entire chain so both concurrent submissions must be observed.
    `WITH RECURSIVE blockers(pid) AS (
       SELECT $1::integer
       UNION
       SELECT activity.pid FROM pg_stat_activity activity
       JOIN blockers ON blockers.pid = ANY(pg_blocking_pids(activity.pid))
     )
     SELECT pid, query FROM pg_stat_activity
     WHERE pid IN (SELECT pid FROM blockers) AND pid <> $1 AND wait_event_type = 'Lock'`, [blockerPid],
  );
  return result.rows;
}

describe("Confirmed SurveyResponse creation", () => {
  it("creates exactly the explicitly selected response and commits before returning", async () => {
    const before = Date.now();
    const response = await createConfirmedSurveyResponse(client, input);
    expect(response).toMatchObject({ surveyId: survey.id, alumniId: input.alumniId, referenceDegreeId: degree.id });
    expect(response.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(response.confirmedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(response.confirmedAt.getTime()).toBeLessThanOrEqual(Date.now());
    // A separate connection observes the committed result and can lock it immediately.
    const committed = await observer.query('SELECT * FROM "SurveyResponse" WHERE id = $1 FOR UPDATE NOWAIT', [response.id]);
    expect(committed.rows).toEqual([response]);
    expect(await client.survey.findUniqueOrThrow({ where: { id: survey.id } })).toEqual(survey);
    expect(await client.degree.findUniqueOrThrow({ where: { id: degree.id } })).toEqual(degree);
    expect(await client.alumniContact.count({ where: { alumniId: input.alumniId } })).toBe(0);
  });

  it.each(["DRAFT", "CLOSED"] as const)("rejects a %s Survey without persisting a response", async status => {
    await updateSurveyStatus(client, survey.id, status);
    await rejectsWithoutChanges(input, { name: "SurveyNotOpenError", surveyId: survey.id, status });
  });

  it("compares UUID identities using the locked rows, accepting uppercase caller UUIDs", async () => {
    const response = await createConfirmedSurveyResponse(client, {
      ...input, surveyId: input.surveyId.toUpperCase(), alumniId: input.alumniId.toUpperCase(),
      referenceDegreeId: input.referenceDegreeId.toUpperCase(),
    });
    expect(response).toMatchObject({ surveyId: survey.id, alumniId: degree.alumniId, referenceDegreeId: degree.id });
  });

  it("rejects a missing Survey", async () => {
    const surveyId = randomUUID();
    await rejectsWithoutChanges({ ...input, surveyId }, { name: "SurveyNotFoundError", surveyId });
  });

  it("rejects a missing Alumni", async () => {
    const alumniId = randomUUID();
    await rejectsWithoutChanges({ ...input, alumniId }, { name: "AlumniNotFoundError", alumniId });
  });

  it("rejects a missing reference Degree", async () => {
    const referenceDegreeId = randomUUID();
    await rejectsWithoutChanges({ ...input, referenceDegreeId }, { name: "ReferenceDegreeNotFoundError", referenceDegreeId });
  });

  it("rejects another Alumni's Degree", async () => {
    const other = await createAlumni();
    await rejectsWithoutChanges({ ...input, alumniId: other.id }, {
      name: "InvalidReferenceDegreeError", referenceDegreeId: degree.id, reason: "NOT_OWNED",
    });
  });

  it.each(["IN_PROGRESS", "UNKNOWN", "ENDED_WITHOUT_DEGREE"] as const)("rejects a %s Degree", async status => {
    await client.degree.update({ where: { id: degree.id }, data: { status, graduationYear: null } });
    await rejectsWithoutChanges(input, { name: "InvalidReferenceDegreeError", referenceDegreeId: degree.id, reason: "NOT_COMPLETED" });
  });

  it("rejects a Degree in the wrong Program", async () => {
    const other = await client.program.create({ data: { institutionId, name: "Synthetic Other Program" } });
    await client.degree.update({ where: { id: degree.id }, data: { programId: other.id } });
    await rejectsWithoutChanges(input, { name: "InvalidReferenceDegreeError", referenceDegreeId: degree.id, reason: "PROGRAM_MISMATCH" });
  });

  it("rejects a Degree without a Program", async () => {
    await client.degree.update({ where: { id: degree.id }, data: { programId: null } });
    await rejectsWithoutChanges(input, { name: "InvalidReferenceDegreeError", referenceDegreeId: degree.id, reason: "PROGRAM_MISMATCH" });
  });

  it.each([undefined, false, null, "true", 1])("rejects nonaffirmative confirmation %s even with a single eligible Degree", async confirmation => {
    expect(await client.degree.count({ where: { alumniId: input.alumniId, programId: survey.referenceProgramId, status: "COMPLETED" } })).toBe(1);
    await rejectsWithoutChanges({ ...input, referenceDegreeConfirmed: confirmation as boolean }, {
      name: "ReferenceDegreeConfirmationRequiredError", referenceDegreeId: degree.id,
    });
  });

  it.each([1, 2])("requires an explicit Degree ID with %s eligible candidates", async count => {
    if (count === 2) await createDegree(input.alumniId);
    await rejectsWithoutChanges({ ...input, referenceDegreeId: undefined as unknown as string }, {
      name: "ReferenceDegreeSelectionRequiredError",
    });
  });

  it("accepts a COMPLETED Degree with unknown graduationYear", async () => {
    await client.degree.update({ where: { id: degree.id }, data: { graduationYear: null } });
    expect(await createConfirmedSurveyResponse(client, input)).toMatchObject({ referenceDegreeId: degree.id });
  });

  it("uses the explicit selection among multiple candidates, without choosing the highest or newest Degree", async () => {
    const newer = await createDegree(input.alumniId);
    await client.degree.update({ where: { id: newer.id }, data: { level: "MASTER", graduationYear: 2024 } });
    const response = await createConfirmedSurveyResponse(client, input);
    expect(response.referenceDegreeId).toBe(degree.id);
    expect(await client.surveyResponse.count({ where: { surveyId: survey.id, alumniId: input.alumniId } })).toBe(1);
  });

  it("generates confirmedAt on the server and ignores a supplied timestamp", async () => {
    const supplied = new Date("2000-01-01T00:00:00Z");
    const request = { ...input, confirmedAt: supplied };
    const before = Date.now();
    const response = await createConfirmedSurveyResponse(client, request);
    expect(response.confirmedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(response.confirmedAt.getTime()).toBeLessThanOrEqual(Date.now());
    expect(response.confirmedAt).not.toEqual(supplied);
  });

  it("does not accept a supplied confirmedAt as affirmative confirmation", async () => {
    const request = { ...input, referenceDegreeConfirmed: false, confirmedAt: new Date() };
    await rejectsWithoutChanges(request, { name: "ReferenceDegreeConfirmationRequiredError" });
  });

  it("rejects duplicate participation without replacing the original reference or confirmation", async () => {
    const original = await createConfirmedSurveyResponse(client, input);
    const other = await createDegree(input.alumniId);
    await rejectsWithoutChanges({ ...input, referenceDegreeId: other.id }, {
      name: "SurveyResponseAlreadyExistsError", surveyId: survey.id, alumniId: input.alumniId,
    });
    expect(await client.surveyResponse.findUniqueOrThrow({ where: { id: original.id } })).toEqual(original);
  });

  it("serializes concurrent duplicate submissions and creates only one response", async () => {
    const other = await createDegree(input.alumniId);
    const db = await observer.connect();
    let submissions: Promise<SurveyResponse>[] = [];
    try {
      await db.query("BEGIN");
      await db.query('SELECT id FROM "Survey" WHERE id = $1 FOR UPDATE', [survey.id]);
      const pid = (await db.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
      submissions = [
        createConfirmedSurveyResponse(client, input),
        createConfirmedSurveyResponse(client, { ...input, referenceDegreeId: other.id }),
      ];
      const results = Promise.allSettled(submissions);
      await expect.poll(async () => (await blockedQueries(pid)).filter(row => /Survey/.test(row.query) && /FOR UPDATE/.test(row.query)).length, { timeout: 3000 }).toBe(2);
      await db.query("COMMIT");
      const settled = await results;
      expect(settled.filter(result => result.status === "fulfilled")).toHaveLength(1);
      const failure = settled.find(result => result.status === "rejected");
      expect(failure).toMatchObject({ status: "rejected", reason: { name: "SurveyResponseAlreadyExistsError" } });
      const responses = await client.surveyResponse.findMany({ where: { surveyId: survey.id, alumniId: input.alumniId } });
      expect(responses).toHaveLength(1);
      const success = settled.find(result => result.status === "fulfilled");
      expect(success).toMatchObject({ status: "fulfilled", value: responses[0] });
    } finally { await db.query("ROLLBACK"); db.release(); await Promise.allSettled(submissions); }
  });

  it("waits for a concurrent Survey closure and rejects creation after it commits", async () => {
    const db = await observer.connect();
    let creation: Promise<SurveyResponse> | undefined;
    try {
      await db.query("BEGIN");
      await db.query('SELECT id FROM "Survey" WHERE id = $1 FOR UPDATE', [survey.id]);
      await db.query('UPDATE "Survey" SET status = $1 WHERE id = $2', ["CLOSED", survey.id]);
      const pid = (await db.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
      creation = createConfirmedSurveyResponse(client, input);
      const rejected = expect(creation).rejects.toMatchObject({ name: "SurveyNotOpenError", status: "CLOSED" });
      await expect.poll(async () => (await blockedQueries(pid)).some(row => /Survey/.test(row.query) && /FOR UPDATE/.test(row.query)), { timeout: 3000 }).toBe(true);
      await db.query("COMMIT");
      await rejected;
      expect(await client.surveyResponse.count({ where: { surveyId: survey.id } })).toBe(0);
    } finally { await db.query("ROLLBACK"); db.release(); await Promise.allSettled([creation]); }
  });

  it("locks and reads the Degree after a concurrent Degree change commits", async () => {
    const db = await observer.connect();
    let creation: Promise<SurveyResponse> | undefined;
    try {
      await db.query("BEGIN");
      await db.query('SELECT id FROM "Degree" WHERE id = $1 FOR UPDATE', [degree.id]);
      await db.query('UPDATE "Degree" SET status = $1, "graduationYear" = NULL WHERE id = $2', ["IN_PROGRESS", degree.id]);
      const pid = (await db.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
      creation = createConfirmedSurveyResponse(client, input);
      const rejected = expect(creation).rejects.toMatchObject({ name: "InvalidReferenceDegreeError", reason: "NOT_COMPLETED" });
      await expect.poll(async () => (await blockedQueries(pid)).some(row => /Degree/.test(row.query) && /FOR UPDATE/.test(row.query)), { timeout: 3000 }).toBe(true);
      // The service acquired Survey and Alumni before waiting on Degree.
      for (const [table, id] of [["Survey", survey.id], ["Alumni", input.alumniId]]) {
        await expect(observer.query(`SELECT id FROM "${table}" WHERE id = $1 FOR UPDATE NOWAIT`, [id])).rejects.toMatchObject({ code: "55P03" });
      }
      await db.query("COMMIT");
      await rejected;
      expect(await client.surveyResponse.count({ where: { surveyId: survey.id } })).toBe(0);
    } finally { await db.query("ROLLBACK"); db.release(); await Promise.allSettled([creation]); }
  });

  it("retains all three row locks through persistence and blocks status updates until commit", async () => {
    const db = await observer.connect();
    let creation: Promise<SurveyResponse> | undefined;
    let closing: ReturnType<typeof updateSurveyStatus> | undefined;
    try {
      await db.query("BEGIN");
      // Test-only table lock pauses INSERT after validation, without domain triggers.
      await db.query('LOCK TABLE "SurveyResponse" IN SHARE MODE');
      const pid = (await db.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
      creation = createConfirmedSurveyResponse(client, input);
      let creationPid: number | undefined;
      await expect.poll(async () => {
        creationPid = (await blockedQueries(pid)).find(row => /INSERT INTO/.test(row.query) && /SurveyResponse/.test(row.query))?.pid;
        return creationPid;
      }, { timeout: 3000 }).toBeDefined();
      for (const [table, id] of [["Survey", survey.id], ["Alumni", input.alumniId], ["Degree", degree.id]]) {
        await expect(observer.query(`SELECT id FROM "${table}" WHERE id = $1 FOR UPDATE NOWAIT`, [id])).rejects.toMatchObject({ code: "55P03" });
      }
      expect(await client.surveyResponse.count({ where: { surveyId: survey.id } })).toBe(0);
      closing = updateSurveyStatus(client, survey.id, "CLOSED");
      await expect.poll(async () => (await blockedQueries(creationPid!)).some(row => /Survey/.test(row.query) && /FOR UPDATE/.test(row.query)), { timeout: 3000 }).toBe(true);
      await db.query("COMMIT");
      const response = await creation;
      expect((await closing).status).toBe("CLOSED");
      expect(await client.surveyResponse.findUniqueOrThrow({ where: { id: response.id } })).toEqual(response);
    } finally { await db.query("ROLLBACK"); db.release(); await Promise.allSettled([creation, closing]); }
  });
});
