import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../../proxy";

const path = "/surveys/00000000-0000-4000-8000-000000000001/participate";
function request(pathname: string, host = "127.0.0.1:3111", method = "GET", extra = {}) {
  return new NextRequest(`http://${host}${pathname}`, { method, headers: { host, ...extra } });
}
beforeEach(() => {
  vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("CAREERMAP_DEV_SURVEYS", "1"); vi.stubEnv("CAREERMAP_DEV_DONATION", "1");
  vi.stubEnv("LINKEDIN_REDIRECT_URI", "http://localhost:3100/auth/linkedin/portability/callback");
});
afterEach(() => vi.unstubAllEnvs());

it("keeps invitation context while unifying UI addresses and obsolete demo entry points", () => {
  expect(proxy(request(path)).headers.get("location")).toBe(`http://localhost:3100${path}`);
  expect(proxy(request("/")).headers.get("location")).toBe("http://localhost:3100/");
  expect(proxy(request(path, "localhost:3100")).headers.get("x-middleware-next")).toBe("1");
  for (const old of ["/dev/import", "/dev/mapping", "/review"]) expect(proxy(request(old)).headers.get("location")).toBe("http://localhost:3100/");
  expect(proxy(request("/dev/analytics")).headers.get("location")).toBe("http://localhost:3100/admin/surveys");
});

it("does not redirect APIs, credentials, callbacks, foreign requests or production into a public flow", () => {
  expect(proxy(request(path, "foreign.invalid")).status).toBe(404);
  expect(proxy(request(path, "127.0.0.1:3111", "GET", { "x-forwarded-host": "foreign.invalid" })).status).toBe(404);
  expect(proxy(request(path, "127.0.0.1:3111", "GET", { origin: "https://foreign.invalid" })).status).toBe(404);
  for (const api of ["/api/dev/import/linkedin/start", "/auth/linkedin/portability/callback"]) expect(proxy(request(api)).headers.get("location")).toBeNull();
  expect(proxy(request(path, "127.0.0.1:3111", "POST")).headers.get("location")).toBeNull();
  vi.stubEnv("NODE_ENV", "production");
  expect(proxy(request(path)).status).toBe(404);
  expect(proxy(request("/")).headers.get("location")).toBeNull();
});
