import type { NormalizationInput } from "../../lib/normalization/contract";

export const hasStructuredStart = (source: NormalizationInput["stations"][number]) =>
  source.start.kind === "OBSERVED" && source.start.value.precision !== "IMPRECISE";

/** Proposed placement for structured starts only; other sources remain unplaced. */
export function proposeDisplayOrder(input: NormalizationInput): string[] {
  const start = (source: NormalizationInput["stations"][number]) =>
    source.start.kind === "OBSERVED" && source.start.value.precision !== "IMPRECISE" ? source.start.value : null;
  const ordered = input.stations.filter(hasStructuredStart).sort((a, b) => {
    const left = start(a), right = start(b);
    return left && right ? left.year - right.year : left ? -1 : right ? 1 : 0;
  });
  // A year-only observation is an ordering barrier: moving months across it
  // would reverse an incomparable pair. Only contiguous precise runs can sort.
  for (let index = 0; index < ordered.length;) {
    const first = start(ordered[index]);
    if (first?.precision !== "MONTH") { index++; continue; }
    let end = index + 1;
    while (end < ordered.length) {
      const next = start(ordered[end]);
      if (next?.precision !== "MONTH" || next.year !== first.year) break;
      end++;
    }
    const run = ordered.slice(index, end).sort((a, b) => {
      const left = start(a), right = start(b);
      return left?.precision === "MONTH" && right?.precision === "MONTH" ? left.month - right.month : 0;
    });
    ordered.splice(index, run.length, ...run);
    index = end;
  }
  return ordered.map(source => source.key);
}
