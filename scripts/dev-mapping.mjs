import { randomBytes, randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { setTimeout } from "node:timers/promises";
import pg from "pg";
import { resolveIntegratedAddress } from "../src/lib/donation/entry-config.ts";

// This runner never uses DATABASE_URL, existing containers or mounted volumes.
const container = `careermap-mapping-${randomUUID()}`;
const database = "careermap_mapping_test";
const password = randomBytes(24).toString("hex");
const institutionId = randomUUID(), programId = randomUUID(), surveyId = randomUUID();
const args = process.argv.slice(2);
const integrated = args.includes("--end-to-end");
const surveyDemo = args.includes("--surveys") || integrated;
const workflowTest = process.env.CAREERMAP_WORKFLOW_E2E === "1";
const address = integrated ? resolveIntegratedAddress(args, process.env) : undefined;
const port = address?.port ?? (surveyDemo ? "3110" : workflowTest ? "3105" : "3104");
const hostname = address?.hostname ?? (surveyDemo || workflowTest ? "127.0.0.1" : "localhost");
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
  if(integrated && (!["127.0.0.1","localhost"].includes(hostname) || !/^[0-9]+$/.test(port) || Number(port)<1024 || Number(port)>65535))throw new Error("Local integrated host and port required");
  if (surveyDemo && (!process.env.CAREERMAP_SURVEY_ADMIN_TOKEN || process.env.CAREERMAP_SURVEY_ADMIN_TOKEN.length < 32)) throw new Error("CAREERMAP_SURVEY_ADMIN_TOKEN mit mindestens 32 Zeichen für den lokalen Betreiberzugang konfigurieren.");
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
  if (surveyDemo) {
    Object.assign(env, { CAREERMAP_DEV_SURVEYS: "1", CAREERMAP_SURVEY_OPERATOR_KIND: "INSTITUTION", CAREERMAP_DEV_IMPORT: "0", CAREERMAP_DEV_MAPPING: "0", CAREERMAP_DEV_WORKFLOW: "0", CAREERMAP_DEV_ANALYTICS: "0" });
    if(integrated) Object.assign(env,{CAREERMAP_DEV_DONATION:"1",CAREERMAP_SYNTHETIC_DONATION:"1",CAREERMAP_MSI_PROGRAM_ID:programId});
    if(integrated && process.env.CAREERMAP_DONATION_E2E==="1") Object.assign(env,{CAREERMAP_DEV_IMPORT_TEST:"1",NODE_OPTIONS:"--import ./tests/support/linkedin-token-mock.mjs",LINKEDIN_CLIENT_ID:"synthetic-client",LINKEDIN_CLIENT_SECRET:"synthetic-secret",LINKEDIN_REDIRECT_URI:`http://${hostname}:${port}/auth/linkedin/portability/callback`,LINKEDIN_PORTABILITY_MODE:"third_party",LINKEDIN_PORTABILITY_SCOPE:"r_dma_portability_3rd_party"});
  } else if (workflowTest) {
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
    await client.query('INSERT INTO "Program" (id, name, "institutionId", faculty) VALUES ($1, $2, $3, $4)', [programId, option("--program", integrated ? "Management Sozialer Innovationen" : "Synthetic Teststudium") , institutionId, surveyDemo ? "Synthetic Survey Faculty" : null]);
    await client.query('INSERT INTO "Survey" (id, name, "referenceProgramId", status) VALUES ($1, $2, $3, $4)', [surveyId, "Lokaler vertikaler Mapping-Test", programId, "OPEN"]);
  } finally { await client.end(); }
  if (stopping) throw new Error("Mapping sandbox stopped");
  console.log(`Lokaler Test: http://${hostname}:${port}/${integrated ? "" : surveyDemo ? "admin/surveys" : workflowTest ? "dev/import" : "dev/mapping"} — separate PostgreSQL-17-Datenbank; Strg+C entfernt Server und Testdaten.`);
  child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", hostname, "--port", port], { env, stdio: "inherit" });
  const code = await new Promise((resolve, reject) => { child.once("exit", resolve); child.once("error", reject); });
  if (!stopping && code) process.exitCode = code;
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally {
  const cleanup = spawnSync("docker", ["rm", "--force", "--volumes", container], { encoding: "utf8" });
  if (cleanup.status !== 0 && !cleanup.stderr?.includes("No such container")) { console.error("Mapping sandbox cleanup failed."); process.exitCode = 1; }
}
