import { expect, test } from "@playwright/test";
import snapshot from "../../src/test-fixtures/linkedin-snapshots/fictional-member.json" with { type: "json" };

test("V1a: abgewiesener Browseraufruf und anschließender Reload erzeugen keinen Laufzeitfehler", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.setExtraHTTPHeaders({ "x-forwarded-for": "203.0.113.1" });
  const denied = await page.goto("/dev/import");
  expect(denied?.status()).toBe(404);
  // A denied request must terminate before React's Flight error/timing path.
  expect(denied?.headers()["content-type"]).toContain("text/plain");
  await expect(page.getByRole("heading", { name: "LinkedIn-Testimport", exact: true })).toHaveCount(0);
  // Let React finish its initial Flight performance flush as well as hydration.
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  expect(errors, "Keine unbehandelten Fehler beim abgewiesenen Importaufruf").toEqual([]);
  await page.setExtraHTTPHeaders({});
  await page.reload();
  await expect(page.getByRole("heading", { name: "LinkedIn-Testimport", exact: true })).toBeVisible();
  expect(errors, "Keine unbehandelten Fehler beim erneuten Importaufruf").toEqual([]);
});

test("V1a: lokales JSON vollständig austauschen und vorhandene Timeline nutzen", async ({ page }, testInfo) => {
  const writes: string[] = [];
  const runtimeErrors: string[] = [];
  page.on("pageerror", error => runtimeErrors.push(error.message));
  await page.route("**/*", async route => {
    if (!["GET", "HEAD", "OPTIONS"].includes(route.request().method())) {
      writes.push(route.request().method());
      await route.abort("blockedbyclient");
    } else await route.continue();
  });
  await page.goto("/dev/import");
  await expect(page.getByRole("heading", { name: "LinkedIn-Testimport", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mit LinkedIn verbinden", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Karrieredaten abrufen", exact: true })).toBeDisabled();
  await page.getByLabel("Synthetischer Datensatz", { exact: true }).selectOption("fictional-member");
  const editor = page.getByLabel("Temporäres Karriere-JSON", { exact: true });
  await editor.fill('{"invalid":');
  await page.getByRole("button", { name: "JSON prüfen", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Ungültiges JSON. Bitte prüfen Sie die Syntax.");
  await expect(editor).toBeFocused();
  await expect(editor).toHaveAttribute("aria-invalid", "true");

  // This sentinel is invented test data. Automated runs never use a real account.
  const temporary = structuredClone(snapshot);
  Object.assign(temporary.elements[1].snapshotData[0], { Title: "UNTRUSTED_SYNTHETIC_SENTINEL" });
  await editor.fill(JSON.stringify(temporary));
  await page.getByRole("button", { name: "JSON prüfen", exact: true }).click();
  await expect(page.getByText("2 Ausbildungsangaben · 2 Berufsangaben", { exact: true })).toBeVisible();
  await expect(editor).not.toHaveValue(/First Name|fictional-private|FICTIONAL_/);
  await expect(editor).toHaveValue(/UNTRUSTED_SYNTHETIC_SENTINEL/);
  await expect(page.getByRole("button", { name: "In Karriereansicht übernehmen", exact: true })).toBeDisabled();
  await expect(page.getByRole("article")).toHaveCount(0);
  await expect(page.getByText("Eigene JSON-Eingabe – nur temporäre Vorschau", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Synthetische Testdaten verwenden", exact: true }).click();
  await expect(page.getByText("Synthetische Testdaten", { exact: true })).toBeVisible();
  await expect(editor).not.toHaveValue(/UNTRUSTED_SYNTHETIC_SENTINEL|First Name|fictional-private|FICTIONAL_/);
  await expect(page.getByRole("article")).toHaveCount(0);
  await page.getByRole("button", { name: "In Karriereansicht übernehmen", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(4);
  const screenshot = testInfo.outputPath("synthetische-karriereansicht.png");
  await page.screenshot({ path: screenshot, fullPage: true });
  await testInfo.attach("synthetische-karriereansicht", { path: screenshot, contentType: "image/png" });
  await expect(page.getByText("Referenzabschluss: Noch nicht ausgewählt.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reihenfolge für den Entwurf übernehmen", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Prüfen: Synthetic M.Sc.", exact: true }).click();
  await page.getByLabel("Art der Station", { exact: true }).selectOption("degree");
  await page.getByLabel("Abschlussart", { exact: true }).selectOption("MASTER");
  await page.getByLabel("Abschlussstatus", { exact: true }).selectOption("COMPLETED");
  await page.getByRole("button", { name: "Auswahl im Entwurf anwenden", exact: true }).click();
  await expect(page.getByText("Im Entwurf geprüft", { exact: true })).toBeVisible();

  // Confirm a complete order, then replacing even the same source must erase it.
  await page.getByRole("button", { name: "Zeitlich einordnen: Synthetic Short Course", exact: true }).click();
  await page.getByLabel("Platzierung für Synthetic Short Course", { exact: true }).selectOption("before:2");
  await page.getByRole("button", { name: "Synthetic Short Course in den Entwurf einordnen", exact: true }).click();
  await page.getByRole("button", { name: "Reihenfolge für den Entwurf übernehmen", exact: true }).click();
  await expect(page.getByRole("region", { name: "Normalisiertes Ergebnis", exact: true })).toBeVisible();
  const reviewedScreenshot = testInfo.outputPath("synthetischer-review-entwurf.png");
  await page.screenshot({ path: reviewedScreenshot, fullPage: true });
  await testInfo.attach("synthetischer-review-entwurf", { path: reviewedScreenshot, contentType: "image/png" });
  await page.getByRole("button", { name: "Synthetische Testdaten verwenden", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(0);
  await page.getByRole("button", { name: "In Karriereansicht übernehmen", exact: true }).click();
  await page.getByRole("button", { name: "Prüfen: Synthetic M.Sc.", exact: true }).click();
  await expect(page.getByLabel("Abschlussart", { exact: true })).toHaveValue("");
  await expect(page.getByText("Im Entwurf geprüft", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/^Entwurfsplatz \d+$/)).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Normalisiertes Ergebnis", exact: true })).toHaveCount(0);
  await editor.fill((await editor.inputValue()) + " ");
  await expect(page.getByText("Synthetische Testdaten", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("article")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "In Karriereansicht übernehmen", exact: true })).toBeDisabled();
  await page.reload();
  await expect(editor).toHaveValue("");
  await expect(page.getByRole("article")).toHaveCount(0);
  expect(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }))).toEqual({ local: 0, session: 0 });
  expect(writes).toEqual([]);
  expect(runtimeErrors, "Keine unbehandelten Browserfehler im vollständigen Importablauf").toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("V1a/V1b: Quellwechsel entfernt die alte Ansicht und sperrt ungeklärte Eingabe", async ({ page }) => {
  await page.goto("/dev/import");
  const editor = page.getByLabel("Temporäres Karriere-JSON", { exact: true });
  await page.getByRole("button", { name: "Synthetische Testdaten verwenden", exact: true }).click();
  await expect(editor).not.toHaveValue("");
  await page.getByRole("button", { name: "In Karriereansicht übernehmen", exact: true }).click();
  await page.getByRole("button", { name: "Prüfen: Synthetic M.Sc.", exact: true }).click();
  await page.getByLabel("Art der Station", { exact: true }).selectOption("degree");
  await page.getByLabel("Abschlussart", { exact: true }).selectOption("MASTER");
  await page.getByLabel("Abschlussstatus", { exact: true }).selectOption("COMPLETED");
  await page.getByRole("button", { name: "Auswahl im Entwurf anwenden", exact: true }).click();
  const changed = structuredClone(snapshot);
  changed.elements.reverse();
  const positions = changed.elements.find(element => element.snapshotDomain === "POSITIONS")!;
  positions.snapshotData.splice(1);
  Object.assign(positions.snapshotData[0], { Title: "Synthetic Replacement Role" });
  await editor.fill(JSON.stringify(changed));
  await expect(page.getByRole("article")).toHaveCount(0);
  await page.getByRole("button", { name: "JSON prüfen", exact: true }).click();
  await expect(page.getByRole("button", { name: "In Karriereansicht übernehmen", exact: true })).toBeDisabled();
  await expect(editor).toHaveValue(/Synthetic Replacement Role/);
  await expect(page.getByRole("article")).toHaveCount(0);
  await expect(page.getByRole("article", { name: "Synthetic Research Assistant", exact: true })).toHaveCount(0);
  await expect(page.getByRole("article", { name: "Synthetic Internship", exact: true })).toHaveCount(0);
  await expect(page.getByText("Im Entwurf geprüft", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/^Entwurfsplatz \d+$/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reihenfolge für den Entwurf übernehmen", exact: true })).toHaveCount(0);
});

test("V1a: Entwicklungsgrenze und Fixture-Allowlist werden über HTTP geprüft", async ({ request }) => {
  const fixture = "/api/dev/import/fixture?id=fictional-member";
  const allowed = await request.get(fixture);
  expect(allowed.status()).toBe(200);
  expect(allowed.headers()["cache-control"]).toContain("no-store");
  expect(await allowed.text()).not.toMatch(/First Name|fictional-private|FICTIONAL_/);
  expect((await request.get("/api/dev/import/fixture?id=unknown")).status()).toBe(404);
  const deniedHeaders: Record<string, string>[] = [{ origin: "https://external.invalid" }, { "x-forwarded-host": "external.invalid" }, { "x-forwarded-for": "203.0.113.1" }];
  for (const headers of deniedHeaders) {
    expect((await request.get(fixture, { headers })).status()).toBe(404);
    const page = await request.get("/dev/import", { headers });
    expect(await page.text()).not.toContain("Temporäres Karriere-JSON");
  }
});

test("V1a: fehlgeschlagener Fixture-Austausch entfernt den alten Entwurf", async ({ page }) => {
  await page.goto("/dev/import");
  const useFixture = page.getByRole("button", { name: "Synthetische Testdaten verwenden", exact: true });
  const editor = page.getByLabel("Temporäres Karriere-JSON", { exact: true });
  await useFixture.click();
  await expect(editor).not.toHaveValue("");
  await page.getByRole("button", { name: "In Karriereansicht übernehmen", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(4);
  // Deliberate transport failure only; the successful pipeline above is real.
  await page.route("**/api/dev/import/fixture?*", route => route.fulfill({ status: 503, body: "Unavailable" }));
  await useFixture.click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Synthetische Testdaten konnten nicht geladen werden.");
  await expect(editor).toHaveValue("");
  await expect(page.getByRole("article")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "In Karriereansicht übernehmen", exact: true })).toBeDisabled();
});

test("V1a: verspätete Fixture-Antwort überschreibt keine neuere eigene Eingabe", async ({ page }) => {
  await page.goto("/dev/import");
  let release!: () => void;
  const delayed = new Promise<void>(resolve => { release = resolve; });
  let started!: () => void;
  const fetched = new Promise<void>(resolve => { started = resolve; });
  const routeFinished = new Promise<void>(resolve => {
    void page.route("**/api/dev/import/fixture?*", async route => {
      const response = await route.fetch();
      started();
      await delayed;
      await route.fulfill({ response });
      resolve();
    });
  });
  await page.getByRole("button", { name: "Synthetische Testdaten verwenden", exact: true }).click();
  await fetched;
  const editor = page.getByLabel("Temporäres Karriere-JSON", { exact: true });
  const changed = structuredClone(snapshot);
  Object.assign(changed.elements[1].snapshotData[0], { Title: "Synthetic Newer Input" });
  const text = JSON.stringify(changed);
  try {
    await editor.fill(text);
  } finally {
    release();
  }
  await routeFinished;
  await page.getByRole("button", { name: "JSON prüfen", exact: true }).click();
  await expect(page.getByRole("button", { name: "In Karriereansicht übernehmen", exact: true })).toBeDisabled();
  await expect(editor).toHaveValue(/Synthetic Newer Input/);
  await expect(page.getByRole("article")).toHaveCount(0);
  await expect(page.getByText("Synthetische Testdaten", { exact: true })).toHaveCount(0);
});
