import { randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { setTimeout } from "node:timers/promises";
import pg from "pg";

// Disposable verification only: no Compose, existing URL, volume or install
// controller. Administrative credentials never enter the application config.
const container = `careermap-v5-mode-test-${randomUUID()}`, adminPassword = randomBytes(24).toString("hex"), rolePassword = randomBytes(24).toString("hex");
let created = false;
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", ...options });
  if (result.error || result.status !== 0) throw new Error("LOCAL_DEMO_TEST_COMMAND_FAILED");
  return result.stdout?.trim();
}
try {
  run("docker", ["run", "--detach", "--rm", "--name", container, "--publish", "127.0.0.1::5432", "--env", "POSTGRES_DB=careermap_v5_demo",
    "--env", "POSTGRES_USER=careermap_v5_mode_test_admin", "--env", `POSTGRES_PASSWORD=${adminPassword}`, "postgres:17-bookworm"]);
  created = true;
  const binding = run("docker", ["port", container, "5432/tcp"]);
  const adminUrl = `postgresql://careermap_v5_mode_test_admin:${adminPassword}@${binding}/careermap_v5_demo`;
  const databaseUrl = `postgresql://careermap_v5_demo:${rolePassword}@${binding}/careermap_v5_demo`;
  let ready = false;
  for (let i = 0; i < 60; i++) {
    const client = new pg.Client({ connectionString: adminUrl, connectionTimeoutMillis: 1000 });
    try { await client.connect(); const result = await client.query("SHOW server_version_num"); if (Math.floor(Number(result.rows[0].server_version_num) / 10000) !== 17) throw new Error(); ready = true; break; }
    catch { await setTimeout(500); } finally { await client.end(); }
  }
  if (!ready) throw new Error("LOCAL_DEMO_TEST_PG17_UNAVAILABLE");
  const migrationEnv = { ...process.env, DATABASE_URL: adminUrl };
  run(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], { env: migrationEnv, stdio: "inherit" });
  run(process.execPath, ["node_modules/prisma/build/index.js", "generate"], { env: migrationEnv, stdio: "inherit" });
  const client = new pg.Client({ connectionString: adminUrl });
  try {
    await client.connect();
    const { rows } = await client.query("SELECT format('CREATE ROLE careermap_v5_demo LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L', $1::text) AS statement", [rolePassword]);
    await client.query(rows[0].statement);
    await client.query("REVOKE CREATE ON SCHEMA public FROM PUBLIC");
    await client.query("GRANT CONNECT ON DATABASE careermap_v5_demo TO careermap_v5_demo");
    await client.query("GRANT USAGE ON SCHEMA public TO careermap_v5_demo");
    await client.query('GRANT SELECT, INSERT, UPDATE, DELETE ON "Institution", "Program", "Survey", "Alumni", "Degree", "CareerStep", "Organisation", "AlumniTimelineItem", "SurveyResponse", "AlumniContact" TO careermap_v5_demo');
  } finally { await client.end(); }
  run(process.execPath, ["node_modules/vitest/vitest.mjs", "run", "--config", "vitest.local-demo.config.ts"], {
    env: { ...process.env, LOCAL_DEMO_TEST_ADMIN_URL: adminUrl, LOCAL_DEMO_TEST_DATABASE_URL: databaseUrl }, stdio: "inherit",
  });
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally {
  if (created && spawnSync("docker", ["rm", "--force", "--volumes", container], { encoding: "utf8" }).status !== 0) {
    console.error("LOCAL_DEMO_TEST_CLEANUP_FAILED"); process.exitCode = 1;
  }
}
