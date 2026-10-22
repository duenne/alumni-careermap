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
let root: Root, host: HTMLDivElement, input: NormalizationInput, before: NormalizationInput;
const proposal = ["Synthetic Internship", "Synthetic M.Sc.", "Synthetic Research Assistant", "Synthetic Short Course"];
function button(name: string) {
  const found = [...host.querySelectorAll("button")].find(item => (item.getAttribute("aria-label") ?? item.textContent) === name);
  expect(found, `Missing button ${name}`).toBeDefined(); return found!;
}
const click = (name: string) => act(() => button(name).click());
function placeCourse() {
  if (!host.querySelector('ul[aria-label="Zeitlich noch einzuordnen"]')) return;
  choose("Platzierung für Synthetic Short Course", "after:0"); click("Synthetic Short Course in den Entwurf einordnen");
}
const confirm = () => { placeCourse(); click("Reihenfolge für den Entwurf übernehmen"); };
const move = (title: string, direction: "oben" | "unten") => click(`${title} nach ${direction} verschieben`);
const titles = () => [...host.querySelectorAll("article h3")].map(item => item.textContent);
function choose(label: string, value: string) {
  if (![...host.querySelectorAll("label")].some(item => item.textContent === label)) click(label.startsWith("Platzierung") ? "Zeitlich einordnen: Synthetic Short Course" : "Prüfen: Synthetic M.Sc.");
  const field = [...host.querySelectorAll("label")].find(item => item.textContent === label)?.control as HTMLSelectElement;
  act(() => { field.value = value; field.dispatchEvent(new Event("change", { bubbles: true })); });
}
function review() { choose("Art der Station", "degree"); choose("Abschlussart", "MASTER"); choose("Abschlussstatus", "COMPLETED"); click("Auswahl im Entwurf anwenden"); }
beforeEach(() => {
  input = adaptLinkedInSnapshot(snapshot); before = structuredClone(input);
  vi.spyOn(assertions, "applyExplicitReviewAssertions"); vi.spyOn(batch, "normalizeCareerBatch");
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  act(() => root.render(createElement(CareerReview, { input })));
});
afterEach(() => { act(() => root.unmount()); host.remove(); expect(input).toStrictEqual(before); vi.restoreAllMocks(); });
describe("UI.2b unified timeline interactions", () => {
  it("shows four stations once in one semantic proposal list, with original source order retained separately", () => {
    expect(titles()).toEqual(proposal);
    expect(host.querySelectorAll('ol[aria-label="Karriere-Stationen im Entwurf"] > li')).toHaveLength(3);
    expect(host.querySelectorAll('ul[aria-label="Zeitlich noch einzuordnen"] > li')).toHaveLength(1);
    expect(before.stations.map(source => source.title.kind === "OBSERVED" ? source.title.value : null)).toEqual([proposal[2], proposal[0], proposal[1], proposal[3]]);
    expect(host.textContent).toContain("gleichzeitig"); expect(host.textContent).toContain("keine bestätigte zeitliche Reihenfolge");
    expect(host.textContent).toContain("around 2018"); expect(host.textContent).not.toMatch(/Entwurfsplatz [1-4]/);
  });
  it("places the blank review in the Master card, without any numeric position input", () => {
    expect(host.querySelector("form")).toBeNull(); click("Prüfen: Synthetic M.Sc.");
    const form = host.querySelector("form")!;
    expect(form.closest("article")?.querySelector("h3")?.textContent).toBe("Synthetic M.Sc.");
    expect(host.querySelector("input")).toBeNull(); expect(form.querySelectorAll("select")).toHaveLength(3);
    for (const select of form.querySelectorAll("select")) expect(select.value).toBe("");
    expect(assertions.applyExplicitReviewAssertions).not.toHaveBeenCalled(); expect(batch.normalizeCareerBatch).not.toHaveBeenCalled();
  });
  it("provides named movement controls with disabled boundaries and focus on the moved station", () => {
    placeCourse();
    expect(button("Synthetic Internship nach oben verschieben").disabled).toBe(true);
    expect(button("Synthetic Short Course nach unten verschieben").disabled).toBe(true);
    button("Synthetic M.Sc. nach oben verschieben").focus(); move("Synthetic M.Sc.", "oben");
    expect(titles()[0]).toBe("Synthetic M.Sc."); expect(document.activeElement).toBe(button("Synthetic M.Sc. nach unten verschieben"));
    move("Synthetic M.Sc.", "unten"); expect(document.activeElement).toBe(button("Synthetic M.Sc. nach unten verschieben"));
    expect(host.querySelector('[role="status"]')?.textContent).toContain("Synthetic M.Sc.");
  });
  it("does not lose/duplicate entries or assert anything while moving or attempting boundary moves", () => {
    placeCourse();
    move("Synthetic Internship", "oben"); move("Synthetic Short Course", "unten"); expect(titles()).toEqual(proposal);
    move("Synthetic Internship", "unten"); move("Synthetic Internship", "unten"); move("Synthetic Internship", "unten");
    expect(titles()).toEqual([proposal[1], proposal[2], proposal[3], proposal[0]]); expect(new Set(titles()).size).toBe(4);
    expect(assertions.applyExplicitReviewAssertions).not.toHaveBeenCalled();
  });
  it("confirms only positions 1..4 while all four classifications remain unresolved", () => {
    confirm();
    expect(assertions.applyExplicitReviewAssertions).toHaveBeenCalledWith(expect.anything(), { updates: [
      { sourceKey: input.stations[1].key, position: 1 }, { sourceKey: input.stations[2].key, position: 2 },
      { sourceKey: input.stations[0].key, position: 3 }, { sourceKey: input.stations[3].key, position: 4 },
    ] });
    const enriched = vi.mocked(assertions.applyExplicitReviewAssertions).mock.results[0].value as NormalizationInput;
    expect(enriched.stations.map(source => source.position)).toEqual([3, 1, 2, 4].map(value => ({ kind: "ASSERTED", value })));
    expect(vi.mocked(batch.normalizeCareerBatch).mock.results.at(-1)!.value.stations).toEqual(before.stations.map(source => ({ sourceKey: source.key, kind: "REVIEW_REQUIRED", unresolved: [{ field: "classification", reason: "CLASSIFICATION_UNCERTAIN" }] })));
    expect(host.textContent?.match(/Zu prüfen/g)).toHaveLength(4);
  });
  it("accepts local Degree choices before confirmation without inventing a canonical position", () => {
    placeCourse();
    review(); expect(assertions.applyExplicitReviewAssertions).not.toHaveBeenCalled();
    expect(host.querySelector('[role="alert"]')).toBeNull(); expect(host.querySelector('#normalization-heading')).toBeNull();
    expect(host.querySelector('[aria-labelledby="assertions-heading"]')?.textContent).toContain("Master");
    expect(document.activeElement?.id).toBe("assertions-heading");
  });
  it("builds one combined payload from original evidence, not sequential enrichment", () => {
    move("Synthetic M.Sc.", "oben"); confirm(); review();
    const calls = vi.mocked(assertions.applyExplicitReviewAssertions).mock.calls;
    expect(calls[1][0]).toBe(calls[0][0]); expect(calls[1][0]).toEqual(before);
    expect(calls[1][1]).toEqual({ updates: [
      { sourceKey: input.stations[2].key, position: 1, classification: { type: "DEGREE", level: "MASTER" }, degreeStatus: "COMPLETED" },
      { sourceKey: input.stations[1].key, position: 2 }, { sourceKey: input.stations[0].key, position: 3 }, { sourceKey: input.stations[3].key, position: 4 },
    ] });
    const enriched = vi.mocked(assertions.applyExplicitReviewAssertions).mock.results[1].value as NormalizationInput;
    for (const index of [0, 1, 3]) expect(enriched.stations[index]).toEqual({ ...before.stations[index], position: { kind: "ASSERTED", value: [3, 2, 1, 4][index] } });
    expect(host.querySelector('#normalization-heading')?.closest("article")?.querySelector("h3")?.textContent).toBe("Synthetic M.Sc.");
    expect(host.textContent).toContain("Teilweise normalisiert"); expect(host.textContent).toContain("Noch offene Angaben");
  });
  it("invalidates confirmed ordering and applied output after movement until explicitly reconfirmed", () => {
    confirm(); review(); move("Synthetic M.Sc.", "oben");
    expect(host.querySelector('#normalization-heading')).toBeNull(); expect(host.textContent).not.toMatch(/Entwurfsplatz [1-4]/);
    click("Auswahl im Entwurf anwenden"); expect(assertions.applyExplicitReviewAssertions).toHaveBeenCalledTimes(2);
    expect(host.querySelector('[aria-labelledby="assertions-heading"]')?.textContent).toContain("Master");
    confirm(); expect(vi.mocked(batch.normalizeCareerBatch).mock.results.at(-1)!.value.stations[2]).toMatchObject({ kind: "RESOLVED_DEGREE", position: 1 });
    expect(assertions.applyExplicitReviewAssertions).toHaveBeenCalledTimes(3);
  });
  it("resets the original proposal, confirmation, fields, outcome and logical focus", () => {
    move("Synthetic M.Sc.", "oben"); confirm(); review(); click("Entwurf zurücksetzen");
    expect(titles()).toEqual(proposal); for (const select of host.querySelectorAll("select")) expect(select.value).toBe("");
    expect(host.querySelector('#normalization-heading')).toBeNull(); expect(host.textContent).not.toMatch(/Entwurfsplatz [1-4]/);
    expect(document.activeElement?.id).toBe("timeline-heading"); placeCourse(); review(); expect(host.querySelector('#normalization-heading')).toBeNull();
    expect(host.textContent).toContain("Reihenfolge noch offen");
  });
  it("resets confirmation for replacement snapshot content even if source keys stay the same", () => {
    confirm(); review(); const replacement = structuredClone(before); replacement.stations[2].providerLabel = { kind: "OBSERVED", value: "Synthetic Revised Institution" };
    act(() => root.render(createElement(CareerReview, { input: replacement })));
    expect(host.querySelector('#normalization-heading')).toBeNull(); for (const select of host.querySelectorAll("select")) expect(select.value).toBe("");
    expect([...host.querySelectorAll("button")].some(button => button.textContent === "Prüfen")).toBe(false);
    expect(host.querySelector('[role="status"]')?.textContent).toContain("Alle Angaben bleiben zu prüfen");
    act(() => root.render(createElement(CareerReview, { input }))); placeCourse(); review(); expect(host.querySelector('#normalization-heading')).toBeNull(); expect(host.textContent).toContain("Reihenfolge noch offen");
  });
  it("redacts order confirmation failures and safely focuses the order action", () => {
    vi.mocked(assertions.applyExplicitReviewAssertions).mockImplementationOnce(() => { throw new Error("PRIVATE_ORDER_EXCEPTION"); }); confirm();
    expect(host.innerHTML).not.toContain("PRIVATE_ORDER_EXCEPTION"); expect(host.querySelector('[role="alert"]')).not.toBeNull();
    expect(document.activeElement).toBe(button("Reihenfolge für den Entwurf übernehmen"));
    expect(host.textContent).not.toMatch(/Entwurfsplatz [1-4]/);
  });
  it("retains source facts through movement and review, with no fake edit controls on other stations", () => {
    const facts = () => [...host.querySelectorAll('[aria-label="Beobachtete Quellangaben"]')].map(item => item.outerHTML).sort();
    const original = facts(); expect(original).toHaveLength(4); move("Synthetic M.Sc.", "oben"); confirm(); review(); expect(facts()).toEqual(original);
    for (const card of [...host.querySelectorAll("article")].filter(card => card.querySelector("h3")?.textContent !== "Synthetic M.Sc.")) {
      const trigger = card.querySelector<HTMLButtonElement>('[aria-label^="Details anzeigen:"]')!;
      expect(trigger).not.toBeNull(); act(() => trigger.click()); expect(card.textContent).toContain("späteren Schritt"); expect(card.querySelector("form")).toBeNull();
    }
    expect(host.querySelectorAll('[role="status"]')).toHaveLength(1);
    expect(host.textContent).not.toMatch(/ONGOING|Seit 2023|bis heute|Referenzabschluss ausgewählt/);
  });
});
