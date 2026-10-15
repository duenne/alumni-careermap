import { afterEach, describe, expect, it, vi } from "vitest";
import type { NormalizationInput, NormalizationResult, SourceStation, StationOutcome } from "./contract";
import { normalizeCareerBatch } from "./normalize-career-batch";
import * as degreeNormalizer from "./normalize-explicit-degree";
import * as stepNormalizer from "./normalize-explicit-career-step";
import { validateNormalizationContract } from "./validate";

const missing = { kind: "MISSING" } as const;
const unknown = { kind: "UNKNOWN", origin: "ASSERTED" } as const;
const observed = <T>(value: T) => ({ kind: "OBSERVED", value }) as const;
const asserted = <T>(value: T) => ({ kind: "ASSERTED", value }) as const;
const programId = "00000000-0000-4000-8000-000000000091";
const organisationId = "00000000-0000-4000-8000-000000000092";
const inputError = "Invalid source-neutral batch contract";
const resultError = "Career batch normalization violated E.1 contract";

// Independently authored fictional batch and canonical expectations, not D.2
// fixtures or values calculated by the station normalizers under test.
function degree(): SourceStation {
  return {
    key: "batch-study", title: observed("Fictional Bachelor in Social Design"),
    category: observed("Unverified education label"), providerLabel: observed("Fictional Academy East"),
    start: observed({ precision: "YEAR", year: 2013 }), end: observed({ precision: "MONTH", year: 2017, month: 6 }),
    graduation: asserted({ precision: "YEAR", year: 2017 }),
    classification: asserted({ type: "DEGREE", level: "BACHELOR" }),
    degreeStatus: asserted("COMPLETED"), temporalStatus: missing, position: asserted(6),
    catalog: { kind: "CONFIRMED", identity: { entity: "PROGRAM", id: programId }, confirmation: "EXPLICIT_SELECTION" },
  };
}
function employment(): SourceStation {
  return {
    key: "batch-work", title: asserted("Fictional Part-time Facilitator"),
    category: observed("Unverified activity label"), providerLabel: observed("Fictional Workshop East"),
    start: observed({ precision: "MONTH", year: 2015, month: 2 }), end: observed({ precision: "YEAR", year: 2016 }),
    graduation: missing, classification: asserted({ type: "CAREER_STEP", careerStepType: "EMPLOYMENT" }),
    degreeStatus: missing, temporalStatus: asserted("ENDED"), position: asserted(2),
    catalog: { kind: "CONFIRMED", identity: { entity: "ORGANISATION", id: organisationId }, confirmation: "TRUSTED_INPUT" },
  };
}
function expectedDegree(): Extract<StationOutcome, { kind: "RESOLVED_DEGREE" }> {
  return {
    sourceKey: "batch-study", kind: "RESOLVED_DEGREE", position: 6,
    canonical: { level: "BACHELOR", status: "COMPLETED", title: "Fictional Bachelor in Social Design",
      fieldOfStudy: null, programId, institutionId: null, startYear: 2013, endYear: 2017, graduationYear: 2017 },
    unresolved: [],
  };
}
function expectedEmployment(): Extract<StationOutcome, { kind: "RESOLVED_CAREER_STEP" }> {
  return {
    sourceKey: "batch-work", kind: "RESOLVED_CAREER_STEP", position: 2,
    canonical: { type: "EMPLOYMENT", temporalStatus: "ENDED", roleTitle: "Fictional Part-time Facilitator",
      roleCategory: null, functionArea: null, location: null, organisationId, startYear: 2015, endYear: 2016 },
    unresolved: [],
  };
}
function normalize(input: NormalizationInput): NormalizationResult {
  const before = structuredClone(input);
  const result = normalizeCareerBatch(input);
  expect(input).toEqual(before);
  expect(validateNormalizationContract(input, result)).toEqual({ ok: true, diagnostics: [] });
  expect(Object.keys(result)).toEqual(["stations"]);
  expect(result.stations.map(s => s.sourceKey)).toEqual(input.stations.map(s => s.key));
  for (const outcome of result.stations) {
    if (outcome.kind === "REVIEW_REQUIRED") {
      expect(Object.keys(outcome).sort()).toEqual(["kind", "sourceKey", "unresolved"]);
    }
  }
  return result;
}
function expectInputError(input: unknown) {
  const before = structuredClone(input);
  expect(() => normalizeCareerBatch(input as NormalizationInput)).toThrow(new Error(inputError));
  expect(input).toEqual(before);
}
afterEach(() => vi.restoreAllMocks());

describe("E.3a source-neutral batch normalization", () => {
  it("preserves multiple Degrees and their explicit order/positions without reference selection", () => {
    const first = degree();
    const second: SourceStation = { ...degree(), key: "batch-master", title: asserted("Fictional Master in Civic Studies"),
      classification: asserted({ type: "DEGREE", level: "MASTER" }), position: asserted(1),
      start: observed({ precision: "YEAR", year: 2019 }), end: observed({ precision: "YEAR", year: 2021 }),
      graduation: asserted({ precision: "YEAR", year: 2021 }) };
    expect(normalize({ stations: [second, first] })).toEqual({ stations: [
      { sourceKey: "batch-master", kind: "RESOLVED_DEGREE", position: 1,
        canonical: { level: "MASTER", status: "COMPLETED", title: "Fictional Master in Civic Studies",
          fieldOfStudy: null, programId, institutionId: null, startYear: 2019, endYear: 2021, graduationYear: 2021 }, unresolved: [] },
      expectedDegree(),
    ] });
  });
  it("combines parallel academic study and employment without sorting or filling timeline gaps", () => {
    expect(normalize({ stations: [degree(), employment()] })).toEqual({ stations: [expectedDegree(), expectedEmployment()] });
  });
  it("retains nonchronological source array order even when positions also disagree with dates", () => {
    const source = employment();
    source.start = asserted({ precision: "YEAR", year: 2023 }); source.end = asserted({ precision: "YEAR", year: 2024 });
    const expected = expectedEmployment();
    expect(normalize({ stations: [source, degree()] })).toEqual({ stations: [
      { ...expected, canonical: { ...expected.canonical, startYear: 2023, endYear: 2024 } }, expectedDegree(),
    ] });
  });
  it("preserves unresolved Degree and CareerStep field decisions exactly", () => {
    const study = degree(); study.degreeStatus = missing; study.graduation = missing;
    const work = employment(); work.temporalStatus = unknown;
    work.catalog = { kind: "CANDIDATE", identity: { entity: "ORGANISATION", id: organisationId }, basis: "NAME_MATCH" };
    const d = expectedDegree(); const c = expectedEmployment();
    expect(normalize({ stations: [study, work] })).toEqual({ stations: [
      { ...d, canonical: { ...d.canonical, status: "UNKNOWN", endYear: null, graduationYear: null }, unresolved: [
        { field: "status", reason: "MISSING" }, { field: "endYear", reason: "STATUS_UNCERTAIN" },
        { field: "graduationYear", reason: "MISSING" },
      ] },
      { ...c, canonical: { ...c.canonical, temporalStatus: "UNKNOWN", organisationId: null, endYear: null }, unresolved: [
        { field: "temporalStatus", reason: "UNKNOWN" }, { field: "endYear", reason: "STATUS_UNCERTAIN" },
        { field: "catalogAssociation", reason: "CATALOG_UNCONFIRMED" },
      ] },
    ] });
  });
  it.each([missing, unknown, { kind: "UNKNOWN", origin: "OBSERVED" } as const])(
    "keeps unasserted classification %j as one target-free review without label inference", classification => {
      const source = employment(); source.classification = classification;
      source.title = observed("Fictional Bachelor label"); source.category = observed("EDUCATION");
      expect(normalize({ stations: [degree(), source] })).toEqual({ stations: [expectedDegree(),
        { sourceKey: "batch-work", kind: "REVIEW_REQUIRED", unresolved: [
          { field: "classification", reason: "CLASSIFICATION_UNCERTAIN" },
        ] },
      ] });
    });
  it("preserves a conflicting station's review while other stations remain resolved", () => {
    const source = employment(); source.degreeStatus = asserted("UNKNOWN");
    expect(normalize({ stations: [degree(), source] })).toEqual({ stations: [expectedDegree(),
      { sourceKey: "batch-work", kind: "REVIEW_REQUIRED", unresolved: [{ field: "status", reason: "CONFLICTING_FACTS" }] },
    ] });
  });
  it("allows review stations to share a source position hint without fabricating a resolved position", () => {
    const source = employment(); source.position = asserted(6); source.classification = missing;
    expect(normalize({ stations: [degree(), source] }).stations[1]).toEqual({
      sourceKey: "batch-work", kind: "REVIEW_REQUIRED", unresolved: [{ field: "classification", reason: "CLASSIFICATION_UNCERTAIN" }],
    });
  });
  it("dispatches each asserted kind once to its existing normalizer and neither for unknown classification", () => {
    const degreeSpy = vi.spyOn(degreeNormalizer, "normalizeExplicitDegree");
    const stepSpy = vi.spyOn(stepNormalizer, "normalizeExplicitCareerStep");
    const study = degree(); const work = employment(); const unclassified = { ...employment(), key: "batch-unclassified", classification: missing };
    normalize({ stations: [study, work, unclassified] });
    expect(degreeSpy).toHaveBeenCalledExactlyOnceWith(study);
    expect(stepSpy).toHaveBeenCalledExactlyOnceWith(work);
  });
  it("returns an empty validated batch without calling station normalizers", () => {
    const degreeSpy = vi.spyOn(degreeNormalizer, "normalizeExplicitDegree");
    const stepSpy = vi.spyOn(stepNormalizer, "normalizeExplicitCareerStep");
    expect(normalize({ stations: [] })).toEqual({ stations: [] });
    expect(degreeSpy).not.toHaveBeenCalled(); expect(stepSpy).not.toHaveBeenCalled();
  });
  it.each([false, true])("rejects duplicate keys even if the repeated station requires review: %s", review => {
    const source = employment(); source.key = "batch-study";
    if (review) source.classification = missing;
    expectInputError({ stations: [degree(), source] });
  });
  it("rejects duplicate resolved positions across Degree and CareerStep without renumbering", () => {
    const source = employment(); source.position = asserted(6);
    const input = { stations: [degree(), source] }; const before = structuredClone(input);
    expect(() => normalizeCareerBatch(input)).toThrow(new Error(resultError));
    expect(input).toEqual(before);
  });
  it("is deterministic, accepts recursively frozen input and returns no mutable input references", () => {
    const input = { stations: [degree(), employment()] };
    const freeze = (value: unknown): void => {
      if (value !== null && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
    };
    freeze(input);
    const result = normalize(input);
    expect(normalize(input)).toEqual(result);
    const d = result.stations[0];
    if (d.kind === "RESOLVED_DEGREE") d.canonical.title = "Changed output only";
    expect(input.stations[0].title).toEqual(observed("Fictional Bachelor in Social Design"));
  });
  it.each([
    { label: "null", value: null }, { label: "undefined", value: undefined }, { label: "array", value: [] },
    { label: "string", value: "fictional private source" }, { label: "number", value: 42 },
    { label: "empty object", value: {} }, { label: "null stations", value: { stations: null } },
    { label: "object stations", value: { stations: {} } }, { label: "null station", value: { stations: [null] } },
    { label: "undefined station", value: { stations: [undefined] } }, { label: "sparse stations", value: { stations: Array(1) } },
    { label: "primitive station", value: { stations: ["fictional private source"] } },
  ])("rejects malformed runtime input $label with the fixed redacted input error", ({ value }) => expectInputError(value));
  it.each([
    ["missing classification envelope", (s: SourceStation) => { Reflect.deleteProperty(s, "classification"); }],
    ["observed classification", (s: SourceStation) => { Object.assign(s, { classification: observed({ type: "DEGREE", level: "BACHELOR" }) }); }],
    ["invalid explicit classification", (s: SourceStation) => { Object.assign(s, { classification: asserted({ type: "POSITION" }) }); }],
    ["missing asserted Degree level", (s: SourceStation) => { Object.assign(s, { classification: asserted({ type: "DEGREE" }) }); }],
    ["malformed unclassified station", (s: SourceStation) => { s.classification = missing; Object.assign(s, { providerId: "fictional-provider" }); }],
    ["invalid date", (s: SourceStation) => { s.start = observed({ precision: "YEAR", year: 0 }); }],
    ["invalid position", (s: SourceStation) => { s.position = asserted(-1); }],
    ["personal metadata", (s: SourceStation) => { Object.assign(s, { email: "fictional@example.invalid" }); }],
  ] satisfies [string, (s: SourceStation) => void][])("validates every source before dispatch: %s", (_, mutate) => {
    const source = employment(); mutate(source);
    const degreeSpy = vi.spyOn(degreeNormalizer, "normalizeExplicitDegree");
    const stepSpy = vi.spyOn(stepNormalizer, "normalizeExplicitCareerStep");
    expectInputError({ stations: [degree(), source] });
    expect(degreeSpy).not.toHaveBeenCalled(); expect(stepSpy).not.toHaveBeenCalled();
  });
  it("rejects extra batch metadata even for an empty batch", () => {
    expectInputError({ stations: [], profileUrl: "https://fictional.example.invalid/profile" });
  });
  const invalidOutcomes: [string, () => unknown][] = [
    ["missing outcome", () => undefined],
    ["null outcome", () => null],
    ["orphan source mapping", () => ({ ...expectedDegree(), sourceKey: "fictional-orphan" })],
    ["duplicate/wrong source mapping", () => ({ ...expectedDegree(), sourceKey: "batch-work" })],
    ["invented canonical fact", () => { const d = expectedDegree(); d.canonical.graduationYear = 2025; return d; }],
    ["review carrying a fabricated canonical target", () => ({ ...expectedDegree(), kind: "REVIEW_REQUIRED" })],
  ];
  it.each(invalidOutcomes)("rejects invalid delegated results instead of repairing them: %s", (_, output) => {
    vi.spyOn(degreeNormalizer, "normalizeExplicitDegree").mockReturnValue(output() as degreeNormalizer.DegreeNormalizationOutcome);
    const input = { stations: [degree(), employment()] }; const before = structuredClone(input);
    expect(() => normalizeCareerBatch(input)).toThrow(new Error(resultError));
    expect(input).toEqual(before);
  });
  it("redacts delegate exception messages without forwarding a cause or partial results", () => {
    vi.spyOn(stepNormalizer, "normalizeExplicitCareerStep").mockImplementation(() => {
      throw new Error("fictional private provider narrative and identifier");
    });
    let error: unknown;
    try { normalizeCareerBatch({ stations: [degree(), employment()] }); } catch (e) { error = e; }
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe(resultError);
    expect(error).not.toHaveProperty("cause");
  });
  it("produces deterministic error messages independent of source keys, titles and catalog IDs", () => {
    const messages = [];
    for (const suffix of ["alpha", "beta"]) {
      const study = degree(); const work = employment();
      study.key = work.key = `fictional-private-${suffix}`;
      study.title = work.title = observed(`fictional personal text ${suffix}`);
      study.catalog = { kind: "CONFIRMED", identity: { entity: "PROGRAM", id: suffix === "alpha"
        ? "00000000-0000-4000-8000-000000000093" : "00000000-0000-4000-8000-000000000094" }, confirmation: "TRUSTED_INPUT" };
      try { normalizeCareerBatch({ stations: [study, work] }); } catch (error) { messages.push((error as Error).message); }
    }
    expect(messages).toEqual([inputError, inputError]);
  });
});
