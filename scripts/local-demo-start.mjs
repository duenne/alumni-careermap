import { readFileSync, lstatSync } from "node:fs";
import { isAbsolute, relative, resolve, join } from "node:path";
import { spawn } from "node:child_process";
import { demoStartEnvironment, assertDemoWorkspace } from "../src/lib/local-demo/build-workspace.ts";
import { readLocalDemoConfiguration } from "../src/lib/local-demo/config.ts";

// Minimal runtime launcher, not an installation controller. Full private
// configuration is supplied explicitly; never source .env.local or a shell file.
let child;
try {
  const args = process.argv.slice(2);
  if (args.length !== 4 || args[0] !== "--app-dir" || args[2] !== "--config") throw new Error();
  const app = resolve(args[1]), file = resolve(args[3]), rel = relative(app, file);
  const fileStat = lstatSync(file);
  if (!isAbsolute(args[1]) || !isAbsolute(args[3]) || !rel.startsWith("..") || fileStat.isSymbolicLink() || !fileStat.isFile() || (fileStat.mode & 0o077) !== 0) throw new Error();
  const [major, minor, patch] = process.versions.node.split(".").map(Number);
  if (major !== 22 || minor < 23 || minor === 23 && patch < 3) throw new Error();
  assertDemoWorkspace(app, true);
  const env = { ...demoStartEnvironment(JSON.parse(readFileSync(file, "utf8")), process.env), NPM_CONFIG_USERCONFIG: join(app, ".npmrc") };
  const config = readLocalDemoConfiguration(env);
  child = spawn("npm", ["start", "--", "--hostname", "127.0.0.1", "--port", new URL(config.origin).port], { cwd: app, env, stdio: "inherit", detached: false });
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => {
    try { child?.kill(signal); }
    catch { /* Child already exited. npm forwards to its script; never signal the whole group (which includes Next render workers). */ }
  });
  process.exitCode = await new Promise((resolve, reject) => { child.once("exit", code => resolve(code ?? 1)); child.once("error", reject); });
} catch { console.error("LOCAL_DEMO_START_FAILED"); process.exitCode = 1; }
