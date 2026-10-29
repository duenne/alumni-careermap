/** Read-only comparison: one canonical DB snapshot for both aggregations. */
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { parse } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { validateAnalyticsDatabaseUrl } from "../src/lib/analytics/safety";
import { readAnalytics } from "../src/lib/analytics/read";
import { aggregateCareers, type CareerFlow } from "../src/lib/analytics/aggregate";
import { aggregateOverview } from "../src/lib/analytics/overview";
import { filterMasterProfiles } from "../src/lib/analytics/filters";
import { createSankeyLayout } from "../src/lib/analytics/sankey-layout";
import { overviewStages } from "../src/lib/analytics/overview";
import { stages } from "../src/lib/analytics/aggregate";

const top = (flow: CareerFlow, stage: number) => flow.nodes.filter(n => n.stage === stage).map(n => ({ category: n.label, state: n.state, people: flow.paths.filter(p => p.nodes.includes(n.id)).length })).sort((a, b) => b.people - a.people || a.category.localeCompare(b.category, "de"));
async function main() {
  const config = parse(await readFile(".env.analytics.local", "utf8"));
  const url = validateAnalyticsDatabaseUrl(config.CAREERMAP_ANALYTICS_DATABASE_URL);
  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, connectionTimeoutMillis: 3000 }) });
  try {
    const data = await readAnalytics(client, url);
    const old = aggregateCareers(data.profiles), current = aggregateOverview(data.profiles);
    const counts = (values: string[]) => values.reduce<Record<string, number>>((map, v) => { map[v] = (map[v] ?? 0) + 1; return map; }, {});
    const report = {
      canonical: data.counts,
      history: { people: old.included, partial: old.partial, excluded: old.excluded.length, nodes: old.nodes.length, links: old.links.length, transitions: old.links.reduce((n, l) => n + l.value, 0),
        unknownBeforeEducation: old.paths.filter(p => old.nodes.find(n => n.id === p.nodes[0])?.state === "unknown").length,
        unclearWorkAfter: old.paths.filter(p => old.nodes.find(n => n.id === p.nodes[5])?.state === "unknown").length,
        combinedWorkProfiles: old.paths.filter(p => p.labels[5].startsWith("Kombination:") || p.labels[6].startsWith("Kombination:")).length,
        sectors: top(old, 5), jobs: top(old, 6) },
      overview: { people: current.included, partial: current.partial, excluded: current.excluded.length, nodes: current.nodes.length, links: current.links.length,
        transitions: current.links.reduce((n, l) => n + l.value, 0), selectedFirstStations: current.selectedFirstStations,
        nonUniqueOrUnclearPeople: current.decisions.filter(d => ["AMBIGUOUS", "UNCLEAR", "UNKNOWN"].includes(d.occupation.state) || ["MULTIPLE", "UNCLEAR", "UNKNOWN"].includes(d.master.state)).length,
        occupationStates: counts(current.decisions.map(d => d.occupation.state)), masterPresence: counts(current.decisions.map(d => d.master.presence)), masterStates: counts(current.decisions.map(d => d.master.state)),
        masterPhaseStatuses: counts(data.profiles.flatMap(p => p.stations.filter(s => current.decisions.find(d => d.alumniId === p.id)?.master.stationIds.includes(s.id)).map(s => s.status))),
        sectors: top(current, 2), jobs: top(current, 3), masterFields: top(current, 1) },
      filters: Object.fromEntries((["all", "with", "without"] as const).map(filter => { const subset = filterMasterProfiles(data.profiles, filter); return [filter, { people: aggregateOverview(subset.profiles).included, removed: subset.removed.length, unknownMaster: subset.unknown }]; })),
      layoutAt1280: { overview: { width: createSankeyLayout(current, overviewStages, 1280, "frequency").width, height: createSankeyLayout(current, overviewStages, 1280, "frequency").height }, history: { width: createSankeyLayout(old, stages, 1280, "frequency").width, height: createSankeyLayout(old, stages, 1280, "frequency").height } },
    };
    await mkdir("artifacts/v2.4", { recursive: true });
    await writeFile("artifacts/v2.4/comparison.json", JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify(report, null, 2));
  } finally { await client.$disconnect(); }
}
main().catch(() => { console.error("ANALYTICS_COMPARISON_FAILED"); process.exitCode = 1; });
