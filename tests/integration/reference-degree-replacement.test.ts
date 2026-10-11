import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient, type Degree, type Survey, type SurveyResponse } from "../../src/generated/prisma/client";
import { updateDegree } from "../../src/lib/degree-service";
import type { SurveyResponseServiceConfiguration } from "../../src/lib/operator-scope";
import {
  createConfirmedSurveyResponse,
  replaceConfirmedReferenceDegree,
  type ReplaceConfirmedReferenceDegreeInput,
} from "../../src/lib/survey-response-service";
import { updateSurveyStatus } from "../../src/lib/survey-service";

const connectionString = process.env.DATABASE_URL;
const client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const observer = new Pool({ connectionString });
let institutionId: string;
let alumniIds: string[];
let otherInstitutionIds: string[];
let survey: Survey;
let degreeA: Degree;
let degreeB: Degree;
let response: SurveyResponse;
let input: ReplaceConfirmedReferenceDegreeInput;
let configuration: SurveyResponseServiceConfiguration;

async function createDegree(alumniId: string) {
  return client.degree.create({ data: {
    alumniId, programId: survey.referenceProgramId, level: "BACHELOR", status: "COMPLETED", graduationYear: 2020,
  } });
}

// Committed synthetic fixtures are visible to the independent concurrent connections.
beforeAll(async () => {
  const version = await observer.query("SHOW server_version_num");
  expect(Math.floor(Number(version.rows[0].server_version_num) / 10000)).toBe(17);
});
beforeEach(async () => {
  alumniIds = [];
  otherInstitutionIds = [];
  const institution = await client.institution.create({ data: { name: "Synthetic Replacement Institution" } });
  institutionId = institution.id;
  configuration = { operatorScope: { kind: "INSTITUTION", institutionId } };
  const program = await client.program.create({ data: { institutionId, name: "Synthetic Replacement Program" } });
  survey = await client.survey.create({ data: { name: "Synthetic Replacement Survey", referenceProgramId: program.id, status: "OPEN" } });
  const alumni = await client.alumni.create({ data: {} });
  alumniIds.push(alumni.id);
  degreeA = await createDegree(alumni.id);
  degreeB = await createDegree(alumni.id);
  input = { surveyId: survey.id, alumniId: alumni.id, referenceDegreeId: degreeB.id, referenceDegreeConfirmed: true };
  response = await createConfirmedSurveyResponse(client, { ...input, referenceDegreeId: degreeA.id }, configuration);
  // An old timestamp proves refresh without relying on sleeps or clock resolution.
  response = await client.surveyResponse.update({ where: { id: response.id }, data: {
    confirmedAt: new Date("2000-01-01T00:00:00Z"), updatedAt: new Date("2000-01-01T00:00:00Z"),
  } });
});
afterEach(async () => {
  await client.surveyResponse.deleteMany({ where: { alumniId: { in: alumniIds } } });
  await client.alumni.deleteMany({ where: { id: { in: alumniIds } } });
  await client.survey.deleteMany({ where: { referenceProgram: { institutionId } } });
  await client.program.deleteMany({ where: { institutionId } });
  await client.institution.delete({ where: { id: institutionId } });
  await client.institution.deleteMany({ where: { id: { in: otherInstitutionIds } } });
});
afterAll(async () => { await client.$disconnect(); await observer.end(); });

async function responses() {
  return client.surveyResponse.findMany({ where: { alumniId: { in: alumniIds } }, orderBy: { id: "asc" } });
}

async function rejectsWithoutChanges(
  request: ReplaceConfirmedReferenceDegreeInput,
  error: Record<string, unknown>,
  serviceConfiguration = configuration,
) {
  const before = {
    survey: await client.survey.findUniqueOrThrow({ where: { id: survey.id } }),
    degrees: await client.degree.findMany({ where: { alumniId: { in: alumniIds } }, orderBy: { id: "asc" } }),
    responses: await responses(),
  };
  await expect(replaceConfirmedReferenceDegree(client, request, serviceConfiguration)).rejects.toMatchObject(error);
  expect(await client.survey.findUniqueOrThrow({ where: { id: survey.id } })).toEqual(before.survey);
  expect(await client.degree.findMany({ where: { alumniId: { in: alumniIds } }, orderBy: { id: "asc" } })).toEqual(before.degrees);
  expect(await responses()).toEqual(before.responses);
}

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

async function waitingPid(blockerPid: number, table: string, operation: string) {
  let pid: number | undefined;
  await expect.poll(async () => {
    pid = (await blockedQueries(blockerPid)).find(row => row.query.includes(`"${table}"`) && row.query.includes(operation))?.pid;
    return pid;
  }, { timeout: 3000 }).toBeDefined();
  return pid!;
}

describe("Confirmed reference Degree replacement", () => {
  it("atomically replaces A with B, preserving identity and creation time, and commits before returning", async () => {
    const before = Date.now();
    const replaced = await replaceConfirmedReferenceDegree(client, input, configuration);
    expect(replaced).toMatchObject({ id: response.id, createdAt: response.createdAt, surveyId: survey.id, alumniId: degreeA.alumniId, referenceDegreeId: degreeB.id });
    for (const timestamp of [replaced.confirmedAt, replaced.updatedAt]) {
      expect(timestamp.getTime()).toBeGreaterThanOrEqual(before);
      expect(timestamp.getTime()).toBeLessThanOrEqual(Date.now());
    }
    expect(replaced.confirmedAt.getTime()).toBeGreaterThan(response.confirmedAt.getTime());
    expect(replaced.updatedAt.getTime()).toBeGreaterThan(response.updatedAt.getTime());
    expect(await responses()).toEqual([replaced]);
    const committed = await observer.query('SELECT * FROM "SurveyResponse" WHERE id = $1 FOR UPDATE NOWAIT', [response.id]);
    expect(committed.rows).toEqual([replaced]);
    expect(await client.degree.findUniqueOrThrow({ where: { id: degreeA.id } })).toEqual(degreeA);
    expect(await client.degree.findUniqueOrThrow({ where: { id: degreeB.id } })).toEqual(degreeB);
  });

  it("explicitly reconfirms the same Degree without creating another response", async () => {
    const replaced = await replaceConfirmedReferenceDegree(client, { ...input, referenceDegreeId: degreeA.id }, configuration);
    expect(replaced).toMatchObject({ id: response.id, createdAt: response.createdAt, referenceDegreeId: degreeA.id });
    expect(replaced.confirmedAt.getTime()).toBeGreaterThan(response.confirmedAt.getTime());
    expect(replaced.updatedAt.getTime()).toBeGreaterThan(response.updatedAt.getTime());
    expect(await responses()).toEqual([replaced]);
  });

  it.each([undefined, false, null, "true", 1])("rejects nonaffirmative confirmation %s", async confirmation => {
    await rejectsWithoutChanges({ ...input, referenceDegreeConfirmed: confirmation as boolean }, { name: "ReferenceDegreeConfirmationRequiredError", referenceDegreeId: degreeB.id });
  });

  it("requires confirmation even when exactly one eligible Degree exists", async () => {
    await client.degree.delete({ where: { id: degreeB.id } });
    expect(await client.degree.count({ where: { alumniId: input.alumniId, status: "COMPLETED", programId: survey.referenceProgramId } })).toBe(1);
    await rejectsWithoutChanges({ ...input, referenceDegreeId: degreeA.id, referenceDegreeConfirmed: false }, { name: "ReferenceDegreeConfirmationRequiredError" });
  });

  it.each([undefined, null, ""])("requires an explicit Degree selection: %s", async referenceDegreeId => {
    await rejectsWithoutChanges({ ...input, referenceDegreeId: referenceDegreeId as unknown as string }, { name: "ReferenceDegreeSelectionRequiredError" });
  });

  it.each(["DRAFT", "CLOSED"] as const)("rejects replacement in a %s Survey", async status => {
    await updateSurveyStatus(client, survey.id, status);
    await rejectsWithoutChanges(input, { name: "SurveyNotOpenError", surveyId: survey.id, status });
  });

  it("rejects a missing Survey", async () => {
    const surveyId = randomUUID();
    await rejectsWithoutChanges({ ...input, surveyId }, { name: "SurveyNotFoundError", surveyId });
  });

  it("rejects a missing Alumni", async () => {
    const alumniId = randomUUID();
    await rejectsWithoutChanges({ ...input, alumniId }, { name: "AlumniNotFoundError", alumniId });
  });

  it("rejects no existing response without creating one or changing another Alumni's response", async () => {
    const other = await client.alumni.create({ data: {} });
    alumniIds.push(other.id);
    const otherDegree = await createDegree(other.id);
    await rejectsWithoutChanges({ ...input, alumniId: other.id, referenceDegreeId: otherDegree.id }, { name: "SurveyResponseNotFoundError", surveyId: survey.id, alumniId: other.id });
    expect(await responses()).toEqual([response]);
  });

  it("rejects a pair whose original response was removed without recreating it", async () => {
    await client.surveyResponse.delete({ where: { id: response.id } });
    await rejectsWithoutChanges(input, { name: "SurveyResponseNotFoundError", surveyId: survey.id, alumniId: input.alumniId });
    expect(await responses()).toEqual([]);
  });

  it("rejects another Alumni's selected Degree", async () => {
    const other = await client.alumni.create({ data: {} });
    alumniIds.push(other.id);
    const otherDegree = await createDegree(other.id);
    await rejectsWithoutChanges({ ...input, referenceDegreeId: otherDegree.id }, { name: "InvalidReferenceDegreeError", referenceDegreeId: otherDegree.id, reason: "NOT_OWNED" });
  });

  it.each(["IN_PROGRESS", "UNKNOWN", "ENDED_WITHOUT_DEGREE"] as const)("rejects a selected %s Degree", async status => {
    await updateDegree(client, { alumniId: input.alumniId, degreeId: degreeB.id, changes: { status, graduationYear: null } });
    await rejectsWithoutChanges(input, { name: "InvalidReferenceDegreeError", reason: "NOT_COMPLETED" });
  });

  it("rejects a selected Degree from the wrong Program", async () => {
    const other = await client.program.create({ data: { institutionId, name: "Synthetic Other Replacement Program" } });
    await updateDegree(client, { alumniId: input.alumniId, degreeId: degreeB.id, changes: { programId: other.id } });
    await rejectsWithoutChanges(input, { name: "InvalidReferenceDegreeError", reason: "PROGRAM_MISMATCH" });
  });

  it("rejects a selected Degree with unknown Program", async () => {
    await updateDegree(client, { alumniId: input.alumniId, degreeId: degreeB.id, changes: { programId: null } });
    await rejectsWithoutChanges(input, { name: "InvalidReferenceDegreeError", reason: "PROGRAM_MISMATCH" });
  });

  it("rejects a missing Degree", async () => {
    const referenceDegreeId = randomUUID();
    await rejectsWithoutChanges({ ...input, referenceDegreeId }, { name: "ReferenceDegreeNotFoundError", referenceDegreeId });
  });

  it("accepts a COMPLETED Degree with unknown graduationYear", async () => {
    await updateDegree(client, { alumniId: input.alumniId, degreeId: degreeB.id, changes: { graduationYear: null } });
    expect(await replaceConfirmedReferenceDegree(client, input, configuration)).toMatchObject({ referenceDegreeId: degreeB.id });
  });

  it("accepts uppercase UUID spellings using the locked row identities", async () => {
    expect(await replaceConfirmedReferenceDegree(client, {
      ...input, surveyId: input.surveyId.toUpperCase(), alumniId: input.alumniId.toUpperCase(), referenceDegreeId: input.referenceDegreeId.toUpperCase(),
    }, configuration)).toMatchObject({ id: response.id, surveyId: survey.id, alumniId: degreeA.alumniId, referenceDegreeId: degreeB.id });
  });

  it("generates timestamps server-side and ignores supplied identity and timestamp fields", async () => {
    const supplied = new Date("1990-01-01T00:00:00Z");
    const request = { ...input, id: randomUUID(), createdAt: supplied, updatedAt: supplied, confirmedAt: supplied };
    const before = Date.now();
    const replaced = await replaceConfirmedReferenceDegree(client, request, configuration);
    expect(replaced).toMatchObject({ id: response.id, createdAt: response.createdAt, surveyId: response.surveyId, alumniId: response.alumniId });
    expect(replaced.confirmedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(replaced.updatedAt.getTime()).toBeGreaterThanOrEqual(before);
  });

  it("does not accept a supplied confirmedAt as affirmative confirmation", async () => {
    await rejectsWithoutChanges({ ...input, referenceDegreeConfirmed: false, confirmedAt: new Date() } as ReplaceConfirmedReferenceDegreeInput, { name: "ReferenceDegreeConfirmationRequiredError" });
  });

  it("accepts exact FACULTY scope and rejects mismatching or missing Program faculty", async () => {
    const facultyConfiguration = { operatorScope: { kind: "FACULTY", institutionId, faculty: "Synthetic Replacement Faculty" } } as const;
    await rejectsWithoutChanges(input, { name: "SurveyOutsideOperatorScopeError", reason: "FACULTY_MISMATCH" }, facultyConfiguration);
    await client.program.update({ where: { id: survey.referenceProgramId }, data: { faculty: "Synthetic Other Faculty" } });
    await rejectsWithoutChanges(input, { name: "SurveyOutsideOperatorScopeError", reason: "FACULTY_MISMATCH" }, facultyConfiguration);
    await client.program.update({ where: { id: survey.referenceProgramId }, data: { faculty: facultyConfiguration.operatorScope.faculty } });
    expect(await replaceConfirmedReferenceDegree(client, input, facultyConfiguration)).toMatchObject({ referenceDegreeId: degreeB.id });
  });

  it("rejects Institution scope mismatch despite alumni-supplied operator data", async () => {
    const other = await client.institution.create({ data: { name: "Synthetic Other Replacement Operator" } });
    otherInstitutionIds.push(other.id);
    const request = { ...input, operatorScope: configuration.operatorScope };
    await rejectsWithoutChanges(request, { name: "SurveyOutsideOperatorScopeError", reason: "INSTITUTION_MISMATCH" }, { operatorScope: { kind: "INSTITUTION", institutionId: other.id } });
  });

  it.each([
    { scope: undefined, reason: "MISSING_SCOPE" },
    { scope: { kind: "FACULTY", institutionId: randomUUID() }, reason: "INVALID_FACULTY" },
    { scope: { kind: "INSTITUTION", institutionId: "not-a-uuid" }, reason: "INVALID_INSTITUTION_ID" },
    { scope: { kind: "INSTITUTION", institutionId: randomUUID() }, reason: "INSTITUTION_NOT_FOUND" },
  ])("fails closed for invalid operator configuration: $reason", async ({ scope, reason }) => {
    await rejectsWithoutChanges(input, { name: "InvalidOperatorConfigurationError", reason }, { operatorScope: scope } as SurveyResponseServiceConfiguration);
  });

  it("releases the old Degree's reference protection and protects the newly selected Degree", async () => {
    const replaced = await replaceConfirmedReferenceDegree(client, input, configuration);
    expect(await updateDegree(client, { alumniId: input.alumniId, degreeId: degreeA.id, changes: { status: "IN_PROGRESS", graduationYear: null } })).toMatchObject({ status: "IN_PROGRESS" });
    await expect(updateDegree(client, { alumniId: input.alumniId, degreeId: degreeB.id, changes: { status: "IN_PROGRESS", graduationYear: null } })).rejects.toMatchObject({ name: "ProtectedDegreeUpdateError", surveyResponseId: response.id });
    expect(await responses()).toEqual([replaced]);
  });
});

describe("Reference replacement concurrency", () => {
  it("waits for an earlier Survey closure and rejects its committed CLOSED state", async () => {
    const db = await observer.connect();
    let replacement: Promise<SurveyResponse> | undefined;
    try {
      await db.query("BEGIN");
      await db.query('UPDATE "Survey" SET status = $1 WHERE id = $2', ["CLOSED", survey.id]);
      const pid = (await db.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
      replacement = replaceConfirmedReferenceDegree(client, input, configuration);
      const result = Promise.allSettled([replacement]);
      await waitingPid(pid, "Survey", "FOR UPDATE");
      await db.query("COMMIT");
      expect(await result).toMatchObject([{ status: "rejected", reason: { name: "SurveyNotOpenError", status: "CLOSED" } }]);
      expect(await responses()).toEqual([response]);
    } finally { await db.query("ROLLBACK"); db.release(); await Promise.allSettled([replacement]); }
  });

  it("holds OPEN and validation locks until replacement commits, then permits Survey closure", async () => {
    const db = await observer.connect();
    let replacement: Promise<SurveyResponse> | undefined;
    let closing: ReturnType<typeof updateSurveyStatus> | undefined;
    try {
      await db.query("BEGIN");
      // Pause the actual UPDATE after validation without a trigger or service hook.
      await db.query('SELECT id FROM "SurveyResponse" WHERE id = $1 FOR UPDATE', [response.id]);
      const pid = (await db.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
      replacement = replaceConfirmedReferenceDegree(client, input, configuration);
      void replacement.catch(() => {});
      const replacementPid = await waitingPid(pid, "SurveyResponse", "UPDATE");
      for (const [table, id] of [["Survey", survey.id], ["Program", survey.referenceProgramId], ["Alumni", input.alumniId], ["Degree", degreeB.id]]) {
        await expect(observer.query(`SELECT id FROM "${table}" WHERE id = $1 FOR UPDATE NOWAIT`, [id])).rejects.toMatchObject({ code: "55P03" });
      }
      expect(await responses()).toEqual([response]);
      closing = updateSurveyStatus(client, survey.id, "CLOSED");
      await waitingPid(replacementPid, "Survey", "FOR UPDATE");
      await db.query("COMMIT");
      const replaced = await replacement;
      expect((await closing).status).toBe("CLOSED");
      expect(replaced.referenceDegreeId).toBe(degreeB.id);
      expect(await responses()).toEqual([replaced]);
    } finally { await db.query("ROLLBACK"); db.release(); await Promise.allSettled([replacement, closing]); }
  });

  it("A: a Degree update locks Alumni first; replacement waits and rejects the updated ineligible Degree", async () => {
    const db = await observer.connect();
    let updating: Promise<Degree> | undefined;
    let replacement: Promise<SurveyResponse> | undefined;
    try {
      await db.query("BEGIN");
      await db.query('SELECT id FROM "Degree" WHERE id = $1 FOR UPDATE', [degreeB.id]);
      const pid = (await db.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
      updating = updateDegree(client, { alumniId: input.alumniId, degreeId: degreeB.id, changes: { status: "IN_PROGRESS", graduationYear: null } });
      void updating.catch(() => {});
      const updaterPid = await waitingPid(pid, "Degree", "FOR UPDATE");
      await expect(observer.query('SELECT id FROM "Alumni" WHERE id = $1 FOR UPDATE NOWAIT', [input.alumniId])).rejects.toMatchObject({ code: "55P03" });
      replacement = replaceConfirmedReferenceDegree(client, input, configuration);
      const result = Promise.allSettled([replacement]);
      await waitingPid(updaterPid, "Alumni", "FOR UPDATE");
      await expect(observer.query('SELECT id FROM "Survey" WHERE id = $1 FOR UPDATE NOWAIT', [survey.id])).rejects.toMatchObject({ code: "55P03" });
      await db.query("COMMIT");
      expect(await updating).toMatchObject({ status: "IN_PROGRESS" });
      expect(await result).toMatchObject([{ status: "rejected", reason: { name: "InvalidReferenceDegreeError", reason: "NOT_COMPLETED" } }]);
      expect(await responses()).toEqual([response]);
    } finally { await db.query("ROLLBACK"); db.release(); await Promise.allSettled([updating, replacement]); }
  });

  it("B: replacement locks Alumni first; Degree update waits and protects the committed new reference", async () => {
    const db = await observer.connect();
    let updating: Promise<Degree> | undefined;
    let replacement: Promise<SurveyResponse> | undefined;
    try {
      await db.query("BEGIN");
      await db.query('SELECT id FROM "SurveyResponse" WHERE id = $1 FOR UPDATE', [response.id]);
      const pid = (await db.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
      replacement = replaceConfirmedReferenceDegree(client, input, configuration);
      void replacement.catch(() => {});
      const replacementPid = await waitingPid(pid, "SurveyResponse", "UPDATE");
      updating = updateDegree(client, { alumniId: input.alumniId, degreeId: degreeB.id, changes: { status: "UNKNOWN", graduationYear: null } });
      const result = Promise.allSettled([updating]);
      await waitingPid(replacementPid, "Alumni", "FOR UPDATE");
      expect(await responses()).toEqual([response]);
      await db.query("COMMIT");
      const replaced = await replacement;
      expect(await result).toMatchObject([{ status: "rejected", reason: { name: "ProtectedDegreeUpdateError", surveyResponseId: response.id, reason: "NOT_COMPLETED" } }]);
      expect(await client.degree.findUniqueOrThrow({ where: { id: degreeB.id } })).toEqual(degreeB);
      expect(await responses()).toEqual([replaced]);
    } finally { await db.query("ROLLBACK"); db.release(); await Promise.allSettled([updating, replacement]); }
  });

  it("serializes concurrent replacements into one consistent existing response", async () => {
    const degreeC = await createDegree(input.alumniId);
    const db = await observer.connect();
    let replacements: Promise<SurveyResponse>[] = [];
    try {
      await db.query("BEGIN");
      await db.query('SELECT id FROM "Survey" WHERE id = $1 FOR UPDATE', [survey.id]);
      const pid = (await db.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
      replacements = [
        replaceConfirmedReferenceDegree(client, input, configuration),
        replaceConfirmedReferenceDegree(client, { ...input, referenceDegreeId: degreeC.id }, configuration),
      ];
      const result = Promise.allSettled(replacements);
      await expect.poll(async () => (await blockedQueries(pid)).filter(row => row.query.includes('"Survey"') && row.query.includes("FOR UPDATE")).length, { timeout: 3000 }).toBe(2);
      await db.query("COMMIT");
      expect((await result).every(outcome => outcome.status === "fulfilled")).toBe(true);
      const replaced = await Promise.all(replacements);
      for (const value of replaced) expect(value).toMatchObject({ id: response.id, createdAt: response.createdAt, surveyId: survey.id, alumniId: input.alumniId });
      expect(replaced.map(value => value.referenceDegreeId)).toEqual([degreeB.id, degreeC.id]);
      const stored = await responses();
      expect(stored).toHaveLength(1);
      expect(replaced).toContainEqual(stored[0]);
    } finally { await db.query("ROLLBACK"); db.release(); await Promise.allSettled(replacements); }
  });
});
