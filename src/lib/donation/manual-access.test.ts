import { afterEach, expect, it, vi } from "vitest";
import { localDemoEnvironment } from "../../../tests/support/local-demo";
import { manualParticipationEnabled } from "./manual-access";
import { readLocalDemoConfiguration } from "../local-demo/config";
const id = "44444444-4444-4444-8444-444444444444";
afterEach(() => vi.unstubAllEnvs());
it("keeps the existing synthetic installation read-only and enables only a deliberately configured participation survey", () => {
  const env = localDemoEnvironment();
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  expect(manualParticipationEnabled(id)).toBe(false);
  vi.stubEnv("CAREERMAP_LOCAL_DEMO", "v5-participation");
  vi.stubEnv("CAREERMAP_LOCAL_DEMO_PURPOSE", "LOCAL_PARTICIPATION");
  vi.stubEnv("CAREERMAP_LOCAL_PARTICIPATION_SURVEY_ID", id);
  expect(readLocalDemoConfiguration().mode).toBe("v5-participation");
  expect(manualParticipationEnabled(id)).toBe(true);
  expect(manualParticipationEnabled("55555555-5555-4555-8555-555555555555")).toBe(false);
  vi.stubEnv("CAREERMAP_DEV_DONATION", "1"); expect(manualParticipationEnabled(id)).toBe(false);
});
it("rejects partial/malformed activation rather than opening the demo implicitly", () => {
  const env = { ...localDemoEnvironment(), CAREERMAP_LOCAL_PARTICIPATION_SURVEY_ID: id };
  expect(() => readLocalDemoConfiguration(env)).toThrow();
  expect(() => readLocalDemoConfiguration({ ...env, CAREERMAP_LOCAL_DEMO: "v5-participation" })).toThrow();
  expect(() => readLocalDemoConfiguration({ ...env, CAREERMAP_LOCAL_DEMO: "v5-participation", CAREERMAP_LOCAL_DEMO_PURPOSE: "LOCAL_PARTICIPATION", CAREERMAP_LOCAL_PARTICIPATION_SURVEY_ID: "invalid" })).toThrow();
});
