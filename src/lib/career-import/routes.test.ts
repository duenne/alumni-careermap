import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("./service", () => ({ saveCareerImport: vi.fn() }));
import { createMappingHandlers } from "./routes";
import { validateMappingDatabaseUrl } from "./sandbox";
import { saveCareerImport } from "./service";
import type { PrismaClient } from "../../generated/prisma/client";

beforeEach(() => { vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("CAREERMAP_DEV_IMPORT", "1"); vi.stubEnv("CAREERMAP_DEV_MAPPING", "1"); });
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
const request = (method: string, body?: unknown, origin: string | null = "http://localhost:3104") => new Request("http://localhost:3104/api/dev/import/mapping", {
  method, headers: { host: "localhost:3104", ...(origin ? { origin } : {}), "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}),
});
it("refuses production, foreign/missing origins, disabled writes and malformed requests before opening a database", async () => {
  const client = vi.fn(); const app = createMappingHandlers({ client });
  expect((await app.POST(request("POST", {}, null))).status).toBe(404);
  expect((await app.POST(request("POST", {}, "https://foreign.invalid"))).status).toBe(404);
  expect((await app.POST(request("POST", {}))).status).toBe(400);
  vi.stubEnv("CAREERMAP_DEV_MAPPING", "0");
  expect((await app.GET(request("GET"))).status).toBe(404);
  vi.stubEnv("CAREERMAP_DEV_MAPPING", "1"); vi.stubEnv("NODE_ENV", "production");
  expect((await app.POST(request("POST", {}))).status).toBe(404);
  expect(client).not.toHaveBeenCalled();
});
it("accepts only a dedicated loopback mapping database, never a general DATABASE_URL", () => {
  expect(validateMappingDatabaseUrl("postgresql://test:secret@127.0.0.1:5432/careermap_mapping_test")).toContain("careermap_mapping_test");
  for (const url of [undefined, "postgresql://test:secret@db.example.invalid/careermap_mapping_test", "postgresql://test:secret@localhost/careermap", "postgresql://test:secret@localhost/careermap_mapping_test?host=evil.invalid", "file:local.db"]) {
    expect(() => validateMappingDatabaseUrl(url)).toThrow("Mapping sandbox configuration required");
  }
});
it("serializes concurrent/retried submissions and refuses a changed payload under the same submission ID", async () => {
  vi.stubEnv("CAREERMAP_MAPPING_OPERATOR_ID", "00000000-0000-4000-8000-000000000001");
  const client = vi.fn(async () => ({} as PrismaClient));
  const save = vi.mocked(saveCareerImport);
  const receipt = { alumniId: "synthetic-new-id", responseId: "synthetic-response", degrees: 1, careerSteps: 0, timelineItems: 1 };
  save.mockResolvedValue(receipt);
  const app = createMappingHandlers({ client });
  const body = { submissionId: "00000000-0000-4000-8000-000000000002", input: { synthetic: true } };
  const results = await Promise.all([app.POST(request("POST", body)), app.POST(request("POST", body))]);
  expect(await results[0].json()).toEqual({ receipt }); expect(await results[1].json()).toEqual({ receipt });
  expect(save).toHaveBeenCalledOnce();
  expect((await app.POST(request("POST", { ...body, input: { changed: true } }))).status).toBe(409);
});
it("bounds request bodies and never echoes provider/database exceptions", async () => {
  const client = vi.fn(async () => { throw new Error("PRIVATE_SECRET"); });
  const app = createMappingHandlers({ client });
  expect((await app.POST(request("POST", { data: "x".repeat(300_001) }))).status).toBe(413);
  expect(client).not.toHaveBeenCalled();
  const result = await app.GET(request("GET"));
  expect(result.status).toBe(503); expect(JSON.stringify(await result.json())).not.toContain("PRIVATE_SECRET");
});
