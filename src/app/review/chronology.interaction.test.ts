// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import snapshot from "../../test-fixtures/linkedin-snapshots/fictional-member.json";
import { adaptLinkedInSnapshot } from "../../lib/normalization/adapt-linkedin-snapshot";
import * as assertions from "../../lib/normalization/apply-explicit-review-assertions";
import * as batch from "../../lib/normalization/normalize-career-batch";
import type { NormalizationInput } from "../../lib/normalization/contract";
import CareerReview from "./career-review";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root, host: HTMLDivElement, input: NormalizationInput, original: NormalizationInput;
const known = ["Synthetic Internship", "Synthetic M.Sc.", "Synthetic Research Assistant"];
const course = "Synthetic Short Course";
const orderedTitles = () => [...host.querySelectorAll('ol[aria-label="Karriere-Stationen im Entwurf"] article h3')].map(item => item.textContent);
const unplacedTitles = () => [...host.querySelectorAll('ul[aria-label="Zeitlich noch einzuordnen"] article h3')].map(item => item.textContent);
function button(name: string) {
  const element = [...host.querySelectorAll("button")].find(item => (item.getAttribute("aria-label") ?? item.textContent) === name);
  expect(element, `Missing button ${name}`).toBeDefined(); return element!;
}
const click = (name: string) => act(() => button(name).click());
const confirm = () => click("Reihenfolge für den Entwurf übernehmen");
function select(label: string, text: string) {
  if (![...host.querySelectorAll("label")].some(item => item.textContent === label)) click(label.startsWith("Platzierung für ") ? `Zeitlich einordnen: ${label.slice("Platzierung für ".length)}` : "Prüfen: Synthetic M.Sc.");
  const field = [...host.querySelectorAll("label")].find(item => item.textContent === label)?.control as HTMLSelectElement;
  expect(field).toBeDefined(); const option = [...field.options].find(item => item.textContent === text); expect(option).toBeDefined();
  act(() => { field.value = option!.value; field.dispatchEvent(new Event("change", { bubbles: true })); }); return field;
}
function place(relation = "Vor", anchor = known[0], title = course) {
  select(`Platzierung für ${title}`, `${relation} ${anchor}`); click(`${title} in den Entwurf einordnen`);
}
function review() {
  select("Art der Station", "Akademischer Abschluss"); select("Abschlussart", "Master"); select("Abschlussstatus", "Abgeschlossen"); click("Auswahl im Entwurf anwenden");
}
beforeEach(() => {
  input = adaptLinkedInSnapshot(snapshot); original = structuredClone(input);
  vi.spyOn(assertions, "applyExplicitReviewAssertions"); vi.spyOn(batch, "normalizeCareerBatch");
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  act(() => root.render(createElement(CareerReview, { input })));
});
afterEach(() => { act(() => root.unmount()); host.remove(); expect(input).toEqual(original); vi.restoreAllMocks(); });
describe("UI.2b.1 chronology clarity and reference context", () => {
  it("separates the exact known proposal from unplaced observations, each appearing once", () => {
    expect(orderedTitles()).toEqual(known); expect(unplacedTitles()).toEqual([course]);
    expect(host.querySelectorAll("article")).toHaveLength(4);
    const unplaced = host.querySelector('ul[aria-label="Zeitlich noch einzuordnen"]')!;
    expect(unplaced.textContent).toContain("around 2018"); expect(unplaced.textContent).toContain("Zeitliche Einordnung unbekannt");
    expect(unplaced.querySelector("time")).toBeNull(); expect(host.textContent).not.toMatch(/Quellangabe \d|Entwurfsplatz \d|Position 0/);
    expect(host.textContent).toContain("gleichzeitig"); expect(assertions.applyExplicitReviewAssertions).not.toHaveBeenCalled();
  });
  it("blocks confirmation while anything is unplaced, but permits independent local Degree review", () => {
    expect(button("Reihenfolge für den Entwurf übernehmen").disabled).toBe(true); confirm();
    expect(assertions.applyExplicitReviewAssertions).not.toHaveBeenCalled(); review();
    expect(host.querySelector('[role="alert"]')).toBeNull(); expect(host.querySelector('#normalization-heading')).toBeNull();
    expect(host.textContent).toContain("Reihenfolge noch offen"); expect(document.activeElement?.id).toBe("assertions-heading");
  });
  it("selecting relative placement alone makes no assertion and does not move the card", () => {
    select(`Platzierung für ${course}`, `Vor ${known[1]}`);
    expect(orderedTitles()).toEqual(known); expect(unplacedTitles()).toEqual([course]); expect(assertions.applyExplicitReviewAssertions).not.toHaveBeenCalled();
  });
  it.each(known.flatMap(anchor => [["Vor", anchor], ["Nach", anchor]]))("explicitly inserts %s %s without changing source precision", (relation, anchor) => {
    place(relation, anchor); const expected = [...known]; expected.splice(known.indexOf(anchor) + (relation === "Nach" ? 1 : 0), 0, course);
    expect(orderedTitles()).toEqual(expected); expect(unplacedTitles()).toEqual([]); expect(host.querySelectorAll("article")).toHaveLength(4);
    expect(host.textContent).toContain("Zeitliche Einordnung unbekannt"); expect(host.textContent).toContain("Manuell im Entwurf platziert");
    expect(document.activeElement?.closest("article")?.querySelector("h3")?.textContent).toBe(course);
    expect(assertions.applyExplicitReviewAssertions).not.toHaveBeenCalled(); expect(button("Reihenfolge für den Entwurf übernehmen").disabled).toBe(false);
  });
  it("rejects an empty placement with an associated error and safe keyboard focus", () => {
    click(`Zeitlich einordnen: ${course}`);
    click(`${course} in den Entwurf einordnen`);
    const field = host.querySelector('select[id^="placement-"]')!;
    expect(document.activeElement).toBe(field); expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("Platzierung"); expect(unplacedTitles()).toEqual([course]);
  });
  it("keeps placement anchored to the named source when the known list moves before application", () => {
    select(`Platzierung für ${course}`, `Nach ${known[0]}`); click(`${known[0]} nach unten verschieben`);
    click(`${course} in den Entwurf einordnen`); expect(orderedTitles()).toEqual([known[1], known[0], course, known[2]]);
  });
  it("confirms positive positions only after placement, preserving observations and review decisions", () => {
    place("Vor", known[1]); confirm();
    const first = vi.mocked(assertions.applyExplicitReviewAssertions).mock.results[0].value as NormalizationInput;
    expect(first.stations.map(source => source.position)).toEqual([4, 1, 3, 2].map(value => ({ kind: "ASSERTED", value })));
    review(); const calls = vi.mocked(assertions.applyExplicitReviewAssertions).mock.calls;
    expect(calls[1][0]).toBe(calls[0][0]); expect(calls[1][0]).toEqual(original);
    const output = vi.mocked(batch.normalizeCareerBatch).mock.results.at(-1)!.value;
    expect(output.stations[2]).toMatchObject({ kind: "RESOLVED_DEGREE", position: 3, canonical: { graduationYear: null, programId: null, institutionId: null },
      unresolved: [{ field: "graduationYear", reason: "MISSING" }, { field: "catalogAssociation", reason: "UNKNOWN" }] });
    for (const index of [0, 1, 3]) expect(output.stations[index]).toEqual({ sourceKey: original.stations[index].key, kind: "REVIEW_REQUIRED", unresolved: [{ field: "classification", reason: "CLASSIFICATION_UNCERTAIN" }] });
    const enriched = vi.mocked(assertions.applyExplicitReviewAssertions).mock.results[1].value as NormalizationInput;
    expect(enriched.stations[3].start).toEqual({ kind: "OBSERVED", value: { precision: "IMPRECISE", text: "around 2018" } });
    expect(host.textContent).not.toMatch(/Quellangabe \d|Entwurfsplatz 0/);
    expect(host.textContent?.match(/Entwurfsplatz [1-4]/g)).toHaveLength(4);
  });
  it("shows reference context as informational and unselected even after completed Master review", () => {
    const context = () => host.querySelector('[aria-labelledby="reference-heading"]')!;
    expect(context()?.textContent).toContain("Referenzabschluss für die Befragung"); expect(context().textContent).toContain("Noch nicht ausgewählt");
    expect(context().textContent).toContain("Studiengang"); expect(context().querySelector("button, select, input")).toBeNull();
    const unchanged = context().outerHTML; place(); confirm(); review(); expect(context().outerHTML).toBe(unchanged);
  });
  it("invalidates confirmation after movement, and reset restores the unplaced state and blank selections", () => {
    place(); confirm(); review(); click(`${course} nach unten verschieben`);
    expect(host.querySelector('#normalization-heading')).toBeNull(); expect(host.textContent).not.toMatch(/Entwurfsplatz \d/);
    expect(button("Reihenfolge für den Entwurf übernehmen").disabled).toBe(false);
    click("Entwurf zurücksetzen"); expect(orderedTitles()).toEqual(known); expect(unplacedTitles()).toEqual([course]);
    expect(button("Reihenfolge für den Entwurf übernehmen").disabled).toBe(true);
    for (const select of host.querySelectorAll("select")) expect(select.value).toBe(""); expect(document.activeElement?.id).toBe("timeline-heading");
  });
  it("supports an entirely undated snapshot without guessing the first placement", () => {
    const replacement = structuredClone(original); replacement.stations.forEach(source => { source.start = { kind: "MISSING" }; });
    act(() => root.render(createElement(CareerReview, { input: replacement })));
    expect(orderedTitles()).toEqual([]); expect(unplacedTitles()).toHaveLength(4);
    select(`Platzierung für ${known[0]}`, "Als erste Station im Entwurf"); click(`${known[0]} in den Entwurf einordnen`);
    expect(orderedTitles()).toEqual([known[0]]); expect(unplacedTitles()).toHaveLength(3); expect(button("Reihenfolge für den Entwurf übernehmen").disabled).toBe(true);
    expect(document.activeElement?.textContent).toBe(known[0]);
  });
});
