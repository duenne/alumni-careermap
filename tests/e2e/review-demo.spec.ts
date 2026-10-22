import { expect, test, type Locator } from "@playwright/test";

test("V0: Review-Demo vom Einstieg bis Reset und Reload", async ({ page }, testInfo) => {
  const writes: string[] = [];
  const browserErrors: string[] = [];
  page.on("pageerror", error => browserErrors.push(error.message));
  // Fail closed: a regression must never send a writing request to the server.
  await page.route("**/*", async route => {
    const request = route.request();
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) {
      writes.push(`${request.method()} ${request.url()}`);
      await route.abort("blockedbyclient");
    } else {
      await route.continue();
    }
  });

  const main = page.getByRole("main");
  const ordered = main.getByRole("list", { name: "Karriere-Stationen im Entwurf", exact: true });
  const unplaced = main.getByRole("list", { name: "Zeitlich noch einzuordnen", exact: true });
  const master = main.getByRole("article", { name: "Synthetic M.Sc.", exact: true });
  const course = main.getByRole("article", { name: "Synthetic Short Course", exact: true });
  const confirm = main.getByRole("button", { name: "Reihenfolge für den Entwurf übernehmen", exact: true });
  const reference = main.getByRole("region", { name: "Referenzabschluss für die Befragung" });
  const normalization = main.getByRole("region", { name: "Normalisiertes Ergebnis" });
  const decisions = main.getByRole("region", { name: "Ihre ausdrücklich gewählten Angaben" });
  const initialOrder = ["Synthetic Internship", "Synthetic M.Sc.", "Synthetic Research Assistant"];
  const placedOrder = [initialOrder[0], "Synthetic Short Course", initialOrder[1], initialOrder[2]];
  const panels = main.locator("[data-station-details]:visible");

  // Navigate with real Tab events, including on the narrow viewport.
  async function tabTo(target: Locator) {
    for (let index = 0; index < 60; index++) {
      if (await target.evaluate(element => element === document.activeElement)) return;
      await page.keyboard.press("Tab");
    }
    await expect(target).toBeFocused();
  }
  async function activate(target: Locator) {
    await tabTo(target);
    await page.keyboard.press("Enter");
  }
  async function choose(field: Locator, label: string) {
    await tabTo(field);
    // Use native type-ahead instead of platform-dependent popup key handling.
    await page.keyboard.type(label);
    await page.keyboard.press("Tab");
    await expect(field.locator("option:checked")).toHaveText(label);
  }
  async function screenshot(name: string) {
    const path = testInfo.outputPath(`${name}.png`);
    await page.screenshot({ path, fullPage: true });
    await testInfo.attach(name, { path, contentType: "image/png" });
  }
  async function expectOrder(titles: string[]) {
    await expect(ordered.getByRole("heading", { level: 3 })).toHaveText(titles);
  }
  async function expectNoConfirmedOrder() {
    await expect(main.getByText(/^Entwurfsplatz [1-4]$/)).toHaveCount(0);
    await expect(normalization).toHaveCount(0);
  }
  async function expectInitial() {
    await expectOrder(initialOrder);
    await expect(unplaced.getByRole("heading", { level: 3 })).toHaveText(["Synthetic Short Course"]);
    await expect(confirm).toBeDisabled();
    await expect(reference).toContainText("Noch nicht ausgewählt.");
    await expectNoConfirmedOrder();
    await expect(panels).toHaveCount(0);
    await expect(main.getByText("Nur Demo – nichts gespeichert", { exact: true })).toBeVisible();
    await expect(master.getByText("Zu prüfen", { exact: true })).toBeVisible();
    await expect(main.getByRole("combobox")).toHaveCount(0);
  }
  async function expectNoHorizontalOverflow() {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  const sourceFacts = () => main.getByRole("region", { name: "Beobachtete Quellangaben" })
    .evaluateAll(elements => elements.map(element => element.textContent).sort());

  try {
    await test.step("1–3: Einstieg und unverbindlicher Ausgangszustand", async () => {
      await page.goto("/");
      await expect(main).toContainText("Eine Vorschau mit fiktiven Daten. Es findet keine Datenspende statt.");
      await activate(main.getByRole("link", { name: "Beispiel-Karriereweg ansehen" }));
      await expect(page).toHaveURL(/\/review$/);
      await expectInitial();
      await expectNoHorizontalOverflow();
      await screenshot("01-ausgangszustand");
    });
    const originalFacts = await sourceFacts();

    await test.step("4–5: Zugängliche Validierung und explizite Degree-Entscheidungen", async () => {
      await activate(main.getByRole("button", { name: "Prüfen: Synthetic M.Sc.", exact: true }));
      await expect(panels).toHaveCount(1);
      await expect(panels.getByRole("heading", { name: "Angaben zu dieser Station" })).toBeFocused();
      const classification = main.getByLabel("Art der Station", { exact: true });
      const level = main.getByLabel("Abschlussart", { exact: true });
      const status = main.getByLabel("Abschlussstatus", { exact: true });
      const apply = main.getByRole("button", { name: "Auswahl im Entwurf anwenden" });
      for (const [field, message, label] of [
        [classification, "Bitte wählen Sie die Art der Station ausdrücklich aus.", "Akademischer Abschluss"],
        [level, "Bitte wählen Sie eine Abschlussart aus.", "Master"],
        [status, "Bitte wählen Sie einen Abschlussstatus aus. Unbekannt ist ebenfalls eine bewusste Auswahl.", "Abgeschlossen"],
      ] as const) {
        await activate(apply);
        await expect(main.getByRole("alert")).toHaveText(message);
        await expect(field).toBeFocused();
        await expect(field).toHaveAttribute("aria-invalid", "true");
        await expect(field).toHaveAccessibleDescription(message);
        await choose(field, label);
      }
      await activate(apply);
      await expect(master.getByText("Im Entwurf geprüft", { exact: true })).toBeVisible();
      await expect(decisions).toContainText("Reihenfolge noch offen");
      await expectNoConfirmedOrder();
      await expect(confirm).toBeDisabled();
    });

    await test.step("6–8: Short Course ausdrücklich platzieren und Reihenfolge bestätigen", async () => {
      await activate(main.getByRole("button", { name: "Zeitlich einordnen: Synthetic Short Course", exact: true }));
      await expect(panels).toHaveCount(1);
      const placement = main.getByLabel("Platzierung für Synthetic Short Course", { exact: true });
      const insert = main.getByRole("button", { name: "Synthetic Short Course in den Entwurf einordnen", exact: true });
      await activate(insert);
      await expect(main.getByRole("alert")).toHaveText("Bitte wählen Sie eine Platzierung im Entwurf.");
      await expect(placement).toBeFocused();
      await expect(placement).toHaveAttribute("aria-invalid", "true");
      await expect(placement).toHaveAccessibleDescription("Bitte wählen Sie eine Platzierung im Entwurf.");
      await choose(placement, "Vor Synthetic M.Sc.");
      await expectOrder(initialOrder);
      await expect(unplaced.getByRole("article")).toHaveCount(1);
      await expect(confirm).toBeDisabled();
      await activate(insert);
      await expectOrder(placedOrder);
      await expect(unplaced).toHaveCount(0);
      await expect(course).toContainText("around 2018");
      await expect(course.locator("time")).toHaveCount(0);
      await expectNoConfirmedOrder();
      await activate(confirm);
      await expect(main.getByText(/^Entwurfsplatz [1-4]$/)).toHaveText(["Entwurfsplatz 1", "Entwurfsplatz 2", "Entwurfsplatz 3", "Entwurfsplatz 4"]);
      await expect(master.getByText("Teilweise normalisiert", { exact: true })).toBeVisible();
      await expect(normalization).toBeVisible();
      await expect(normalization.getByRole("heading")).toBeFocused();
      await expect(normalization.locator("div").filter({ has: page.getByText("Abschlussjahr", { exact: true }) })).toHaveText("AbschlussjahrNicht angegeben");
      await expect(main.getByRole("list", { name: "Noch offene Entscheidungen" }).getByRole("listitem")).toHaveText([
        "Abschlussjahr: nicht angegeben.", "Katalogzuordnung: unbekannt.",
      ]);
      await expect(reference).toContainText("Noch nicht ausgewählt.");
      await expect(confirm).toBeDisabled();
      expect(await sourceFacts()).toEqual(originalFacts);
      await expectNoHorizontalOverflow();
      await screenshot("02-bestaetigter-entwurf");
    });

    await test.step("9–10: Verschieben entwertet Reihenfolge, Detailwechsel erhält Entscheidungen", async () => {
      const move = main.getByRole("button", { name: "Synthetic M.Sc. nach oben verschieben", exact: true });
      await activate(move);
      await expect(move).toBeFocused();
      await expectOrder([initialOrder[0], initialOrder[1], "Synthetic Short Course", initialOrder[2]]);
      await expectNoConfirmedOrder();
      await expect(decisions).toContainText("Master");
      await expect(decisions).toContainText("Abgeschlossen");
      await expect(master.getByText("Im Entwurf geprüft", { exact: true })).toBeVisible();
      await activate(confirm);
      await expect(normalization).toBeVisible();
      await expect(master).toContainText("Entwurfsplatz 2");
      await activate(main.getByRole("button", { name: "Details anzeigen: Synthetic Internship", exact: true }));
      await expect(panels).toHaveCount(1);
      await expect(normalization).toHaveCount(0);
      await activate(main.getByRole("button", { name: "Prüfen: Synthetic M.Sc.", exact: true }));
      await expect(panels).toHaveCount(1);
      await expect(main.getByLabel("Abschlussart", { exact: true })).toHaveValue("MASTER");
      await expect(main.getByLabel("Abschlussstatus", { exact: true })).toHaveValue("COMPLETED");
      await expect(normalization).toBeVisible();
      await activate(main.getByRole("button", { name: "Schließen: Synthetic M.Sc.", exact: true }));
      await expect(panels).toHaveCount(0);
      await expect(main.getByRole("button", { name: "Prüfen: Synthetic M.Sc.", exact: true })).toBeFocused();
      expect(await sourceFacts()).toEqual(originalFacts);
    });

    await test.step("11–13: Reset mit Fokus, erneute Bearbeitung und flüchtiger Zustand nach Reload", async () => {
      await activate(main.getByRole("button", { name: "Entwurf zurücksetzen", exact: true }));
      await expectInitial();
      await expect(main.getByRole("heading", { name: "Zeitliche Übersicht", exact: true })).toBeFocused();
      await activate(main.getByRole("button", { name: "Prüfen: Synthetic M.Sc.", exact: true }));
      for (const label of ["Art der Station", "Abschlussart", "Abschlussstatus"]) {
        await expect(main.getByLabel(label, { exact: true })).toHaveValue("");
      }
      await choose(main.getByLabel("Art der Station", { exact: true }), "Akademischer Abschluss");
      await choose(main.getByLabel("Abschlussart", { exact: true }), "Master");
      await choose(main.getByLabel("Abschlussstatus", { exact: true }), "Abgeschlossen");
      await activate(main.getByRole("button", { name: "Auswahl im Entwurf anwenden" }));
      await expect(master.getByText("Im Entwurf geprüft", { exact: true })).toBeVisible();
      await page.reload();
      await expectInitial();
      expect(await sourceFacts()).toEqual(originalFacts);
      await expectNoHorizontalOverflow();
      await screenshot("03-nach-reload");
    });
  } finally {
    await testInfo.attach("browser-evidence", {
      body: JSON.stringify({ project: testInfo.project.name, viewport: page.viewportSize(), writes, browserErrors }, null, 2),
      contentType: "application/json",
    });
    expect(writes, "Keine schreibenden Browser-Requests").toEqual([]);
    expect(browserErrors, "Keine unbehandelten Browserfehler").toEqual([]);
  }
});
