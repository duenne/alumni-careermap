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
let root: Root;
let host: HTMLDivElement;
let input: NormalizationInput;
let before: NormalizationInput;

function freeze(value: unknown) {
  if (value !== null && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
}
function control(label: string): HTMLSelectElement | HTMLInputElement {
  const element = [...host.querySelectorAll("label")].find(item => item.textContent === label);
  const field = element?.control;
  if (!(field instanceof HTMLSelectElement || field instanceof HTMLInputElement)) throw new Error(`Missing labelled control: ${label}`);
  return field;
}
function change(label: string, value: string) {
  const field = control(label);
  act(() => {
    if (field instanceof HTMLInputElement) {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, value);
      field.dispatchEvent(new Event("input", { bubbles: true }));
    } else {
      field.value = value;
      field.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
}
function choose(label: string, text: string) {
  if (![...host.querySelectorAll("label")].some(item => item.textContent === label)) {
    click(label.startsWith("Platzierung") ? "Zeitlich einordnen" : "Prüfen");
  }
  const field = control(label) as HTMLSelectElement;
  const option = [...field.options].find(item => item.textContent === text);
  expect(option, `Missing German option ${text}`).toBeDefined();
  change(label, option!.value);
}
function click(text: string) {
  const button = [...host.querySelectorAll("button")].find(item => item.textContent === text);
  expect(button, `Missing button ${text}`).toBeDefined();
  act(() => button!.click());
}
function completeDraft(level = "Master", status = "Abgeschlossen", position = "1") {
  if (host.querySelector('ul[aria-label="Zeitlich noch einzuordnen"]')) {
    choose("Platzierung für Synthetic Short Course", "Nach Synthetic Research Assistant"); click("In den Entwurf einordnen");
  }
  const orderButton = [...host.querySelectorAll("button")].find(button => button.textContent === "Reihenfolge für den Entwurf übernehmen")!;
  if (!orderButton.disabled) {
    if (position === "1") act(() => host.querySelector<HTMLButtonElement>('[aria-label="Synthetic M.Sc. nach oben verschieben"]')!.click());
    click("Reihenfolge für den Entwurf übernehmen");
  }
  choose("Art der Station", "Akademischer Abschluss");
  choose("Abschlussart", level);
  choose("Abschlussstatus", status);
}
const apply = () => click("Auswahl im Entwurf anwenden");
function result(): NormalizationResult {
  const calls = vi.mocked(batch.normalizeCareerBatch).mock.results;
  return calls[calls.length - 1].value as NormalizationResult;
}

beforeEach(() => {
  input = adaptLinkedInSnapshot(snapshot);
  before = structuredClone(input);
  freeze(input);
  vi.spyOn(assertions, "applyExplicitReviewAssertions");
  vi.spyOn(batch, "normalizeCareerBatch");
  vi.spyOn(contract, "validateNormalizationContract");
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root.render(createElement(CareerReview, { input })));
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  expect(input).toStrictEqual(before);
  vi.restoreAllMocks();
});

describe("UI.2a real Degree review interactions", () => {
  it("starts with four source observations, all blank controls and no assertion calls", () => {
    expect(host.querySelectorAll("article")).toHaveLength(4);
    expect(host.querySelector("form")).toBeNull(); click("Prüfen");
    expect(host.querySelectorAll("form")).toHaveLength(1);
    for (const label of ["Art der Station", "Abschlussart", "Abschlussstatus"]) expect(control(label).value).toBe("");
    expect(host.querySelector("input")).toBeNull();
    expect(assertions.applyExplicitReviewAssertions).not.toHaveBeenCalled();
    expect(batch.normalizeCareerBatch).not.toHaveBeenCalled();
    expect(host.querySelector('[aria-labelledby="normalization-heading"]')).toBeNull();
    expect(host.textContent).toContain("Nur Demo – nichts gespeichert");
  });

  it("keeps Degree decisions independent and waits for explicit application", () => {
    choose("Art der Station", "Akademischer Abschluss");
    expect(control("Abschlussart").value).toBe("");
    choose("Abschlussart", "Bachelor");
    expect(control("Abschlussstatus").value).toBe("");
    choose("Abschlussstatus", "Abgeschlossen");
    expect(assertions.applyExplicitReviewAssertions).not.toHaveBeenCalled();
    expect(batch.normalizeCareerBatch).not.toHaveBeenCalled();
  });

  it("applies real assertions, resolves exactly one Master and shows the exact open decisions", () => {
    completeDraft();
    apply();
    expect(assertions.applyExplicitReviewAssertions).toHaveBeenLastCalledWith(expect.anything(), { updates: [{
      sourceKey: input.stations[2].key, classification: { type: "DEGREE", level: "MASTER" }, degreeStatus: "COMPLETED", position: 1,
    }, { sourceKey: input.stations[1].key, position: 2 }, { sourceKey: input.stations[0].key, position: 3 }, { sourceKey: input.stations[3].key, position: 4 }] });
    const output = result();
    expect(output.stations.map(station => station.kind)).toEqual(["REVIEW_REQUIRED", "REVIEW_REQUIRED", "RESOLVED_DEGREE", "REVIEW_REQUIRED"]);
    expect(output.stations[2]).toEqual({
      sourceKey: input.stations[2].key, kind: "RESOLVED_DEGREE", position: 1,
      canonical: { level: "MASTER", status: "COMPLETED", title: "Synthetic M.Sc.", fieldOfStudy: null,
        programId: null, institutionId: null, startYear: 2019, endYear: 2022, graduationYear: null },
      unresolved: [{ field: "graduationYear", reason: "MISSING" }, { field: "catalogAssociation", reason: "UNKNOWN" }],
    });
    const enriched = vi.mocked(assertions.applyExplicitReviewAssertions).mock.results[1].value as NormalizationInput;
    expect(contract.validateNormalizationContract).toHaveBeenCalledWith(enriched, output);
    for (const index of [0, 1, 3]) {
      expect(enriched.stations[index]).toStrictEqual({ ...before.stations[index], position: { kind: "ASSERTED", value: [3, 2, 1, 4][index] } });
      expect(output.stations[index]).toEqual({ sourceKey: before.stations[index].key, kind: "REVIEW_REQUIRED", unresolved: [{ field: "classification", reason: "CLASSIFICATION_UNCERTAIN" }] });
    }
    expect([...host.querySelectorAll('[aria-label="Noch offene Entscheidungen"] li')].map(item => item.textContent)).toEqual([
      "Abschlussjahr: nicht angegeben.", "Katalogzuordnung: unbekannt.",
    ]);
    expect(host.querySelector('[aria-labelledby="assertions-heading"]')?.textContent).toContain("Master");
    expect(host.querySelector('[aria-labelledby="normalization-heading"]')?.textContent).toContain("Nicht angegeben");
    expect(document.activeElement?.id).toBe("normalization-heading");
    expect(host.querySelector('[role="status"]')?.textContent).toContain("3 weitere Angaben bleiben ungeprüft");
  });

  it.each([
    ["Bachelor", "BACHELOR"], ["Master", "MASTER"], ["Promotion", "PHD"], ["Diplom", "DIPLOMA"],
    ["Akademisches Zertifikat", "CERTIFICATE"], ["Anderer akademischer Abschluss", "OTHER"],
  ])("uses the explicitly selected %s independently of the source title", (label, level) => {
    completeDraft(label);
    apply();
    expect(result().stations[2]).toMatchObject({ kind: "RESOLVED_DEGREE", canonical: { level } });
  });

  it("retains explicit unknown status and withholds the observed attendance end", () => {
    completeDraft("Master", "Unbekannt");
    apply();
    expect(result().stations[2]).toMatchObject({ kind: "RESOLVED_DEGREE", canonical: { status: "UNKNOWN", endYear: null, graduationYear: null },
      unresolved: [{ field: "status", reason: "UNKNOWN" }, { field: "endYear", reason: "STATUS_UNCERTAIN" },
        { field: "graduationYear", reason: "MISSING" }, { field: "catalogAssociation", reason: "UNKNOWN" }] });
    expect(host.querySelectorAll('[aria-label="Noch offene Entscheidungen"] li')).toHaveLength(4);
  });

  it("shows an in-progress/end-date conflict without manufacturing a canonical Degree", () => {
    completeDraft("Master", "Noch im Studium");
    apply();
    expect(result().stations[2]).toEqual({ sourceKey: input.stations[2].key, kind: "REVIEW_REQUIRED", unresolved: [{ field: "endYear", reason: "CONFLICTING_FACTS" }] });
    expect(host.querySelector('[aria-labelledby="normalization-heading"]')?.textContent).toContain("Keine sichere Einordnung");
    expect(host.textContent).toContain("Endjahr: Angaben widersprechen sich.");
  });

  it("retains an explicitly ended study without inventing graduation", () => {
    completeDraft("Master", "Ohne Abschluss beendet");
    apply();
    expect(result().stations[2]).toMatchObject({ kind: "RESOLVED_DEGREE", canonical: { status: "ENDED_WITHOUT_DEGREE", graduationYear: null } });
  });

  it("revises from original evidence only after a second explicit action", () => {
    completeDraft(); apply();
    const calls = vi.mocked(assertions.applyExplicitReviewAssertions);
    const original = calls.mock.calls[0][0];
    choose("Abschlussart", "Promotion");
    expect(calls).toHaveBeenCalledTimes(2);
    expect(host.querySelector('[aria-labelledby="normalization-heading"]')).toBeNull();
    apply();
    expect(calls).toHaveBeenCalledTimes(3);
    expect(calls.mock.calls[2][0]).toBe(original);
    expect(original).toStrictEqual(before);
    expect(result().stations[2]).toMatchObject({ canonical: { level: "PHD", graduationYear: null } });
  });

  it("resets selections, results and focus, then applies a fresh complete draft", () => {
    completeDraft(); apply();
    click("Entwurf zurücksetzen");
    expect(host.querySelector('[aria-labelledby="normalization-heading"]')).toBeNull();
    expect(document.activeElement?.id).toBe("timeline-heading");
    expect(host.querySelector("form")).toBeNull(); click("Prüfen");
    for (const label of ["Art der Station", "Abschlussart", "Abschlussstatus"]) expect(control(label).value).toBe("");
    expect(host.querySelector('[role="status"]')?.textContent).toContain("zurückgesetzt");
    completeDraft("Bachelor", "Abgeschlossen", "2"); apply();
    expect(result().stations[2]).toMatchObject({ position: 2, canonical: { level: "BACHELOR" } });
    expect(vi.mocked(assertions.applyExplicitReviewAssertions).mock.calls.every(([original]) => JSON.stringify(original) === JSON.stringify(before))).toBe(true);
  });

  it.each([0, 1, 2, 3, 4, 5, 6])("derives positive unique positions only from explicitly confirmed movement, variant %i", steps => {
    for (let step = 0; step < steps; step++) {
      const down = host.querySelector<HTMLButtonElement>('[aria-label="Synthetic Internship nach unten verschieben"]')!;
      act(() => (down.disabled ? host.querySelector<HTMLButtonElement>('[aria-label="Synthetic Internship nach oben verschieben"]')! : down).click());
    }
    expect(assertions.applyExplicitReviewAssertions).not.toHaveBeenCalled();
    choose("Platzierung für Synthetic Short Course", "Nach Synthetic Research Assistant"); click("In den Entwurf einordnen");
    click("Reihenfolge für den Entwurf übernehmen");
    const enriched = vi.mocked(assertions.applyExplicitReviewAssertions).mock.results[0].value as NormalizationInput;
    expect(enriched.stations.map(source => source.position.kind === "ASSERTED" ? source.position.value : 0).sort()).toEqual([1, 2, 3, 4]);
    expect(result().stations.every(station => station.kind === "REVIEW_REQUIRED")).toBe(true);
  });

  it.each(["Art der Station", "Abschlussart", "Abschlussstatus"])("requires an explicit %s selection", label => {
    completeDraft(); change(label, ""); apply();
    expect(assertions.applyExplicitReviewAssertions).toHaveBeenCalledTimes(1);
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
    expect(document.activeElement).toBe(control(label));
  });

  it.each(["assertions", "normalization", "validation"])("redacts source-bearing %s exceptions", stage => {
    completeDraft();
    const fail = () => { throw new Error("PRIVATE_SOURCE_BEARING_EXCEPTION"); };
    if (stage === "assertions") vi.mocked(assertions.applyExplicitReviewAssertions).mockImplementationOnce(fail);
    if (stage === "normalization") vi.mocked(batch.normalizeCareerBatch).mockImplementationOnce(fail);
    if (stage === "validation") vi.mocked(contract.validateNormalizationContract).mockImplementationOnce(fail);
    apply();
    expect(host.querySelector('[role="alert"]')?.textContent).toBe("Der Entwurf konnte nicht geprüft werden. Bitte setzen Sie ihn zurück und versuchen Sie es erneut.");
    expect(host.innerHTML).not.toContain("PRIVATE_SOURCE_BEARING_EXCEPTION");
    expect(host.querySelector('[aria-labelledby="normalization-heading"]')).toBeNull();
  });

  it("rejects a failed contract check without showing a partial result", () => {
    completeDraft();
    vi.mocked(contract.validateNormalizationContract).mockReturnValueOnce({ ok: false, diagnostics: [] });
    apply();
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
    expect(host.querySelector('[aria-labelledby="normalization-heading"]')).toBeNull();
  });

  it("clears local drafts when the presented source context is replaced", () => {
    completeDraft(); apply();
    const replacement = structuredClone(before);
    replacement.stations.forEach((station, index) => { station.key = `changed-context:${index}`; });
    act(() => root.render(createElement(CareerReview, { input: replacement })));
    expect(host.querySelector("form")).toBeNull();
    expect(host.querySelector('[aria-labelledby="normalization-heading"]')).toBeNull();
    expect([...host.querySelectorAll("button")].some(button => button.textContent === "Prüfen")).toBe(false);
    expect(host.querySelector('[role="status"]')?.textContent).toContain("Alle Angaben bleiben zu prüfen");
    act(() => root.render(createElement(CareerReview, { input })));
    completeDraft(); apply(); expect(result().stations[2].sourceKey).toBe(before.stations[2].key);
  });

  it("keeps all source observations unchanged, excludes private fields and uses readable labels", () => {
    const sourceFacts = () => [...host.querySelectorAll('[aria-label="Beobachtete Quellangaben"]')].map(card => card.outerHTML).sort();
    const cards = sourceFacts();
    completeDraft(); apply();
    expect(sourceFacts()).toEqual(cards);
    for (const value of Object.values(snapshot.elements[0].snapshotData[0])) expect(host.innerHTML).not.toContain(value);
    expect(host.innerHTML).not.toMatch(/FICTIONAL_|fictional-private|snapshot:/);
    expect(host.textContent).not.toMatch(/BACHELOR|MASTER|COMPLETED|UNKNOWN|MISSING|RESOLVED_DEGREE|catalogAssociation/);
    expect(host.querySelector('[role="status"]')?.getAttribute("aria-live")).toBe("polite");
  });
});
