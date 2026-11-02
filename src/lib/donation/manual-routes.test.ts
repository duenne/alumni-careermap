import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("../surveys/service", async original => ({ ...await original<typeof import("../surveys/service")>(), readSurveyInvitation: vi.fn() }));
vi.mock("./manual-service", () => ({ saveManualParticipation: vi.fn() }));
import { NextRequest } from "next/server";
import { createManualParticipationHandlers } from "./manual-routes";
import { readSurveyInvitation } from "../surveys/service";
import { saveManualParticipation } from "./manual-service";
import { localDemoEnvironment } from "../../../tests/support/local-demo";
import { manualExample } from "../../../tests/support/manual-participation";
import type { PrismaClient } from "../../generated/prisma/client";
const id = "44444444-4444-4444-8444-444444444444";
const origin = "http://127.0.0.1:3114";
const request = (body?: unknown, cookie = "", extra = {}) => new NextRequest(`${origin}/api/surveys/${id}/participation`, {
  method: body === undefined ? "GET" : "POST", headers: { host: "127.0.0.1:3114", origin, "content-type": "application/json", cookie, ...extra },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
beforeEach(() => {
  for (const [key, value] of Object.entries({ ...localDemoEnvironment(), CAREERMAP_LOCAL_DEMO: "v5-participation", CAREERMAP_LOCAL_DEMO_PURPOSE: "LOCAL_PARTICIPATION", CAREERMAP_LOCAL_PARTICIPATION_SURVEY_ID: id })) vi.stubEnv(key, value);
  vi.mocked(readSurveyInvitation).mockResolvedValue({ id, name: "Synthetische Testbefragung", status: "OPEN", referenceProgram: { id, name: "Master Informatik", faculty: null, institution: { id, name: "Synthetische Hochschule" } } });
  vi.mocked(saveManualParticipation).mockResolvedValue({ alumniId: "PRIVATE_ALUMNI", responseId: "PRIVATE_RESPONSE", degrees: 1, careerSteps: 1, timelineItems: 2 });
});
afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });
it("starts a bound manual session, persists only after explicit confirmations and returns a count-only receipt, including reload/retry", async () => {
  const handler = createManualParticipationHandlers(async () => ({} as PrismaClient));
  expect((await handler(request(), id)).status).toBe(401);
  const begin = await handler(request({ begin: "manual" }), id);
  const cookie = begin.cookies.getAll().map(c => `${c.name}=${c.value}`).join("; ");
  expect(begin.status).toBe(200); expect(begin.cookies.getAll().find(c => c.name === "careermap_manual_participation")).toMatchObject({ httpOnly: true, sameSite: "lax" });
  const unconfirmed = manualExample(); unconfirmed.contributionConfirmed = false;
  expect((await handler(request({ input: unconfirmed }, cookie), id)).status).toBe(400);
  expect(saveManualParticipation).not.toHaveBeenCalled();
  const input = manualExample();
  const results = await Promise.all([handler(request({ input }, cookie), id), handler(request({ input }, cookie), id)]);
  for (const response of results) expect(await response.json()).toEqual({ saved: true, receipt: { degrees: 1, careerSteps: 1, timelineItems: 2 } });
  expect(saveManualParticipation).toHaveBeenCalledOnce();
  const loaded = await handler(request(undefined, cookie), id);
  expect(JSON.stringify(await loaded.json())).not.toContain("PRIVATE");
  expect((await handler(request({ begin: "manual" }, cookie), id)).status).toBe(409);
});
it("rejects foreign origins/hosts, other surveys, import modes, demo-only mode and closed surveys", async () => {
  const client = vi.fn(async () => ({} as PrismaClient)), handler = createManualParticipationHandlers(client);
  for (const extra of [{ origin: "https://foreign.invalid" }, { host: "foreign.invalid" }, { origin: "" }, { "x-forwarded-for": "192.0.2.1" }]) expect((await handler(request({ begin: "manual" }, "", extra), id)).status).toBe(404);
  expect((await handler(request({ begin: "manual" }), "55555555-5555-4555-8555-555555555555")).status).toBe(404);
  expect(client).not.toHaveBeenCalled();
  expect((await handler(request({ begin: "linkedin" }), id)).status).toBe(503);
  expect((await handler(request({ begin: "cv" }), id)).status).toBe(400);
  for (const status of ["CLOSED", "DRAFT"] as const) {
    vi.mocked(readSurveyInvitation).mockResolvedValue({ status } as Awaited<ReturnType<typeof readSurveyInvitation>>);
    expect((await handler(request({ begin: "manual" }), id)).status).toBe(409);
  }
  vi.stubEnv("CAREERMAP_LOCAL_DEMO", "v5-synthetic");
  expect((await handler(request({ begin: "manual" }), id)).status).toBe(404);
  expect(saveManualParticipation).not.toHaveBeenCalled();
});
it("uses the same confirmation/save boundary for a LinkedIn session or a manual fallback and never saves at source selection", async () => {
  vi.stubEnv("CAREERMAP_LOCAL_LINKEDIN_CLIENT_ID", "synthetic-client"); vi.stubEnv("CAREERMAP_LOCAL_LINKEDIN_CLIENT_SECRET", "synthetic-secret");
  vi.stubEnv("CAREERMAP_LOCAL_LINKEDIN_REDIRECT_URI", "http://localhost:3100/auth/linkedin/portability/callback");
  const handler = createManualParticipationHandlers(async () => ({} as PrismaClient));
  const begun = await handler(request({ begin: "linkedin" }), id);
  expect(begun.status).toBe(200); expect(saveManualParticipation).not.toHaveBeenCalled();
  const cookie = begun.cookies.getAll().map(c => `${c.name}=${c.value}`).join("; ");
  expect((await handler(request({ input: manualExample() }, cookie), id)).status).toBe(200);
  expect(saveManualParticipation).toHaveBeenCalledOnce();
});
