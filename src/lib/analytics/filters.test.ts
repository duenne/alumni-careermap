import { expect, it } from "vitest";
import { filterMasterProfiles, focusStages } from "./filters";
import { overviewProfile } from "./overview-fixtures";
import { aggregateOverview } from "./overview";

it("filters on definite post-MSI master presence; unknown is never treated as absence", () => {
  const a = overviewProfile("with"), b = overviewProfile("without"), c = overviewProfile("unknown");
  b.stations = b.stations.filter(s => s.type !== "MASTER"); c.stations[1].startYear = null;
  const profiles = [a, b, c], original = structuredClone(profiles);
  expect(filterMasterProfiles(profiles, "all").profiles).toEqual(profiles);
  expect(filterMasterProfiles(profiles, "with").profiles.map(p => p.id)).toEqual(["with"]);
  const without = filterMasterProfiles(profiles, "without");
  expect(without.profiles.map(p => p.id)).toEqual(["without"]);
  expect(without.removed).toEqual([{ alumniId: "with", reason: "MASTER_FILTER_MISMATCH" }, { alumniId: "unknown", reason: "MASTER_PRESENCE_UNKNOWN" }]);
  expect(without.unknown).toBe(1);
  expect(aggregateOverview(without.profiles).links.reduce((n, l) => n + l.value, 0)).toBe(3);
  expect(profiles).toEqual(original);
});
it("focus affects presentation stages, never person membership or weights", () => {
  expect(focusStages("sectors", "overview")).toEqual([2]);
  expect(focusStages("jobs", "history")).toEqual([2, 6]);
  expect(focusStages("fields", "overview")).toEqual([1]);
  expect(focusStages("fields", "history")).toEqual([0, 4]);
  expect(focusStages("all", "overview")).toEqual([0, 1, 2, 3]);
});
