// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it } from "vitest";
import Dashboard from "./dashboard";
import { overviewProfile } from "../../../lib/analytics/overview-fixtures";
let root: Root;
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
afterEach(async () => { if (root) await act(async () => root.unmount()); document.body.replaceChildren(); });
async function mount(onlyUnknown = false) {
  const a = overviewProfile("with"), b = overviewProfile("without"), c = overviewProfile("unknown");
  b.stations = b.stations.filter(s => s.type !== "MASTER"); c.stations[1].startYear = null;
  const host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(createElement(Dashboard, { profiles: onlyUnknown ? [c] : [a, b, c] })));
  return host;
}
async function choose(host: HTMLElement, id: string, value: string) {
  const select = host.querySelector<HTMLSelectElement>(`#${id}`)!;
  await act(async () => { select.value = value; select.dispatchEvent(new Event("change", { bubbles: true })); });
}
const button = (h: HTMLElement, text: string) => [...h.querySelectorAll("button")].find(b => b.textContent === text)!;
it("combines filters, updates denominator/shares, preserves timeline and explains a filtered selection", async () => {
  const host = await mount();
  await act(async () => button(host, "Karriereweg anzeigen").click());
  await choose(host, "analytics-master", "without");
  expect(host.textContent).toContain("1 Profile im Diagramm");
  expect(host.textContent).toContain("2 Profile durch Masterfilter ausgeblendet");
  expect(host.querySelector('[role="status"]')!.textContent).toContain("durch den Masterfilter");
  expect(host.querySelector('[aria-label="Vollständiger Karriereweg"]')!.querySelectorAll("li")).toHaveLength(3);
  await choose(host, "analytics-focus", "sectors");
  expect(host.querySelector('[data-focus-stage="true"]')!.getAttribute("data-stage-heading")).toBe("2");
  expect(host.textContent).toContain("100,0 %");
  await act(async () => button(host, "Gesamte Karrierehistorie").click());
  expect(host.textContent).toContain("1 Profile im Diagramm"); expect(host.querySelectorAll("[data-stage-heading]")).toHaveLength(7);
  await act(async () => button(host, "Alle Filter zurücksetzen").click());
  expect(host.textContent).toContain("3 Profile im Diagramm");
  expect(host.querySelector<HTMLSelectElement>("#analytics-focus")!.value).toBe("all");
});
it("handles profile switches and keyboard connection selection without another database read", async () => {
  const host = await mount();
  await choose(host, "analytics-master", "with");
  await choose(host, "analytics-path", "unknown");
  expect(host.querySelector('[role="status"]')!.textContent).toContain("Masterfilter");
  await choose(host, "analytics-path", "with");
  expect(host.querySelector('[role="status"]')!.textContent).toContain("Profil 1");
  const links = host.querySelector<HTMLSelectElement>("#analytics-link")!;
  await choose(host, "analytics-link", links.options[1].value);
  expect(host.querySelector('[role="status"]')!.textContent).toContain("fixiert");
  await choose(host, "analytics-path", "without");
  expect(host.querySelector('[role="status"]')!.textContent).toContain("Masterfilter");
});
it("shows a safe empty result and explains unknown master statuses without implying no master", async () => {
  const host = await mount(true);
  await choose(host, "analytics-master", "without");
  expect(host.textContent).toContain("0 Profile im Diagramm");
  expect(host.textContent).toContain("1 mit ungeklärtem Masterstatus");
  expect(host.querySelector("svg")).toBeNull();
  await act(async () => button(host, "Alle Filter zurücksetzen").click());
  expect(host.querySelector("svg")).not.toBeNull();
});
