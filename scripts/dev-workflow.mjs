import { readFile, writeFile, chmod } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import pg from "pg";
import { prepareWorkflowEnvironment } from "../src/lib/career-import/workflow-config.ts";

function run(command, args, env, quiet = false) {
  const result = spawnSync(command, args, { env, encoding: "utf8", stdio: quiet ? "pipe" : "inherit" });
  if (result.error || result.status !== 0) throw new Error("Workflow setup failed. Check Docker and local configuration.");
}
let child;
let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => { stopping = true; child?.kill("SIGTERM"); });
try {
  const original = await readFile(".env.local", "utf8").catch(error => { if (error.code === "ENOENT") return ""; throw error; });
  const prepared = prepareWorkflowEnvironment(original);
  await writeFile(".env.local", prepared.text, { mode: 0o600 }); await chmod(".env.local", 0o600);
  const env = { ...process.env, ...prepared.values, CAREERMAP_DEV_IMPORT: "1", CAREERMAP_DEV_MAPPING: "1", CAREERMAP_DEV_WORKFLOW: "1", CAREERMAP_WORKFLOW_STORAGE: "PERSISTENT", NEXT_TELEMETRY_DISABLED: "1" };
  run("docker", ["compose", "--env-file", ".env.local", "-f", "compose.workflow.yaml", "up", "-d", "--wait"], env, true);
  const client = new pg.Client({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 3000 });
  await client.connect();
  try {
    const { rows } = await client.query("SHOW server_version_num");
    if (Math.floor(Number(rows[0].server_version_num) / 10000) !== 17) throw new Error("PostgreSQL 17 required");
    run(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], env);
    run(process.execPath, ["node_modules/prisma/build/index.js", "generate"], env);
    await client.query("BEGIN");
    const institutionId = env.CAREERMAP_MAPPING_OPERATOR_ID;
    const institutionName = env.CAREERMAP_WORKFLOW_INSTITUTION || "Synthetic Mapping Institute";
    const programName = env.CAREERMAP_WORKFLOW_PROGRAM || "Synthetic Teststudium";
    await client.query('INSERT INTO "Institution" (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING', [institutionId, institutionName]);
    const configured = await client.query('SELECT name FROM "Institution" WHERE id=$1', [institutionId]);
    if (configured.rows[0]?.name !== institutionName) throw new Error("Configured institution differs from the existing operator catalog");
    const programs = await client.query('SELECT id FROM "Program" WHERE "institutionId"=$1 AND name=$2 AND faculty IS NULL', [institutionId, programName]);
    const programId = programs.rows[0]?.id || randomUUID();
    if (!programs.rowCount) await client.query('INSERT INTO "Program" (id,name,"institutionId") VALUES ($1,$2,$3)', [programId, programName, institutionId]);
    const surveys = await client.query('SELECT id FROM "Survey" WHERE "referenceProgramId"=$1 AND name=$2', [programId, "Lokaler vertikaler Workflow-Test"]);
    if (!surveys.rowCount) await client.query('INSERT INTO "Survey" (id,name,"referenceProgramId",status) VALUES ($1,$2,$3,$4)', [randomUUID(), "Lokaler vertikaler Workflow-Test", programId, "OPEN"]);
    await client.query("COMMIT");
    console.log("PostgreSQL 17 verbunden. Privates Passwort konfiguriert; Daten bleiben im Docker-Volume erhalten.");
  } finally { await client.end(); }
  if (!process.argv.includes("--setup-only") && !stopping) {
    const url = new URL(env.LINKEDIN_REDIRECT_URI || "http://localhost:3100/auth/linkedin/portability/callback");
    if (!["localhost", "127.0.0.1"].includes(url.hostname) || !["http:", "https:"].includes(url.protocol)) throw new Error("Local callback origin required");
    console.log(`Workflow: ${url.origin}/dev/import — Strg+C beendet den Webserver; gespeicherte Testprofile bleiben erhalten.`);
    child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", url.hostname, "--port", url.port || "3100"], { env, stdio: "inherit" });
    const code = await new Promise((resolve, reject) => { child.once("exit", resolve); child.once("error", reject); });
    if (!stopping && code) process.exitCode = code;
  }
} catch { console.error("Workflow konnte nicht gestartet werden. Docker, lokalen Port und .env.local prüfen; Zugangsdaten werden nicht ausgegeben."); process.exitCode = 1; }
