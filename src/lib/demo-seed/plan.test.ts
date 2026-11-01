import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import { minimalCorpus } from "../analytics/test-corpus";
import { inspectDemoProfiles, planV5DemoSeed } from "./plan";

// Any accidental runtime use of the existing database boundaries must fail.
vi.mock("pg", () => { throw new Error("DATABASE_ACCESS_FORBIDDEN"); });
vi.mock("@prisma/adapter-pg", () => { throw new Error("DATABASE_ACCESS_FORBIDDEN"); });
vi.mock("../../generated/prisma/client", () => { throw new Error("DATABASE_ACCESS_FORBIDDEN"); });

const program = "11111111-1111-4111-8111-111111111111";
const otherProgram = "22222222-2222-4222-8222-222222222222";
function input() {
  const { sources, expected } = minimalCorpus();
  return { source: sources, expected, referenceProgramId: program, selections: expected.map(p => ({
    syntheticId: p.syntheticId, stationId: p.msiAnchor.stationId, programId: program,
    confirmation: "SYNTHETIC_TEST_ONLY",
  })) };
}
function verifiedInput() {
  const value = input();
  return { policy: "v5-demo-mini-v1", sourceText: JSON.stringify(value.source),
    expectedText: JSON.stringify(value.expected), referenceProgramId: program, selections: value.selections };
}
const codes = (value: ReturnType<typeof inspectDemoProfiles>) => value.validationErrors.map(e => e.code);

describe("D1.1 pinned source boundary", () => {
  it("accepts the small, repository-authored synthetic fixture", () => {
    const plan = planV5DemoSeed(verifiedInput());
    expect(plan.valid).toBe(true);
    expect(plan.survey).toEqual({ name: "SYNTHETISCH / DEMO – Alumni MSI", referenceProgramId: program,
      targetStatus: "CLOSED", requiredWriteLifecycle: ["DRAFT", "OPEN", "CLOSED"] });
    expect(plan.summary).toMatchObject({ plannedProfiles: 1, plannedStations: 4, degrees: 1,
      careerSteps: 3, referenceDegrees: 1, responses: 1, excludedProfiles: 0, validationErrors: 0 });
    expect(plan.validationErrors).toEqual([]);
  });
  it.each([undefined, "unknown", "phase-d-v1", "real-excel", "linkedin-live"])("rejects unapproved policy %s", policy => {
    expect(() => planV5DemoSeed({ ...verifiedInput(), policy })).toThrow("SOURCE_POLICY_NOT_APPROVED");
  });
  it.each([undefined, "", "[]"])("rejects missing/incomplete fixture %s", sourceText => {
    expect(() => planV5DemoSeed({ ...verifiedInput(), sourceText })).toThrow(/FIXTURE_REQUIRED|CHECKSUM_MISMATCH/);
  });
  it("rejects absent companion and unexpected checksum, including whitespace changes", () => {
    expect(() => planV5DemoSeed({ ...verifiedInput(), expectedText: undefined })).toThrow("FIXTURE_REQUIRED");
    expect(() => planV5DemoSeed({ ...verifiedInput(), expectedText: verifiedInput().expectedText + " " })).toThrow("CHECKSUM_MISMATCH");
  });
  it("never silently selects the fixture anchor", () => {
    const plan = planV5DemoSeed({ ...verifiedInput(), selections: [] });
    expect(plan.valid).toBe(false);
    expect(plan.summary.responses).toBe(0);
    expect(codes(plan)).toContain("REFERENCE_SELECTION_REQUIRED");
  });
  it("does not echo invalid program configuration into the plan", () => {
    const plan = planV5DemoSeed({ ...verifiedInput(), referenceProgramId: "DO_NOT_COPY_CONFIG" });
    expect(plan.valid).toBe(false);
    expect(plan.survey.referenceProgramId).toBeNull();
    expect(JSON.stringify(plan)).not.toContain("DO_NOT_COPY_CONFIG");
  });
  it("is deterministic, does not mutate input and returns independent objects", () => {
    const value = verifiedInput(), before = structuredClone(value);
    const first = planV5DemoSeed(value), second = planV5DemoSeed(value);
    expect(first).toEqual(second);
    expect(value).toEqual(before);
    first.profiles[0].stations[0].canonical.startYear = 123;
    expect(planV5DemoSeed(value)).toEqual(second);
  });
  it("keeps source identities, contacts, tokens, narratives and raw profiles out of all outputs", () => {
    const value = input();
    Object.assign(value.source[0], { access_token: "DO_NOT_COPY_TOKEN", email: "DO_NOT_COPY_EMAIL" });
    Object.assign(value.source[0].snapshot.elements[1].snapshotData[0], { Description: "DO_NOT_COPY_NOTE", oauth: "DO_NOT_COPY_OAUTH" });
    Object.assign(value.expected[0], { privateNotes: "DO_NOT_COPY_NOTE" });
    const plan = inspectDemoProfiles(value);
    expect(plan.summary.responses).toBe(1);
    expect(JSON.stringify(plan)).not.toMatch(/DO_NOT_COPY|PRIVATE_|syntheticId|stationId|snapshot|access_token|email|confirmedAt|demoAnchor/);
    expect(plan.profiles[0].response.confirmation).toBe("SYNTHETIC_TEST_ONLY");
  });
  it("has a closed runtime dependency graph without I/O, env, clocks, random IDs or persistence", () => {
    // Inspect actual transitive runtime imports; type-only Prisma imports are allowed.
    const visited = new Set<string>();
    function inspect(path: string) {
      if (visited.has(path)) return;
      visited.add(path);
      const source = readFileSync(path, "utf8");
      expect(source).not.toMatch(/process\.|\bDate\s*\(|Math\.random|randomUUID|\bfetch\s*\(|\$transaction|\$queryRaw/);
      const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
      function walk(node: ts.Node) {
        expect(ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword
          || ts.isIdentifier(node.expression) && node.expression.text === "require")).toBe(false);
        if (ts.isImportDeclaration(node) && !node.importClause?.isTypeOnly) {
          const specifier = (node.moduleSpecifier as ts.StringLiteral).text;
          if (specifier.startsWith(".")) inspect(resolve(dirname(path), specifier + ".ts"));
          else expect(specifier).toBe("node:crypto");
        }
        ts.forEachChild(node, walk);
      }
      walk(file);
    }
    inspect(resolve("src/lib/demo-seed/plan.ts"));
    expect(visited.size).toBeGreaterThan(3);
    expect(planV5DemoSeed(verifiedInput()).valid).toBe(true);
  });
});

describe("D1.1 pure domain inspection (no source approval or persistence authority)", () => {
  it("rejects incomplete pairs and duplicate synthetic profile IDs", () => {
    const value = input();
    expect(codes(inspectDemoProfiles({ ...value, source: undefined }))).toContain("INPUT_NOT_ARRAY");
    expect(codes(inspectDemoProfiles({ ...value, expected: [] }))).toContain("ID_SET_MISMATCH");
    value.source.push(structuredClone(value.source[0]));
    expect(codes(inspectDemoProfiles(value))).toContain("DUPLICATE_SYNTHETIC_ID");
  });
  it("rejects empty and missing station domains", () => {
    const value = input();
    expect(codes(inspectDemoProfiles({ ...value, source: [], expected: [], selections: [] }))).toContain("EMPTY_FIXTURE");
    value.source[0].snapshot.elements.pop();
    expect(codes(inspectDemoProfiles(value))).toContain("MISSING_SOURCE_DOMAIN");
  });
  it.each(["missing", "ambiguous", "unconfirmed", "foreign", "program", "unfinished"])("rejects %s reference", kind => {
    const value = input();
    if (kind === "missing") value.selections[0].stationId = "absent";
    if (kind === "ambiguous") value.selections.push({ ...value.selections[0] });
    if (kind === "unconfirmed") value.selections[0].confirmation = "HUMAN_CONSENT";
    if (kind === "foreign") value.selections[0].syntheticId = "foreign-profile";
    if (kind === "program") value.selections[0].programId = otherProgram;
    if (kind === "unfinished") {
      value.source[0].snapshot.elements[2].snapshotData[0]["End Date"] = "";
      value.expected[0].stations[1].endDate = null;
    }
    const plan = inspectDemoProfiles(value);
    expect(plan.summary.responses).toBe(0);
    expect(plan.validationErrors.length).toBeGreaterThan(0);
  });
  it("requires one explicit selection even with multiple completed degrees; does not choose the latest", () => {
    const value = input();
    value.expected[0].stations[2].degreeLevel = "MASTER";
    const plan = inspectDemoProfiles(value);
    expect(plan.summary).toMatchObject({ degrees: 2, responses: 1 });
    expect(plan.profiles[0].response.referenceDegreeKey).toBe("profile:1:station:2");
  });
  it("does not allow vocational training or an exchange to be a reference degree", () => {
    for (const stationId of ["training", "exchange"]) {
      const value = input(); value.selections[0].stationId = stationId;
      const plan = inspectDemoProfiles(value);
      expect(codes(plan)).toContain("INVALID_REFERENCE_DEGREE");
      expect(plan.summary.plannedStations).toBe(0);
    }
  });
  it.each(["academic", "position", "date-mismatch", "year-range", "reverse", "current-end"])("rejects invalid %s station without partial profiles", kind => {
    const value = input();
    if (kind === "academic") value.expected[0].stations[2].degreeLevel = "NOT_A_DEGREE";
    if (kind === "position") value.expected[0].stations[0].employmentForm = "NOT_A_JOB";
    if (kind === "date-mismatch") value.expected[0].stations[1].startDate!.year = 1900;
    if (kind === "year-range") value.expected[0].stations[1].startDate!.year = 10000;
    if (kind === "reverse") {
      value.expected[0].stations[1].startDate!.year = 2020;
      value.source[0].snapshot.elements[2].snapshotData[0]["Start Date"] = "2020";
    }
    if (kind === "current-end") value.expected[0].stations[1].isCurrent = true;
    const plan = inspectDemoProfiles(value);
    expect(plan.summary).toMatchObject({ plannedProfiles: 0, plannedStations: 0, responses: 0 });
    expect(plan.validationErrors.length).toBeGreaterThan(0);
  });
  it("retains unknown facts and maps vocational training and exchange without artificial awards", () => {
    const plan = inspectDemoProfiles(input());
    const stations = plan.profiles[0].stations;
    expect(stations.map(s => s.position)).toEqual([1, 2, 3, 4]);
    expect(stations[0].canonical).toMatchObject({ type: "VOCATIONAL_TRAINING", temporalStatus: "ENDED" });
    expect(stations[3].canonical).toMatchObject({ type: "EDUCATION" });
    expect(stations[1].canonical).toMatchObject({ status: "COMPLETED", graduationYear: null, programId: program, institutionId: null });
    expect(stations[2].canonical).toMatchObject({ temporalStatus: "UNKNOWN", endYear: null });
    expect(plan.summary).toMatchObject({ vocationalTraining: 1, exchanges: 1, monthPrecisionReduced: 1 });
  });
  it("links every response to exactly its own selected completed degree and program", () => {
    const value = input();
    value.source.push({ ...structuredClone(value.source[0]), syntheticId: "SECOND_SYNTHETIC" });
    value.expected.push({ ...structuredClone(value.expected[0]), syntheticId: "SECOND_SYNTHETIC" });
    value.selections.push({ ...value.selections[0], syntheticId: "SECOND_SYNTHETIC" });
    const plan = inspectDemoProfiles(value);
    expect(plan.summary.responses).toBe(2);
    for (const profile of plan.profiles) {
      const degree = profile.stations.find(s => s.key === profile.response.referenceDegreeKey)!;
      expect(profile.response.alumniKey).toBe(profile.key);
      expect(degree.alumniKey).toBe(profile.key);
      expect(degree.canonical).toMatchObject({ programId: program, status: "COMPLETED" });
      expect(profile.response.referenceProgramId).toBe(program);
    }
  });
  it("rejects invalid program configuration and exposes safe diagnostics only", () => {
    const value = input();
    expect(codes(inspectDemoProfiles({ ...value, referenceProgramId: "PRIVATE_BAD_ID" }))).toContain("INVALID_REFERENCE_PROGRAM");
    value.expected[0].stations[2].degreeLevel = "DO_NOT_COPY_BAD_VALUE";
    const plan = inspectDemoProfiles(value);
    expect(JSON.stringify(plan.validationErrors)).not.toMatch(/PRIVATE_|DO_NOT_COPY/);
    expect(plan.validationErrors[0]).toMatchObject({ profileNumber: 1, code: "AMBIGUOUS_CLASSIFICATION" });
  });
  it("rejects a completed degree from another program instead of assigning it to MSI", () => {
    const value = input();
    value.expected[0].stations[2].degreeLevel = "MASTER";
    value.selections[0].stationId = "training";
    const plan = inspectDemoProfiles(value);
    expect(codes(plan)).toContain("INVALID_REFERENCE_DEGREE");
    expect(plan.summary.responses).toBe(0);
  });
  it("rejects ambiguous title/provider correlation rather than taking the first unused row", () => {
    const value = input();
    const rows = value.source[0].snapshot.elements[2].snapshotData;
    rows.push(structuredClone(rows[0]));
    value.expected[0].stations.push({ ...structuredClone(value.expected[0].stations[1]), stationId: "duplicate-ba", chronologyIndex: 5 });
    expect(codes(inspectDemoProfiles(value))).toContain("AMBIGUOUS_STATION_CORRELATION");
  });
  it("rejects duplicate companion IDs and timeline positions", () => {
    const value = input();
    expect(codes(inspectDemoProfiles({ ...value, expected: [...value.expected, ...value.expected] }))).toContain("DUPLICATE_SYNTHETIC_ID");
    value.expected[0].stations[0].chronologyIndex = 1;
    expect(codes(inspectDemoProfiles(value))).toContain("DUPLICATE_CHRONOLOGY_INDEX");
  });
  it("keeps valid profiles intact but reports an invalid second profile without replacing it", () => {
    const value = input();
    value.source.push({ ...structuredClone(value.source[0]), syntheticId: "SECOND_SYNTHETIC" });
    value.expected.push({ ...structuredClone(value.expected[0]), syntheticId: "SECOND_SYNTHETIC" });
    value.selections.push({ ...value.selections[0], syntheticId: "SECOND_SYNTHETIC", stationId: "exchange" });
    const plan = inspectDemoProfiles(value);
    expect(plan.summary).toMatchObject({ plannedProfiles: 1, plannedStations: 4, responses: 1, excludedProfiles: 1 });
    expect(plan.validationErrors).toEqual([{ code: "INVALID_REFERENCE_DEGREE", profileNumber: 2, stationNumber: 4 }]);
  });
});
