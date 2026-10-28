import { test, expect } from "@playwright/test";
test("optional local Phase-D acceptance: all 100 profiles and 432 timeline stations", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  await page.goto("/dev/analytics");
  const rows = page.getByRole("region", { name: "Importierte Alumni" }).locator("tbody tr");
  await expect(rows).toHaveCount(100);
  const unclear = await rows.locator("td:nth-of-type(3)").allTextContents();
  expect(unclear.reduce((n, value) => n + Number(value), 0)).toBe(15);
  const chart = page.getByRole("region", { name: "MSI-Sankey", exact: true });
  await expect(chart.locator("[data-stage-heading]")).toHaveCount(4);
  await expect(chart).toContainText("300 Übergangsbeiträge");
  await chart.getByLabel("Vier Sankey-Stufen; auf schmalen Bildschirmen scrollbar").screenshot({ path: "artifacts/v2.4/overview-100.png" });
  await page.getByLabel("Masterstudium", { exact: true }).selectOption("with");
  await expect(chart).toContainText("50 Profile im Diagramm");
  const sector = chart.locator('[data-node-label="Dritter Sektor"]');
  const count = Number(await sector.getAttribute("data-node-count"));
  await sector.hover();
  await expect(chart.getByRole("status")).toContainText(`${(count * 2).toLocaleString("de-DE", { minimumFractionDigits: 1 })} %`);
  await page.getByLabel("Masterstudium", { exact: true }).selectOption("without");
  await expect(chart).toContainText("50 Profile im Diagramm");
  await page.getByRole("button", { name: "Alle Filter zurücksetzen" }).click();
  await expect(chart).toContainText("100 Profile im Diagramm");
  await page.getByRole("button", { name: "Gesamte Karrierehistorie", exact: true }).click();
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
  await chart.locator('[data-stage-heading="6"]').scrollIntoViewIfNeeded();
  await expect(chart.locator('[data-stage-heading="6"]')).toBeInViewport();
  await scroll.screenshot({ path: "artifacts/v2/phase-d-100-sankey-after.png" });
  await scroll.evaluate(el => { el.scrollLeft = 0; });
  await page.screenshot({ path: "artifacts/v2/phase-d-100-dashboard.png" });
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Typische Karrierepfade", exact: true }).click();
  for (const [name, width, height] of [["desktop", 1440, 900], ["tablet", 834, 1112], ["mobile", 375, 812]] as const) {
    await page.setViewportSize({ width, height });
    const compact = chart.getByLabel("Vier Sankey-Stufen; auf schmalen Bildschirmen scrollbar");
    if (width > 720) await expect.poll(() => compact.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    // Actual SVG label bounding boxes must not overlap within a column or be clipped.
    expect(await chart.locator("svg").evaluate(svg => {
      const view = (svg as SVGSVGElement).viewBox.baseVal;
      const columns = new Map<number, DOMRect[]>();
      for (const node of svg.querySelectorAll<SVGGElement>("g[data-node-label]")) {
        const label = node.querySelector("text")!, box = label.getBBox();
        if (box.x < 0 || box.x + box.width > view.width || box.y < 0 || box.y + box.height > view.height) return false;
        const x = Math.round(Number(node.querySelector("rect")!.getAttribute("x")));
        const boxes = columns.get(x) ?? []; boxes.push(box); columns.set(x, boxes);
      }
      return [...columns.values()].every(boxes => boxes.sort((a, b) => a.y - b.y).every((box, i, list) => i === 0 || box.y >= list[i - 1].y + list[i - 1].height));
    })).toBe(true);
    await page.mouse.move(0, 0);
    await compact.screenshot({ path: `artifacts/v2.4/${name}-overview-100.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  expect(errors).toEqual([]);
});
