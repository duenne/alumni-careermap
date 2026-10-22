import { describe, expect, it } from "vitest";
import snapshot from "../../test-fixtures/linkedin-snapshots/fictional-member.json";
import { adaptLinkedInSnapshot } from "../../lib/normalization/adapt-linkedin-snapshot";
import type { SourceFact, SourceDate } from "../../lib/normalization/contract";
import { proposeDisplayOrder } from "./timeline-order";
import { applyTimelineOrder } from "./degree-review-draft";

const observed = (year: number, month?: number): SourceFact<SourceDate> => ({ kind: "OBSERVED", value: month === undefined ? { precision: "YEAR", year } : { precision: "MONTH", year, month } });
describe("display proposal, not timeline assertions", () => {
  it("retains all fixture keys once, with stable year-only starts", () => {
    const input = adaptLinkedInSnapshot(snapshot), before = structuredClone(input);
    expect(proposeDisplayOrder(input)).toEqual([input.stations[1].key, input.stations[2].key, input.stations[0].key]); expect(input).toEqual(before);
  });
  it("compares precise months within one year", () => {
    const input = adaptLinkedInSnapshot(snapshot);
    [observed(2020, 12), observed(2020, 2), observed(2020, 2), observed(2019, 11)].forEach((start, index) => { input.stations[index].start = start; });
    expect(proposeDisplayOrder(input)).toEqual([3, 1, 2, 0].map(index => input.stations[index].key));
  });
  it("preserves source order across incomparable year precision, without inventing a month", () => {
    const input = adaptLinkedInSnapshot(snapshot);
    [observed(2020, 12), observed(2020), observed(2020, 1), observed(2020)].forEach((start, index) => { input.stations[index].start = start; });
    expect(proposeDisplayOrder(input)).toEqual(input.stations.map(source => source.key));
  });
  it("never parses imprecise text and excludes absent/imprecise starts from the proposal", () => {
    const input = adaptLinkedInSnapshot(snapshot);
    input.stations[0].start = { kind: "OBSERVED", value: { precision: "IMPRECISE", text: "around 1000" } };
    input.stations[1].start = { kind: "MISSING" }; input.stations[2].start = observed(9999); input.stations[3].start = { kind: "UNKNOWN", origin: "OBSERVED" };
    expect(proposeDisplayOrder(input)).toEqual([input.stations[2].key]);
  });
  it("ignores asserted dates when proposing observed source order", () => {
    const input = adaptLinkedInSnapshot(snapshot); input.stations[0].start = { kind: "ASSERTED", value: { precision: "YEAR", year: 1900 } };
    expect(proposeDisplayOrder(input)).toEqual([1, 2].map(index => input.stations[index].key));
  });
  it("supports empty input", () => { expect(proposeDisplayOrder({ stations: [] })).toEqual([]); });
  it.each([null, [], ["unknown"], ["snapshot:1:0", "snapshot:1:0", "snapshot:2:0", "snapshot:2:1"]])("rejects malformed confirmation %j safely", order => {
    const input = adaptLinkedInSnapshot(snapshot), before = structuredClone(input);
    expect(applyTimelineOrder(input, order)).toMatchObject({ ok: false, field: "order" }); expect(input).toEqual(before);
  });
});
