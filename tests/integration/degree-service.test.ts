import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient, type Degree, type Survey, type SurveyResponse } from "../../src/generated/prisma/client";
import { updateDegree, type DegreeChanges, type UpdateDegreeInput } from "../../src/lib/degree-service";
import type { SurveyResponseServiceConfiguration } from "../../src/lib/operator-scope";
import { createConfirmedSurveyResponse } from "../../src/lib/survey-response-service";

const connectionString = process.env.DATABASE_URL;
const client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const observer = new Pool({ connectionString });
let institutionId: string;
let alumniIds: string[];
let degree: Degree;
let survey: Survey;
let configuration: SurveyResponseServiceConfiguration;

beforeAll(async () => {
  const version = await observer.query("SHOW server_version_num");
  expect(Math.floor(Number(version.rows[0].server_version_num) / 10000)).toBe(17);
});
beforeEach(async () => {
  alumniIds = [];
  const institution = await client.institution.create({ data: { name: "Synthetic Degree Update Institution" } });
  institutionId = institution.id;
  configuration = { operatorScope: { kind: "INSTITUTION", institutionId } };
  const program = await client.program.create({ data: { institutionId, name: "Synthetic Degree Update Program" } });
  survey = await client.survey.create({ data: { name: "Synthetic Degree Update Survey", referenceProgramId: program.id, status: "OPEN" } });
  const alumni = await client.alumni.create({ data: {} });
  alumniIds.push(alumni.id);
  degree = await client.degree.create({ data: {
    alumniId: alumni.id, programId: program.id, level: "BACHELOR", status: "COMPLETED",
    startYear: 2016, endYear: 2020, graduationYear: 2020, updatedAt: new Date("2000-01-01T00:00:00Z"),
  } });
});
afterEach(async () => {
  await client.surveyResponse.deleteMany({ where: { alumniId: { in: alumniIds } } });
  await client.alumni.deleteMany({ where: { id: { in: alumniIds } } });
  await client.survey.deleteMany({ where: { referenceProgram: { institutionId } } });
  await client.program.deleteMany({ where: { institutionId } });
  await client.institution.delete({ where: { id: institutionId } });
});
afterAll(async () => { await client.$disconnect(); await observer.end(); });

function request(changes: DegreeChanges): UpdateDegreeInput {
  return { alumniId: degree.alumniId, degreeId: degree.id, changes };
}

function confirm(selectedSurvey = survey) {
  return createConfirmedSurveyResponse(client, {
    surveyId: selectedSurvey.id, alumniId: degree.alumniId, referenceDegreeId: degree.id, referenceDegreeConfirmed: true,
  }, configuration);
}

async function snapshot() {
  return {
    degree: await client.degree.findUniqueOrThrow({ where: { id: degree.id } }),
    responses: await client.surveyResponse.findMany({ where: { referenceDegreeId: degree.id }, orderBy: { id: "asc" } }),
  };
}

async function rejectsWithoutChanges(input: UpdateDegreeInput, error: Record<string, unknown>) {
  const before = await snapshot();
  await expect(updateDegree(client, input)).rejects.toMatchObject(error);
  expect(await snapshot()).toEqual(before);
}

const postgresCheckViolation = {
  code: "P2039",
  meta: { driverAdapterError: { cause: {
    originalCode: "23514",
    originalMessage: expect.stringContaining('violates check constraint "Degree_'),
  } } },
};

async function blockedQueries(blockerPid: number) {
  const result = await observer.query<{ pid: number; query: string }>(
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

describe("Protected Degree updates", () => {
  it("updates a nonreferenced Degree and returns only after commit", async () => {
    const updated = await updateDegree(client, request({ level: "MASTER", status: "IN_PROGRESS", endYear: null, graduationYear: null, title: "Synthetic Master's Studies" }));
    expect(updated).toMatchObject({ id: degree.id, alumniId: degree.alumniId, level: "MASTER", status: "IN_PROGRESS", endYear: null, graduationYear: null });
    const committed = await observer.query('SELECT * FROM "Degree" WHERE id = $1 FOR UPDATE NOWAIT', [degree.id]);
    expect(committed.rows).toEqual([updated]);
    expect(await client.surveyResponse.count({ where: { referenceDegreeId: degree.id } })).toBe(0);
  });

  it("updates title and fieldOfStudy on a referenced Degree without changing its response", async () => {
    const response = await confirm();
    const updated = await updateDegree(client, request({ title: " Synthetic Revised Degree ", fieldOfStudy: "Synthetic Revised Field" }));
    expect(updated).toMatchObject({ title: " Synthetic Revised Degree ", fieldOfStudy: "Synthetic Revised Field" });
    expect(await client.surveyResponse.findUniqueOrThrow({ where: { id: response.id } })).toEqual(response);
  });

  it("updates consistent years and permits unknown graduationYear on a referenced Degree", async () => {
    const response = await confirm();
    expect(await updateDegree(client, request({ startYear: 2017, endYear: 2021, graduationYear: 2022 }))).toMatchObject({ startYear: 2017, endYear: 2021, graduationYear: 2022 });
    expect(await updateDegree(client, request({ graduationYear: null }))).toMatchObject({ graduationYear: null });
    expect(await client.surveyResponse.findUniqueOrThrow({ where: { id: response.id } })).toEqual(response);
  });

  it.each(["IN_PROGRESS", "UNKNOWN", "ENDED_WITHOUT_DEGREE"] as const)("rejects changing a referenced Degree to %s", async status => {
    const response = await confirm();
    await rejectsWithoutChanges(request({ status, endYear: null, graduationYear: null }), {
      name: "ProtectedDegreeUpdateError", degreeId: degree.id, surveyResponseId: response.id, reason: "NOT_COMPLETED",
    });
  });

  it("rejects changing a referenced Degree to another Program", async () => {
    const response = await confirm();
    const other = await client.program.create({ data: { institutionId, name: "Synthetic Unrelated Program" } });
    await rejectsWithoutChanges(request({ programId: other.id }), { name: "ProtectedDegreeUpdateError", surveyResponseId: response.id, reason: "PROGRAM_MISMATCH" });
  });

  it("rejects removing the Program from a referenced Degree", async () => {
    await confirm();
    await rejectsWithoutChanges(request({ programId: null }), { name: "ProtectedDegreeUpdateError", reason: "PROGRAM_MISMATCH" });
  });

  it("retains a valid status and Program, comparing UUID identities rather than spelling", async () => {
    const response = await confirm();
    const updated = await updateDegree(client, {
      ...request({ status: "COMPLETED", programId: degree.programId!.toUpperCase() }),
      alumniId: degree.alumniId.toUpperCase(), degreeId: degree.id.toUpperCase(),
    });
    expect(updated).toMatchObject({ id: degree.id, alumniId: degree.alumniId, status: "COMPLETED", programId: degree.programId });
    expect(await client.surveyResponse.findUniqueOrThrow({ where: { id: response.id } })).toEqual(response);
  });

  it("preserves every response to multiple Surveys, including CLOSED Surveys", async () => {
    await confirm();
    const anotherSurvey = await client.survey.create({ data: { name: "Synthetic Second Degree Survey", referenceProgramId: survey.referenceProgramId, status: "OPEN" } });
    await confirm(anotherSurvey);
    await client.survey.update({ where: { id: anotherSurvey.id }, data: { status: "CLOSED" } });
    const responses = (await snapshot()).responses;
    expect(responses).toHaveLength(2);
    await updateDegree(client, request({ title: "Synthetic Shared Reference" }));
    expect((await snapshot()).responses).toEqual(responses);
    await rejectsWithoutChanges(request({ programId: null }), { name: "ProtectedDegreeUpdateError", reason: "PROGRAM_MISMATCH" });
  });

  it("rejects when one referencing Survey matches but another does not", async () => {
    await confirm();
    const other = await client.program.create({ data: { institutionId, name: "Synthetic Conflicting Reference Program" } });
    const anotherSurvey = await client.survey.create({ data: { name: "Synthetic Inconsistent Reference Survey", referenceProgramId: other.id } });
    // Direct synthetic SQL/Prisma setup demonstrates why every reference must be checked.
    const inconsistent = await client.surveyResponse.create({ data: { surveyId: anotherSurvey.id, alumniId: degree.alumniId, referenceDegreeId: degree.id, confirmedAt: new Date() } });
    await rejectsWithoutChanges(request({ title: "Synthetic Attempted Revision" }), { name: "ProtectedDegreeUpdateError", surveyResponseId: inconsistent.id, reason: "PROGRAM_MISMATCH" });
    await rejectsWithoutChanges(request({ programId: other.id }), { name: "ProtectedDegreeUpdateError", reason: "PROGRAM_MISMATCH" });
  });

  it("rejects a missing Alumni", async () => {
    const alumniId = randomUUID();
    await rejectsWithoutChanges({ ...request({ title: "Synthetic Revision" }), alumniId }, { name: "AlumniNotFoundError", alumniId });
  });

  it("rejects a missing Degree", async () => {
    const degreeId = randomUUID();
    await rejectsWithoutChanges({ ...request({ title: "Synthetic Revision" }), degreeId }, { name: "DegreeNotFoundError", degreeId });
  });

  it("rejects an ownership mismatch", async () => {
    const other = await client.alumni.create({ data: {} });
    alumniIds.push(other.id);
    await rejectsWithoutChanges({ ...request({ title: "Synthetic Revision" }), alumniId: other.id }, { name: "DegreeOwnershipMismatchError", degreeId: degree.id, alumniId: other.id });
  });

  it.each(["alumniId", "id", "createdAt", "updatedAt", "alumni", "surveyResponses"])("rejects unsupported %s changes, including ownership transfers", async field => {
    const other = await client.alumni.create({ data: {} });
    alumniIds.push(other.id);
    const changes = { title: "Synthetic Forbidden Revision", [field]: other.id } as DegreeChanges;
    await rejectsWithoutChanges(request(changes), { name: "UnsupportedDegreeUpdateFieldError", field });
  });

  it.each(["status", "programId", "startYear"])("rejects Prisma operation objects instead of scalar %s values", async field => {
    const changes = { [field]: { set: field === "status" ? "IN_PROGRESS" : null } } as DegreeChanges;
    await rejectsWithoutChanges(request(changes), { name: "InvalidDegreeUpdateValueError", field });
  });

  it("allows ordinary nullable Program and direct Institution changes when unreferenced", async () => {
    expect(await updateDegree(client, request({ programId: null, institutionId }))).toMatchObject({ programId: null, institutionId });
    expect(await updateDegree(client, request({ institutionId: null }))).toMatchObject({ programId: null, institutionId: null });
    expect(await updateDegree(client, request({ programId: survey.referenceProgramId }))).toMatchObject({ programId: survey.referenceProgramId, institutionId: null });
  });

  it.each([
    { startYear: 0 }, { endYear: 10000 }, { graduationYear: -1 },
    { startYear: 2024, endYear: 2023, graduationYear: 2025 },
    { graduationYear: 2015 }, { status: "IN_PROGRESS", endYear: null },
  ] satisfies DegreeChanges[])("lets PostgreSQL reject invalid year information: %j", async changes => {
    // The service must reach the database CHECKs, then roll back all fields.
    await rejectsWithoutChanges(request({ title: "Synthetic Rolled Back Revision", ...changes }), postgresCheckViolation);
  });

  it("preserves database catalog exclusion and nonblank text constraints", async () => {
    await rejectsWithoutChanges(request({ institutionId }), postgresCheckViolation);
    await rejectsWithoutChanges(request({ title: " \t\n" }), postgresCheckViolation);
    await rejectsWithoutChanges(request({ fieldOfStudy: "" }), postgresCheckViolation);
  });

  it("maintains updatedAt and retains createdAt after successful updates", async () => {
    const updated = await updateDegree(client, request({ title: "Synthetic Timestamp Revision" }));
    expect(updated.updatedAt.getTime()).toBeGreaterThan(degree.updatedAt.getTime());
    expect(updated.createdAt).toEqual(degree.createdAt);
  });

  it("does not acquire a Survey row lock when validating existing responses", async () => {
    await confirm();
    const db = await observer.connect();
    let updating: Promise<Degree> | undefined;
    try {
      await db.query("BEGIN");
      await db.query('SELECT id FROM "Survey" WHERE id = $1 FOR UPDATE', [survey.id]);
      const pid = (await db.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
      let finished = false;
      updating = updateDegree(client, request({ title: "Synthetic Unlocked Survey Revision" }));
      void updating.then(() => { finished = true; }, () => { finished = true; });
      await expect.poll(async () => finished || (await blockedQueries(pid)).some(row => /Survey/.test(row.query)), { timeout: 3000 }).toBe(true);
      expect(finished).toBe(true);
      expect(await updating).toMatchObject({ title: "Synthetic Unlocked Survey Revision" });
    } finally { await db.query("ROLLBACK"); db.release(); await Promise.allSettled([updating]); }
  });
});

describe("Degree updates and confirmed response concurrency", () => {
  it("A: update locks Alumni first; creation waits and validates the committed updated Degree", async () => {
    const db = await observer.connect();
    let updating: Promise<Degree> | undefined;
    let creation: Promise<SurveyResponse> | undefined;
    try {
      await db.query("BEGIN");
      // Pause the real update service after it acquires Alumni, before Degree.
      await db.query('SELECT id FROM "Degree" WHERE id = $1 FOR UPDATE', [degree.id]);
      const pid = (await db.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
      updating = updateDegree(client, request({ status: "IN_PROGRESS", endYear: null, graduationYear: null }));
      void updating.catch(() => {});
      let updaterPid: number | undefined;
      await expect.poll(async () => {
        updaterPid = (await blockedQueries(pid)).find(row => /Degree/.test(row.query) && /FOR UPDATE/.test(row.query))?.pid;
        return updaterPid;
      }, { timeout: 3000 }).toBeDefined();
      await expect(observer.query('SELECT id FROM "Alumni" WHERE id = $1 FOR UPDATE NOWAIT', [degree.alumniId])).rejects.toMatchObject({ code: "55P03" });
      creation = confirm();
      const result = Promise.allSettled([creation]);
      await expect.poll(async () => (await blockedQueries(updaterPid!)).some(row => /Alumni/.test(row.query) && /FOR UPDATE/.test(row.query)), { timeout: 3000 }).toBe(true);
      // Creation already holds Survey; any inverse Survey lock would deadlock.
      await expect(observer.query('SELECT id FROM "Survey" WHERE id = $1 FOR UPDATE NOWAIT', [survey.id])).rejects.toMatchObject({ code: "55P03" });
      await db.query("COMMIT");
      expect(await updating).toMatchObject({ status: "IN_PROGRESS" });
      expect(await result).toMatchObject([{ status: "rejected", reason: { name: "InvalidReferenceDegreeError", reason: "NOT_COMPLETED" } }]);
      expect(await client.surveyResponse.count({ where: { referenceDegreeId: degree.id } })).toBe(0);
    } finally { await db.query("ROLLBACK"); db.release(); await Promise.allSettled([updating, creation]); }
  });

  it("B: creation locks Alumni first; update waits and protects the committed response", async () => {
    const db = await observer.connect();
    let updating: Promise<Degree> | undefined;
    let creation: Promise<SurveyResponse> | undefined;
    try {
      await db.query("BEGIN");
      // Pause the real C.2 INSERT after all validation and row locks.
      await db.query('LOCK TABLE "SurveyResponse" IN SHARE MODE');
      const pid = (await db.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
      creation = confirm();
      void creation.catch(() => {});
      let creatorPid: number | undefined;
      await expect.poll(async () => {
        creatorPid = (await blockedQueries(pid)).find(row => /INSERT INTO/.test(row.query) && /SurveyResponse/.test(row.query))?.pid;
        return creatorPid;
      }, { timeout: 3000 }).toBeDefined();
      updating = updateDegree(client, request({ status: "UNKNOWN", endYear: null, graduationYear: null }));
      const result = Promise.allSettled([updating]);
      await expect.poll(async () => (await blockedQueries(creatorPid!)).some(row => /Alumni/.test(row.query) && /FOR UPDATE/.test(row.query)), { timeout: 3000 }).toBe(true);
      expect(await client.surveyResponse.count({ where: { referenceDegreeId: degree.id } })).toBe(0);
      await db.query("COMMIT");
      const response = await creation;
      expect(await result).toMatchObject([{ status: "rejected", reason: { name: "ProtectedDegreeUpdateError", surveyResponseId: response.id, reason: "NOT_COMPLETED" } }]);
      expect(await client.degree.findUniqueOrThrow({ where: { id: degree.id } })).toEqual(degree);
      expect(await client.surveyResponse.findUniqueOrThrow({ where: { id: response.id } })).toEqual(response);
    } finally { await db.query("ROLLBACK"); db.release(); await Promise.allSettled([updating, creation]); }
  });
});
