import { describe, expect, it } from "vitest";
import { mapCareerImport, readCareerSnapshot, suggestReviews, type ImportReview } from "./mapping";

export const syntheticSnapshot = () => ({ elements: [
  { snapshotDomain: "EDUCATION", snapshotData: [
    { "Degree Name": "Synthetic B.Sc.", "School Name": "Synthetic Institute", "Start Date": "2017", "End Date": "2021", Notes: "PRIVATE_MARKER" },
    { "Degree Name": "Synthetic vocational training", "School Name": "Synthetic Workshop", "Start Date": "2015", "End Date": "2017" },
  ] },
  { snapshotDomain: "POSITIONS", snapshotData: [
    { Title: "Synthetic developer", "Company Name": "Synthetic Company", "Started On": "Mar 2021", "Finished On": "", Location: "Synthetic Town", Description: "PRIVATE_MARKER" },
  ] },
] });
export const syntheticReviews = (): ImportReview[] => [
  { sourceKey: "snapshot:2:0", classification: "DEGREE:BACHELOR", status: "COMPLETED", position: 2, catalog: "UNKNOWN" },
  { sourceKey: "snapshot:2:1", classification: "CAREER_STEP:VOCATIONAL_TRAINING", status: "ENDED", position: 1, catalog: "UNKNOWN" },
  { sourceKey: "snapshot:1:0", classification: "CAREER_STEP:EMPLOYMENT", status: "ONGOING", position: 3, catalog: "CREATE" },
];

describe("JSON to reviewed database mapping", () => {
  it("accepts combined and raw API envelopes, ignores PROFILE and preserves only supported facts", () => {
    const value = syntheticSnapshot();
    const result = readCareerSnapshot(value);
    expect(result.elements.map(e => e.snapshotDomain)).toEqual(["PROFILE", "POSITIONS", "EDUCATION"]);
    expect(result.elements[1].snapshotData[0].Location).toBe("Synthetic Town");
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE_MARKER|Notes|Description/);
    const dump = { kind: "linkedin-raw-preview", complete: false, domains: value.elements.map(e => ({ domain: e.snapshotDomain, stopped: "HTTP_ERROR", pages: [
      { page: 0, status: 200, requestKind: "initial", body: { elements: [e], paging: { start: 0, links: [] } } },
      { page: 1, status: 404, requestKind: "probe", body: { message: "No data found for this domain and memberId.", status: 404 } },
    ] })) };
    expect(readCareerSnapshot(dump)).toEqual(result);
  });
  it("does not accept partial, duplicated or failed raw pages as a complete source", () => {
    for (const stopped of ["PREVIEW_LIMIT", "DIAGNOSTIC_ERROR"]) {
      expect(() => readCareerSnapshot({ kind: "linkedin-raw-preview", domains: [{ domain: "EDUCATION", stopped, pages: [] }] })).toThrow();
    }
    expect(() => readCareerSnapshot({ elements: [syntheticSnapshot().elements[0]] })).toThrow();
    expect(() => readCareerSnapshot({ elements: [...syntheticSnapshot().elements, syntheticSnapshot().elements[0]] })).toThrow();
  });
  it("maps reviewed training, degree, employment, gaps and overlapping years without invented graduation or catalog IDs", () => {
    const snapshot = readCareerSnapshot(syntheticSnapshot());
    const result = mapCareerImport(snapshot, syntheticReviews());
    expect(result.stations.map(s => [s.sourceKey, s.kind, s.position])).toEqual([
      ["snapshot:1:0", "RESOLVED_CAREER_STEP", 3], ["snapshot:2:0", "RESOLVED_DEGREE", 2], ["snapshot:2:1", "RESOLVED_CAREER_STEP", 1],
    ]);
    expect(result.stations[1].canonical).toMatchObject({ level: "BACHELOR", status: "COMPLETED", startYear: 2017, endYear: 2021, graduationYear: null, programId: null, institutionId: null });
    expect(result.stations[0].canonical).toMatchObject({ type: "EMPLOYMENT", temporalStatus: "ONGOING", startYear: 2021, endYear: null, location: "Synthetic Town" });
    expect(result.stations[2].canonical).toMatchObject({ type: "VOCATIONAL_TRAINING" });
  });
  it("requires exactly one decision per current source and rejects conflicts and duplicate positions", () => {
    const snapshot = readCareerSnapshot(syntheticSnapshot());
    expect(() => mapCareerImport(snapshot, syntheticReviews().slice(1))).toThrow();
    const duplicate = syntheticReviews(); duplicate[0].position = 3;
    expect(() => mapCareerImport(snapshot, duplicate)).toThrow();
    const conflict = syntheticReviews(); conflict[0].status = "IN_PROGRESS";
    expect(() => mapCareerImport(snapshot, conflict)).toThrow();
    const extra = syntheticReviews(); Object.assign(extra[0], { alumniId: "forged" });
    expect(() => mapCareerImport(snapshot, extra)).toThrow();
  });
  it("suggestions never assert completion, ongoing work or a reference; unknown dates remain unknown", () => {
    const result = suggestReviews(readCareerSnapshot(syntheticSnapshot()));
    expect(result.find(r => r.classification === "DEGREE:BACHELOR")?.status).toBe("UNKNOWN");
    expect(result.find(r => r.sourceKey === "snapshot:1:0")?.status).toBe("UNKNOWN");
    expect(result.every(r => r.catalog === "UNKNOWN")).toBe(true);
  });
});
