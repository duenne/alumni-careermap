import { describe, expect, it } from "vitest";
import fictionalSnapshot from "../../test-fixtures/linkedin-snapshots/fictional-member.json";
import type { SourceDate, SourceFact } from "./contract";
import { adaptLinkedInSnapshot } from "./adapt-linkedin-snapshot";
import { normalizeCareerBatch } from "./normalize-career-batch";
import { validateNormalizationContract } from "./validate";

const missing = { kind: "MISSING" } as const;
const observed = <T>(value: T) => ({ kind: "OBSERVED", value }) as const;
const errorMessage = "Invalid LinkedIn-shaped snapshot contract";
const snapshot = () => structuredClone(fictionalSnapshot);
function observe(value: unknown) {
  const before = structuredClone(value);
  const input = adaptLinkedInSnapshot(value);
  const result = normalizeCareerBatch(input);
  expect(validateNormalizationContract(input, result)).toEqual({ ok: true, diagnostics: [] });
  expect(value).toEqual(before);
  expect(result.stations.map(s => s.sourceKey)).toEqual(input.stations.map(s => s.key));
  for (const outcome of result.stations) {
    expect(outcome).toEqual({ sourceKey: outcome.sourceKey, kind: "REVIEW_REQUIRED",
      unresolved: [{ field: "classification", reason: "CLASSIFICATION_UNCERTAIN" }] });
  }
  return input;
}
function expectInvalid(value: unknown) {
  const before = structuredClone(value);
  for (let attempt = 0; attempt < 2; attempt++) {
    expect(() => adaptLinkedInSnapshot(value)).toThrow(new Error(errorMessage));
  }
  expect(value).toEqual(before);
}
// Independently authored expected observations. No D.1 corpus or D.2 oracle.
describe("E.4a LinkedIn-shaped snapshot observations", () => {
  it("maps multiple position and education records as observations only", () => {
    expect(observe(snapshot())).toEqual({ stations: [
      { key: "snapshot:1:0", title: observed("Synthetic Research Assistant"), category: observed("POSITIONS"),
        providerLabel: observed("Synthetic University"), start: observed({ precision: "MONTH", year: 2023, month: 3 }),
        end: missing, graduation: missing, classification: missing, degreeStatus: missing,
        temporalStatus: missing, position: missing, catalog: { kind: "UNKNOWN" } },
      { key: "snapshot:1:1", title: observed("Synthetic Internship"), category: observed("POSITIONS"),
        providerLabel: observed("Synthetic Workshop"), start: observed({ precision: "YEAR", year: 2019 }),
        end: observed({ precision: "MONTH", year: 2020, month: 2 }), graduation: missing, classification: missing,
        degreeStatus: missing, temporalStatus: missing, position: missing, catalog: { kind: "UNKNOWN" } },
      { key: "snapshot:2:0", title: observed("Synthetic M.Sc."), category: observed("EDUCATION"),
        providerLabel: observed("Synthetic University"), start: observed({ precision: "YEAR", year: 2019 }),
        end: observed({ precision: "YEAR", year: 2022 }), graduation: missing, classification: missing,
        degreeStatus: missing, temporalStatus: missing, position: missing, catalog: { kind: "UNKNOWN" } },
      { key: "snapshot:2:1", title: observed("Synthetic Short Course"), category: observed("EDUCATION"),
        providerLabel: observed("Synthetic Workshop"), start: observed({ precision: "IMPRECISE", text: "around 2018" }),
        end: missing, graduation: missing, classification: missing, degreeStatus: missing,
        temporalStatus: missing, position: missing, catalog: { kind: "UNKNOWN" } },
    ] });
  });
  it("does not infer classification, level, completion, ongoing status, catalogs or positions", () => {
    const input = observe(snapshot());
    expect(input.stations).toHaveLength(4);
    for (const source of input.stations) {
      for (const field of ["classification", "degreeStatus", "temporalStatus", "graduation", "position"] as const) {
        expect(source[field]).toEqual(missing);
      }
      expect(source.catalog).toEqual({ kind: "UNKNOWN" });
    }
    expect(normalizeCareerBatch(input).stations).toHaveLength(4);
  });
  it("ignores PROFILE and unsupported narrative, location and provider ID fields", () => {
    const input = observe(snapshot());
    const serialized = JSON.stringify(input);
    for (const value of Object.values(fictionalSnapshot.elements[0].snapshotData[0])) {
      expect(serialized).not.toContain(value);
    }
    expect(serialized).not.toMatch(/FICTIONAL_|fictional-private-|Description|Location|Activities|Notes|Member ID|Profile URL/);
    expect(Object.keys(input)).toEqual(["stations"]);
    for (const source of input.stations) expect(Object.keys(source).sort()).toEqual([
      "key", "title", "category", "providerLabel", "start", "end", "graduation",
      "classification", "degreeStatus", "temporalStatus", "position", "catalog",
    ].sort());
  });
  it("never inspects opaque PROFILE fields, including nested data", () => {
    const value = snapshot();
    const profile = Object.defineProperty({}, "private", { enumerable: true, get() { throw new Error("Private field read"); } });
    Object.assign(value.elements[0], { snapshotData: [profile] });
    expect(adaptLinkedInSnapshot(value)).toEqual(adaptLinkedInSnapshot(snapshot()));
  });
  it("ignores extra station metadata even when shaped like canonical assertions", () => {
    const value = snapshot();
    Object.assign(value.elements[1].snapshotData[0], { classification: { type: "CAREER_STEP", careerStepType: "EMPLOYMENT" },
      position: 99, temporalStatus: "ONGOING", organisationId: "fictional-private-org-id", email: "fictional@example.invalid" });
    Object.assign(value.elements[2].snapshotData[0], { level: "MASTER", status: "COMPLETED", graduationYear: 2022, programId: "fictional-private-program-id" });
    expect(observe(value)).toEqual(observe(snapshot()));
  });
  it("preserves traversal order and parallel observations without inferring chronology or gaps", () => {
    const value = snapshot();
    value.elements = [value.elements[2], value.elements[0], value.elements[1]];
    value.elements[2].snapshotData.reverse();
    const input = observe(value);
    expect(input.stations.map(s => s.key)).toEqual(["snapshot:0:0", "snapshot:0:1", "snapshot:2:0", "snapshot:2:1"]);
    expect(input.stations.map(s => s.title)).toEqual([
      observed("Synthetic M.Sc."), observed("Synthetic Short Course"), observed("Synthetic Internship"), observed("Synthetic Research Assistant"),
    ]);
    expect(input.stations).toHaveLength(4);
    expect(new Set(input.stations.map(s => s.key)).size).toBe(4);
  });
  it("uses only local indexes for deterministic keys, unaffected by personal identifiers", () => {
    const value = snapshot();
    Object.assign(value.elements[0], { snapshotData: [{ "Member ID": "fictional-replacement-member", "First Name": "Fictional Replacement" }] });
    Object.assign(value.elements[1].snapshotData[0], { "Position ID": "fictional-replacement-position" });
    expect(observe(value)).toEqual(observe(snapshot()));
  });
  it("does not mutate frozen snapshots or retain mutable source references", () => {
    const value = snapshot();
    function freeze(v: unknown) {
      if (v !== null && typeof v === "object") { Object.values(v).forEach(freeze); Object.freeze(v); }
    }
    freeze(value);
    const input = observe(value);
    input.stations[0].title = observed("Changed output only");
    expect(value).toEqual(fictionalSnapshot);
    expect(adaptLinkedInSnapshot(value)).toEqual(adaptLinkedInSnapshot(snapshot()));
  });
  it("accepts empty station arrays with one opaque PROFILE record", () => {
    expect(observe({ elements: [
      { snapshotDomain: "EDUCATION", snapshotData: [] }, { snapshotDomain: "PROFILE", snapshotData: [{}] },
      { snapshotDomain: "POSITIONS", snapshotData: [] },
    ] })).toEqual({ stations: [] });
  });

  const dateExamples: [string, SourceFact<SourceDate>][] = [
    ["2023", observed({ precision: "YEAR", year: 2023 })],
    ["0001", observed({ precision: "YEAR", year: 1 })], ["9999", observed({ precision: "YEAR", year: 9999 })],
    ["  2023\t", observed({ precision: "YEAR", year: 2023 })],
    ["\tMar 2023\n", observed({ precision: "MONTH", month: 3, year: 2023 })],
    ["", missing], [" \t\n", missing],
    ...["0000", "10000", "23", "-2023", "2023.0", "2023-03", "2023/03/01", "March 2023", "mar 2023", "Sept 2023",
      "Mar 0000", "Feb 10000", "Mar  2023", "Dec 202X", "13 2023", "2020–2022", "around 2023", "Present", "unknown"]
      .map((text): [string, SourceFact<SourceDate>] => [text, observed({ precision: "IMPRECISE", text })]),
    ["  around 2023  ", observed({ precision: "IMPRECISE", text: "around 2023" })],
  ];
  it.each(dateExamples)("conservatively parses date %j without guessing", (text, expected) => {
    const value = snapshot();
    Object.assign(value.elements[1].snapshotData[0], { "Started On": text });
    expect(observe(value).stations[0]?.start).toEqual(expected);
  });
  it.each(["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"])(
    "supports the explicitly enumerated English month %s", month => {
      const numbers: Record<string, number> = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
      const value = snapshot();
      Object.assign(value.elements[1].snapshotData[0], { "Finished On": `${month} 2021` });
      expect(observe(value).stations[0]?.end).toEqual(observed({ precision: "MONTH", month: numbers[month], year: 2021 }));
    });
  const sourceFields = [
    [1, "Title"], [1, "Company Name"], [1, "Started On"], [1, "Finished On"],
    [2, "Degree Name"], [2, "School Name"], [2, "Start Date"], [2, "End Date"],
  ] as const;
  it.each(sourceFields)("rejects non-string required field at element %s / %s", (element, field) => {
    const value = snapshot(); Object.assign(value.elements[element].snapshotData[0], { [field]: 2023 });
    expectInvalid(value);
  });
  it.each(sourceFields)("rejects absent required field at element %s / %s", (element, field) => {
    const value = snapshot(); Reflect.deleteProperty(value.elements[element].snapshotData[0], field);
    expectInvalid(value);
  });
  it.each([[1, "Title"], [1, "Company Name"], [2, "Degree Name"], [2, "School Name"]] as const)(
    "represents blank source text as MISSING: %s / %s", (element, field) => {
      const value = snapshot(); Object.assign(value.elements[element].snapshotData[0], { [field]: " \t" });
      const source = observe(value).stations[element === 1 ? 0 : 2];
      expect(source?.[field === "Title" || field === "Degree Name" ? "title" : "providerLabel"]).toEqual(missing);
    });
  it("preserves nonblank title and provider text verbatim", () => {
    const value = snapshot();
    Object.assign(value.elements[1].snapshotData[0], { Title: "  Synthetic e\u0301 role  ", "Company Name": " Synthetic Provider " });
    expect(observe(value).stations[0]).toMatchObject({ title: observed("  Synthetic e\u0301 role  "), providerLabel: observed(" Synthetic Provider ") });
  });

  const invalidEnvelopes: [string, unknown][] = [
    ["null", null], ["undefined", undefined], ["array root", []], ["primitive root", "fictional-private-root"],
    ["missing elements", {}], ["null elements", { elements: null }], ["object elements", { elements: {} }],
    ["empty elements", { elements: [] }], ["sparse elements", { elements: Array(3) }],
    ["extra root fields", { ...snapshot(), memberId: "fictional-private-root-id" }],
    ["null element", { elements: [null] }],
  ];
  it.each(invalidEnvelopes)("rejects malformed envelope with a fixed redacted error: %s", (_, value) => expectInvalid(value));
  it.each(["PROFILE", "POSITIONS", "EDUCATION"])("requires exactly one %s domain", domain => {
    const absent = snapshot(); absent.elements = absent.elements.filter(e => e.snapshotDomain !== domain);
    expectInvalid(absent);
    const duplicate = snapshot(); duplicate.elements.push(structuredClone(duplicate.elements.find(e => e.snapshotDomain === domain)!));
    expectInvalid(duplicate);
  });
  it.each([null, [], 17, "fictional-private-record"].map(record => ({ record })))("rejects non-record station data: $record", ({ record }) => {
    const value = snapshot(); Object.assign(value.elements[1], { snapshotData: [record] }); expectInvalid(value);
  });
  it.each([null, {}, "fictional-private-data"])("rejects non-array snapshotData: %j", data => {
    const value = snapshot(); Object.assign(value.elements[1], { snapshotData: data }); expectInvalid(value);
  });
  it("rejects sparse station data instead of silently dropping it", () => {
    const value = snapshot(); Object.assign(value.elements[2], { snapshotData: Array(1) }); expectInvalid(value);
  });
  it.each([[], [{}, {}], [null], [[]], ["fictional-private-profile"]].map(data => ({ data })))("requires one opaque PROFILE object: $data", ({ data }) => {
    const value = snapshot(); Object.assign(value.elements[0], { snapshotData: data }); expectInvalid(value);
  });
  it.each(["fictional-private-domain", "positions", null])("rejects unsupported snapshotDomain: %j", domain => {
    const value = snapshot(); Object.assign(value.elements[1], { snapshotDomain: domain }); expectInvalid(value);
  });
  it("rejects additional envelope element keys without echoing identifiers", () => {
    const value = snapshot(); Object.assign(value.elements[1], { providerId: "fictional-private-element-id" }); expectInvalid(value);
  });
});
