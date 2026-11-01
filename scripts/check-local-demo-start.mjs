import { assertDemoWorkspace } from "../src/lib/local-demo/build-workspace.ts";
import { assertLocalDemoStartArguments, readLocalDemoConfiguration } from "../src/lib/local-demo/config.ts";
try {
  assertDemoWorkspace(process.cwd(), true);
  assertLocalDemoStartArguments(process.argv.slice(2), readLocalDemoConfiguration());
} catch { console.error("LOCAL_DEMO_START_REJECTED"); process.exitCode = 1; }
