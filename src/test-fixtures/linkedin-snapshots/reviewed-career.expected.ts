import type { NormalizationResult } from "../../lib/normalization/contract";
import type { ExplicitReviewUpdates } from "../../lib/normalization/apply-explicit-review-assertions";

// E.4b.2: manually authored before the test pipeline implementation. These are
// additional synthetic review claims and an independent oracle, not recovered
// profile facts. Type-only imports; no normalizer, adapter or D.2 oracle calls.
export const reviewedCareerUpdates: ExplicitReviewUpdates = { updates: [
  { sourceKey: "snapshot:2:0", classification: { type: "DEGREE", level: "MASTER" }, degreeStatus: "COMPLETED", position: 1 },
  { sourceKey: "snapshot:1:0", classification: { type: "CAREER_STEP", careerStepType: "EMPLOYMENT" }, temporalStatus: "ONGOING", position: 3 },
  { sourceKey: "snapshot:2:1", classification: { type: "CAREER_STEP", careerStepType: "EDUCATION" }, temporalStatus: "ENDED", position: 5 },
] };

export const reviewedCareerExpected: NormalizationResult = { stations: [
  { sourceKey: "snapshot:1:0", kind: "RESOLVED_CAREER_STEP", position: 3,
    canonical: { type: "EMPLOYMENT", temporalStatus: "ONGOING", roleTitle: "Synthetic Research Assistant",
      roleCategory: null, functionArea: null, location: null, organisationId: null, startYear: 2023, endYear: null },
    unresolved: [{ field: "endYear", reason: "MISSING" }, { field: "catalogAssociation", reason: "UNKNOWN" }] },
  { sourceKey: "snapshot:1:1", kind: "REVIEW_REQUIRED",
    unresolved: [{ field: "classification", reason: "CLASSIFICATION_UNCERTAIN" }] },
  { sourceKey: "snapshot:2:0", kind: "RESOLVED_DEGREE", position: 1,
    canonical: { level: "MASTER", status: "COMPLETED", title: "Synthetic M.Sc.", fieldOfStudy: null,
      programId: null, institutionId: null, startYear: 2019, endYear: 2022, graduationYear: null },
    unresolved: [{ field: "graduationYear", reason: "MISSING" }, { field: "catalogAssociation", reason: "UNKNOWN" }] },
  { sourceKey: "snapshot:2:1", kind: "RESOLVED_CAREER_STEP", position: 5,
    canonical: { type: "EDUCATION", temporalStatus: "ENDED", roleTitle: "Synthetic Short Course",
      roleCategory: null, functionArea: null, location: null, organisationId: null, startYear: null, endYear: null },
    unresolved: [{ field: "startYear", reason: "IMPRECISE_DATE" }, { field: "endYear", reason: "MISSING" },
      { field: "catalogAssociation", reason: "UNKNOWN" }] },
] };

export const unreviewedExpected: NormalizationResult = { stations: [
  { sourceKey: "snapshot:1:0", kind: "REVIEW_REQUIRED", unresolved: [{ field: "classification", reason: "CLASSIFICATION_UNCERTAIN" }] },
  { sourceKey: "snapshot:1:1", kind: "REVIEW_REQUIRED", unresolved: [{ field: "classification", reason: "CLASSIFICATION_UNCERTAIN" }] },
  { sourceKey: "snapshot:2:0", kind: "REVIEW_REQUIRED", unresolved: [{ field: "classification", reason: "CLASSIFICATION_UNCERTAIN" }] },
  { sourceKey: "snapshot:2:1", kind: "REVIEW_REQUIRED", unresolved: [{ field: "classification", reason: "CLASSIFICATION_UNCERTAIN" }] },
] };

export const conflictingUpdates: ExplicitReviewUpdates = { updates: [
  ...reviewedCareerUpdates.updates,
  { sourceKey: "snapshot:1:1", classification: { type: "CAREER_STEP", careerStepType: "INTERNSHIP" }, temporalStatus: "ONGOING", position: 7 },
] };
export const conflictingExpected: NormalizationResult = { stations: [
  reviewedCareerExpected.stations[0],
  { sourceKey: "snapshot:1:1", kind: "REVIEW_REQUIRED", unresolved: [{ field: "endYear", reason: "CONFLICTING_FACTS" }] },
  reviewedCareerExpected.stations[2], reviewedCareerExpected.stations[3],
] };

export const partialUpdates: ExplicitReviewUpdates = { updates: [
  { sourceKey: "snapshot:2:0", classification: { type: "DEGREE", level: "MASTER" }, degreeStatus: "COMPLETED" },
  { sourceKey: "snapshot:1:0", classification: { type: "CAREER_STEP", careerStepType: "EMPLOYMENT" }, position: 3 },
  { sourceKey: "snapshot:2:1", temporalStatus: "ENDED", position: 5 },
] };
export const partialExpected: NormalizationResult = { stations: [
  { sourceKey: "snapshot:1:0", kind: "RESOLVED_CAREER_STEP", position: 3,
    canonical: { type: "EMPLOYMENT", temporalStatus: "UNKNOWN", roleTitle: "Synthetic Research Assistant",
      roleCategory: null, functionArea: null, location: null, organisationId: null, startYear: 2023, endYear: null },
    unresolved: [{ field: "temporalStatus", reason: "MISSING" }, { field: "endYear", reason: "MISSING" },
      { field: "catalogAssociation", reason: "UNKNOWN" }] },
  unreviewedExpected.stations[1],
  { sourceKey: "snapshot:2:0", kind: "REVIEW_REQUIRED", unresolved: [{ field: "position", reason: "MISSING" }] },
  unreviewedExpected.stations[3],
] };

export const uncertainDegreeUpdates: ExplicitReviewUpdates = { updates: [
  { sourceKey: "snapshot:2:0", classification: { type: "DEGREE", level: "MASTER" }, position: 1 },
] };
export const uncertainDegreeExpected: NormalizationResult = { stations: [
  unreviewedExpected.stations[0], unreviewedExpected.stations[1],
  { sourceKey: "snapshot:2:0", kind: "RESOLVED_DEGREE", position: 1,
    canonical: { level: "MASTER", status: "UNKNOWN", title: "Synthetic M.Sc.", fieldOfStudy: null,
      programId: null, institutionId: null, startYear: 2019, endYear: null, graduationYear: null },
    unresolved: [{ field: "status", reason: "MISSING" }, { field: "endYear", reason: "STATUS_UNCERTAIN" },
      { field: "graduationYear", reason: "MISSING" }, { field: "catalogAssociation", reason: "UNKNOWN" }] },
  unreviewedExpected.stations[3],
] };
