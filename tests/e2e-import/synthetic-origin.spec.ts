import { expect, test } from "@playwright/test";
import fixture from "../../src/test-fixtures/linkedin-snapshots/fictional-member.json" with { type: "json" };

test("V1b: eigene Eingabe kann die Herkunftssperre auch nach Leeren nicht umgehen", async ({ page }) => {
  await page.goto("/dev/import");
  const editor = page.getByLabel("Temporäres Karriere-JSON", { exact: true });
  const transfer = page.getByRole("button", { name: "In Karriereansicht übernehmen", exact: true });
  await editor.fill(JSON.stringify(fixture));
  await page.getByRole("button", { name: "JSON prüfen", exact: true }).click();
  await expect(transfer).toBeDisabled();
  await expect(page.getByRole("article")).toHaveCount(0);
  await page.getByRole("button", { name: "Synthetische Testdaten verwenden", exact: true }).click();
  await expect(transfer).toBeEnabled();
  await transfer.click();
  await expect(page.getByRole("article")).toHaveCount(4);
  await editor.fill((await editor.inputValue()) + " ");
  await page.getByRole("button", { name: "JSON prüfen", exact: true }).click();
  await expect(transfer).toBeDisabled();
  await page.getByRole("button", { name: "Vorschau leeren", exact: true }).click();
  await editor.fill(JSON.stringify(fixture));
  await page.getByRole("button", { name: "JSON prüfen", exact: true }).click();
  await expect(transfer).toBeDisabled();
});
