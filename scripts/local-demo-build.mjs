import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { demoBuildEnvironment, prepareDemoBuild, markDemoBuildComplete } from "../src/lib/local-demo/build-workspace.ts";

// Build isolation only; no database/volume provisioning or seeding.
const source = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const parent = mkdtempSync(join(tmpdir(), "careermap-v5-build-"));
const app = join(parent, "app");
try {
  const [major, minor, patch] = process.versions.node.split(".").map(Number);
  if (major !== 22 || minor < 23 || minor === 23 && patch < 3) throw new Error();
  prepareDemoBuild(source, app);
  const env = { ...demoBuildEnvironment(process.env), NPM_CONFIG_USERCONFIG: join(app, ".npmrc") };
  for (const args of [["ci", "--include=dev", "--no-audit", "--no-fund"], ["run", "build"]]) {
    const result = spawnSync("npm", args, { cwd: app, env, stdio: "inherit" });
    if (result.error || result.status !== 0) throw new Error();
  }
  markDemoBuildComplete(app);
  console.log(`Isolierter V5-Produktionsbuild: ${app}`);
} catch {
  console.error("LOCAL_DEMO_BUILD_FAILED"); process.exitCode = 1;
}
