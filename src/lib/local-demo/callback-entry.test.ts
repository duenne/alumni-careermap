import { expect, it } from "vitest";
import { participationCallbackDestination } from "./callback-entry";
import { readLocalDemoConfiguration } from "./config";
import { localDemoEnvironment } from "../../../tests/support/local-demo";
const config = readLocalDemoConfiguration({ ...localDemoEnvironment(), CAREERMAP_LOCAL_DEMO: "v5-participation", CAREERMAP_LOCAL_DEMO_PURPOSE: "LOCAL_PARTICIPATION", CAREERMAP_LOCAL_PARTICIPATION_SURVEY_ID: "44444444-4444-4444-8444-444444444444", CAREERMAP_LOCAL_LINKEDIN_CLIENT_ID: "synthetic-client", CAREERMAP_LOCAL_LINKEDIN_CLIENT_SECRET: "synthetic-secret", CAREERMAP_LOCAL_LINKEDIN_REDIRECT_URI: "http://localhost:3100/auth/linkedin/portability/callback" });
const request = (query = "state=participation_v1_random&code=synthetic-code&next=https://foreign.invalid&error_description=PRIVATE_SYNTHETIC", extra = {}, method = "GET") => new Request(`http://localhost:3100/auth/linkedin/portability/callback?${query}`, { method, headers: { host: "localhost:3100", "sec-fetch-site": "cross-site", "sec-fetch-mode": "navigate", "sec-fetch-dest": "document", ...extra } });
it("keeps the registered callback and relays only prefixed attempts to the fixed installation without provider errors or user targets", () => {
  expect(participationCallbackDestination(request(), config)?.href).toBe("http://127.0.0.1:3114/auth/linkedin/portability/callback?state=participation_v1_random&code=synthetic-code");
});
it("leaves legacy traffic untouched and refuses forged hosts, origins, proxy headers, cross-site fetches and duplicate state", () => {
  expect(participationCallbackDestination(request("state=legacy-vertical-prototype"), config)).toBeNull();
  for (const extra of [{ host: "foreign.invalid" }, { origin: "https://foreign.invalid" }, { "x-forwarded-for": "192.0.2.1" }, { forwarded: "for=127.0.0.1" }, { "sec-fetch-mode": "cors" }]) expect(participationCallbackDestination(request(undefined, extra), config)).toBeNull();
  expect(participationCallbackDestination(request("state=participation_v1_a&state=participation_v1_b"), config)).toBeNull();
  expect(participationCallbackDestination(request(undefined, {}, "POST"), config)).toBeNull();
});
