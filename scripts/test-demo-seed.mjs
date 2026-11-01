import { randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { setTimeout } from "node:timers/promises";
import pg from "pg";

// Always a NEW, disposable, loopback-only database. Never use ambient DB URLs,
// existing containers or volumes. Existing versioned migrations only.
const container = `careermap-v5-seed-test-${randomUUID()}`;
const password = randomBytes(24).toString("hex");
const database = "careermap_v5_demo_test";
const role = "careermap_v5_demo";
let created = false;
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", ...options });
  if (result.error || result.status !== 0) throw new Error("Demo seed test subprocess failed");
  return result.stdout?.trim();
}
try {
  run("docker", ["run", "--detach", "--rm", "--name", container, "--publish", "127.0.0.1::5432", "--env", `POSTGRES_USER=${role}`,
    "--env", `POSTGRES_PASSWORD=${password}`, "--env", `POSTGRES_DB=${database}`, "postgres:17-bookworm"]);
  created = true;
  const binding = run("docker", ["port", container, "5432/tcp"]);
  const connectionString = `postgresql://${role}:${password}@${binding}/${database}`;
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    const client = new pg.Client({ connectionString, connectionTimeoutMillis: 1000 });
    try {
      await client.connect();
      const result = await client.query("SHOW server_version_num");
      if (Math.floor(Number(result.rows[0].server_version_num) / 10000) !== 17) throw new Error();
      ready = true; break;
    } catch { await setTimeout(500); }
    finally { await client.end(); }
  }
  if (!ready) throw new Error("New PostgreSQL 17 test container unavailable");
  const env = { ...process.env, DATABASE_URL: connectionString, CAREERMAP_V5_DEMO_TEST_URL: connectionString,
    ...(process.argv.includes("--corpus") ? { CAREERMAP_PHASE_D_FIXTURES: "1" } : {}) };
  run(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], { env, stdio: "inherit" });
  run(process.execPath, ["node_modules/prisma/build/index.js", "generate"], { env, stdio: "inherit" });
  run(process.execPath, ["node_modules/vitest/vitest.mjs", "run", "--config", "vitest.demo-seed.config.ts"], { env, stdio: "inherit" });
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally {
  if (created) {
    const cleanup = spawnSync("docker", ["rm", "--force", "--volumes", container], { encoding: "utf8" });
    if (cleanup.status !== 0) { console.error("Disposable demo seed test container cleanup failed"); process.exitCode = 1; }
  }
}
