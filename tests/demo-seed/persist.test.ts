import { readFile } from "node:fs/promises";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "../../src/generated/prisma/client";
import { minimalCorpus } from "../../src/lib/analytics/test-corpus";
import { persistV5DemoSeed } from "../../src/lib/demo-seed/persist";
import { createConfirmedSurveyResponse } from "../../src/lib/survey-response-service";

const faults = vi.hoisted(() => ({ response: "", afterClose: false, corruptAfterClose: false, responseCalls: 0, closedCalls: 0 }));
vi.mock("../../src/lib/survey-response-service", async importOriginal => {
  const actual = await importOriginal<typeof import("../../src/lib/survey-response-service")>();
  return { ...actual, createConfirmedResponseInTransaction: vi.fn(async (...args: Parameters<typeof actual.createConfirmedResponseInTransaction>) => {
    const [tx, survey, input] = args;
    faults.responseCalls++;
    expect((await tx.survey.findUniqueOrThrow({ where: { id: survey.id } })).status).toBe("OPEN");
    if (faults.response === "not-completed") await tx.degree.update({ where: { id: input.referenceDegreeId }, data: { status: "UNKNOWN", endYear: null } });
    if (faults.response === "wrong-program") await tx.degree.update({ where: { id: input.referenceDegreeId }, data: { programId: null } });
    if (faults.response === "foreign-owner") {
      const foreign = await tx.alumni.create({ data: {} });
      input.alumniId = foreign.id;
    }
    const result = await actual.createConfirmedResponseInTransaction(...args);
    if (faults.response === "duplicate") await actual.createConfirmedResponseInTransaction(...args);
    if (faults.response === "after-response" || faults.response === "after-last-response" && faults.responseCalls === 100) throw new Error("SYNTHETIC_INJECTED_FAILURE");
    return result;
  }) };
});
vi.mock("../../src/lib/survey-service", async importOriginal => {
  const actual = await importOriginal<typeof import("../../src/lib/survey-service")>();
  return { ...actual, updateSurveyStatusInTransaction: vi.fn(async (...args: Parameters<typeof actual.updateSurveyStatusInTransaction>) => {
    const result = await actual.updateSurveyStatusInTransaction(...args);
    if (args[2] === "CLOSED") {
      faults.closedCalls++;
      if (faults.afterClose) throw new Error("SYNTHETIC_FAILURE_AFTER_CLOSE");
      if (faults.corruptAfterClose) {
        const step = await args[0].careerStep.findFirstOrThrow();
        await args[0].careerStep.update({ where: { id: step.id }, data: { roleTitle: "SYNTHETIC_INJECTED_CORRUPTION" } });
      }
    }
    return result;
  }) };
});

const databaseUrl = process.env.CAREERMAP_V5_DEMO_TEST_URL;
// Guard before connecting; this suite must never inherit a developer DB URL.
if (!databaseUrl || !/^postgresql:\/\/careermap_v5_demo:[^@]+@127\.0\.0\.1:\d+\/careermap_v5_demo_test$/.test(databaseUrl)) {
  throw new Error("Run only through scripts/test-demo-seed.mjs");
}
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
let institutionId: string, programId: string;
const programIds: string[] = [];
const rootInstitutions: string[] = [];

beforeEach(async () => {
  faults.response = ""; faults.afterClose = false; faults.corruptAfterClose = false; faults.responseCalls = 0; faults.closedCalls = 0;
  const institution = await db.institution.create({ data: { name: "SYNTHETISCH / DEMO – Testhochschule" } });
  institutionId = institution.id; rootInstitutions.push(institutionId);
  const program = await db.program.create({ data: { institutionId, name: "Management Sozialer Innovationen", faculty: "Synthetic faculty" } });
  programId = program.id; programIds.push(programId);
});
afterEach(async () => {
  // Selective cleanup of this suite's own fixture graph; no resets/truncation.
  const alumni = await db.alumni.findMany({ where: { degrees: { some: { programId: { in: programIds } } } }, select: {
    id: true, degrees: { select: { institutionId: true } }, careerSteps: { select: { organisationId: true } },
  } });
  const alumniIds = alumni.map(a => a.id);
  const institutions = alumni.flatMap(a => a.degrees.flatMap(d => d.institutionId ? [d.institutionId] : []));
  const organisations = alumni.flatMap(a => a.careerSteps.flatMap(s => s.organisationId ? [s.organisationId] : []));
  await db.surveyResponse.deleteMany({ where: { OR: [{ alumniId: { in: alumniIds } }, { survey: { referenceProgramId: { in: programIds } } }] } });
  await db.alumni.deleteMany({ where: { id: { in: alumniIds } } });
  await db.survey.deleteMany({ where: { referenceProgramId: { in: programIds } } });
  await db.program.deleteMany({ where: { id: { in: programIds } } });
  await db.organisation.deleteMany({ where: { id: { in: organisations } } });
  await db.institution.deleteMany({ where: { id: { in: [...rootInstitutions, ...institutions] } } });
  programIds.length = 0; rootInstitutions.length = 0;
});
afterAll(() => db.$disconnect());

function configuration() {
  return { databaseUrl: databaseUrl!, pilotProgramId: programId,
    operatorScope: { kind: "FACULTY" as const, institutionId, faculty: "Synthetic faculty" },
    purpose: "SYNTHETIC_DEMO_ONLY" as const, catalogPolicy: "SEPARATE_LABELS_NO_CATEGORIES" as const };
}
function fixture() {
  const corpus = minimalCorpus();
  return { policy: "v5-demo-mini-v1", sourceText: JSON.stringify(corpus.sources), expectedText: JSON.stringify(corpus.expected), referenceProgramId: programId,
    selections: corpus.expected.map(p => ({ syntheticId: p.syntheticId, stationId: p.msiAnchor.stationId, programId, confirmation: "SYNTHETIC_TEST_ONLY" })) };
}
async function corpusFixture() {
  const [sourceText, expectedText] = await Promise.all([readFile(".local-fixtures/phase-d/all_linkedin_snapshots.json", "utf8"), readFile(".local-fixtures/phase-d/all_expected_normalized.json", "utf8")]);
  const expected = JSON.parse(expectedText) as { syntheticId: string; msiAnchor: { stationId: string } }[];
  // Additional explicit synthetic test declarations, not alumni confirmation.
  return { policy: "v5-demo-phase-d-100-v1", sourceText, expectedText, referenceProgramId: programId,
    selections: expected.map(p => ({ syntheticId: p.syntheticId, stationId: p.msiAnchor.stationId, programId, confirmation: "SYNTHETIC_TEST_ONLY" })) };
}
async function snapshot() {
  const orderBy = { id: "asc" as const };
  return { institutions: await db.institution.findMany({ orderBy }), programs: await db.program.findMany({ orderBy }), surveys: await db.survey.findMany({ orderBy }),
    organisations: await db.organisation.findMany({ orderBy }), alumni: await db.alumni.findMany({ orderBy }), degrees: await db.degree.findMany({ orderBy }), steps: await db.careerStep.findMany({ orderBy }),
    timeline: await db.alumniTimelineItem.findMany({ orderBy }), responses: await db.surveyResponse.findMany({ orderBy }), contacts: await db.alumniContact.findMany({ orderBy }),
  };
}

describe("D1.2 atomic synthetic demo seed", () => {
  it("creates a CLOSED demo, exact stations, references and separate catalogs without contacts", async () => {
    const result = await persistV5DemoSeed(fixture(), configuration());
    expect(result).toMatchObject({ outcome: "CREATED", status: "CLOSED", syntheticOnly: true });
    const stored = await snapshot();
    expect(stored.surveys).toHaveLength(1);
    expect(stored.surveys[0]).toMatchObject({ id: result.surveyId, status: "CLOSED", referenceProgramId: programId, name: "SYNTHETISCH / DEMO – Alumni MSI" });
    expect([stored.alumni.length, stored.degrees.length, stored.steps.length, stored.timeline.length, stored.responses.length]).toEqual([1, 1, 3, 4, 1]);
    expect(stored.steps.map(s => s.type).sort()).toEqual(["EDUCATION", "EMPLOYMENT", "VOCATIONAL_TRAINING"]);
    expect(stored.steps.find(s => s.type === "EMPLOYMENT")?.location).toBe("Synthetic town");
    expect(stored.contacts).toEqual([]);
    expect(stored.institutions).toHaveLength(1); // Reference reuses existing MSI Program.
    expect(await db.organisation.count()).toBe(3); // Same labels are not merged.
    expect(stored.responses[0]).toMatchObject({ alumniId: stored.alumni[0].id, referenceDegreeId: stored.degrees[0].id, surveyId: result.surveyId });
    expect(stored.responses[0].confirmedAt).toBeInstanceOf(Date);
    expect(faults.responseCalls).toBe(1);
    expect(JSON.stringify(stored)).not.toMatch(/PRIVATE_|access_token|SYNTHETIC_TEST_ONLY/);
  });
  it("does not change even timestamps on an identical retry through a fresh database connection", async () => {
    const first = await persistV5DemoSeed(fixture(), configuration());
    const before = await snapshot();
    const second = await persistV5DemoSeed(fixture(), configuration());
    expect(second).toMatchObject({ outcome: "UNCHANGED", surveyId: first.surveyId });
    expect(await snapshot()).toEqual(before);
    expect(faults.responseCalls).toBe(1);
  });
  it("serializes two concurrent seeds, creates only once and keeps identical references", async () => {
    const results = await Promise.all([persistV5DemoSeed(fixture(), configuration()), persistV5DemoSeed(fixture(), configuration())]);
    expect(results.map(r => r.outcome).sort()).toEqual(["CREATED", "UNCHANGED"]);
    expect(results[0].surveyId).toBe(results[1].surveyId);
    expect(await db.surveyResponse.count()).toBe(1);
  });
  it.each(["after-response", "duplicate", "foreign-owner", "not-completed", "wrong-program"])("rolls back all records and catalogs on %s failure", async fault => {
    const before = await snapshot(); faults.response = fault;
    const operation = persistV5DemoSeed(fixture(), configuration());
    if (fault === "after-response") await expect(operation).rejects.toThrow("DEMO_TRANSACTION_FAILED");
    else if (fault === "duplicate") await expect(operation).rejects.toMatchObject({ name: "SurveyResponseAlreadyExistsError" });
    else await expect(operation).rejects.toMatchObject({ name: "InvalidReferenceDegreeError", reason:
      fault === "foreign-owner" ? "NOT_OWNED" : fault === "not-completed" ? "NOT_COMPLETED" : "PROGRAM_MISMATCH" });
    expect(faults.responseCalls).toBe(1);
    expect(await snapshot()).toEqual(before);
    expect(await db.organisation.count()).toBe(0);
  });
  it("rolls back even after the final CLOSED transition has executed", async () => {
    const before = await snapshot(); faults.afterClose = true;
    await expect(persistV5DemoSeed(fixture(), configuration())).rejects.toThrow("DEMO_TRANSACTION_FAILED");
    expect(faults.closedCalls).toBe(1);
    expect(await snapshot()).toEqual(before);
    expect(await db.organisation.count()).toBe(0);
  });
  it("detects a write/readback discrepancy after closing and rolls back instead of reporting success", async () => {
    const before = await snapshot(); faults.corruptAfterClose = true;
    await expect(persistV5DemoSeed(fixture(), configuration())).rejects.toThrow("DEMO_DATASET_MISMATCH");
    expect(faults.closedCalls).toBe(1);
    expect(await snapshot()).toEqual(before);
  });
  it("rejects an incomplete, unconfirmed or unapproved input before writing anything", async () => {
    const before = await snapshot();
    await expect(persistV5DemoSeed({ ...fixture(), selections: [] }, configuration())).rejects.toThrow("INVALID_DEMO_PLAN");
    await expect(persistV5DemoSeed({ ...fixture(), sourceText: "[]" }, configuration())).rejects.toThrow("CHECKSUM_MISMATCH");
    expect(await snapshot()).toEqual(before);
  });
  it.each(["purpose", "catalogPolicy", "program", "faculty", "institution"])("rejects incorrect %s configuration without changing records", async field => {
    const before = await snapshot(), config = configuration();
    if (field === "purpose") Object.assign(config, { purpose: "LIVE" });
    if (field === "catalogPolicy") Object.assign(config, { catalogPolicy: "MERGE_BY_NAME" });
    if (field === "program") config.pilotProgramId = "99999999-9999-4999-8999-999999999999";
    if (field === "faculty") config.operatorScope.faculty = "Other faculty";
    if (field === "institution") config.operatorScope.institutionId = "99999999-9999-4999-8999-999999999999";
    await expect(persistV5DemoSeed(fixture(), config)).rejects.toBeDefined();
    expect(await snapshot()).toEqual(before);
  });
  it("rejects a non-MSI Program even when caller and fixture use the same UUID", async () => {
    await db.program.update({ where: { id: programId }, data: { name: "Master Informatik" } });
    const before = await snapshot();
    await expect(persistV5DemoSeed(fixture(), configuration())).rejects.toThrow("PILOT_PROGRAM_MISMATCH");
    expect(await snapshot()).toEqual(before);
  });
  it("rejects a missing Program cleanly", async () => {
    const input = fixture(), config = configuration(), absent = "99999999-9999-4999-8999-999999999999";
    input.referenceProgramId = absent; input.selections[0].programId = absent; config.pilotProgramId = absent;
    const before = await snapshot();
    await expect(persistV5DemoSeed(input, config)).rejects.toThrow("PILOT_PROGRAM_NOT_FOUND");
    expect(await snapshot()).toEqual(before);
  });
  it.each(["station", "catalog", "response", "status"])("rejects a changed %s on retry and preserves the changed state", async change => {
    const result = await persistV5DemoSeed(fixture(), configuration());
    if (change === "station") { const step = await db.careerStep.findFirstOrThrow(); await db.careerStep.update({ where: { id: step.id }, data: { roleTitle: "Synthetic edited title" } }); }
    if (change === "catalog") { const org = await db.organisation.findFirstOrThrow(); await db.organisation.update({ where: { id: org.id }, data: { sector: "Synthetic edited sector" } }); }
    if (change === "response") await db.surveyResponse.deleteMany({ where: { surveyId: result.surveyId } });
    if (change === "status") await db.survey.update({ where: { id: result.surveyId }, data: { status: "OPEN" } });
    const before = await snapshot();
    await expect(persistV5DemoSeed(fixture(), configuration())).rejects.toThrow("DEMO_DATASET_MISMATCH");
    expect(await snapshot()).toEqual(before);
  });
  it("rejects two surveys using the reserved demo identity", async () => {
    await persistV5DemoSeed(fixture(), configuration());
    await db.survey.create({ data: { name: "SYNTHETISCH / DEMO – Alumni MSI", referenceProgramId: programId } });
    const before = await snapshot();
    await expect(persistV5DemoSeed(fixture(), configuration())).rejects.toThrow("AMBIGUOUS_DEMO_SURVEY");
    expect(await snapshot()).toEqual(before);
  });
  it("preserves another survey and rejects writes to the CLOSED demo through the domain service", async () => {
    const other = await db.survey.create({ data: { name: "SYNTHETISCH / DEMO – Independent survey", referenceProgramId: programId } });
    const result = await persistV5DemoSeed(fixture(), configuration());
    expect(await db.survey.findUnique({ where: { id: other.id } })).toEqual(other);
    expect(await db.surveyResponse.count({ where: { surveyId: other.id } })).toBe(0);
    const response = await db.surveyResponse.findFirstOrThrow({ where: { surveyId: result.surveyId } });
    const before = await snapshot();
    await expect(createConfirmedSurveyResponse(db, { surveyId: result.surveyId, alumniId: response.alumniId,
      referenceDegreeId: response.referenceDegreeId, referenceDegreeConfirmed: true }, configuration())).rejects.toMatchObject({ name: "SurveyNotOpenError" });
    expect(await snapshot()).toEqual(before);
  });
  it("keeps an independent Master survey, its full profile and existing response unchanged", async () => {
    const master = await db.program.create({ data: { institutionId, name: "Master Informatik", faculty: "Synthetic faculty" } });
    programIds.push(master.id);
    const survey = await db.survey.create({ data: { referenceProgramId: master.id, name: "SYNTHETISCH / DEMO – Master", status: "OPEN" } });
    const alumni = await db.alumni.create({ data: {} });
    const degree = await db.degree.create({ data: { alumniId: alumni.id, programId: master.id, level: "MASTER", status: "COMPLETED" } });
    const timeline = await db.alumniTimelineItem.create({ data: { alumniId: alumni.id, type: "DEGREE", degreeId: degree.id, position: 1 } });
    const response = await createConfirmedSurveyResponse(db, { surveyId: survey.id, alumniId: alumni.id, referenceDegreeId: degree.id, referenceDegreeConfirmed: true }, configuration());
    await persistV5DemoSeed(fixture(), configuration());
    expect(await db.survey.findUnique({ where: { id: survey.id } })).toEqual(survey);
    expect(await db.alumni.findUnique({ where: { id: alumni.id } })).toEqual(alumni);
    expect(await db.degree.findUnique({ where: { id: degree.id } })).toEqual(degree);
    expect(await db.alumniTimelineItem.findUnique({ where: { id: timeline.id } })).toEqual(timeline);
    expect(await db.surveyResponse.findUnique({ where: { id: response.id } })).toEqual(response);
    expect(await db.surveyResponse.count({ where: { surveyId: survey.id } })).toBe(1);
    expect(await persistV5DemoSeed(fixture(), configuration())).toMatchObject({ outcome: "UNCHANGED" });
  });
  it.skipIf(process.env.CAREERMAP_PHASE_D_FIXTURES !== "1")("persists and verifies the complete 100-profile / 432-station corpus and retries unchanged", async () => {
    const input = await corpusFixture();
    const first = await persistV5DemoSeed(input, configuration());
    const stored = await snapshot();
    expect(first).toMatchObject({ status: "CLOSED", report: { plannedProfiles: 100, plannedStations: 432, referenceDegrees: 100, responses: 100 } });
    expect([stored.alumni.length, stored.degrees.length, stored.steps.length, stored.timeline.length, stored.responses.length]).toEqual([100, 172, 260, 432, 100]);
    expect(stored.steps.filter(s => s.type === "VOCATIONAL_TRAINING")).toHaveLength(13);
    expect(stored.steps.filter(s => s.type === "EDUCATION")).toHaveLength(10);
    for (const response of stored.responses) {
      const degree = stored.degrees.find(d => d.id === response.referenceDegreeId)!;
      expect(degree).toMatchObject({ alumniId: response.alumniId, programId, status: "COMPLETED", graduationYear: null });
    }
    expect(await persistV5DemoSeed(input, configuration())).toMatchObject({ outcome: "UNCHANGED", surveyId: first.surveyId });
    expect(await snapshot()).toEqual(stored);
  });
  it.skipIf(process.env.CAREERMAP_PHASE_D_FIXTURES !== "1")("rolls back all 100 profiles and 432 stations after the last response fails", async () => {
    const input = await corpusFixture(), before = await snapshot(); faults.response = "after-last-response";
    await expect(persistV5DemoSeed(input, configuration())).rejects.toThrow("DEMO_TRANSACTION_FAILED");
    expect(faults.responseCalls).toBe(100);
    expect(await snapshot()).toEqual(before);
  });
});
