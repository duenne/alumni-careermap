import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import { afterAll, afterEach, beforeEach, expect, it, vi } from "vitest";
import { localDemoEnvironment } from "../support/local-demo";
import { localDemoInstitutionName, readLocalDemoConfiguration } from "../../src/lib/local-demo/config";
import { assertLocalDemoDatabase, localDemoClient } from "../../src/lib/local-demo/database";
import { createSurvey, listSurveyAdministration } from "../../src/lib/surveys/service";
import { createCatalogProgram } from "../../src/lib/surveys/catalog";
vi.mock("server-only", () => ({}));

const adminUrl = process.env.LOCAL_DEMO_TEST_ADMIN_URL, databaseUrl = process.env.LOCAL_DEMO_TEST_DATABASE_URL;
if (!adminUrl || !databaseUrl || !/^postgresql:\/\/careermap_v5_mode_test_admin:[a-f0-9]+@127\.0\.0\.1:\d+\/careermap_v5_demo$/.test(adminUrl)
  || !/^postgresql:\/\/careermap_v5_demo:[a-f0-9]+@127\.0\.0\.1:\d+\/careermap_v5_demo$/.test(databaseUrl)) throw new Error("Run only scripts/test-local-demo.mjs");
const admin = new PrismaClient({ adapter: new PrismaPg({ connectionString: adminUrl }) });
const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
let configuration: ReturnType<typeof readLocalDemoConfiguration>;
let factoryClient: PrismaClient | undefined;
beforeEach(async () => {
  const env = { ...localDemoEnvironment(), CAREERMAP_LOCAL_DEMO_DATABASE_URL: databaseUrl, CAREERMAP_LOCAL_DEMO_INSTALLATION_ID: randomUUID(),
    CAREERMAP_LOCAL_DEMO_OPERATOR_ID: randomUUID(), CAREERMAP_LOCAL_DEMO_MSI_PROGRAM_ID: randomUUID() };
  configuration = readLocalDemoConfiguration(env);
  vi.stubEnv("DATABASE_URL", undefined);
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  await admin.institution.create({ data: { id: configuration.operatorScope.institutionId, name: localDemoInstitutionName(configuration.installationId) } });
  await admin.program.create({ data: { id: configuration.pilotProgramId, institutionId: configuration.operatorScope.institutionId, name: "Management Sozialer Innovationen" } });
});
afterEach(async () => {
  await admin.survey.deleteMany({ where: { referenceProgram: { institutionId: configuration.operatorScope.institutionId } } });
  await admin.program.deleteMany({ where: { institutionId: configuration.operatorScope.institutionId } });
  await admin.institution.delete({ where: { id: configuration.operatorScope.institutionId } });
  vi.unstubAllEnvs();
});
afterAll(async () => { await factoryClient?.$disconnect(); await client.$disconnect(); await admin.$disconnect(); });
it("verifies the real restricted PG17 connection and creates independent Master DRAFT data through existing services", async () => {
  await assertLocalDemoDatabase(client, configuration);
  factoryClient = await localDemoClient();
  const master = await createCatalogProgram(factoryClient, { institutionId: configuration.operatorScope.institutionId, name: "Master Informatik", faculty: null }, configuration);
  const survey = await createSurvey(factoryClient, { name: "SYNTHETISCH / DEMO – Master", referenceProgramId: master.id }, configuration);
  expect(survey.status).toBe("DRAFT"); expect(survey.referenceProgramId).not.toBe(configuration.pilotProgramId);
  expect(await client.surveyResponse.count({ where: { surveyId: survey.id } })).toBe(0);
  expect((await listSurveyAdministration(factoryClient, configuration)).surveys.find(s => s.id === survey.id)?._count.responses).toBe(0);
});
it("rejects a real administrative connection instead of treating any PG17 server as the demo", async () => {
  await expect(assertLocalDemoDatabase(admin, configuration)).rejects.toThrow("LOCAL_DEMO_DATABASE_UNAVAILABLE");
});
it("rejects incorrect installation/catalog association on the real connection", async () => {
  await expect(assertLocalDemoDatabase(client, { ...configuration, installationId: randomUUID() })).rejects.toThrow("LOCAL_DEMO_DATABASE_UNAVAILABLE");
  await expect(assertLocalDemoDatabase(client, { ...configuration, pilotProgramId: randomUUID() })).rejects.toThrow("LOCAL_DEMO_DATABASE_UNAVAILABLE");
  await expect(assertLocalDemoDatabase(client, { ...configuration, operatorScope: { kind: "FACULTY", institutionId: configuration.operatorScope.institutionId, faculty: "Foreign faculty" } })).rejects.toThrow("LOCAL_DEMO_DATABASE_UNAVAILABLE");
});
it("detects a role with schema creation privileges on the actual connection", async () => {
  await admin.$executeRaw`GRANT CREATE ON SCHEMA public TO careermap_v5_demo`;
  try { await expect(assertLocalDemoDatabase(client, configuration)).rejects.toThrow("LOCAL_DEMO_DATABASE_UNAVAILABLE"); }
  finally { await admin.$executeRaw`REVOKE CREATE ON SCHEMA public FROM careermap_v5_demo`; }
});
