import { describe, expect, it } from "vitest";
import { aggregateOverview, overviewStages } from "./overview";
import { overviewProfile, overviewStation } from "./overview-fixtures";

describe("V2.4a: first definite post-MSI occupation, person counted", () => {
  it("pairs sector and job from one first station and conserves three boundaries", () => {
    const flow = aggregateOverview([overviewProfile()]);
    expect(overviewStages).toHaveLength(4);
    expect(flow.paths[0].labels).toEqual(["BA MSI · synthetischer Demoanker", "Natur & Umwelt", "Dritter Sektor", "Führung"]);
    expect(flow.decisions[0]).toMatchObject({ occupation: { state: "SELECTED", stationId: "work" }, master: { presence: "WITH", stationIds: ["master"] } });
    expect(flow.links).toHaveLength(3); expect(flow.links.every(l => l.value === 1)).toBe(true);
  });
  it.each(["Dritter Sektor", "IT & Technologie"])("uses the first of successive jobs even when the later sector is %s", sector => {
    const p = overviewProfile();
    p.stations.push(overviewStation({ id: "later", position: 4, startYear: 2021, sector, job: "Marketing & Vertrieb", provider: "Synthetic second employer" }));
    const flow = aggregateOverview([p]);
    expect(flow.paths[0].labels.slice(2)).toEqual(["Dritter Sektor", "Führung"]);
    expect(flow.decisions[0].occupation.stationId).toBe("work");
    expect(flow.nodes.some(n => n.label.startsWith("Kombination:"))).toBe(false);
  });
  it("never chooses by array order, position or category when earliest starts tie", () => {
    const p = overviewProfile();
    p.stations.push(overviewStation({ id: "tie", position: 4, sector: "IT & Technologie", job: "Forschung & Entwicklung" }));
    const flow = aggregateOverview([p]);
    expect(flow.decisions[0].occupation).toMatchObject({ state: "AMBIGUOUS", stationId: null, candidateIds: ["tie", "work"] });
    expect(flow.paths[0].labels.slice(2)).toEqual(["Mehrere mögliche erste Tätigkeiten", "Mehrere mögliche erste Tätigkeiten"]);
    expect(aggregateOverview([{ ...p, stations: p.stations.toReversed() }]).paths[0].labels).toEqual(flow.paths[0].labels);
  });
  it("accepts a known start with an unknown end but does not ignore a possibly earlier undated job", () => {
    const p = overviewProfile(); p.stations[2].status = "UNKNOWN";
    expect(aggregateOverview([p]).decisions[0].occupation.state).toBe("SELECTED");
    p.stations.push(overviewStation({ id: "undated", position: 4, startYear: null, status: "UNKNOWN" }));
    expect(aggregateOverview([p]).decisions[0].occupation).toMatchObject({ state: "UNCLEAR", stationId: null });
  });
  it("excludes jobs begun during MSI; boundary-year and contradictory order remain unclear", () => {
    const p = overviewProfile();
    p.stations.push(overviewStation({ id: "overlap", position: 4, startYear: 2012, endYear: 2019, status: "ENDED" }));
    expect(aggregateOverview([p]).decisions[0].occupation.stationId).toBe("work");
    p.stations[3].startYear = 2014;
    expect(aggregateOverview([p]).decisions[0].occupation.state).toBe("UNCLEAR");
    p.stations[3].startYear = 2016; p.stations[3].position = 0;
    expect(aggregateOverview([p]).excluded[0].reason).toBe("INVALID_TIMELINE");
  });
  it.each(["EDUCATION", "VOCATIONAL_TRAINING", "UNEMPLOYED", "OTHER", "VOLUNTEERING"])("does not select %s as a professional job", type => {
    const p = overviewProfile(); p.stations[2].type = type;
    expect(aggregateOverview([p]).decisions[0].occupation.state).toBe("ABSENT");
  });
  it.each(["EMPLOYMENT", "SELF_EMPLOYMENT", "INTERNSHIP"])("allows explicitly relevant occupation type %s", type => {
    const p = overviewProfile(); p.stations[2].type = type;
    expect(aggregateOverview([p]).decisions[0].occupation.stationId).toBe("work");
  });
  it("distinguishes complete-case absence from unknown and retains each missing category independently", () => {
    const p = overviewProfile(); p.stations = p.stations.filter(s => s.type !== "MASTER");
    expect(aggregateOverview([p]).paths[0].labels[1]).toBe("Kein Master (Testfall vollständig)");
    p.completeTestCase = false;
    expect(aggregateOverview([p]).decisions[0].master.presence).toBe("UNKNOWN");
    p.stations[1].sector = null;
    expect(aggregateOverview([p]).paths[0].labels.slice(2)).toEqual(["Branche unbekannt", "Führung"]);
    p.stations[1].sector = "Dritter Sektor"; p.stations[1].job = null;
    expect(aggregateOverview([p]).paths[0].labels.slice(2)).toEqual(["Dritter Sektor", "Jobkategorie unbekannt"]);
  });
  it("retains ongoing and unfinished master phases without claiming graduation", () => {
    for (const status of ["IN_PROGRESS", "ENDED_WITHOUT_DEGREE", "UNKNOWN"]) {
      const p = overviewProfile(); p.stations[1].status = status;
      expect(aggregateOverview([p]).paths[0].labels[1]).toBe("Natur & Umwelt");
      expect(aggregateOverview([p]).decisions[0].master.presence).toBe("WITH");
    }
  });
  it("marks multiple masters explicitly without selecting one field, including repeated fields", () => {
    const p = overviewProfile();
    p.stations.push(overviewStation({ ...p.stations[1], id: "master2", position: 4, startYear: 2020, field: "Wirtschaft & Recht" }));
    expect(aggregateOverview([p]).paths[0].labels[1]).toBe("Mehrere Masterstudien");
    expect(aggregateOverview([p]).decisions[0].master.stationIds).toEqual(["master", "master2"]);
    p.stations[3].field = "Natur & Umwelt";
    expect(aggregateOverview([p]).paths[0].labels[1]).toBe("Mehrere Masterstudien");
  });
  it("keeps uncertain master timing visible and never turns missing dates into no master", () => {
    const p = overviewProfile(); p.stations[1].startYear = 2014;
    expect(aggregateOverview([p]).decisions[0].master.presence).toBe("UNKNOWN");
    expect(aggregateOverview([p]).paths[0].labels[1]).toBe("Masterstudium zeitlich ungeklärt");
  });
  it("requires an existing eligible demo anchor and never mutates canonical data", () => {
    const p = overviewProfile(), original = structuredClone(p);
    aggregateOverview([p]); expect(p).toEqual(original);
    p.stations[0].demoAnchor = false;
    expect(aggregateOverview([p]).excluded).toEqual([{ alumniId: p.id, reason: "MISSING_DEMO_ANCHOR" }]);
  });
  it("preserves person totals, true sector/job pairs and each inner node's balance", () => {
    const a = overviewProfile("a"), b = overviewProfile("b"), c = overviewProfile("c");
    c.stations[2].sector = "IT & Technologie"; c.stations[2].job = "Forschung & Entwicklung";
    const flow = aggregateOverview([a, b, c]);
    expect(flow.included).toBe(3); expect(flow.selectedFirstStations).toBe(3);
    expect(flow.links.reduce((n, l) => n + l.value, 0)).toBe(9);
    for (let stage = 0; stage < 3; stage++) expect(flow.links.filter(l => l.stage === stage).reduce((n, l) => n + l.value, 0)).toBe(3);
    for (const node of flow.nodes.filter(n => n.stage === 1 || n.stage === 2)) {
      expect(flow.links.filter(l => l.target === node.id).reduce((n, l) => n + l.value, 0)).toBe(flow.links.filter(l => l.source === node.id).reduce((n, l) => n + l.value, 0));
    }
    const pairs = flow.links.filter(l => l.stage === 2).map(l => [flow.nodes.find(n => n.id === l.source)!.label, flow.nodes.find(n => n.id === l.target)!.label, l.value]);
    expect(pairs).toEqual([["Dritter Sektor", "Führung", 2], ["IT & Technologie", "Forschung & Entwicklung", 1]]);
  });
});
