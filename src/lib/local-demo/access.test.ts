import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { localDemoEnvironment } from "../../../tests/support/local-demo";
import { surveyAccess, surveyConfiguration } from "../surveys/access";
import { allowDevImport } from "../dev-import/access";
import { donationAllowed } from "../donation/routes";
import { proxy } from "../../proxy";
vi.mock("server-only", () => ({}));
const env = localDemoEnvironment();
const authenticated = () => `Basic ${Buffer.from(`operator:${env.CAREERMAP_SURVEY_ADMIN_TOKEN}`).toString("base64")}`;
const headers = (extra = {}) => new Headers({ host: "127.0.0.1:3114", ...extra });
beforeEach(() => { for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value); });
afterEach(() => vi.unstubAllEnvs());
describe("D1.4b production survey access only", () => {
  it("opens only the exact cookie-bearing participant callback after explicit LinkedIn opt-in, keeping forwarded and cross-site API requests closed", () => {
    vi.stubEnv("CAREERMAP_LOCAL_DEMO", "v5-participation"); vi.stubEnv("CAREERMAP_LOCAL_DEMO_PURPOSE", "LOCAL_PARTICIPATION");
    vi.stubEnv("CAREERMAP_LOCAL_PARTICIPATION_SURVEY_ID", "44444444-4444-4444-8444-444444444444");
    vi.stubEnv("CAREERMAP_LOCAL_LINKEDIN_CLIENT_ID", "synthetic-client"); vi.stubEnv("CAREERMAP_LOCAL_LINKEDIN_CLIENT_SECRET", "synthetic-secret");
    vi.stubEnv("CAREERMAP_LOCAL_LINKEDIN_REDIRECT_URI", "http://localhost:3100/auth/linkedin/portability/callback");
    const navigation = { cookie: "careermap_manual_participation=synthetic-capability", "sec-fetch-site": "cross-site", "sec-fetch-mode": "navigate", "sec-fetch-dest": "document" };
    const request = (path = "/auth/linkedin/portability/callback", extra = {}, method = "GET") => new NextRequest(`http://127.0.0.1:3114${path}`, { method, headers: headers({ ...navigation, ...extra }) });
    expect(proxy(request()).headers.get("x-middleware-next")).toBe("1");
    expect(proxy(request(undefined, { "x-forwarded-for": "192.0.2.1" })).status).toBe(404);
    expect(proxy(request(undefined, { "sec-fetch-mode": "cors", "sec-fetch-dest": "empty" })).status).toBe(404);
    expect(proxy(request(undefined, {}, "POST")).status).toBe(404);
    expect(proxy(request("/auth/unrelated")).status).toBe(404);
    expect(proxy(request("/surveys/44444444-4444-4444-8444-444444444444/participation", { "sec-fetch-site": "same-origin" })).headers.get("referrer-policy")).toBe("same-origin");
  });
  it("retains Basic authentication and takes scope only from the validated installation", () => {
    expect(surveyAccess(headers(), true)).toBe(401);
    expect(surveyAccess(headers({ authorization: "Basic invalid" }), true)).toBe(401);
    expect(surveyAccess(headers({ authorization: authenticated() }), true)).toBe(200);
    expect(surveyAccess(headers(), false)).toBe(200);
    expect(surveyConfiguration().operatorScope).toMatchObject({ institutionId: env.CAREERMAP_LOCAL_DEMO_OPERATOR_ID });
  });
  it.each([{ host: "example.com" }, { host: "127.0.0.1:3115" }, { origin: "http://example.com" }, { origin: "null" },
    { "x-forwarded-host": "example.com" }, { "x-forwarded-for": "192.0.2.5" }, { forwarded: "for=127.0.0.1" }, { "sec-fetch-site": "cross-site" }])("rejects foreign and forged requests (%#)", extra => {
    expect(surveyAccess(headers({ ...extra, authorization: authenticated() }), true)).toBe(404);
    expect(surveyAccess(headers(extra), false)).toBe(404);
  });
  it("keeps only the existing public document-navigation exception", () => {
    const navigation = headers({ "sec-fetch-site": "cross-site", "sec-fetch-mode": "navigate", "sec-fetch-dest": "document" });
    expect(surveyAccess(navigation, false)).toBe(200);
    expect(surveyAccess(navigation, true)).toBe(404);
  });
  it("fails closed without mode, with an invalid installation, or with a conflicting legacy opt-in", () => {
    vi.stubEnv("CAREERMAP_LOCAL_DEMO", undefined);
    expect(surveyAccess(headers(), false)).toBe(404);
    vi.stubEnv("CAREERMAP_LOCAL_DEMO", "v5-synthetic"); vi.stubEnv("CAREERMAP_LOCAL_DEMO_INSTALLATION_ID", "invalid");
    expect(surveyAccess(headers(), false)).toBe(404);
    vi.stubEnv("CAREERMAP_LOCAL_DEMO_INSTALLATION_ID", env.CAREERMAP_LOCAL_DEMO_INSTALLATION_ID); vi.stubEnv("CAREERMAP_DEV_SURVEYS", "1");
    expect(surveyAccess(headers(), false)).toBe(404);
  });
  it.each(["/dev/import", "/dev/mapping", "/dev/analytics", "/api/dev/import/mapping", "/auth/linkedin/portability/callback", "/surveys/33333333-3333-4333-8333-333333333333/participate"])("keeps %s closed", path => {
    const request = new NextRequest(`http://127.0.0.1:3114${path}`, { headers: headers({ authorization: authenticated() }) });
    expect(proxy(request).status).toBe(404);
  });
  it("does not unlock imports or donation writes in production", () => {
    expect(allowDevImport(headers())).toBe(false);
    expect(donationAllowed(new Request("http://127.0.0.1:3114/api/surveys/id/donation", { headers: headers() }))).toBe(false);
    vi.stubEnv("CAREERMAP_DEV_DONATION", "1");
    expect(donationAllowed(new Request("http://127.0.0.1:3114/", { headers: headers() }))).toBe(false);
  });
});
