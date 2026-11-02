import type { ManualParticipation } from "../../src/lib/donation/manual";
export const manualExample = (): ManualParticipation => ({
  stations: [
    { key: "degree-1", kind: "DEGREE", title: "Synthetischer Master", level: "MASTER", status: "COMPLETED", program: "SURVEY", institutionName: "", fieldOfStudy: "Informatik", startYear: 2018, endYear: 2020, graduationYear: 2020 },
    { key: "job-1", kind: "CAREER_STEP", title: "Synthetische Entwicklerin", type: "EMPLOYMENT", status: "ONGOING", organisationName: "Synthetischer Arbeitgeber", location: "", startYear: 2020, endYear: null },
  ], referenceKey: "degree-1", referenceConfirmed: true, contributionConfirmed: true,
});
