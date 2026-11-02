import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { PrismaClient } from "../../generated/prisma/client";
import { localDemoEnvironment } from "../../../tests/support/local-demo";
import { assertLocalDemoDatabase } from "../local-demo/connection-identity";
import { readSurveyAnalytics } from "./analytics";
import { aggregateOverview } from "../analytics/overview";
import { aggregateCareers } from "../analytics/aggregate";

vi.mock("../local-demo/connection-identity", () => ({ assertLocalDemoDatabase: vi.fn() }));
vi.mock("../survey-response-service", () => ({ validateSurveyAffiliation: vi.fn() }));
const env = localDemoEnvironment();
const surveyId = "44444444-4444-4444-8444-444444444444";
const configuration = { operatorScope: { kind: "INSTITUTION", institutionId: env.CAREERMAP_LOCAL_DEMO_OPERATOR_ID! } } as const;
beforeEach(() => {
  for (const key of Object.keys(process.env)) if (key.startsWith("CAREERMAP_") || key.startsWith("LINKEDIN_") || key === "DATABASE_URL") vi.stubEnv(key, undefined);
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  vi.stubEnv("CAREERMAP_LOCAL_DEMO_SYNTHETIC_SURVEY_ID", surveyId);
  vi.mocked(assertLocalDemoDatabase).mockReset().mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllEnvs());
function database() {
  const survey = { id: surveyId, name: "A name is not a provenance check", status: "CLOSED", referenceProgramId: env.CAREERMAP_LOCAL_DEMO_MSI_PROGRAM_ID!, referenceProgram: { name: "Management Sozialer Innovationen" } };
  const degree = { id: "degree", level: "BACHELOR", status: "COMPLETED", title: "Synthetic MSI degree", fieldOfStudy: "Gesellschaft & Politik", startYear: 2015, endYear: 2018, graduationYear: 2018,
    program: { name: "Management Sozialer Innovationen", institution: { id: configuration.operatorScope.institutionId, name: "Synthetic institution" } }, institution: null };
  const careerStep = { id: "work", type: "EMPLOYMENT", temporalStatus: "ONGOING", roleTitle: "Synthetic project lead", functionArea: null, roleCategory: "Führung", startYear: 2019, endYear: null,
    location: "Synthetic town", organisation: { name: "Synthetic organisation", sector: "Dritter Sektor" } };
  const row = { id: "response", alumniId: "alumni", referenceDegreeId: degree.id, referenceDegree: { alumniId: "alumni", programId: survey.referenceProgramId, status: "COMPLETED", level: "BACHELOR" },
    alumni: { _count: { degrees: 1, careerSteps: 1 }, timelineItems: [{ position: 2, degree, careerStep: null }, { position: 7, degree: null, careerStep }], contact: { displayName: "DO_NOT_EXPOSE", email: "private@example.invalid" } }, access_token: "DO_NOT_EXPOSE_TOKEN" };
  const tx = { survey: { findUnique: vi.fn(async () => survey) }, surveyResponse: { findMany: vi.fn(async () => [row]) },
    alumniTimelineItem: { findMany: vi.fn(async () => [{ degree, careerStep: null }, { degree: null, careerStep }]) } };
  const client = { $transaction: vi.fn(async (work: (value: typeof tx) => unknown) => work(tx)) } as unknown as PrismaClient;
  return { client, tx, survey, degree, careerStep };
}
const read = (db: ReturnType<typeof database>) => readSurveyAnalytics(db.client, db.survey.id, configuration, env.CAREERMAP_LOCAL_DEMO_MSI_PROGRAM_ID);
function expectRedacted(result: Awaited<ReturnType<typeof readSurveyAnalytics>>, db: ReturnType<typeof database>) {
  expect(result.profiles[0].stations.every(s => s.title === null && s.provider === null && s.location === null)).toBe(true);
  const query = JSON.stringify(db.tx.surveyResponse.findMany.mock.calls);
  expect(query).not.toMatch(/"(?:title|roleTitle|location|name)":true/);
  expect(db.tx.alumniTimelineItem.findMany).not.toHaveBeenCalled();
  expect(JSON.stringify(result)).not.toMatch(/Synthetic project lead|Synthetic organisation|Synthetic town|DO_NOT_EXPOSE|private@example/);
}
it.each(["v5-synthetic", "v5-participation"])("projects canonical details only for the recorded closed synthetic MSI survey in %s", async mode => {
  if (mode === "v5-participation") {
    vi.stubEnv("CAREERMAP_LOCAL_DEMO", mode); vi.stubEnv("CAREERMAP_LOCAL_DEMO_PURPOSE", "LOCAL_PARTICIPATION");
    vi.stubEnv("CAREERMAP_LOCAL_PARTICIPATION_SURVEY_ID", "55555555-5555-4555-8555-555555555555");
  }
  const db = database(), result = await read(db);
  expect(result.profiles[0].stations.map(s => ({ position: s.position, title: s.title, provider: s.provider, location: s.location }))).toEqual([
    { position: 2, title: db.degree.title, provider: "Management Sozialer Innovationen · Synthetic institution", location: null },
    { position: 7, title: db.careerStep.roleTitle, provider: db.careerStep.organisation.name, location: db.careerStep.location },
  ]);
  expect(result.profiles[0].stations.map(s => [s.startYear, s.endYear, s.status])).toEqual([[2015, 2018, "COMPLETED"], [2019, null, "ONGOING"]]);
  expect(db.tx.surveyResponse.findMany.mock.calls[0]).toMatchObject([{ select: { alumni: { select: { timelineItems: { orderBy: { position: "asc" } } } } } }]);
  expect(assertLocalDemoDatabase).toHaveBeenCalledWith(db.client, expect.objectContaining({ syntheticSurveyId: surveyId }));
  expect(db.tx.alumniTimelineItem.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { alumniId: { in: ["alumni"] } } }));
  expect(JSON.stringify(result)).not.toMatch(/contact|email|displayName|access_token|DO_NOT_EXPOSE/);
});
it("keeps absent details null and uses only an existing program/institution when a degree title is absent", async () => {
  const db = database();
  Object.assign(db.degree, { title: null, program: null, institution: { name: "Synthetic external university" } });
  Object.assign(db.careerStep, { roleTitle: null, organisation: null, location: null });
  const result = await read(db);
  expect(result.profiles[0].stations[0]).toMatchObject({ title: null, provider: "Synthetic external university", location: null });
  expect(result.profiles[0].stations[1]).toMatchObject({ title: null, provider: null, location: null, sector: null });
});
it("can display an existing program name without inventing a missing degree title", async () => {
  const db = database(); Object.assign(db.degree, { title: null });
  const result = await read(db);
  expect(result.profiles[0].stations[0]).toMatchObject({ title: db.degree.program.name, graduationYear: 2018 });
});
it("preserves the existing presentation alias only for the exact known demo institution", async () => {
  const db = database();
  db.degree.program.institution = { id: "c9875615-69f3-42d5-96fb-7e920ebadce8", name: "SYNTHETISCH / DEMO – V5 04fb49b1-4e3b-4fb0-807f-66837beae2f5" };
  expect((await read(db)).profiles[0].stations[0].provider).toBe("Management Sozialer Innovationen · Hochschule München");
  db.degree.program.institution.id = "66666666-6666-4666-8666-666666666666";
  expect((await read(db)).profiles[0].stations[0].provider).toBe(`Management Sozialer Innovationen · ${db.degree.program.institution.name}`);
});
it.each(["regular", "missing-id", "invalid-config", "different-survey", "open-survey", "wrong-pilot", "wrong-operator", "wrong-database", "participation-survey"])("keeps details redacted for %s", async reason => {
  const db = database();
  if (reason === "regular") { vi.stubEnv("CAREERMAP_LOCAL_DEMO", undefined); db.survey.name = "SYNTHETISCH / DEMO – V5 MSI"; }
  if (reason === "missing-id") vi.stubEnv("CAREERMAP_LOCAL_DEMO_SYNTHETIC_SURVEY_ID", undefined);
  if (reason === "invalid-config") vi.stubEnv("CAREERMAP_LOCAL_DEMO_ORIGIN", "https://example.invalid");
  if (reason === "different-survey") db.survey.id = "55555555-5555-4555-8555-555555555555";
  if (reason === "open-survey") db.survey.status = "OPEN";
  if (reason === "wrong-pilot") vi.stubEnv("CAREERMAP_LOCAL_DEMO_MSI_PROGRAM_ID", "66666666-6666-4666-8666-666666666666");
  if (reason === "wrong-operator") vi.stubEnv("CAREERMAP_LOCAL_DEMO_OPERATOR_ID", "66666666-6666-4666-8666-666666666666");
  if (reason === "wrong-database") vi.mocked(assertLocalDemoDatabase).mockRejectedValue(new Error("FOREIGN_DATABASE"));
  if (reason === "participation-survey") {
    vi.stubEnv("CAREERMAP_LOCAL_DEMO", "v5-participation"); vi.stubEnv("CAREERMAP_LOCAL_DEMO_PURPOSE", "LOCAL_PARTICIPATION");
    vi.stubEnv("CAREERMAP_LOCAL_PARTICIPATION_SURVEY_ID", surveyId);
  }
  expectRedacted(await read(db), db);
});
it("does not change either aggregation when descriptive details are added", async () => {
  const db = database(), detailed = await read(db);
  vi.stubEnv("CAREERMAP_LOCAL_DEMO_SYNTHETIC_SURVEY_ID", undefined);
  const redacted = await read(db);
  expect(aggregateOverview(detailed.profiles)).toEqual(aggregateOverview(redacted.profiles));
  expect(aggregateCareers(detailed.profiles)).toEqual(aggregateCareers(redacted.profiles));
});
