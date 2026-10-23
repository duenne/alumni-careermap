import "server-only";
import { readFile } from "node:fs/promises";
import fixture from "../../test-fixtures/linkedin-snapshots/fictional-member.json";
import { auditFixturePair } from "../fixture-audit";
import { readCareerSnapshot, suggestReviews } from "./mapping";
import { phaseDExample, type PhaseDExpected } from "./phase-d";

// Fixed local paths, never client-supplied paths or public/static assets.
async function corpus() {
  const [sourceText, expectedText] = await Promise.all([
    readFile(".local-fixtures/phase-d/all_linkedin_snapshots.json", "utf8"),
    readFile(".local-fixtures/phase-d/all_expected_normalized.json", "utf8"),
  ]);
  if (sourceText.length > 2_000_000 || expectedText.length > 2_000_000) throw new Error("Local fixture limit");
  const source = JSON.parse(sourceText), expected = JSON.parse(expectedText);
  if (!auditFixturePair(source, expected).ok) throw new Error("Invalid local fixture pair");
  return { source: source as { syntheticId: string; snapshot: unknown }[], expected: expected as PhaseDExpected[] };
}
export async function fixtureOptions() {
  let count = 0;
  try { count = (await corpus()).source.length; } catch { /* Optional local files are absent in CI/fresh checkouts. */ }
  return [ { id: "fictional-member", label: "Repository-Beispiel · 4 Stationen" }, ...Array.from({ length: count }, (_, i) => ({ id: `phase-d-${i + 1}`, label: `Phase D · Beispiel ${i + 1}` })) ];
}
export async function loadMappingFixture(id: string) {
  if (id === "fictional-member") {
    const snapshot = readCareerSnapshot(fixture);
    return { snapshot, reviews: suggestReviews(snapshot), candidateSourceKey: "snapshot:2:0" };
  }
  const match = /^phase-d-([1-9][0-9]{0,3})$/.exec(id);
  if (!match) throw new Error("Unknown local fixture");
  const { source, expected } = await corpus();
  const entry = source[Number(match[1]) - 1];
  const pair = expected.find(row => row.syntheticId === entry?.syntheticId);
  if (!entry || !pair) throw new Error("Unknown local fixture");
  return phaseDExample(entry.snapshot, pair);
}
