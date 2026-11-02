import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { localDemoEnvironment } from "../../../tests/support/local-demo";
import { createSurveyHandlers } from "../surveys/routes";
import { createSurvey } from "../surveys/service";
import { surveyPilotProgramId } from "../surveys/access";
import type { PrismaClient } from "../../generated/prisma/client";
vi.mock("server-only", () => ({}));
vi.mock("../surveys/service", async original => ({ ...await original<typeof import("../surveys/service")>(), createSurvey: vi.fn() }));
const env = localDemoEnvironment();
beforeEach(() => { vi.clearAllMocks(); for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value); });
afterEach(() => vi.unstubAllEnvs());
function request(auth = true, origin = "http://127.0.0.1:3114") {
  return new Request("http://127.0.0.1:3114/api/admin/surveys", { method: "POST", headers: {
    host: "127.0.0.1:3114", origin, "content-type": "application/json",
    ...(auth ? { authorization: `Basic ${Buffer.from(`operator:${env.CAREERMAP_SURVEY_ADMIN_TOKEN}`).toString("base64")}` } : {}),
  }, body: JSON.stringify({ action: "create", name: "SYNTHETISCH / DEMO – Master Informatik", referenceProgramId: "44444444-4444-4444-8444-444444444444" }) });
}
it("passes independent Master survey creation to the existing DRAFT service with unchanged operator scope", async () => {
  const client = {} as PrismaClient, getClient = vi.fn(async () => client);
  vi.mocked(createSurvey).mockResolvedValue({ id: "synthetic-survey-b", status: "DRAFT" } as Awaited<ReturnType<typeof createSurvey>>);
  const response = await createSurveyHandlers({ client: getClient }).POST(request());
  expect(response.status).toBe(201);
  expect(createSurvey).toHaveBeenCalledWith(client, { name: "SYNTHETISCH / DEMO – Master Informatik", referenceProgramId: "44444444-4444-4444-8444-444444444444" },
    { operatorScope: { kind: "INSTITUTION", institutionId: env.CAREERMAP_LOCAL_DEMO_OPERATOR_ID } });
  expect(surveyPilotProgramId()).toBe(env.CAREERMAP_LOCAL_DEMO_MSI_PROGRAM_ID);
});
it("rejects missing credentials and missing/foreign origins before database access", async () => {
  const client = vi.fn(), handlers = createSurveyHandlers({ client });
  expect((await handlers.POST(request(false))).status).toBe(401);
  for (const origin of ["", "null", "http://example.com"]) expect((await handlers.POST(request(true, origin))).status).toBe(404);
  expect(client).not.toHaveBeenCalled(); expect(createSurvey).not.toHaveBeenCalled();
});
