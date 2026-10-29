import { aggregateOverview } from "./overview";
import type { AnalyticsProfile } from "./records";
export type MasterFilter = "all" | "with" | "without";
export type AnalysisFocus = "all" | "sectors" | "jobs" | "fields";

/** Identical master presence semantics for both views; UNKNOWN never means no. */
export function filterMasterProfiles(profiles: AnalyticsProfile[], filter: MasterFilter) {
  const decisions = new Map(aggregateOverview(profiles).decisions.map(d => [d.alumniId, d]));
  const unknown = profiles.filter(p => !decisions.has(p.id) || decisions.get(p.id)!.master.presence === "UNKNOWN").length;
  const removed: { alumniId: string; reason: string }[] = [];
  const selected = profiles.filter(p => {
    if (filter === "all") return true;
    const presence = decisions.get(p.id)?.master.presence ?? "UNKNOWN";
    if (presence === (filter === "with" ? "WITH" : "WITHOUT")) return true;
    removed.push({ alumniId: p.id, reason: presence === "UNKNOWN" ? "MASTER_PRESENCE_UNKNOWN" : "MASTER_FILTER_MISMATCH" });
    return false;
  });
  return { profiles: selected, removed, unknown };
}
/** Display focus only: does not alter cohort, topology or weights. */
export function focusStages(focus: AnalysisFocus, view: "overview" | "history"): number[] {
  if (view === "overview") return { all: [0, 1, 2, 3], sectors: [2], jobs: [3], fields: [1] }[focus];
  return { all: [0, 1, 2, 3, 4, 5, 6], sectors: [1, 5], jobs: [2, 6], fields: [0, 4] }[focus];
}
