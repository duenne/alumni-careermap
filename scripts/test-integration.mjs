import { randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { setTimeout } from "node:timers/promises";
import pg from "pg";

// A disposable database only: never use DATABASE_URL or an existing volume.
const container = `careermap-integration-${randomUUID()}`;
const password = randomBytes(24).toString("hex");
const database = "careermap_test";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} failed (${result.status}): ${result.stderr ?? ""}`);
  }
  return result.stdout?.trim();
}

try {
  run("docker", [
    "run", "--detach", "--rm", "--name", container,
    "--publish", "127.0.0.1::5432",
    "--env", `POSTGRES_PASSWORD=${password}`,
    "--env", `POSTGRES_DB=${database}`,
    "postgres:17-bookworm",
  ]);
  const binding = run("docker", ["port", container, "5432/tcp"]);
  const connectionString = `postgresql://postgres:${password}@${binding}/${database}`;
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    const client = new pg.Client({ connectionString, connectionTimeoutMillis: 1000 });
    try {
      await client.connect();
      const result = await client.query("SHOW server_version_num");
      if (Math.floor(Number(result.rows[0].server_version_num) / 10000) !== 17) {
        throw new Error("Integration tests require PostgreSQL 17");
      }
      ready = true;
      break;
    } catch {
      await setTimeout(500);
    } finally {
      await client.end();
    }
  }
  if (!ready) throw new Error("PostgreSQL 17 did not become ready");
  const env = { ...process.env, DATABASE_URL: connectionString };
  run(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], { env, stdio: "inherit" });
  run(process.execPath, ["node_modules/prisma/build/index.js", "generate"], { env, stdio: "inherit" });
  run(process.execPath, ["node_modules/vitest/vitest.mjs", "run", "--config", "vitest.integration.config.ts"], { env, stdio: "inherit" });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  const cleanup = spawnSync("docker", ["rm", "--force", "--volumes", container], { encoding: "utf8" });
  if (cleanup.status !== 0 && !cleanup.stderr?.includes("No such container")) {
    console.error("Could not remove disposable integration database:", cleanup.stderr);
    process.exitCode = 1;
  }
}
