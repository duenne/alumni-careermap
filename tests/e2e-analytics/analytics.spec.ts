import { test, expect } from "@playwright/test";
test("20 profiles from PostgreSQL -> complete timeline -> interactive conserved Sankey", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.goto("/dev/analytics");
  await expect(page.getByRole("heading", { name: "MSI · Karrierepfade erkunden" })).toBeVisible();
  const rows = page.getByRole("region", { name: "Importierte Alumni" }).locator("tbody tr");
  await expect(rows).toHaveCount(20);
  await rows.first().getByRole("button", { name: "Karriereweg anzeigen" }).click();
  const timeline = page.getByRole("region", { name: "Vollständiger Karriereweg", exact: true });
  await expect(timeline.locator("li")).toHaveCount(4);
  await expect(timeline.getByRole("heading", { name: "Synthetic role" })).toBeVisible();
  await expect(timeline.getByText("Synthetischer Demoanker", { exact: false })).toBeVisible();
  const chart = page.getByRole("region", { name: "MSI-Sankey", exact: true });
  await expect(chart.locator("[data-stage-heading]")).toHaveCount(4);
  await expect(chart).toContainText("60 Übergangsbeiträge");
  await page.getByRole("button", { name: "Gesamte Karrierehistorie", exact: true }).click();
  await expect(chart).toContainText("20 Profile im Diagramm"); await expect(chart).toContainText("120 Übergangsbeiträge");
  await expect(chart.locator("svg path")).toHaveCount(6);
  await expect(page.locator("#analytics-path")).not.toHaveValue("");
  await page.getByRole("button", { name: "Auswahl aufheben" }).click();
  const link = chart.locator("svg path").first(); await link.focus();
  await expect(chart.getByRole("status")).toContainText("20 Personen");
  await link.press("Enter"); await link.blur(); await expect(chart.getByRole("status")).toContainText("20 Profile im ausgewählten Fluss fixiert");
  await expect(page.getByRole("list", { name: "Farblegende" })).toBeVisible();
  await page.reload(); await expect(rows).toHaveCount(20);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `artifacts/v2/${test.info().project.name}-analytics.png`, fullPage: true });
  expect(errors).toEqual([]);
});
test("rejects non-local and cross-origin page/RSC requests", async ({ request }) => {
  const cases: Record<string, string>[] = [{ host: "example.com" }, { origin: "https://example.com", RSC: "1" }];
  for (const headers of cases) {
    const response = await request.get("/dev/analytics", { headers });
    expect(response.status()).toBe(404); expect(await response.text()).not.toContain("Synthetic role");
  }
});
