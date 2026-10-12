import type { SyntheticInputProfile } from "./contract";

// Written independently for D.2. These are factual synthetic source assertions,
// not a provider payload, generated canonical output, or a copy of the D.1 corpus.
export const syntheticInputs: SyntheticInputProfile[] = [
  {
    caseId: "career-01",
    stations: [
      { timelinePosition: 1, key: "source-bachelor", kind: "academic", label: "Synthetic Bachelor in Program A", providerLabel: "Synthetic University A", outcome: "awarded", start: { precision: "YEAR", year: 2011 }, end: { precision: "YEAR", year: 2014 }, graduation: { precision: "YEAR", year: 2014 }, catalogAssociation: { kind: "program", key: "program-a" } },
      { timelinePosition: 2, key: "source-master", kind: "academic", label: "Synthetic Master in Program B", providerLabel: "Synthetic University B", outcome: "awarded", start: { precision: "YEAR", year: 2015 }, end: { precision: "YEAR", year: 2017 }, graduation: { precision: "YEAR", year: 2017 }, catalogAssociation: { kind: "program", key: "program-b" } },
    ],
  },
  {
    caseId: "career-02",
    stations: [
      { timelinePosition: 1, key: "source-study", kind: "academic", label: "Synthetic Bachelor in Program A", providerLabel: "Synthetic University A", outcome: "awarded", start: { precision: "YEAR", year: 2016 }, end: { precision: "YEAR", year: 2020 }, graduation: { precision: "YEAR", year: 2020 }, catalogAssociation: { kind: "program", key: "program-a" } },
      { timelinePosition: 4, key: "source-student-work", kind: "employment", label: "Synthetic Student Project Assistant", providerLabel: "Synthetic Organisation A", outcome: "ended", start: { precision: "MONTH", year: 2018, month: 4 }, end: { precision: "MONTH", year: 2019, month: 9 }, graduation: null, catalogAssociation: { kind: "organisation", key: "organisation-a" } },
    ],
  },
  {
    caseId: "career-03",
    stations: [
      { timelinePosition: 1, key: "source-training", kind: "vocational", label: "Synthetic Vocational Administration Training", providerLabel: "Synthetic Organisation A", outcome: "ended", start: { precision: "YEAR", year: 2010 }, end: { precision: "YEAR", year: 2013 }, graduation: null, catalogAssociation: { kind: "organisation", key: "organisation-a" } },
    ],
  },
  {
    caseId: "career-04",
    stations: [
      { timelinePosition: 1, key: "source-study", kind: "academic", label: "Synthetic Bachelor in Program A", providerLabel: "Synthetic University A", outcome: "studying", start: { precision: "YEAR", year: 2024 }, end: null, graduation: null, catalogAssociation: { kind: "program", key: "program-a" } },
      { timelinePosition: 2, key: "source-exchange", kind: "exchange", label: "Synthetic Exchange Semester Without Separate Award", providerLabel: "Synthetic University B", outcome: "ended", start: { precision: "MONTH", year: 2025, month: 2 }, end: { precision: "MONTH", year: 2025, month: 7 }, graduation: null, catalogAssociation: null },
    ],
  },
  {
    caseId: "career-05",
    stations: [
      { timelinePosition: 1, key: "source-doctorate", kind: "academic", label: "Synthetic PhD in Research Field A", providerLabel: "Synthetic University A", outcome: "awarded", start: { precision: "YEAR", year: 2017 }, end: { precision: "YEAR", year: 2022 }, graduation: null, catalogAssociation: { kind: "institution", key: "institution-a" } },
    ],
  },
  {
    caseId: "career-06",
    stations: [
      { timelinePosition: 1, key: "source-certificate", kind: "academic", label: "Synthetic Independent Academic Certificate A", providerLabel: "Synthetic University A", outcome: "awarded", start: { precision: "YEAR", year: 2020 }, end: { precision: "YEAR", year: 2021 }, graduation: { precision: "YEAR", year: 2021 }, catalogAssociation: { kind: "institution", key: "institution-a" } },
      { timelinePosition: 2, key: "source-course", kind: "course", label: "Synthetic Methods Course Without Independent Qualification", providerLabel: "Synthetic University A", outcome: "ended", start: { precision: "MONTH", year: 2022, month: 3 }, end: { precision: "MONTH", year: 2022, month: 5 }, graduation: null, catalogAssociation: null },
    ],
  },
  {
    caseId: "career-07",
    stations: [
      { timelinePosition: 1, key: "source-current-work", kind: "employment", label: "Synthetic Project Coordinator", providerLabel: "Synthetic Organisation B", outcome: "ongoing", start: { precision: "MONTH", year: 2023, month: 6 }, end: null, graduation: null, catalogAssociation: { kind: "organisation", key: "organisation-b" } },
    ],
  },
  {
    caseId: "career-08",
    stations: [
      { timelinePosition: 1, key: "source-independent-work", kind: "self-employment", label: "Synthetic Independent Workshop Facilitator", providerLabel: null, outcome: "ongoing", start: { precision: "YEAR", year: 2021 }, end: null, graduation: null, catalogAssociation: null },
      { timelinePosition: 3, key: "source-volunteer", kind: "volunteering", label: "Synthetic Volunteer Event Helper", providerLabel: "Synthetic Organisation B", outcome: "ended", start: { precision: "YEAR", year: 2022 }, end: { precision: "YEAR", year: 2024 }, graduation: null, catalogAssociation: { kind: "organisation", key: "organisation-b" } },
    ],
  },
  {
    caseId: "career-09",
    stations: [
      // Attendance ending is stated; award/completion is not. The approximate
      // start cannot supply an exact canonical year.
      { timelinePosition: 1, key: "source-uncertain-study", kind: "academic", label: "Synthetic Bachelor Study in Field C", providerLabel: "Synthetic University A", outcome: "unspecified", start: { precision: "IMPRECISE", text: "Around the middle of the 2010s" }, end: { precision: "YEAR", year: 2018 }, graduation: null, catalogAssociation: null },
      { timelinePosition: 5, key: "source-undated-work", kind: "employment", label: "Synthetic Support Assistant", providerLabel: null, outcome: "unspecified", start: null, end: null, graduation: null, catalogAssociation: null },
      { timelinePosition: 8, key: "source-ended-internship", kind: "internship", label: "Synthetic Internship Assistant", providerLabel: "Synthetic Organisation A", outcome: "ended", start: null, end: null, graduation: null, catalogAssociation: { kind: "organisation", key: "organisation-a" } },
    ],
  },
  {
    caseId: "career-10",
    stations: [
      // A matching catalog name does not establish identity. Association unknown.
      { timelinePosition: 1, key: "source-unassigned-work", kind: "employment", label: "Synthetic Operations Assistant", providerLabel: "Synthetic Organisation A", outcome: "ended", start: { precision: "YEAR", year: 2019 }, end: { precision: "YEAR", year: 2021 }, graduation: null, catalogAssociation: null },
    ],
  },
  {
    caseId: "career-11",
    stations: [
      { timelinePosition: 4, key: "source-first-award", kind: "academic", label: "Synthetic Bachelor Award A", providerLabel: "Synthetic University A", outcome: "awarded", start: { precision: "YEAR", year: 2006 }, end: { precision: "YEAR", year: 2009 }, graduation: { precision: "YEAR", year: 2009 }, catalogAssociation: { kind: "program", key: "program-a" } },
      { timelinePosition: 1, key: "source-second-award", kind: "academic", label: "Synthetic Bachelor Award B", providerLabel: "Synthetic University A", outcome: "awarded", start: { precision: "YEAR", year: 2012 }, end: { precision: "YEAR", year: 2015 }, graduation: { precision: "YEAR", year: 2015 }, catalogAssociation: { kind: "program", key: "program-a" } },
    ],
  },
  {
    caseId: "career-12",
    stations: [
      { timelinePosition: 1, key: "source-ambiguous-learning", kind: "unclear", label: "Synthetic Advanced Studies Certificate or Course", providerLabel: "Synthetic University A", outcome: "unspecified", start: { precision: "YEAR", year: 2020 }, end: { precision: "YEAR", year: 2021 }, graduation: null, catalogAssociation: null },
    ],
  },
];
