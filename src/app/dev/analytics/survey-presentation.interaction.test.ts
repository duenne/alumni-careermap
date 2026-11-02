// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it } from "vitest";
import Dashboard from "./dashboard";
import { overviewProfile } from "../../../lib/analytics/overview-fixtures";

let root: Root;
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
afterEach(async () => { if (root) await act(async () => root.unmount()); document.body.replaceChildren(); });
async function mount(syntheticDemo = true) {
  const host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(createElement(Dashboard, {
    profiles: [overviewProfile("with"), { ...overviewProfile("without"), stations: overviewProfile("without").stations.filter(s => s.type !== "MASTER") }],
    survey: { name: "Synthetic MSI survey", program: "Management Sozialer Innovationen", responses: 3 },
    diagnostics: [{ reason: "INCOMPLETE_TIMELINE" }], syntheticDemo,
  })));
  await act(async () => [...host.querySelectorAll("button")].find(b => b.textContent === "Typische Karrierepfade")!.click());
  return host;
}
function disclosure(host: HTMLElement, label: string) {
  return [...host.querySelectorAll("details")].find(d => d.querySelector("summary")?.textContent === label)!;
}
async function choose(host: HTMLElement, id: string, value: string) {
  const select = host.querySelector<HTMLSelectElement>(`#${id}`)!;
  await act(async () => { select.value = value; select.dispatchEvent(new Event("change", { bubbles: true })); });
}
it("prioritizes the survey chart, keeps only two overview metrics and collapses technical data and profiles", async () => {
  const host = await mount();
  expect(host.querySelector("h1")?.textContent).toBe("Karrierewege nach Management Sozialer Innovationen");
  expect(host.textContent).toContain("Synthetische Demodaten – keine echten Alumni-Befragungen");
  const metrics = host.querySelector('dl[aria-label="Überblick"]')!;
  expect([...metrics.querySelectorAll("dd")].map(d => d.textContent)).toEqual(["3", "2"]);
  const method = disclosure(host, "Daten und Auswertungsmethodik");
  const advanced = disclosure(host, "Erweiterte Analyseoptionen");
  const profiles = disclosure(host, "Alle Karriereprofile anzeigen");
  for (const d of [method, advanced, profiles]) expect(d.open).toBe(false);
  expect([...method.querySelectorAll("dt")].map(d => d.textContent)).toEqual(expect.arrayContaining(["Degrees", "CareerSteps", "TimelineItems"]));
  expect(method.textContent).toContain("INCOMPLETE_TIMELINE");
  expect(method.textContent).toContain("Synthetic MSI survey");
  expect(method.textContent).toContain("6 Übergangsbeiträge");
  expect(host.querySelector("svg")!.compareDocumentPosition(advanced) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(advanced.querySelectorAll("select")).toHaveLength(6);
  for (const d of [method, advanced, profiles]) {
    await act(async () => d.querySelector("summary")!.click()); expect(d.open).toBe(true);
    await act(async () => d.querySelector("summary")!.click()); expect(d.open).toBe(false);
  }
  expect(host.querySelector("svg")?.getAttribute("aria-describedby")).toBe("sankey-keyboard");
});
it("retains filters, highlighting, sorting, keyboard pins and profile details after opening and closing options", async () => {
  const host = await mount();
  const advanced = () => disclosure(host, "Erweiterte Analyseoptionen");
  await act(async () => advanced().querySelector("summary")!.click());
  await choose(host, "analytics-path", "with");
  expect(host.querySelector('[aria-label="Vollständiger Karriereweg"]')?.textContent).toContain("Synthetic master");
  await act(async () => host.querySelector<HTMLSelectElement>("#analytics-master")!.focus());
  await choose(host, "analytics-master", "without");
  expect(advanced().open).toBe(true);
  expect(document.activeElement?.id).toBe("analytics-master");
  expect(host.querySelector('[role="status"]')?.textContent).toContain("Masterfilter");
  await choose(host, "analytics-focus", "sectors");
  expect(host.querySelectorAll('[data-focus-stage="true"]')).toHaveLength(1);
  await choose(host, "analytics-sort", "alphabetical");
  const link = host.querySelector<HTMLSelectElement>("#analytics-link")!;
  await choose(host, "analytics-link", link.options[1].value);
  expect(host.querySelector('[role="status"]')?.textContent).toContain("fixiert");
  await act(async () => advanced().querySelector("summary")!.click());
  expect(advanced().open).toBe(false);
  expect(host.querySelector<HTMLSelectElement>("#analytics-master")!.value).toBe("without");
  const svg = host.querySelector("svg")!;
  await act(async () => svg.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  expect(host.querySelector('[role="status"]')?.textContent).not.toContain("fixiert");
  const node = host.querySelector('svg [role="button"][tabindex="0"]')!;
  await act(async () => node.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
  expect(host.querySelector('[role="status"]')?.textContent).toContain("fixiert");
  const profiles = disclosure(host, "Alle Karriereprofile anzeigen");
  await act(async () => profiles.querySelector("summary")!.click());
  await act(async () => profiles.querySelector<HTMLButtonElement>("button")!.click());
  await act(async () => profiles.querySelector("summary")!.click());
  expect(host.querySelector('[aria-label="Vollständiger Karriereweg"]')).not.toBeNull();
});
it("does not label a regular survey as synthetic", async () => {
  const host = await mount(false);
  expect(host.textContent).not.toContain("Synthetische Demodaten – keine echten Alumni-Befragungen");
  expect(host.textContent).toContain("Es gibt keine öffentliche Ergebnisfreigabe");
});
