import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("server-only", () => ({}));
import { createLinkedInHandlers } from "./routes";
import { EphemeralLinkedInSessions } from "./sessions";
import { PortabilityError, type CareerDataProvider } from "./provider";
import type { LinkedInConfig } from "./config";
import { proxy } from "../../../proxy";
import fixture from "../../../test-fixtures/linkedin-snapshots/fictional-member.json";
import { projectSnapshot } from "../json-preview";

const origin = "http://localhost:3100";
const config: LinkedInConfig = { mode: "third_party", scope: "r_dma_portability_3rd_party", clientId: "synthetic-client", clientSecret: "synthetic-secret", redirectUri: `${origin}/auth/linkedin/portability/callback` };
const request = (action: string, method = "GET", cookie = "", query = "", extra: Record<string, string> = {}) => new NextRequest(`${origin}${action === "callback" ? "/auth/linkedin/portability/callback" : `/api/dev/import/linkedin/${action}`}${query}`, { method, headers: {
  host: "localhost:3100", ...(method === "POST" ? { origin } : {}), ...(cookie ? { cookie } : {}), ...extra,
} });
const cookieOf = (response: Response) => (response.headers.get("set-cookie") ?? "").split(";")[0];

beforeEach(() => { vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("CAREERMAP_DEV_IMPORT", "1"); });
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

function setup() {
  const provider: CareerDataProvider = {
    authorizationUrl: vi.fn(state => `https://www.linkedin.com/oauth/v2/authorization?state=${state}`),
    exchange: vi.fn(async () => ({ accessToken: "synthetic-token", expiresIn: 3600 })),
    snapshot: vi.fn(async () => projectSnapshot(fixture)),
  };
  const store = new EphemeralLinkedInSessions();
  return { provider, store, ...createLinkedInHandlers({ config: () => config, provider: () => provider, store }) };
}
async function begin(app: ReturnType<typeof setup>) {
  const response = await app.POST(request("start", "POST"));
  expect(response.status).toBe(303);
  expect(response.headers.get("set-cookie")).toMatch(/HttpOnly/i);
  expect(response.headers.get("set-cookie")).toMatch(/SameSite=Lax/i);
  expect(response.headers.get("set-cookie")).toMatch(/Path=\//);
  expect(response.headers.get("set-cookie")).not.toContain("Path=/api/");
  expect(response.headers.get("set-cookie")).not.toMatch(/synthetic-token|synthetic-secret/);
  return { cookie: cookieOf(response), state: new URL(response.headers.get("location")!).searchParams.get("state")! };
}
async function connect(app: ReturnType<typeof setup>) {
  const { cookie, state } = await begin(app);
  const response = await app.GET(request("callback", "GET", cookie, `?state=${state}&code=synthetic-code`, {
    "sec-fetch-site": "cross-site", "sec-fetch-mode": "navigate", "sec-fetch-dest": "document",
  }));
  expect(response.status).toBe(303);
  expect(response.headers.get("location")).toBe(`${origin}/dev/import?linkedin=connected`);
  expect(cookieOf(response)).not.toBe(cookie);
  return cookieOf(response);
}

describe("V1b OAuth routes and temporary server sessions", () => {
  it("returns only allowlisted snapshot diagnostics, never raw fields, bodies or provider exception text", async () => {
    const app = setup();
    const cookie = await connect(app);
    const failure = Object.assign(new PortabilityError("INVALID_RESPONSE"), {
      diagnostic: { reason: "PAGING_START", domain: "POSITIONS", page: 1, raw: "PRIVATE_SYNTHETIC_MARKER", access_token: "synthetic-token" },
    });
    vi.mocked(app.provider.snapshot).mockRejectedValue(failure);
    const response = await app.POST(request("snapshot", "POST", cookie));
    expect(response.status).toBe(502);
    const data = await response.json();
    expect(data.diagnostic).toEqual({ reason: "PAGING_START", domain: "POSITIONS", page: 1 });
    expect(JSON.stringify(data)).not.toMatch(/PRIVATE_SYNTHETIC_MARKER|synthetic-token/);
  });
  it("allows only a top-level local import GET after an external callback redirect", () => {
    const navigation = { host: "localhost:3100", "sec-fetch-site": "cross-site", "sec-fetch-mode": "navigate", "sec-fetch-dest": "document" };
    const page = (path: string, method = "GET", extra = {}) => new NextRequest(`${origin}${path}`, { method, headers: { ...navigation, ...extra } });
    expect(proxy(page("/dev/import?linkedin=connected")).headers.get("x-middleware-next")).toBe("1");
    expect(proxy(page("/dev/import", "GET", { "sec-fetch-site": "same-site" })).headers.get("x-middleware-next")).toBe("1");
    expect(proxy(page("/dev/import?linkedin=INVALID_STATE")).status).toBe(200);
    for (const [method, extra] of [
      ["POST", {}], ["GET", { "sec-fetch-mode": "cors" }], ["GET", { "sec-fetch-dest": "iframe" }],
      ["GET", { origin: "null" }], ["GET", { "x-forwarded-for": "203.0.113.1" }],
      ["GET", { host: "external.invalid" }],
    ] as const) expect(proxy(page("/dev/import?linkedin=connected", method, extra)).status).toBe(404);
    expect(proxy(page("/dev/import/nested?linkedin=connected")).status).toBe(404);
    for (const action of ["status", "snapshot", "start", "disconnect"]) {
      expect(proxy(page(`/api/dev/import/linkedin/${action}?linkedin=connected`)).status).toBe(404);
    }
    vi.stubEnv("NODE_ENV", "production");
    expect(proxy(page("/dev/import?linkedin=connected")).status).toBe(404);
    vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("CAREERMAP_DEV_IMPORT", "0");
    expect(proxy(page("/dev/import?linkedin=connected")).status).toBe(404);
  });
  it("preserves the form origin on the import page while keeping callback and API referrers private", () => {
    const page = new NextRequest(`${origin}/dev/import`, { headers: { host: "localhost:3100" } });
    expect(proxy(page).headers.get("referrer-policy")).toBe("same-origin");
    for (const action of ["start", "status", "snapshot", "disconnect", "callback"]) {
      expect(proxy(request(action)).headers.get("referrer-policy")).toBe("no-referrer");
    }
  });
  it("distinguishes missing configuration from a callback-origin mismatch without exposing app values", async () => {
    const app = setup();
    const unconfigured = createLinkedInHandlers({ config: () => null, provider: () => app.provider, store: app.store });
    expect(await (await unconfigured.GET(request("status"))).json()).toEqual({
      configured: false, connected: false, mode: null, configurationIssue: "NOT_CONFIGURED",
    });
    const mismatched = await app.GET(request("status", "GET", "", "", { host: "127.0.0.1:3100" }));
    expect(await mismatched.json()).toEqual({
      configured: false, connected: false, mode: null, configurationIssue: "ORIGIN_MISMATCH",
    });
    const ready = await app.GET(request("status"));
    expect(await ready.json()).toEqual({ configured: true, connected: false, mode: "third_party", configurationIssue: null });
    expect(app.provider.authorizationUrl).not.toHaveBeenCalled();
    expect(app.provider.exchange).not.toHaveBeenCalled();
  });
  it("requires a cookie-bound, single-use state before exchanging any code", async () => {
    const app = setup();
    const { cookie, state } = await begin(app);
    const invalid = await app.GET(request("callback", "GET", "", `?state=${state}&code=synthetic-code`));
    expect(invalid.headers.get("location")).toBe(`${origin}/dev/import?linkedin=INVALID_STATE`);
    expect((await app.GET(request("callback", "GET", cookie, "?state=wrong&code=synthetic-code"))).status).toBe(303);
    expect(app.provider.exchange).not.toHaveBeenCalled();
    // An invalid callback invalidates the attempt; reconnect explicitly.
    const next = await begin(app);
    const success = await app.GET(request("callback", "GET", next.cookie, `?state=${next.state}&code=synthetic-code`));
    expect(success.status).toBe(303);
    expect((await app.GET(request("callback", "GET", next.cookie, `?state=${next.state}&code=synthetic-code`))).headers.get("location")).toBe(`${origin}/dev/import?linkedin=INVALID_STATE`);
    expect(app.provider.exchange).toHaveBeenCalledTimes(1);
  });
  it("returns minimized JSON, with no token, only after explicit connected-session fetch", async () => {
    const app = setup();
    const cookie = await connect(app);
    expect(app.provider.snapshot).not.toHaveBeenCalled();
    const response = await app.POST(request("snapshot", "POST", cookie));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    const text = await response.text();
    expect(text).toContain("Synthetic Research Assistant");
    expect(text).not.toMatch(/synthetic-token|synthetic-secret|fictional-private|FICTIONAL_|First Name/);
    expect(app.provider.snapshot).toHaveBeenCalledTimes(1);
    expect((await app.GET(request("status", "GET", cookie))).status).toBe(200);
  });
  it("disconnects and aborts pending reads; a late result cannot resurrect the connection", async () => {
    const app = setup();
    const cookie = await connect(app);
    let release!: () => void;
    const wait = new Promise<void>(resolve => { release = resolve; });
    vi.mocked(app.provider.snapshot).mockImplementation(async (_token, signal) => {
      await wait;
      expect(signal?.aborted).toBe(true);
      return projectSnapshot(fixture);
    });
    const pending = app.POST(request("snapshot", "POST", cookie));
    expect((await app.POST(request("disconnect", "POST", cookie))).status).toBe(200);
    release();
    expect((await pending).status).toBe(401);
    expect((await app.POST(request("snapshot", "POST", cookie))).status).toBe(401);
  });
  it("rejects CSRF, expired sessions and production requests before any provider call", async () => {
    const app = setup();
    expect((await app.POST(request("start", "POST", "", "", { origin: "https://evil.invalid" }))).status).toBe(404);
    expect((await app.POST(request("start", "POST", "", "", { origin: "" }))).status).toBe(404);
    const { cookie, state } = await begin(app);
    vi.useFakeTimers(); vi.advanceTimersByTime(5 * 60_000 + 1);
    expect((await app.GET(request("callback", "GET", cookie, `?state=${state}&code=synthetic-code`))).headers.get("location")).toBe(`${origin}/dev/import?linkedin=INVALID_STATE`);
    vi.useRealTimers();
    const connected = await connect(app);
    vi.useFakeTimers(); vi.advanceTimersByTime(15 * 60_000 + 1);
    expect((await app.POST(request("snapshot", "POST", connected))).status).toBe(401);
    vi.stubEnv("NODE_ENV", "production");
    expect((await app.GET(request("status", "GET", connected))).status).toBe(404);
    expect(app.provider.snapshot).not.toHaveBeenCalled();
  });
  it("handles cancelled authorization without echoing provider errors", async () => {
    const app = setup();
    const { cookie, state } = await begin(app);
    const response = await app.GET(request("callback", "GET", cookie, `?state=${state}&error=user_cancelled_authorize&error_description=PRIVATE_SYNTHETIC_MARKER`));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(`${origin}/dev/import?linkedin=CANCELLED`);
    expect(await response.text()).not.toContain("PRIVATE_SYNTHETIC_MARKER");
    expect(app.provider.exchange).not.toHaveBeenCalled();
  });
  it("opens only the exact top-level callback through the cross-site development gate", () => {
    const headers = { "sec-fetch-site": "cross-site", "sec-fetch-mode": "navigate", "sec-fetch-dest": "document" };
    expect(proxy(request("callback", "GET", "", "", headers)).headers.get("x-middleware-next")).toBe("1");
    for (const action of ["start", "status", "snapshot", "disconnect"]) expect(proxy(request(action, "GET", "", "", headers)).status).toBe(404);
    expect(proxy(request("callback", "GET", "", "", { ...headers, "sec-fetch-mode": "cors" })).status).toBe(404);
    expect(proxy(request("callback", "GET", "", "", { ...headers, "x-forwarded-for": "203.0.113.1" })).status).toBe(404);
    vi.stubEnv("NODE_ENV", "production");
    expect(proxy(request("callback", "GET", "", "", headers)).status).toBe(404);
  });
});
