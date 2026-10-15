import { describe, expect, it } from "vitest";
import type { SourceDate, SourceFact, SourceStation, UnresolvedDecision } from "./contract";
import { normalizeExplicitDegree } from "./normalize-explicit-degree";
import { validateNormalizationContract } from "./validate";

const missing = { kind: "MISSING" } as const;
const unknown = { kind: "UNKNOWN", origin: "ASSERTED" } as const;
const observed = <T>(value: T) => ({ kind: "OBSERVED", value }) as const;
const asserted = <T>(value: T) => ({ kind: "ASSERTED", value }) as const;
const programId = "00000000-0000-4000-8000-000000000031";
const institutionId = "00000000-0000-4000-8000-000000000032";

// Independently authored E.2a facts and expected values; no D.2 oracle imports.
function bachelor(): SourceStation {
  return {
    key: "e2a-local-7", title: observed("Fictional Bachelor of Community Studies"),
    category: observed("Education entry"), providerLabel: observed("Fictional Academy North"),
    start: observed({ precision: "MONTH", year: 2012, month: 10 }),
    end: observed({ precision: "YEAR", year: 2016 }),
    graduation: asserted({ precision: "MONTH", year: 2016, month: 7 }),
    classification: asserted({ type: "DEGREE", level: "BACHELOR" }),
    degreeStatus: asserted("COMPLETED"), temporalStatus: missing, position: asserted(7),
    catalog: { kind: "CONFIRMED", identity: { entity: "PROGRAM", id: programId }, confirmation: "EXPLICIT_SELECTION" },
  };
}
function expectedBachelor() {
  return {
    sourceKey: "e2a-local-7", kind: "RESOLVED_DEGREE", position: 7,
    canonical: {
      level: "BACHELOR", status: "COMPLETED", title: "Fictional Bachelor of Community Studies",
      fieldOfStudy: null, programId, institutionId: null,
      startYear: 2012, endYear: 2016, graduationYear: 2016,
    }, unresolved: [],
  };
}
function normalize(source: SourceStation) {
  const before = structuredClone(source);
  const result = normalizeExplicitDegree(source);
  expect(source).toEqual(before);
  expect(validateNormalizationContract({ stations: [source] }, { stations: [result] })).toEqual({ ok: true, diagnostics: [] });
  expect(result).not.toHaveProperty("referenceDegreeId");
  expect(result).not.toHaveProperty("surveyResponse");
  return result;
}
function expectReview(source: SourceStation, decisions: UnresolvedDecision[]) {
  const result = normalize(source);
  expect(result).toEqual({ sourceKey: source.key, kind: "REVIEW_REQUIRED", unresolved: decisions });
  expect(result).not.toHaveProperty("canonical");
  expect(result).not.toHaveProperty("position");
}

describe("E.2a explicit academic Degree normalization", () => {
  it.each([null, undefined])("rejects runtime source %s with the documented fixed error", source => {
    expect(() => normalizeExplicitDegree(source as unknown as SourceStation))
      .toThrow(new Error("Invalid source-neutral station contract"));
  });
  it("resolves a completed Bachelor with confirmed Program, exact years and asserted position", () => {
    expect(normalize(bachelor())).toEqual(expectedBachelor());
  });
  it("resolves a completed PhD with direct Institution and no invented graduation year", () => {
    const source = bachelor();
    source.classification = asserted({ type: "DEGREE", level: "PHD" });
    source.title = asserted("Fictional Doctorate in Community Research");
    source.graduation = missing;
    source.catalog = { kind: "CONFIRMED", identity: { entity: "INSTITUTION", id: institutionId }, confirmation: "TRUSTED_INPUT" };
    expect(normalize(source)).toEqual({
      sourceKey: "e2a-local-7", kind: "RESOLVED_DEGREE", position: 7,
      canonical: { level: "PHD", status: "COMPLETED", title: "Fictional Doctorate in Community Research",
        fieldOfStudy: null, programId: null, institutionId, startYear: 2012, endYear: 2016, graduationYear: null },
      unresolved: [{ field: "graduationYear", reason: "MISSING" }],
    });
  });
  it.each([missing, unknown, asserted("UNKNOWN" as const)])("does not infer completion from attendance end: %j", status => {
    const source = bachelor();
    source.degreeStatus = status;
    source.graduation = missing;
    expect(normalize(source)).toEqual({
      sourceKey: "e2a-local-7", kind: "RESOLVED_DEGREE", position: 7,
      canonical: { level: "BACHELOR", status: "UNKNOWN", title: "Fictional Bachelor of Community Studies",
        fieldOfStudy: null, programId, institutionId: null, startYear: 2012, endYear: null, graduationYear: null },
      unresolved: [
        { field: "status", reason: status.kind === "MISSING" ? "MISSING" : "UNKNOWN" },
        { field: "endYear", reason: "STATUS_UNCERTAIN" }, { field: "graduationYear", reason: "MISSING" },
      ],
    });
  });
  it("does not infer completion even from a dedicated graduation date when status is missing", () => {
    const source = bachelor();
    source.degreeStatus = missing;
    const result = normalize(source);
    expect(result).toMatchObject({ kind: "RESOLVED_DEGREE", canonical: { status: "UNKNOWN", endYear: null, graduationYear: null } });
    expect(result.unresolved).toEqual([
      { field: "status", reason: "MISSING" }, { field: "endYear", reason: "STATUS_UNCERTAIN" },
      { field: "graduationYear", reason: "STATUS_UNCERTAIN" },
    ]);
  });
  it.each<{ date: SourceFact<SourceDate>; reason: UnresolvedDecision["reason"] }>([
    { date: missing, reason: "MISSING" }, { date: unknown, reason: "UNKNOWN" },
    { date: observed({ precision: "IMPRECISE", text: "around an earlier decade" }), reason: "IMPRECISE_DATE" },
  ])("keeps $reason dates null with truthful field decisions", ({ date, reason }) => {
    const source = bachelor();
    source.start = date; source.end = date; source.graduation = date;
    expect(normalize(source)).toEqual({
      sourceKey: "e2a-local-7", kind: "RESOLVED_DEGREE", position: 7,
      canonical: { level: "BACHELOR", status: "COMPLETED", title: "Fictional Bachelor of Community Studies",
        fieldOfStudy: null, programId, institutionId: null, startYear: null, endYear: null, graduationYear: null },
      unresolved: [{ field: "startYear", reason }, { field: "endYear", reason }, { field: "graduationYear", reason }],
    });
  });
  it("leaves a name-match Program candidate unassigned with a catalog decision", () => {
    const source = bachelor();
    source.catalog = { kind: "CANDIDATE", identity: { entity: "PROGRAM", id: programId }, basis: "NAME_MATCH" };
    const expected = expectedBachelor();
    expect(normalize(source)).toEqual({ ...expected,
      canonical: { ...expected.canonical, programId: null },
      unresolved: [{ field: "catalogAssociation", reason: "CATALOG_UNCONFIRMED" }],
    });
  });
  it("keeps unknown association null despite a familiar provider label", () => {
    const source = bachelor();
    source.catalog = { kind: "UNKNOWN" };
    const expected = expectedBachelor();
    expect(normalize(source)).toEqual({ ...expected, canonical: { ...expected.canonical, programId: null },
      unresolved: [{ field: "catalogAssociation", reason: "UNKNOWN" }],
    });
  });
  it.each([missing, unknown])("requires review for unasserted classification %j, regardless of title", classification => {
    const source = bachelor();
    source.classification = classification;
    expectReview(source, [{ field: "classification", reason: "CLASSIFICATION_UNCERTAIN" }]);
  });
  it("does not convert an explicitly nondegree EDUCATION classification into a Degree", () => {
    const source = bachelor();
    source.classification = asserted({ type: "CAREER_STEP", careerStepType: "EDUCATION" });
    expectReview(source, [{ field: "classification", reason: "CLASSIFICATION_UNCERTAIN" }]);
  });
  it.each([missing, unknown])("requires review without explicit position %j", position => {
    const source = bachelor();
    source.position = position;
    expectReview(source, [{ field: "position", reason: position.kind === "MISSING" ? "MISSING" : "UNKNOWN" }]);
  });
  it.each(["DIPLOMA", "OTHER"] as const)("requires a supported title for %s", level => {
    const source = bachelor();
    source.classification = asserted({ type: "DEGREE", level });
    source.title = missing;
    expectReview(source, [{ field: "title", reason: "MISSING" }]);
  });
  it("permits a missing optional Bachelor title and preserves null-only fieldOfStudy", () => {
    const source = bachelor();
    source.title = missing;
    const expected = expectedBachelor();
    expect(normalize(source)).toEqual({ ...expected, canonical: { ...expected.canonical, title: null },
      unresolved: [{ field: "title", reason: "MISSING" }],
    });
  });
  it.each(["IN_PROGRESS", "ENDED_WITHOUT_DEGREE"] as const)("resolves explicit %s when no contradictory graduation/end is supplied", status => {
    const source = bachelor();
    source.degreeStatus = asserted(status);
    source.graduation = missing;
    if (status === "IN_PROGRESS") source.end = missing;
    const expected = expectedBachelor();
    expect(normalize(source)).toEqual({ ...expected,
      canonical: { ...expected.canonical, status, endYear: status === "IN_PROGRESS" ? null : 2016, graduationYear: null },
      unresolved: status === "IN_PROGRESS"
        ? [{ field: "endYear", reason: "MISSING" }, { field: "graduationYear", reason: "MISSING" }]
        : [{ field: "graduationYear", reason: "MISSING" }],
    });
  });
  it("requires review for a cross-kind temporal status assertion", () => {
    const source = bachelor();
    source.temporalStatus = asserted("ENDED");
    expectReview(source, [{ field: "temporalStatus", reason: "CONFLICTING_FACTS" }]);
  });
  it.each(["IN_PROGRESS", "ENDED_WITHOUT_DEGREE"] as const)("requires review for graduation conflicting with %s", status => {
    const source = bachelor();
    source.degreeStatus = asserted(status);
    source.end = missing;
    expectReview(source, [{ field: "graduationYear", reason: "CONFLICTING_FACTS" }]);
  });
  it("requires review for an attendance end conflicting with IN_PROGRESS", () => {
    const source = bachelor();
    source.degreeStatus = asserted("IN_PROGRESS");
    source.graduation = missing;
    expectReview(source, [{ field: "endYear", reason: "CONFLICTING_FACTS" }]);
  });
  it("requires review for a confirmed Organisation instead of silently losing its identity", () => {
    const source = bachelor();
    source.catalog = { kind: "CONFIRMED", identity: { entity: "ORGANISATION", id: institutionId }, confirmation: "EXPLICIT_SELECTION" };
    expectReview(source, [{ field: "catalogAssociation", reason: "CONFLICTING_FACTS" }]);
  });
  it.each([asserted("COMPLETED" as const), missing])("requires review for reversed attendance years even when status is %j", status => {
    const source = bachelor();
    source.degreeStatus = status;
    source.start = observed({ precision: "YEAR", year: 2018 });
    source.graduation = missing;
    expectReview(source, [{ field: "startYear", reason: "CONFLICTING_FACTS" }, { field: "endYear", reason: "CONFLICTING_FACTS" }]);
  });
  it("requires review when graduation precedes known attendance years", () => {
    const source = bachelor();
    source.graduation = asserted({ precision: "YEAR", year: 2011 });
    expectReview(source, [{ field: "graduationYear", reason: "CONFLICTING_FACTS" }]);
  });
  it("preserves independently supplied level, supported title text and position without sorting", () => {
    const source = bachelor();
    source.title = observed("  Fictional Master label, not a level assertion  ");
    const second = { ...bachelor(), key: "e2a-local-2", position: asserted(2) };
    expect(normalize(source)).toMatchObject({ kind: "RESOLVED_DEGREE", position: 7,
      canonical: { level: "BACHELOR", title: "  Fictional Master label, not a level assertion  ", fieldOfStudy: null } });
    expect([source, second].map(s => normalize(s).sourceKey)).toEqual(["e2a-local-7", "e2a-local-2"]);
  });
  it.each([
    (source: SourceStation) => { Object.assign(source.start, { value: { precision: "MONTH", year: 2012, month: 13 } }); },
    (source: SourceStation) => { Object.assign(source, { classification: asserted({ type: "DEGREE" }) }); },
    (source: SourceStation) => { Object.assign(source, { providerId: "fictional-provider-id" }); },
  ])("rejects malformed E.1 source values with a fixed error before normalization: %#", mutate => {
    const source = bachelor();
    mutate(source);
    expect(() => normalizeExplicitDegree(source)).toThrow("Invalid source-neutral station contract");
  });
});
