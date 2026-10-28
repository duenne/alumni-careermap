// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it } from "vitest";
import Dashboard from "./dashboard";
import { overviewProfile, overviewStation } from "../../../lib/analytics/overview-fixtures";
let root: Root;
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
afterEach(async () => { if (root) await act(async () => root.unmount()); document.body.replaceChildren(); });
async function render() {
  const p = overviewProfile("a"), q = overviewProfile("b");
  q.stations[2].sector = "IT & Technologie"; q.stations[2].job = "Marketing & Vertrieb";
  p.stations.push(overviewStation({ id: "later", position: 4, startYear: 2021, sector: "IT & Technologie" }));
  const host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(createElement(Dashboard, { profiles: [p, q] })));
  return host.querySelector<HTMLElement>('section[aria-label="MSI-Sankey"]')!;
}
const button = (host: HTMLElement, text: string) => Array.from(host.querySelectorAll("button")).find(b => b.textContent === text)!;
it("defaults to four stages, switches to the seven-stage combinations without losing profile selection", async () => {
  const host = await render();
  expect(button(host, "Typische Karrierepfade").getAttribute("aria-pressed")).toBe("true");
  expect(host.querySelectorAll("[data-stage-heading]")).toHaveLength(4);
  expect(host.textContent).toContain("6 Übergangsbeiträge");
  await act(async () => button(document.body, "Karriereweg anzeigen").click());
  expect(host.querySelector('[role="status"]')!.textContent).toContain("Profil 1");
  await act(async () => button(host, "Gesamte Karrierehistorie").click());
  expect(host.querySelectorAll("[data-stage-heading]")).toHaveLength(7);
  expect(host.textContent).toContain("Gesamte Karrierehistorie – Kategorienkombinationen");
  expect(host.textContent).toContain("12 Übergangsbeiträge");
  expect(document.querySelector('[aria-label="Vollständiger Karriereweg"]')!.querySelectorAll("li")).toHaveLength(4);
});
it("provides complete category/count/share tooltips, path hover, toggling pins and keyboard alternatives", async () => {
  const host = await render();
  const node = host.querySelector<SVGGElement>('[data-node-label="Dritter Sektor"]')!;
  await act(async () => node.dispatchEvent(new MouseEvent("mouseover", { bubbles: true })));
  expect(host.querySelector('[role="status"]')!.textContent).toMatch(/Branche.*Dritter Sektor.*1 Person.*50,0 %/);
  expect(host.querySelectorAll('path[data-highlighted="true"]')).toHaveLength(3);
  await act(async () => node.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  await act(async () => node.dispatchEvent(new MouseEvent("mouseout", { bubbles: true })));
  expect(host.querySelector('[role="status"]')!.textContent).toContain("fixiert");
  const pinnedPaths = [...host.querySelectorAll('path[data-highlighted="true"]')].map(p => p.getAttribute("aria-label"));
  const other = host.querySelector<SVGGElement>('[data-node-label="IT & Technologie"]')!;
  await act(async () => other.dispatchEvent(new MouseEvent("mouseover", { bubbles: true })));
  expect(host.querySelector('[role="status"]')!.textContent).toContain("fixiert");
  expect([...host.querySelectorAll('path[data-highlighted="true"]')].map(p => p.getAttribute("aria-label"))).toEqual(pinnedPaths);
  await act(async () => other.dispatchEvent(new MouseEvent("mouseout", { bubbles: true })));
  await act(async () => node.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  expect(host.querySelector('[role="status"]')!.textContent).not.toContain("fixiert");
  expect(host.querySelectorAll('svg [tabindex="0"]')).toHaveLength(1);
  expect(host.querySelectorAll('svg path[tabindex="0"]')).toHaveLength(0);
  await act(async () => button(host, "Auswahl aufheben").click());
  expect(host.querySelectorAll('path[data-highlighted="true"]')).toHaveLength(0);
  expect(host.querySelector("svg")!.getAttribute("width")).toBe("100%");
  expect(host.querySelector('details summary')!.textContent).toContain("Kategoriehäufigkeiten");
});
it("offers frequency sorting and keeps absence and uncertainty as distinct labelled states", async () => {
  const p = overviewProfile("complete"); p.stations = p.stations.slice(0, 1);
  const q = overviewProfile("unknown"); q.completeTestCase = false; q.stations = q.stations.slice(0, 1);
  const host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(createElement(Dashboard, { profiles: [p, q] })));
  expect(host.querySelector('[data-node-state="absent"]')).not.toBeNull();
  expect(host.querySelector('[data-node-state="unknown"]')).not.toBeNull();
  expect(host.querySelector('select[aria-label="Knotensortierung"]')!.getAttribute("id")).toBeTruthy();
  expect(host.textContent).toContain("Kein Master (Testfall vollständig)");
  expect(host.textContent).toContain("Masterstudium unbekannt");
});
