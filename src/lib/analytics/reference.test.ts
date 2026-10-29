import { expect, it } from "vitest";
import { aggregateCareers } from "./aggregate";
import { aggregateOverview } from "./overview";
import { overviewProfile } from "./overview-fixtures";
it("uses the explicitly confirmed reference without demo inference; missing means unknown", () => {
 const p = { ...overviewProfile(), referenceDegreeId: "anchor", completeTestCase: false };
 p.stations.forEach(s => { s.demoAnchor = false; });
 p.referenceDegreeId = p.stations[0].id;
 expect(aggregateOverview([p]).included).toBe(1);
 expect(aggregateOverview([p]).paths[0].labels[0]).toBe("Bestätigter MSI-Bachelor");
 expect(aggregateCareers([p]).included).toBe(1);
 p.stations = [p.stations[0]];
 expect(aggregateOverview([p]).decisions[0].master.presence).toBe("UNKNOWN");
 p.referenceDegreeId = "foreign";
 expect(aggregateOverview([p]).included).toBe(0);
});
