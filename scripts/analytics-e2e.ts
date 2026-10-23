import { randomBytes, randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { setTimeout } from "node:timers/promises";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { minimalCorpus } from "../src/lib/analytics/test-corpus";
import { prepareAnalyticsImport } from "../src/lib/analytics/prepare";
import { importAnalytics } from "../src/lib/analytics/store";
const container = `careermap-analytics-e2e-${randomUUID()}`;
const password = randomBytes(24).toString("hex");
function run(cmd: string, args: string[], env?: NodeJS.ProcessEnv) {
  const result = spawnSync(cmd, args, { env, encoding: "utf8" });
  if (result.status !== 0) throw new Error("ANALYTICS_E2E_COMMAND_FAILED");
  return result.stdout.trim();
}
let child: ReturnType<typeof spawn> | undefined;
let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => { stopping = true; child?.kill("SIGTERM"); });
try {
  run("docker", ["run", "--detach", "--rm", "--name", container, "--publish", "127.0.0.1::5432", "--env", `POSTGRES_PASSWORD=${password}`, "--env", "POSTGRES_USER=careermap_analytics", "--env", "POSTGRES_DB=careermap_analytics_demo", "postgres:17-bookworm"]);
  const binding = run("docker", ["port", container, "5432/tcp"]);
  const url = `postgresql://careermap_analytics:${password}@${binding}/careermap_analytics_demo`;
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    const c = new pg.Client({ connectionString: url, connectionTimeoutMillis: 1000 });
    try { await c.connect(); ready = true; break; } catch { await setTimeout(500); } finally { await c.end(); }
  }
  if (!ready || stopping) throw new Error("ANALYTICS_E2E_DATABASE_UNAVAILABLE");
  const env = { ...process.env, DATABASE_URL: url, CAREERMAP_ANALYTICS_DATABASE_URL: url, CAREERMAP_DEV_ANALYTICS: "1", CAREERMAP_ANALYTICS_E2E: "1", NEXT_TELEMETRY_DISABLED: "1" };
  run(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], env);
  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    const c = minimalCorpus();
    const plan = prepareAnalyticsImport(c.sources, c.expected, "phase-d-v1");
    // Twenty independent newly authored test cases, no local Phase-D dependency.
    plan.profiles = Array.from({ length: 20 }, () => structuredClone(plan.profiles[0]));
    await importAnalytics(client, url, plan);
  } finally { await client.$disconnect(); }
  child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "3107"], { env, stdio: "inherit" });
  process.exitCode = await new Promise<number>(resolve => child!.once("exit", code => resolve(code ?? 0)));
} catch { console.error("ANALYTICS_E2E_SETUP_FAILED"); process.exitCode = 1; }
finally {
  const cleanup = spawnSync("docker", ["rm", "--force", "--volumes", container], { encoding: "utf8" });
  if (cleanup.status !== 0 && !cleanup.stderr?.includes("No such container")) { console.error("ANALYTICS_E2E_CLEANUP_FAILED"); process.exitCode = 1; }
}
