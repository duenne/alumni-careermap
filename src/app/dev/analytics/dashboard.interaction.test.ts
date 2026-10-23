// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import Dashboard from "./dashboard";
import type { AnalyticsProfile } from "../../../lib/analytics/records";

afterEach(() => document.body.replaceChildren());
it("shows empty data and selects a complete ordered read-only career", async () => {
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  await act(async () => root.render(createElement(Dashboard, { profiles: [] })));
  expect(host.textContent).toContain("Noch keine Profile importiert");
  const profile: AnalyticsProfile = { id: "synthetic-random-id", completeTestCase: true, stations: [
    { id: "degree", kind: "DEGREE", type: "BACHELOR", status: "COMPLETED", position: 1, title: "Synthetic bachelor", provider: "Synthetic institute", startYear: 2010, endYear: 2014, graduationYear: null, field: "Gesellschaft & Politik", sector: null, job: null, location: null, demoAnchor: true },
    { id: "work", kind: "CAREER_STEP", type: "EMPLOYMENT", status: "ONGOING", position: 2, title: "Synthetic role", provider: "Synthetic employer", startYear: 2015, endYear: null, graduationYear: null, field: null, sector: "Dritter Sektor", job: "Führung", location: "Synthetic town", demoAnchor: false },
  ] };
  await act(async () => root.render(createElement(Dashboard, { profiles: [profile] })));
  const select = Array.from(host.querySelectorAll("button")).find(button => button.textContent === "Karriereweg anzeigen")!;
  await act(async () => select.click());
  const timeline = host.querySelector('[aria-label="Vollständiger Karriereweg"]')!;
  expect(timeline.textContent).toContain("Synthetic bachelor"); expect(timeline.textContent).toContain("Synthetic role");
  expect(timeline.textContent).toContain("2010"); expect(timeline.textContent).toContain("Seit 2015");
  expect(timeline.textContent).toContain("Synthetischer Demoanker");
  expect(timeline.querySelectorAll("li")).toHaveLength(2);
  expect(timeline.querySelectorAll("input, select, textarea")).toHaveLength(0);
  await act(async () => root.unmount());
});
