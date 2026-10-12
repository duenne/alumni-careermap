import type { CareerCase, FixtureCatalogs } from "./contract";
import { syntheticInputs } from "./inputs";
import { expectedProfiles } from "./expected";

export const catalogs: FixtureCatalogs = {
  institutions: [
    { key: "institution-a", name: "Synthetic University A" },
    { key: "institution-a-distinct", name: "Synthetic University A" },
    { key: "institution-b", name: "Synthetic University B" },
  ],
  programs: [
    { key: "program-a", name: "Synthetic Program A", institutionKey: "institution-a" },
    { key: "program-b", name: "Synthetic Program B", institutionKey: "institution-b" },
  ],
  organisations: [
    { key: "organisation-a", name: "Synthetic Organisation A" },
    { key: "organisation-b", name: "Synthetic Organisation B" },
  ],
};

const scenarios = [
  ["career-01", "Completed Bachelor and Master"],
  ["career-02", "Student employment during a Degree"],
  ["career-03", "Vocational training"],
  ["career-04", "Exchange semester without a separate qualification"],
  ["career-05", "Completed PhD with unknown graduation year"],
  ["career-06", "Independent academic certificate and nondegree course"],
  ["career-07", "Ongoing employment"],
  ["career-08", "Self-employment and volunteering"],
  ["career-09", "Missing and imprecise dates"],
  ["career-10", "Unknown Organisation association"],
  ["career-11", "Multiple possible reference Degrees"],
  ["career-12", "Ambiguous qualification or course"],
] as const;

// Assembly by declared IDs only. No classification, sorting, selection or
// canonical facts are derived from source records.
export const careerCases: CareerCase[] = scenarios.map(([caseId, scenario]) => {
  const input = syntheticInputs.find(profile => profile.caseId === caseId);
  const expected = expectedProfiles.find(profile => profile.caseId === caseId);
  if (!input || !expected) throw new Error(`Missing authored fixture: ${caseId}`);
  return {
    caseId, scenario, provenance: "INDEPENDENTLY_AUTHORED_FICTIONAL",
    survey: { referenceProgramKey: "program-a" }, input, expected,
  };
});
