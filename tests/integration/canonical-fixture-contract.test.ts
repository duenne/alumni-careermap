import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "../../src/generated/prisma/client";
import { careerCases, catalogs } from "../../src/test-fixtures/canonical-careers/catalog";
import type { CareerCase, ExpectedProfile } from "../../src/test-fixtures/canonical-careers/contract";

const connectionString = process.env.DATABASE_URL;
const writer = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
// Separate client/pool: read committed records rather than INSERT return values.
const reader = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
type FixtureScope = {
  alumniId: string;
  surveyId: string;
  ids: Record<"alumni" | "institutions" | "programs" | "organisations" | "degrees" | "careerSteps", Map<string, string>>;
};
let scopes: FixtureScope[];

function idFor(ids: Map<string, string>, key: string): string {
  const id = ids.get(key);
  if (!id) throw new Error(`Missing fixture key: ${key}`);
  return id;
}
function nullableId(ids: Map<string, string>, key: string | null) {
  return key === null ? null : idFor(ids, key);
}
function keyFor(ids: Map<string, string>, id: string): string {
  for (const [key, mappedId] of ids) if (mappedId === id) return key;
  throw new Error(`Unexpected database ID in fixture projection: ${id}`);
}
function nullableKey(ids: Map<string, string>, id: string | null) {
  return id === null ? null : keyFor(ids, id);
}
function byKey<T extends { key: string }>(rows: T[]) {
  return [...rows].sort((a, b) => a.key.localeCompare(b.key));
}

// Test-only construction from the authored EXPECTED records; never from input.
async function insertExpectedProfile(expected: ExpectedProfile, referenceProgramKey: string): Promise<FixtureScope> {
  // Commit before using the independent reader. Any failed construction rolls
  // back all records, including catalogs, so no partial scope escapes cleanup.
  return writer.$transaction(async tx => {
    const ids: FixtureScope["ids"] = {
      alumni: new Map(), institutions: new Map(), programs: new Map(),
      organisations: new Map(), degrees: new Map(), careerSteps: new Map(),
    };
    for (const institution of catalogs.institutions) {
      const row = await tx.institution.create({ data: { name: institution.name } });
      ids.institutions.set(institution.key, row.id);
    }
    for (const program of catalogs.programs) {
      const row = await tx.program.create({ data: {
        name: program.name, institutionId: idFor(ids.institutions, program.institutionKey),
      } });
      ids.programs.set(program.key, row.id);
    }
    for (const organisation of catalogs.organisations) {
      const row = await tx.organisation.create({ data: { name: organisation.name } });
      ids.organisations.set(organisation.key, row.id);
    }
    const survey = await tx.survey.create({ data: {
      name: "Synthetic Fixture Contract Survey", referenceProgramId: idFor(ids.programs, referenceProgramKey),
    } });
    const alumni = await tx.alumni.create({ data: {} });
    ids.alumni.set(expected.alumni.key, alumni.id);
    for (const degree of expected.degrees) {
      const row = await tx.degree.create({ data: {
        alumniId: alumni.id, level: degree.level, status: degree.status, title: degree.title,
        programId: nullableId(ids.programs, degree.programKey), institutionId: nullableId(ids.institutions, degree.institutionKey),
        startYear: degree.startYear, endYear: degree.endYear, graduationYear: degree.graduationYear,
      } });
      ids.degrees.set(degree.key, row.id);
    }
    for (const step of expected.careerSteps) {
      const row = await tx.careerStep.create({ data: {
        alumniId: alumni.id, type: step.type, temporalStatus: step.temporalStatus, roleTitle: step.roleTitle,
        organisationId: nullableId(ids.organisations, step.organisationKey), startYear: step.startYear, endYear: step.endYear,
      } });
      ids.careerSteps.set(step.key, row.id);
    }
    for (const item of expected.timeline) {
      await tx.alumniTimelineItem.create({ data: {
        alumniId: alumni.id, type: item.type, position: item.position,
        degreeId: nullableId(ids.degrees, item.degreeKey), careerStepId: nullableId(ids.careerSteps, item.careerStepKey),
      } });
    }
    return { alumniId: alumni.id, surveyId: survey.id, ids };
  });
}

async function createFixture(fixture: CareerCase) {
  const scope = await insertExpectedProfile(fixture.expected, fixture.survey.referenceProgramKey);
  scopes.push(scope);
  return scope;
}

async function cleanup(scope: FixtureScope) {
  // Only IDs generated for this scope; never names, global deletes or TRUNCATE.
  await writer.$transaction(async tx => {
    await tx.surveyResponse.deleteMany({ where: { OR: [{ alumniId: scope.alumniId }, { surveyId: scope.surveyId }] } });
    await tx.alumni.deleteMany({ where: { id: scope.alumniId } });
    await tx.survey.deleteMany({ where: { id: scope.surveyId } });
    await tx.program.deleteMany({ where: { id: { in: [...scope.ids.programs.values()] } } });
    await tx.organisation.deleteMany({ where: { id: { in: [...scope.ids.organisations.values()] } } });
    await tx.institution.deleteMany({ where: { id: { in: [...scope.ids.institutions.values()] } } });
  });
}

beforeAll(async () => {
  const [{ version }] = await reader.$queryRaw<{ version: string }[]>`SELECT current_setting('server_version_num') AS version`;
  expect(Math.floor(Number(version) / 10000)).toBe(17);
});
beforeEach(() => { scopes = []; });
afterEach(async () => {
  // Attempt every scope's cleanup even if an earlier cleanup fails.
  const results = await Promise.allSettled(scopes.map(cleanup));
  const failures = results.filter(result => result.status === "rejected");
  if (failures.length) throw new AggregateError(failures.map(result => result.reason), "Fixture cleanup failed");
});
afterAll(async () => { await Promise.all([writer.$disconnect(), reader.$disconnect()]); });

async function assertRoundTrip(fixture: CareerCase, scope: FixtureScope) {
  const expected = fixture.expected;
  const { ids } = scope;
  const [profile, survey, institutions, programs, organisations] = await Promise.all([
    reader.alumni.findUniqueOrThrow({ where: { id: scope.alumniId }, include: {
      degrees: true, careerSteps: true,
      timelineItems: { orderBy: { position: "asc" }, include: { degree: true, careerStep: true } },
      responses: true, contact: true,
    } }),
    reader.survey.findUniqueOrThrow({ where: { id: scope.surveyId }, include: { responses: true } }),
    reader.institution.findMany({ where: { id: { in: [...ids.institutions.values()] } } }),
    reader.program.findMany({ where: { id: { in: [...ids.programs.values()] } } }),
    reader.organisation.findMany({ where: { id: { in: [...ids.organisations.values()] } } }),
  ]);

  expect({ key: keyFor(ids.alumni, profile.id) }).toEqual(expected.alumni);
  expect(byKey(institutions.map(row => ({ key: keyFor(ids.institutions, row.id), name: row.name })))).toEqual(byKey(catalogs.institutions));
  expect(byKey(programs.map(row => ({ key: keyFor(ids.programs, row.id), name: row.name, institutionKey: keyFor(ids.institutions, row.institutionId) })))).toEqual(byKey(catalogs.programs));
  expect(byKey(organisations.map(row => ({ key: keyFor(ids.organisations, row.id), name: row.name })))).toEqual(byKey(catalogs.organisations));
  // The two same-name Institutions survive as separate rows with separate IDs.
  const sameName = institutions.filter(row => row.name === catalogs.institutions[0].name);
  expect(sameName).toHaveLength(2);
  expect(new Set(sameName.map(row => row.id)).size).toBe(2);
  expect(survey.referenceProgramId).toBe(idFor(ids.programs, fixture.survey.referenceProgramKey));
  expect(survey.status).toBe("DRAFT"); // Candidate evaluation is not participation.

  const degrees = profile.degrees.map(row => ({
    key: keyFor(ids.degrees, row.id), level: row.level, status: row.status, title: row.title,
    programKey: nullableKey(ids.programs, row.programId), institutionKey: nullableKey(ids.institutions, row.institutionId),
    startYear: row.startYear, endYear: row.endYear, graduationYear: row.graduationYear,
  }));
  const careerSteps = profile.careerSteps.map(row => ({
    key: keyFor(ids.careerSteps, row.id), type: row.type, temporalStatus: row.temporalStatus, roleTitle: row.roleTitle,
    organisationKey: nullableKey(ids.organisations, row.organisationId), startYear: row.startYear, endYear: row.endYear,
  }));
  // Expected values come directly from the authored oracle, not inserted rows.
  expect(byKey(degrees)).toEqual(byKey(expected.degrees));
  expect(byKey(careerSteps)).toEqual(byKey(expected.careerSteps));
  for (const row of [...profile.degrees, ...profile.careerSteps, ...profile.timelineItems]) {
    expect(row.alumniId).toBe(profile.id);
  }
  for (const row of profile.degrees) expect(row.fieldOfStudy).toBeNull();
  for (const row of profile.careerSteps) {
    expect([row.roleCategory, row.functionArea, row.location]).toEqual([null, null, null]);
  }
  for (const item of profile.timelineItems) {
    if (item.type === "DEGREE") {
      expect(item.careerStepId).toBeNull();
      expect(item.degree?.alumniId).toBe(profile.id);
    } else {
      expect(item.degreeId).toBeNull();
      expect(item.careerStep?.alumniId).toBe(profile.id);
    }
  }
  expect(profile.timelineItems.map(row => ({
    type: row.type, position: row.position,
    degreeKey: nullableKey(ids.degrees, row.degreeId), careerStepKey: nullableKey(ids.careerSteps, row.careerStepId),
  }))).toEqual([...expected.timeline].sort((a, b) => a.position - b.position));

  const candidates = await reader.degree.findMany({ where: {
    alumniId: profile.id, programId: survey.referenceProgramId, status: "COMPLETED",
  }, select: { id: true } });
  expect(candidates.map(row => keyFor(ids.degrees, row.id)).sort()).toEqual([...expected.reference.candidateDegreeKeys].sort());
  expect(profile.responses).toEqual([]);
  expect(survey.responses).toEqual([]);
  expect(profile.contact).toBeNull();
  for (const row of [profile, survey, ...institutions, ...programs, ...organisations,
    ...profile.degrees, ...profile.careerSteps, ...profile.timelineItems]) {
    expect(row.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(row.createdAt).toBeInstanceOf(Date);
    expect(row.updatedAt).toBeInstanceOf(Date);
  }
}

describe("D.3 canonical fixture PostgreSQL round trips", () => {
  it.each(careerCases)("$caseId: $scenario", async fixture => {
    const scope = await createFixture(fixture);
    await assertRoundTrip(fixture, scope);
  });

  it("cleans only one fixture scope, cascades its stations, and preserves an independent same-name copy", async () => {
    const fixture = careerCases[1];
    const first = await createFixture(fixture);
    const second = await createFixture(fixture);
    await cleanup(first);
    const counts = await Promise.all([
      reader.alumni.count({ where: { id: first.alumniId } }),
      reader.degree.count({ where: { id: { in: [...first.ids.degrees.values()] } } }),
      reader.careerStep.count({ where: { id: { in: [...first.ids.careerSteps.values()] } } }),
      reader.alumniTimelineItem.count({ where: { alumniId: first.alumniId } }),
      reader.survey.count({ where: { id: first.surveyId } }),
      reader.program.count({ where: { id: { in: [...first.ids.programs.values()] } } }),
      reader.organisation.count({ where: { id: { in: [...first.ids.organisations.values()] } } }),
      reader.institution.count({ where: { id: { in: [...first.ids.institutions.values()] } } }),
    ]);
    expect(counts).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    await assertRoundTrip(fixture, second);
  });
});
