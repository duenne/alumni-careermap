// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import snapshot from "../../test-fixtures/linkedin-snapshots/fictional-member.json";
import { adaptLinkedInSnapshot } from "../../lib/normalization/adapt-linkedin-snapshot";
import * as assertions from "../../lib/normalization/apply-explicit-review-assertions";
import * as batch from "../../lib/normalization/normalize-career-batch";
import * as contract from "../../lib/normalization/validate";
import type { NormalizationInput, NormalizationResult } from "../../lib/normalization/contract";
import CareerReview from "./career-review";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root, host: HTMLDivElement, input: NormalizationInput, original: NormalizationInput;
function button(name: string) {
  const element = [...host.querySelectorAll("button")].find(item => (item.getAttribute("aria-label") ?? item.textContent) === name);
  expect(element, `Missing button ${name}`).toBeDefined(); return element!;
}
const click = (name: string) => act(() => button(name).click());
const confirm = () => click("Reihenfolge für den Entwurf übernehmen");
const apply = () => { if (!host.querySelector("form")) click("Prüfen: Synthetic M.Sc."); click("Auswahl im Entwurf anwenden"); };
function select(label: string, text: string) {
  if (![...host.querySelectorAll("label")].some(item => item.textContent === label)) click(label.startsWith("Platzierung") ? "Zeitlich einordnen: Synthetic Short Course" : "Prüfen: Synthetic M.Sc.");
  const field = [...host.querySelectorAll("label")].find(item => item.textContent === label)?.control as HTMLSelectElement;
  expect(field).toBeDefined(); const option = [...field.options].find(item => item.textContent === text); expect(option).toBeDefined();
  act(() => { field.value = option!.value; field.dispatchEvent(new Event("change", { bubbles: true })); }); return field;
}
function choices() { select("Art der Station", "Akademischer Abschluss"); select("Abschlussart", "Master"); select("Abschlussstatus", "Abgeschlossen"); }
function place() { select("Platzierung für Synthetic Short Course", "Vor Synthetic M.Sc."); click("Synthetic Short Course in den Entwurf einordnen"); }
function result(): NormalizationResult { return vi.mocked(batch.normalizeCareerBatch).mock.results.at(-1)!.value as NormalizationResult; }
const local = () => host.querySelector('[aria-labelledby="assertions-heading"]');
const canonical = () => host.querySelector('#normalization-heading');
beforeEach(() => {
  input = adaptLinkedInSnapshot(snapshot); original = structuredClone(input);
  vi.spyOn(assertions, "applyExplicitReviewAssertions"); vi.spyOn(batch, "normalizeCareerBatch"); vi.spyOn(contract, "validateNormalizationContract");
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  act(() => root.render(createElement(CareerReview, { input })));
});
afterEach(() => { act(() => root.unmount()); host.remove(); expect(input).toEqual(original); vi.restoreAllMocks(); });
describe("UI.2b.2 demo survey and independent review draft", () => {
  it("shows a read-only demo invitation context above the career overview", () => {
    const context = host.querySelector('[aria-labelledby="survey-context-heading"]')!;
    expect(context?.textContent).toContain("Hochschule München"); expect(context?.textContent).toContain("Management Sozialer Innovationen");
    expect(context?.textContent).toContain("Alumni-Karrierewege MSI"); expect(context?.textContent).toContain("Fiktive Befragung");
    expect(context?.textContent).toContain("nicht auswählen"); expect(context?.textContent).not.toMatch(/Fakultät|Bachelor|Master|Promotion/);
    expect(context?.querySelector("input, select, button, form")).toBeNull();
    expect(context?.compareDocumentPosition(host.querySelector('#timeline-heading')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(context?.innerHTML).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-|surveyId|programId|token|isReference/i);
  });
  it("does not accept user-controlled display strings as survey authority", () => {
    act(() => root.render(createElement(CareerReview, { input, ...{ program: "UNTRUSTED_PROGRAM", surveyId: "UNTRUSTED_ID", token: "UNTRUSTED_TOKEN" } })));
    expect(host.textContent).not.toMatch(/UNTRUSTED_/); expect(host.textContent).toContain("Management Sozialer Innovationen");
    expect(host.querySelector('[aria-labelledby="reference-heading"]')?.textContent).toContain("Noch nicht ausgewählt");
  });
  it("applies three explicit choices locally while a station is unplaced, without Phase E claims or a fabricated position", () => {
    choices(); apply();
    expect(local()?.textContent).toContain("Master"); expect(local()?.textContent).toContain("Abgeschlossen");
    expect(host.textContent).toContain("Im Entwurf geprüft"); expect(host.textContent).toContain("Reihenfolge noch offen");
    expect(canonical()).toBeNull(); expect(host.querySelector('ul[aria-label="Zeitlich noch einzuordnen"] article')).not.toBeNull();
    expect(assertions.applyExplicitReviewAssertions).not.toHaveBeenCalled(); expect(batch.normalizeCareerBatch).not.toHaveBeenCalled();
    expect(contract.validateNormalizationContract).not.toHaveBeenCalled();
    expect(document.activeElement?.id).toBe("assertions-heading");
    expect(host.textContent).not.toMatch(/Entwurfsplatz \d|RESOLVED_DEGREE|Normalisiert/);
  });
  it.each(["Art der Station", "Abschlussart", "Abschlussstatus"])("requires explicit %s even before ordering is confirmed", label => {
    choices(); select(label, "Bitte auswählen"); apply();
    expect(host.querySelector('[role="alert"]')).not.toBeNull(); expect(document.activeElement).toBe([...host.querySelectorAll("label")].find(item => item.textContent === label)?.control);
    expect(local()).toBeNull(); expect(assertions.applyExplicitReviewAssertions).not.toHaveBeenCalled();
  });
  it("does not treat selection alone as local review or normalize it when order is confirmed", () => {
    choices(); place(); confirm();
    expect(local()).toBeNull(); expect(result().stations.every(station => station.kind === "REVIEW_REQUIRED")).toBe(true);
    expect(vi.mocked(assertions.applyExplicitReviewAssertions).mock.calls[0][1]).toEqual({ updates: [
      { sourceKey: input.stations[1].key, position: 1 }, { sourceKey: input.stations[3].key, position: 2 },
      { sourceKey: input.stations[2].key, position: 3 }, { sourceKey: input.stations[0].key, position: 4 },
    ] });
  });
  it("normalizes the accepted local review only after separate complete-order confirmation", () => {
    choices(); apply(); place(); expect(assertions.applyExplicitReviewAssertions).not.toHaveBeenCalled(); confirm();
    expect(assertions.applyExplicitReviewAssertions).toHaveBeenCalledTimes(1);
    expect(vi.mocked(assertions.applyExplicitReviewAssertions).mock.calls[0][1]).toEqual({ updates: [
      { sourceKey: input.stations[1].key, position: 1 }, { sourceKey: input.stations[3].key, position: 2 },
      { sourceKey: input.stations[2].key, position: 3, classification: { type: "DEGREE", level: "MASTER" }, degreeStatus: "COMPLETED" },
      { sourceKey: input.stations[0].key, position: 4 },
    ] });
    expect(result().stations[2]).toEqual({ sourceKey: input.stations[2].key, kind: "RESOLVED_DEGREE", position: 3,
      canonical: { level: "MASTER", status: "COMPLETED", title: "Synthetic M.Sc.", fieldOfStudy: null, programId: null, institutionId: null, startYear: 2019, endYear: 2022, graduationYear: null },
      unresolved: [{ field: "graduationYear", reason: "MISSING" }, { field: "catalogAssociation", reason: "UNKNOWN" }] });
    for (const index of [0, 1, 3]) expect(result().stations[index]).toEqual({ sourceKey: input.stations[index].key, kind: "REVIEW_REQUIRED", unresolved: [{ field: "classification", reason: "CLASSIFICATION_UNCERTAIN" }] });
    const enriched = vi.mocked(assertions.applyExplicitReviewAssertions).mock.results[0].value as NormalizationInput;
    expect(enriched.stations.map(source => source.position)).toEqual([4, 1, 3, 2].map(value => ({ kind: "ASSERTED", value })));
    expect(contract.validateNormalizationContract).toHaveBeenCalledWith(enriched, result()); expect(document.activeElement?.id).toBe("normalization-heading");
    expect(host.textContent).toContain("Teilweise normalisiert"); expect(host.textContent).toContain("Noch offene Angaben");
    expect(host.querySelector('[aria-labelledby="reference-heading"]')?.textContent).toContain("Noch nicht ausgewählt");
  });
  it("retains accepted review when chronology changes, invalidating only the canonical result", () => {
    choices(); apply(); place(); confirm(); click("Synthetic M.Sc. nach oben verschieben");
    expect(canonical()).toBeNull(); expect(local()?.textContent).toContain("Master"); expect(host.textContent).toContain("Reihenfolge noch offen");
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Synthetic M.Sc. nach oben verschieben");
    confirm(); expect(result().stations[2]).toMatchObject({ kind: "RESOLVED_DEGREE", position: 2 });
    const calls = vi.mocked(assertions.applyExplicitReviewAssertions).mock.calls; expect(calls[1][0]).toBe(calls[0][0]); expect(calls[0][0]).toEqual(original);
  });
  it("editing choices discards their previous local application and canonical result until explicit reapplication", () => {
    choices(); apply(); place(); confirm(); select("Abschlussart", "Promotion");
    expect(canonical()).toBeNull(); expect(local()).toBeNull(); expect(assertions.applyExplicitReviewAssertions).toHaveBeenCalledTimes(1);
    apply(); expect(result().stations[2]).toMatchObject({ canonical: { level: "PHD", graduationYear: null } });
    expect(vi.mocked(assertions.applyExplicitReviewAssertions).mock.calls.every(([source]) => JSON.stringify(source) === JSON.stringify(original))).toBe(true);
  });
  it("does not replay edited but unapplied choices during a later ordering confirmation", () => {
    choices(); apply(); select("Abschlussart", "Bachelor"); place(); confirm();
    expect(result().stations.every(station => station.kind === "REVIEW_REQUIRED")).toBe(true); expect(local()).toBeNull();
    apply(); expect(result().stations[2]).toMatchObject({ canonical: { level: "BACHELOR" } });
  });
  it("resets local review and chronology together, with no reference or persistence claim", () => {
    choices(); apply(); place(); confirm(); click("Entwurf zurücksetzen");
    expect(local()).toBeNull(); expect(canonical()).toBeNull(); for (const field of host.querySelectorAll("select")) expect(field.value).toBe("");
    expect(host.querySelector('ul[aria-label="Zeitlich noch einzuordnen"] article')).not.toBeNull();
    expect(host.querySelector('[aria-labelledby="reference-heading"]')?.textContent).toContain("Noch nicht ausgewählt");
    expect(document.activeElement?.id).toBe("timeline-heading"); expect(host.textContent).toContain("Nur Demo – nichts gespeichert");
  });
  it("retains a valid local review when final normalization fails, without exposing source-bearing exceptions", () => {
    choices(); apply(); place(); vi.mocked(batch.normalizeCareerBatch).mockImplementationOnce(() => { throw new Error("PRIVATE_NORMALIZATION_EXCEPTION"); }); confirm();
    expect(local()?.textContent).toContain("Master"); expect(canonical()).toBeNull(); expect(host.querySelector('[role="alert"]')).not.toBeNull();
    expect(host.innerHTML).not.toContain("PRIVATE_NORMALIZATION_EXCEPTION"); expect(button("Reihenfolge für den Entwurf übernehmen").disabled).toBe(false);
    confirm(); expect(result().stations[2]).toMatchObject({ kind: "RESOLVED_DEGREE" });
  });
  it("clears local review and confirmed ordering when the snapshot context changes", () => {
    choices(); apply(); place(); confirm(); const replacement = structuredClone(original); replacement.stations[2].title = { kind: "OBSERVED", value: "Synthetic Changed Title" };
    act(() => root.render(createElement(CareerReview, { input: replacement })));
    expect(local()).toBeNull(); expect(canonical()).toBeNull(); for (const field of host.querySelectorAll("select")) expect(field.value).toBe("");
    expect(button("Reihenfolge für den Entwurf übernehmen").disabled).toBe(true);
  });
});
