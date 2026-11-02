import { describe, expect, it } from "vitest";
import { overviewProfile, overviewStation } from "./overview-fixtures";
import { understandCareers } from "./understanding";

describe("career understanding from recorded stations", () => {
  it("retains known careers at same-year boundaries, missing dates and overlapping periods", () => {
    const p = overviewProfile();
    p.stations[0].startYear = null;
    p.stations[1].startYear = 2014;
    p.stations[2].startYear = null;
    const result = understandCareers([p]);
    expect(result.flow.included).toBe(1);
    expect(result.flow.paths[0].labels).toEqual(["Keine Station davor erfasst", "MSI · Referenzstudium", "Masterstudium", "Beschäftigung · Dritter Sektor"]);
    expect(result.groups[0].label).toBe("MSI → Masterstudium → Beschäftigung");
    expect(result.facts.master).toBe(1);
    expect(result.facts.work).toBe(1);
    expect(result.facts.sectors).toEqual([{ label: "Dritter Sektor", count: 1 }]);
  });
  it("preserves all intermediate stations, repeats and timeline order without inferring chronology", () => {
    const p = overviewProfile();
    p.stations.push(overviewStation({ id: "work2", position: 4, sector: "Beratung" }));
    p.stations.reverse();
    const before = structuredClone(p);
    const result = understandCareers([p]);
    expect(result.groups[0].label).toBe("MSI → Masterstudium → Beschäftigung → Beschäftigung");
    expect(result.flow.paths[0].labels[3]).toBe("Beschäftigung · Beratung");
    expect(result.facts.sectors).toEqual([{ label: "Beratung", count: 1 }, { label: "Dritter Sektor", count: 1 }]);
    expect(p).toEqual(before);
  });
  it("distinguishes unrecorded stations from complete-case absence and never invents a degree", () => {
    const p = overviewProfile(); p.completeTestCase = false; p.stations = p.stations.slice(0, 1);
    const result = understandCareers([p]);
    expect(result.flow.paths[0].labels.slice(2)).toEqual(["Keine weitere Station erfasst", "Nur Referenzstudium erfasst"]);
    expect(result.groups[0].label).toBe("MSI");
    expect(result.facts.master).toBe(0);
    expect(result.flow.nodes.every(n => !n.label.includes("Kein Master"))).toBe(true);
  });
  it("counts people once per category, groups complete sequences, and conserves each boundary", () => {
    const p = overviewProfile("a"), q = overviewProfile("b");
    p.stations.push(overviewStation({ id: "repeat", position: 4 }));
    q.stations.push(overviewStation({ id: "repeat", position: 4 }));
    const result = understandCareers([p, q]);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].alumniIds).toEqual(["a", "b"]);
    expect(result.facts.sectors).toEqual([{ label: "Dritter Sektor", count: 2 }]);
    for (let stage = 0; stage < 3; stage++) expect(result.flow.links.filter(l => l.stage === stage).reduce((sum, l) => sum + l.value, 0)).toBe(2);
  });
  it("uses an explicit reference and excludes duplicate profiles and invalid timelines", () => {
    const p = overviewProfile(); p.referenceDegreeId = "missing";
    const q = overviewProfile("bad"); q.stations[2].position = 1;
    const r = overviewProfile("ok");
    const result = understandCareers([p, q, r, r]);
    expect(result.flow.included).toBe(1);
    expect(result.flow.excluded.map(e => e.reason)).toEqual(["MISSING_CONFIRMED_REFERENCE", "INVALID_TIMELINE", "DUPLICATE_PROFILE"]);
  });
});

it("uses recorded role and study titles when the demo has no categorical enrichment", () => {
  const p = overviewProfile();
  for (const s of p.stations) { s.field = null; s.sector = null; s.job = null; }
  const result = understandCareers([p]);
  expect(result.flow.paths[0].labels[3]).toBe("Synthetic work");
  expect(result.facts.roles).toEqual([{ label: "Synthetic work", count: 1 }]);
  expect(result.facts.masterTitles).toEqual([{ label: "Synthetic master", count: 1 }]);
  expect(result.facts.organisations).toEqual([{ label: "Synthetic employer", count: 1 }]);
});

it("bounds long category lists with an explicit bundle while retaining every selectable career", () => {
  const profiles = Array.from({ length: 14 }, (_, index) => {
    const p = overviewProfile(`synthetic-${index}`);
    p.stations[2].sector = null; p.stations[2].title = `Synthetic role ${index}`;
    return p;
  });
  const result = understandCareers(profiles);
  expect(result.flow.nodes.filter(n => n.stage === 3)).toHaveLength(9);
  expect(result.flow.paths.filter(p => p.labels[3] === "Weitere Stationen · 6 Bezeichnungen")).toHaveLength(6);
  expect(result.flow.paths).toHaveLength(14);
  expect(result.facts.roles).toHaveLength(14);
  for (let stage = 0; stage < 3; stage++) expect(result.flow.links.filter(l => l.stage === stage).reduce((sum, l) => sum + l.value, 0)).toBe(14);
});
