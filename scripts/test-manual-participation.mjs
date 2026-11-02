import { randomBytes, randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import pg from "pg";
import { chromium, expect } from "@playwright/test";
import { createLocalCallbackEntry } from "../src/lib/local-demo/callback-entry.ts";
import { readLocalDemoConfiguration } from "../src/lib/local-demo/config.ts";

// End-to-end check against an existing isolated production build. All catalog,
// career and survey records are synthetic and live in a NEW disposable PG17
// container. Never read runtime secrets or connect to the user's installation.
const source = process.cwd();
const installation = JSON.parse(readFileSync(join(source, ".local-demo/v5/installation.json"), "utf8"));
const testLinkedIn = process.argv.includes("--linkedin");
const app = resolve(source, process.argv.slice(2).find(arg => !arg.startsWith("--")) ?? `.local-demo/v5/${installation.buildPath}`);
const container = `careermap-manual-test-${randomUUID()}`;
const adminPassword = randomBytes(24).toString("hex"), rolePassword = randomBytes(24).toString("hex");
const ids = Object.fromEntries(["installation", "institution", "msi", "master", "open", "closed"].map(key => [key, randomUUID()]));
let created = false, child, browser, database, currentPage, closeCallbackEntry;
let serverLog = "";
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", ...options });
  if (result.error || result.status !== 0) throw new Error("MANUAL_TEST_COMMAND_FAILED");
  return result.stdout?.trim();
}
async function freePort() {
  const server = createServer();
  await new Promise((done, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", done); });
  const port = server.address().port; await new Promise(done => server.close(done)); return port;
}
try {
  run("docker", ["run", "--detach", "--rm", "--name", container, "--publish", "127.0.0.1::5432", "--env", "POSTGRES_DB=careermap_v5_demo", "--env", `POSTGRES_PASSWORD=${adminPassword}`, "postgres:17-bookworm"]);
  created = true;
  const binding = run("docker", ["port", container, "5432/tcp"]);
  const adminUrl = `postgresql://postgres:${adminPassword}@${binding}/careermap_v5_demo`;
  let ready = false;
  for (let n = 0; n < 60; n++) {
    const client = new pg.Client({ connectionString: adminUrl, connectionTimeoutMillis: 1000 });
    try { await client.connect(); const r = await client.query("SHOW server_version_num"); expect(Math.floor(Number(r.rows[0].server_version_num) / 10000)).toBe(17); ready = true; break; }
    catch { await delay(500); } finally { await client.end(); }
  }
  if (!ready) throw new Error("MANUAL_TEST_PG_UNAVAILABLE");
  run(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], { env: { ...process.env, DATABASE_URL: adminUrl }, stdio: "inherit" });
  database = new pg.Client({ connectionString: adminUrl }); await database.connect();
  const role = await database.query("SELECT format('CREATE ROLE careermap_v5_demo LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L', $1::text) AS statement", [rolePassword]);
  await database.query(role.rows[0].statement);
  await database.query("REVOKE CREATE ON SCHEMA public FROM PUBLIC");
  await database.query("GRANT CONNECT ON DATABASE careermap_v5_demo TO careermap_v5_demo");
  await database.query("GRANT USAGE ON SCHEMA public TO careermap_v5_demo");
  await database.query('GRANT SELECT, INSERT, UPDATE, DELETE ON "Institution", "Program", "Survey", "Alumni", "Degree", "CareerStep", "Organisation", "AlumniTimelineItem", "SurveyResponse", "AlumniContact" TO careermap_v5_demo');
  await database.query('INSERT INTO "Institution" (id, name) VALUES ($1, $2)', [ids.institution, `SYNTHETISCH / DEMO – V5 ${ids.installation}`]);
  await database.query('INSERT INTO "Program" (id, name, "institutionId") VALUES ($1, $2, $3), ($4, $5, $3)', [ids.msi, "Management Sozialer Innovationen", ids.institution, ids.master, "Master Informatik"]);
  await database.query('INSERT INTO "Survey" (id, name, "referenceProgramId", status) VALUES ($1, $2, $3, \'OPEN\'), ($4, $5, $6, \'CLOSED\')', [ids.open, "Synthetischer Master-Test", ids.master, ids.closed, "Synthetischer geschlossener MSI-Test", ids.msi]);
  const port = await freePort(), origin = `http://127.0.0.1:${port}`;
  let redirectUri;
  if (testLinkedIn) {
    redirectUri = `http://localhost:${await freePort()}/auth/linkedin/portability/callback`;
  }
  const temporary = mkdtempSync(join(tmpdir(), "careermap-manual-e2e-")), configFile = join(temporary, "runtime.json");
  const runtime = { NODE_ENV: "production", CAREERMAP_LOCAL_DEMO: "v5-participation", CAREERMAP_LOCAL_DEMO_PURPOSE: "LOCAL_PARTICIPATION",
    CAREERMAP_LOCAL_PARTICIPATION_SURVEY_ID: ids.open, CAREERMAP_LOCAL_DEMO_INSTALLATION_ID: ids.installation, CAREERMAP_LOCAL_DEMO_OPERATOR_ID: ids.institution,
    CAREERMAP_LOCAL_DEMO_MSI_PROGRAM_ID: ids.msi, CAREERMAP_LOCAL_DEMO_OPERATOR_KIND: "INSTITUTION", CAREERMAP_LOCAL_DEMO_ORIGIN: origin,
    CAREERMAP_LOCAL_DEMO_DATABASE_URL: `postgresql://careermap_v5_demo:${rolePassword}@${binding}/careermap_v5_demo`, CAREERMAP_SURVEY_ADMIN_TOKEN: randomBytes(32).toString("hex"),
    ...(testLinkedIn ? { CAREERMAP_LOCAL_LINKEDIN_CLIENT_ID: "synthetic-client", CAREERMAP_LOCAL_LINKEDIN_CLIENT_SECRET: "synthetic-secret", CAREERMAP_LOCAL_LINKEDIN_REDIRECT_URI: redirectUri } : {}) };
  writeFileSync(configFile, JSON.stringify(runtime), { mode: 0o600 });
  if (testLinkedIn) closeCallbackEntry = await createLocalCallbackEntry(readLocalDemoConfiguration(runtime));
  child = testLinkedIn
    ? spawn(process.execPath, ["--import", join(source, "tests/support/participation-linkedin-mock.mjs"), join(app, "node_modules/next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", String(port)], {
      cwd: app, env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, NEXT_TELEMETRY_DISABLED: "1", ...runtime }, stdio: ["ignore", "pipe", "pipe"],
    })
    : spawn(process.execPath, ["--import", "tsx", "scripts/local-demo-start.mjs", "--app-dir", app, "--config", configFile], { cwd: source, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.on("data", chunk => { serverLog += chunk; }); child.stderr.on("data", chunk => { serverLog += chunk; });
  ready = false;
  for (let n = 0; n < 120; n++) {
    if (child.exitCode !== null) throw new Error(`MANUAL_TEST_APP_EXITED: ${serverLog}`);
    try { if ((await fetch(`${origin}/api/health`)).ok) { ready = true; break; } } catch { /* Startup. */ }
    await delay(250);
  }
  if (!ready) throw new Error("MANUAL_TEST_APP_NOT_READY");
  browser = await chromium.launch({ headless: true });
  const artifacts = join(source, "artifacts/manual-participation"); mkdirSync(artifacts, { recursive: true });
  for (const [index, width] of [1280, 375].entries()) {
    const context = await browser.newContext({ viewport: { width, height: 900 } }), page = await context.newPage();
    currentPage = page;
    const errors = []; page.on("pageerror", error => errors.push(error.message));
    await page.goto(`${origin}/surveys/${ids.open}`);
    await expect(page.getByRole("heading", { name: "Dein Weg nach dem Studium", exact: true })).toBeVisible();
    await expect(page.getByText("Dies ist nur eine Vorschau", { exact: false })).toHaveCount(0);
    await page.screenshot({ path: join(artifacts, `${width}-invitation.png`), fullPage: true });
    await page.getByRole("button", { name: "Selbst eintragen", exact: true }).click();
    await expect(page).toHaveURL(`${origin}/surveys/${ids.open}/participation`);
    const progress = page.getByRole("navigation", { name: "Deine Teilnahme", exact: true });
    await expect(progress.locator('[aria-current="step"]')).toContainText("Werdegang erfassen");
    await page.screenshot({ path: join(artifacts, `${width}-entry-start.png`), fullPage: true });
    const study = page.getByRole("group", { name: "1. Studium", exact: true });
    await expect(study.getByLabel("Abschlussart", { exact: true })).toHaveValue("");
    await study.getByLabel("Bezeichnung des Studiums", { exact: true }).fill(`Synthetischer Master ${width}`);
    await study.getByLabel("Abschlussart", { exact: true }).selectOption("MASTER");
    await study.getByLabel("Studienstatus", { exact: true }).selectOption("COMPLETED");
    await study.getByLabel("Beginn (Jahr, optional)", { exact: true }).fill("2018");
    await study.getByLabel("Ende (Jahr, optional)", { exact: true }).fill("2020");
    await study.getByLabel("Abschlussjahr (optional)", { exact: true }).fill("2020");
    await page.getByRole("button", { name: "Berufliche oder weitere Station ergänzen", exact: true }).click();
    const job = page.getByRole("group", { name: "2. Berufliche oder weitere Station", exact: true });
    await job.getByLabel("Tätigkeit / Bezeichnung", { exact: true }).fill("Synthetische Entwicklerin");
    await job.getByLabel("Art der Station", { exact: true }).selectOption("EMPLOYMENT");
    await job.getByLabel("Status der Tätigkeit", { exact: true }).selectOption("ONGOING");
    await job.getByLabel("Arbeitgeber / Organisation (optional)", { exact: true }).fill("Synthetischer Arbeitgeber");
    const selection = page.getByLabel("Welcher eigene Abschluss gehört zu dieser Befragung?", { exact: true });
    await expect(selection).toHaveValue(""); await selection.selectOption({ label: `Synthetischer Master ${width} · 2020` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: join(artifacts, `${width}-input.png`), fullPage: true });
    await page.getByRole("button", { name: "Angaben prüfen", exact: true }).click();
    await expect(progress.locator('[aria-current="step"]')).toContainText("Angaben prüfen");
    await expect(page.getByRole("heading", { name: "Deine Angaben prüfen", exact: true })).toBeFocused();
    if (width === 375) {
      await page.setViewportSize({ width: 320, height: 900 });
      await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.evaluate(() => { document.documentElement.style.fontSize = ""; });
      await page.setViewportSize({ width, height: 900 });
    }
    const submit = page.getByRole("button", { name: "Verbindlich absenden", exact: true });
    await expect(submit).toBeDisabled(); await expect(page.getByRole("checkbox").nth(0)).not.toBeChecked();
    await page.getByRole("checkbox").nth(0).check(); await expect(submit).toBeDisabled();
    await page.getByRole("checkbox").nth(1).check();
    await page.screenshot({ path: join(artifacts, `${width}-review.png`), fullPage: true });
    const sending = page.waitForRequest(request => request.method() === "POST" && request.url().endsWith("/participation"));
    await submit.click(); const submitted = (await sending).postDataJSON();
    await expect(page.getByRole("heading", { name: "Dein Karriereweg wurde gespeichert", exact: true })).toBeVisible();
    await expect(progress.locator('[aria-current="step"]')).toContainText("Abgeschlossen");
    await page.screenshot({ path: join(artifacts, `${width}-complete.png`), fullPage: true });
    await page.reload(); await expect(page.getByRole("heading", { name: "Dein Karriereweg wurde gespeichert", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Verbindlich absenden", exact: true })).toHaveCount(0);
    expect((await context.request.post(`${origin}/api/surveys/${ids.open}/participation`, { data: submitted, headers: { origin } })).status()).toBe(200);
    expect((await context.request.post(`${origin}/api/surveys/${ids.open}/participation`, { data: { begin: "manual" }, headers: { origin } })).status()).toBe(409);
    const rows = (await database.query('SELECT d.level, d."graduationYear", d."programId", r."alumniId" = d."alumniId" AS owned FROM "SurveyResponse" r JOIN "Degree" d ON r."referenceDegreeId" = d.id WHERE r."surveyId" = $1', [ids.open])).rows;
    expect(rows).toHaveLength(index + 1); expect(rows.every(row => row.level === "MASTER" && row.graduationYear === 2020 && row.programId === ids.master && row.owned)).toBe(true);
    await page.goto(`${origin}/surveys/${ids.closed}`); await expect(page.getByRole("heading", { name: "Diese Befragung ist geschlossen", exact: true })).toBeVisible();
    await expect(page.getByRole("button")).toHaveCount(0);
    expect((await context.request.post(`${origin}/api/surveys/${ids.open}/participation`, { data: { begin: "manual" }, headers: { origin: "https://foreign.invalid" } })).status()).toBe(404);
    expect((await context.request.post(`${origin}/api/surveys/${ids.closed}/participation`, { data: { begin: "manual" }, headers: { origin } })).status()).toBe(404);
    expect(errors).toEqual([]);
    console.log(`PASS ${width}px: invitation -> manual entry -> explicit Master selection -> review -> committed receipt -> reload/retry without duplication; closed/foreign requests rejected`);
    await context.close();
  }
  if (testLinkedIn) {
    async function simulateAuthorization(context, cancelled = false) {
      // As in the existing vertical OAuth tests, inspect the LOCAL 303 before
      // fulfilling a local grant page. Playwright cannot intercept every redirect
      // hop; never allow even synthetic credentials to reach the real provider.
      await context.route("**/*", async route => {
        const url = new URL(route.request().url());
        if (![origin, new URL(redirectUri).origin].includes(url.origin)) return route.abort("blockedbyclient");
        if (url.origin === origin && url.pathname === "/api/participation/linkedin/start") {
          const response = await route.fetch({ maxRedirects: 0 }); expect(response.status()).toBe(303);
          const authorization = new URL(response.headers().location);
          expect(authorization.origin + authorization.pathname).toBe("https://www.linkedin.com/oauth/v2/authorization");
          expect(authorization.searchParams.get("redirect_uri")).toBe(redirectUri); expect(authorization.searchParams.get("state")).toMatch(/^participation_v1_/);
          const destination = new URL(redirectUri); destination.searchParams.set("state", authorization.searchParams.get("state"));
          destination.searchParams.set(cancelled ? "error" : "code", cancelled ? "access_denied" : "synthetic-code");
          const headers = response.headers(); delete headers.location; delete headers["content-length"]; headers["content-type"] = "text/html; charset=utf-8";
          return route.fulfill({ status: 200, headers, body: `<a href="${destination.href.replaceAll("&", "&amp;")}">Synthetisch autorisieren</a>` });
        }
        return route.continue();
      });
    }
    for (const [index, width] of [1280, 375].entries()) {
      const context = await browser.newContext({ viewport: { width, height: 900 } }), page = await context.newPage(); currentPage = page;
      const errors = []; page.on("pageerror", error => errors.push(error.message));
      await simulateAuthorization(context);
      await page.goto(`${origin}/surveys/${ids.open}`);
      await page.getByRole("button", { name: "Mit LinkedIn starten", exact: true }).click();
      await expect(page).toHaveURL(`${origin}/surveys/${ids.open}/participation`);
      await page.getByRole("button", { name: "Mit LinkedIn verbinden", exact: true }).click();
      await page.getByRole("link", { name: "Synthetisch autorisieren", exact: true }).click();
      await expect(page.getByText("LinkedIn ist verbunden.", { exact: false })).toBeVisible();
      await expect(page.getByRole("group")).toHaveCount(0);
      await page.getByRole("button", { name: "Studien- und Berufsstationen übernehmen", exact: true }).click();
      const study = page.getByRole("group", { name: "2. Studium", exact: true });
      await expect(study.getByLabel("Abschlussart", { exact: true })).toHaveValue("MASTER");
      await expect(study.getByLabel("Studiengang zuordnen", { exact: true })).toHaveValue("OTHER");
      await expect(study.getByLabel("Abschlussjahr (optional)", { exact: true })).toHaveValue("");
      const reference = page.getByLabel("Welcher eigene Abschluss gehört zu dieser Befragung?", { exact: true });
      await expect(reference).toHaveValue("");
      await study.getByLabel("Studiengang zuordnen", { exact: true }).selectOption("SURVEY");
      await reference.selectOption({ label: "Synthetic Imported Master" });
      await page.getByRole("group", { name: "1. Berufliche oder weitere Station", exact: true }).getByLabel("Status der Tätigkeit", { exact: true }).selectOption("ONGOING");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: join(artifacts, `${width}-linkedin-import.png`), fullPage: true });
      await page.getByRole("button", { name: "Angaben prüfen", exact: true }).click();
      const submit = page.getByRole("button", { name: "Verbindlich absenden", exact: true });
      await expect(submit).toBeDisabled();
      await page.getByRole("checkbox").nth(0).check(); await expect(submit).toBeDisabled(); await page.getByRole("checkbox").nth(1).check();
      await submit.click(); await expect(page.getByRole("heading", { name: "Dein Karriereweg wurde gespeichert", exact: true })).toBeVisible();
      await page.reload(); await expect(page.getByRole("heading", { name: "Dein Karriereweg wurde gespeichert", exact: true })).toBeVisible();
      const rows = (await database.query('SELECT d.level, d."graduationYear", d."programId" FROM "SurveyResponse" r JOIN "Degree" d ON r."referenceDegreeId" = d.id WHERE r."surveyId" = $1 AND d.title = $2', [ids.open, "Synthetic Imported Master"])).rows;
      expect(rows).toHaveLength(index + 1); expect(rows.every(row => row.level === "MASTER" && row.graduationYear === null && row.programId === ids.master)).toBe(true);
      expect(errors).toEqual([]); await context.close();
      console.log(`PASS ${width}px: LinkedIn choice -> registered callback relay -> cookie/state-checked OAuth -> one-time import -> shared editable form -> explicit program/reference -> confirmed persistent response`);
    }
    const context = await browser.newContext(), page = await context.newPage(); currentPage = page;
    await simulateAuthorization(context, true);
    await page.goto(`${origin}/surveys/${ids.open}`); await page.getByRole("button", { name: "Mit LinkedIn starten", exact: true }).click();
    await page.getByRole("button", { name: "Mit LinkedIn verbinden", exact: true }).click();
    await page.getByRole("link", { name: "Synthetisch autorisieren", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "abgebrochen" })).toBeVisible();
    await page.getByRole("button", { name: "Ohne LinkedIn fortfahren", exact: true }).click();
    await expect(page.getByLabel("Abschlussart", { exact: true })).toHaveValue(""); await context.close();
    expect(Number((await database.query('SELECT count(*) FROM "SurveyResponse"')).rows[0].count)).toBe(4);
    console.log("PASS: cancelled LinkedIn authorization keeps manual entry usable and does not create a response.");
  }
  expect(Number((await database.query('SELECT count(*) FROM "AlumniContact"')).rows[0].count)).toBe(0);
  console.log(`PASS: only ${testLinkedIn ? "four" : "two"} synthetic test contributions persisted, no contacts; disposable database will be removed.`);
} catch (error) {
  console.error(error.message);
  if (currentPage && !currentPage.isClosed()) {
    // This runner creates only synthetic records in its own disposable DB.
    console.error(`Page: ${new URL(currentPage.url()).pathname}`);
    console.error((await currentPage.locator("body").innerText()).slice(0, 4000));
    await currentPage.screenshot({ path: join(source, "artifacts/manual-participation/failure.png"), fullPage: true });
  }
  console.error(serverLog.slice(-4000)); process.exitCode = 1;
}
finally {
  await browser?.close();
  if (child && child.exitCode === null) {
    child.kill("SIGTERM");
    await Promise.race([new Promise(done => child.once("exit", done)), delay(10000)]);
    if (child.exitCode === null) { console.error("MANUAL_TEST_APP_CLEANUP_FAILED"); process.exitCode = 1; }
  }
  await database?.end();
  closeCallbackEntry?.();
  if (created && spawnSync("docker", ["rm", "--force", "--volumes", container], { encoding: "utf8" }).status !== 0) { console.error("MANUAL_TEST_DB_CLEANUP_FAILED"); process.exitCode = 1; }
}
