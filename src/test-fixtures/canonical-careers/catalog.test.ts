import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { careerCases, catalogs } from "./catalog";
import type { CareerCase, SourceDate, StationTarget } from "./contract";
import { syntheticInputs } from "./inputs";
import { expectedProfiles } from "./expected";

const caseIds = Array.from({ length: 12 }, (_, index) => `career-${String(index + 1).padStart(2, "0")}`);
// CI runs unit tests before prisma generate. Read the schema's vocabulary rather
// than importing a generated runtime module or duplicating enum declarations.
const schema = readFileSync(new URL("../../../prisma/schema.prisma", import.meta.url), "utf8");
function enumValues(name: string) {
  const declaration = schema.match(new RegExp(`enum ${name} \\{([^}]+)\\}`));
  expect(declaration, `Prisma enum ${name}`).not.toBeNull();
  return declaration![1].trim().split(/\s+/);
}
const unique = (keys: (string | number)[]) => expect(new Set(keys).size).toBe(keys.length);
const targetKey = (target: StationTarget) => target.type === "DEGREE" ? target.degreeKey : target.careerStepKey;
function dateYear(date: SourceDate): number | null {
  return date && date.precision !== "IMPRECISE" ? date.year : null;
}
function year(value: number | null) {
  if (value === null) return;
  expect(Number.isInteger(value)).toBe(true);
  expect(value).toBeGreaterThanOrEqual(1);
  expect(value).toBeLessThanOrEqual(9999);
}

// Test assertions only: this checks the authored oracle, never normalizes input.
function assertContract(fixture: CareerCase) {
  const { input, expected } = fixture;
  expect(fixture.provenance).toBe("INDEPENDENTLY_AUTHORED_FICTIONAL");
  expect(input.caseId).toBe(fixture.caseId);
  expect(expected.caseId).toBe(fixture.caseId);
  expect(Object.keys(expected).sort()).toEqual([
    "alumni", "careerSteps", "caseId", "degrees", "mappings", "reference", "timeline", "unresolved",
  ]);
  expect(Object.keys(expected.alumni)).toEqual(["key"]);
  expect(expected.alumni.key).toMatch(/^alumni-\d{2}$/);
  const sources = new Map(input.stations.map(station => [station.key, station]));
  unique(input.stations.map(station => station.key));
  unique(input.stations.map(station => station.timelinePosition));
  for (const key of sources.keys()) expect(key).toMatch(/^source-[a-z0-9-]+$/);
  for (const source of input.stations) {
    expect(Number.isInteger(source.timelinePosition)).toBe(true);
    expect(source.timelinePosition).toBeGreaterThan(0);
    expect(source.label).toMatch(/^Synthetic /);
    if (source.providerLabel !== null) expect(source.providerLabel).toMatch(/^Synthetic /);
    for (const date of [source.start, source.end, source.graduation]) {
      if (date === null) continue;
      if (date.precision === "IMPRECISE") expect(date.text).toMatch(/\S/);
      else {
        year(date.year);
        if (date.precision === "MONTH") {
          expect(Number.isInteger(date.month)).toBe(true);
          expect(date.month).toBeGreaterThanOrEqual(1);
          expect(date.month).toBeLessThanOrEqual(12);
        } else expect(date.precision).toBe("YEAR");
      }
    }
  }
  unique([...expected.degrees, ...expected.careerSteps].map(station => station.key));
  unique(expected.mappings.map(mapping => mapping.sourceKey));
  expect(expected.mappings.map(mapping => mapping.sourceKey).sort()).toEqual([...sources.keys()].sort());
  const mappedKeys: string[] = [];
  const assertTarget = (target: StationTarget) => {
    expect(enumValues("AlumniTimelineItemType")).toContain(target.type);
    if (target.type === "DEGREE") {
      expect(target.careerStepKey).toBeNull();
      expect(expected.degrees.some(degree => degree.key === target.degreeKey)).toBe(true);
    } else {
      expect(target.degreeKey).toBeNull();
      expect(expected.careerSteps.some(step => step.key === target.careerStepKey)).toBe(true);
    }
  };
  for (const mapping of expected.mappings) {
    const source = sources.get(mapping.sourceKey)!;
    expect(source).toBeDefined();
    if (mapping.outcome === "REVIEW_REQUIRED") {
      expect(source.kind).toBe("unclear");
      expect(mapping.questions.length).toBeGreaterThan(0);
      expect(mapping).not.toHaveProperty("target");
      expect(expected.unresolved.some(decision => decision.sourceKey === source.key)).toBe(true);
      continue;
    }
    expect(mapping.outcome).toBe("MAPPED");
    assertTarget(mapping.target);
    mappedKeys.push(targetKey(mapping.target));
    expect(expected.timeline.find(item => targetKey(item) === targetKey(mapping.target))?.position).toBe(source.timelinePosition);
    const station = mapping.target.type === "DEGREE"
      ? expected.degrees.find(degree => degree.key === targetKey(mapping.target))!
      : expected.careerSteps.find(step => step.key === targetKey(mapping.target))!;
    expect(station.startYear).toBe(dateYear(source.start));
    if ("status" in station) {
      expect(source.kind).toBe("academic");
      expect(station.graduationYear).toBe(dateYear(source.graduation));
      const evidence = { awarded: "COMPLETED", studying: "IN_PROGRESS", "left-without-award": "ENDED_WITHOUT_DEGREE", unspecified: "UNKNOWN" };
      expect(station.status).toBe(evidence[source.outcome as keyof typeof evidence]);
      expect(station.programKey).toBe(source.catalogAssociation?.kind === "program" ? source.catalogAssociation.key : null);
      expect(station.institutionKey).toBe(source.catalogAssociation?.kind === "institution" ? source.catalogAssociation.key : null);
    } else {
      expect(source.kind).not.toBe("academic");
      expect(source.kind).not.toBe("unclear");
      const activityTypes = {
        vocational: "VOCATIONAL_TRAINING", exchange: "EDUCATION", course: "EDUCATION",
        employment: "EMPLOYMENT", internship: "INTERNSHIP",
        "self-employment": "SELF_EMPLOYMENT", volunteering: "VOLUNTEERING",
      };
      expect(station.type).toBe(activityTypes[source.kind as keyof typeof activityTypes]);
      const evidence = { ongoing: "ONGOING", ended: "ENDED", unspecified: "UNKNOWN" };
      expect(station.temporalStatus).toBe(evidence[source.outcome as keyof typeof evidence]);
      expect(station.organisationKey).toBe(source.catalogAssociation?.kind === "organisation" ? source.catalogAssociation.key : null);
    }
    const status = "status" in station ? station.status : station.temporalStatus;
    expect(station.endYear).toBe(["UNKNOWN", "IN_PROGRESS", "ONGOING"].includes(status) ? null : dateYear(source.end));
    if (source.end !== null && station.endYear === null) {
      expect(expected.unresolved.some(decision => decision.sourceKey === source.key && decision.fields.includes("endYear"))).toBe(true);
    }
  }
  // A source station cannot become both a Degree and an EDUCATION step.
  unique(mappedKeys);
  expect(mappedKeys.sort()).toEqual([...expected.degrees, ...expected.careerSteps].map(station => station.key).sort());
  for (const degree of expected.degrees) {
    expect(Object.keys(degree).sort()).toEqual(["endYear", "graduationYear", "institutionKey", "key", "level", "programKey", "startYear", "status", "title"]);
    if (degree.title !== null) expect(degree.title).toMatch(/\S/);
    expect(enumValues("DegreeLevel")).toContain(degree.level);
    expect(enumValues("DegreeStatus")).toContain(degree.status);
    expect(degree.programKey === null || degree.institutionKey === null).toBe(true);
    if (degree.programKey !== null) expect(catalogs.programs.some(program => program.key === degree.programKey)).toBe(true);
    if (degree.institutionKey !== null) expect(catalogs.institutions.some(institution => institution.key === degree.institutionKey)).toBe(true);
    if (["DIPLOMA", "OTHER"].includes(degree.level)) expect(degree.title).toMatch(/\S/);
    year(degree.graduationYear);
    if (degree.graduationYear !== null) {
      expect(degree.status).toBe("COMPLETED");
      for (const bound of [degree.startYear, degree.endYear]) if (bound !== null) expect(degree.graduationYear).toBeGreaterThanOrEqual(bound);
    }
    if (["IN_PROGRESS", "UNKNOWN"].includes(degree.status)) expect(degree.endYear).toBeNull();
  }
  for (const step of expected.careerSteps) {
    expect(Object.keys(step).sort()).toEqual(["endYear", "key", "organisationKey", "roleTitle", "startYear", "temporalStatus", "type"]);
    if (step.roleTitle !== null) expect(step.roleTitle).toMatch(/\S/);
    expect(enumValues("CareerStepType")).toContain(step.type);
    expect(enumValues("CareerStepTemporalStatus")).toContain(step.temporalStatus);
    if (["ONGOING", "UNKNOWN"].includes(step.temporalStatus)) expect(step.endYear).toBeNull();
    if (step.type === "OTHER") expect(step.roleTitle).toMatch(/\S/);
    if (step.organisationKey !== null) expect(catalogs.organisations.some(organisation => organisation.key === step.organisationKey)).toBe(true);
  }
  for (const station of [...expected.degrees, ...expected.careerSteps]) {
    expect(station.key).toMatch(/\S/);
    year(station.startYear); year(station.endYear);
    if (station.startYear !== null && station.endYear !== null) expect(station.startYear).toBeLessThanOrEqual(station.endYear);
  }
  unique(expected.timeline.map(item => item.position));
  unique(expected.timeline.map(targetKey));
  expect(expected.timeline.map(targetKey).sort()).toEqual([...mappedKeys].sort());
  for (const item of expected.timeline) {
    assertTarget(item);
    expect(Number.isInteger(item.position)).toBe(true);
    expect(item.position).toBeGreaterThan(0);
    expect(Object.keys(item).sort()).toEqual(["careerStepKey", "degreeKey", "position", "type"]);
  }
  for (const decision of expected.unresolved) {
    expect(sources.has(decision.sourceKey)).toBe(true);
    expect(decision.fields.length).toBeGreaterThan(0);
    expect(decision.reason).toMatch(/\S/);
  }
  expect(catalogs.programs.some(program => program.key === fixture.survey.referenceProgramKey)).toBe(true);
  expect(expected.reference.selection).toBe("REQUIRES_CONFIRMATION");
  expect(Object.keys(expected.reference).sort()).toEqual(["candidateDegreeKeys", "selection"]);
  unique(expected.reference.candidateDegreeKeys);
  expect([...expected.reference.candidateDegreeKeys].sort()).toEqual(expected.degrees
    .filter(degree => degree.status === "COMPLETED" && degree.programKey === fixture.survey.referenceProgramKey)
    .map(degree => degree.key).sort());
  expect(JSON.stringify(expected)).not.toMatch(/confirmedAt|surveyResponse|referenceDegreeId|firstName|lastName|email|providerId|linkedin|rawProfile|cvUrl|notes/i);
}

function findCase(id: string) {
  const fixture = careerCases.find(item => item.caseId === id);
  expect(fixture, id).toBeDefined();
  return fixture!;
}

describe("canonical synthetic career fixture contract", () => {
  it("contains exactly 12 uniquely identified, independently authored cases", () => {
    expect(careerCases.map(fixture => fixture.caseId).sort()).toEqual(caseIds);
    unique(careerCases.map(fixture => fixture.caseId));
    expect(syntheticInputs.map(profile => profile.caseId).sort()).toEqual(caseIds);
    expect(expectedProfiles.map(profile => profile.caseId).sort()).toEqual(caseIds);
  });
  it("uses shared catalog keys with existing Institutions, never name-based identity", () => {
    for (const entries of Object.values(catalogs)) {
      unique(entries.map(entry => entry.key));
      for (const entry of entries) expect(entry.name).toMatch(/^Synthetic /);
    }
    for (const program of catalogs.programs) expect(catalogs.institutions.some(institution => institution.key === program.institutionKey)).toBe(true);
    expect(catalogs.organisations.some(organisation => /unknown/i.test(organisation.name))).toBe(false);
    expect(catalogs.institutions[0].name).toBe(catalogs.institutions[1].name);
    expect(catalogs.institutions[0].key).not.toBe(catalogs.institutions[1].key);
  });
  it.each(caseIds)("satisfies ownership, enum, mapping, date, timeline, privacy and candidate invariants: %s", id => {
    assertContract(findCase(id));
  });
  it.each([
    ["career-01", ["BACHELOR", "MASTER"], []],
    ["career-02", ["BACHELOR"], ["EMPLOYMENT"]],
    ["career-03", [], ["VOCATIONAL_TRAINING"]],
    ["career-04", ["BACHELOR"], ["EDUCATION"]],
    ["career-06", ["CERTIFICATE"], ["EDUCATION"]],
    ["career-07", [], ["EMPLOYMENT"]],
    ["career-08", [], ["SELF_EMPLOYMENT", "VOLUNTEERING"]],
  ] satisfies [string, string[], string[]][])("retains the required scenario classification without extra stations: %s", (id, levels, types) => {
    const expected = findCase(id).expected;
    expect(expected.degrees.map(degree => degree.level)).toEqual(levels);
    expect(expected.careerSteps.map(step => step.type)).toEqual(types);
  });
  it("preserves overlap, timeline gaps and explicit order independent of graduation years", () => {
    const overlap = findCase("career-02").expected;
    expect(overlap.careerSteps[0].startYear!).toBeLessThan(overlap.degrees[0].endYear!);
    expect(overlap.careerSteps[0].endYear!).toBeGreaterThan(overlap.degrees[0].startYear!);
    expect(overlap.timeline[1].position - overlap.timeline[0].position).toBeGreaterThan(1);
    const revised = findCase("career-11").expected;
    const ordered = [...revised.timeline].sort((a, b) => a.position - b.position);
    const years = ordered.map(item => revised.degrees.find(degree => degree.key === targetKey(item))!.graduationYear!);
    expect(years[0]).toBeGreaterThan(years[1]);
  });
  it("preserves source order hints independently of array traversal order", () => {
    const fixture = structuredClone(findCase("career-11"));
    fixture.input.stations.reverse();
    fixture.expected.timeline.reverse();
    assertContract(fixture);
  });
  it("retains unknown graduation, imprecise dates, unknown status and unassigned Organisation", () => {
    expect(findCase("career-05").expected.degrees[0]).toMatchObject({ level: "PHD", status: "COMPLETED", graduationYear: null });
    const missing = findCase("career-09");
    expect(missing.input.stations.some(station => station.start?.precision === "IMPRECISE")).toBe(true);
    expect(missing.expected.degrees[0]).toMatchObject({ status: "UNKNOWN", startYear: null, endYear: null, graduationYear: null });
    expect(missing.expected.careerSteps.map(step => step.temporalStatus)).toEqual(["UNKNOWN", "ENDED"]);
    expect(missing.expected.careerSteps.every(step => step.endYear === null)).toBe(true);
    expect(findCase("career-10").expected.careerSteps[0].organisationKey).toBeNull();
  });
  it("leaves ambiguous classification without a placeholder station or timeline target", () => {
    const fixture = findCase("career-12");
    expect(fixture.expected.mappings[0].outcome).toBe("REVIEW_REQUIRED");
    expect(fixture.expected.degrees).toEqual([]);
    expect(fixture.expected.careerSteps).toEqual([]);
    expect(fixture.expected.timeline).toEqual([]);
  });
  it("keeps both single and multiple reference candidates unselected", () => {
    expect(findCase("career-01").expected.reference.candidateDegreeKeys).toHaveLength(1);
    expect(findCase("career-11").expected.reference.candidateDegreeKeys).toHaveLength(2);
    for (const fixture of careerCases) expect(fixture.expected.reference.selection).toBe("REQUIRES_CONFIRMATION");
  });

  // Mutation checks demonstrate that assertions reject broken fixtures.
  it.each([
    ["duplicate source", "career-02", (f: CareerCase) => { f.input.stations[1].key = f.input.stations[0].key; }],
    ["missing source", "career-01", (f: CareerCase) => { f.expected.mappings[0].sourceKey = "source-absent"; }],
    ["two catalog associations", "career-01", (f: CareerCase) => { Object.assign(f.expected.degrees[0], { institutionKey: "institution-a" }); }],
    ["invalid Degree enum", "career-01", (f: CareerCase) => { Object.assign(f.expected.degrees[0], { level: "VOCATIONAL" }); }],
    ["invalid CareerStep enum", "career-07", (f: CareerCase) => { Object.assign(f.expected.careerSteps[0], { type: "EMPLOYED" }); }],
    ["missing required field", "career-07", (f: CareerCase) => { Object.assign(f.expected.careerSteps[0], { temporalStatus: undefined }); }],
    ["ongoing end", "career-07", (f: CareerCase) => { f.expected.careerSteps[0].endYear = 2026; }],
    ["invented date", "career-09", (f: CareerCase) => { f.expected.degrees[0].startYear = 2010; }],
    ["invented graduation", "career-05", (f: CareerCase) => { f.expected.degrees[0].graduationYear = 2020; }],
    ["guessed completion", "career-09", (f: CareerCase) => { f.expected.degrees[0].status = "COMPLETED"; }],
    ["guessed ongoing status", "career-09", (f: CareerCase) => { f.expected.careerSteps[0].temporalStatus = "ONGOING"; }],
    ["wrong activity classification", "career-03", (f: CareerCase) => { f.expected.careerSteps[0].type = "EDUCATION"; }],
    ["invented Organisation", "career-10", (f: CareerCase) => { f.expected.careerSteps[0].organisationKey = "organisation-a"; }],
    ["two timeline targets", "career-02", (f: CareerCase) => { Object.assign(f.expected.timeline[0], { careerStepKey: f.expected.careerSteps[0].key }); }],
    ["missing timeline target", "career-01", (f: CareerCase) => { f.expected.timeline[0].degreeKey = "absent"; }],
    ["nonpositive position", "career-01", (f: CareerCase) => { f.expected.timeline[0].position = 0; }],
    ["duplicate position", "career-01", (f: CareerCase) => { f.expected.timeline[1].position = f.expected.timeline[0].position; }],
    ["ignored source order", "career-11", (f: CareerCase) => { f.expected.timeline[0].position = 8; }],
    ["duplicate academic station", "career-02", (f: CareerCase) => { f.expected.mappings.push({ sourceKey: f.input.stations[0].key, outcome: "MAPPED", target: { type: "CAREER_STEP", degreeKey: null, careerStepKey: f.expected.careerSteps[0].key } }); }],
    ["hidden ambiguity", "career-12", (f: CareerCase) => { f.expected.mappings = []; }],
    ["automatic selection", "career-01", (f: CareerCase) => { Object.assign(f.expected.reference, { referenceDegreeId: "degree-bachelor" }); }],
    ["confirmed response", "career-01", (f: CareerCase) => { Object.assign(f.expected, { surveyResponse: { confirmedAt: "2020-01-01" } }); }],
    ["personal identifier", "career-01", (f: CareerCase) => { Object.assign(f.expected.alumni, { firstName: "Synthetic Person", email: "synthetic@example.invalid", providerId: "fictional-provider" }); }],
  ] satisfies [string, string, (fixture: CareerCase) => void][])("rejects %s", (_, id, mutate) => {
    const fixture = structuredClone(findCase(id));
    mutate(fixture);
    expect(() => assertContract(fixture)).toThrow();
  });
});
