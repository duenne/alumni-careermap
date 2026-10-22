import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("server-only", () => ({}));
import { GET as callback } from "../../../app/auth/linkedin/portability/callback/route";
import { GET, POST } from "../../../app/api/dev/import/linkedin/[action]/route";

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

it("shares the real route session across start, registered localhost callback and status", async () => {
  const env = {
    NODE_ENV: "development", CAREERMAP_DEV_IMPORT: "1", LINKEDIN_PORTABILITY_MODE: "third_party",
    LINKEDIN_PORTABILITY_SCOPE: "r_dma_portability_3rd_party", LINKEDIN_CLIENT_ID: "synthetic-client",
    LINKEDIN_CLIENT_SECRET: "synthetic-secret", LINKEDIN_REDIRECT_URI: "http://localhost:3100/auth/linkedin/portability/callback",
  };
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ access_token: "synthetic-token", expires_in: 3600 }));
  const request = (path: string, method = "GET", cookie = "") => new NextRequest(`http://localhost:3100${path}`, {
    method, headers: { host: "localhost:3100", ...(method === "POST" ? { origin: "http://localhost:3100" } : {}), cookie },
  });
  const begin = await POST(request("/api/dev/import/linkedin/start", "POST"));
  const authorize = new URL(begin.headers.get("location")!);
  expect(authorize.searchParams.get("scope")).toBe("r_dma_portability_3rd_party");
  expect(authorize.searchParams.get("redirect_uri")).toBe(env.LINKEDIN_REDIRECT_URI);
  const cookie = (begin.headers.get("set-cookie") ?? "").split(";")[0];
  expect(begin.headers.get("set-cookie")).toContain("Path=/;");
  const response = await callback(request(`/auth/linkedin/portability/callback?state=${authorize.searchParams.get("state")}&code=synthetic-code`, "GET", cookie));
  expect(response.status).toBe(303);
  expect(response.headers.get("location")).toBe("http://localhost:3100/dev/import?linkedin=connected");
  const connected = (response.headers.get("set-cookie") ?? "").split(";")[0];
  expect(connected).not.toBe(cookie);
  const status = await GET(request("/api/dev/import/linkedin/status", "GET", connected));
  expect(await status.json()).toEqual({ configured: true, connected: true, mode: "third_party", configurationIssue: null });
  expect(JSON.stringify([...response.headers])).not.toMatch(/synthetic-code|synthetic-token|synthetic-secret/);
  expect(fetcher).toHaveBeenCalledTimes(1);
  await POST(request("/api/dev/import/linkedin/disconnect", "POST", connected));
});
