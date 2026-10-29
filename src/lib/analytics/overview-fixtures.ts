import type { AnalyticsProfile, AnalyticsStation } from "./records";

/** Independently authored tiny synthetic careers, no local Phase-D dependency. */
export function overviewStation(overrides: Partial<AnalyticsStation> = {}): AnalyticsStation {
  return { id: "work", position: 3, kind: "CAREER_STEP", type: "EMPLOYMENT", status: "ONGOING",
    title: "Synthetic work", startYear: 2018, endYear: null, graduationYear: null,
    provider: "Synthetic employer", field: null, sector: "Dritter Sektor", job: "Führung", location: null,
    demoAnchor: false, ...overrides };
}
export function overviewProfile(id = "synthetic-a"): AnalyticsProfile {
  return { id, completeTestCase: true, stations: [
    overviewStation({ id: "anchor", position: 1, kind: "DEGREE", type: "BACHELOR", status: "COMPLETED", startYear: 2010, endYear: 2014, title: "Synthetic MSI", sector: null, job: null, demoAnchor: true }),
    overviewStation({ id: "master", position: 2, kind: "DEGREE", type: "MASTER", status: "IN_PROGRESS", startYear: 2015, title: "Synthetic master", field: "Natur & Umwelt", sector: null, job: null }),
    overviewStation(),
  ] };
}
