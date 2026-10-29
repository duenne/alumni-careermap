import { expect, it } from "vitest";
import { aggregateOverview, overviewStages } from "./overview";
import { overviewProfile } from "./overview-fixtures";
import { createSankeyLayout, formatShare } from "./sankey-layout";

it("sorts by actual person frequency with deterministic ties; alphabetic is optional", () => {
  const profiles = Array.from({ length: 4 }, (_, i) => overviewProfile(`synthetic-${i}`));
  profiles.slice(1).forEach(p => { p.stations[2].sector = "IT & Technologie"; });
  const flow = aggregateOverview(profiles);
  const graph = createSankeyLayout(flow, overviewStages, 1280, "frequency");
  expect(graph.width).toBe(1280);
  expect(graph.layout!.nodes.filter(n => n.stage === 2).toSorted((a, b) => a.y0! - b.y0!).map(n => [n.label, n.value])).toEqual([["IT & Technologie", 3], ["Dritter Sektor", 1]]);
  expect(createSankeyLayout(flow, overviewStages, 1280, "alphabetical").layout!.nodes.filter(n => n.stage === 2).toSorted((a, b) => a.y0! - b.y0!).map(n => n.label)).toEqual(["Dritter Sektor", "IT & Technologie"]);
  const tied = aggregateOverview(profiles.slice(0, 2));
  const labels = (input: typeof tied) => createSankeyLayout(input, overviewStages, 1024, "frequency").layout!.nodes.filter(n => n.stage === 2).toSorted((a, b) => a.y0! - b.y0!).map(n => n.label);
  expect(labels(tied)).toEqual(labels(aggregateOverview(profiles.slice(0, 2).toReversed())));
});
it("fits four stages at desktop widths, wraps complete category labels and keeps exact flow widths", () => {
  const p = overviewProfile(); p.stations[2].job = "Produktion & operatives Management";
  const flow = aggregateOverview([p]);
  const graph = createSankeyLayout(flow, overviewStages, 1100, "frequency");
  expect(graph.width).toBe(1100); expect(graph.height).toBeLessThanOrEqual(700);
  const node = graph.layout!.nodes.find(n => n.stage === 3)!;
  expect(node.labelLines.join(" ")).toBe(p.stations[2].job);
  expect(graph.layout!.links.every(l => l.value === 1)).toBe(true);
  expect(formatShare(1, 4)).toBe("25,0 %"); expect(formatShare(0, 0)).toBe("0,0 %");
});
