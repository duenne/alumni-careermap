import { expect, it } from "vitest";
import { callbackOrigin, integratedJourneyEnabled, journeyOrigin, resolveIntegratedAddress } from "./entry-config";

it("uses the registered fixed local callback origin for the unified journey and startup", () => {
  const env = { NODE_ENV: "development", CAREERMAP_DEV_SURVEYS: "1", CAREERMAP_DEV_DONATION: "1", LINKEDIN_REDIRECT_URI: "http://localhost:3100/auth/linkedin/portability/callback" };
  expect(integratedJourneyEnabled(env)).toBe(true);
  expect(journeyOrigin(env)).toBe("http://localhost:3100");
  expect(resolveIntegratedAddress([], env)).toEqual({ hostname: "localhost", port: "3100" });
  expect(resolveIntegratedAddress(["--host", "127.0.0.1", "--port", "3112"], env)).toEqual({ hostname: "127.0.0.1", port: "3112" });
  expect(journeyOrigin({ ...env, NODE_ENV: "production" })).toBeUndefined();
  expect(journeyOrigin({ ...env, CAREERMAP_DEV_DONATION: "0" })).toBeUndefined();
});

it("rejects remote, credential-bearing and survey-specific redirects without changing domain semantics", () => {
  for (const value of [undefined, "https://external.invalid/auth/linkedin/portability/callback", "http://user:secret@localhost:3100/auth/linkedin/portability/callback", "http://localhost:3100/surveys/00000000-0000-4000-8000-000000000001/participate", "http://localhost:3100/auth/linkedin/portability/callback?next=external", "http://localhost:3100/auth/linkedin/portability/callback#fragment"]) {
    expect(callbackOrigin(value)).toBeUndefined();
  }
  expect(resolveIntegratedAddress([], {})).toEqual({ hostname: "localhost", port: "3100" });
  expect(() => resolveIntegratedAddress(["--host", "external.invalid"], {})).toThrow();
  expect(() => resolveIntegratedAddress(["--port", "80"], {})).toThrow();
});
