import { describe, expect, it } from "vitest";
import { localDemoEnvironment } from "../../../tests/support/local-demo";
import { assertLocalDemoStartArguments, readLocalDemoConfiguration } from "./config";

describe("D1.4b closed production demo configuration", () => {
  it("accepts only an explicit synthetic production installation", () => {
    const result = readLocalDemoConfiguration(localDemoEnvironment());
    expect(result).toMatchObject({ mode: "v5-synthetic", origin: "http://127.0.0.1:3114", installationId: "11111111-1111-4111-8111-111111111111",
      operatorScope: { kind: "INSTITUTION", institutionId: "22222222-2222-4222-8222-222222222222" } });
  });
  it.each(Object.keys(localDemoEnvironment()))("rejects missing required %s", key => {
    const env = localDemoEnvironment(); delete env[key];
    expect(() => readLocalDemoConfiguration(env)).toThrow("INVALID_LOCAL_DEMO_CONFIGURATION");
  });
  it.each([
    ["NODE_ENV", "development"], ["CAREERMAP_LOCAL_DEMO", "1"], ["CAREERMAP_LOCAL_DEMO_PURPOSE", "LIVE"],
    ["CAREERMAP_LOCAL_DEMO_INSTALLATION_ID", "not-a-uuid"], ["CAREERMAP_LOCAL_DEMO_OPERATOR_ID", "not-a-uuid"],
    ["CAREERMAP_LOCAL_DEMO_MSI_PROGRAM_ID", "not-a-uuid"], ["CAREERMAP_LOCAL_DEMO_ORIGIN", "http://localhost:3114"],
    ["CAREERMAP_LOCAL_DEMO_ORIGIN", "http://0.0.0.0:3114"], ["CAREERMAP_LOCAL_DEMO_ORIGIN", "https://example.com"],
    ["CAREERMAP_LOCAL_DEMO_ORIGIN", "http://127.0.0.1:3114/path"], ["CAREERMAP_LOCAL_DEMO_ORIGIN", "http://127.0.0.1"],
    ["CAREERMAP_SURVEY_ADMIN_TOKEN", "short"], ["CAREERMAP_LOCAL_DEMO_OPERATOR_KIND", "ALL"],
  ])("rejects invalid %s (%#)", (key, value) => {
    expect(() => readLocalDemoConfiguration({ ...localDemoEnvironment(), [key]: value })).toThrow("INVALID_LOCAL_DEMO_CONFIGURATION");
  });
  it.each([
    "postgresql://careermap_v5_demo:p@example.com:5435/careermap_v5_demo",
    "postgresql://postgres:p@127.0.0.1:5435/careermap_v5_demo",
    "postgresql://careermap_v5_demo:p@127.0.0.1:5435/careermap_v5_demo_test",
    "postgresql://careermap_v5_demo:p@127.0.0.1:5435/careermap_workflow_test",
    "postgresql://careermap_v5_demo:p@127.0.0.1:5435/careermap_v5_demo?host=other",
  ])("rejects foreign or test database targets (%#)", databaseUrl => {
    expect(() => readLocalDemoConfiguration({ ...localDemoEnvironment(), CAREERMAP_LOCAL_DEMO_DATABASE_URL: databaseUrl })).toThrow("INVALID_LOCAL_DEMO_CONFIGURATION");
  });
  it.each(["DATABASE_URL", "CAREERMAP_MAPPING_DATABASE_URL", "CAREERMAP_DEV_IMPORT", "CAREERMAP_DEV_SURVEYS", "CAREERMAP_DEV_DONATION", "CAREERMAP_DONATION_E2E", "CAREERMAP_SYNTHETIC_DONATION"])("rejects conflicting %s", key => {
    expect(() => readLocalDemoConfiguration({ ...localDemoEnvironment(), [key]: "1" })).toThrow("INVALID_LOCAL_DEMO_CONFIGURATION");
  });
  it("requires a separate password and exact faculty scope", () => {
    const env = localDemoEnvironment();
    const url = new URL(env.CAREERMAP_LOCAL_DEMO_DATABASE_URL!); url.password = env.CAREERMAP_SURVEY_ADMIN_TOKEN!;
    expect(() => readLocalDemoConfiguration({ ...env, CAREERMAP_LOCAL_DEMO_DATABASE_URL: url.href })).toThrow();
    expect(() => readLocalDemoConfiguration({ ...env, CAREERMAP_LOCAL_DEMO_OPERATOR_KIND: "FACULTY" })).toThrow();
    expect(readLocalDemoConfiguration({ ...env, CAREERMAP_LOCAL_DEMO_OPERATOR_KIND: "FACULTY", CAREERMAP_LOCAL_DEMO_OPERATOR_FACULTY: "Synthetic faculty" }).operatorScope).toMatchObject({ kind: "FACULTY", faculty: "Synthetic faculty" });
  });
  it("requires literal, unambiguous loopback CLI bindings even when bypassing the supported starter", () => {
    const config = readLocalDemoConfiguration(localDemoEnvironment());
    expect(() => assertLocalDemoStartArguments(["node", "next", "start", "--hostname", "127.0.0.1", "--port", "3114"], config)).not.toThrow();
    for (const args of [[], ["--hostname", "0.0.0.0", "--port", "3114"], ["--hostname", "127.0.0.1", "--port", "3115"],
      ["--hostname", "127.0.0.1", "--port", "3114", "-H", "0.0.0.0"], ["--hostname", "127.0.0.1", "--hostname", "0.0.0.0", "--port", "3114"]]) {
      expect(() => assertLocalDemoStartArguments(args, config)).toThrow();
    }
  });
});
