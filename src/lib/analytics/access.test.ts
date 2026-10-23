import { expect, it } from "vitest";
import { allowAnalytics } from "./access";
it("requires development, explicit opt-in, local host and same-origin access", () => {
  const env = { NODE_ENV: "development", CAREERMAP_DEV_ANALYTICS: "1" };
  expect(allowAnalytics(new Headers({ host: "127.0.0.1:3106" }), env)).toBe(true);
  const cases: Record<string, string>[] = [{ host: "example.com" }, { host: "localhost:3106", origin: "https://other.example" }, { host: "localhost:3106", "x-forwarded-for": "198.51.100.1" }];
  for (const headers of cases) expect(allowAnalytics(new Headers(headers), env)).toBe(false);
  expect(allowAnalytics(new Headers({ host: "localhost" }), { ...env, NODE_ENV: "production" })).toBe(false);
  expect(allowAnalytics(new Headers({ host: "localhost" }), { NODE_ENV: "development" })).toBe(false);
});
