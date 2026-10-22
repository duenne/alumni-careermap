import { describe, expect, it } from "vitest";
import snapshot from "../../test-fixtures/linkedin-snapshots/fictional-member.json";
import { adaptLinkedInSnapshot } from "../normalization/adapt-linkedin-snapshot";
import { previewReview, type ReviewDrafts } from "./preview";

const source = () => adaptLinkedInSnapshot(snapshot);
const draft = (classification = "", status = "", position = "") => ({ classification, status, position });
function preview(drafts: ReviewDrafts) {
  const input = source(), before = structuredClone({ input, drafts });
  const result = previewReview(input, drafts);
  expect({ input, drafts }).toEqual(before);
  return result;
}
describe("fictional review draft preview", () => {
  it("starts with four target-free reviews and no assumed classifications", () => {
    expect(preview({})).toEqual({ ok: true, result: { stations: [
      { sourceKey: "snapshot:1:0", kind: "REVIEW_REQUIRED", unresolved: [{ field: "classification", reason: "CLASSIFICATION_UNCERTAIN" }] },
      { sourceKey: "snapshot:1:1", kind: "REVIEW_REQUIRED", unresolved: [{ field: "classification", reason: "CLASSIFICATION_UNCERTAIN" }] },
      { sourceKey: "snapshot:2:0", kind: "REVIEW_REQUIRED", unresolved: [{ field: "classification", reason: "CLASSIFICATION_UNCERTAIN" }] },
      { sourceKey: "snapshot:2:1", kind: "REVIEW_REQUIRED", unresolved: [{ field: "classification", reason: "CLASSIFICATION_UNCERTAIN" }] },
    ] } });
  });
  it("projects explicit draft choices without selecting catalogs or inventing graduation", () => {
    const result = preview({ "snapshot:2:0": draft("DEGREE:MASTER", "COMPLETED", "1"), "snapshot:1:0": draft("CAREER_STEP:EMPLOYMENT", "ONGOING", "3") });
    expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.result.stations[0]).toEqual({ sourceKey: "snapshot:1:0", kind: "RESOLVED_CAREER_STEP", position: 3,
      canonical: { type: "EMPLOYMENT", temporalStatus: "ONGOING", roleTitle: "Synthetic Research Assistant", roleCategory: null,
        functionArea: null, location: null, organisationId: null, startYear: 2023, endYear: null },
      unresolved: [{ field: "endYear", reason: "MISSING" }, { field: "catalogAssociation", reason: "UNKNOWN" }] });
    expect(result.result.stations[2]).toEqual({ sourceKey: "snapshot:2:0", kind: "RESOLVED_DEGREE", position: 1,
      canonical: { level: "MASTER", status: "COMPLETED", title: "Synthetic M.Sc.", fieldOfStudy: null, programId: null,
        institutionId: null, startYear: 2019, endYear: 2022, graduationYear: null },
      unresolved: [{ field: "graduationYear", reason: "MISSING" }, { field: "catalogAssociation", reason: "UNKNOWN" }] });
    expect(result.result.stations.map(s => s.sourceKey)).toEqual(["snapshot:1:0", "snapshot:1:1", "snapshot:2:0", "snapshot:2:1"]);
  });
  it("leaves status UNKNOWN when a classified station has no explicit status", () => {
    const result = preview({ "snapshot:1:0": draft("CAREER_STEP:EMPLOYMENT", "", "3") });
    expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.result.stations[0]).toMatchObject({ kind: "RESOLVED_CAREER_STEP", canonical: { temporalStatus: "UNKNOWN", endYear: null },
      unresolved: [{ field: "temporalStatus", reason: "MISSING" }, { field: "endYear", reason: "MISSING" }, { field: "catalogAssociation", reason: "UNKNOWN" }] });
  });
  it("keeps a missing position target-free", () => {
    const result = preview({ "snapshot:2:0": draft("DEGREE:MASTER", "COMPLETED") });
    expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.result.stations[2]).toEqual({ sourceKey: "snapshot:2:0", kind: "REVIEW_REQUIRED", unresolved: [{ field: "position", reason: "MISSING" }] });
  });
  it("shows ongoing/end contradictions as reviews", () => {
    const result = preview({ "snapshot:1:1": draft("CAREER_STEP:INTERNSHIP", "ONGOING", "2") });
    expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.result.stations[1]).toEqual({ sourceKey: "snapshot:1:1", kind: "REVIEW_REQUIRED", unresolved: [{ field: "endYear", reason: "CONFLICTING_FACTS" }] });
  });
  it.each(["0", "-1", "1.5", "1e3", "not-a-position", "9007199254740992"])("rejects invalid position %s", position => {
    expect(preview({ "snapshot:1:0": draft("", "", position) })).toEqual({ ok: false, message: "Bitte gib eine positive ganze Zahl für die Reihenfolge ein." });
  });
  it("rejects duplicate positions even for unclassified stations", () => {
    expect(preview({ "snapshot:1:0": draft("", "", "1"), "snapshot:2:0": draft("", "", "1") })).toEqual({ ok: false,
      message: "Bitte prüfe deine Auswahl. Jede Reihenfolge darf nur einmal vergeben werden." });
  });
  it.each<ReviewDrafts>([
    { "unknown-source": draft("DEGREE:MASTER") }, { "snapshot:1:0": draft("invented-kind") },
    { "snapshot:1:0": draft("CAREER_STEP:EMPLOYMENT", "COMPLETED", "1") },
    { "snapshot:1:0": draft("", "ONGOING", "1") },
  ])("rejects invalid draft selection without source text in errors: %#", drafts => {
    expect(preview(drafts)).toEqual({ ok: false, message: "Bitte prüfe deine Auswahl. Jede Reihenfolge darf nur einmal vergeben werden." });
  });
  it("recomputes edited drafts from original observations and supports frozen data", () => {
    const input = source(), before = structuredClone(input);
    function freeze(value: unknown) { if (value !== null && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } }
    freeze(input);
    const first = previewReview(input, { "snapshot:2:0": draft("DEGREE:MASTER", "COMPLETED", "1") });
    const second = previewReview(input, { "snapshot:2:0": draft("DEGREE:PHD", "COMPLETED", "1") });
    expect(first.ok).toBe(true); expect(second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(first.result.stations[2]).toMatchObject({ canonical: { level: "MASTER" } });
      expect(second.result.stations[2]).toMatchObject({ canonical: { level: "PHD" } });
      expect(first.result).not.toBe(second.result);
    }
    expect(input).toEqual(before);
  });
});
