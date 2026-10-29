import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { JourneyHomeContent } from "./journey-home";

it("offers the real administration-to-dashboard journey without separate demo destinations or public profile links", () => {
  const html = renderToStaticMarkup(createElement(JourneyHomeContent));
  expect(html).toContain('href="/admin/surveys"');
  for (const step of ["Befragung einrichten", "Einladung öffnen", "Karriereweg prüfen", "Datenspende bestätigen", "Ergebnisse auswerten"]) expect(html).toContain(step);
  expect(html).toContain("LinkedIn"); expect(html).toContain("synthetisch");
  expect(html).not.toMatch(/href="[^\"]*(?:\/dev\/|\/review|localhost:|127\.0\.0\.1:)/);
  expect(html).not.toContain("Zukünftig");
});
