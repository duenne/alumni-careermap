import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient, type Degree, type Survey, type SurveyResponse } from "../../src/generated/prisma/client";
import { updateSurveyStatus } from "../../src/lib/survey-service";
import type { SurveyResponseServiceConfiguration } from "../../src/lib/operator-scope";
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
let configuration: SurveyResponseServiceConfiguration;
let otherInstitutionIds: string[];

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
  otherInstitutionIds = [];
  const institution = await client.institution.create({ data: { name: "Synthetic Response Institution" } });
  institutionId = institution.id;
  configuration = { operatorScope: { kind: "INSTITUTION", institutionId } };
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
  await client.institution.deleteMany({ where: { id: { in: otherInstitutionIds } } });
});
afterAll(async () => { await client.$disconnect(); await observer.end(); });

async function rejectsWithoutChanges(
  request: CreateConfirmedSurveyResponseInput,
  error: Record<string, unknown>,
  serviceConfiguration = configuration,
) {
  const before = {
    survey: await client.survey.findUniqueOrThrow({ where: { id: survey.id } }),
    degree: await client.degree.findUniqueOrThrow({ where: { id: degree.id } }),
    responses: await client.surveyResponse.findMany({ where: { surveyId: survey.id } }),
  };
  await expect(createConfirmedSurveyResponse(client, request, serviceConfiguration)).rejects.toMatchObject(error);
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
    const response = await createConfirmedSurveyResponse(client, input, configuration);
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
    }, configuration);
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
    expect(await createConfirmedSurveyResponse(client, input, configuration)).toMatchObject({ referenceDegreeId: degree.id });
  });

  it("uses the explicit selection among multiple candidates, without choosing the highest or newest Degree", async () => {
    const newer = await createDegree(input.alumniId);
    await client.degree.update({ where: { id: newer.id }, data: { level: "MASTER", graduationYear: 2024 } });
    const response = await createConfirmedSurveyResponse(client, input, configuration);
    expect(response.referenceDegreeId).toBe(degree.id);
    expect(await client.surveyResponse.count({ where: { surveyId: survey.id, alumniId: input.alumniId } })).toBe(1);
  });

  it("generates confirmedAt on the server and ignores a supplied timestamp", async () => {
    const supplied = new Date("2000-01-01T00:00:00Z");
    const request = { ...input, confirmedAt: supplied };
    const before = Date.now();
    const response = await createConfirmedSurveyResponse(client, request, configuration);
    expect(response.confirmedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(response.confirmedAt.getTime()).toBeLessThanOrEqual(Date.now());
    expect(response.confirmedAt).not.toEqual(supplied);
  });

  it("does not accept a supplied confirmedAt as affirmative confirmation", async () => {
    const request = { ...input, referenceDegreeConfirmed: false, confirmedAt: new Date() };
    await rejectsWithoutChanges(request, { name: "ReferenceDegreeConfirmationRequiredError" });
  });

  it("rejects duplicate participation without replacing the original reference or confirmation", async () => {
    const original = await createConfirmedSurveyResponse(client, input, configuration);
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
        createConfirmedSurveyResponse(client, input, configuration),
        createConfirmedSurveyResponse(client, { ...input, referenceDegreeId: other.id }, configuration),
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
      creation = createConfirmedSurveyResponse(client, input, configuration);
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
      creation = createConfirmedSurveyResponse(client, input, configuration);
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
      creation = createConfirmedSurveyResponse(client, input, configuration);
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

describe("Survey operator affiliation", () => {
  async function otherInstitution() {
    const institution = await client.institution.create({ data: { name: "Synthetic Other Operator" } });
    otherInstitutionIds.push(institution.id);
    return institution;
  }

  async function rejectsScope(scope: unknown, reason: string) {
    await rejectsWithoutChanges(input, { name: "InvalidOperatorConfigurationError", reason }, {
      operatorScope: scope,
    } as SurveyResponseServiceConfiguration);
  }

  it("accepts the configured INSTITUTION with no faculty restriction", async () => {
    expect(await createConfirmedSurveyResponse(client, input, configuration)).toMatchObject({ surveyId: survey.id });
  });

  it("accepts another Program and faculty within the configured INSTITUTION", async () => {
    const program = await client.program.create({ data: { institutionId, name: "Synthetic Second Program", faculty: "Synthetic Other Faculty" } });
    const anotherSurvey = await client.survey.create({ data: { name: "Synthetic Second Survey", referenceProgramId: program.id } });
    await updateSurveyStatus(client, anotherSurvey.id, "OPEN");
    const anotherDegree = await client.degree.create({ data: { alumniId: input.alumniId, programId: program.id, level: "MASTER", status: "COMPLETED" } });
    expect(await createConfirmedSurveyResponse(client, {
      ...input, surveyId: anotherSurvey.id, referenceDegreeId: anotherDegree.id,
    }, configuration)).toMatchObject({ surveyId: anotherSurvey.id, referenceDegreeId: anotherDegree.id });
  });

  it("rejects a Survey in another Institution before checking response input", async () => {
    const operator = await otherInstitution();
    await rejectsWithoutChanges({
      ...input, alumniId: randomUUID(), referenceDegreeId: randomUUID(), referenceDegreeConfirmed: false,
    }, { name: "SurveyOutsideOperatorScopeError", surveyId: survey.id, reason: "INSTITUTION_MISMATCH" }, {
      operatorScope: { kind: "INSTITUTION", institutionId: operator.id },
    });
  });

  it("accepts an exact FACULTY match in the configured Institution", async () => {
    await client.program.update({ where: { id: survey.referenceProgramId }, data: { faculty: "Synthetic Faculty" } });
    const facultyConfiguration = { operatorScope: { kind: "FACULTY", institutionId, faculty: "Synthetic Faculty" } } as const;
    expect(await createConfirmedSurveyResponse(client, input, facultyConfiguration)).toMatchObject({ surveyId: survey.id });
  });

  it.each(["Synthetic Other Faculty", "synthetic Faculty", " Synthetic Faculty "])("rejects a nonexact faculty match: %s", async faculty => {
    await client.program.update({ where: { id: survey.referenceProgramId }, data: { faculty: "Synthetic Faculty" } });
    await rejectsWithoutChanges(input, { name: "SurveyOutsideOperatorScopeError", reason: "FACULTY_MISMATCH" }, {
      operatorScope: { kind: "FACULTY", institutionId, faculty },
    });
  });

  it("rejects NULL Program.faculty without falling back to INSTITUTION", async () => {
    await rejectsWithoutChanges(input, { name: "SurveyOutsideOperatorScopeError", reason: "FACULTY_MISMATCH" }, {
      operatorScope: { kind: "FACULTY", institutionId, faculty: "Synthetic Faculty" },
    });
  });

  it("rejects a matching faculty name in another Institution", async () => {
    await client.program.update({ where: { id: survey.referenceProgramId }, data: { faculty: "Synthetic Faculty" } });
    const operator = await otherInstitution();
    await rejectsWithoutChanges(input, { name: "SurveyOutsideOperatorScopeError", reason: "INSTITUTION_MISMATCH" }, {
      operatorScope: { kind: "FACULTY", institutionId: operator.id, faculty: "Synthetic Faculty" },
    });
  });

  it("accepts uppercase configuration UUIDs as the same Institution identity", async () => {
    expect(await createConfirmedSurveyResponse(client, input, {
      operatorScope: { kind: "INSTITUTION", institutionId: institutionId.toUpperCase() },
    })).toMatchObject({ surveyId: survey.id });
  });

  it.each([undefined, null])("fails closed for missing operator scope: %s", async scope => {
    await rejectsScope(scope, "MISSING_SCOPE");
  });

  it("fails closed for a missing configuration even when response input supplies a scope", async () => {
    const request = { ...input, operatorScope: configuration.operatorScope };
    await expect(createConfirmedSurveyResponse(client, request, undefined as unknown as SurveyResponseServiceConfiguration)).rejects.toMatchObject({
      name: "InvalidOperatorConfigurationError", reason: "MISSING_SCOPE",
    });
    expect(await client.surveyResponse.count({ where: { surveyId: survey.id } })).toBe(0);
  });

  it("does not let alumni-supplied scope override trusted service configuration", async () => {
    const operator = await otherInstitution();
    const request = { ...input, operatorScope: configuration.operatorScope };
    await rejectsWithoutChanges(request, { name: "SurveyOutsideOperatorScopeError", reason: "INSTITUTION_MISMATCH" }, {
      operatorScope: { kind: "INSTITUTION", institutionId: operator.id },
    });
  });

  it.each([{ scope: {} }, { scope: [] }, { scope: "INSTITUTION" }, { scope: { kind: "UNKNOWN" } }])("rejects an invalid scope shape: $scope", async ({ scope }) => {
    await rejectsScope(scope, "INVALID_SCOPE");
  });

  it("rejects an ambiguous INSTITUTION configuration containing a faculty", async () => {
    await rejectsScope({ kind: "INSTITUTION", institutionId, faculty: "Synthetic Faculty" }, "INVALID_SCOPE");
  });

  it.each([undefined, null, "", "not-a-uuid", 42])("rejects an invalid operator Institution ID: %s", async invalidId => {
    await rejectsScope({ kind: "INSTITUTION", institutionId: invalidId }, "INVALID_INSTITUTION_ID");
  });

  it("rejects an unknown operator Institution", async () => {
    await rejectsScope({ kind: "INSTITUTION", institutionId: randomUUID() }, "INSTITUTION_NOT_FOUND");
  });

  it.each([undefined, null, "", " \t\r\n", "\u00a0", 42])("fails closed for incomplete or blank FACULTY configuration: %s", async faculty => {
    await rejectsScope({ kind: "FACULTY", institutionId, faculty }, "INVALID_FACULTY");
  });

  it("requires an Institution ID for FACULTY scope", async () => {
    await rejectsScope({ kind: "FACULTY", faculty: "Synthetic Faculty" }, "INVALID_INSTITUTION_ID");
  });

  it("still enforces reference and confirmation rules with valid FACULTY configuration", async () => {
    await client.program.update({ where: { id: survey.referenceProgramId }, data: { faculty: "Synthetic Faculty" } });
    const facultyConfiguration = { operatorScope: { kind: "FACULTY", institutionId, faculty: "Synthetic Faculty" } } as const;
    await rejectsWithoutChanges({ ...input, referenceDegreeConfirmed: false }, { name: "ReferenceDegreeConfirmationRequiredError" }, facultyConfiguration);
    await client.degree.update({ where: { id: degree.id }, data: { programId: null } });
    await rejectsWithoutChanges(input, { name: "InvalidReferenceDegreeError", reason: "PROGRAM_MISMATCH" }, facultyConfiguration);
  });

  it("validates Program affiliation before attempting to lock Alumni", async () => {
    const operator = await otherInstitution();
    const db = await observer.connect();
    let creation: Promise<SurveyResponse> | undefined;
    try {
      await db.query("BEGIN");
      await db.query('SELECT id FROM "Alumni" WHERE id = $1 FOR UPDATE', [input.alumniId]);
      const pid = (await db.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
      let finished = false;
      let outcome: unknown;
      creation = createConfirmedSurveyResponse(client, input, {
        operatorScope: { kind: "INSTITUTION", institutionId: operator.id },
      });
      void creation.then(value => { finished = true; outcome = value; }, error => { finished = true; outcome = error; });
      // Fail promptly if the old implementation tries to lock Alumni first,
      // so a negative test cannot leave a transaction waiting during cleanup.
      await expect.poll(async () => finished || (await blockedQueries(pid)).some(row => /Alumni/.test(row.query)), { timeout: 3000 }).toBe(true);
      expect(finished).toBe(true);
      expect(outcome).toMatchObject({ name: "SurveyOutsideOperatorScopeError" });
      expect(await client.surveyResponse.count({ where: { surveyId: survey.id } })).toBe(0);
    } finally { await db.query("ROLLBACK"); db.release(); await Promise.allSettled([creation]); }
  });

  it("reads affiliation after a concurrent Program change commits", async () => {
    await client.program.update({ where: { id: survey.referenceProgramId }, data: { faculty: "Synthetic Faculty" } });
    const facultyConfiguration = { operatorScope: { kind: "FACULTY", institutionId, faculty: "Synthetic Faculty" } } as const;
    const db = await observer.connect();
    let creation: Promise<SurveyResponse> | undefined;
    try {
      await db.query("BEGIN");
      await db.query('SELECT id FROM "Program" WHERE id = $1 FOR UPDATE', [survey.referenceProgramId]);
      await db.query('UPDATE "Program" SET faculty = $1 WHERE id = $2', ["Synthetic Other Faculty", survey.referenceProgramId]);
      const pid = (await db.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
      creation = createConfirmedSurveyResponse(client, input, facultyConfiguration);
      const settled = Promise.allSettled([creation]);
      await expect.poll(async () => (await blockedQueries(pid)).some(row => /Program/.test(row.query) && /FOR SHARE/.test(row.query)), { timeout: 3000 }).toBe(true);
      await db.query("COMMIT");
      expect(await settled).toMatchObject([{ status: "rejected", reason: { name: "SurveyOutsideOperatorScopeError", reason: "FACULTY_MISMATCH" } }]);
      expect(await client.surveyResponse.count({ where: { surveyId: survey.id } })).toBe(0);
    } finally { await db.query("ROLLBACK"); db.release(); await Promise.allSettled([creation]); }
  });
});
