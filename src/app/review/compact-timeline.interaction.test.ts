// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import snapshot from "../../test-fixtures/linkedin-snapshots/fictional-member.json";
import { adaptLinkedInSnapshot } from "../../lib/normalization/adapt-linkedin-snapshot";
import * as assertions from "../../lib/normalization/apply-explicit-review-assertions";
import * as batch from "../../lib/normalization/normalize-career-batch";
import type { NormalizationInput, NormalizationResult } from "../../lib/normalization/contract";
import CareerReview from "./career-review";
import CareerTimeline from "./career-timeline";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let host: HTMLDivElement, root: Root, input: NormalizationInput, original: NormalizationInput;
const master = "Synthetic M.Sc.", course = "Synthetic Short Course";
const titles = () => [...host.querySelectorAll("article h3")].map(item => item.textContent);
function button(name: string) {
  const element = [...host.querySelectorAll("button")].find(item => (item.getAttribute("aria-label") ?? item.textContent) === name);
  expect(element, `Missing button ${name}`).toBeDefined(); return element!;
}
const click = (name: string) => act(() => button(name).click());
function select(label: string, value: string) {
  const field = [...host.querySelectorAll("label")].find(item => item.textContent === label)?.control as HTMLSelectElement;
  expect(field).toBeDefined(); act(() => { field.value = value; field.dispatchEvent(new Event("change", { bubbles: true })); }); return field;
}
function review() {
  click(`Prüfen: ${master}`); select("Art der Station", "degree"); select("Abschlussart", "MASTER"); select("Abschlussstatus", "COMPLETED"); click("Auswahl im Entwurf anwenden");
}
function place() {
  click(`Zeitlich einordnen: ${course}`); select(`Platzierung für ${course}`, "before:2"); click(`${course} in den Entwurf einordnen`);
}
const confirm = () => click("Reihenfolge für den Entwurf übernehmen");
const lastResult = (): NormalizationResult => vi.mocked(batch.normalizeCareerBatch).mock.results.at(-1)!.value as NormalizationResult;
const panels = () => host.querySelectorAll('[data-station-details]:not([hidden])');
beforeEach(() => {
  input = adaptLinkedInSnapshot(snapshot); original = structuredClone(input);
  vi.spyOn(assertions, "applyExplicitReviewAssertions"); vi.spyOn(batch, "normalizeCareerBatch");
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  act(() => root.render(createElement(CareerReview, { input })));
});
afterEach(() => { act(() => root.unmount()); host.remove(); expect(input).toStrictEqual(original); vi.restoreAllMocks(); });

describe("UI.2c compact timeline", () => {
  it("starts with four compact summaries, no form, selects or station date details", () => {
    expect(host.querySelector('#timeline-heading')?.textContent).toBe("Zeitliche Übersicht");
    expect(titles()).toEqual(["Synthetic Internship", master, "Synthetic Research Assistant", course]);
    expect(host.querySelectorAll("ol article")).toHaveLength(3); expect(host.querySelectorAll("ul article")).toHaveLength(1);
    expect(host.querySelectorAll('article [aria-label="Beobachtete Quellangaben"]')).toHaveLength(4);
    for (const article of host.querySelectorAll("article")) {
      expect(article.textContent).toContain("Synthetic"); expect(article.textContent).toContain("Zu prüfen"); expect(article.querySelector('[aria-label="Beobachtete Quellangaben"]')?.querySelector("p")).not.toBeNull();
      expect(article.querySelector("dl")).toBeNull();
    }
    expect(host.querySelector("form, select")).toBeNull(); expect(panels()).toHaveLength(0);
    expect(host.querySelector("article")!.compareDocumentPosition(button("Reihenfolge für den Entwurf übernehmen")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(host.textContent).toContain("Ende nicht angegeben"); expect(host.textContent).toContain("around 2018");
    expect(host.querySelector("ul article time")).toBeNull(); expect(assertions.applyExplicitReviewAssertions).not.toHaveBeenCalled();
  });
  it("opens only the permitted blank Degree editor inline with labelled relationships and focus", () => {
    const trigger = button(`Prüfen: ${master}`); expect(trigger.getAttribute("aria-expanded")).toBe("false"); click(`Prüfen: ${master}`);
    expect(trigger.getAttribute("aria-expanded")).toBe("true"); const panel = host.querySelector(`#${trigger.getAttribute("aria-controls")}`)!;
    expect(panels()).toHaveLength(1); expect(panel.contains(host.querySelector("form"))).toBe(true);
    expect(panel.closest("article")?.querySelector("h3")?.textContent).toBe(master);
    expect(panel.contains(document.activeElement)).toBe(true); expect(document.activeElement?.tagName).toMatch(/H4|SELECT/);
    expect(panel.querySelectorAll("select")).toHaveLength(3); for (const field of panel.querySelectorAll("select")) expect(field.value).toBe("");
    expect(assertions.applyExplicitReviewAssertions).not.toHaveBeenCalled(); expect(batch.normalizeCareerBatch).not.toHaveBeenCalled();
  });
  it("toggles and switches a single read-only detail area, returning focus to its trigger", () => {
    click("Details anzeigen: Synthetic Internship"); expect(panels()).toHaveLength(1); expect(host.querySelectorAll("article dl")).toHaveLength(1);
    expect(host.querySelector("form")).toBeNull(); click(`Prüfen: ${master}`); expect(panels()).toHaveLength(1); expect(host.querySelectorAll("form")).toHaveLength(1);
    click(`Schließen: ${master}`); expect(panels()).toHaveLength(0); expect(document.activeElement).toBe(button(`Prüfen: ${master}`));
    click("Details anzeigen: Synthetic Research Assistant"); click("Details anzeigen: Synthetic Research Assistant"); expect(panels()).toHaveLength(0);
    expect(document.activeElement).toBe(button("Details anzeigen: Synthetic Research Assistant")); expect(assertions.applyExplicitReviewAssertions).not.toHaveBeenCalled();
  });
  it("retains accepted local review through collapse and switching without creating canonical claims", () => {
    review(); expect(host.querySelector('#assertions-heading')).not.toBeNull(); expect(host.querySelector('#normalization-heading')).toBeNull();
    click(`Schließen: ${master}`); expect(host.textContent).toContain("Im Entwurf geprüft"); click("Details anzeigen: Synthetic Internship"); click(`Prüfen: ${master}`);
    expect(host.querySelector('#assertions-heading')?.parentElement?.textContent).toContain("Master"); expect(host.querySelector('#degree-level')).toHaveProperty("value", "MASTER");
    expect(host.textContent).toContain("Reihenfolge noch offen"); expect(assertions.applyExplicitReviewAssertions).not.toHaveBeenCalled();
  });
  it("reveals placement only on request and keeps imprecise observations unchanged after explicit insertion", () => {
    expect(host.querySelector('select[id^="placement-"]')).toBeNull(); expect(button("Reihenfolge für den Entwurf übernehmen").disabled).toBe(true);
    click(`Zeitlich einordnen: ${course}`); select(`Platzierung für ${course}`, "before:2");
    expect(host.querySelectorAll("ol article")).toHaveLength(3); expect(assertions.applyExplicitReviewAssertions).not.toHaveBeenCalled();
    click(`${course} in den Entwurf einordnen`); expect(titles()).toEqual(["Synthetic Internship", course, master, "Synthetic Research Assistant"]);
    expect(titles().filter(title => title === course)).toHaveLength(1); const card = [...host.querySelectorAll("article")].find(item => item.querySelector("h3")?.textContent === course)!;
    expect(card.textContent).toContain("around 2018"); expect(card.querySelector("time")).toBeNull();
    expect(document.activeElement?.closest("article")).toBe(card); expect(assertions.applyExplicitReviewAssertions).not.toHaveBeenCalled();
  });
  it("retains the canonical result and confirmed order on close, but movement invalidates only chronology", () => {
    review(); place(); confirm(); const calls = vi.mocked(assertions.applyExplicitReviewAssertions).mock.calls.length;
    click(`Schließen: ${master}`); click("Details anzeigen: Synthetic Internship"); click(`Prüfen: ${master}`);
    expect(host.querySelector('#normalization-heading')).not.toBeNull(); expect(button("Reihenfolge für den Entwurf übernehmen").disabled).toBe(true);
    expect(assertions.applyExplicitReviewAssertions).toHaveBeenCalledTimes(calls);
    click(`${master} nach oben verschieben`); expect(host.querySelector('#normalization-heading')).toBeNull(); expect(host.querySelector('#assertions-heading')).not.toBeNull();
    expect(host.querySelector('#degree-level')).toHaveProperty("value", "MASTER"); expect(host.textContent).not.toMatch(/Entwurfsplatz \d/);
    confirm(); expect(vi.mocked(assertions.applyExplicitReviewAssertions).mock.calls[1][0]).toBe(vi.mocked(assertions.applyExplicitReviewAssertions).mock.calls[0][0]);
    expect(lastResult().stations[2]).toMatchObject({ kind: "RESOLVED_DEGREE", position: 2 });
  });
  it("normalizes only after explicit review plus complete order, retaining the exact unresolved decisions", () => {
    review(); expect(batch.normalizeCareerBatch).not.toHaveBeenCalled(); place(); confirm();
    const output = lastResult(); expect(output.stations[2]).toEqual({ sourceKey: original.stations[2].key, kind: "RESOLVED_DEGREE", position: 3,
      canonical: { level: "MASTER", status: "COMPLETED", title: master, fieldOfStudy: null, programId: null, institutionId: null, startYear: 2019, endYear: 2022, graduationYear: null },
      unresolved: [{ field: "graduationYear", reason: "MISSING" }, { field: "catalogAssociation", reason: "UNKNOWN" }] });
    expect(output.stations.filter(station => station.kind === "REVIEW_REQUIRED")).toHaveLength(3);
    const payload = vi.mocked(assertions.applyExplicitReviewAssertions).mock.calls[0][1] as assertions.ExplicitReviewUpdates;
    expect(payload.updates.map(update => update.position)).toEqual([1, 2, 3, 4]);
    expect(document.activeElement?.id).toBe("normalization-heading"); expect(host.querySelector('[aria-labelledby="reference-heading"]')?.textContent).toContain("Noch nicht ausgewählt");
  });
  it("shows partial normalization only after explicit Degree review and confirmed order, retaining open fields", () => {
    const card = () => [...host.querySelectorAll("article")].find(item => item.querySelector("h3")?.textContent === master)!;
    const badge = () => card().firstElementChild?.lastElementChild?.textContent;
    expect(badge()).toBe("Zu prüfen");
    review(); expect(badge()).toBe("Im Entwurf geprüft");
    expect(host.querySelector('#normalization-heading')).toBeNull(); expect(batch.normalizeCareerBatch).not.toHaveBeenCalled();
    place(); expect(badge()).toBe("Im Entwurf geprüft"); confirm();
    expect(lastResult().stations[2]).toMatchObject({ kind: "RESOLVED_DEGREE", unresolved: [
      { field: "graduationYear", reason: "MISSING" }, { field: "catalogAssociation", reason: "UNKNOWN" },
    ] });
    expect(badge()).toBe("Teilweise normalisiert");
    click(`Schließen: ${master}`); expect(badge()).toBe("Teilweise normalisiert"); click(`Prüfen: ${master}`);
    expect([...card().querySelectorAll('[aria-label="Noch offene Entscheidungen"] li')].map(item => item.textContent)).toEqual([
      "Abschlussjahr: nicht angegeben.", "Katalogzuordnung: unbekannt.",
    ]);
    expect(host.querySelector('[aria-labelledby="reference-heading"]')?.textContent).toContain("Noch nicht ausgewählt");
    expect(host.textContent).toContain("Nur Demo – nichts gespeichert");
  });
  it("resets the completed four-station draft with a count-independent announcement and original focus", () => {
    review(); place(); confirm(); expect(host.querySelector('#normalization-heading')).not.toBeNull();
    click("Entwurf zurücksetzen");
    expect(host.querySelector('[role="status"]')?.textContent).toBe("Entwurf zurückgesetzt. Reihenfolge und alle Stationen bleiben zu prüfen.");
    expect(titles()).toEqual(["Synthetic Internship", master, "Synthetic Research Assistant", course]);
    expect(host.querySelectorAll("article")).toHaveLength(4);
    expect([...host.querySelectorAll("article")].every(item => item.textContent?.includes("Zu prüfen"))).toBe(true);
    expect(host.querySelector('#normalization-heading, #assertions-heading')).toBeNull();
    expect(panels()).toHaveLength(0); expect(host.querySelector("form, select")).toBeNull();
    expect(button("Reihenfolge für den Entwurf übernehmen").disabled).toBe(true);
    expect(document.activeElement?.id).toBe("timeline-heading");
    click(`Prüfen: ${master}`); for (const field of host.querySelectorAll("select")) expect(field.value).toBe("");
    click(`Zeitlich einordnen: ${course}`); expect(host.querySelector('select[id^="placement-"]')).toHaveProperty("value", "");
    expect(host.querySelector('[aria-labelledby="reference-heading"]')?.textContent).toContain("Noch nicht ausgewählt");
  });
  it.each([1, 3])("uses the same neutral reset announcement with %i source stations", count => {
    act(() => root.render(createElement(CareerTimeline, { input: { stations: input.stations.slice(0, count) } })));
    click("Reihenfolge für den Entwurf übernehmen");
    click("Details anzeigen: Synthetic Research Assistant"); expect(panels()).toHaveLength(1);
    click("Entwurf zurücksetzen");
    expect(host.querySelector('[role="status"]')?.textContent).toBe("Entwurf zurückgesetzt. Reihenfolge und alle Stationen bleiben zu prüfen.");
    expect(host.querySelectorAll("article")).toHaveLength(count); expect(panels()).toHaveLength(0);
    expect(host.querySelector("form, select")).toBeNull(); expect(host.textContent).not.toMatch(/Entwurfsplatz \d/);
    expect([...host.querySelectorAll("article")].every(item => item.textContent?.includes("Zu prüfen"))).toBe(true);
    expect(button("Reihenfolge für den Entwurf übernehmen").disabled).toBe(false);
    expect(document.activeElement?.id).toBe("timeline-heading");
  });
  it("focuses invalid fields and resets both domain drafts and the open presentation", () => {
    click(`Prüfen: ${master}`); click("Auswahl im Entwurf anwenden"); expect(document.activeElement?.id).toBe("degree-classification");
    click(`Zeitlich einordnen: ${course}`); click(`${course} in den Entwurf einordnen`); expect(document.activeElement?.id).toMatch(/^placement-/);
    click("Entwurf zurücksetzen"); expect(panels()).toHaveLength(0); expect(host.querySelector("form, select")).toBeNull(); expect(document.activeElement?.id).toBe("timeline-heading");
    click(`Prüfen: ${master}`); for (const field of host.querySelectorAll("select")) expect(field.value).toBe("");
    const ids = [...host.querySelectorAll("[id]")].map(item => item.id); expect(new Set(ids).size).toBe(ids.length);
  });
  it.each(["professional", "reordered"])("does not expose a Degree editor for a %s replacement of the third input station", variant => {
    const replacement = structuredClone(original);
    if (variant === "professional") replacement.stations[2] = { ...replacement.stations[0], key: replacement.stations[2].key };
    else [replacement.stations[0], replacement.stations[2]] = [replacement.stations[2], replacement.stations[0]];
    act(() => root.render(createElement(CareerReview, { input: replacement })));
    expect(host.querySelector("form")).toBeNull();
    expect([...host.querySelectorAll("button")].some(item => item.textContent === "Prüfen")).toBe(false);
    for (const trigger of [...host.querySelectorAll<HTMLButtonElement>('[aria-label^="Details anzeigen:"]')]) {
      act(() => trigger.click()); expect(host.querySelector("form")).toBeNull();
    }
    expect(assertions.applyExplicitReviewAssertions).not.toHaveBeenCalled();
  });
  it("never renders PROFILE, excluded metadata or inferred completion in summaries or expanded panels", () => {
    click(`Prüfen: ${master}`); click(`Zeitlich einordnen: ${course}`); click("Details anzeigen: Synthetic Research Assistant");
    for (const value of Object.values(snapshot.elements[0].snapshotData[0])) expect(host.innerHTML).not.toContain(value);
    expect(host.innerHTML).not.toMatch(/FICTIONAL_|fictional-private|snapshot:|[0-9a-f]{8}-[0-9a-f]{4}-/);
    expect([...host.querySelectorAll("article")].map(item => item.textContent).join(" ")).not.toMatch(/laufend|bis heute|Quellangabe \d|Entwurfsplatz 0|RESOLVED_DEGREE/);
    expect(host.querySelector('[aria-labelledby="survey-context-heading"]')?.textContent).toContain("Management Sozialer Innovationen");
  });
});
