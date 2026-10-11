import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient, type Degree, type Survey, type SurveyResponse } from "../../src/generated/prisma/client";
import { deleteAlumniProfile } from "../../src/lib/alumni-service";
import { updateDegree } from "../../src/lib/degree-service";
import type { SurveyResponseServiceConfiguration } from "../../src/lib/operator-scope";
import { createConfirmedSurveyResponse, replaceConfirmedReferenceDegree } from "../../src/lib/survey-response-service";
import { updateSurveyStatus } from "../../src/lib/survey-service";

const connectionString = process.env.DATABASE_URL;
const client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const observer = new Pool({ connectionString });
let institutionId: string;
let institutionIds: string[];
let organisationId: string;
let alumniId: string;
let survey: Survey;
let degreeA: Degree;
let degreeB: Degree;
let configuration: SurveyResponseServiceConfiguration;

beforeAll(async () => {
  const version = await observer.query("SHOW server_version_num");
  expect(Math.floor(Number(version.rows[0].server_version_num) / 10000)).toBe(17);
});
beforeEach(async () => {
  // Only catalog/profile setup uses Prisma directly. All lifecycle transitions,
  // reference validation, Degree changes and profile deletion use their services.
  const institution = await client.institution.create({ data: { name: "Synthetic Lifecycle Institution" } });
  institutionId = institution.id;
  institutionIds = [institutionId];
  const faculty = "Synthetic Lifecycle Faculty";
  configuration = { operatorScope: { kind: "FACULTY", institutionId, faculty } };
  const program = await client.program.create({ data: { institutionId, name: "Synthetic Lifecycle Program", faculty } });
  survey = await client.survey.create({ data: { name: "Synthetic Lifecycle Survey", referenceProgramId: program.id } });
  const organisation = await client.organisation.create({ data: { name: "Synthetic Lifecycle Organisation" } });
  organisationId = organisation.id;
  const alumni = await client.alumni.create({ data: {} });
  alumniId = alumni.id;
  degreeA = await client.degree.create({ data: {
    alumniId, programId: program.id, level: "BACHELOR", status: "COMPLETED", startYear: 2016, endYear: 2020, graduationYear: 2020,
  } });
  degreeB = await client.degree.create({ data: {
    alumniId, programId: program.id, level: "MASTER", status: "COMPLETED", startYear: 2021, endYear: 2023,
  } });
  const certificate = await client.degree.create({ data: { alumniId, institutionId, level: "CERTIFICATE", status: "UNKNOWN" } });
  const internship = await client.careerStep.create({ data: {
    alumniId, organisationId, type: "INTERNSHIP", temporalStatus: "ENDED", roleTitle: "Synthetic Project Internship", startYear: 2018, endYear: 2019,
  } });
  const employment = await client.careerStep.create({ data: {
    alumniId, organisationId, type: "EMPLOYMENT", temporalStatus: "ONGOING", roleTitle: "Synthetic Project Role", startYear: 2022,
  } });
  await client.alumniTimelineItem.createMany({ data: [
    { alumniId, type: "DEGREE", degreeId: degreeA.id, position: 1 },
    { alumniId, type: "CAREER_STEP", careerStepId: internship.id, position: 3 },
    { alumniId, type: "DEGREE", degreeId: degreeB.id, position: 5 },
    { alumniId, type: "CAREER_STEP", careerStepId: employment.id, position: 7 },
    { alumniId, type: "DEGREE", degreeId: certificate.id, position: 9 },
  ] });
});
afterEach(async () => {
  await client.surveyResponse.deleteMany({ where: { alumniId } });
  await client.alumni.deleteMany({ where: { id: alumniId } });
  await client.survey.deleteMany({ where: { referenceProgram: { institutionId } } });
  await client.program.deleteMany({ where: { institutionId } });
  await client.organisation.delete({ where: { id: organisationId } });
  await client.institution.deleteMany({ where: { id: { in: institutionIds } } });
});
afterAll(async () => { await client.$disconnect(); await observer.end(); });

function selection(degree = degreeA, selectedSurvey = survey) {
  return { surveyId: selectedSurvey.id, alumniId, referenceDegreeId: degree.id, referenceDegreeConfirmed: true };
}

function changeStatus(degree = degreeA) {
  return updateDegree(client, { alumniId, degreeId: degree.id, changes: { status: "IN_PROGRESS", endYear: null, graduationYear: null } });
}

async function profileSnapshot() {
  const snapshot: Record<string, unknown[]> = {};
  for (const table of ["Alumni", "Degree", "CareerStep", "AlumniTimelineItem", "AlumniContact", "SurveyResponse"]) {
    const column = table === "Alumni" ? "id" : "alumniId";
    snapshot[table] = (await observer.query(`SELECT * FROM "${table}" WHERE "${column}" = $1 ORDER BY id`, [alumniId])).rows;
  }
  return snapshot;
}

async function expectDeleted() {
  for (const records of Object.values(await profileSnapshot())) expect(records).toEqual([]);
}

async function sharedSnapshot() {
  return {
    institution: await client.institution.findUniqueOrThrow({ where: { id: institutionId } }),
    program: await client.program.findUniqueOrThrow({ where: { id: survey.referenceProgramId } }),
    organisation: await client.organisation.findUniqueOrThrow({ where: { id: organisationId } }),
    surveys: await client.survey.findMany({ where: { referenceProgramId: survey.referenceProgramId }, orderBy: { id: "asc" } }),
  };
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

describe("Survey lifecycle across C.1–C.5a services", () => {
  it("opens, confirms, protects, replaces, edits, closes and deletes a complete synthetic profile", async () => {
    expect(survey.status).toBe("DRAFT");
    const initial = await profileSnapshot();
    expect(initial.Degree).toHaveLength(3);
    expect(initial.CareerStep).toHaveLength(2);
    expect(initial.AlumniTimelineItem).toHaveLength(5);
    expect(initial.AlumniContact).toEqual([]);
    expect(await updateSurveyStatus(client, survey.id, "OPEN")).toMatchObject({ status: "OPEN", referenceProgramId: survey.referenceProgramId });

    const response = await createConfirmedSurveyResponse(client, selection(), configuration);
    expect(response).toMatchObject({ alumniId, surveyId: survey.id, referenceDegreeId: degreeA.id });
    expect((await profileSnapshot()).SurveyResponse).toEqual([response]);
    const beforeInvalidUpdate = await profileSnapshot();
    await expect(changeStatus()).rejects.toMatchObject({ name: "ProtectedDegreeUpdateError", surveyResponseId: response.id, reason: "NOT_COMPLETED" });
    expect(await profileSnapshot()).toEqual(beforeInvalidUpdate);

    // A COMPLETED replacement with unknown graduationYear remains eligible.
    expect(degreeB.graduationYear).toBeNull();
    const replacement = await replaceConfirmedReferenceDegree(client, selection(degreeB), configuration);
    expect(replacement).toMatchObject({ id: response.id, createdAt: response.createdAt, alumniId, surveyId: survey.id, referenceDegreeId: degreeB.id });
    expect(replacement.confirmedAt.getTime()).toBeGreaterThanOrEqual(response.confirmedAt.getTime());
    expect(replacement.updatedAt.getTime()).toBeGreaterThanOrEqual(response.updatedAt.getTime());
    expect((await profileSnapshot()).SurveyResponse).toEqual([replacement]);
    expect(await changeStatus()).toMatchObject({ id: degreeA.id, status: "IN_PROGRESS" });
    expect((await profileSnapshot()).SurveyResponse).toEqual([replacement]);

    expect((await updateSurveyStatus(client, survey.id, "CLOSED")).status).toBe("CLOSED");
    const closedProfile = await profileSnapshot();
    for (const operation of [createConfirmedSurveyResponse, replaceConfirmedReferenceDegree]) {
      await expect(operation(client, selection(degreeB), configuration)).rejects.toMatchObject({ name: "SurveyNotOpenError", status: "CLOSED" });
      expect(await profileSnapshot()).toEqual(closedProfile);
    }

    // Optional contact is independent of confirmed participation. No contact
    // service exists yet; this is synthetic contact setup for cascade coverage.
    await client.alumniContact.create({ data: { alumniId, email: "lifecycle@example.invalid" } });
    expect((await profileSnapshot()).AlumniContact).toHaveLength(1);
    const shared = await sharedSnapshot();
    await deleteAlumniProfile(client, alumniId);
    await expectDeleted();
    expect(await sharedSnapshot()).toEqual(shared);
  });

  it("keeps a Degree protected until every Survey has replaced it, including a CLOSED Survey", async () => {
    const second = await client.survey.create({ data: { name: "Synthetic Second Lifecycle Survey", referenceProgramId: survey.referenceProgramId } });
    await updateSurveyStatus(client, survey.id, "OPEN");
    await updateSurveyStatus(client, second.id, "OPEN");
    const firstResponse = await createConfirmedSurveyResponse(client, selection(), configuration);
    const secondResponse = await createConfirmedSurveyResponse(client, selection(degreeA, second), configuration);
    await updateSurveyStatus(client, second.id, "CLOSED");
    const firstReplacement = await replaceConfirmedReferenceDegree(client, selection(degreeB), configuration);
    expect(firstReplacement.id).toBe(firstResponse.id);
    const before = await profileSnapshot();
    await expect(changeStatus()).rejects.toMatchObject({ name: "ProtectedDegreeUpdateError", surveyResponseId: secondResponse.id });
    expect(await profileSnapshot()).toEqual(before);

    await updateSurveyStatus(client, second.id, "OPEN");
    const secondReplacement = await replaceConfirmedReferenceDegree(client, selection(degreeB, second), configuration);
    expect(secondReplacement.id).toBe(secondResponse.id);
    expect(await changeStatus()).toMatchObject({ status: "IN_PROGRESS" });
    expect((await profileSnapshot()).SurveyResponse).toEqual([firstReplacement, secondReplacement].sort((a, b) => a.id.localeCompare(b.id)));
    await expect(changeStatus(degreeB)).rejects.toMatchObject({ name: "ProtectedDegreeUpdateError", reason: "NOT_COMPLETED" });
    await updateSurveyStatus(client, survey.id, "CLOSED");
    await updateSurveyStatus(client, second.id, "CLOSED");
    const shared = await sharedSnapshot();
    await deleteAlumniProfile(client, alumniId);
    await expectDeleted();
    expect(await sharedSnapshot()).toEqual(shared);
  });

  it.each(["other Institution", "other faculty", "missing Program faculty"] as const)("enforces %s boundaries during both creation and replacement", async boundary => {
    let invalid: SurveyResponseServiceConfiguration;
    let valid = configuration;
    const faculty = "Synthetic Lifecycle Faculty";
    if (boundary === "other Institution") {
      const other = await client.institution.create({ data: { name: "Synthetic Outside Lifecycle Institution" } });
      institutionIds.push(other.id);
      invalid = { operatorScope: { kind: "FACULTY", institutionId: other.id, faculty } };
    } else if (boundary === "other faculty") {
      invalid = { operatorScope: { kind: "FACULTY", institutionId, faculty: "Synthetic Outside Faculty" } };
    } else {
      await client.program.update({ where: { id: survey.referenceProgramId }, data: { faculty: null } });
      invalid = configuration;
      valid = { operatorScope: { kind: "INSTITUTION", institutionId } };
    }
    await updateSurveyStatus(client, survey.id, "OPEN");
    const error = { name: "SurveyOutsideOperatorScopeError", reason: boundary === "other Institution" ? "INSTITUTION_MISMATCH" : "FACULTY_MISMATCH" };
    const before = await profileSnapshot();
    await expect(createConfirmedSurveyResponse(client, selection(), invalid)).rejects.toMatchObject(error);
    expect(await profileSnapshot()).toEqual(before);
    const response = await createConfirmedSurveyResponse(client, selection(), valid);
    const confirmed = await profileSnapshot();
    await expect(replaceConfirmedReferenceDegree(client, selection(degreeB), invalid)).rejects.toMatchObject(error);
    expect(await profileSnapshot()).toEqual(confirmed);
    expect(confirmed.SurveyResponse).toEqual([response]);
  });

  it.each([false, undefined])("requires explicit confirmation %s with one eligible Degree, for creation and reconfirmation", async referenceDegreeConfirmed => {
    await expect(createConfirmedSurveyResponse(client, selection(), configuration)).rejects.toMatchObject({ name: "SurveyNotOpenError", status: "DRAFT" });
    await changeStatus(degreeB);
    await updateSurveyStatus(client, survey.id, "OPEN");
    expect(await client.degree.count({ where: { alumniId, programId: survey.referenceProgramId, status: "COMPLETED" } })).toBe(1);
    const unconfirmed = { ...selection(), referenceDegreeConfirmed: referenceDegreeConfirmed as boolean };
    const error = { name: "ReferenceDegreeConfirmationRequiredError", referenceDegreeId: degreeA.id };
    const before = await profileSnapshot();
    await expect(createConfirmedSurveyResponse(client, unconfirmed, configuration)).rejects.toMatchObject(error);
    expect(await profileSnapshot()).toEqual(before);
    const response = await createConfirmedSurveyResponse(client, selection(), configuration);
    const confirmed = await profileSnapshot();
    await expect(replaceConfirmedReferenceDegree(client, unconfirmed, configuration)).rejects.toMatchObject(error);
    expect(await profileSnapshot()).toEqual(confirmed);
    expect((await replaceConfirmedReferenceDegree(client, selection(), configuration)).id).toBe(response.id);
    expect(await client.surveyResponse.count({ where: { alumniId } })).toBe(1);
  });

  it("participates without contact and removes later optional contact without altering career or response records", async () => {
    await updateSurveyStatus(client, survey.id, "OPEN");
    await createConfirmedSurveyResponse(client, selection(), configuration);
    expect((await profileSnapshot()).AlumniContact).toEqual([]);
    await updateSurveyStatus(client, survey.id, "CLOSED");
    const contactless = await profileSnapshot();
    // Contact has no dedicated domain service. Exercise the existing Prisma
    // persistence boundary without bypassing any Survey or Degree validation.
    const contact = await client.alumniContact.create({ data: { alumniId, displayName: "Synthetic Lifecycle Contact", email: "optional@example.invalid" } });
    await client.alumniContact.delete({ where: { id: contact.id } });
    expect(await profileSnapshot()).toEqual(contactless);
    await deleteAlumniProfile(client, alumniId);
    await expectDeleted();
  });
});

describe("Replacement and mutation of the former reference Degree", () => {
  it("replacement locks Alumni first; a waiting update sees the released old reference and succeeds", async () => {
    await updateSurveyStatus(client, survey.id, "OPEN");
    const response = await createConfirmedSurveyResponse(client, selection(), configuration);
    const db = await observer.connect();
    let replacement: Promise<SurveyResponse> | undefined;
    let updating: Promise<Degree> | undefined;
    try {
      await db.query("BEGIN");
      await db.query('SELECT id FROM "SurveyResponse" WHERE id = $1 FOR UPDATE', [response.id]);
      const pid = (await db.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
      replacement = replaceConfirmedReferenceDegree(client, selection(degreeB), configuration);
      void replacement.catch(() => {});
      const replacingPid = await waitingPid(pid, "SurveyResponse", "UPDATE");
      updating = changeStatus();
      void updating.catch(() => {});
      await waitingPid(replacingPid, "Alumni", "FOR UPDATE");
      expect((await profileSnapshot()).SurveyResponse).toEqual([response]);
      await db.query("COMMIT");
      const replaced = await replacement;
      expect(replaced).toMatchObject({ id: response.id, referenceDegreeId: degreeB.id });
      expect(await updating).toMatchObject({ id: degreeA.id, status: "IN_PROGRESS" });
      expect((await profileSnapshot()).SurveyResponse).toEqual([replaced]);
      await updateSurveyStatus(client, survey.id, "CLOSED");
      await deleteAlumniProfile(client, alumniId);
      await expectDeleted();
    } finally { await db.query("ROLLBACK"); db.release(); await Promise.allSettled([replacement, updating]); }
  });

  it("an old-Degree update locks Alumni first and is rejected; replacement then commits safely", async () => {
    await updateSurveyStatus(client, survey.id, "OPEN");
    const response = await createConfirmedSurveyResponse(client, selection(), configuration);
    const db = await observer.connect();
    let replacement: Promise<SurveyResponse> | undefined;
    let updating: Promise<Degree> | undefined;
    try {
      await db.query("BEGIN");
      await db.query('SELECT id FROM "Degree" WHERE id = $1 FOR UPDATE', [degreeA.id]);
      const pid = (await db.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
      updating = changeStatus();
      const result = Promise.allSettled([updating]);
      const updatingPid = await waitingPid(pid, "Degree", "FOR UPDATE");
      replacement = replaceConfirmedReferenceDegree(client, selection(degreeB), configuration);
      void replacement.catch(() => {});
      await waitingPid(updatingPid, "Alumni", "FOR UPDATE");
      // Replacement already holds Survey; the updater must not acquire it.
      await expect(observer.query('SELECT id FROM "Survey" WHERE id = $1 FOR UPDATE NOWAIT', [survey.id])).rejects.toMatchObject({ code: "55P03" });
      await db.query("COMMIT");
      expect(await result).toMatchObject([{ status: "rejected", reason: { name: "ProtectedDegreeUpdateError", surveyResponseId: response.id } }]);
      const replaced = await replacement;
      expect(replaced).toMatchObject({ id: response.id, referenceDegreeId: degreeB.id });
      expect(await client.degree.findUniqueOrThrow({ where: { id: degreeA.id } })).toEqual(degreeA);
      expect((await profileSnapshot()).SurveyResponse).toEqual([replaced]);
      await updateSurveyStatus(client, survey.id, "CLOSED");
      await deleteAlumniProfile(client, alumniId);
      await expectDeleted();
    } finally { await db.query("ROLLBACK"); db.release(); await Promise.allSettled([replacement, updating]); }
  });
});
