import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { auditFixturePair } from "../fixture-audit";
import { mapCareerImport } from "./mapping";
import { phaseDExample, type PhaseDExpected } from "./phase-d";

// Explicit opt-in; local originals remain untracked, no source values in output.
it.skipIf(process.env.CAREERMAP_PHASE_D_FIXTURES !== "1")("maps every local Phase-D source with reviewed synthetic assertions, retaining all 432 stations", async () => {
  const sources = JSON.parse(await readFile(".local-fixtures/phase-d/all_linkedin_snapshots.json", "utf8")) as { syntheticId: string; snapshot: unknown }[];
  const expected = JSON.parse(await readFile(".local-fixtures/phase-d/all_expected_normalized.json", "utf8")) as PhaseDExpected[];
  expect(auditFixturePair(sources, expected).ok).toBe(true);
  let stations = 0, degrees = 0, steps = 0;
  for (const source of sources) {
    const pair = expected.find(row => row.syntheticId === source.syntheticId)!;
    const example = phaseDExample(source.snapshot, pair);
    // New explicit test claims: an anchor award and supplied fixture levels.
    // The source and companion file do not themselves prove completion.
    const reviews = example.reviews.map(review => ({ ...review,
      status: review.sourceKey === example.candidateSourceKey ? "COMPLETED" : "UNKNOWN",
    }));
    const result = mapCareerImport(example.snapshot, reviews);
    expect(result.stations.length === pair.stations.length).toBe(true);
    for (const station of result.stations) {
      stations++; if (station.kind === "RESOLVED_DEGREE") { degrees++; expect(station.canonical.graduationYear).toBeNull(); } else steps++;
    }
  }
  expect([sources.length, stations, degrees, steps]).toEqual([100, 432, 182, 250]);
});
