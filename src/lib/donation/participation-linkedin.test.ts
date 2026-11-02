import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("../surveys/client", () => ({ surveyClient: vi.fn() }));
vi.mock("../surveys/service", async original => ({ ...await original<typeof import("../surveys/service")>(), readSurveyInvitation: vi.fn() }));
import { NextRequest } from "next/server";
import { createParticipationLinkedInHandlers } from "./participation-linkedin";
import { participationSessions, participationCookie, participationLinkedInCookie } from "./participation-session";
import { readSurveyInvitation } from "../surveys/service";
import { EphemeralLinkedInSessions } from "../dev-import/linkedin/sessions";
import type { CareerDataProvider } from "../dev-import/linkedin/provider";
import type { PrismaClient } from "../../generated/prisma/client";
import { localDemoEnvironment } from "../../../tests/support/local-demo";
const id = "44444444-4444-4444-8444-444444444444", origin = "http://127.0.0.1:3114";
const request = (action: string, method = "GET", cookie = "", extra = {}) => new NextRequest(`${origin}${action.startsWith("callback?") ? `/auth/linkedin/portability/${action}` : `/api/participation/linkedin/${action}`}`, { method, headers: { host: "127.0.0.1:3114", ...(method === "POST" ? { origin } : {}), cookie, ...extra } });
const cookie = (response: Response) => (response.headers.get("set-cookie") ?? "").split(";")[0];
beforeEach(() => {
  for (const [key, value] of Object.entries({ ...localDemoEnvironment(), CAREERMAP_LOCAL_DEMO: "v5-participation", CAREERMAP_LOCAL_DEMO_PURPOSE: "LOCAL_PARTICIPATION", CAREERMAP_LOCAL_PARTICIPATION_SURVEY_ID: id,
    CAREERMAP_LOCAL_LINKEDIN_CLIENT_ID: "synthetic-client", CAREERMAP_LOCAL_LINKEDIN_CLIENT_SECRET: "synthetic-secret", CAREERMAP_LOCAL_LINKEDIN_REDIRECT_URI: "http://localhost:3100/auth/linkedin/portability/callback" })) vi.stubEnv(key, value);
  vi.mocked(readSurveyInvitation).mockResolvedValue({ id, status: "OPEN" } as Awaited<ReturnType<typeof readSurveyInvitation>>);
});
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
function setup() {
  const client = vi.fn(async () => ({} as PrismaClient));
  const provider: CareerDataProvider = { authorizationUrl: vi.fn(state => `https://www.linkedin.com/oauth/v2/authorization?state=${state}`), exchange: vi.fn(async () => ({ accessToken: "synthetic-token", expiresIn: 3600 })), snapshot: vi.fn<CareerDataProvider["snapshot"]>(async () => ({ elements: [{ snapshotDomain: "PROFILE", snapshotData: [{}] }, { snapshotDomain: "POSITIONS", snapshotData: [] }, { snapshotDomain: "EDUCATION", snapshotData: [] }] })), rawSnapshot: vi.fn() };
  const handler = createParticipationLinkedInHandlers({ client, provider: () => provider, store: new EphemeralLinkedInSessions() });
  return { client, provider, handler };
}
it("binds OAuth to the selected open survey and returns through the shared participation route without saving or leaking tokens", async () => {
  const { handler, provider } = setup();
  const session = participationSessions.create(id, "linkedin"), bound = `${participationCookie}=${session.id}`;
  const start = await handler(request("start", "POST", bound)); expect(start.status).toBe(303);
  const state = new URL(start.headers.get("location")!).searchParams.get("state");
  const returned = await handler(request(`callback?state=${state}&code=synthetic-code`, "GET", `${bound}; ${cookie(start)}`, { "sec-fetch-site": "cross-site", "sec-fetch-mode": "navigate", "sec-fetch-dest": "document" }));
  expect(returned.status).toBe(303); expect(returned.headers.get("location")).toBe(`${origin}/surveys/${id}/participation?linkedin=connected`);
  expect(cookie(returned)).toContain(participationLinkedInCookie);
  const connected = `${bound}; ${cookie(returned)}`;
  expect(await (await handler(request("status", "GET", connected))).json()).toMatchObject({ connected: true, configured: true });
  expect(provider.snapshot).not.toHaveBeenCalled();
  expect((await handler(request("snapshot", "POST", connected))).status).toBe(200);
  expect((await handler(request("raw-snapshot", "POST", connected))).status).toBe(404);
  expect(JSON.stringify([...returned.headers])).not.toMatch(/synthetic-token|synthetic-secret|synthetic-code/);
  await handler(request("disconnect", "POST", connected));
  expect(await (await handler(request("status", "GET", connected))).json()).toMatchObject({ connected: false });
});
it("rejects unbound/manual/foreign/closed requests and completed submissions before provider calls", async () => {
  const { handler, provider, client } = setup();
  expect((await handler(request("start", "POST"))).status).toBe(401);
  const manual = participationSessions.create(id, "manual");
  expect((await handler(request("start", "POST", `${participationCookie}=${manual.id}`))).status).toBe(401);
  const session = participationSessions.create(id, "linkedin"), bound = `${participationCookie}=${session.id}`;
  expect((await handler(request("start", "POST", bound, { host: "foreign.invalid" }))).status).toBe(404);
  expect(client).not.toHaveBeenCalled();
  vi.mocked(readSurveyInvitation).mockResolvedValue({ id, status: "CLOSED" } as Awaited<ReturnType<typeof readSurveyInvitation>>);
  expect((await handler(request("start", "POST", bound))).status).toBe(409);
  session.pending = Promise.resolve({}); expect((await handler(request("start", "POST", bound))).status).toBe(409);
  expect(provider.authorizationUrl).not.toHaveBeenCalled(); expect(provider.exchange).not.toHaveBeenCalled();
});
