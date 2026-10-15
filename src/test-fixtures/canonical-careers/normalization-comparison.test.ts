import { describe, expect, it } from "vitest";
import type { DecisionField, NormalizationInput, NormalizationResult, UnresolvedDecision } from "../../lib/normalization/contract";
import { normalizeCareerBatch } from "../../lib/normalization/normalize-career-batch";
import { validateNormalizationContract } from "../../lib/normalization/validate";
import { careerCases, catalogs } from "./catalog";
import type { CareerCase, ExpectedProfile } from "./contract";
import { academicLevels, adaptSyntheticInput, testCatalogIds } from "./normalization-adapter";

const missing = { kind: "MISSING" } as const;
const asserted = <T>(value: T) => ({ kind: "ASSERTED", value }) as const;
type DecisionPolicy = Record<string, Record<string, UnresolvedDecision[]>>;

// Independently authored fixed-code expectations, not parsed from D.2 prose
// and not calculated by the normalizer. All other stations require no decisions.
const correspondingDecisions: DecisionPolicy = {
  "career-05": { "source-doctorate": [{ field: "graduationYear", reason: "MISSING" }] },
  "career-09": {
    "source-uncertain-study": [
      { field: "status", reason: "MISSING" }, { field: "startYear", reason: "IMPRECISE_DATE" },
      { field: "endYear", reason: "STATUS_UNCERTAIN" }, { field: "graduationYear", reason: "MISSING" },
      { field: "catalogAssociation", reason: "UNKNOWN" },
    ],
    "source-undated-work": [
      { field: "temporalStatus", reason: "MISSING" }, { field: "startYear", reason: "MISSING" },
      { field: "endYear", reason: "MISSING" }, { field: "catalogAssociation", reason: "UNKNOWN" },
    ],
    "source-ended-internship": [{ field: "startYear", reason: "MISSING" }, { field: "endYear", reason: "MISSING" }],
  },
  "career-10": { "source-unassigned-work": [{ field: "catalogAssociation", reason: "UNKNOWN" }] },
  "career-12": { "source-ambiguous-learning": [{ field: "classification", reason: "CLASSIFICATION_UNCERTAIN" }] },
};
// Closed allowance: seven additional E.1 optional-field decisions, all required
// here. No other extra field/reason combination is silently ignored.
const additionalDecisions: DecisionPolicy = {
  "career-04": {
    "source-study": [{ field: "endYear", reason: "MISSING" }, { field: "graduationYear", reason: "MISSING" }],
    "source-exchange": [{ field: "catalogAssociation", reason: "UNKNOWN" }],
  },
  "career-06": { "source-course": [{ field: "catalogAssociation", reason: "UNKNOWN" }] },
  "career-07": { "source-current-work": [{ field: "endYear", reason: "MISSING" }] },
  "career-08": { "source-independent-work": [{ field: "endYear", reason: "MISSING" }, { field: "catalogAssociation", reason: "UNKNOWN" }] },
};
// Case 12's first-blocker review defers this exact D.2 dependency set. This is
// not a claim that E.1 emits seven separate field decisions.
const blockedReviewFields = ["classification", "level", "status", "temporalStatus", "endYear", "graduationYear", "catalogAssociation"];
const catalogFieldAliases: Record<string, DecisionField> = {
  programKey: "catalogAssociation", institutionKey: "catalogAssociation", organisationKey: "catalogAssociation",
};
type Coverage = { sources: number; degrees: number; careerSteps: number; reviews: number; decisions: number; additional: number };
const sortedUnique = (fields: string[]) => [...new Set(fields)].sort();
const byKey = <T extends { key: string }>(rows: T[]) => [...rows].sort((a, b) => a.key.localeCompare(b.key));
const byField = (decisions: UnresolvedDecision[]) => [...decisions].sort((a, b) => a.field.localeCompare(b.field));
function catalogKey(kind: keyof typeof testCatalogIds, id: string | null): string | null {
  if (id === null) return null;
  const entry = Object.entries(testCatalogIds[kind]).find(([, uuid]) => uuid === id);
  if (!entry) throw new Error("Unknown catalog UUID in comparison projection");
  return entry[0];
}
function assertComparison(fixture: CareerCase, input: NormalizationInput, actual: NormalizationResult): Coverage {
  const expected = fixture.expected;
  expect(validateNormalizationContract(input, actual)).toEqual({ ok: true, diagnostics: [] });
  expect(input.stations.map(s => s.key)).toEqual(fixture.input.stations.map(s => s.key));
  expect(actual.stations.map(s => s.sourceKey)).toEqual(input.stations.map(s => s.key));
  expect(sortedUnique(expected.mappings.map(m => m.sourceKey))).toEqual(sortedUnique(input.stations.map(s => s.key)));
  expect(new Set(expected.mappings.map(m => m.sourceKey)).size).toBe(expected.mappings.length);
  expect(expected.unresolved.every(d => input.stations.some(s => s.key === d.sourceKey))).toBe(true);
  const projected: Pick<ExpectedProfile, "degrees" | "careerSteps" | "timeline"> = { degrees: [], careerSteps: [], timeline: [] };
  let reviews = 0, decisions = 0, additional = 0;
  for (const outcome of actual.stations) {
    const mapping = expected.mappings.find(m => m.sourceKey === outcome.sourceKey);
    if (!mapping) throw new Error("No oracle correlation for normalized source");
    const summaryFields = expected.unresolved.filter(d => d.sourceKey === outcome.sourceKey).flatMap(d => d.fields);
    const required = correspondingDecisions[fixture.caseId]?.[outcome.sourceKey] ?? [];
    const extras = additionalDecisions[fixture.caseId]?.[outcome.sourceKey] ?? [];
    let correspondingFields: string[];
    if (outcome.kind === "REVIEW_REQUIRED") {
      expect(mapping.outcome).toBe("REVIEW_REQUIRED");
      expect(fixture.caseId).toBe("career-12");
      expect(outcome.sourceKey).toBe("source-ambiguous-learning");
      expect(sortedUnique(summaryFields)).toEqual([...blockedReviewFields].sort());
      expect(Object.keys(outcome).sort()).toEqual(["kind", "sourceKey", "unresolved"]);
      // Every listed dependent field stays undecided because there is no target.
      correspondingFields = ["classification"];
      if (mapping.outcome === "REVIEW_REQUIRED") expect(mapping.questions.length).toBeGreaterThan(0);
      reviews++;
    } else correspondingFields = sortedUnique(summaryFields.map(field => catalogFieldAliases[field] ?? field));
    expect(sortedUnique(required.map(d => d.field))).toEqual(sortedUnique(correspondingFields));
    expect(extras.every(d => !correspondingFields.includes(d.field))).toBe(true);
    expect(new Set(outcome.unresolved.map(d => d.field)).size).toBe(outcome.unresolved.length);
    expect(byField(outcome.unresolved)).toEqual(byField([...required, ...extras]));
    decisions += outcome.unresolved.length; additional += extras.length;
    if (outcome.kind === "REVIEW_REQUIRED") continue;
    if (mapping.outcome !== "MAPPED") throw new Error("Unexpected resolved oracle-review station");
    // Oracle target keys only label the projection. Never use them to obtain
    // classification, levels, statuses, dates, catalog identity or source facts.
    if (outcome.kind === "RESOLVED_DEGREE") {
      expect(mapping.target.type).toBe("DEGREE");
      if (mapping.target.type !== "DEGREE") throw new Error("Wrong oracle target kind");
      const d = outcome.canonical;
      expect(d.fieldOfStudy).toBeNull();
      const key = mapping.target.degreeKey;
      const programKey = catalogKey("program", d.programId);
      const association = programKey === null
        ? { programKey: null, institutionKey: catalogKey("institution", d.institutionId) }
        : { programKey, institutionKey: null };
      projected.degrees.push({ key, level: d.level, status: d.status, title: d.title,
        startYear: d.startYear, endYear: d.endYear, graduationYear: d.graduationYear,
        ...association });
      projected.timeline.push({ type: "DEGREE", degreeKey: key, careerStepKey: null, position: outcome.position });
    } else {
      expect(mapping.target.type).toBe("CAREER_STEP");
      if (mapping.target.type !== "CAREER_STEP") throw new Error("Wrong oracle target kind");
      const c = outcome.canonical;
      expect([c.roleCategory, c.functionArea, c.location]).toEqual([null, null, null]);
      const key = mapping.target.careerStepKey;
      projected.careerSteps.push({ key, type: c.type, temporalStatus: c.temporalStatus, roleTitle: c.roleTitle,
        startYear: c.startYear, endYear: c.endYear, organisationKey: catalogKey("organisation", c.organisationId) });
      projected.timeline.push({ type: "CAREER_STEP", degreeKey: null, careerStepKey: key, position: outcome.position });
    }
  }
  expect(byKey(projected.degrees)).toEqual(byKey(expected.degrees));
  expect(byKey(projected.careerSteps)).toEqual(byKey(expected.careerSteps));
  expect([...projected.timeline].sort((a, b) => a.position - b.position))
    .toEqual([...expected.timeline].sort((a, b) => a.position - b.position));
  // Eligibility is an independent test projection, never a selected reference.
  expect(projected.degrees.filter(d => d.status === "COMPLETED" && d.programKey === fixture.survey.referenceProgramKey)
    .map(d => d.key).sort()).toEqual([...expected.reference.candidateDegreeKeys].sort());
  expect(expected.reference.selection).toBe("REQUIRES_CONFIRMATION");
  expect(Object.keys(actual)).toEqual(["stations"]);
  expect(JSON.stringify(actual)).not.toMatch(/"(?:id|alumniId|providerId|email|profileUrl|createdAt|updatedAt|referenceDegreeId|confirmedAt|surveyResponse)"\s*:/);
  return { sources: actual.stations.length, degrees: projected.degrees.length,
    careerSteps: projected.careerSteps.length, reviews, decisions, additional };
}
function run(fixture: CareerCase) {
  const before = structuredClone(fixture);
  const input = adaptSyntheticInput(fixture.input);
  const inputBefore = structuredClone(input);
  const actual = normalizeCareerBatch(input);
  const coverage = assertComparison(fixture, input, actual);
  expect(input).toEqual(inputBefore);
  expect(fixture).toEqual(before);
  return { input, actual, coverage };
}
function findCase(id: string): CareerCase {
  const fixture = careerCases.find(c => c.caseId === id);
  if (!fixture) throw new Error("Missing synthetic comparison case");
  return fixture;
}

describe("E.3b independent D.2 normalization comparison", () => {
  it("covers exactly 12 cases, 20 sources, nine Degrees, ten CareerSteps and one target-free review", () => {
    expect(careerCases.map(c => c.caseId)).toEqual(Array.from({ length: 12 }, (_, i) => `career-${String(i + 1).padStart(2, "0")}`));
    const total = { sources: 0, degrees: 0, careerSteps: 0, reviews: 0, decisions: 0, additional: 0 };
    for (const fixture of careerCases) {
      const { coverage } = run(fixture);
      for (const key of Object.keys(total) as (keyof Coverage)[]) total[key] += coverage[key];
    }
    expect(total).toEqual({ sources: 20, degrees: 9, careerSteps: 10, reviews: 1, decisions: 21, additional: 7 });
  });
  it("supplies exactly nine explicit academic-level sidecar assertions keyed by case/source", () => {
    const academicSources = careerCases.flatMap(c => c.input.stations.filter(s => s.kind === "academic").map(s => `${c.caseId}/${s.key}`));
    const evidenceKeys = Object.entries(academicLevels).flatMap(([caseId, stations]) => Object.keys(stations).map(key => `${caseId}/${key}`));
    expect(evidenceKeys.sort()).toEqual(academicSources.sort());
    expect(evidenceKeys).toHaveLength(9);
  });
  it("uses a deterministic catalog with distinct same-name identities and no generated station IDs", () => {
    expect(Object.keys(testCatalogIds.institution).sort()).toEqual(catalogs.institutions.map(c => c.key).sort());
    expect(Object.keys(testCatalogIds.program).sort()).toEqual(catalogs.programs.map(c => c.key).sort());
    expect(Object.keys(testCatalogIds.organisation).sort()).toEqual(catalogs.organisations.map(c => c.key).sort());
    const ids = Object.values(testCatalogIds).flatMap(c => Object.values(c));
    expect(new Set(ids).size).toBe(7);
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(catalogs.institutions[0].name).toBe(catalogs.institutions[1].name);
    expect(testCatalogIds.institution["institution-a"]).not.toBe(testCatalogIds.institution["institution-a-distinct"]);
  });
  it.each(careerCases)("adapts only independently supplied source evidence: $caseId", fixture => {
    const before = structuredClone(fixture.input);
    const input = adaptSyntheticInput(fixture.input);
    expect(input).toEqual(adaptSyntheticInput(structuredClone(fixture.input)));
    expect(input.stations.map(s => s.key)).toEqual(fixture.input.stations.map(s => s.key));
    expect(input.stations).toHaveLength(fixture.input.stations.length);
    for (const [index, source] of fixture.input.stations.entries()) {
      const adapted = input.stations[index];
      expect(adapted.title).toEqual({ kind: "OBSERVED", value: source.label });
      expect(adapted.providerLabel).toEqual(source.providerLabel === null ? missing : { kind: "OBSERVED", value: source.providerLabel });
      expect(adapted.category).toEqual({ kind: "OBSERVED", value: source.kind });
      expect(adapted.position).toEqual(asserted(source.timelinePosition));
      for (const field of ["start", "end", "graduation"] as const) {
        expect(adapted[field]).toEqual(source[field] === null ? missing : { kind: "OBSERVED", value: source[field] });
        if (source[field] !== null && adapted[field].kind === "OBSERVED") expect(adapted[field].value).not.toBe(source[field]);
      }
      if (source.catalogAssociation === null) expect(adapted.catalog).toEqual({ kind: "UNKNOWN" });
      else expect(adapted.catalog).toEqual({ kind: "CONFIRMED", confirmation: "TRUSTED_INPUT", identity: {
        entity: source.catalogAssociation.kind.toUpperCase(), id: testCatalogIds[source.catalogAssociation.kind][source.catalogAssociation.key],
      } });
      if (source.kind === "academic") {
        expect(adapted.classification).toEqual(asserted({ type: "DEGREE", level: academicLevels[fixture.caseId][source.key] }));
        expect(adapted.degreeStatus).toEqual(source.outcome === "unspecified" ? missing : asserted({ awarded: "COMPLETED", studying: "IN_PROGRESS", "left-without-award": "ENDED_WITHOUT_DEGREE" }[source.outcome as "awarded" | "studying" | "left-without-award"]));
        expect(adapted.temporalStatus).toEqual(missing);
      } else {
        const types = { vocational: "VOCATIONAL_TRAINING", exchange: "EDUCATION", course: "EDUCATION", employment: "EMPLOYMENT", internship: "INTERNSHIP", "self-employment": "SELF_EMPLOYMENT", volunteering: "VOLUNTEERING" };
        expect(adapted.classification).toEqual(source.kind === "unclear" ? missing : asserted({ type: "CAREER_STEP", careerStepType: types[source.kind] }));
        expect(adapted.degreeStatus).toEqual(missing);
        expect(adapted.temporalStatus).toEqual(source.outcome === "unspecified" ? missing : asserted(source.outcome === "ongoing" ? "ONGOING" : "ENDED"));
      }
    }
    expect(fixture.input).toEqual(before);
  });
  it.each(careerCases)("matches independent canonical oracle and complete review policy: $caseId — $scenario", fixture => {
    run(fixture);
  });
  it("fails closed on missing sidecar evidence instead of parsing an academic label", () => {
    const input = structuredClone(findCase("career-01").input);
    expect(() => adaptSyntheticInput(input, {})).toThrow("Missing explicit synthetic academic-level evidence");
  });
  it("does not derive levels from changed labels or statuses from attendance dates", () => {
    const input = structuredClone(findCase("career-09").input);
    input.stations[0].label = "Synthetic PhD-sounding label";
    input.stations[0].providerLabel = "Synthetic Master-sounding provider";
    const source = adaptSyntheticInput(input).stations[0];
    expect(source.classification).toEqual(asserted({ type: "DEGREE", level: "BACHELOR" }));
    expect(source.degreeStatus).toEqual(missing);
    expect(source.graduation).toEqual(missing);
  });
  it.each(["catalog", "position"])("does not invent an unavailable synthetic %s", field => {
    const input = structuredClone(findCase("career-01").input);
    if (field === "catalog") input.stations[0].catalogAssociation = { kind: "program", key: "not-a-declared-catalog-key" };
    else Reflect.deleteProperty(input.stations[0], "timelinePosition");
    expect(() => adaptSyntheticInput(input)).toThrow();
  });
  it("preserves parallel study/work, timeline gaps and revised order", () => {
    const parallel = run(findCase("career-02"));
    expect(parallel.actual.stations.map(s => s.kind)).toEqual(["RESOLVED_DEGREE", "RESOLVED_CAREER_STEP"]);
    const revised = run(findCase("career-11"));
    expect(revised.actual.stations.map(s => s.sourceKey)).toEqual(["source-first-award", "source-second-award"]);
    expect(revised.actual.stations.map(s => s.kind === "REVIEW_REQUIRED" ? null : s.position)).toEqual([4, 1]);
  });
  it("retains unknown PhD graduation, imprecise dates, vocational training and course distinctions", () => {
    const phd = run(findCase("career-05")).actual.stations[0];
    expect(phd).toMatchObject({ kind: "RESOLVED_DEGREE", canonical: { level: "PHD", graduationYear: null } });
    const uncertain = run(findCase("career-09"));
    expect(uncertain.input.stations[0].start).toMatchObject({ kind: "OBSERVED", value: { precision: "IMPRECISE" } });
    expect(uncertain.actual.stations[0]).toMatchObject({ canonical: { status: "UNKNOWN", startYear: null, endYear: null } });
    expect(run(findCase("career-03")).actual.stations[0]).toMatchObject({ kind: "RESOLVED_CAREER_STEP", canonical: { type: "VOCATIONAL_TRAINING" } });
    expect(run(findCase("career-06")).actual.stations.map(s => s.kind)).toEqual(["RESOLVED_DEGREE", "RESOLVED_CAREER_STEP"]);
  });
  it("keeps same-name Organisation unassigned and multiple eligible Degrees unselected", () => {
    expect(run(findCase("career-10")).actual.stations[0]).toMatchObject({ canonical: { organisationId: null } });
    const multiple = run(findCase("career-11"));
    expect(multiple.actual.stations).toHaveLength(2);
    expect(JSON.stringify(multiple.actual)).not.toMatch(/referenceDegreeId|confirmedAt|surveyResponse|alumniId|providerId|email|createdAt|updatedAt/);
  });
  it("accounts explicitly for the complete case-12 classification dependency set without a target", () => {
    const { actual } = run(findCase("career-12"));
    expect(actual.stations).toEqual([{ sourceKey: "source-ambiguous-learning", kind: "REVIEW_REQUIRED",
      unresolved: [{ field: "classification", reason: "CLASSIFICATION_UNCERTAIN" }] }]);
  });

  const mutations: [string, string, (f: CareerCase, i: NormalizationInput, a: NormalizationResult) => void][] = [
    ["Degree level", "career-01", (_, i, a) => { i.stations[0].classification = asserted({ type: "DEGREE", level: "PHD" }); if (a.stations[0].kind === "RESOLVED_DEGREE") a.stations[0].canonical.level = "PHD"; }],
    ["completion status", "career-01", (_, i, a) => { i.stations[0].degreeStatus = asserted("ENDED_WITHOUT_DEGREE"); i.stations[0].graduation = missing; if (a.stations[0].kind === "RESOLVED_DEGREE") { a.stations[0].canonical.status = "ENDED_WITHOUT_DEGREE"; a.stations[0].canonical.graduationYear = null; a.stations[0].unresolved = [{ field: "graduationYear", reason: "MISSING" }]; } }],
    ["canonical date", "career-01", (_, i, a) => { i.stations[0].start = { kind: "OBSERVED", value: { precision: "YEAR", year: 2008 } }; if (a.stations[0].kind !== "REVIEW_REQUIRED") a.stations[0].canonical.startYear = 2008; }],
    ["catalog association", "career-01", (_, i, a) => { i.stations[0].catalog = { kind: "CONFIRMED", identity: { entity: "PROGRAM", id: testCatalogIds.program["program-b"] }, confirmation: "TRUSTED_INPUT" }; if (a.stations[0].kind === "RESOLVED_DEGREE") a.stations[0].canonical.programId = testCatalogIds.program["program-b"]; }],
    ["timeline position", "career-01", (_, i, a) => { i.stations[0].position = asserted(10); if (a.stations[0].kind !== "REVIEW_REQUIRED") a.stations[0].position = 10; }],
    ["mapping target type", "career-01", (_, i, a) => { i.stations[0].classification = asserted({ type: "CAREER_STEP", careerStepType: "EMPLOYMENT" }); i.stations[0].degreeStatus = missing; i.stations[0].graduation = missing; i.stations[0].temporalStatus = asserted("ENDED"); i.stations[0].catalog = { kind: "UNKNOWN" }; a.stations[0] = { sourceKey: "source-bachelor", kind: "RESOLVED_CAREER_STEP", position: 1, canonical: { type: "EMPLOYMENT", temporalStatus: "ENDED", roleTitle: "Synthetic Bachelor in Program A", roleCategory: null, functionArea: null, location: null, organisationId: null, startYear: 2011, endYear: 2014 }, unresolved: [{ field: "catalogAssociation", reason: "UNKNOWN" }] }; }],
    ["source array order", "career-01", (_, _i, a) => { a.stations.reverse(); }],
    ["missing required decision", "career-05", (_, _i, a) => { a.stations[0].unresolved = []; }],
    ["wrong reason code", "career-05", (_, _i, a) => { a.stations[0].unresolved[0].reason = "UNKNOWN"; }],
    ["unexpected extra decision", "career-01", (_, _i, a) => { a.stations[0].unresolved.push({ field: "title", reason: "CONFLICTING_FACTS" }); }],
    ["missing additional optional-field decision", "career-04", (_, _i, a) => { a.stations[0].unresolved = []; }],
    ["discarded case-12 dependency", "career-12", f => { f.expected.unresolved[0].fields = f.expected.unresolved[0].fields.filter(field => field !== "level"); }],
    ["fabricated extra review inventory", "career-12", (_, _i, a) => { a.stations[0].unresolved.push({ field: "level", reason: "CONFLICTING_FACTS" }); }],
  ];
  it.each(mutations)("comparison rejects E.1-valid but oracle-incompatible %s", (_, caseId, mutate) => {
    const fixture = structuredClone(findCase(caseId));
    const { input, actual } = run(fixture); // Prove the comparison accepts the original first.
    mutate(fixture, input, actual);
    expect(validateNormalizationContract(input, actual).ok).toBe(true);
    expect(() => assertComparison(fixture, input, actual)).toThrow();
  });
});
