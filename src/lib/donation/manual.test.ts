import { expect, it } from "vitest";
import { parseManualParticipation, type ManualParticipation } from "./manual";

import { manualExample } from "../../../tests/support/manual-participation";

it("accepts explicit Master selection, unknown years and a participant-controlled timeline without inferring a level", () => {
  const input = manualExample();
  expect(parseManualParticipation(input)).toEqual(input);
  input.stations.reverse(); expect(parseManualParticipation(input).stations[0].key).toBe("job-1");
  const degree = input.stations[1]; if (degree.kind === "DEGREE") degree.graduationYear = null;
  expect(parseManualParticipation(input).stations[1]).toMatchObject({ graduationYear: null });
});
it("rejects missing selection/confirmations and a reference that is unfinished, foreign or absent", () => {
  for (const edit of [
    (v: ManualParticipation) => { v.referenceKey = ""; },
    (v: ManualParticipation) => { v.referenceConfirmed = false; },
    (v: ManualParticipation) => { v.contributionConfirmed = false; },
    (v: ManualParticipation) => { v.referenceKey = "job-1"; },
    (v: ManualParticipation) => { v.referenceKey = "missing"; },
    (v: ManualParticipation) => { const d = v.stations[0]; if (d.kind === "DEGREE") d.program = "OTHER"; },
    (v: ManualParticipation) => { const d = v.stations[0]; if (d.kind === "DEGREE") { d.status = "IN_PROGRESS"; d.endYear = null; d.graduationYear = null; } },
  ]) { const value = manualExample(); edit(value); expect(() => parseManualParticipation(value)).toThrow(); }
});
it("validates date/status invariants, explicit vocabulary, duplicate keys, limits and extra identity/contact fields", () => {
  for (const change of [
    { startYear: 2021 }, { graduationYear: 2019 }, { startYear: 0 }, { endYear: 10000 }, { level: "" },
    { status: "UNKNOWN" }, { title: " " }, { programId: "foreign-id" }, { email: "synthetic@example.invalid" },
  ]) { const value = manualExample(); Object.assign(value.stations[0], change); expect(() => parseManualParticipation(value)).toThrow(); }
  const duplicate = manualExample(); duplicate.stations[1].key = duplicate.stations[0].key;
  expect(() => parseManualParticipation(duplicate)).toThrow();
  expect(() => parseManualParticipation({ ...manualExample(), alumniId: "foreign-id" })).toThrow();
  const ongoingEnd = manualExample(); ongoingEnd.stations[1].endYear = 2025;
  expect(() => parseManualParticipation(ongoingEnd)).toThrow();
});
it("allows draft review before confirmations and normalizes text without mutating the input", () => {
  const value = manualExample(); value.referenceConfirmed = false; value.contributionConfirmed = false;
  value.stations[0].title = "  Synthetischer Master  ";
  expect(parseManualParticipation(value, false).stations[0].title).toBe("Synthetischer Master");
  expect(value.stations[0].title).toBe("  Synthetischer Master  ");
});
it("requires duplicate stations to be corrected even when their browser keys differ", () => {
  const input = manualExample();
  input.stations.push({ ...input.stations[0], key: "another-key", title: "  SYNTHETISCHER MASTER  " });
  expect(() => parseManualParticipation(input)).toThrow(/doppelt/);
});
