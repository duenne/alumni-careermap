import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";
import { LocalDemoOperations } from "../src/lib/local-demo/operations.ts";
import { loadInstallation, runtimeConfiguration } from "../src/lib/local-demo/installation.ts";
import { assertDemoWorkspace, demoBuildEnvironment, demoStartEnvironment } from "../src/lib/local-demo/build-workspace.ts";

// Explicit acceptance operation: creates B via the UI once, then exercises
// idempotence and restarts of this installation. Never removes its volume.
const source = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ops = new LocalDemoOperations(source);
const { installation: i, secrets } = loadInstallation(ops.root);
const cfg = runtimeConfiguration(i, secrets), origin = cfg.CAREERMAP_LOCAL_DEMO_ORIGIN;
const artifact = join(source, "artifacts/v5");
mkdirSync(artifact, { recursive: true, mode: 0o700 });
const receipt = { checkedAt: new Date().toISOString(), stages: [] };
const browser = await chromium.launch({ headless: true, timeout: 20000 });
const auth = { username: "operator", password: cfg.CAREERMAP_SURVEY_ADMIN_TOKEN };
let baseline;
function save() { writeFileSync(join(artifact, "acceptance.json"), JSON.stringify(receipt, null, 2), { mode: 0o600 }); }
async function overview(screenshot) {
  const context = await browser.newContext({ httpCredentials: auth, viewport: { width: 1440, height: 1100 } });
  try {
    const page = await context.newPage();
    assert.equal((await page.goto(`${origin}/admin/surveys`)).status(), 200);
    const a = page.getByRole("article", { name: "SYNTHETISCH / DEMO – Alumni MSI", exact: true });
    const b = page.getByRole("article", { name: "SYNTHETISCH / DEMO – Master Informatik", exact: true });
    await expect(a.getByText("Status: Geschlossen (CLOSED)", { exact: true })).toBeVisible();
    await expect(a.getByText("Antworten: 100", { exact: true })).toBeVisible();
    await expect(b.getByText("Status: Entwurf (DRAFT)", { exact: true })).toBeVisible();
    await expect(b.getByText("Antworten: 0", { exact: true })).toBeVisible();
    await expect(b.getByText(/Master Informatik/).first()).toBeVisible();
    if (screenshot) await page.screenshot({ path: join(artifact, screenshot), fullPage: true });
  } finally { await context.close(); }
}
async function checkStage(name) {
  const actual = await ops.verify();
  if (baseline) assert.equal(actual.dataSha256, baseline.dataSha256, `${name}: canonical data changed`);
  else baseline = actual;
  await overview();
  receipt.stages.push({ name, ...actual }); save();
  console.log(`${name}: A CLOSED/100, B DRAFT/0, data ${actual.dataSha256}`);
}
try {
  const app = join(ops.root, i.buildPath); assertDemoWorkspace(app, true);
  const temporary = mkdtempSync(join(tmpdir(), "careermap-negative-start-"));
  try {
    const invalid = [
      { ...cfg, CAREERMAP_LOCAL_DEMO: undefined }, { ...cfg, CAREERMAP_LOCAL_DEMO: "development" },
      { ...cfg, NODE_ENV: "development" }, { ...cfg, CAREERMAP_LOCAL_DEMO_ORIGIN: "http://example.invalid:3114" },
      { ...cfg, CAREERMAP_LOCAL_DEMO_DATABASE_URL: "postgresql://careermap_v5_demo:synthetic@example.invalid:5435/careermap_v5_demo" },
      { ...cfg, DATABASE_URL: "postgresql://example.invalid/foreign" },
    ];
    for (const [n, config] of invalid.entries()) {
      const path = join(temporary, `${n}.json`); writeFileSync(path, JSON.stringify(config), { mode: 0o600 });
      const rejected = spawnSync(process.execPath, ["--import", "tsx", join(source, "scripts/local-demo-start.mjs"), "--app-dir", app, "--config", path],
        { env: demoBuildEnvironment(process.env), encoding: "utf8", timeout: 10000 });
      assert.equal(rejected.status, 1); assert.match(rejected.stderr, /LOCAL_DEMO_START_FAILED/);
      assert.doesNotMatch(rejected.stdout, /Ready|Next\.js/);
    }
    const publicBinding = spawnSync(process.execPath, ["scripts/start-next.mjs", "--hostname", "0.0.0.0", "--port", "3114"],
      { cwd: app, env: demoStartEnvironment(cfg, process.env), encoding: "utf8", timeout: 10000 });
    assert.equal(publicBinding.status, 1); assert.match(publicBinding.stderr, /LOCAL_DEMO_START_REJECTED/);
    receipt.rejectedStarts = { invalidConfigurations: invalid.length, publicBinding: true };
  } finally { rmSync(temporary, { recursive: true }); }
  let chunks = 0;
  function scan(path) {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const file = join(path, entry.name); assert.equal(entry.isSymbolicLink(), false);
      if (entry.isDirectory()) scan(file);
      else {
        chunks++; const bytes = readFileSync(file);
        for (const forbidden of [...Object.values(secrets), "DO_NOT_COPY_D14C_20261101"]) assert.equal(bytes.includes(Buffer.from(forbidden)), false, "Build contains a forbidden value");
      }
    }
  }
  scan(join(app, ".next/static"));
  assert.equal(readdirSync(app).filter(name => name.startsWith(".env")).length, 0);
  receipt.buildIsolation = { browserFilesScanned: chunks, secretsAndInheritedCanaryAbsent: true, environmentFilesAbsent: true };
  console.log("build isolation and negative starts: PASS");
  console.log("access: anonymous");
  const anonymous = await browser.newContext();
  assert.equal((await anonymous.request.get(`${origin}/admin/surveys`)).status(), 401);
  assert.equal((await anonymous.request.get(`${origin}/api/admin/surveys`)).status(), 401);
  assert.equal((await anonymous.request.get(`${origin}/api/admin/surveys/${i.surveyAId}/analytics`)).status(), 401);
  console.log("access: closed invitation");
  const closed = await anonymous.newPage();
  await closed.goto(`${origin}/surveys/${i.surveyAId}`);
  await expect(closed.getByRole("heading", { name: "Diese Befragung ist geschlossen", exact: true })).toBeVisible();
  await anonymous.close();

  console.log("access: wrong password");
  const wrong = await browser.newContext({ httpCredentials: { username: "operator", password: "synthetic-wrong-password" } });
  assert.equal((await wrong.request.get(`${origin}/api/admin/surveys`)).status(), 401);
  await wrong.close();

  console.log("access: operator and foreign headers");
  const operator = await browser.newContext({ httpCredentials: auth });
  try {
    for (const headers of [{ Origin: "http://example.invalid" }, { Host: "example.invalid" }, { "X-Forwarded-Host": "example.invalid" }, { "X-Forwarded-For": "192.0.2.1" }]) {
      assert.equal((await operator.request.get(`${origin}/api/admin/surveys`, { headers, timeout: 10000 })).status(), 404);
    }
    for (const path of ["/api/dev/import/fixture", "/api/dev/import/mapping", "/api/donation/linkedin/start", `/api/surveys/${i.surveyAId}/donation`]) {
      assert.equal((await operator.request.post(origin + path, { data: {}, headers: { Origin: origin } })).status(), 404);
    }
    console.log("access: UI creation");
    const page = await operator.newPage();
    await page.goto(`${origin}/admin/surveys`);
    await expect(page.getByRole("heading", { name: "Vorhandene Befragungen" })).toBeVisible();
    if (!i.surveyBId) {
      await page.getByRole("button", { name: "Neu anlegen", exact: true }).click();
      // Existing catalog entries are inspected before creating anything.
      const administration = await (await operator.request.get(`${origin}/api/admin/surveys`)).json();
      assert.equal(administration.surveys.length, 1, "Unrecorded survey exists; inspect instead of duplicating B");
      const existing = administration.institutions[0].programs.find(p => p.name === "Master Informatik");
      if (!existing) {
        await page.getByLabel("Name des neuen Studiengangs", { exact: true }).fill("Master Informatik");
        const response = page.waitForResponse(r => r.url() === `${origin}/api/admin/surveys` && r.request().method() === "POST");
        await page.getByRole("button", { name: "Studiengang hinzufügen", exact: true }).click();
        assert.equal((await response).status(), 201);
        await expect(page.getByRole("button", { name: "Studiengang hinzufügen", exact: true })).toBeDisabled();
      }
      await page.getByLabel("Hochschule", { exact: true }).selectOption(i.operatorId);
      await page.getByLabel("Studiengang", { exact: true }).selectOption({ label: "Master Informatik" });
      await page.getByLabel("Name der Befragung", { exact: true }).fill("SYNTHETISCH / DEMO – Master Informatik");
      const response = page.waitForResponse(r => r.url() === `${origin}/api/admin/surveys` && r.request().method() === "POST");
      await page.getByRole("button", { name: "Als Entwurf anlegen", exact: true }).click();
      const created = await response; assert.equal(created.status(), 201);
      await expect(page.getByRole("article", { name: "SYNTHETISCH / DEMO – Master Informatik", exact: true })).toBeVisible();
      const refreshed = await (await operator.request.get(`${origin}/api/admin/surveys`, { timeout: 10000 })).json();
      const survey = refreshed.surveys.find(s => s.name === "SYNTHETISCH / DEMO – Master Informatik");
      assert.ok(survey, "Created B must be visible in the guarded administration query");
      await ops.recordB(survey.id);
      console.log("survey B created via UI");
    }
    const recorded = loadInstallation(ops.root).installation;
    const analytics = await operator.request.get(`${origin}/api/admin/surveys/${i.surveyAId}/analytics`, { timeout: 15000 });
    assert.equal(analytics.status(), 200);
    const analysis = await analytics.json(); assert.equal(analysis.supported, true); assert.equal(analysis.responses, 100);
    await page.goto(`${origin}/admin/surveys/${i.surveyAId}/analytics`);
    await expect(page.getByText(/100 bestätigte Antworten/)).toBeVisible();
    await page.screenshot({ path: join(artifact, "survey-a-analytics.png"), fullPage: true });
    await page.goto(`${origin}/admin/surveys/${recorded.surveyBId}/analytics`);
    await expect(page.getByText(/Für diesen Studiengang ist sie nicht freigegeben/)).toBeVisible();
    assert.equal((await operator.request.get(`${origin}/surveys/${recorded.surveyBId}`)).status(), 404);
    receipt.access = { anonymous: 401, wrongPassword: 401, foreignHeaders: 404, developmentAndParticipationWrites: 404, closedInvitation: true, surveyBCheckedInUI: true };
  } finally { await operator.close(); }

  await checkStage("initial");
  const repeated = await ops.seed(true); assert.equal(repeated.outcome, "UNCHANGED");
  await checkStage("idempotent-seed");
  await ops.stop(); await ops.start(); await checkStage("server-restart");
  await ops.dbRestart(); await checkStage("postgres-restart");
  await ops.dbRestart(true); await checkStage("container-recreated-same-volume");
  await ops.stop(); await ops.dbStop(); await ops.dbUp(); await ops.start();
  await checkStage("cold-stop-start");
  await ops.dbStop();
  const unavailable = await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(15000) });
  assert.equal(unavailable.status, 503);
  const unavailableBody = await unavailable.text();
  for (const secret of Object.values(secrets)) assert.ok(!unavailableBody.includes(secret));
  receipt.databaseUnavailableHealth = 503;
  await ops.dbUp(); await checkStage("database-recovered");
  await overview("operator-surveys.png");
  receipt.result = "PASS"; save();
} catch (error) {
  receipt.result = "FAIL"; save(); throw error;
} finally { await browser.close(); }
