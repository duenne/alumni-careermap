import { describe, expect, it } from "vitest";
import { prepareAnalyticsImport } from "./prepare";
import { validateAnalyticsDatabaseUrl } from "./safety";
import { minimalCorpus } from "./test-corpus";

describe("V2.1 synthetic declarations -> normalizer -> import plan", () => {
  it("requires an explicit test policy; raw anchors never certify a response", () => {
    const { sources, expected } = minimalCorpus();
    expect(() => prepareAnalyticsImport(sources, expected)).toThrow("TEST_POLICY_REQUIRED");
  });
  it("preserves every station exactly once, classifies exchange/training correctly and never copies identity", () => {
    const { sources, expected } = minimalCorpus();
    const plan = prepareAnalyticsImport(sources, expected, "phase-d-v1");
    expect(plan.report).toMatchObject({ readProfiles: 1, acceptedProfiles: 1, excludedProfiles: 0, degrees: 1, careerSteps: 3, timelineItems: 4, monthPrecisionReduced: 1 });
    expect(plan.profiles[0].stations.map(s => [s.kind, s.position])).toEqual([["RESOLVED_CAREER_STEP", 3], ["RESOLVED_DEGREE", 2], ["RESOLVED_CAREER_STEP", 1], ["RESOLVED_CAREER_STEP", 4]]);
    expect(plan.profiles[0].stations[2].canonical).toMatchObject({ type: "VOCATIONAL_TRAINING" });
    expect(plan.profiles[0].stations[3].canonical).toMatchObject({ type: "EDUCATION" });
    expect(JSON.stringify(plan)).not.toMatch(/PRIVATE_|syntheticId|stationId|SurveyResponse|confirmedAt/);
    expect(plan.profiles[0].stations[1].canonical).toMatchObject({ status: "COMPLETED", graduationYear: null });
  });
  it("keeps unknown dates/status unknown and reports them without inventing an end", () => {
    const { sources, expected } = minimalCorpus();
    sources[0].snapshot.elements[1].snapshotData[0]["Started On"] = "";
    expected[0].stations[0].startDate = null;
    const plan = prepareAnalyticsImport(sources, expected, "phase-d-v1");
    expect(plan.profiles[0].stations[0].canonical).toMatchObject({ startYear: null, endYear: null, temporalStatus: "UNKNOWN" });
    expect(plan.report.unknownDateStations).toBe(1);
  });
  it("excludes the whole profile on ambiguous classification or inconsistent oracle dates", () => {
    for (const change of ["classification", "date"] as const) {
      const { sources, expected } = minimalCorpus();
      if (change === "classification") expected[0].stations[2].degreeLevel = "OTHER";
      else expected[0].stations[1].startDate = { precision: "YEAR", year: 1900, month: null };
      const plan = prepareAnalyticsImport(sources, expected, "phase-d-v1");
      expect(plan.profiles).toHaveLength(0);
      expect(plan.report.excludedStations).toBe(4);
      expect(plan.report.exclusions[0]).toMatchObject({ profileNumber: 1, code: change === "date" ? "ORACLE_MISMATCH" : "AMBIGUOUS_CLASSIFICATION" });
    }
  });
  it("ignores anchor hints when demo anchors were not separately declared", () => {
    const { sources, expected } = minimalCorpus();
    const plan = prepareAnalyticsImport(sources, expected, "phase-d-v1", false);
    expect(plan.profiles[0].stations.every(s => !s.demoAnchor)).toBe(true);
  });
  it.each([undefined, "postgresql://u:p@example.com/careermap_analytics_demo", "postgresql://u:p@localhost/careermap", "postgresql://u:p@localhost/careermap_analytics_demo?schema=public", "postgresql://u:p@localhost/careermap_analytics_demo"]) ("rejects unsafe database configuration %s", value => {
    expect(() => validateAnalyticsDatabaseUrl(value)).toThrow("UNSAFE_ANALYTICS_DATABASE");
  });
  it("accepts only the dedicated local role and database", () => {
    const url = "postgresql://careermap_analytics:p@127.0.0.1:5434/careermap_analytics_demo";
    expect(validateAnalyticsDatabaseUrl(url)).toBe(url);
  });
});
