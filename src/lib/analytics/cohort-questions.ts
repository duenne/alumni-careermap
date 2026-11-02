import { referenceStations } from "./aggregate";
import { aggregateOverview } from "./overview";
import type { AnalyticsProfile, AnalyticsStation } from "./records";

export type QuestionCount = { label: string; count: number };
function counts(values: (string | null)[][]): QuestionCount[] {
  const result = new Map<string, number>();
  for (const profile of values) for (const value of new Set(profile.filter((v): v is string => !!v))) result.set(value, (result.get(value) ?? 0) + 1);
  return [...result].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "de"));
}
const work = (s: AnalyticsStation) => s.kind === "CAREER_STEP" && ["EMPLOYMENT", "SELF_EMPLOYMENT", "INTERNSHIP"].includes(s.type);
function occupationalSummary(stations: AnalyticsStation[], total: number) {
  return {
    selected: stations.length, unresolved: total - stations.length,
    types: ["EMPLOYMENT", "SELF_EMPLOYMENT", "INTERNSHIP"].map(label => ({ label, count: stations.filter(s => s.type === label).length })),
    sectorKnown: stations.filter(s => s.sector).length,
    sectors: counts(stations.map(s => [s.sector])), roles: counts(stations.map(s => [s.title ?? s.job])),
  };
}

/** Input is the already validated cohort from understandCareers. Recorded
 * order, strictly dated first starts, and last recorded work stay separate.
 * Missing sector information is never inferred from titles or employers.
 */
export function summarizeCohort(profiles: AnalyticsProfile[]) {
  const split = profiles.map(p => {
    const anchor = referenceStations(p)[0];
    const stations = p.stations.toSorted((a, b) => a.position - b.position), index = stations.findIndex(s => s.id === anchor.id);
    return { p, before: stations.slice(0, index), after: stations.slice(index + 1) };
  });
  const masters = split.map(x => x.after.filter(s => s.kind === "DEGREE" && s.type === "MASTER"));
  const first = aggregateOverview(profiles).decisions.flatMap(d => {
    const station = profiles.find(p => p.id === d.alumniId)?.stations.find(s => s.id === d.occupation.stationId);
    return station ? [station] : [];
  });
  const latest = split.flatMap(x => { const station = x.after.filter(work).at(-1); return station ? [station] : []; });
  return {
    background: { recorded: split.filter(x => x.before.length).length, unrecorded: split.filter(x => !x.before.length).length, types: counts(split.map(x => x.before.map(s => s.type))) },
    next: counts(split.map(x => [x.after[0]?.type ?? "NOT_RECORDED"])),
    study: { masters: masters.filter(s => s.length).length, multipleMasters: masters.filter(s => s.length > 1).length,
      described: masters.filter(s => s.some(m => m.title)).length, titles: counts(masters.map(s => s.map(m => m.title))),
      fieldKnown: masters.filter(s => s.some(m => m.field)).length, fields: counts(masters.map(s => s.map(m => m.field))) },
    entry: occupationalSummary(first, profiles.length), latest: occupationalSummary(latest, profiles.length),
  };
}
