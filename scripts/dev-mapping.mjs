import { randomBytes, randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { setTimeout } from "node:timers/promises";
import pg from "pg";

// This runner never uses DATABASE_URL, existing containers or mounted volumes.
const container = `careermap-mapping-${randomUUID()}`;
const database = "careermap_mapping_test";
const password = randomBytes(24).toString("hex");
const institutionId = randomUUID(), programId = randomUUID(), surveyId = randomUUID();
const args = process.argv.slice(2);
const workflowTest = process.env.CAREERMAP_WORKFLOW_E2E === "1";
const port = workflowTest ? "3105" : "3104";
const hostname = workflowTest ? "127.0.0.1" : "localhost";
function option(name, fallback) { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1] || fallback; }
function run(command, values, options = {}) {
  const result = spawnSync(command, values, { encoding: "utf8", ...options });
  if (result.error || result.status !== 0) throw new Error("Mapping sandbox command failed. Check Docker and Node 22.");
  return result.stdout?.trim();
}
let child;
let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => { stopping = true; child?.kill("SIGTERM"); });
try {
  run("docker", ["run", "--detach", "--rm", "--name", container, "--publish", "127.0.0.1::5432", "--env", `POSTGRES_PASSWORD=${password}`, "--env", `POSTGRES_DB=${database}`, "postgres:17-bookworm"]);
  const binding = run("docker", ["port", container, "5432/tcp"]);
  const connectionString = `postgresql://postgres:${password}@${binding}/${database}`;
  let ready = false;
  for (let i = 0; i < 60 && !stopping; i++) {
    const client = new pg.Client({ connectionString, connectionTimeoutMillis: 1000 });
    try { await client.connect(); const { rows } = await client.query("SHOW server_version_num"); if (Math.floor(Number(rows[0].server_version_num) / 10000) !== 17) throw new Error(); ready = true; break; }
    catch { await setTimeout(500); }
    finally { await client.end(); }
  }
  if (!ready || stopping) throw new Error("Mapping PostgreSQL 17 unavailable");
  const env = { ...process.env, DATABASE_URL: connectionString, CAREERMAP_MAPPING_DATABASE_URL: connectionString, CAREERMAP_MAPPING_OPERATOR_ID: institutionId, CAREERMAP_DEV_IMPORT: "1", CAREERMAP_DEV_MAPPING: "1", NEXT_TELEMETRY_DISABLED: "1" };
  if (workflowTest) {
    Object.assign(env, { CAREERMAP_DEV_WORKFLOW: "1", CAREERMAP_DEV_IMPORT_TEST: "1", CAREERMAP_WORKFLOW_STORAGE: "TEMPORARY", NODE_OPTIONS: "--import ./tests/support/linkedin-token-mock.mjs", LINKEDIN_CLIENT_ID: "synthetic-client", LINKEDIN_CLIENT_SECRET: "synthetic-secret", LINKEDIN_REDIRECT_URI: `http://${hostname}:${port}/auth/linkedin/portability/callback`, LINKEDIN_PORTABILITY_MODE: "third_party", LINKEDIN_PORTABILITY_SCOPE: "r_dma_portability_3rd_party" });
  } else if (process.env.CAREERMAP_MAPPING_E2E === "1") {
    for (const key of ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET", "LINKEDIN_REDIRECT_URI", "LINKEDIN_PORTABILITY_MODE", "LINKEDIN_PORTABILITY_SCOPE"]) env[key] = "";
  }
  run(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], { env, stdio: "inherit" });
  run(process.execPath, ["node_modules/prisma/build/index.js", "generate"], { env, stdio: "inherit" });
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
    await client.query('INSERT INTO "Institution" (id, name) VALUES ($1, $2)', [institutionId, option("--institution", "Synthetic Mapping Institute")]);
    await client.query('INSERT INTO "Program" (id, name, "institutionId") VALUES ($1, $2, $3)', [programId, option("--program", "Synthetic Teststudium") , institutionId]);
    await client.query('INSERT INTO "Survey" (id, name, "referenceProgramId", status) VALUES ($1, $2, $3, $4)', [surveyId, "Lokaler vertikaler Mapping-Test", programId, "OPEN"]);
  } finally { await client.end(); }
  if (stopping) throw new Error("Mapping sandbox stopped");
  console.log(`Mapping-Test: http://${hostname}:${port}/${workflowTest ? "dev/import" : "dev/mapping"} — separate PostgreSQL-17-Datenbank; Strg+C entfernt Server und Testdaten.`);
  child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", hostname, "--port", port], { env, stdio: "inherit" });
  const code = await new Promise((resolve, reject) => { child.once("exit", resolve); child.once("error", reject); });
  if (!stopping && code) process.exitCode = code;
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally {
  const cleanup = spawnSync("docker", ["rm", "--force", "--volumes", container], { encoding: "utf8" });
  if (cleanup.status !== 0 && !cleanup.stderr?.includes("No such container")) { console.error("Mapping sandbox cleanup failed."); process.exitCode = 1; }
}
