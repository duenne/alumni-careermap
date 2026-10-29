import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, afterEach, beforeEach, expect, it } from "vitest";
import { PrismaClient } from "../../src/generated/prisma/client";
import { createSurvey, changeSurveyStatus, listSurveyAdministration, readSurveyInvitation } from "../../src/lib/surveys/service";
import type { SurveyResponseServiceConfiguration } from "../../src/lib/operator-scope";
import { createCatalogProgram } from "../../src/lib/surveys/catalog";

const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
let institutionId: string, otherId: string, programId: string, otherProgramId: string;
let config: SurveyResponseServiceConfiguration;
beforeEach(async () => {
  const institution = await client.institution.create({ data: { name: "Synthetic V3 Institute" } });
  const other = await client.institution.create({ data: { name: "Synthetic Other Institute" } });
  institutionId = institution.id; otherId = other.id;
  programId = (await client.program.create({ data: { institutionId, name: "Synthetic V3 Program", faculty: "Synthetic Faculty" } })).id;
  otherProgramId = (await client.program.create({ data: { institutionId: otherId, name: "Synthetic Other Program" } })).id;
  config = { operatorScope: { kind: "INSTITUTION", institutionId } };
});
afterEach(async () => {
  await client.survey.deleteMany({ where: { referenceProgram: { institutionId: { in: [institutionId, otherId] } } } });
  await client.program.deleteMany({ where: { institutionId: { in: [institutionId, otherId] } } });
  await client.institution.deleteMany({ where: { id: { in: [institutionId, otherId] } } });
});
afterAll(() => client.$disconnect());

it("adds a program with a faculty in the operator institution without changing existing references", async () => {
  const added = await createCatalogProgram(client, { institutionId: institutionId.toUpperCase(), name: " Synthetic New Program ", faculty: " Synthetic New Faculty " }, config);
  expect(added).toMatchObject({ institutionId, name: "Synthetic New Program", faculty: "Synthetic New Faculty" });
  expect((await listSurveyAdministration(client, config)).institutions[0].programs).toHaveLength(2);
  await expect(createCatalogProgram(client, { institutionId, name: added.name, faculty: added.faculty }, config)).rejects.toThrow();
  await expect(createCatalogProgram(client, { institutionId: otherId, name: "Foreign", faculty: null }, config)).rejects.toThrow();
  const facultyConfig = { operatorScope: { kind: "FACULTY", institutionId, faculty: "Synthetic Faculty" } } as const;
  await expect(createCatalogProgram(client, { institutionId, name: "Wrong Faculty", faculty: "Foreign" }, facultyConfig)).rejects.toThrow();
  await expect(createCatalogProgram(client, { institutionId, name: "", faculty: null }, config)).rejects.toThrow();
  await createCatalogProgram(client, { institutionId, name: "Faculty Program", faculty: "Synthetic Faculty" }, facultyConfig);
});

it("creates DRAFT, opens, closes and reopens without changing its reference or creating a response", async () => {
  const survey = await createSurvey(client, { name: "  Synthetic Cafe\u0301 Survey  ", referenceProgramId: programId }, config);
  expect(survey).toMatchObject({ name: "Synthetic Café Survey", status: "DRAFT", referenceProgramId: programId });
  expect(await readSurveyInvitation(client, survey.id, config)).toBeNull();
  for (const status of ["OPEN", "CLOSED", "OPEN"] as const) {
    expect(await changeSurveyStatus(client, { surveyId: survey.id, status }, config)).toMatchObject({ status, referenceProgramId: programId });
    const invitation = await readSurveyInvitation(client, survey.id, config);
    expect(invitation).toMatchObject({ id: survey.id, status, referenceProgram: { id: programId, name: "Synthetic V3 Program", faculty: "Synthetic Faculty", institution: { name: "Synthetic V3 Institute" } } });
    expect(Object.keys(invitation!).sort()).toEqual(["id", "name", "referenceProgram", "status"]);
  }
  expect(await client.surveyResponse.count({ where: { surveyId: survey.id } })).toBe(0);
});
it("rejects status/program injection, blank names and invalid IDs without inserting a survey", async () => {
  for (const input of [{ name: "  ", referenceProgramId: programId }, { name: "Synthetic", referenceProgramId: "invalid" }, { name: "Synthetic", referenceProgramId: programId, status: "OPEN" }]) {
    await expect(createSurvey(client, input, config)).rejects.toThrow();
  }
  expect(await client.survey.count({ where: { referenceProgramId: programId } })).toBe(0);
  const survey = await createSurvey(client, { name: "Synthetic", referenceProgramId: programId }, config);
  await expect(changeSurveyStatus(client, { surveyId: survey.id, status: "OPEN", referenceProgramId: otherProgramId }, config)).rejects.toThrow();
  expect(await client.survey.findUnique({ where: { id: survey.id } })).toMatchObject({ status: "DRAFT", referenceProgramId: programId });
});
it("filters the catalog and refuses foreign, missing or faculty-mismatched programs and surveys", async () => {
  await expect(createSurvey(client, { name: "Synthetic", referenceProgramId: otherProgramId }, config)).rejects.toThrow();
  await expect(createSurvey(client, { name: "Synthetic", referenceProgramId: randomUUID() }, config)).rejects.toThrow();
  const foreign = await client.survey.create({ data: { name: "Synthetic foreign", referenceProgramId: otherProgramId, status: "OPEN" } });
  await expect(changeSurveyStatus(client, { surveyId: foreign.id, status: "CLOSED" }, config)).rejects.toThrow();
  expect(await readSurveyInvitation(client, foreign.id, config)).toBeNull();
  expect(await readSurveyInvitation(client, randomUUID(), config)).toBeNull();
  const catalog = await listSurveyAdministration(client, config);
  expect(catalog.institutions.map(i => i.id)).toEqual([institutionId]);
  expect(catalog.institutions[0].programs.map(p => p.id)).toEqual([programId]);
  expect(catalog.surveys).toEqual([]);
  const facultyConfig = { operatorScope: { kind: "FACULTY", institutionId, faculty: "Synthetic Other Faculty" } } as const;
  await expect(createSurvey(client, { name: "Synthetic", referenceProgramId: programId }, facultyConfig)).rejects.toThrow();
  expect((await listSurveyAdministration(client, facultyConfig)).institutions[0].programs).toEqual([]);
  expect(await client.survey.count({ where: { referenceProgramId: programId } })).toBe(0);
});
