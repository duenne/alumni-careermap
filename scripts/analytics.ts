import { randomBytes } from "node:crypto";
import { readFile, writeFile, chmod } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import { parse } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { validateAnalyticsDatabaseUrl } from "../src/lib/analytics/safety";
import { prepareAnalyticsImport } from "../src/lib/analytics/prepare";
import { importAnalytics, resetAnalytics } from "../src/lib/analytics/store";
import { readAnalytics } from "../src/lib/analytics/read";
import { aggregateCareers } from "../src/lib/analytics/aggregate";

const args = process.argv.slice(2), action = args[0];
const option = (key: string) => { const index = args.indexOf(key); return index >= 0 ? args[index + 1] : undefined; };
const configFile = ".env.analytics.local";
function run(values: string[], env: NodeJS.ProcessEnv) {
  const result = spawnSync(process.execPath, values, { env, encoding: "utf8" });
  if (result.status !== 0 || result.error) throw new Error("ANALYTICS_COMMAND_FAILED");
}
async function main() {
  if (!["setup", "dry-run", "import", "reset", "dev", "report"].includes(action)) throw new Error("USE_setup_dry-run_import_reset_dev_report");
  const original = await readFile(configFile, "utf8").catch(error => { if (error.code === "ENOENT") return ""; throw error; });
  const config = parse(original);
  if (action === "setup" && !config.CAREERMAP_ANALYTICS_DATABASE_URL) {
    if (original.trim()) throw new Error("INCOMPLETE_ANALYTICS_CONFIG");
    const password = randomBytes(32).toString("hex");
    const text = `CAREERMAP_ANALYTICS_PASSWORD=${password}\nCAREERMAP_ANALYTICS_DATABASE_URL=postgresql://careermap_analytics:${password}@127.0.0.1:5434/careermap_analytics_demo\n`;
    await writeFile(configFile, text, { mode: 0o600, flag: "wx" }); await chmod(configFile, 0o600);
    Object.assign(config, parse(text));
  }
  // Explicit --database selects the ONLY URL used; DATABASE_URL is never read.
  const url = validateAnalyticsDatabaseUrl(option("--database") ?? config.CAREERMAP_ANALYTICS_DATABASE_URL);
  const env = { ...process.env, ...config, DATABASE_URL: url, CAREERMAP_ANALYTICS_DATABASE_URL: url };
  if (action === "setup") {
    if (option("--database")) throw new Error("SETUP_USES_DEDICATED_COMPOSE_CONFIG");
    const docker = spawnSync("docker", ["compose", "--env-file", configFile, "-f", "compose.analytics.yaml", "up", "-d", "--wait"], { env, encoding: "utf8" });
    if (docker.status !== 0) throw new Error("ANALYTICS_DOCKER_SETUP_FAILED");
    run(["node_modules/prisma/build/index.js", "migrate", "deploy"], env);
    console.log("Separate PostgreSQL-17-Demo eingerichtet; bestehende Workflow-Datenbank bleibt unberührt."); return;
  }
  if (action === "dev") {
    console.log("Analytics: http://127.0.0.1:3106/dev/analytics · ausschließlich synthetisch, jahresgenau");
    const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "3106"], { env: { ...env, CAREERMAP_DEV_ANALYTICS: "1" }, stdio: "inherit" });
    for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => child.kill("SIGTERM"));
    process.exitCode = await new Promise<number>(resolve => child.once("exit", code => resolve(code ?? 0))); return;
  }
  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, connectionTimeoutMillis: 3000 }) });
  try {
    if (action === "reset") { await resetAnalytics(client, url, option("--confirm-reset") ?? ""); console.log("Ausdrücklich ausgewählte Analytics-Demo geleert; Schema und Volume bleiben erhalten."); return; }
    if (action === "report") {
      const data = await readAnalytics(client, url); const flow = aggregateCareers(data.profiles);
      console.log(JSON.stringify({ ...data.counts, paths: flow.included, partialPaths: flow.partial, completePaths: flow.included - flow.partial, excludedPaths: flow.excluded.length,
        transitionContributions: flow.links.reduce((n, l) => n + l.value, 0),
        unclearRelationStations: flow.paths.reduce((n, p) => n + p.unclearStations, 0), duringStations: flow.paths.reduce((n, p) => n + p.duringStations, 0),
        exclusionReasons: flow.excluded.reduce<Record<string, number>>((counts, e) => { counts[e.reason] = (counts[e.reason] ?? 0) + 1; return counts; }, {}),
      }, null, 2)); return;
    }
    const [source, oracle] = await Promise.all(["all_linkedin_snapshots.json", "all_expected_normalized.json"].map(async name => {
      const text = await readFile(`.local-fixtures/phase-d/${name}`, "utf8"); if (text.length > 2_000_000) throw new Error("FIXTURE_SIZE_LIMIT"); return JSON.parse(text);
    }));
    const plan = prepareAnalyticsImport(source, oracle, option("--test-policy"), args.includes("--declare-demo-anchors"));
    console.log(JSON.stringify(await importAnalytics(client, url, plan, action === "dry-run"), null, 2));
  } finally { await client.$disconnect(); }
}
main().catch(error => {
  // Never print raw errors/causes: drivers and parsers can include credentials or source data.
  const code = error instanceof Error && /^[A-Z][A-Z0-9_-]+$/.test(error.message) ? error.message : "ANALYTICS_FAILED_CHECK_LOCAL_CONFIG_AND_INPUT";
  console.error(code); process.exitCode = 1;
});
