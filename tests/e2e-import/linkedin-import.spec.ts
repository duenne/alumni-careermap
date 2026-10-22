import { expect, test } from "@playwright/test";
import fixture from "../../src/test-fixtures/linkedin-snapshots/fictional-member.json" with { type: "json" };

// UI contract tests mock only the local provider HTTP boundary. Provider HTTP,
// OAuth and session security are tested independently with synthetic responses.
// These tests never authorize an account or access LinkedIn.
const liveShapedSynthetic = () => {
  const value = structuredClone(fixture);
  Object.assign(value.elements[1].snapshotData[0], { Title: "Synthetic Provider Job" });
  return value;
};
const connectUI = async (page: import("@playwright/test").Page) => {
  await page.route("**/api/dev/import/linkedin/status", route => route.fulfill({ json: { configured: true, connected: true, mode: "third_party" } }));
  await page.goto("/dev/import?linkedin=connected");
  await expect(page.getByRole("button", { name: "Karrieredaten abrufen", exact: true })).toBeEnabled();
};

test("V1b: Snapshot-Fehler unterscheiden Größe und Format ohne persönliche Diagnosedaten", async ({ page }) => {
  let oversized = false;
  await page.route("**/api/dev/import/linkedin/snapshot", route => route.fulfill({ status: 502, json: {
    code: oversized ? "RESPONSE_TOO_LARGE" : "INVALID_RESPONSE",
    diagnostic: { domain: "EDUCATION", page: 0, reason: oversized ? "BODY_SIZE" : "PAGING_START", raw: "PRIVATE_SYNTHETIC_MARKER" },
    message: "PRIVATE_SYNTHETIC_MARKER",
  } }));
  await connectUI(page);
  await page.getByRole("button", { name: "Karrieredaten abrufen", exact: true }).click();
  await expect(page.getByText("Diagnose: EDUCATION · Seite 1 · PAGING_START", { exact: true })).toBeVisible();
  await expect(page.getByRole("main")).not.toContainText("PRIVATE_SYNTHETIC_MARKER");
  await expect(page.getByLabel("Temporäres Karriere-JSON", { exact: true })).toHaveValue("");
  oversized = true;
  await page.getByRole("button", { name: "Karrieredaten abrufen", exact: true }).click();
  await expect(page.getByText("Diagnose: EDUCATION · Seite 1 · BODY_SIZE", { exact: true })).toBeVisible();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Größenlimit");
});

test("V1b: fehlende lokale Konfiguration erklärt den deaktivierten Verbindungsbutton", async ({ page }) => {
  // Uses the actual status endpoint of the credential-free development test server.
  await page.goto("/dev/import");
  await expect(page.getByText("LinkedIn-Konfiguration fehlt oder ist ungültig.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mit LinkedIn verbinden", exact: true })).toBeDisabled();
  await page.getByText("Lokale Einrichtung anzeigen", { exact: true }).click();
  await expect(page.getByRole("main")).toContainText("LINKEDIN_CLIENT_ID");
  await expect(page.getByRole("main")).toContainText("LINKEDIN_CLIENT_SECRET");
  await expect(page.getByRole("main")).toContainText("Entwicklungsserver neu starten");
});

test("V1b: falscher lokaler Host wird erklärt; korrekte Konfiguration aktiviert den Button", async ({ page }) => {
  let correctOrigin = false;
  await page.route("**/api/dev/import/linkedin/status", route => route.fulfill({ json: correctOrigin
    ? { configured: true, connected: false, mode: "third_party", configurationIssue: null }
    : { configured: false, connected: false, mode: null, configurationIssue: "ORIGIN_MISMATCH" } }));
  await page.goto("/dev/import");
  await expect(page.getByText("Diese Browseradresse passt nicht zur konfigurierten Callback-URL.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mit LinkedIn verbinden", exact: true })).toBeDisabled();
  await expect(page.getByRole("link", { name: "http://localhost:3100/dev/import", exact: true })).toHaveAttribute("href", "http://localhost:3100/dev/import");
  correctOrigin = true;
  await page.reload();
  await expect(page.getByRole("button", { name: "Mit LinkedIn verbinden", exact: true })).toBeEnabled();
  await expect(page.getByText("HM CareerMap ist lokal konfiguriert. Noch nicht verbunden.", { exact: true })).toBeVisible();
});

test("V1b UI mit synthetischem Provider: JSON bearbeiten und vollständig auf echte Repository-Fixture wechseln", async ({ page }, testInfo) => {
  const writes: string[] = [];
  page.on("request", request => {
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method()) && !/\/api\/dev\/import\/linkedin\/(snapshot|disconnect)$/.test(new URL(request.url()).pathname)) writes.push(request.url());
  });
  await page.route("**/api/dev/import/linkedin/snapshot", route => route.fulfill({ json: { source: "linkedin", snapshot: liveShapedSynthetic() } }));
  await connectUI(page);
  await page.getByRole("button", { name: "Karrieredaten abrufen", exact: true }).click();
  const editor = page.getByLabel("Temporäres Karriere-JSON", { exact: true });
  await expect(editor).toHaveValue(/Synthetic Provider Job/);
  await expect(editor).not.toHaveValue(/FICTIONAL_|First Name|fictional-private/);
  await expect(page.getByText("LinkedIn-Daten – nur temporäre Vorschau", { exact: true })).toBeVisible();
  const value = JSON.parse(await editor.inputValue());
  value.elements[1].snapshotData[0].Title = "Synthetic Edited Provider Job";
  await editor.fill(JSON.stringify(value));
  await page.getByRole("button", { name: "JSON prüfen", exact: true }).click();
  await expect(page.getByRole("button", { name: "In Karriereansicht übernehmen", exact: true })).toBeDisabled();
  await expect(page.getByRole("article")).toHaveCount(0);
  const disconnected = page.waitForResponse(response => response.url().endsWith("/linkedin/disconnect") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Synthetische Testdaten verwenden", exact: true }).click();
  expect((await disconnected).status()).toBe(200);
  await expect(editor).not.toHaveValue(/Provider Job/);
  await expect(page.getByRole("article")).toHaveCount(0);
  await page.getByRole("button", { name: "In Karriereansicht übernehmen", exact: true }).click();
  await expect(page.getByRole("article", { name: "Synthetic Research Assistant", exact: true })).toBeVisible();
  await expect(page.getByText(/^Entwurfsplatz [1-4]$/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Karrieredaten abrufen", exact: true })).toBeDisabled();
  expect(writes, "Keine Profil- oder Datenbankschreibrequests").toEqual([]);
  expect(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }))).toEqual({ local: 0, session: 0 });
  await page.screenshot({ path: testInfo.outputPath("v1b-synthetic-replacement.png"), fullPage: true });
});

test("V1b UI mit synthetischem Provider: verzögerter Snapshot bleibt wiederholbar; Fehler enthalten keine Rohdaten", async ({ page }) => {
  let pending = true;
  await page.route("**/api/dev/import/linkedin/snapshot", route => pending
    ? route.fulfill({ status: 202, json: { code: "SNAPSHOT_PENDING", ignored: "PRIVATE_SYNTHETIC_MARKER" } })
    : route.fulfill({ json: { source: "linkedin", snapshot: liveShapedSynthetic() } }));
  await connectUI(page);
  await page.getByRole("button", { name: "Karrieredaten abrufen", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("noch nicht");
  await expect(page.getByLabel("Temporäres Karriere-JSON", { exact: true })).toHaveValue("");
  await expect(page.getByRole("main")).not.toContainText("PRIVATE_SYNTHETIC_MARKER");
  pending = false;
  await page.getByRole("button", { name: "Karrieredaten abrufen", exact: true }).click();
  await expect(page.getByLabel("Temporäres Karriere-JSON", { exact: true })).toHaveValue(/Synthetic Provider Job/);
});

test("V1b: registrierter Callback zeigt sichere Fehler an und protokolliert keinen Code", async ({ page, request }) => {
  const response = await request.get("/auth/linkedin/portability/callback?state=synthetic-state&code=synthetic-code", { maxRedirects: 0 });
  expect(response.status()).toBe(303);
  expect(response.headers()["location"]).toMatch(/\/dev\/import\?linkedin=(NOT_CONFIGURED|INVALID_STATE)$/);
  expect(response.headers()["location"]).not.toContain("synthetic-code");
  await page.goto(response.headers()["location"]);
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  await expect(page.getByRole("main")).not.toContainText("synthetic-code");
});

test("V1b UI mit synthetischem Provider: verspätete LinkedIn-Antwort überschreibt keine synthetische Quelle", async ({ page }) => {
  let release!: () => void; let started!: () => void;
  const wait = new Promise<void>(resolve => { release = resolve; });
  const fetching = new Promise<void>(resolve => { started = resolve; });
  const finished = new Promise<void>(resolve => {
    void page.route("**/api/dev/import/linkedin/snapshot", async route => {
      started(); await wait;
      try { await route.fulfill({ json: { source: "linkedin", snapshot: liveShapedSynthetic() } }); }
      finally { resolve(); }
    });
  });
  await connectUI(page);
  await page.getByRole("button", { name: "Karrieredaten abrufen", exact: true }).click();
  await fetching;
  try { await page.getByRole("button", { name: "Synthetische Testdaten verwenden", exact: true }).click(); }
  finally { release(); }
  await finished;
  const editor = page.getByLabel("Temporäres Karriere-JSON", { exact: true });
  await expect(editor).toHaveValue(/Synthetic Research Assistant/);
  await expect(editor).not.toHaveValue(/Synthetic Provider Job/);
});
