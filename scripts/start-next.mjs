import { createRequire } from "node:module";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Normal npm start still delegates to the installed Next production CLI.
// For local demo, validate BEFORE Next can bind a socket. No TS loader is
// required for normal production; isolated demo builds include their dev tools.
try {
  const args = process.argv.slice(2);
  if (process.env.CAREERMAP_LOCAL_DEMO !== undefined) {
    const result = spawnSync(process.execPath, ["--import", "tsx", fileURLToPath(new URL("./check-local-demo-start.mjs", import.meta.url)), ...args], { stdio: "inherit" });
    if (result.error || result.status !== 0) throw new Error();
  }
  const next = createRequire(import.meta.url).resolve("next/dist/bin/next");
  const child = spawn(process.execPath, [next, "start", ...args], { stdio: "inherit" });
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => { try { child.kill(signal); } catch { /* already stopped */ } });
  process.exitCode = await new Promise((resolve, reject) => { child.once("exit", code => resolve(code ?? 1)); child.once("error", reject); });
} catch { console.error("NEXT_START_REJECTED"); process.exitCode = 1; }
