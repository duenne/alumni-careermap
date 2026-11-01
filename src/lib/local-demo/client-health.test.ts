import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { localDemoEnvironment } from "../../../tests/support/local-demo";
import { surveyClient } from "../surveys/client";
import { localDemoClient } from "./database";
import { mappingClient } from "../career-import/sandbox-db";
import { checkDatabase } from "../db";
import { GET } from "../../app/api/health/route";
vi.mock("server-only", () => ({}));
vi.mock("./database", () => ({ localDemoClient: vi.fn(async () => ({})) }));
vi.mock("../career-import/sandbox-db", () => ({ mappingClient: vi.fn(async () => ({})) }));
vi.mock("../db", () => ({ checkDatabase: vi.fn(async () => {}) }));
beforeEach(() => { vi.clearAllMocks(); vi.mocked(localDemoClient).mockResolvedValue({} as Awaited<ReturnType<typeof localDemoClient>>); for (const [key, value] of Object.entries(localDemoEnvironment())) vi.stubEnv(key, value); });
afterEach(() => vi.unstubAllEnvs());
it("uses the same guarded client for surveys and readiness, without querying another DB", async () => {
  await surveyClient();
  const response = await GET();
  expect(response.status).toBe(200); expect(await response.json()).toEqual({ status: "ok" });
  expect(localDemoClient).toHaveBeenCalledTimes(2);
  expect(mappingClient).not.toHaveBeenCalled(); expect(checkDatabase).not.toHaveBeenCalled();
});
it("returns a safe 503 and never falls back when actual demo verification fails", async () => {
  vi.mocked(localDemoClient).mockRejectedValue(new Error("PRIVATE_CONNECTION_URL"));
  const response = await GET();
  expect(response.status).toBe(503); expect(await response.json()).toEqual({ status: "unavailable" });
  await expect(surveyClient()).rejects.toThrow();
  expect(mappingClient).not.toHaveBeenCalled(); expect(checkDatabase).not.toHaveBeenCalled();
});
it("keeps normal production surveys closed and the old development client separate", async () => {
  vi.stubEnv("CAREERMAP_LOCAL_DEMO", undefined);
  await expect(surveyClient()).rejects.toThrow(); expect(mappingClient).not.toHaveBeenCalled();
  vi.stubEnv("NODE_ENV", "development"); await surveyClient();
  expect(mappingClient).toHaveBeenCalledOnce(); expect(localDemoClient).not.toHaveBeenCalled();
});
