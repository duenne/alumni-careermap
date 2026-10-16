import { describe, expect, it } from "vitest";
import fictionalSnapshot from "../../test-fixtures/linkedin-snapshots/fictional-member.json";
import {
  conflictingExpected, conflictingUpdates, partialExpected, partialUpdates,
  reviewedCareerExpected, reviewedCareerUpdates, uncertainDegreeExpected, uncertainDegreeUpdates, unreviewedExpected,
} from "../../test-fixtures/linkedin-snapshots/reviewed-career.expected";
import type { ContractValidation, NormalizationInput, NormalizationResult } from "./contract";
import { adaptLinkedInSnapshot } from "./adapt-linkedin-snapshot";
import { applyExplicitReviewAssertions, type ExplicitReviewUpdates } from "./apply-explicit-review-assertions";
import { normalizeCareerBatch } from "./normalize-career-batch";
import { validateNormalizationContract } from "./validate";

type Trace = { observed: NormalizationInput; enriched: NormalizationInput; result: NormalizationResult; validation: ContractValidation };
const sourceKeys = ["snapshot:1:0", "snapshot:1:1", "snapshot:2:0", "snapshot:2:1"];
const missing = { kind: "MISSING" } as const;

// Private test harness only; all four production functions are called directly.
// No production function is replaced, mocked, spied on or reimplemented here.
function processSnapshot(snapshot: unknown, updates: ExplicitReviewUpdates): Trace {
  const snapshotBefore = structuredClone(snapshot), updatesBefore = structuredClone(updates);
  const observed = adaptLinkedInSnapshot(snapshot);
  const observedBefore = structuredClone(observed);
  const enriched = applyExplicitReviewAssertions(observed, updates);
  const enrichedBefore = structuredClone(enriched);
  const result = normalizeCareerBatch(enriched);
  const resultBefore = structuredClone(result);
  const validation = validateNormalizationContract(enriched, result);
  expect(snapshot).toStrictEqual(snapshotBefore); expect(updates).toStrictEqual(updatesBefore);
  expect(observed).toStrictEqual(observedBefore); expect(enriched).toStrictEqual(enrichedBefore);
  expect(result).toStrictEqual(resultBefore);
  return { observed, enriched, result, validation };
}
// Strict independent comparison: no projection, filtering, defaults or sorting.
const compare = (actual: unknown, expected: NormalizationResult) => expect(actual).toStrictEqual(expected);
function execute(expected = reviewedCareerExpected, updates = structuredClone(reviewedCareerUpdates), snapshot = structuredClone(fictionalSnapshot)) {
  const trace = processSnapshot(snapshot, updates);
  compare(trace.result, expected);
  expect(trace.validation).toStrictEqual({ ok: true, diagnostics: [] });
  expect(validateNormalizationContract(trace.enriched, trace.result)).toStrictEqual({ ok: true, diagnostics: [] });
  expect(validateNormalizationContract(trace.observed, unreviewedExpected)).toStrictEqual({ ok: true, diagnostics: [] });
  expect(trace.observed.stations.map(s => s.key)).toStrictEqual(sourceKeys);
  expect(trace.enriched.stations.map(s => s.key)).toStrictEqual(sourceKeys);
  expect(trace.result.stations.map(s => s.sourceKey)).toStrictEqual(sourceKeys);
  for (const [index, source] of trace.observed.stations.entries()) {
    for (const field of ["classification", "degreeStatus", "temporalStatus", "graduation", "position"] as const) expect(source[field]).toStrictEqual(missing);
    expect(source.catalog).toStrictEqual({ kind: "UNKNOWN" });
    for (const field of ["title", "category", "providerLabel", "start", "end", "graduation"] as const) {
      expect(trace.enriched.stations[index][field]).toStrictEqual(source[field]);
    }
  }
  for (const outcome of trace.result.stations) {
    if (outcome.kind === "REVIEW_REQUIRED") expect(Object.keys(outcome).sort()).toStrictEqual(["kind", "sourceKey", "unresolved"]);
  }
  return trace;
}
function objects(value: unknown, found = new Set<object>()): Set<object> {
  if (value !== null && typeof value === "object" && !found.has(value)) {
    found.add(value); Object.values(value).forEach(child => objects(child, found));
  }
  return found;
}
function employment(result: NormalizationResult) {
  const station = result.stations[0];
  if (station.kind !== "RESOLVED_CAREER_STEP") throw new Error("Expected synthetic employment");
  return station;
}
function degree(result: NormalizationResult) {
  const station = result.stations[2];
  if (station.kind !== "RESOLVED_DEGREE") throw new Error("Expected synthetic Degree");
  return station;
}

describe("E.4b.2 synthetic in-memory career pipeline (real implementations)", () => {
  it("matches all four source outcomes, every canonical scalar and all eight exact decisions", () => {
    const { result } = execute();
    expect(result.stations.map(s => s.kind)).toStrictEqual(["RESOLVED_CAREER_STEP", "REVIEW_REQUIRED", "RESOLVED_DEGREE", "RESOLVED_CAREER_STEP"]);
    expect(result.stations.map(s => s.kind === "REVIEW_REQUIRED" ? null : s.position)).toStrictEqual([3, null, 1, 5]);
    expect(result.stations.reduce((count, s) => count + s.unresolved.length, 0)).toBe(8);
  });
  it("leaves all four observations target-free before explicit review", () => {
    execute(unreviewedExpected, { updates: [] });
  });
  it("keeps graduation absent, imprecise course dates uncertain and the internship untouched", () => {
    const { observed, enriched, result } = execute();
    expect(observed.stations[2].end).toStrictEqual({ kind: "OBSERVED", value: { precision: "YEAR", year: 2022 } });
    expect(enriched.stations[2].degreeStatus).toStrictEqual({ kind: "ASSERTED", value: "COMPLETED" });
    expect(enriched.stations[2].graduation).toStrictEqual(missing);
    expect(degree(result).canonical.graduationYear).toBeNull();
    expect(enriched.stations[0].temporalStatus).toStrictEqual({ kind: "ASSERTED", value: "ONGOING" });
    expect(observed.stations[0].end).toStrictEqual(missing);
    expect(enriched.stations[3].start).toStrictEqual({ kind: "OBSERVED", value: { precision: "IMPRECISE", text: "around 2018" } });
    expect(enriched.stations[1]).toStrictEqual(observed.stations[1]);
    expect(result.stations[1]).toStrictEqual(unreviewedExpected.stations[1]);
  });
  it("retains ONGOING with an observed internship end as target-free CONFLICTING_FACTS", () => {
    const { enriched, result } = execute(conflictingExpected, structuredClone(conflictingUpdates));
    expect(enriched.stations[1].end).toStrictEqual({ kind: "OBSERVED", value: { precision: "MONTH", year: 2020, month: 2 } });
    expect(enriched.stations[1].temporalStatus).toStrictEqual({ kind: "ASSERTED", value: "ONGOING" });
    expect(result.stations[1]).not.toHaveProperty("canonical"); expect(result.stations[1]).not.toHaveProperty("position");
  });
  it("keeps partial review, missing positions, missing status and unknown catalogs explicit", () => {
    const { enriched } = execute(partialExpected, structuredClone(partialUpdates));
    expect(enriched.stations[2].position).toStrictEqual(missing);
    expect(enriched.stations[0].temporalStatus).toStrictEqual(missing);
    expect(enriched.stations[3].classification).toStrictEqual(missing);
    for (const source of enriched.stations) expect(source.catalog).toStrictEqual({ kind: "UNKNOWN" });
  });
  it("does not infer Degree completion or canonical end from the observed attendance end", () => {
    const { enriched, result } = execute(uncertainDegreeExpected, structuredClone(uncertainDegreeUpdates));
    expect(enriched.stations[2].degreeStatus).toStrictEqual(missing);
    expect(degree(result).canonical).toStrictEqual({ level: "MASTER", status: "UNKNOWN", title: "Synthetic M.Sc.", fieldOfStudy: null,
      programId: null, institutionId: null, startYear: 2019, endYear: null, graduationYear: null });
  });
  it("excludes all fictional PROFILE values, provider identifiers and narrative/location fields from results", () => {
    const { result } = execute();
    const serialized = JSON.stringify(result);
    for (const value of Object.values(fictionalSnapshot.elements[0].snapshotData[0])) expect(serialized).not.toContain(value);
    for (const value of ["fictional-private-position-id", "fictional-private-education-id", "FICTIONAL_DESCRIPTION_DO_NOT_COPY",
      "FICTIONAL_POSITION_LOCATION_DO_NOT_COPY", "FICTIONAL_ACTIVITIES_DO_NOT_COPY", "FICTIONAL_NOTES_DO_NOT_COPY"]) expect(serialized).not.toContain(value);
    expect(serialized).not.toMatch(/"(?:alumni|providerId|profileUrl|email|referenceDegreeId|surveyResponse|confirmedAt|rawProfile|description|notes|activities)"\s*:/i);
  });
  it("accepts frozen snapshot/updates and preserves them and the authored oracle", () => {
    const snapshot = structuredClone(fictionalSnapshot), updates = structuredClone(reviewedCareerUpdates);
    const before = structuredClone({ snapshot, updates, expected: reviewedCareerExpected });
    function freeze(value: unknown) { if (value !== null && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } }
    freeze(snapshot); freeze(updates);
    execute(reviewedCareerExpected, updates, snapshot);
    expect({ snapshot, updates, expected: reviewedCareerExpected }).toStrictEqual(before);
  });
  it("is deterministic with independent result objects and no shared mutable stage references", () => {
    const snapshot = structuredClone(fictionalSnapshot), updates = structuredClone(reviewedCareerUpdates);
    const first = execute(reviewedCareerExpected, updates, snapshot), second = execute(reviewedCareerExpected, updates, snapshot);
    expect(first).toStrictEqual(second);
    const graphs = [snapshot, updates, first.observed, first.enriched, first.result, second.result].map(value => objects(value));
    for (const [index, graph] of graphs.entries()) for (const other of graphs.slice(index + 1)) {
      expect([...graph].some(object => other.has(object))).toBe(false);
    }
    employment(first.result).canonical.roleTitle = "Changed result only";
    first.result.stations[0].unresolved[0].reason = "UNKNOWN";
    compare(second.result, reviewedCareerExpected);
    expect(first.observed).toStrictEqual(second.observed); expect(first.enriched).toStrictEqual(second.enriched);
    expect(snapshot).toStrictEqual(fictionalSnapshot); expect(updates).toStrictEqual(reviewedCareerUpdates);
    compare(execute().result, reviewedCareerExpected);
  });
  it("demonstrates key reassignment when snapshot domains are reordered", () => {
    const before = execute(unreviewedExpected, { updates: [] });
    const snapshot = structuredClone(fictionalSnapshot);
    snapshot.elements = [snapshot.elements[0], snapshot.elements[2], snapshot.elements[1]];
    // No stale assertions are replayed onto this different snapshot context.
    const after = execute(unreviewedExpected, { updates: [] }, snapshot);
    expect(before.observed.stations.map(s => [s.key, s.title])).toStrictEqual([
      ["snapshot:1:0", { kind: "OBSERVED", value: "Synthetic Research Assistant" }],
      ["snapshot:1:1", { kind: "OBSERVED", value: "Synthetic Internship" }],
      ["snapshot:2:0", { kind: "OBSERVED", value: "Synthetic M.Sc." }],
      ["snapshot:2:1", { kind: "OBSERVED", value: "Synthetic Short Course" }],
    ]);
    expect(after.observed.stations.map(s => [s.key, s.title])).toStrictEqual([
      ["snapshot:1:0", { kind: "OBSERVED", value: "Synthetic M.Sc." }],
      ["snapshot:1:1", { kind: "OBSERVED", value: "Synthetic Short Course" }],
      ["snapshot:2:0", { kind: "OBSERVED", value: "Synthetic Research Assistant" }],
      ["snapshot:2:1", { kind: "OBSERVED", value: "Synthetic Internship" }],
    ]);
    expect(after.result).toStrictEqual(before.result); // Same tokens/reviews do not establish the same snapshot identity.
  });
  it("demonstrates key reassignment within a domain when source records are reordered", () => {
    const before = execute(unreviewedExpected, { updates: [] });
    const snapshot = structuredClone(fictionalSnapshot); snapshot.elements[1].snapshotData.reverse();
    const after = execute(unreviewedExpected, { updates: [] }, snapshot);
    expect(before.observed.stations[0].key).toBe(after.observed.stations[0].key);
    expect(after.observed.stations[0].title).toStrictEqual({ kind: "OBSERVED", value: "Synthetic Internship" });
    expect(after.observed.stations[1].title).toStrictEqual({ kind: "OBSERVED", value: "Synthetic Research Assistant" });
    expect(after.observed.stations[0].title).not.toStrictEqual(before.observed.stations[0].title);
  });

  const mutations: [string, boolean, (result: NormalizationResult) => void][] = [
    ["canonical CareerStep type", false, result => { employment(result).canonical.type = "INTERNSHIP"; }],
    ["temporal status", false, result => { employment(result).canonical.temporalStatus = "ENDED"; }],
    ["invented graduation year", false, result => { degree(result).canonical.graduationYear = 2022; }],
    ["asserted position", false, result => { employment(result).position = 4; }],
    ["unconfirmed catalog identity", false, result => { employment(result).canonical.organisationId = "00000000-0000-4000-8000-00000000e421"; }],
    ["fabricated review target", false, result => { result.stations[1] = { sourceKey: "snapshot:1:1", kind: "RESOLVED_CAREER_STEP", position: 7,
      canonical: { type: "INTERNSHIP", temporalStatus: "ENDED", roleTitle: "Synthetic Internship", roleCategory: null, functionArea: null,
        location: null, organisationId: null, startYear: 2019, endYear: 2020 }, unresolved: [{ field: "catalogAssociation", reason: "UNKNOWN" }] }; }],
    ["year guessed from imprecise course date", false, result => { const course = result.stations[3]; if (course.kind !== "RESOLVED_CAREER_STEP") throw new Error("Expected synthetic course"); course.canonical.startYear = 2018; }],
    ["Degree target replaced with CareerStep", false, result => { result.stations[2] = { sourceKey: "snapshot:2:0", kind: "RESOLVED_CAREER_STEP", position: 1,
      canonical: { type: "EDUCATION", temporalStatus: "ENDED", roleTitle: "Synthetic M.Sc.", roleCategory: null, functionArea: null,
        location: null, organisationId: null, startYear: 2019, endYear: 2022 }, unresolved: [{ field: "catalogAssociation", reason: "UNKNOWN" }] }; }],
    ["unnecessary review instead of resolved Degree", true, result => { result.stations[2] = { sourceKey: "snapshot:2:0", kind: "REVIEW_REQUIRED",
      unresolved: [{ field: "classification", reason: "CONFLICTING_FACTS" }] }; }],
    ["missing optional-field decision", true, result => { result.stations[0].unresolved.shift(); }],
    ["additional unresolved decision", true, result => { result.stations[0].unresolved.push({ field: "catalogAssociation", reason: "UNKNOWN" }); }],
    ["wrong decision reason", true, result => { result.stations[0].unresolved[0].reason = "UNKNOWN"; }],
    ["source/outcome array order", true, result => { result.stations.reverse(); }],
    ["missing source outcome", false, result => { result.stations.splice(1, 1); }],
  ];
  it.each(mutations)("independent comparison rejects incorrect %s (E.1-valid: %s)", (_, contractValid, mutate) => {
    const { enriched, result } = execute(); // Accept the real unmodified pipeline first.
    const mutant = structuredClone(result); mutate(mutant);
    expect(validateNormalizationContract(enriched, mutant).ok).toBe(contractValid);
    expect(() => compare(mutant, reviewedCareerExpected)).toThrow();
    compare(result, reviewedCareerExpected); // Neither the original nor the oracle was changed.
  });
});
