import { spawnSync } from "node:child_process";
import { expect, it } from "vitest";
import { demoStartEnvironment } from "./build-workspace";
import { localDemoEnvironment } from "../../../tests/support/local-demo";

it("rejects direct npm-start wrapper calls before launching Next with an unisolated/public configuration", () => {
  const result = spawnSync(process.execPath, ["scripts/start-next.mjs", "--hostname", "0.0.0.0", "--port", "3114"], {
    env: { ...demoStartEnvironment(localDemoEnvironment(), process.env), NODE_ENV: "production" }, encoding: "utf8",
  });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("LOCAL_DEMO_START_REJECTED");
  expect(result.stdout).not.toMatch(/Starting|Ready|Next\.js/);
});
