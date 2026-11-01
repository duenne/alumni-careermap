import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { planV5DemoSeed } from "./plan";

// Originals remain local/read-only. Explicit opt-in makes missing files a failure.
it.skipIf(process.env.CAREERMAP_PHASE_D_FIXTURES !== "1")("D1.1 plans the pinned Phase-D 100 / 432 / 195 EDUCATION / 237 POSITION corpus", async () => {
  const [sourceText, expectedText] = await Promise.all([
    readFile(".local-fixtures/phase-d/all_linkedin_snapshots.json", "utf8"),
    readFile(".local-fixtures/phase-d/all_expected_normalized.json", "utf8"),
  ]);
  const referenceProgramId = "11111111-1111-4111-8111-111111111111";
  // An additional explicit synthetic test declaration; NOT inferred by planner.
  const expected = JSON.parse(expectedText) as { syntheticId: string; msiAnchor: { stationId: string } }[];
  const selections = expected.map(p => ({ syntheticId: p.syntheticId, stationId: p.msiAnchor.stationId,
    programId: referenceProgramId, confirmation: "SYNTHETIC_TEST_ONLY" }));
  const input = { policy: "v5-demo-phase-d-100-v1", sourceText, expectedText, referenceProgramId, selections };
  const plan = planV5DemoSeed(input);
  expect(plan.validationErrors).toEqual([]);
  expect(plan.valid).toBe(true);
  expect(plan.summary).toMatchObject({ readProfiles: 100, sourceStations: 432, sourceEducation: 195,
    sourcePositions: 237, plannedProfiles: 100, plannedStations: 432, degrees: 172, careerSteps: 260,
    referenceDegrees: 100, responses: 100, excludedProfiles: 0, vocationalTraining: 13, exchanges: 10 });
  for (const profile of plan.profiles) {
    const reference = profile.stations.find(s => s.key === profile.response.referenceDegreeKey)!;
    expect(reference.alumniKey).toBe(profile.response.alumniKey);
    expect(reference.canonical).toMatchObject({ programId: referenceProgramId, status: "COMPLETED", graduationYear: null });
  }
  expect(planV5DemoSeed(input)).toEqual(plan);
  expect(JSON.stringify(plan)).not.toMatch(/syntheticId|stationId|firstName|lastName|email|access_token|confirmedAt|demoAnchor/);
});
