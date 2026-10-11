import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient, type Survey } from "../../src/generated/prisma/client";
import { deleteAlumniProfile } from "../../src/lib/alumni-service";
import { updateDegree } from "../../src/lib/degree-service";
import type { SurveyResponseServiceConfiguration } from "../../src/lib/operator-scope";
import { AlumniNotFoundError, createConfirmedSurveyResponse, replaceConfirmedReferenceDegree } from "../../src/lib/survey-response-service";
import { updateSurveyStatus } from "../../src/lib/survey-service";

const connectionString = process.env.DATABASE_URL;
const client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const observer = new Pool({ connectionString });
let institutionId: string;
let programId: string;
let organisationId: string;
let alumniId: string;
let alumniIds: string[];
let surveys: Survey[];
let configuration: SurveyResponseServiceConfiguration;

beforeAll(async () => {
  const version = await observer.query("SHOW server_version_num");
  expect(Math.floor(Number(version.rows[0].server_version_num) / 10000)).toBe(17);
});
beforeEach(async () => {
  alumniIds = [];
  const institution = await client.institution.create({ data: { name: "Synthetic Deletion Institution" } });
  institutionId = institution.id;
  const program = await client.program.create({ data: { institutionId, name: "Synthetic Deletion Program" } });
  programId = program.id;
  const organisation = await client.organisation.create({ data: { name: "Synthetic Deletion Organisation" } });
  organisationId = organisation.id;
  configuration = { operatorScope: { kind: "INSTITUTION", institutionId } };
  surveys = [];
  for (const suffix of ["A", "B"]) {
    surveys.push(await client.survey.create({ data: {
      name: `Synthetic Deletion Survey ${suffix}`, referenceProgramId: programId, status: "OPEN",
    } }));
  }
  alumniId = await createAlumni();
});
afterEach(async () => {
  await client.surveyResponse.deleteMany({ where: { alumniId: { in: alumniIds } } });
  await client.alumni.deleteMany({ where: { id: { in: alumniIds } } });
  await client.survey.deleteMany({ where: { id: { in: surveys.map(survey => survey.id) } } });
  await client.program.delete({ where: { id: programId } });
  await client.organisation.delete({ where: { id: organisationId } });
  await client.institution.delete({ where: { id: institutionId } });
});
afterAll(async () => { await client.$disconnect(); await observer.end(); });

async function createAlumni() {
  const alumni = await client.alumni.create({ data: {} });
  alumniIds.push(alumni.id);
  return alumni.id;
}

async function createDegrees(owner = alumniId) {
  const degrees = [];
  for (const level of ["BACHELOR", "MASTER"] as const) {
    degrees.push(await client.degree.create({ data: { alumniId: owner, programId, level, status: "COMPLETED" } }));
  }
  degrees.push(await client.degree.create({ data: {
    alumniId: owner, institutionId, level: "CERTIFICATE", status: "UNKNOWN",
  } }));
  return degrees;
}

async function createCareerSteps(owner = alumniId) {
  return [
    await client.careerStep.create({ data: { alumniId: owner, organisationId, type: "EMPLOYMENT", temporalStatus: "UNKNOWN" } }),
    await client.careerStep.create({ data: { alumniId: owner, type: "VOLUNTEERING", temporalStatus: "ONGOING" } }),
  ];
}

async function completeProfile(owner = alumniId, withResponses = true) {
  const degrees = await createDegrees(owner);
  const steps = await createCareerSteps(owner);
  let position = 1;
  for (const degree of degrees) {
    await client.alumniTimelineItem.create({ data: { alumniId: owner, type: "DEGREE", degreeId: degree.id, position } });
    position += 3;
  }
  for (const step of steps) {
    await client.alumniTimelineItem.create({ data: { alumniId: owner, type: "CAREER_STEP", careerStepId: step.id, position } });
    position += 3;
  }
  await client.alumniContact.create({ data: { alumniId: owner, displayName: "Synthetic Deletion Contact", email: "deletion@example.invalid" } });
  const responses = [];
  if (withResponses) {
    for (let i = 0; i < surveys.length; i++) {
      responses.push(await createConfirmedSurveyResponse(client, {
        surveyId: surveys[i].id, alumniId: owner, referenceDegreeId: degrees[i].id, referenceDegreeConfirmed: true,
      }, configuration));
    }
  }
  return { degrees, steps, responses };
}

// Independent SQL connections observe only committed state, including after the
// service returns and while its deletion transaction is paused by a row lock.
async function profileSnapshot(owner = alumniId) {
  const result: Record<string, unknown[]> = {};
  for (const table of ["Alumni", "Degree", "CareerStep", "AlumniTimelineItem", "AlumniContact", "SurveyResponse"]) {
    const column = table === "Alumni" ? "id" : "alumniId";
    result[table] = (await observer.query(`SELECT * FROM "${table}" WHERE "${column}" = $1 ORDER BY id`, [owner])).rows;
  }
  return result;
}

async function expectDeleted(owner = alumniId) {
  const snapshot = await profileSnapshot(owner);
  for (const rows of Object.values(snapshot)) expect(rows).toEqual([]);
}

async function schemaSnapshot() {
  const columns = await observer.query("SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position");
  const constraints = await observer.query("SELECT conrelid::regclass::text AS table_name, conname, pg_get_constraintdef(oid) AS definition, convalidated FROM pg_constraint WHERE connamespace = 'public'::regnamespace ORDER BY table_name, conname");
  const indexes = await observer.query("SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename, indexname");
  const triggers = await observer.query("SELECT tgrelid::regclass::text AS table_name, tgname, pg_get_triggerdef(oid) AS definition FROM pg_trigger WHERE NOT tgisinternal AND tgrelid IN (SELECT oid FROM pg_class WHERE relnamespace = 'public'::regnamespace) ORDER BY table_name, tgname");
  const migrations = await observer.query('SELECT migration_name, checksum FROM "_prisma_migrations" ORDER BY migration_name');
  return { columns: columns.rows, constraints: constraints.rows, indexes: indexes.rows, triggers: triggers.rows, migrations: migrations.rows };
}

async function waitingPid(blockerPid: number, table: string, operation: string) {
  let pid: number | undefined;
  await expect.poll(async () => {
    const blocked = await observer.query<{ pid: number; query: string }>(
      `WITH RECURSIVE blockers(pid) AS (
         SELECT $1::integer
         UNION
         SELECT activity.pid FROM pg_stat_activity activity
         JOIN blockers ON blockers.pid = ANY(pg_blocking_pids(activity.pid))
       )
       SELECT pid, query FROM pg_stat_activity
       WHERE pid IN (SELECT pid FROM blockers) AND pid <> $1 AND wait_event_type = 'Lock'`, [blockerPid],
    );
    pid = blocked.rows.find(row => row.query.includes(`"${table}"`) && row.query.includes(operation))?.pid;
    return pid;
  }, { timeout: 3000 }).toBeDefined();
  return pid!;
}

describe("Transactional Alumni profile deletion", () => {
  it("deletes an empty Alumni and commits before returning", async () => {
    expect(await deleteAlumniProfile(client, alumniId)).toBeUndefined();
    await expectDeleted();
  });

  it("deletes several Degrees, including a direct Institution reference", async () => {
    expect(await createDegrees()).toHaveLength(3);
    await deleteAlumniProfile(client, alumniId);
    await expectDeleted();
  });

  it("deletes several CareerSteps with and without Organisation references", async () => {
    expect(await createCareerSteps()).toHaveLength(2);
    await deleteAlumniProfile(client, alumniId);
    await expectDeleted();
  });

  it("removes responses to multiple Surveys before cascading protected Degrees, all stations, TimelineItems and contact", async () => {
    const profile = await completeProfile();
    expect(profile.responses).toHaveLength(2);
    await expect(observer.query('DELETE FROM "Degree" WHERE id = $1', [profile.degrees[0].id])).rejects.toMatchObject({ code: "23503" });
    expect((await profileSnapshot()).AlumniTimelineItem).toHaveLength(5);
    expect((await profileSnapshot()).AlumniContact).toHaveLength(1);
    await deleteAlumniProfile(client, alumniId);
    await expectDeleted();
  });

  it("deletes participation in CLOSED Surveys without an OPEN guard", async () => {
    await completeProfile();
    for (const survey of surveys) await updateSurveyStatus(client, survey.id, "CLOSED");
    await deleteAlumniProfile(client, alumniId);
    await expectDeleted();
    expect((await client.survey.findMany({ where: { id: { in: surveys.map(survey => survey.id) } } })).map(survey => survey.status)).toEqual(["CLOSED", "CLOSED"]);
  });

  it("preserves shared catalogs, Surveys and another Alumni's entire profile and responses", async () => {
    await completeProfile();
    const otherId = await createAlumni();
    await completeProfile(otherId);
    const otherBefore = await profileSnapshot(otherId);
    const shared = async () => ({
      institution: await client.institution.findUniqueOrThrow({ where: { id: institutionId } }),
      program: await client.program.findUniqueOrThrow({ where: { id: programId } }),
      organisation: await client.organisation.findUniqueOrThrow({ where: { id: organisationId } }),
      surveys: await client.survey.findMany({ where: { id: { in: surveys.map(survey => survey.id) } }, orderBy: { id: "asc" } }),
    });
    const sharedBefore = await shared();
    await deleteAlumniProfile(client, alumniId);
    await expectDeleted();
    expect(await profileSnapshot(otherId)).toEqual(otherBefore);
    expect(await shared()).toEqual(sharedBefore);
  });

  it("explicitly rejects a nonexistent Alumni without changing an existing profile", async () => {
    await completeProfile();
    const before = await profileSnapshot();
    const missingId = randomUUID();
    await expect(deleteAlumniProfile(client, missingId)).rejects.toBeInstanceOf(AlumniNotFoundError);
    await expect(deleteAlumniProfile(client, missingId)).rejects.toMatchObject({ name: "AlumniNotFoundError", alumniId: missingId });
    expect(await profileSnapshot()).toEqual(before);
  });

  it("uses canonical row identity for an uppercase Alumni UUID", async () => {
    await completeProfile();
    await deleteAlumniProfile(client, alumniId.toUpperCase());
    await expectDeleted();
  });

  it("preserves all existing schema definitions, constraints and the five migrations", async () => {
    await completeProfile();
    const before = await schemaSnapshot();
    expect(before.migrations).toHaveLength(5);
    expect(before.triggers).toEqual([]);
    await deleteAlumniProfile(client, alumniId);
    expect(await schemaSnapshot()).toEqual(before);
    await expectDeleted();
  });
});

describe("Alumni deletion transaction and concurrency", () => {
  it("locks Alumni before removing any associated records", async () => {
    await completeProfile();
    const before = await profileSnapshot();
    const db = await observer.connect();
    let deletion: Promise<void> | undefined;
    try {
      await db.query("BEGIN");
      await db.query('SELECT id FROM "Alumni" WHERE id = $1 FOR UPDATE', [alumniId]);
      const pid = (await db.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
      deletion = deleteAlumniProfile(client, alumniId);
      void deletion.catch(() => {});
      await waitingPid(pid, "Alumni", "FOR UPDATE");
      expect(await profileSnapshot()).toEqual(before);
      // A response remains unlocked until the Alumni lock is acquired.
      expect((await db.query('SELECT id FROM "SurveyResponse" WHERE "alumniId" = $1 FOR UPDATE NOWAIT', [alumniId])).rows).toHaveLength(2);
      await db.query("COMMIT");
      await deletion;
      await expectDeleted();
    } finally { await db.query("ROLLBACK"); db.release(); await Promise.allSettled([deletion]); }
  });

  it("rolls back response deletion and every cascade when PostgreSQL cancels the final delete", async () => {
    const profile = await completeProfile();
    const before = await profileSnapshot();
    const db = await observer.connect();
    let deletion: Promise<void> | undefined;
    try {
      await db.query("BEGIN");
      await db.query('SELECT id FROM "Degree" WHERE id = $1 FOR UPDATE', [profile.degrees[0].id]);
      const pid = (await db.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
      deletion = deleteAlumniProfile(client, alumniId);
      const result = Promise.allSettled([deletion]);
      const deletingPid = await waitingPid(pid, "Alumni", "DELETE");
      await expect(observer.query('SELECT id FROM "Alumni" WHERE id = $1 FOR UPDATE NOWAIT', [alumniId])).rejects.toMatchObject({ code: "55P03" });
      expect(await profileSnapshot()).toEqual(before);
      expect((await observer.query("SELECT pg_cancel_backend($1) AS cancelled", [deletingPid])).rows).toEqual([{ cancelled: true }]);
      expect(await result).toMatchObject([{ status: "rejected", reason: {
        meta: { driverAdapterError: { cause: { originalCode: "57014" } } },
      } }]);
      await db.query("ROLLBACK");
      expect(await profileSnapshot()).toEqual(before);
      // Rollback also releases the service's Alumni lock.
      expect((await observer.query('SELECT id FROM "Alumni" WHERE id = $1 FOR UPDATE NOWAIT', [alumniId])).rows).toEqual([{ id: alumniId }]);
    } finally { await db.query("ROLLBACK"); db.release(); await Promise.allSettled([deletion]); }
  });

  it("finishes while a Survey row is locked, avoiding Survey locks after Alumni", async () => {
    await completeProfile();
    const db = await observer.connect();
    let deletion: Promise<void> | undefined;
    try {
      await db.query("BEGIN");
      await db.query('SELECT id FROM "Survey" WHERE id = $1 FOR UPDATE', [surveys[0].id]);
      let settled = false;
      deletion = deleteAlumniProfile(client, alumniId);
      void deletion.then(() => { settled = true; }, () => { settled = true; });
      await expect.poll(() => settled, { timeout: 3000 }).toBe(true);
      await deletion;
      await expectDeleted();
    } finally { await db.query("ROLLBACK"); db.release(); await Promise.allSettled([deletion]); }
  });

  const operations = ["response creation", "Degree modification", "reference replacement"] as const;
  type Operation = (typeof operations)[number];
  function write(operation: Operation, profile: Awaited<ReturnType<typeof completeProfile>>): Promise<unknown> {
    const input = { surveyId: surveys[0].id, alumniId, referenceDegreeId: profile.degrees[1].id, referenceDegreeConfirmed: true };
    if (operation === "response creation") return createConfirmedSurveyResponse(client, input, configuration);
    if (operation === "reference replacement") return replaceConfirmedReferenceDegree(client, input, configuration);
    return updateDegree(client, { alumniId, degreeId: profile.degrees[1].id, changes: { title: "Synthetic Updated Title" } });
  }

  it.each(operations)("deletion locks Alumni first; concurrent %s waits and rejects the deleted Alumni", async operation => {
    const profile = await completeProfile(alumniId, operation !== "response creation");
    const before = await profileSnapshot();
    const db = await observer.connect();
    let deletion: Promise<void> | undefined;
    let writing: Promise<unknown> | undefined;
    try {
      await db.query("BEGIN");
      // Pause the real cascade after responses are removed; the Alumni lock
      // remains held, without production hooks or test triggers.
      await db.query('SELECT id FROM "Degree" WHERE id = $1 FOR UPDATE', [profile.degrees[0].id]);
      const pid = (await db.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
      deletion = deleteAlumniProfile(client, alumniId);
      void deletion.catch(() => {});
      const deletingPid = await waitingPid(pid, "Alumni", "DELETE");
      writing = write(operation, profile);
      const result = Promise.allSettled([writing]);
      await waitingPid(deletingPid, "Alumni", "FOR UPDATE");
      expect(await profileSnapshot()).toEqual(before);
      await db.query("COMMIT");
      await deletion;
      expect(await result).toMatchObject([{ status: "rejected", reason: { name: "AlumniNotFoundError", alumniId } }]);
      await expectDeleted();
    } finally { await db.query("ROLLBACK"); db.release(); await Promise.allSettled([deletion, writing]); }
  });

  it.each(operations)("%s locks Alumni first; deletion waits and removes the committed result", async operation => {
    const profile = await completeProfile(alumniId, operation !== "response creation");
    const db = await observer.connect();
    let deletion: Promise<void> | undefined;
    let writing: Promise<unknown> | undefined;
    try {
      await db.query("BEGIN");
      if (operation === "response creation") {
        await db.query('LOCK TABLE "SurveyResponse" IN SHARE MODE');
      } else if (operation === "reference replacement") {
        await db.query('SELECT id FROM "SurveyResponse" WHERE id = $1 FOR UPDATE', [profile.responses[0].id]);
      } else {
        await db.query('SELECT id FROM "Degree" WHERE id = $1 FOR UPDATE', [profile.degrees[1].id]);
      }
      const pid = (await db.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
      writing = write(operation, profile);
      void writing.catch(() => {});
      const table = operation === "Degree modification" ? "Degree" : "SurveyResponse";
      const statement = operation === "response creation" ? "INSERT" : operation === "reference replacement" ? "UPDATE" : "FOR UPDATE";
      const writingPid = await waitingPid(pid, table, statement);
      await expect(observer.query('SELECT id FROM "Alumni" WHERE id = $1 FOR UPDATE NOWAIT', [alumniId])).rejects.toMatchObject({ code: "55P03" });
      deletion = deleteAlumniProfile(client, alumniId);
      void deletion.catch(() => {});
      await waitingPid(writingPid, "Alumni", "FOR UPDATE");
      await db.query("COMMIT");
      const written = await writing;
      if (operation === "Degree modification") expect(written).toMatchObject({ id: profile.degrees[1].id, title: "Synthetic Updated Title" });
      else expect(written).toMatchObject({ alumniId, referenceDegreeId: profile.degrees[1].id });
      if (operation === "reference replacement") expect(written).toMatchObject({ id: profile.responses[0].id });
      await deletion;
      await expectDeleted();
    } finally { await db.query("ROLLBACK"); db.release(); await Promise.allSettled([deletion, writing]); }
  });
});
