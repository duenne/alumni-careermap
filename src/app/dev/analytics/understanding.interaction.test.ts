// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it } from "vitest";
import Dashboard from "./dashboard";
import { overviewProfile, overviewStation } from "../../../lib/analytics/overview-fixtures";
let root: Root;
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
afterEach(async () => { if (root) await act(async () => root.unmount()); document.body.replaceChildren(); });
it("opens with interpretable paths, drills into groups and shows actual stations beside the diagram", async () => {
  const a = overviewProfile("a"), b = overviewProfile("b");
  a.stations[2].startYear = 2014; // strict chronology cannot decide, station content is known
  b.stations = [b.stations[0], overviewStation({ id: "direct", position: 2, title: "Synthetic direct role" })];
  const host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(createElement(Dashboard, { profiles: [a, b] })));
  const view = [...host.querySelectorAll("button")].find(b => b.textContent === "Karrierewege verstehen")!;
  expect(view?.getAttribute("aria-pressed")).toBe("true");
  expect(host.querySelector('[aria-label="Was die Karrierewege zeigen"]')?.textContent).toContain("1 von 2");
  const group = host.querySelector<HTMLButtonElement>('[data-career-group]')!;
  await act(async () => group.click());
  expect(host.querySelector('[aria-label="Wege im gewählten Verlauf"]')).not.toBeNull();
  await act(async () => host.querySelector<HTMLButtonElement>('[data-open-career]')!.click());
  const detail = host.querySelector('[aria-label="Stationen des ausgewählten Karrierewegs"]')!;
  expect(detail.textContent).toContain("Synthetic MSI");
  expect(detail.querySelectorAll("li")).toHaveLength(2);
  expect(detail.textContent).toContain("Synthetic direct role");
  expect(host.querySelectorAll('path[data-selected-profile="true"]')).toHaveLength(3);
  // A selection from the independent profile table must escape a prior group.
  await act(async () => [...host.querySelectorAll("button")].find(b => b.textContent === "Karriereweg anzeigen")!.click());
  expect(host.querySelector('[aria-label="Stationen des ausgewählten Karrierewegs"]')!.querySelectorAll("li")).toHaveLength(3);
  expect(host.querySelectorAll('path[data-selected-profile="true"]')).toHaveLength(3);
  const counts = [0, 1, 2].map(stage => [...host.querySelectorAll(`[data-flow-stage="${stage}"]`)].reduce((sum, p) => sum + Number(p.getAttribute("data-flow-value")), 0));
  expect(counts).toEqual([2, 2, 2]);
});

it("guides the reader through focused questions and keeps counting explanations behind accessible help", async () => {
  const p = overviewProfile(); p.stations[2].sector = null; p.stations[1].field = null;
  const host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(createElement(Dashboard, { profiles: [p], survey: { name: "Synthetic survey", program: "MSI", responses: 1 }, syntheticDemo: true })));
  const insights = host.querySelector('[aria-label="Was die Karrierewege zeigen"]')!;
  const nav = insights.querySelector('[aria-label="Fragen an die Karrierewege"]')!;
  expect(nav.querySelectorAll("button")).toHaveLength(4);
  expect(insights.querySelectorAll('[data-question-panel]')).toHaveLength(1);
  const click = async (label: string) => act(async () => [...nav.querySelectorAll("button")].find(b => b.textContent?.includes(label))!.click());
  await click("Weiterstudium");
  expect(insights.textContent).toContain("Synthetic master");
  await click("Berufliche Wege");
  expect(insights.textContent).toContain("Für 0 von 1");
  expect(insights.textContent).toContain("Branchen lassen sich damit nicht vergleichen");
  const help = insights.querySelector<HTMLDetailsElement>('details[data-counting-help]')!;
  const diagram = host.querySelector("svg")!;
  const groups = host.querySelector('[aria-label="Wiederkehrende Stationsfolgen"]')!;
  const options = [...host.querySelectorAll("details")].find(d => d.querySelector("summary")?.textContent === "Erweiterte Analyseoptionen")!;
  expect(diagram.compareDocumentPosition(groups) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(groups.compareDocumentPosition(options) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(help.open).toBe(false);
  await act(async () => help.querySelector("summary")!.click());
  expect(help.open).toBe(true);
  expect(insights.querySelectorAll('[data-question-panel]')).toHaveLength(1);
});
