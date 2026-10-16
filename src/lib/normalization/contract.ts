import type { CareerStep, Degree } from "../../generated/prisma/client";

/** Ephemeral, local to one input batch. Never a provider ID or canonical ID. */
export type SourceStationKey = string;
export type AbsentFact =
  | { kind: "MISSING" }
  | { kind: "UNKNOWN"; origin: "OBSERVED" | "ASSERTED" };
export type Assertion<T> = AbsentFact | { kind: "ASSERTED"; value: T };
export type SourceFact<T> = Assertion<T> | { kind: "OBSERVED"; value: T };

/** YEAR/MONTH are exact at their stated precision; IMPRECISE has no year. */
export type SourceDate =
  | { precision: "YEAR"; year: number; month?: never; text?: never }
  | { precision: "MONTH"; year: number; month: number; text?: never }
  | { precision: "IMPRECISE"; text: string; year?: never; month?: never };

export type CatalogIdentity = { entity: "PROGRAM" | "INSTITUTION" | "ORGANISATION"; id: string };
export type CatalogAssociation =
  | { kind: "UNKNOWN"; identity?: never }
  | { kind: "CANDIDATE"; identity: CatalogIdentity; basis: "NAME_MATCH" | "SUPPLIED_CANDIDATE" }
  | { kind: "CONFIRMED"; identity: CatalogIdentity; confirmation: "EXPLICIT_SELECTION" | "TRUSTED_INPUT" };

export type StationClassification =
  | { type: "DEGREE"; level: Degree["level"] }
  | { type: "CAREER_STEP"; careerStepType: CareerStep["type"] };

/** Source-neutral facts, not a Prisma entity or a raw imported profile. */
export type SourceStation = {
  key: SourceStationKey;
  title: SourceFact<string>;
  category: SourceFact<string>;
  providerLabel: SourceFact<string>;
  start: SourceFact<SourceDate>;
  end: SourceFact<SourceDate>;
  graduation: SourceFact<SourceDate>;
  classification: Assertion<StationClassification>;
  degreeStatus: Assertion<Degree["status"]>;
  temporalStatus: Assertion<CareerStep["temporalStatus"]>;
  position: Assertion<number>;
  catalog: CatalogAssociation;
};
export type NormalizationInput = { stations: SourceStation[] };

/** Canonical scalar values only, excluding ownership/IDs/timestamps/metadata. */
export type CanonicalDegree = Pick<Degree,
  "level" | "status" | "title" | "startYear" | "endYear" | "graduationYear"
> & { fieldOfStudy: null } & (
  | { programId: string; institutionId: null }
  | { programId: null; institutionId: string | null }
);
export type CanonicalCareerStep = Pick<CareerStep,
  "type" | "temporalStatus" | "roleTitle" | "organisationId" | "startYear" | "endYear"
> & { roleCategory: null; functionArea: null; location: null };
// The four null-only fields have no dedicated source evidence in E.1. Labels
// cannot supply these classifications/details. A later contract may add facts.

export type DecisionField =
  | "classification" | "level" | "status" | "temporalStatus" | "catalogAssociation"
  | "startYear" | "endYear" | "graduationYear" | "position"
  | "title" | "fieldOfStudy" | "roleTitle" | "roleCategory" | "functionArea" | "location";
export type UnresolvedDecision = {
  field: DecisionField;
  reason: "MISSING" | "UNKNOWN" | "IMPRECISE_DATE" | "CLASSIFICATION_UNCERTAIN"
    | "CATALOG_UNCONFIRMED" | "STATUS_UNCERTAIN" | "CONFLICTING_FACTS";
};

/** Exactly one source -> one station, or no station pending review. */
export type StationOutcome = { sourceKey: SourceStationKey } & (
  | { kind: "RESOLVED_DEGREE"; canonical: CanonicalDegree; position: number; unresolved: UnresolvedDecision[] }
  | { kind: "RESOLVED_CAREER_STEP"; canonical: CanonicalCareerStep; position: number; unresolved: UnresolvedDecision[] }
  | { kind: "REVIEW_REQUIRED"; canonical?: never; position?: never; unresolved: [UnresolvedDecision, ...UnresolvedDecision[]] }
);

/** No Alumni, contact, SurveyResponse or reference selection belongs here. */
export type NormalizationResult = { stations: StationOutcome[] };
export type ContractDiagnostic = {
  side: "INPUT" | "RESULT";
  stationIndex?: number;
  code: "INVALID_SHAPE" | "DUPLICATE_SOURCE_KEY" | "SOURCE_NOT_FOUND" | "MISSING_OUTCOME"
    | "DUPLICATE_OUTCOME" | "DUPLICATE_POSITION" | "UNSUPPORTED_FACT"
    | "UNCONFIRMED_CATALOG" | "INVALID_CANONICAL" | "INVALID_DECISION";
  field?: DecisionField;
};
export type ContractValidation = { ok: boolean; diagnostics: ContractDiagnostic[] };
