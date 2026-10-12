import type { ExpectedProfile } from "./contract";

// Authored oracle only. No facts are calculated from syntheticInputs.
export const expectedProfiles: ExpectedProfile[] = [
  {
    caseId: "career-01", alumni: { key: "alumni-01" },
    degrees: [
      { key: "degree-bachelor", level: "BACHELOR", status: "COMPLETED", title: "Synthetic Bachelor in Program A", programKey: "program-a", institutionKey: null, startYear: 2011, endYear: 2014, graduationYear: 2014 },
      { key: "degree-master", level: "MASTER", status: "COMPLETED", title: "Synthetic Master in Program B", programKey: "program-b", institutionKey: null, startYear: 2015, endYear: 2017, graduationYear: 2017 },
    ],
    careerSteps: [],
    timeline: [
      { type: "DEGREE", position: 1, degreeKey: "degree-bachelor", careerStepKey: null },
      { type: "DEGREE", position: 2, degreeKey: "degree-master", careerStepKey: null },
    ],
    mappings: [
      { sourceKey: "source-bachelor", outcome: "MAPPED", target: { type: "DEGREE", degreeKey: "degree-bachelor", careerStepKey: null } },
      { sourceKey: "source-master", outcome: "MAPPED", target: { type: "DEGREE", degreeKey: "degree-master", careerStepKey: null } },
    ],
    unresolved: [], reference: { candidateDegreeKeys: ["degree-bachelor"], selection: "REQUIRES_CONFIRMATION" },
  },
  {
    caseId: "career-02", alumni: { key: "alumni-02" },
    degrees: [{ key: "degree-study", level: "BACHELOR", status: "COMPLETED", title: "Synthetic Bachelor in Program A", programKey: "program-a", institutionKey: null, startYear: 2016, endYear: 2020, graduationYear: 2020 }],
    careerSteps: [{ key: "step-student-work", type: "EMPLOYMENT", temporalStatus: "ENDED", roleTitle: "Synthetic Student Project Assistant", organisationKey: "organisation-a", startYear: 2018, endYear: 2019 }],
    timeline: [
      { type: "DEGREE", position: 1, degreeKey: "degree-study", careerStepKey: null },
      { type: "CAREER_STEP", position: 4, degreeKey: null, careerStepKey: "step-student-work" },
    ],
    mappings: [
      { sourceKey: "source-study", outcome: "MAPPED", target: { type: "DEGREE", degreeKey: "degree-study", careerStepKey: null } },
      { sourceKey: "source-student-work", outcome: "MAPPED", target: { type: "CAREER_STEP", degreeKey: null, careerStepKey: "step-student-work" } },
    ],
    unresolved: [], reference: { candidateDegreeKeys: ["degree-study"], selection: "REQUIRES_CONFIRMATION" },
  },
  {
    caseId: "career-03", alumni: { key: "alumni-03" }, degrees: [],
    careerSteps: [{ key: "step-training", type: "VOCATIONAL_TRAINING", temporalStatus: "ENDED", roleTitle: "Synthetic Vocational Administration Training", organisationKey: "organisation-a", startYear: 2010, endYear: 2013 }],
    timeline: [{ type: "CAREER_STEP", position: 1, degreeKey: null, careerStepKey: "step-training" }],
    mappings: [{ sourceKey: "source-training", outcome: "MAPPED", target: { type: "CAREER_STEP", degreeKey: null, careerStepKey: "step-training" } }],
    unresolved: [], reference: { candidateDegreeKeys: [], selection: "REQUIRES_CONFIRMATION" },
  },
  {
    caseId: "career-04", alumni: { key: "alumni-04" },
    degrees: [{ key: "degree-study", level: "BACHELOR", status: "IN_PROGRESS", title: "Synthetic Bachelor in Program A", programKey: "program-a", institutionKey: null, startYear: 2024, endYear: null, graduationYear: null }],
    careerSteps: [{ key: "step-exchange", type: "EDUCATION", temporalStatus: "ENDED", roleTitle: "Synthetic Exchange Semester Without Separate Award", organisationKey: null, startYear: 2025, endYear: 2025 }],
    timeline: [
      { type: "DEGREE", position: 1, degreeKey: "degree-study", careerStepKey: null },
      { type: "CAREER_STEP", position: 2, degreeKey: null, careerStepKey: "step-exchange" },
    ],
    mappings: [
      { sourceKey: "source-study", outcome: "MAPPED", target: { type: "DEGREE", degreeKey: "degree-study", careerStepKey: null } },
      { sourceKey: "source-exchange", outcome: "MAPPED", target: { type: "CAREER_STEP", degreeKey: null, careerStepKey: "step-exchange" } },
    ],
    unresolved: [], reference: { candidateDegreeKeys: [], selection: "REQUIRES_CONFIRMATION" },
  },
  {
    caseId: "career-05", alumni: { key: "alumni-05" },
    degrees: [{ key: "degree-doctorate", level: "PHD", status: "COMPLETED", title: "Synthetic PhD in Research Field A", programKey: null, institutionKey: "institution-a", startYear: 2017, endYear: 2022, graduationYear: null }],
    careerSteps: [],
    timeline: [{ type: "DEGREE", position: 1, degreeKey: "degree-doctorate", careerStepKey: null }],
    mappings: [{ sourceKey: "source-doctorate", outcome: "MAPPED", target: { type: "DEGREE", degreeKey: "degree-doctorate", careerStepKey: null } }],
    unresolved: [{ sourceKey: "source-doctorate", fields: ["graduationYear"], reason: "Award is explicit; its year is not supplied. Attendance end does not supply graduation year." }],
    reference: { candidateDegreeKeys: [], selection: "REQUIRES_CONFIRMATION" },
  },
  {
    caseId: "career-06", alumni: { key: "alumni-06" },
    degrees: [{ key: "degree-certificate", level: "CERTIFICATE", status: "COMPLETED", title: "Synthetic Independent Academic Certificate A", programKey: null, institutionKey: "institution-a", startYear: 2020, endYear: 2021, graduationYear: 2021 }],
    careerSteps: [{ key: "step-course", type: "EDUCATION", temporalStatus: "ENDED", roleTitle: "Synthetic Methods Course Without Independent Qualification", organisationKey: null, startYear: 2022, endYear: 2022 }],
    timeline: [
      { type: "DEGREE", position: 1, degreeKey: "degree-certificate", careerStepKey: null },
      { type: "CAREER_STEP", position: 2, degreeKey: null, careerStepKey: "step-course" },
    ],
    mappings: [
      { sourceKey: "source-certificate", outcome: "MAPPED", target: { type: "DEGREE", degreeKey: "degree-certificate", careerStepKey: null } },
      { sourceKey: "source-course", outcome: "MAPPED", target: { type: "CAREER_STEP", degreeKey: null, careerStepKey: "step-course" } },
    ],
    unresolved: [], reference: { candidateDegreeKeys: [], selection: "REQUIRES_CONFIRMATION" },
  },
  {
    caseId: "career-07", alumni: { key: "alumni-07" }, degrees: [],
    careerSteps: [{ key: "step-current-work", type: "EMPLOYMENT", temporalStatus: "ONGOING", roleTitle: "Synthetic Project Coordinator", organisationKey: "organisation-b", startYear: 2023, endYear: null }],
    timeline: [{ type: "CAREER_STEP", position: 1, degreeKey: null, careerStepKey: "step-current-work" }],
    mappings: [{ sourceKey: "source-current-work", outcome: "MAPPED", target: { type: "CAREER_STEP", degreeKey: null, careerStepKey: "step-current-work" } }],
    unresolved: [], reference: { candidateDegreeKeys: [], selection: "REQUIRES_CONFIRMATION" },
  },
  {
    caseId: "career-08", alumni: { key: "alumni-08" }, degrees: [],
    careerSteps: [
      { key: "step-independent-work", type: "SELF_EMPLOYMENT", temporalStatus: "ONGOING", roleTitle: "Synthetic Independent Workshop Facilitator", organisationKey: null, startYear: 2021, endYear: null },
      { key: "step-volunteer", type: "VOLUNTEERING", temporalStatus: "ENDED", roleTitle: "Synthetic Volunteer Event Helper", organisationKey: "organisation-b", startYear: 2022, endYear: 2024 },
    ],
    timeline: [
      { type: "CAREER_STEP", position: 1, degreeKey: null, careerStepKey: "step-independent-work" },
      { type: "CAREER_STEP", position: 3, degreeKey: null, careerStepKey: "step-volunteer" },
    ],
    mappings: [
      { sourceKey: "source-independent-work", outcome: "MAPPED", target: { type: "CAREER_STEP", degreeKey: null, careerStepKey: "step-independent-work" } },
      { sourceKey: "source-volunteer", outcome: "MAPPED", target: { type: "CAREER_STEP", degreeKey: null, careerStepKey: "step-volunteer" } },
    ],
    unresolved: [], reference: { candidateDegreeKeys: [], selection: "REQUIRES_CONFIRMATION" },
  },
  {
    caseId: "career-09", alumni: { key: "alumni-09" },
    degrees: [{ key: "degree-uncertain-study", level: "BACHELOR", status: "UNKNOWN", title: "Synthetic Bachelor Study in Field C", programKey: null, institutionKey: null, startYear: null, endYear: null, graduationYear: null }],
    careerSteps: [
      { key: "step-undated-work", type: "EMPLOYMENT", temporalStatus: "UNKNOWN", roleTitle: "Synthetic Support Assistant", organisationKey: null, startYear: null, endYear: null },
      { key: "step-ended-internship", type: "INTERNSHIP", temporalStatus: "ENDED", roleTitle: "Synthetic Internship Assistant", organisationKey: "organisation-a", startYear: null, endYear: null },
    ],
    timeline: [
      { type: "DEGREE", position: 1, degreeKey: "degree-uncertain-study", careerStepKey: null },
      { type: "CAREER_STEP", position: 5, degreeKey: null, careerStepKey: "step-undated-work" },
      { type: "CAREER_STEP", position: 8, degreeKey: null, careerStepKey: "step-ended-internship" },
    ],
    mappings: [
      { sourceKey: "source-uncertain-study", outcome: "MAPPED", target: { type: "DEGREE", degreeKey: "degree-uncertain-study", careerStepKey: null } },
      { sourceKey: "source-undated-work", outcome: "MAPPED", target: { type: "CAREER_STEP", degreeKey: null, careerStepKey: "step-undated-work" } },
      { sourceKey: "source-ended-internship", outcome: "MAPPED", target: { type: "CAREER_STEP", degreeKey: null, careerStepKey: "step-ended-internship" } },
    ],
    unresolved: [
      { sourceKey: "source-uncertain-study", fields: ["startYear", "endYear", "status", "graduationYear", "programKey", "institutionKey"], reason: "Approximate start is not an exact year. Attendance end 2018 does not prove completion. UNKNOWN forbids canonical endYear; award and catalog identity require clarification." },
      { sourceKey: "source-undated-work", fields: ["startYear", "endYear", "temporalStatus", "organisationKey"], reason: "Neither dates, ongoing/ended evidence nor a catalog association are supplied." },
      { sourceKey: "source-ended-internship", fields: ["startYear", "endYear"], reason: "Ending is explicit but neither year is supplied." },
    ],
    reference: { candidateDegreeKeys: [], selection: "REQUIRES_CONFIRMATION" },
  },
  {
    caseId: "career-10", alumni: { key: "alumni-10" }, degrees: [],
    careerSteps: [{ key: "step-unassigned-work", type: "EMPLOYMENT", temporalStatus: "ENDED", roleTitle: "Synthetic Operations Assistant", organisationKey: null, startYear: 2019, endYear: 2021 }],
    timeline: [{ type: "CAREER_STEP", position: 1, degreeKey: null, careerStepKey: "step-unassigned-work" }],
    mappings: [{ sourceKey: "source-unassigned-work", outcome: "MAPPED", target: { type: "CAREER_STEP", degreeKey: null, careerStepKey: "step-unassigned-work" } }],
    unresolved: [{ sourceKey: "source-unassigned-work", fields: ["organisationKey"], reason: "A label equal to a catalog name supplies no confirmed identity; retain an unassigned association." }],
    reference: { candidateDegreeKeys: [], selection: "REQUIRES_CONFIRMATION" },
  },
  {
    caseId: "career-11", alumni: { key: "alumni-11" },
    degrees: [
      { key: "degree-first-award", level: "BACHELOR", status: "COMPLETED", title: "Synthetic Bachelor Award A", programKey: "program-a", institutionKey: null, startYear: 2006, endYear: 2009, graduationYear: 2009 },
      { key: "degree-second-award", level: "BACHELOR", status: "COMPLETED", title: "Synthetic Bachelor Award B", programKey: "program-a", institutionKey: null, startYear: 2012, endYear: 2015, graduationYear: 2015 },
    ],
    careerSteps: [],
    // Explicit revised order: newer award first, not array or chronological order.
    timeline: [
      { type: "DEGREE", position: 1, degreeKey: "degree-second-award", careerStepKey: null },
      { type: "DEGREE", position: 4, degreeKey: "degree-first-award", careerStepKey: null },
    ],
    mappings: [
      { sourceKey: "source-first-award", outcome: "MAPPED", target: { type: "DEGREE", degreeKey: "degree-first-award", careerStepKey: null } },
      { sourceKey: "source-second-award", outcome: "MAPPED", target: { type: "DEGREE", degreeKey: "degree-second-award", careerStepKey: null } },
    ],
    unresolved: [], reference: { candidateDegreeKeys: ["degree-first-award", "degree-second-award"], selection: "REQUIRES_CONFIRMATION" },
  },
  {
    caseId: "career-12", alumni: { key: "alumni-12" }, degrees: [], careerSteps: [], timeline: [],
    mappings: [{ sourceKey: "source-ambiguous-learning", outcome: "REVIEW_REQUIRED", questions: [
      "Does this award an independent academic qualification or describe a nondegree course?",
      "Was a qualification awarded, was study ended without one, or is completion unknown?",
      "Which catalog association, if any, has been confirmed?",
    ] }],
    unresolved: [{ sourceKey: "source-ambiguous-learning", fields: ["classification", "level", "status", "temporalStatus", "endYear", "graduationYear", "catalogAssociation"], reason: "Certificate wording and attendance dates do not establish an independent qualification or an award. Review is required before creating any canonical station or timeline item." }],
    reference: { candidateDegreeKeys: [], selection: "REQUIRES_CONFIRMATION" },
  },
];
