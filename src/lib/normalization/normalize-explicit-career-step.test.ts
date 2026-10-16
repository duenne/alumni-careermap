import { describe, expect, it } from "vitest";
import type { CanonicalCareerStep, SourceDate, SourceFact, SourceStation, UnresolvedDecision } from "./contract";
import { normalizeExplicitCareerStep } from "./normalize-explicit-career-step";
import { validateNormalizationContract } from "./validate";

const missing = { kind: "MISSING" } as const;
const unknown = { kind: "UNKNOWN", origin: "ASSERTED" } as const;
const observedUnknown = { kind: "UNKNOWN", origin: "OBSERVED" } as const;
const observed = <T>(value: T) => ({ kind: "OBSERVED", value }) as const;
const asserted = <T>(value: T) => ({ kind: "ASSERTED", value }) as const;
const organisationId = "00000000-0000-4000-8000-000000000071";

// Independently authored fictional facts and expected outcomes, without D.2 imports.
function employment(): SourceStation {
  return {
    key: "e2b-local-9", title: observed("Fictional Workshop Coordinator"),
    category: observed("Unverified activity label"), providerLabel: observed("Fictional Workshop Collective"),
    start: observed({ precision: "MONTH", year: 2014, month: 3 }),
    end: asserted({ precision: "YEAR", year: 2019 }), graduation: missing,
    classification: asserted({ type: "CAREER_STEP", careerStepType: "EMPLOYMENT" }),
    degreeStatus: missing, temporalStatus: asserted("ENDED"), position: asserted(9),
    catalog: { kind: "CONFIRMED", identity: { entity: "ORGANISATION", id: organisationId }, confirmation: "EXPLICIT_SELECTION" },
  };
}
function expectedEmployment() {
  return {
    sourceKey: "e2b-local-9", kind: "RESOLVED_CAREER_STEP", position: 9,
    canonical: { type: "EMPLOYMENT", temporalStatus: "ENDED", roleTitle: "Fictional Workshop Coordinator",
      roleCategory: null, functionArea: null, location: null, organisationId, startYear: 2014, endYear: 2019 },
    unresolved: [],
  };
}
function normalize(source: SourceStation) {
  const before = structuredClone(source);
  const result = normalizeExplicitCareerStep(source);
  expect(source).toEqual(before);
  expect(validateNormalizationContract({ stations: [source] }, { stations: [result] }))
    .toEqual({ ok: true, diagnostics: [] });
  expect(normalizeExplicitCareerStep(source)).toEqual(result);
  if (result.kind === "RESOLVED_CAREER_STEP") {
    expect(Object.keys(result).sort()).toEqual(["canonical", "kind", "position", "sourceKey", "unresolved"]);
    expect(Object.keys(result.canonical).sort()).toEqual([
      "endYear", "functionArea", "location", "organisationId", "roleCategory", "roleTitle", "startYear", "temporalStatus", "type",
    ]);
    expect([result.canonical.roleCategory, result.canonical.functionArea, result.canonical.location]).toEqual([null, null, null]);
  } else {
    expect(Object.keys(result).sort()).toEqual(["kind", "sourceKey", "unresolved"]);
    expect(result).not.toHaveProperty("canonical");
    expect(result).not.toHaveProperty("position");
  }
  return result;
}
function expectReview(source: SourceStation, unresolved: UnresolvedDecision[]) {
  expect(normalize(source)).toEqual({ sourceKey: source.key, kind: "REVIEW_REQUIRED", unresolved });
}

describe("E.2b explicit CareerStep normalization", () => {
  it("resolves ended employment with confirmed Organisation and precise source years", () => {
    expect(normalize(employment())).toEqual(expectedEmployment());
  });
  it.each([
    "EMPLOYMENT", "INTERNSHIP", "EDUCATION", "VOCATIONAL_TRAINING",
    "VOLUNTEERING", "SELF_EMPLOYMENT", "UNEMPLOYED", "OTHER",
  ] as const satisfies readonly CanonicalCareerStep["type"][])("preserves explicitly supplied %s without interpreting labels", type => {
    const source = employment();
    source.classification = asserted({ type: "CAREER_STEP", careerStepType: type });
    source.category = observed("EDUCATION");
    source.providerLabel = observed("Fictional University label");
    const expected = expectedEmployment();
    expect(normalize(source)).toEqual({ ...expected, canonical: { ...expected.canonical, type } });
  });
  it.each([missing, unknown, observedUnknown])("keeps ongoing employment's end null for %j", end => {
    const source = employment();
    source.temporalStatus = asserted("ONGOING");
    source.end = end;
    const expected = expectedEmployment();
    expect(normalize(source)).toEqual({ ...expected,
      canonical: { ...expected.canonical, temporalStatus: "ONGOING", endYear: null },
      unresolved: [{ field: "endYear", reason: end.kind }],
    });
  });
  it.each([missing, unknown])("allows explicitly ended internship with end %j", end => {
    const source = employment();
    source.classification = asserted({ type: "CAREER_STEP", careerStepType: "INTERNSHIP" });
    source.end = end;
    const expected = expectedEmployment();
    expect(normalize(source)).toEqual({ ...expected,
      canonical: { ...expected.canonical, type: "INTERNSHIP", endYear: null },
      unresolved: [{ field: "endYear", reason: end.kind }],
    });
  });
  it.each([missing, unknown, observedUnknown, asserted("UNKNOWN" as const)])(
    "retains status uncertainty and withholds precise end year for %j", temporalStatus => {
      const source = employment();
      source.temporalStatus = temporalStatus;
      const expected = expectedEmployment();
      expect(normalize(source)).toEqual({ ...expected,
        canonical: { ...expected.canonical, temporalStatus: "UNKNOWN", endYear: null },
        unresolved: [
          { field: "temporalStatus", reason: temporalStatus.kind === "MISSING" ? "MISSING" : "UNKNOWN" },
          { field: "endYear", reason: "STATUS_UNCERTAIN" },
        ],
      });
    });
  it("does not infer ONGOING from a missing end or dates from a narrative expression", () => {
    const source = employment();
    source.temporalStatus = missing;
    source.start = observed({ precision: "IMPRECISE", text: "roughly during the late 2010s" });
    source.end = missing;
    const expected = expectedEmployment();
    expect(normalize(source)).toEqual({ ...expected,
      canonical: { ...expected.canonical, temporalStatus: "UNKNOWN", startYear: null, endYear: null },
      unresolved: [
        { field: "temporalStatus", reason: "MISSING" }, { field: "startYear", reason: "IMPRECISE_DATE" },
        { field: "endYear", reason: "MISSING" },
      ],
    });
  });
  it.each<{ date: SourceFact<SourceDate>; reason: UnresolvedDecision["reason"] }>([
    { date: missing, reason: "MISSING" }, { date: unknown, reason: "UNKNOWN" },
    { date: observed({ precision: "IMPRECISE", text: "around a former decade" }), reason: "IMPRECISE_DATE" },
  ])("keeps $reason dates null with truthful field decisions", ({ date, reason }) => {
    const source = employment();
    source.start = date; source.end = date;
    const expected = expectedEmployment();
    expect(normalize(source)).toEqual({ ...expected,
      canonical: { ...expected.canonical, startYear: null, endYear: null },
      unresolved: [{ field: "startYear", reason }, { field: "endYear", reason }],
    });
  });
  it("projects YEAR start and MONTH end facts to years without inventing precision", () => {
    const source = employment();
    source.start = asserted({ precision: "YEAR", year: 2014 });
    source.end = observed({ precision: "MONTH", year: 2019, month: 11 });
    expect(normalize(source)).toEqual(expectedEmployment());
  });
  it.each<SourceFact<SourceDate>>([
    observed({ precision: "YEAR", year: 2019 }), asserted({ precision: "MONTH", year: 2019, month: 8 }),
    observed({ precision: "IMPRECISE", text: "during the previous decade" }),
    asserted({ precision: "IMPRECISE", text: "around a recent year" }),
  ])("requires review for ONGOING with supplied end %j", end => {
    const source = employment();
    source.temporalStatus = asserted("ONGOING"); source.end = end;
    expectReview(source, [{ field: "endYear", reason: "CONFLICTING_FACTS" }]);
  });
  it.each([asserted("ENDED" as const), missing, unknown, asserted("UNKNOWN" as const)])(
    "requires review for reversed known years even before status withholding: %j", temporalStatus => {
      const source = employment();
      source.start = asserted({ precision: "YEAR", year: 2021 }); source.temporalStatus = temporalStatus;
      expectReview(source, [
        { field: "startYear", reason: "CONFLICTING_FACTS" }, { field: "endYear", reason: "CONFLICTING_FACTS" },
      ]);
    });
  it.each(["NAME_MATCH", "SUPPLIED_CANDIDATE"] as const)("keeps unconfirmed Organisation %s unassigned", basis => {
    const source = employment();
    source.catalog = { kind: "CANDIDATE", identity: { entity: "ORGANISATION", id: organisationId }, basis };
    const expected = expectedEmployment();
    expect(normalize(source)).toEqual({ ...expected, canonical: { ...expected.canonical, organisationId: null },
      unresolved: [{ field: "catalogAssociation", reason: "CATALOG_UNCONFIRMED" }],
    });
  });
  it("keeps unknown Organisation null regardless of the provider label", () => {
    const source = employment(); source.catalog = { kind: "UNKNOWN" };
    const expected = expectedEmployment();
    expect(normalize(source)).toEqual({ ...expected, canonical: { ...expected.canonical, organisationId: null },
      unresolved: [{ field: "catalogAssociation", reason: "UNKNOWN" }],
    });
  });
  it("accepts a trusted confirmed Organisation without merging same-name identities", () => {
    const source = employment();
    const distinctId = "00000000-0000-4000-8000-000000000072";
    source.catalog = { kind: "CONFIRMED", identity: { entity: "ORGANISATION", id: distinctId }, confirmation: "TRUSTED_INPUT" };
    const expected = expectedEmployment();
    expect(normalize(source)).toEqual({ ...expected, canonical: { ...expected.canonical, organisationId: distinctId } });
    expect(normalize(employment())).toEqual(expectedEmployment());
  });
  it.each(["PROGRAM", "INSTITUTION"] as const)("requires review for confirmed %s", entity => {
    const source = employment();
    source.catalog = { kind: "CONFIRMED", identity: { entity, id: organisationId }, confirmation: "EXPLICIT_SELECTION" };
    expectReview(source, [{ field: "catalogAssociation", reason: "CONFLICTING_FACTS" }]);
  });
  it.each(["COMPLETED", "IN_PROGRESS", "ENDED_WITHOUT_DEGREE", "UNKNOWN"] as const)(
    "requires review for asserted Degree status %s", status => {
      const source = employment(); source.degreeStatus = asserted(status);
      expectReview(source, [{ field: "status", reason: "CONFLICTING_FACTS" }]);
    });
  it.each<SourceFact<SourceDate>>([
    observed({ precision: "YEAR", year: 2017 }), asserted({ precision: "MONTH", year: 2017, month: 6 }),
    observed({ precision: "IMPRECISE", text: "around a past year" }),
    asserted({ precision: "IMPRECISE", text: "during an earlier decade" }),
  ])("requires review for supplied graduation %j", graduation => {
    const source = employment(); source.graduation = graduation;
    expectReview(source, [{ field: "graduationYear", reason: "CONFLICTING_FACTS" }]);
  });
  it("does not treat absent Degree facts as asserted cross-kind claims", () => {
    const source = employment(); source.degreeStatus = unknown; source.graduation = observedUnknown;
    expect(normalize(source)).toEqual(expectedEmployment());
  });
  it.each([missing, unknown, observedUnknown, asserted({ type: "DEGREE", level: "BACHELOR" } as const)])(
    "requires review for missing or other-kind classification %j", classification => {
      const source = employment(); source.classification = classification;
      expectReview(source, [{ field: "classification", reason: "CLASSIFICATION_UNCERTAIN" }]);
    });
  it.each([missing, unknown, observedUnknown])("requires an explicit position instead of %j", position => {
    const source = employment(); source.position = position;
    expectReview(source, [{ field: "position", reason: position.kind }]);
  });
  it.each([missing, unknown])("requires a supported role title for OTHER instead of %j", title => {
    const source = employment(); source.classification = asserted({ type: "CAREER_STEP", careerStepType: "OTHER" });
    source.title = title;
    expectReview(source, [{ field: "roleTitle", reason: title.kind }]);
  });
  it.each([missing, unknown])("keeps an optional role title null for %j without copying category/provider text", title => {
    const source = employment(); source.title = title;
    const expected = expectedEmployment();
    expect(normalize(source)).toEqual({ ...expected, canonical: { ...expected.canonical, roleTitle: null },
      unresolved: [{ field: "roleTitle", reason: title.kind }],
    });
  });
  it("preserves supported asserted title text exactly without certifying classification from it", () => {
    const source = employment(); source.title = asserted("  Fictional academic-looking title  ");
    const expected = expectedEmployment();
    expect(normalize(source)).toEqual({ ...expected,
      canonical: { ...expected.canonical, roleTitle: "  Fictional academic-looking title  " },
    });
  });
  it("preserves parallel activities and timeline gaps without inferring unemployment or sorting", () => {
    const first = employment();
    const second = { ...employment(), key: "e2b-local-2", position: asserted(2),
      classification: asserted({ type: "CAREER_STEP", careerStepType: "VOLUNTEERING" } as const) };
    const outcomes = [first, second].map(normalize);
    const expected = expectedEmployment();
    expect(outcomes).toEqual([expected, { ...expected, sourceKey: "e2b-local-2", position: 2,
      canonical: { ...expected.canonical, type: "VOLUNTEERING" } }]);
    expect(validateNormalizationContract({ stations: [first, second] }, { stations: outcomes }).ok).toBe(true);
  });
  it("does not mutate even a recursively frozen source or retain mutable source references", () => {
    const source = employment();
    const freeze = (value: unknown): void => {
      if (value !== null && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
    };
    freeze(source);
    const result = normalize(source);
    expect(result).toEqual(expectedEmployment());
    if (result.kind === "RESOLVED_CAREER_STEP") result.canonical.roleTitle = "Changed output only";
    expect(source.title).toEqual(observed("Fictional Workshop Coordinator"));
  });

  it.each([
    { label: "null", value: null }, { label: "undefined", value: undefined }, { label: "array", value: [] },
    { label: "string", value: "fictional private source text" }, { label: "number", value: 1 },
    { label: "boolean", value: true }, { label: "empty object", value: {} },
  ])("rejects invalid runtime root $label with a fixed redacted error", ({ value }) => {
    expect(() => normalizeExplicitCareerStep(value as unknown as SourceStation))
      .toThrow(new Error("Invalid source-neutral station contract"));
  });
  const invalidSources: [string, (source: SourceStation) => void][] = [
    ["missing type", source => { Object.assign(source, { classification: asserted({ type: "CAREER_STEP" }) }); }],
    ["observed classification", source => { Object.assign(source, { classification: observed({ type: "CAREER_STEP", careerStepType: "EMPLOYMENT" }) }); }],
    ["observed status", source => { Object.assign(source, { temporalStatus: observed("ONGOING") }); }],
    ["blank OTHER title", source => { source.classification = asserted({ type: "CAREER_STEP", careerStepType: "OTHER" }); source.title = observed("  "); }],
    ["invalid year", source => { source.start = asserted({ precision: "YEAR", year: 0 }); }],
    ["invalid month", source => { source.end = observed({ precision: "MONTH", year: 2019, month: 13 }); }],
    ["imprecise with invented year", source => { Object.assign(source, { start: observed({ precision: "IMPRECISE", text: "around a decade", year: 2014 }) }); }],
    ["nonpositive position", source => { source.position = asserted(0); }],
    ["fractional position", source => { source.position = asserted(1.5); }],
    ["missing fact envelope", source => { Reflect.deleteProperty(source, "end"); }],
    ["invalid catalog UUID", source => { source.catalog = { kind: "CONFIRMED", identity: { entity: "ORGANISATION", id: "fictional private identifier" }, confirmation: "EXPLICIT_SELECTION" }; }],
    ["provider metadata", source => { Object.assign(source, { providerId: "fictional-provider" }); }],
    ["contact data", source => { Object.assign(source, { email: "fictional@example.invalid" }); }],
    ["raw profile", source => { Object.assign(source, { rawProfile: "fictional private narrative" }); }],
    ["reference selection", source => { Object.assign(source, { referenceDegreeId: "fictional-reference" }); }],
    ["SurveyResponse", source => { Object.assign(source, { surveyResponse: { confirmedAt: "2000-01-01" } }); }],
  ];
  it.each(invalidSources)("rejects malformed E.1 source: %s", (_, mutate) => {
    const source = employment(); mutate(source);
    const before = structuredClone(source);
    expect(() => normalizeExplicitCareerStep(source)).toThrow(new Error("Invalid source-neutral station contract"));
    expect(source).toEqual(before);
  });
});
