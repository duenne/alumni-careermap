import { sankey } from "d3-sankey";
import type { CareerFlow, FlowNode } from "./aggregate";

export type NodeData = FlowNode & { labelLines: string[] };
export type LinkData = { alumniIds: string[]; stage: number };
export type NodeSort = "frequency" | "alphabetical";
export function formatShare(count: number, total: number) {
  return `${(total ? count * 100 / total : 0).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
}
export function wrapLabel(text: string, limit: number): string[] {
  const lines: string[] = [];
  for (const word of text.split(/\s+/)) {
    if (!lines.length || lines[lines.length - 1].length + word.length + 1 > limit) lines.push(word);
    else lines[lines.length - 1] += ` ${word}`;
  }
  return lines;
}

/** Counts and widths are unmodified; only geometry, ordering and labels change. */
export function createSankeyLayout(flow: CareerFlow, stages: string[], availableWidth: number, sort: NodeSort) {
  const compact = stages.length === 4;
  const width = Math.max(compact ? 720 : 2460, Math.round(availableWidth));
  const columnWidth = (width - 24) / stages.length;
  const nodes: NodeData[] = flow.nodes.map(node => {
    const lines = wrapLabel(node.label, Math.max(16, Math.floor((columnWidth - 38) / 6.6)));
    return { ...node, labelLines: !compact && lines.length > 2 ? [lines[0], `${lines[1]}…`] : lines };
  });
  const lines = Math.max(1, ...nodes.map(n => n.labelLines.length));
  const padding = lines * 14 + 16;
  const maximumNodes = Math.max(1, ...stages.map((_, stage) => nodes.filter(n => n.stage === stage).length));
  const height = Math.max(420, maximumNodes * (padding + 16) + 110);
  const counts = new Map(nodes.map(n => [n.id, flow.paths.filter(p => p.nodes.includes(n.id)).length]));
  const compare = (a: NodeData, b: NodeData) => (sort === "frequency" ? counts.get(b.id)! - counts.get(a.id)! : 0)
    || a.label.localeCompare(b.label, "de") || a.id.localeCompare(b.id, "de");
  const layout = !nodes.length ? null : sankey<NodeData, LinkData>().nodeId(n => n.id).nodeAlign(n => n.stage)
    .nodeWidth(14).nodePadding(padding).nodeSort(compare).iterations(12)
    .extent([[12, 86], [width - columnWidth + 2, height - 20]])({ nodes, links: flow.links.map(l => ({ ...l })) });
  return { width, height, columnWidth, layout };
}
