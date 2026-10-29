import { describe, expect, it } from "vitest";
import type { AnalyticsProfile, AnalyticsStation } from "./records";
import { aggregateCareers } from "./aggregate";
const station = (overrides: Partial<AnalyticsStation>): AnalyticsStation => ({ id: "step", position: 1, kind: "CAREER_STEP", type: "EMPLOYMENT", status: "ENDED", title: "Synthetic role", startYear: 2005, endYear: 2008, graduationYear: null, provider: "Synthetic organisation", field: null, sector: "Dritter Sektor", job: "Führung", location: null, demoAnchor: false, ...overrides });
const profile = (): AnalyticsProfile => ({ id: "alumni", completeTestCase: true, stations: [
  station({ id: "training", type: "VOCATIONAL_TRAINING", field: "Mensch & Gesundheit", position: 1 }),
  station({ id: "pre", position: 2 }),
  station({ id: "anchor", kind: "DEGREE", type: "BACHELOR", status: "COMPLETED", startYear: 2010, endYear: 2014, field: "Gesellschaft & Politik", position: 3, demoAnchor: true }),
  station({ id: "master", kind: "DEGREE", type: "MASTER", status: "COMPLETED", startYear: 2015, endYear: 2017, field: "Natur & Umwelt", position: 4 }),
  station({ id: "post", startYear: 2018, endYear: null, status: "ONGOING", position: 5, sector: "Wissenschaft & Bildung", job: "Forschung & Entwicklung" }),
] });
const labels = (p: AnalyticsProfile) => aggregateCareers([p]).paths[0].labels;
describe("V2.3 person-counted seven-stage projection", () => {
  it("represents a simple career with exactly six adjacent transitions", () => {
    expect(labels(profile())).toEqual(["Mensch & Gesundheit", "Dritter Sektor", "Führung", "BA MSI · synthetischer Demoanker", "Natur & Umwelt", "Wissenschaft & Bildung", "Forschung & Entwicklung"]);
    const result = aggregateCareers([profile()]); expect(result.links).toHaveLength(6); expect(result.included).toBe(1); expect(result.excluded).toEqual([]);
  });
  it("retains multiple jobs as an explicit combination, without multiplying people", () => {
    const p = profile(); p.stations.push(station({ id: "post2", position: 6, startYear: 2020, endYear: 2021 }));
    const result = aggregateCareers([p]);
    expect(result.paths[0].labels[5]).toBe("Kombination: Dritter Sektor + Wissenschaft & Bildung");
    expect(result.links.reduce((sum, l) => sum + l.value, 0)).toBe(6);
    expect(p.stations).toHaveLength(6);
  });
  it("distinguishes no master in complete synthetic cases from unconfirmed absence", () => {
    const p = profile(); p.stations = p.stations.filter(s => s.type !== "MASTER");
    expect(labels(p)[4]).toBe("Kein Master (Testfall vollständig)");
    p.completeTestCase = false;
    expect(labels(p)[4]).toBe("Unbekannt");
  });
  it("does not equate ongoing/unknown master status with an absent master", () => {
    const p = profile(); p.stations[3].status = "UNKNOWN"; p.stations[3].endYear = null;
    expect(labels(p)[4]).toBe("Natur & Umwelt");
  });
  it("marks unknown categories/dates and year-boundary/overlap ambiguity explicitly", () => {
    const p = profile(); p.stations[4].sector = null;
    expect(labels(p)[5]).toBe("Unbekannt");
    p.stations[4].startYear = 2014;
    expect(labels(p)[5]).toBe("Zeitlich ungeklärt");
    expect(aggregateCareers([p]).partial).toBe(1);
    expect(aggregateCareers([p]).paths[0].temporalUnclearStations).toBe(1);
    p.stations[4].startYear = 2009; p.stations[4].endYear = 2016; p.stations[4].status = "ENDED";
    expect(labels(p)[1]).toBe("Zeitlich ungeklärt"); expect(labels(p)[5]).toBe("Zeitlich ungeklärt");
  });
  it("does not order a station by timeline alone when dates are missing or contradictory", () => {
    const p = profile(); p.stations[1].endYear = null; p.stations[1].status = "UNKNOWN";
    expect(labels(p)[1]).toBe("Zeitlich ungeklärt");
    // Missing endpoints and unclear relation describe the SAME station.
    expect(aggregateCareers([p]).paths[0].temporalUnclearStations).toBe(1);
    p.stations[1].endYear = 2008; p.stations[1].position = 9;
    expect(labels(p)[1]).toBe("Zeitlich ungeklärt");
  });
  it("combines identical categories across alumni, preserves distinct transitions and conserves every stage sum", () => {
    const a = profile(), b = profile(), c = profile(); b.id = "b"; c.id = "c"; c.stations[4].job = "Strategie & Planung";
    const result = aggregateCareers([a, b, c]);
    expect(result.included).toBe(3);
    expect(result.links.some(l => l.value === 3)).toBe(true); expect(result.links.some(l => l.value === 2)).toBe(true);
    for (let stage = 0; stage < 6; stage++) expect(result.links.filter(l => l.stage === stage).reduce((n, l) => n + l.value, 0)).toBe(3);
    expect(result.links.reduce((n, l) => n + l.value, 0)).toBe(18);
    for (const node of result.nodes.filter(n => n.stage > 0 && n.stage < 6)) {
      expect(result.links.filter(l => l.target === node.id).reduce((n, l) => n + l.value, 0)).toBe(result.links.filter(l => l.source === node.id).reduce((n, l) => n + l.value, 0));
    }
  });
  it("excludes missing/ambiguous/undated/ineligible anchors with reasons", () => {
    const a = profile(), b = profile(), c = profile(), d = profile();
    b.id = "b"; c.id = "c"; d.id = "d";
    a.stations[2].demoAnchor = false;
    b.stations.push(station({ ...b.stations[2], id: "duplicate-anchor", position: 7 }));
    c.stations[2].endYear = null;
    d.stations[2].status = "UNKNOWN";
    const result = aggregateCareers([a, b, c, d]);
    expect(result.included).toBe(0); expect(result.excluded.map(e => e.reason)).toEqual(["MISSING_DEMO_ANCHOR", "AMBIGUOUS_DEMO_ANCHOR", "UNKNOWN_ANCHOR_TIME", "INELIGIBLE_DEMO_ANCHOR"]);
    expect(result.nodes).toEqual([]); expect(result.links).toEqual([]);
  });
});
