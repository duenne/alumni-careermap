import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("./service", async importOriginal => ({ ...await importOriginal<typeof import("./service")>(), createSurvey: vi.fn(), changeSurveyStatus: vi.fn(), listSurveyAdministration: vi.fn(), readSurveyInvitation: vi.fn() }));
import { createSurveyHandlers } from "./routes";
import { createSurvey, readSurveyInvitation } from "./service";
import type { PrismaClient } from "../../generated/prisma/client";

const token = "synthetic-admin-token-at-least-32-characters";
const id = "00000000-0000-4000-8000-000000000001";
const request = (method = "GET", body?: unknown, extra = {}) => new Request(`http://localhost:3110/api/admin/surveys`, {
  method, headers: { host: "localhost:3110", authorization: `Basic ${Buffer.from(`operator:${token}`).toString("base64")}`, ...(method === "POST" ? { origin: "http://localhost:3110", "content-type": "application/json" } : {}), ...extra },
  ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }),
});
beforeEach(() => {
  vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("CAREERMAP_DEV_SURVEYS", "1");
  vi.stubEnv("CAREERMAP_SURVEY_ADMIN_TOKEN", token); vi.stubEnv("CAREERMAP_MAPPING_OPERATOR_ID", id); vi.stubEnv("CAREERMAP_SURVEY_OPERATOR_KIND", "INSTITUTION");
});
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
it("rejects unauthorized reads/writes and missing or foreign origins before database access", async () => {
  const client = vi.fn(); const app = createSurveyHandlers({ client });
  expect((await app.GET(request("GET", undefined, { authorization: "" }))).status).toBe(401);
  for (const origin of ["", "null", "https://foreign.invalid"]) expect((await app.POST(request("POST", {}, { origin }))).status).toBe(404);
  vi.stubEnv("NODE_ENV", "production");
  expect((await app.GET(request())).status).toBe(404);
  expect((await app.invitation(request(), id)).status).toBe(404);
  expect(client).not.toHaveBeenCalled();
});
it("bounds and strictly validates bodies including attempted reference changes", async () => {
  const client = vi.fn(); const app = createSurveyHandlers({ client });
  for (const body of ["{", {}, { action: "create", name: "Synthetic", referenceProgramId: id, status: "OPEN" }, { action: "status", surveyId: id, status: "OPEN", referenceProgramId: id }]) {
    expect((await app.POST(request("POST", body))).status).toBe(400);
  }
  expect((await app.POST(request("POST", { action: "program-create", institutionId: id, name: " ", faculty: null }))).status).toBe(400);
  expect((await app.POST(request("POST", { action: "program-create", institutionId: id, name: "Synthetic", faculty: null, status: "OPEN" }))).status).toBe(400);
  expect((await app.POST(request("POST", "x".repeat(5000)))).status).toBe(413);
  expect(client).not.toHaveBeenCalled();
});
it("creates with trusted scope and never echoes internal errors", async () => {
  const client = vi.fn(async () => ({} as PrismaClient)); const app = createSurveyHandlers({ client });
  vi.mocked(createSurvey).mockResolvedValue({ id } as Awaited<ReturnType<typeof createSurvey>>);
  const body = { action: "create", name: "Synthetic", referenceProgramId: id };
  expect((await app.POST(request("POST", body))).status).toBe(201);
  expect(createSurvey).toHaveBeenCalledWith({}, { name: "Synthetic", referenceProgramId: id }, { operatorScope: { kind: "INSTITUTION", institutionId: id } });
  client.mockRejectedValue(new Error("PRIVATE_DATABASE_SECRET"));
  const response = await app.GET(request());
  expect(response.status).toBe(503); expect(await response.text()).not.toContain("PRIVATE_DATABASE_SECRET");
});
it("returns only invitation context without credentials, and handles unavailable contexts", async () => {
  const app = createSurveyHandlers({ client: vi.fn(async () => ({} as PrismaClient)) });
  const req = request("GET", undefined, { authorization: "" });
  vi.mocked(readSurveyInvitation).mockResolvedValue(null);
  expect((await app.invitation(req, id)).status).toBe(404);
  expect((await app.invitation(req, "invalid")).status).toBe(404);
  const context = { id, name: "Synthetic", status: "OPEN", referenceProgram: { id, name: "Synthetic program", faculty: null, institution: { id, name: "Synthetic institute" } } } as const;
  vi.mocked(readSurveyInvitation).mockResolvedValue(context);
  const response = await app.invitation(req, id);
  expect(await response.json()).toEqual(context);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
});
