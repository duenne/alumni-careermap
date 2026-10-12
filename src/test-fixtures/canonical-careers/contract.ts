import type { Degree, CareerStep } from "../../generated/prisma/client";

// Keys are transient test correlations, never persisted IDs or provider IDs.
export type SourceDate =
  | { precision: "YEAR"; year: number }
  | { precision: "MONTH"; year: number; month: number }
  | { precision: "IMPRECISE"; text: string }
  | null;

export type SourceStation = {
  key: string;
  timelinePosition: number;
  kind: "academic" | "vocational" | "exchange" | "course" | "employment" | "internship"
    | "self-employment" | "volunteering" | "unclear";
  label: string;
  providerLabel: string | null;
  outcome: "awarded" | "studying" | "left-without-award" | "ongoing" | "ended" | "unspecified";
  start: SourceDate;
  end: SourceDate;
  graduation: SourceDate;
  // Explicitly supplied catalog associations; never inferred from label equality.
  catalogAssociation: { kind: "program" | "institution" | "organisation"; key: string } | null;
};

export type SyntheticInputProfile = {
  caseId: string;
  stations: SourceStation[];
};

type DegreeCatalog =
  | { programKey: string; institutionKey: null }
  | { programKey: null; institutionKey: string | null };
export type ExpectedDegree = Pick<Degree,
  "level" | "status" | "title" | "startYear" | "endYear" | "graduationYear"
> & DegreeCatalog & { key: string };
export type ExpectedCareerStep = Pick<CareerStep,
  "type" | "temporalStatus" | "roleTitle" | "startYear" | "endYear"
> & { key: string; organisationKey: string | null };
export type StationTarget =
  | { type: "DEGREE"; degreeKey: string; careerStepKey: null }
  | { type: "CAREER_STEP"; degreeKey: null; careerStepKey: string };
export type ExpectedTimelineItem = StationTarget & { position: number };
export type StationMapping =
  | { sourceKey: string; outcome: "MAPPED"; target: StationTarget }
  | { sourceKey: string; outcome: "REVIEW_REQUIRED"; questions: string[] };

export type ExpectedProfile = {
  caseId: string;
  alumni: { key: string };
  degrees: ExpectedDegree[];
  careerSteps: ExpectedCareerStep[];
  timeline: ExpectedTimelineItem[];
  mappings: StationMapping[];
  unresolved: { sourceKey: string; fields: string[]; reason: string }[];
  reference: {
    candidateDegreeKeys: string[];
    selection: "REQUIRES_CONFIRMATION";
  };
};

export type FixtureCatalogs = {
  institutions: { key: string; name: string }[];
  programs: { key: string; name: string; institutionKey: string }[];
  organisations: { key: string; name: string }[];
};
export type CareerCase = {
  caseId: string;
  scenario: string;
  provenance: "INDEPENDENTLY_AUTHORED_FICTIONAL";
  survey: { referenceProgramKey: string };
  input: SyntheticInputProfile;
  expected: ExpectedProfile;
};
