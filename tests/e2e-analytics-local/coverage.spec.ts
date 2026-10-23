import { test, expect } from "@playwright/test";
test("optional local Phase-D acceptance: all 100 profiles and 432 timeline stations", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  await page.goto("/dev/analytics");
  const rows = page.getByRole("region", { name: "Importierte Alumni" }).locator("tbody tr");
  await expect(rows).toHaveCount(100);
  const unclear = await rows.locator("td:nth-of-type(3)").allTextContents();
  expect(unclear.reduce((n, value) => n + Number(value), 0)).toBe(15);
  const chart = page.getByRole("region", { name: "MSI-Sankey", exact: true });
  await expect(chart).toContainText("100 Profile im Diagramm");
  await expect(chart).toContainText("28 davon mit unbekannten / ungeklärten Stufen");
  await expect(chart).toContainText("600 Übergangsbeiträge");
  let stations = 0;
  for (let i = 0; i < 100; i++) {
    const degreeCount = Number(await rows.nth(i).locator("td").nth(0).innerText());
    const careerCount = Number(await rows.nth(i).locator("td").nth(1).innerText());
    await page.locator("#analytics-path").selectOption({ index: i + 1 });
    const timeline = page.getByRole("region", { name: "Vollständiger Karriereweg", exact: true });
    await expect(timeline.locator("li")).toHaveCount(degreeCount + careerCount);
    stations += await timeline.locator("li").count();
    await expect(timeline.getByText("Synthetischer Demoanker", { exact: false })).toHaveCount(1);
  }
  expect(stations).toBe(432);
  await page.getByRole("button", { name: "Auswahl aufheben" }).click();
  await page.mouse.move(0, 0);
  const scroll = chart.getByLabel("Horizontal und vertikal scrollbar: sieben Sankey-Stufen");
  await scroll.screenshot({ path: "artifacts/v2/phase-d-100-sankey-before.png" });
  await scroll.evaluate(el => { el.scrollLeft = el.scrollWidth; });
  await expect(chart.getByText("7. Tätigkeit nach MSI", { exact: true })).toBeInViewport();
  await scroll.screenshot({ path: "artifacts/v2/phase-d-100-sankey-after.png" });
  await scroll.evaluate(el => { el.scrollLeft = 0; });
  await page.screenshot({ path: "artifacts/v2/phase-d-100-dashboard.png" });
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
