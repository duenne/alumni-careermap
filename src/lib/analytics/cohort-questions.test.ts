import { expect, it } from "vitest";
import { overviewProfile, overviewStation } from "./overview-fixtures";
import { understandCareers } from "./understanding";

it("answers background, next entry, further study and first vs last occupation with separate denominators", () => {
  const a = overviewProfile("a"), b = overviewProfile("b");
  a.stations.unshift(overviewStation({ id: "training", position: 1, type: "VOCATIONAL_TRAINING", startYear: 2000, endYear: 2002, status: "ENDED" }));
  a.stations.slice(1).forEach(s => s.position++);
  a.stations.push(overviewStation({ id: "later", position: 5, startYear: 2022, title: "Synthetic later role", sector: "Beratung" }));
  b.stations = [b.stations[0], overviewStation({ id: "intern", position: 2, type: "INTERNSHIP", startYear: 2012, endYear: 2013, status: "ENDED" }), b.stations[2]];
  const q = understandCareers([a, b]).questions;
  expect(q.background).toMatchObject({ recorded: 1, unrecorded: 1, types: [{ label: "VOCATIONAL_TRAINING", count: 1 }] });
  expect(q.next).toEqual([{ label: "INTERNSHIP", count: 1 }, { label: "MASTER", count: 1 }]);
  expect(q.study).toMatchObject({ masters: 1, multipleMasters: 0, described: 1, titles: [{ label: "Synthetic master", count: 1 }] });
  expect(q.entry).toMatchObject({ selected: 2, unresolved: 0, sectorKnown: 2, sectors: [{ label: "Dritter Sektor", count: 2 }] });
  expect(q.entry.types).toEqual([{ label: "EMPLOYMENT", count: 2 }, { label: "SELF_EMPLOYMENT", count: 0 }, { label: "INTERNSHIP", count: 0 }]);
  expect(q.latest.sectors).toEqual([{ label: "Beratung", count: 1 }, { label: "Dritter Sektor", count: 1 }]);
});

it("makes missing industry evidence explicit instead of substituting employer names or later sectors", () => {
  const p = overviewProfile(); p.stations[2].sector = null;
  p.stations.push(overviewStation({ id: "later", position: 4, startYear: 2022, sector: "Beratung" }));
  const q = understandCareers([p]).questions;
  expect(q.entry.sectorKnown).toBe(0);
  expect(q.entry.sectors).toEqual([]);
  expect(q.entry.roles).toEqual([{ label: "Synthetic work", count: 1 }]);
  expect(q.latest.sectorKnown).toBe(1);
});

it("keeps unknown starts and incomplete records explicit and counts study titles once per profile", () => {
  const p = overviewProfile(); p.stations[2].startYear = null;
  p.stations.push({ ...p.stations[1], id: "master2", position: 4, startYear: 2021 });
  const b = overviewProfile("bare"); b.completeTestCase = false; b.stations = b.stations.slice(0, 1);
  const q = understandCareers([p, b]).questions;
  expect(q.entry).toMatchObject({ selected: 0, unresolved: 2, sectorKnown: 0 });
  expect(q.study).toMatchObject({ masters: 1, multipleMasters: 1, described: 1, titles: [{ label: "Synthetic master", count: 1 }] });
  expect(q.next).toContainEqual({ label: "NOT_RECORDED", count: 1 });
});
