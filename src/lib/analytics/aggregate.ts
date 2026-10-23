import type { AnalyticsProfile, AnalyticsStation } from "./records";
export const stages = ["Ausbildung vor MSI · Fachrichtung", "Tätigkeit vor MSI · Branche", "Tätigkeit vor MSI · Jobkategorie", "BA MSI · Referenzabschluss", "Masterstudium · Fachrichtung", "Tätigkeit nach MSI · Branche", "Tätigkeit nach MSI · Jobkategorie"];
export type FlowNode = { id: string; stage: number; label: string; state: "known" | "absent" | "unknown" };
export type FlowLink = { source: string; target: string; value: number; stage: number; alumniIds: string[] };
export type CareerFlow = {
  nodes: FlowNode[]; links: FlowLink[]; paths: { alumniId: string; nodes: string[]; labels: string[]; partial: boolean; unclearStations: number; temporalUnclearStations: number; duringStations: number }[];
  included: number; partial: number; excluded: { alumniId: string; reason: string }[];
};
type Relation = "BEFORE" | "AFTER" | "DURING" | "UNCLEAR";
function relation(s: AnalyticsStation, anchor: AnalyticsStation): Relation {
  if (s.startYear === null) return "UNCLEAR";
  if (s.endYear !== null && s.endYear < anchor.startYear! && s.position < anchor.position) return "BEFORE";
  if (s.startYear > anchor.endYear! && s.position > anchor.position) return "AFTER";
  if (s.startYear > anchor.startYear! && s.endYear !== null && s.endYear < anchor.endYear!) return "DURING";
  return "UNCLEAR";
}
const education = (s: AnalyticsStation) => s.kind === "DEGREE" || ["EDUCATION", "VOCATIONAL_TRAINING"].includes(s.type);
function category(stations: AnalyticsStation[], key: "field" | "sector" | "job", uncertain: boolean, complete: boolean, master = false): { label: string; state: FlowNode["state"] } {
  if (uncertain) return { label: "Zeitlich ungeklärt", state: "unknown" };
  if (!stations.length) return complete ? { label: master ? "Kein Master (Testfall vollständig)" : "Nicht vorhanden (Testfall vollständig)", state: "absent" } : { label: "Unbekannt", state: "unknown" };
  const values = [...new Set(stations.map(s => s[key] ?? "Unbekannt"))].sort((a, b) => a.localeCompare(b, "de"));
  return { label: values.length > 1 ? `Kombination: ${values.join(" + ")}` : values[0], state: values.includes("Unbekannt") ? "unknown" : "known" };
}

/** Each included person contributes ONE unit to EACH adjacent stage pair (6).
 * Multi-station stages are category SETS, explicitly labelled as combinations;
 * links represent person-level co-occurrence, not invented station transitions.
 * Strict year separation AND timeline order are required. Equality, missing
 * dates, order conflicts and overlaps remain unclear. Definitely during-study
 * stations stay in the canonical timeline but not these before/after stages.
 */
export function aggregateCareers(profiles: AnalyticsProfile[]): CareerFlow {
  const result: CareerFlow = { nodes: [], links: [], paths: [], included: 0, partial: 0, excluded: [] };
  const nodes = new Map<string, FlowNode>(), links = new Map<string, FlowLink>();
  const seen = new Set<string>();
  for (const p of profiles) {
    const exclude = (reason: string) => result.excluded.push({ alumniId: p.id, reason });
    if (seen.has(p.id)) { exclude("DUPLICATE_PROFILE"); continue; } seen.add(p.id);
    const anchors = p.stations.filter(s => s.demoAnchor);
    if (anchors.length !== 1) { exclude(anchors.length ? "AMBIGUOUS_DEMO_ANCHOR" : "MISSING_DEMO_ANCHOR"); continue; }
    const anchor = anchors[0];
    if (anchor.kind !== "DEGREE" || anchor.type !== "BACHELOR" || anchor.status !== "COMPLETED") { exclude("INELIGIBLE_DEMO_ANCHOR"); continue; }
    if (anchor.startYear === null || anchor.endYear === null) { exclude("UNKNOWN_ANCHOR_TIME"); continue; }
    if (new Set(p.stations.map(s => s.position)).size !== p.stations.length || new Set(p.stations.map(s => s.id)).size !== p.stations.length
      || p.stations.some(s => s.position <= 0 || !Number.isSafeInteger(s.position) || s.startYear !== null && s.endYear !== null && s.startYear > s.endYear)) { exclude("INVALID_TIMELINE"); continue; }
    const others = p.stations.filter(s => s.id !== anchor.id).map(s => ({ station: s, relation: relation(s, anchor) }));
    const selected = (kind: "education" | "work" | "master", rel: Relation) => others.filter(x => x.relation === rel && (kind === "master" ? x.station.kind === "DEGREE" && x.station.type === "MASTER" : kind === "education" ? education(x.station) : !education(x.station))).map(x => x.station);
    const groups = [
      category(selected("education", "BEFORE"), "field", selected("education", "UNCLEAR").length > 0, p.completeTestCase),
      category(selected("work", "BEFORE"), "sector", selected("work", "UNCLEAR").length > 0, p.completeTestCase),
      category(selected("work", "BEFORE"), "job", selected("work", "UNCLEAR").length > 0, p.completeTestCase),
      { label: "BA MSI · synthetischer Demoanker", state: "known" as const },
      category(selected("master", "AFTER"), "field", selected("master", "UNCLEAR").length > 0, p.completeTestCase, true),
      category(selected("work", "AFTER"), "sector", selected("work", "UNCLEAR").length > 0, p.completeTestCase),
      category(selected("work", "AFTER"), "job", selected("work", "UNCLEAR").length > 0, p.completeTestCase),
    ];
    // A master wholly before/during MSI still exists: do not label it absent.
    if (p.stations.some(s => s.kind === "DEGREE" && s.type === "MASTER") && groups[4].state === "absent") groups[4] = { label: "Master außerhalb der Nach-MSI-Stufe", state: "unknown" };
    const ids = groups.map((g, stage) => { const id = JSON.stringify([stage, g.label]); nodes.set(id, { id, stage, ...g }); return id; });
    const partial = groups.some(g => g.state === "unknown");
    result.paths.push({ alumniId: p.id, nodes: ids, labels: groups.map(g => g.label), partial,
      temporalUnclearStations: p.stations.filter(s => s.startYear === null || s.endYear === null && !["ONGOING", "IN_PROGRESS"].includes(s.status) || others.some(x => x.station.id === s.id && x.relation === "UNCLEAR")).length,
      unclearStations: others.filter(x => x.relation === "UNCLEAR").length, duringStations: others.filter(x => x.relation === "DURING").length });
    for (let stage = 0; stage < 6; stage++) {
      const key = JSON.stringify([ids[stage], ids[stage + 1]]);
      const link = links.get(key) ?? { source: ids[stage], target: ids[stage + 1], stage, value: 0, alumniIds: [] };
      link.value++; link.alumniIds.push(p.id); links.set(key, link);
    }
  }
  result.nodes = [...nodes.values()]; result.links = [...links.values()]; result.included = result.paths.length; result.partial = result.paths.filter(p => p.partial).length;
  return result;
}
