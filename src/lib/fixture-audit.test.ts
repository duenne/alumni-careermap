import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { auditFixturePair } from "./fixture-audit";

const sourceFormat = "LINKEDIN_MEMBER_SNAPSHOT_SYNTHETIC_V1";
function pair(syntheticId = "test-profile-a") {
  return {
    snapshots: [{ syntheticId, snapshot: { elements: [
      { snapshotDomain: "PROFILE", snapshotData: [{}] },
      { snapshotDomain: "EDUCATION", snapshotData: [{ "School Name": "Test School", "Degree Name": "Test Qualification", "Start Date": "2016", "End Date": "2020" }] },
      { snapshotDomain: "POSITIONS", snapshotData: [{ "Company Name": "Test Organisation", Title: "Test Role", "Started On": "2022-03", "Finished On": "" }] },
    ] } }],
    expected: [{ syntheticId, sourceFormat, profile: {}, msiAnchor: { stationId: "test-education", startYear: 2016, endYear: 2020 }, stations: [
      { stationId: "test-education", stationType: "EDUCATION", titleRaw: "Test Qualification", organisationRaw: "Test School", organisationCanonical: "Test School", degreeLevel: "BACHELOR", chronologyIndex: 1, startDate: { year: 2016, month: null, precision: "YEAR" }, endDate: { year: 2020, month: null, precision: "YEAR" }, isCurrent: false, isMsiAnchor: true },
      { stationId: "test-position", stationType: "POSITION", titleRaw: "Test Role", organisationRaw: "Test Organisation", organisationCanonical: "Test Organisation", employmentForm: "Test Employment Category", chronologyIndex: 3, startDate: { year: 2022, month: 3, precision: "MONTH" }, endDate: null, isCurrent: true },
    ] }],
  };
}

function codes(snapshots: unknown, expected: unknown) {
  return auditFixturePair(snapshots, expected).diagnostics.map(diagnostic => diagnostic.code);
}

describe("synthetic fixture structural audit", () => {
  it("accepts matching pairs, allows chronology gaps and produces deterministic aggregate counts", () => {
    const a = pair();
    const b = pair("test-profile-b");
    const snapshots = [...a.snapshots, ...b.snapshots];
    const expected = [...b.expected, ...a.expected];
    const result = auditFixturePair(snapshots, expected);
    expect(result.ok).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.errorCounts).toEqual({});
    expect(result.inventory).toMatchObject({
      snapshotEntries: 2, expectedEntries: 2, snapshotUniqueIds: 2, expectedUniqueIds: 2,
      matchingIds: 2, snapshotOnlyIds: 0, expectedOnlyIds: 0,
      sourceRecords: { profile: 2, education: 2, position: 2 },
      stations: { total: 4, education: 2, position: 2 }, anchors: 2,
      dates: { yearPrecision: 4, monthPrecision: 2, unknown: 2 },
      currentStations: { education: 0, position: 2 },
    });
    expect(auditFixturePair(snapshots, expected)).toEqual(result);
  });

  it.each([null, {}, "invalid", 42])("rejects non-array roots without throwing: %j", value => {
    expect(codes(value, [])).toContain("INPUT_NOT_ARRAY");
    expect(codes([], value)).toContain("INPUT_NOT_ARRAY");
  });

  it.each([null, [], "invalid"])("rejects malformed profile entries: %j", entry => {
    expect(codes([entry], [entry])).toEqual(["INVALID_ENTRY", "INVALID_ENTRY"]);
  });

  it.each([undefined, null, "", " \t\n", 123])("rejects missing or unusable synthetic IDs: %j", syntheticId => {
    const data = pair();
    const snapshots = [{ ...data.snapshots[0], syntheticId }];
    const expected = [{ ...data.expected[0], syntheticId }];
    expect(codes(snapshots, expected).filter(code => code === "INVALID_SYNTHETIC_ID")).toHaveLength(2);
  });

  it("rejects duplicate IDs independently within each input", () => {
    const data = pair();
    const result = auditFixturePair([...data.snapshots, ...data.snapshots], [...data.expected, ...data.expected]);
    expect(result.ok).toBe(false);
    expect(result.errorCounts.DUPLICATE_SYNTHETIC_ID).toBe(2);
    expect(result.inventory).toMatchObject({ snapshotEntries: 2, expectedEntries: 2, matchingIds: 1 });
  });

  it("reports mismatched ID sets by count rather than exposing the IDs", () => {
    const a = pair();
    const b = pair("test-profile-b");
    const result = auditFixturePair(a.snapshots, b.expected);
    expect(result.inventory).toMatchObject({ matchingIds: 0, snapshotOnlyIds: 1, expectedOnlyIds: 1 });
    expect(result.errorCounts.ID_SET_MISMATCH).toBe(1);
    expect(JSON.stringify(result)).not.toContain("test-profile");
  });

  it.each([undefined, "UNSUPPORTED"])("rejects an unexpected expected source format: %j", sourceFormat => {
    const data = pair();
    expect(codes(data.snapshots, [{ ...data.expected[0], sourceFormat }])).toContain("UNEXPECTED_SOURCE_FORMAT");
  });

  it("requires snapshot/elements containers and all three source domains", () => {
    const data = pair();
    expect(codes([{ syntheticId: "test-profile-a" }], data.expected)).toContain("INVALID_SNAPSHOT_STRUCTURE");
    expect(codes([{ ...data.snapshots[0], snapshot: { elements: {} } }], data.expected)).toContain("INVALID_SNAPSHOT_STRUCTURE");
    const elements = data.snapshots[0].snapshot.elements;
    expect(codes([{ ...data.snapshots[0], snapshot: { elements: elements.slice(1) } }], data.expected)).toContain("MISSING_SOURCE_DOMAIN");
    expect(codes([{ ...data.snapshots[0], snapshot: { elements: [...elements, elements[0]] } }], data.expected)).toContain("DUPLICATE_SOURCE_DOMAIN");
    expect(codes([{ ...data.snapshots[0], snapshot: { elements: [{ snapshotDomain: "UNSUPPORTED", snapshotData: [] }] } }], data.expected)).toContain("UNEXPECTED_SOURCE_DOMAIN");
  });

  it.each([null, [], {}])("rejects malformed snapshot elements: %j", element => {
    const data = pair();
    expect(codes([{ ...data.snapshots[0], snapshot: { elements: [element] } }], data.expected)).toContain("INVALID_SOURCE_ELEMENT");
  });

  it("requires array source data, a single PROFILE record and structurally usable source stations", () => {
    const data = pair();
    const withElement = (element: unknown) => [{ ...data.snapshots[0], snapshot: { elements: [element, ...data.snapshots[0].snapshot.elements.slice(1)] } }];
    expect(codes(withElement({ snapshotDomain: "PROFILE", snapshotData: {} }), data.expected)).toContain("INVALID_SOURCE_DATA");
    expect(codes(withElement({ snapshotDomain: "PROFILE", snapshotData: [] }), data.expected)).toContain("INVALID_PROFILE_RECORD_COUNT");
    expect(codes(withElement({ snapshotDomain: "PROFILE", snapshotData: [null] }), data.expected)).toContain("INVALID_SOURCE_RECORD");
    const source = structuredClone(data.snapshots);
    source[0].snapshot.elements[1].snapshotData = [{}];
    expect(codes(source, data.expected)).toContain("INVALID_SOURCE_RECORD");
  });

  it("checks raw date field types without parsing or repairing their text", () => {
    const data = pair();
    const source = structuredClone(data.snapshots);
    (source[0].snapshot.elements[1].snapshotData[0] as Record<string, unknown>)["Start Date"] = 2016;
    expect(codes(source, data.expected)).toContain("INVALID_SOURCE_DATE");
    (source[0].snapshot.elements[1].snapshotData[0] as Record<string, unknown>)["Start Date"] = "Test Unknown Date Text";
    expect(auditFixturePair(source, data.expected).ok).toBe(true);
  });

  it("requires the expected profile and stations structures", () => {
    const data = pair();
    expect(codes(data.snapshots, [{ ...data.expected[0], profile: null }])).toContain("INVALID_EXPECTED_PROFILE");
    expect(codes(data.snapshots, [{ ...data.expected[0], stations: {} }])).toContain("INVALID_STATIONS");
  });

  it.each([null, [], "invalid", {}])("rejects malformed expected stations: %j", station => {
    const data = pair();
    expect(codes(data.snapshots, [{ ...data.expected[0], stations: [station] }])).toContain("INVALID_STATION");
  });

  it.each([undefined, null, "", " \n", 42])("requires usable station IDs: %j", stationId => {
    const data = pair();
    expect(codes(data.snapshots, [{ ...data.expected[0], stations: [{ ...data.expected[0].stations[0], stationId }] }])).toContain("INVALID_STATION_ID");
  });

  it("rejects repeated station IDs within a profile, but permits them in different profiles", () => {
    const a = pair();
    const b = pair("test-profile-b");
    expect(auditFixturePair([...a.snapshots, ...b.snapshots], [...a.expected, ...b.expected]).ok).toBe(true);
    const expected = [{ ...a.expected[0], stations: [a.expected[0].stations[0], { ...a.expected[0].stations[1], stationId: "test-education" }] }];
    expect(codes(a.snapshots, expected)).toContain("DUPLICATE_STATION_ID");
  });

  it("requires an anchor with an existing station reference, without deciding academic eligibility", () => {
    const data = pair();
    expect(codes(data.snapshots, [{ ...data.expected[0], msiAnchor: null }])).toContain("INVALID_ANCHOR");
    expect(codes(data.snapshots, [{ ...data.expected[0], msiAnchor: { stationId: "" } }])).toContain("INVALID_ANCHOR");
    expect(codes(data.snapshots, [{ ...data.expected[0], msiAnchor: { stationId: "test-absent" } }])).toContain("ANCHOR_STATION_NOT_FOUND");
    expect(auditFixturePair(data.snapshots, [{ ...data.expected[0], msiAnchor: { stationId: "test-position" } }]).ok).toBe(true);
  });

  it.each([0, 10000, "2020", 2020.5])("rejects structurally invalid anchor years: %j", endYear => {
    const data = pair();
    expect(codes(data.snapshots, [{ ...data.expected[0], msiAnchor: { ...data.expected[0].msiAnchor, endYear } }])).toContain("INVALID_ANCHOR_YEAR");
  });

  it.each([
    undefined, "2020", [], {},
    { year: "2020", month: null, precision: "YEAR" },
    { year: 0, month: null, precision: "YEAR" },
    { year: 10000, month: null, precision: "YEAR" },
    { year: 2020.5, month: null, precision: "YEAR" },
    { year: 2020, month: 0, precision: "MONTH" },
    { year: 2020, month: 13, precision: "MONTH" },
    { year: 2020, month: "3", precision: "MONTH" },
    { year: 2020, month: null, precision: "MONTH" },
    { year: 2020, month: 3, precision: "YEAR" },
    { year: 2020, month: null, precision: "UNSUPPORTED" },
  ])("rejects invalid structured dates without coercion: %j", startDate => {
    const data = pair();
    expect(codes(data.snapshots, [{ ...data.expected[0], stations: [{ ...data.expected[0].stations[0], startDate }] }])).toContain("INVALID_DATE");
  });

  it("allows NULL dates, unknown classifications and overlapping years without doing normalization", () => {
    const data = pair();
    const expected = structuredClone(data.expected);
    const station = expected[0].stations[0] as Record<string, unknown>;
    station.startDate = null;
    station.degreeLevel = "Test Ambiguous Education Category";
    expect(auditFixturePair(data.snapshots, expected).ok).toBe(true);
    station.startDate = { year: 2022, month: null, precision: "YEAR" };
    station.endDate = { year: 2024, month: null, precision: "YEAR" };
    expect(auditFixturePair(data.snapshots, expected).ok).toBe(true);
  });

  it.each([0, -1, 1.5, "1", null])("rejects invalid chronology indexes: %j", chronologyIndex => {
    const data = pair();
    expect(codes(data.snapshots, [{ ...data.expected[0], stations: [{ ...data.expected[0].stations[0], chronologyIndex }] }])).toContain("INVALID_CHRONOLOGY_INDEX");
  });

  it("rejects duplicate chronology indexes without imposing gapless or date-derived ordering", () => {
    const data = pair();
    const stations = [data.expected[0].stations[0], { ...data.expected[0].stations[1], chronologyIndex: 1 }];
    expect(codes(data.snapshots, [{ ...data.expected[0], stations }])).toContain("DUPLICATE_CHRONOLOGY_INDEX");
    expect(auditFixturePair(data.snapshots, [{ ...data.expected[0], stations: [...data.expected[0].stations].reverse() }]).ok).toBe(true);
  });

  it("checks station discriminators, required text types and boolean metadata", () => {
    const data = pair();
    for (const changes of [{ stationType: "UNSUPPORTED" }, { titleRaw: 42 }, { degreeLevel: null }, { isCurrent: "false" }, { isMsiAnchor: 1 }, { description: {} }]) {
      expect(codes(data.snapshots, [{ ...data.expected[0], stations: [{ ...data.expected[0].stations[0], ...changes }] }])).toContain("INVALID_STATION");
    }
  });

  it("checks optional summary count and flag types without treating them as domain facts", () => {
    const data = pair();
    for (const summary of [null, [], { educationCount: "1" }, { positionCount: -1 }, { hasConcurrentStations: "true" }]) {
      expect(codes(data.snapshots, [{ ...data.expected[0], summary }])).toContain("INVALID_SUMMARY");
    }
    expect(auditFixturePair(data.snapshots, [{ ...data.expected[0], summary: { educationCount: 1, hasConcurrentStations: true } }]).ok).toBe(true);
  });

  it("never echoes profile text, provider identifiers, IDs, unexpected labels, dynamic keys or invalid values", () => {
    const marker = "TEST_PRIVATE_VALUE_DO_NOT_REPORT";
    const data = pair(marker);
    const expected = { ...data.expected[0], sourceFormat: marker, profile: { firstName: marker, lastName: marker, headline: marker, summary: marker, providerId: marker, [marker]: marker }, msiAnchor: { stationId: marker }, stations: [{ ...data.expected[0].stations[0], stationId: marker, titleRaw: marker, description: marker, degreeLevel: marker, chronologyIndex: marker, startDate: marker }] };
    const snapshot = { ...data.snapshots[0], snapshot: { elements: [{ snapshotDomain: marker, snapshotData: [{ "First Name": marker }] }] } };
    const report = auditFixturePair([snapshot], [expected]);
    expect(report.ok).toBe(false);
    expect(JSON.stringify(report)).not.toContain(marker);
    expect(report.diagnostics).toContainEqual({ code: "UNEXPECTED_SOURCE_FORMAT", input: "expected", entryIndex: 0 });
  });

  it("does not mutate or repair either input", () => {
    const data = pair();
    data.expected[0].stations[1].chronologyIndex = -1;
    const before = structuredClone(data);
    expect(auditFixturePair(data.snapshots, data.expected).ok).toBe(false);
    expect(data).toEqual(before);
  });
});

describe("fixture audit command", () => {
  const command = fileURLToPath(new URL("../../scripts/audit-phase-d-fixtures.mjs", import.meta.url));
  const run = promisify(execFile);
  async function execute(source: string | undefined, expected: string) {
    const directory = await mkdtemp(join(tmpdir(), "careermap-fixture-audit-"));
    const snapshotsPath = join(directory, "snapshots.json");
    const expectedPath = join(directory, "expected.json");
    try {
      if (source !== undefined) await writeFile(snapshotsPath, source);
      await writeFile(expectedPath, expected);
      let outcome: { stdout: string; stderr: string; code: number };
      try {
        const result = await run(process.execPath, ["--experimental-strip-types", command, snapshotsPath, expectedPath], { timeout: 5000 });
        outcome = { ...result, code: 0 };
      } catch (error) {
        outcome = error as { stdout: string; stderr: string; code: number };
      }
      if (source !== undefined) expect(await readFile(snapshotsPath, "utf8")).toBe(source);
      expect(await readFile(expectedPath, "utf8")).toBe(expected);
      return outcome;
    } finally { await rm(directory, { recursive: true, force: true }); }
  }

  it("audits newly authored temporary inputs, independent of the local corpus", async () => {
    const data = pair();
    const result = await execute(JSON.stringify(data.snapshots), JSON.stringify(data.expected));
    expect(result.code).toBe(0);
    const report = JSON.parse(result.stdout);
    expect(report.ok).toBe(true);
    expect(report.inventory.matchingIds).toBe(1);
    expect(report.inputs.snapshots.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("fails closed with safe diagnostics for invalid JSON and missing files", async () => {
    const marker = "TEST_PRIVATE_VALUE_DO_NOT_REPORT";
    const invalid = await execute(`{"profileText":"${marker}"`, "[]");
    expect(invalid.code).toBe(1);
    expect(JSON.parse(invalid.stdout)).toMatchObject({ ok: false, diagnostics: [{ code: "INVALID_JSON", input: "snapshots" }] });
    expect(invalid.stdout + invalid.stderr).not.toContain(marker);
    const missing = await execute(undefined, "[]");
    expect(missing.code).toBe(1);
    expect(JSON.parse(missing.stdout)).toMatchObject({ ok: false, diagnostics: [{ code: "FILE_READ_FAILED", input: "snapshots" }] });
  });

  it("returns a nonzero exit code for structural errors", async () => {
    const data = pair();
    const result = await execute(JSON.stringify(data.snapshots), "[]");
    expect(result.code).toBe(1);
    expect(JSON.parse(result.stdout).errorCounts.ID_SET_MISMATCH).toBe(1);
  });

  it("does not echo invalid command arguments", async () => {
    const marker = "TEST_PRIVATE_ARGUMENT_DO_NOT_REPORT";
    let failure: unknown;
    try { await run(process.execPath, ["--experimental-strip-types", command, marker], { timeout: 5000 }); }
    catch (error) { failure = error; }
    expect(failure).toMatchObject({ code: 1 });
    const { stdout, stderr } = failure as { stdout: string; stderr: string };
    expect(JSON.parse(stdout)).toMatchObject({ ok: false, diagnostics: [{ code: "INVALID_ARGUMENTS", input: "pair" }] });
    expect(stdout + stderr).not.toContain(marker);
  });
});
