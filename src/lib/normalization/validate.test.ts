import { describe, expect, it } from "vitest";
import type { NormalizationInput, NormalizationResult, SourceDate, SourceFact, SourceStation, StationOutcome } from "./contract";
import { validateNormalizationContract } from "./validate";

const missing = { kind: "MISSING" } as const;
const asserted = <T>(value: T) => ({ kind: "ASSERTED", value }) as const;
const observed = <T>(value: T) => ({ kind: "OBSERVED", value }) as const;
const programId = "00000000-0000-4000-8000-000000000001";

// Small independently authored values; no D.2 inputs or expected output reused.
function source(): SourceStation {
  return {
    key: "local-1", title: observed("Fictional qualification"), category: observed("EDUCATION"),
    providerLabel: observed("Fictional College"), start: observed({ precision: "MONTH", year: 2019, month: 9 }),
    end: observed({ precision: "YEAR", year: 2022 }), graduation: missing,
    classification: asserted({ type: "DEGREE", level: "BACHELOR" }),
    degreeStatus: asserted("COMPLETED"), temporalStatus: missing, position: asserted(4),
    catalog: { kind: "CONFIRMED", identity: { entity: "PROGRAM", id: programId }, confirmation: "EXPLICIT_SELECTION" },
  };
}
function degree(): Extract<StationOutcome, { kind: "RESOLVED_DEGREE" }> {
  return {
    sourceKey: "local-1", kind: "RESOLVED_DEGREE", position: 4,
    canonical: {
      level: "BACHELOR", status: "COMPLETED", title: "Fictional qualification", fieldOfStudy: null,
      programId, institutionId: null, startYear: 2019, endYear: 2022, graduationYear: null,
    },
    unresolved: [{ field: "graduationYear", reason: "MISSING" }],
  };
}
function pair(): { input: NormalizationInput; result: NormalizationResult } {
  return { input: { stations: [source()] }, result: { stations: [degree()] } };
}
function stepPair() {
  const input = { stations: [{
    ...source(), title: observed("Fictional assistant"), category: observed("POSITION"), classification: asserted({ type: "CAREER_STEP", careerStepType: "EMPLOYMENT" } as const),
    degreeStatus: missing, temporalStatus: missing, start: missing, end: missing, catalog: { kind: "UNKNOWN" } as const,
  }] } satisfies NormalizationInput;
  const outcome = {
    sourceKey: "local-1", kind: "RESOLVED_CAREER_STEP", position: 4,
    canonical: { type: "EMPLOYMENT", temporalStatus: "UNKNOWN", roleTitle: "Fictional assistant",
      roleCategory: null, functionArea: null, location: null, organisationId: null, startYear: null, endYear: null },
    unresolved: [{ field: "temporalStatus", reason: "MISSING" }],
  } satisfies StationOutcome;
  return { input, result: { stations: [outcome] } };
}
function check({ input, result }: { input: unknown; result: unknown }) {
  return validateNormalizationContract(input, result);
}

describe("E.1 source-neutral normalization contract", () => {
  it("accepts an explicitly resolved Degree without inventing graduation", () => {
    const p = pair();
    const before = structuredClone(p);
    expect(check(p)).toEqual({ ok: true, diagnostics: [] });
    expect(p).toEqual(before);
    expect(p.result.stations[0]).toEqual(degree());
  });
  it("accepts a resolved CareerStep with unknown temporal status and missing dates", () => {
    expect(check(stepPair())).toEqual({ ok: true, diagnostics: [] });
  });
  it("accepts explicit ENDED with missing years", () => {
    const p = stepPair();
    Object.assign(p.input.stations[0], { temporalStatus: asserted("ENDED") });
    Object.assign(p.result.stations[0].canonical, { temporalStatus: "ENDED" });
    // Ending is now explicit; only the absent years still need clarification.
    Object.assign(p.result.stations[0], { unresolved: [
      { field: "startYear", reason: "MISSING" }, { field: "endYear", reason: "MISSING" },
    ] });
    expect(check(p).ok).toBe(true);
  });
  it("accepts an explicitly ongoing CareerStep without an end year", () => {
    const p = stepPair();
    Object.assign(p.input.stations[0], { temporalStatus: asserted("ONGOING") });
    Object.assign(p.result.stations[0].canonical, { temporalStatus: "ONGOING" });
    p.result.stations[0].unresolved = [];
    expect(check(p).ok).toBe(true);
  });
  it("scopes keys to one batch rather than claiming global provider identity", () => {
    expect(check(pair()).ok).toBe(true);
    expect(check(pair()).ok).toBe(true);
  });
  it.each<SourceFact<SourceDate>>([
    missing, { kind: "UNKNOWN", origin: "ASSERTED" },
    observed({ precision: "IMPRECISE", text: "during a previous decade" }),
  ])("keeps uncertain date variant %j without a canonical year", date => {
    const p = pair();
    p.input.stations[0].start = date;
    const d = p.result.stations[0] as ReturnType<typeof degree>;
    d.canonical.startYear = null;
    d.unresolved.push({ field: "startYear", reason: "UNKNOWN" });
    expect(check(p).ok).toBe(true);
  });
  it("accepts REVIEW_REQUIRED with field decisions and no canonical station or position", () => {
    const p = pair();
    p.input.stations[0].classification = missing;
    p.result.stations = [{ sourceKey: "local-1", kind: "REVIEW_REQUIRED", unresolved: [
      { field: "classification", reason: "CLASSIFICATION_UNCERTAIN" },
    ] }];
    expect(check(p).ok).toBe(true);
  });
  it.each<SourceFact<string>>([missing, { kind: "UNKNOWN", origin: "OBSERVED" },
    { kind: "UNKNOWN", origin: "ASSERTED" }, observed("EDUCATION"), asserted("EDUCATION")])(
    "preserves explicit source fact variant %j", fact => {
      const p = pair();
      p.input.stations[0].category = fact;
      expect(check(p).ok).toBe(true);
      expect(p.input.stations[0].category).toEqual(fact);
    });
  it("keeps imprecise source text separate from canonical years", () => {
    const p = pair();
    p.input.stations[0].start = observed({ precision: "IMPRECISE", text: "around 2019" });
    const d = p.result.stations[0] as ReturnType<typeof degree>;
    d.canonical.startYear = null;
    d.unresolved.push({ field: "startYear", reason: "IMPRECISE_DATE" });
    expect(check(p).ok).toBe(true);
  });
  it("allows a catalog candidate to stay unassigned pending review", () => {
    const p = pair();
    p.input.stations[0].catalog = { kind: "CANDIDATE", identity: { entity: "PROGRAM", id: programId }, basis: "NAME_MATCH" };
    const d = p.result.stations[0] as ReturnType<typeof degree>;
    d.canonical.programId = null;
    d.unresolved.push({ field: "catalogAssociation", reason: "CATALOG_UNCONFIRMED" });
    expect(check(p).ok).toBe(true);
  });
  it("retains observed attendance end while canonical UNKNOWN Degree has no end", () => {
    const p = pair();
    p.input.stations[0].degreeStatus = missing;
    const d = p.result.stations[0] as ReturnType<typeof degree>;
    Object.assign(d.canonical, { status: "UNKNOWN", endYear: null });
    d.unresolved.push({ field: "status", reason: "STATUS_UNCERTAIN" }, { field: "endYear", reason: "STATUS_UNCERTAIN" });
    expect(check(p).ok).toBe(true);
    expect(p.input.stations[0].end).toEqual(observed({ precision: "YEAR", year: 2022 }));
  });
  it("accepts one-to-one correlation in a different result order, preserving order hints and gaps", () => {
    const p = pair();
    p.input.stations.push({ ...source(), key: "local-2", position: asserted(1) });
    p.result.stations.unshift({ ...degree(), sourceKey: "local-2", position: 1 });
    expect(check(p).ok).toBe(true);
    expect(p.result.stations.map(s => s.sourceKey)).toEqual(["local-2", "local-1"]);
  });
  it("has no Alumni data or reference selection even for one or several completed Degrees", () => {
    const p = pair();
    expect(check(p).ok).toBe(true);
    p.input.stations.push({ ...source(), key: "local-2", position: asserted(1) });
    p.result.stations.push({ ...degree(), sourceKey: "local-2", position: 1 });
    expect(check(p).ok).toBe(true);
    expect(Object.keys(p.result)).toEqual(["stations"]);
    for (const outcome of p.result.stations) {
      if (outcome.kind !== "REVIEW_REQUIRED") {
        expect(Object.keys(outcome.canonical)).not.toContain("sourceKey");
        expect(Object.keys(outcome.canonical)).not.toContain("referenceDegreeId");
      }
    }
  });

  const mutations: [string, (p: ReturnType<typeof pair>) => void][] = [
    ["review with fabricated target", p => Object.assign(p.result.stations[0], { kind: "REVIEW_REQUIRED" })],
    ["review without decisions", p => { p.result.stations = [{ sourceKey: "local-1", kind: "REVIEW_REQUIRED", unresolved: [] } as unknown as StationOutcome]; }],
    ["mixed canonical targets", p => Object.assign(p.result.stations[0], { careerStep: {} })],
    ["wrong discriminator", p => Object.assign(p.result.stations[0], { kind: "RESOLVED_CAREER_STEP" })],
    ["missing canonical status", p => { Reflect.deleteProperty((p.result.stations[0] as ReturnType<typeof degree>).canonical, "status"); }],
    ["missing fact property", p => { Reflect.deleteProperty(p.input.stations[0], "end"); }],
    ["unknown carrying a guessed value", p => Object.assign(p.input.stations[0], { title: { kind: "UNKNOWN", origin: "OBSERVED", value: "Guess" } })],
    ["imprecise carrying exact year", p => Object.assign(p.input.stations[0], { start: observed({ precision: "IMPRECISE", text: "around 2019", year: 2019 }) })],
    ["month outside range", p => Object.assign(p.input.stations[0], { start: observed({ precision: "MONTH", year: 2019, month: 13 }) })],
    ["noninteger source year", p => Object.assign(p.input.stations[0], { start: observed({ precision: "YEAR", year: 2019.5 }) })],
    ["year carrying month", p => Object.assign(p.input.stations[0], { start: observed({ precision: "YEAR", year: 2019, month: 1 }) })],
    ["candidate promoted by name", p => { p.input.stations[0].catalog = { kind: "CANDIDATE", identity: { entity: "PROGRAM", id: programId }, basis: "NAME_MATCH" }; }],
    ["unconfirmed catalog", p => { p.input.stations[0].catalog = { kind: "UNKNOWN" }; }],
    ["confirmed identity with name-match basis", p => Object.assign(p.input.stations[0].catalog, { confirmation: "NAME_MATCH" })],
    ["different confirmed identity", p => { if (p.input.stations[0].catalog.kind === "CONFIRMED") p.input.stations[0].catalog.identity.id = "00000000-0000-4000-8000-000000000002"; }],
    ["invalid catalog identifier", p => { if (p.input.stations[0].catalog.kind === "CONFIRMED") p.input.stations[0].catalog.identity.id = "Fictional College"; }],
    ["two Degree catalogs", p => Object.assign((p.result.stations[0] as ReturnType<typeof degree>).canonical, { institutionId: programId })],
    ["completion from attendance end", p => { p.input.stations[0].degreeStatus = missing; }],
    ["classification from education label", p => { p.input.stations[0].classification = missing; }],
    ["observed classification as assertion", p => Object.assign(p.input.stations[0], { classification: observed({ type: "DEGREE", level: "BACHELOR" }) })],
    ["graduation from attendance end", p => Object.assign((p.result.stations[0] as ReturnType<typeof degree>).canonical, { graduationYear: 2022 })],
    ["year from imprecise text", p => { p.input.stations[0].start = observed({ precision: "IMPRECISE", text: "around 2019" }); }],
    ["year without source evidence", p => { p.input.stations[0].start = missing; }],
    ["reversed canonical years", p => Object.assign((p.result.stations[0] as ReturnType<typeof degree>).canonical, { startYear: 2023 })],
    ["noncanonical Degree enum", p => Object.assign((p.result.stations[0] as ReturnType<typeof degree>).canonical, { level: "VOCATIONAL" })],
    ["canonical year outside range", p => Object.assign((p.result.stations[0] as ReturnType<typeof degree>).canonical, { startYear: 0 })],
    ["unnamed OTHER Degree", p => { p.input.stations[0].classification = asserted({ type: "DEGREE", level: "OTHER" }); Object.assign((p.result.stations[0] as ReturnType<typeof degree>).canonical, { level: "OTHER", title: null }); }],
    ["UNKNOWN Degree with an end", p => { p.input.stations[0].degreeStatus = asserted("UNKNOWN"); Object.assign((p.result.stations[0] as ReturnType<typeof degree>).canonical, { status: "UNKNOWN" }); }],
    ["graduation on a noncompleted Degree", p => { p.input.stations[0].degreeStatus = asserted("ENDED_WITHOUT_DEGREE"); p.input.stations[0].graduation = observed({ precision: "YEAR", year: 2022 }); Object.assign((p.result.stations[0] as ReturnType<typeof degree>).canonical, { status: "ENDED_WITHOUT_DEGREE", graduationYear: 2022 }); }],
    ["nonpositive position", p => Object.assign(p.result.stations[0], { position: 0 })],
    ["duplicate source key", p => { p.input.stations.push(source()); }],
    ["duplicate outcome", p => { p.result.stations.push(degree()); }],
    ["outcome without source", p => { p.result.stations[0].sourceKey = "absent"; }],
    ["source without outcome", p => { p.result.stations = []; }],
    ["duplicate position", p => { p.input.stations.push({ ...source(), key: "local-2" }); p.result.stations.push({ ...degree(), sourceKey: "local-2" }); }],
    ["position from source array order", p => Object.assign(p.result.stations[0], { position: 1 })],
    ["unrecognized decision field", p => { Object.assign(p.result.stations[0].unresolved[0], { field: "privateNarrative" }); }],
    ["personal decision text", p => { Object.assign(p.result.stations[0].unresolved[0], { reason: "Fictional Person" }); }],
    ["metadata on canonical station", p => Object.assign((p.result.stations[0] as ReturnType<typeof degree>).canonical, { sourceKey: "local-1" })],
    ["Alumni metadata leak", p => Object.assign(p.result, { alumni: { sourceKey: "local-1", email: "fictional@example.invalid" } })],
    ["provider metadata", p => Object.assign(p.input.stations[0], { providerId: "fictional-provider" })],
    ["automatic reference selection", p => Object.assign(p.result, { referenceDegreeId: "local-1" })],
    ["SurveyResponse", p => Object.assign(p.result, { surveyResponse: { confirmedAt: "2020-01-01" } })],
  ];
  it.each(mutations)("rejects %s", (_, mutate) => {
    const p = pair();
    mutate(p);
    expect(check(p).ok).toBe(false);
    expect(check(p).diagnostics.length).toBeGreaterThan(0);
  });
  it("rejects ONGOING inferred from a missing employment end", () => {
    const p = stepPair();
    Object.assign(p.result.stations[0].canonical, { temporalStatus: "ONGOING" });
    expect(check(p).ok).toBe(false);
  });
  it("rejects an endYear on an explicitly ongoing CareerStep", () => {
    const p = stepPair();
    Object.assign(p.input.stations[0], { temporalStatus: asserted("ONGOING") });
    Object.assign(p.result.stations[0].canonical, { temporalStatus: "ONGOING", endYear: 2022 });
    expect(check(p).ok).toBe(false);
  });
  it("rejects OTHER CareerStep without a factual role title", () => {
    const p = stepPair();
    Object.assign(p.input.stations[0], { classification: asserted({ type: "CAREER_STEP", careerStepType: "OTHER" }) });
    Object.assign(p.result.stations[0].canonical, { type: "OTHER", roleTitle: null });
    expect(check(p).ok).toBe(false);
  });
  it("returns stable indexed diagnostics without source keys, text, arbitrary fields or IDs", () => {
    const p = pair();
    p.input.stations[0].key = "fictional-person@example.invalid";
    p.input.stations[0].title = observed("Fictional Personal Text");
    Object.assign(p.result.stations[0], { "Fictional Private Field": "Fictional Private Value" });
    const diagnostics = check(p);
    expect(diagnostics).toEqual(check(structuredClone(p)));
    expect(diagnostics.ok).toBe(false);
    expect(JSON.stringify(diagnostics)).not.toMatch(/fictional|00000000|local-1/i);
    expect(diagnostics.diagnostics).toContainEqual({ side: "RESULT", stationIndex: 0, code: "INVALID_SHAPE" });
  });
  it.each([null, [], { stations: [null] }, { stations: "invalid" }])("rejects malformed runtime input %j", input => {
    expect(validateNormalizationContract(input, { stations: [] }).ok).toBe(false);
  });
});

describe("E.1 independent review regressions", () => {
  it.each([
    ["Degree", "title"], ["Degree", "fieldOfStudy"],
    ["CareerStep", "roleTitle"], ["CareerStep", "roleCategory"],
    ["CareerStep", "functionArea"], ["CareerStep", "location"],
  ])("F1 rejects invented %s.%s without dedicated source evidence", (kind, field) => {
    const p = kind === "Degree" ? pair() : stepPair();
    expect(check(p).ok).toBe(true);
    Object.assign((p.result.stations[0] as Exclude<StationOutcome, { kind: "REVIEW_REQUIRED" }>).canonical,
      { [field]: "Invented synthetic text" });
    expect(check(p).ok).toBe(false);
  });
  it.each(["Degree", "CareerStep"])("F1 does not substitute category/provider labels for %s title evidence", kind => {
    const p = kind === "Degree" ? pair() : stepPair();
    p.input.stations[0].title = missing;
    // Even exact label equality supplies no title evidence from another field.
    p.input.stations[0].category = observed("Fictional qualification");
    p.input.stations[0].providerLabel = observed("Fictional assistant");
    expect(check(p).ok).toBe(false);
  });
  it.each(["Degree", "CareerStep"])("F1 rejects %s title when the source explicitly says unknown", kind => {
    const p = kind === "Degree" ? pair() : stepPair();
    Object.assign(p.input.stations[0], { title: { kind: "UNKNOWN", origin: "ASSERTED" } });
    expect(check(p).ok).toBe(false);
  });
  it.each([observed, asserted])("F1 accepts supported title text from evidence factory %#", fact => {
    for (const p of [pair(), stepPair()]) {
      const title = p.input.stations[0].title;
      if (title.kind !== "OBSERVED") throw new Error("Expected authored source title");
      p.input.stations[0].title = fact(title.value);
      expect(check(p).ok).toBe(true);
    }
  });

  it.each(["COMPLETED", "IN_PROGRESS", "ENDED_WITHOUT_DEGREE", "UNKNOWN"] as const)(
    "F2 rejects CareerStep discarding asserted Degree status %s", status => {
      const p = stepPair();
      Object.assign(p.input.stations[0], { degreeStatus: asserted(status) });
      expect(check(p).ok).toBe(false);
    });
  it.each<SourceFact<SourceDate>>([
    observed({ precision: "YEAR", year: 2022 }), asserted({ precision: "YEAR", year: 2022 }),
    observed({ precision: "IMPRECISE", text: "around the early 2020s" }),
  ])("F2 rejects CareerStep discarding a supplied graduation fact %j", graduation => {
    const p = stepPair();
    Object.assign(p.input.stations[0], { graduation });
    expect(check(p).ok).toBe(false);
  });
  it.each(["ONGOING", "ENDED", "UNKNOWN"] as const)("F2 rejects Degree discarding asserted temporal status %s", status => {
    const p = pair();
    p.input.stations[0].temporalStatus = asserted(status);
    expect(check(p).ok).toBe(false);
  });
  it.each(["degreeStatus", "graduation", "temporalStatus"])("F2 preserves %s conflict for target-free review", field => {
    const p = pair();
    if (field === "temporalStatus") p.input.stations[0].temporalStatus = asserted("ENDED");
    else {
      p.input.stations[0].classification = asserted({ type: "CAREER_STEP", careerStepType: "EDUCATION" });
      if (field === "graduation") p.input.stations[0].graduation = asserted({ precision: "YEAR", year: 2022 });
    }
    p.result.stations = [{ sourceKey: "local-1", kind: "REVIEW_REQUIRED",
      unresolved: [{ field: "classification", reason: "CONFLICTING_FACTS" }] }];
    expect(check(p).ok).toBe(true);
    expect(p.result.stations[0]).not.toHaveProperty("canonical");
  });

  it.each((["startYear", "endYear", "graduationYear"] as const).flatMap(field =>
    (["MISSING", "IMPRECISE_DATE", "UNKNOWN"] as const).map(reason => ({ field, reason }))))(
    "F3 rejects $reason for precise $field", ({ field, reason }) => {
    const p = pair();
    if (field === "graduationYear") p.input.stations[0].graduation = observed({ precision: "YEAR", year: 2022 });
    const d = p.result.stations[0] as ReturnType<typeof degree>;
    d.canonical[field] = null;
    d.unresolved = [{ field, reason }];
    expect(check(p).ok).toBe(false);
  });
  it.each((["title", "status", "classification", "position"] as const).flatMap(field =>
    (["MISSING", "UNKNOWN"] as const).map(reason => ({ field, reason }))))(
    "F3 rejects $reason for supplied $field", ({ field, reason }) => {
    const p = pair();
    p.result.stations[0].unresolved.push({ field, reason });
    expect(check(p).ok).toBe(false);
  });
  it("F3 rejects MISSING for an imprecise expression that was supplied", () => {
    const p = pair();
    p.input.stations[0].start = observed({ precision: "IMPRECISE", text: "around a previous decade" });
    const d = p.result.stations[0] as ReturnType<typeof degree>;
    d.canonical.startYear = null;
    d.unresolved.push({ field: "startYear", reason: "MISSING" });
    expect(check(p).ok).toBe(false);
  });
  it("F3 rejects IMPRECISE_DATE for a missing date", () => {
    const p = pair();
    p.result.stations[0].unresolved = [{ field: "graduationYear", reason: "IMPRECISE_DATE" }];
    expect(check(p).ok).toBe(false);
  });
  it("F3 checks decision evidence on REVIEW_REQUIRED outcomes too", () => {
    const p = pair();
    p.result.stations = [{ sourceKey: "local-1", kind: "REVIEW_REQUIRED",
      unresolved: [{ field: "startYear", reason: "MISSING" }] }];
    expect(check(p).ok).toBe(false);
  });
  it("F3 rejects IMPRECISE_DATE on a text field even when text is supplied", () => {
    const p = pair();
    p.result.stations[0].unresolved.push({ field: "title", reason: "IMPRECISE_DATE" });
    expect(check(p).ok).toBe(false);
  });
  it("F3 permits a precise year withheld for declared conflicting facts", () => {
    const p = pair();
    const d = p.result.stations[0] as ReturnType<typeof degree>;
    d.canonical.startYear = null;
    d.unresolved.push({ field: "startYear", reason: "CONFLICTING_FACTS" });
    expect(check(p).ok).toBe(true);
  });
  it("F3 permits precise graduation evidence withheld pending status clarification", () => {
    const p = pair();
    p.input.stations[0].degreeStatus = { kind: "UNKNOWN", origin: "ASSERTED" };
    p.input.stations[0].graduation = observed({ precision: "YEAR", year: 2022 });
    const d = p.result.stations[0] as ReturnType<typeof degree>;
    Object.assign(d.canonical, { status: "UNKNOWN", endYear: null });
    d.unresolved = [
      { field: "status", reason: "UNKNOWN" }, { field: "endYear", reason: "STATUS_UNCERTAIN" },
      { field: "graduationYear", reason: "STATUS_UNCERTAIN" },
    ];
    expect(check(p).ok).toBe(true);
  });
});
