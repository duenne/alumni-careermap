import { referenceStations, referenceLabel, aggregateCareers, type CareerFlow, type FlowNode } from "./aggregate";
import type { AnalyticsProfile, AnalyticsStation } from "./records";

export const overviewStages = ["BA MSI · Referenzabschluss", "Masterstudium · Fachrichtung", "Erste Tätigkeit nach MSI · Branche", "Erste Tätigkeit nach MSI · Jobkategorie"];
export const occupationalTypes = ["EMPLOYMENT", "SELF_EMPLOYMENT", "INTERNSHIP"];
type Group = Pick<FlowNode, "label" | "state">;
export type OverviewDecision = {
  alumniId: string;
  occupation: { state: "SELECTED" | "AMBIGUOUS" | "UNCLEAR" | "ABSENT" | "UNKNOWN"; stationId: string | null; candidateIds: string[] };
  master: { presence: "WITH" | "WITHOUT" | "UNKNOWN"; state: "SINGLE" | "MULTIPLE" | "UNCLEAR" | "ABSENT" | "UNKNOWN"; stationIds: string[] };
};
export type OverviewFlow = CareerFlow & { decisions: OverviewDecision[]; selectedFirstStations: number };
const known = (label: string): Group => ({ label, state: "known" });
const unknown = (label: string): Group => ({ label, state: "unknown" });
const absent = (label: string): Group => ({ label, state: "absent" });
const after = (s: AnalyticsStation, a: AnalyticsStation) => s.startYear !== null && s.startYear > a.endYear! && s.position > a.position;
const ids = (stations: AnalyticsStation[]) => stations.map(s => s.id).sort();

function firstOccupation(p: AnalyticsProfile, a: AnalyticsStation): { decision: OverviewDecision["occupation"]; groups: Group[] } {
  const work = p.stations.filter(s => s.kind === "CAREER_STEP" && occupationalTypes.includes(s.type));
  const candidates = work.filter(s => after(s, a));
  const firstYear = Math.min(...candidates.map(s => s.startYear!));
  // Unknown/boundary dates can conceal an earlier post-MSI start. A known
  // later inconsistent station cannot displace an already certain first start.
  const blockers = work.filter(s => !after(s, a)
    && (s.startYear === null ? s.endYear === null || s.endYear >= a.endYear! : s.startYear >= a.endYear!)
    && (s.startYear === null || s.startYear <= firstYear));
  if (blockers.length) return { decision: { state: "UNCLEAR", stationId: null, candidateIds: ids([...candidates, ...blockers]) }, groups: [unknown("Erste Tätigkeit zeitlich ungeklärt"), unknown("Erste Tätigkeit zeitlich ungeklärt")] };
  const first = candidates.filter(s => s.startYear === firstYear);
  if (first.length > 1) return { decision: { state: "AMBIGUOUS", stationId: null, candidateIds: ids(first) }, groups: [unknown("Mehrere mögliche erste Tätigkeiten"), unknown("Mehrere mögliche erste Tätigkeiten")] };
  if (!first.length) {
    const group = p.completeTestCase ? absent("Kein Stellenbeginn nach MSI (Testfall vollständig)") : unknown("Stellenbeginn nach MSI unbekannt");
    return { decision: { state: p.completeTestCase ? "ABSENT" : "UNKNOWN", stationId: null, candidateIds: [] }, groups: [group, group] };
  }
  const s = first[0];
  return { decision: { state: "SELECTED", stationId: s.id, candidateIds: [s.id] },
    groups: [s.sector ? known(s.sector) : unknown("Branche unbekannt"), s.job ? known(s.job) : unknown("Jobkategorie unbekannt")] };
}

function masterStudies(p: AnalyticsProfile, a: AnalyticsStation): { decision: OverviewDecision["master"]; group: Group } {
  const masters = p.stations.filter(s => s.kind === "DEGREE" && s.type === "MASTER");
  const candidates = masters.filter(s => after(s, a));
  const uncertain = masters.filter(s => !after(s, a) && (s.endYear === null || s.endYear >= a.endYear!));
  const stationIds = ids(candidates);
  if (uncertain.length) return { decision: { presence: candidates.length ? "WITH" : "UNKNOWN", state: "UNCLEAR", stationIds }, group: unknown("Masterstudium zeitlich ungeklärt") };
  if (candidates.length > 1) return { decision: { presence: "WITH", state: "MULTIPLE", stationIds }, group: known("Mehrere Masterstudien") };
  if (candidates.length === 1) return { decision: { presence: "WITH", state: "SINGLE", stationIds }, group: candidates[0].field ? known(candidates[0].field) : unknown("Fachrichtung unbekannt") };
  return p.completeTestCase
    ? { decision: { presence: "WITHOUT", state: "ABSENT", stationIds }, group: absent(masters.length ? "Kein Master nach MSI (Testfall vollständig)" : "Kein Master (Testfall vollständig)") }
    : { decision: { presence: "UNKNOWN", state: "UNKNOWN", stationIds }, group: unknown("Masterstudium unbekannt") };
}

/** Four-stage PERSON projection. Validation and anchor eligibility reuse the
 * unchanged seven-stage function. No source inference, mutation, persistence,
 * fractional station weights or cross-station sector/job pairings.
 * Master/job columns are profile attributes relative to MSI, not a claim that
 * the master was completed before the selected job began.
 */
export function aggregateOverview(profiles: AnalyticsProfile[]): OverviewFlow {
  const legacy = aggregateCareers(profiles);
  const diagnostics = new Map(legacy.paths.map(path => [path.alumniId, path]));
  const result: OverviewFlow = { nodes: [], links: [], paths: [], included: 0, partial: 0, excluded: legacy.excluded, decisions: [], selectedFirstStations: 0 };
  const nodes = new Map<string, FlowNode>();
  const links = new Map<string, CareerFlow["links"][number]>();
  const seen = new Set<string>();
  for (const p of profiles) {
    const diagnostic = diagnostics.get(p.id);
    if (!diagnostic || seen.has(p.id)) continue;
    seen.add(p.id);
    const anchor = referenceStations(p)[0];
    const work = firstOccupation(p, anchor), master = masterStudies(p, anchor);
    const groups = [known(referenceLabel(p)), master.group, ...work.groups];
    const nodeIds = groups.map((group, stage) => {
      const id = JSON.stringify([stage, group.label]); nodes.set(id, { id, stage, ...group }); return id;
    });
    const partial = groups.some(group => group.state === "unknown");
    result.paths.push({ ...diagnostic, nodes: nodeIds, labels: groups.map(g => g.label), partial });
    result.decisions.push({ alumniId: p.id, occupation: work.decision, master: master.decision });
    result.selectedFirstStations += Number(work.decision.state === "SELECTED");
    for (let stage = 0; stage < 3; stage++) {
      const key = JSON.stringify([nodeIds[stage], nodeIds[stage + 1]]);
      const link = links.get(key) ?? { source: nodeIds[stage], target: nodeIds[stage + 1], stage, value: 0, alumniIds: [] };
      link.value++; link.alumniIds.push(p.id); links.set(key, link);
    }
  }
  result.nodes = [...nodes.values()]; result.links = [...links.values()]; result.included = result.paths.length;
  result.partial = result.paths.filter(path => path.partial).length;
  return result;
}
