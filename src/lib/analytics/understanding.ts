import { referenceStations, type CareerFlow, type FlowNode, type FlowLink } from "./aggregate";
import type { AnalyticsProfile, AnalyticsStation } from "./records";

export const understandingStages = ["Davor erfasst · Stationstypen", "MSI · Referenzstudium", "Danach erfasst · nächste Station", "Zuletzt erfasste Station"];
const types: Record<string, string> = { BACHELOR: "Weiteres Bachelorstudium", MASTER: "Masterstudium", PHD: "Promotion", DIPLOMA: "Diplomstudium", CERTIFICATE: "Akademisches Zertifikat", OTHER: "Weitere Station", EMPLOYMENT: "Beschäftigung", SELF_EMPLOYMENT: "Selbstständigkeit", INTERNSHIP: "Praktikum", EDUCATION: "Weiterbildung / Austausch", VOCATIONAL_TRAINING: "Berufsausbildung", VOLUNTEERING: "Ehrenamt", UNEMPLOYED: "Ohne Beschäftigung" };
export const stationType = (s: AnalyticsStation) => types[s.type] ?? s.type;
export const orderedStations = (p: AnalyticsProfile) => p.stations.toSorted((a, b) => a.position - b.position);
export const stationPeriod = (s: AnalyticsStation) => ["ONGOING", "IN_PROGRESS"].includes(s.status) ? `Seit ${s.startYear ?? "Beginn offen"}` : `${s.startYear ?? "Beginn offen"} – ${s.endYear ?? "Ende offen"}`;
export type CareerGroup = { id: string; label: string; alumniIds: string[] };
const occupational = (s: AnalyticsStation) => s.kind === "CAREER_STEP" && ["EMPLOYMENT", "SELF_EMPLOYMENT", "INTERNSHIP"].includes(s.type);
function frequencies(profiles: AnalyticsProfile[], value: (s: AnalyticsStation) => string | null) {
  const counts = new Map<string, number>();
  for (const p of profiles) for (const label of new Set(p.stations.map(value).filter((v): v is string => !!v))) counts.set(label, (counts.get(label) ?? 0) + 1);
  return [...counts].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "de"));
}

/** Describes recorded order, never inferred before/after dates or completion.
 * Each person contributes once per column; intermediate stations remain in
 * exact type-sequence groups and the selectable full career. No source data.
 */
export function understandCareers(profiles: AnalyticsProfile[]) {
  const flow: CareerFlow = { nodes: [], links: [], paths: [], included: 0, partial: 0, excluded: [] };
  const nodes = new Map<string, FlowNode>(), links = new Map<string, FlowLink>(), groups = new Map<string, CareerGroup>();
  const seen = new Set<string>(), included: AnalyticsProfile[] = [];
  for (const p of profiles) {
    const exclude = (reason: string) => flow.excluded.push({ alumniId: p.id, reason: p.referenceDegreeId !== undefined ? reason.replace("DEMO_ANCHOR", "CONFIRMED_REFERENCE") : reason });
    if (seen.has(p.id)) { exclude("DUPLICATE_PROFILE"); continue; } seen.add(p.id);
    const anchors = referenceStations(p);
    if (anchors.length !== 1) { exclude(anchors.length ? "AMBIGUOUS_DEMO_ANCHOR" : "MISSING_DEMO_ANCHOR"); continue; }
    const anchor = anchors[0];
    if (anchor.kind !== "DEGREE" || anchor.type !== "BACHELOR" || anchor.status !== "COMPLETED") { exclude("INELIGIBLE_DEMO_ANCHOR"); continue; }
    if (new Set(p.stations.map(s => s.position)).size !== p.stations.length || new Set(p.stations.map(s => s.id)).size !== p.stations.length
      || p.stations.some(s => s.position <= 0 || !Number.isSafeInteger(s.position) || s.startYear !== null && s.endYear !== null && s.startYear > s.endYear)) { exclude("INVALID_TIMELINE"); continue; }
    included.push(p);
    const stations = orderedStations(p), anchorIndex = stations.findIndex(s => s.id === anchor.id);
    const before = stations.slice(0, anchorIndex), after = stations.slice(anchorIndex + 1), last = after.at(-1);
    const lastCategory = last ? last.kind === "DEGREE" ? last.field : last.sector : null;
    const labels = [before.length ? [...new Set(before.map(stationType))].sort((a, b) => a.localeCompare(b, "de")).join(" + ") : "Keine Station davor erfasst", "MSI · Referenzstudium", after.length ? stationType(after[0]) : "Keine weitere Station erfasst", last ? lastCategory ? `${stationType(last)} · ${lastCategory}` : last.title ?? stationType(last) : "Nur Referenzstudium erfasst"];
    const ids = labels.map((label, stage) => {
      const id = JSON.stringify([stage, label]);
      nodes.set(id, { id, stage, label, state: (stage === 0 && !before.length || stage > 1 && !after.length) ? "absent" : "known" });
      return id;
    });
    flow.paths.push({ alumniId: p.id, nodes: ids, labels, partial: false, unclearStations: 0, temporalUnclearStations: stations.filter(s => s.startYear === null || s.endYear === null && !["ONGOING", "IN_PROGRESS"].includes(s.status)).length, duringStations: 0 });
    const sequence = stations.map(s => s.id === anchor.id ? "MSI" : stationType(s)), id = JSON.stringify(sequence);
    const group = groups.get(id) ?? { id, label: sequence.join(" → "), alumniIds: [] };
    group.alumniIds.push(p.id); groups.set(id, group);
  }
  // Keep the overview readable when canonical titles are available but no
  // categories were recorded. The bundle is explicit and remains selectable;
  // full titles and every intermediate station stay in the individual career.
  const lastCounts = new Map<string, number>();
  for (const path of flow.paths) lastCounts.set(path.labels[3], (lastCounts.get(path.labels[3]) ?? 0) + 1);
  const retained = new Set([...lastCounts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "de")).slice(0, 8).map(([label]) => label));
  for (const node of nodes.values()) if (node.stage === 3 && node.state === "absent") retained.add(node.label);
  const usedNodes = new Set<string>();
  for (const path of flow.paths) {
    if (lastCounts.size > 12 && !retained.has(path.labels[3])) {
      const label = `Weitere Stationen · ${lastCounts.size - retained.size} Bezeichnungen`, id = JSON.stringify([3, label]);
      nodes.set(id, { id, label, stage: 3, state: "known" }); path.labels[3] = label; path.nodes[3] = id;
    }
    path.nodes.forEach(id => usedNodes.add(id));
    for (let stage = 0; stage < 3; stage++) {
      const [source, target] = [path.nodes[stage], path.nodes[stage + 1]], key = JSON.stringify([source, target]);
      const link = links.get(key) ?? { source, target, value: 0, stage, alumniIds: [] };
      link.value++; link.alumniIds.push(path.alumniId); links.set(key, link);
    }
  }
  flow.nodes = [...nodes.values()].filter(n => usedNodes.has(n.id)); flow.links = [...links.values()]; flow.included = included.length;
  return { flow, groups: [...groups.values()].sort((a, b) => b.alumniIds.length - a.alumniIds.length || a.label.localeCompare(b.label, "de")), facts: {
    profiles: included.length, stations: included.reduce((sum, p) => sum + p.stations.length, 0),
    master: included.filter(p => p.stations.some(s => s.kind === "DEGREE" && s.type === "MASTER")).length,
    multipleMasters: included.filter(p => p.stations.filter(s => s.kind === "DEGREE" && s.type === "MASTER").length > 1).length,
    work: included.filter(p => p.stations.some(occupational)).length,
    sectors: frequencies(included, s => occupational(s) ? s.sector : null),
    fields: frequencies(included, s => s.kind === "DEGREE" && s.type === "MASTER" ? s.field : null),
    jobs: frequencies(included, s => occupational(s) ? s.job : null),
    roles: frequencies(included, s => occupational(s) ? s.title : null),
    masterTitles: frequencies(included, s => s.kind === "DEGREE" && s.type === "MASTER" ? s.title : null),
    organisations: frequencies(included, s => occupational(s) ? s.provider : null),
    missingDates: included.filter(p => p.stations.some(s => s.startYear === null || s.endYear === null && !["ONGOING", "IN_PROGRESS"].includes(s.status))).length,
  } };
}
