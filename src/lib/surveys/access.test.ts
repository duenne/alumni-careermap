import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { surveyAccess, surveyConfiguration } from "./access";

const token = "synthetic-admin-token-at-least-32-characters";
const headers = (extra = {}) => new Headers({ host: "localhost:3110", ...extra });
beforeEach(() => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("CAREERMAP_DEV_SURVEYS", "1");
  vi.stubEnv("CAREERMAP_SURVEY_ADMIN_TOKEN", token);
  vi.stubEnv("CAREERMAP_MAPPING_OPERATOR_ID", "00000000-0000-4000-8000-000000000001");
  vi.stubEnv("CAREERMAP_SURVEY_OPERATOR_KIND", "INSTITUTION");
});
afterEach(() => vi.unstubAllEnvs());
it("requires a local opt-in and a separate operator credential", () => {
  expect(surveyAccess(headers(), true)).toBe(401);
  expect(surveyAccess(headers({ authorization: `Basic ${Buffer.from(`operator:${token}`).toString("base64")}` }), true)).toBe(200);
  expect(surveyAccess(headers({ authorization: "Basic invalid" }), true)).toBe(401);
  expect(surveyAccess(headers(), false)).toBe(200);
  vi.stubEnv("CAREERMAP_SURVEY_ADMIN_TOKEN", "short");
  expect(surveyAccess(headers(), true)).toBe(404);
});
it("fails closed in production, when disabled, and on foreign/proxied requests", () => {
  for (const extra of [{ host: "foreign.invalid" }, { origin: "https://foreign.invalid" }, { "x-forwarded-host": "foreign.invalid" }, { "x-forwarded-for": "192.0.2.5" }, { "sec-fetch-site": "cross-site" }]) {
    expect(surveyAccess(headers(extra), false)).toBe(404);
  }
  vi.stubEnv("CAREERMAP_DEV_SURVEYS", "0");
  expect(surveyAccess(headers(), false)).toBe(404);
  vi.stubEnv("CAREERMAP_DEV_SURVEYS", "1"); vi.stubEnv("NODE_ENV", "production");
  expect(surveyAccess(headers(), false)).toBe(404);
});
it("takes scope only from trusted environment and requires an explicit kind", () => {
  expect(surveyConfiguration().operatorScope.kind).toBe("INSTITUTION");
  vi.stubEnv("CAREERMAP_SURVEY_OPERATOR_KIND", "FACULTY");
  vi.stubEnv("CAREERMAP_SURVEY_OPERATOR_FACULTY", "Synthetic Faculty");
  expect(surveyConfiguration().operatorScope).toMatchObject({ kind: "FACULTY", faculty: "Synthetic Faculty" });
  vi.stubEnv("CAREERMAP_SURVEY_OPERATOR_KIND", "");
  expect(() => surveyConfiguration()).toThrow();
});
it("allows a public invitation document from an external link while keeping admin and API fetch gates strict", () => {
  const navigation = { "sec-fetch-site": "cross-site", "sec-fetch-mode": "navigate", "sec-fetch-dest": "document" };
  expect(surveyAccess(headers(navigation), false)).toBe(200);
  expect(surveyAccess(headers(navigation), true)).toBe(404);
  expect(surveyAccess(headers({ ...navigation, origin: "https://foreign.invalid" }), false)).toBe(404);
  expect(surveyAccess(headers({ "sec-fetch-site": "cross-site", "sec-fetch-mode": "cors", "sec-fetch-dest": "empty" }), false)).toBe(404);
});
