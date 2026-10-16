import type { SourceDate, SourceFact, SourceStation, StationOutcome, UnresolvedDecision } from "./contract";
import { validateNormalizationContract } from "./validate";

export type CareerStepNormalizationOutcome = Extract<StationOutcome, { kind: "RESOLVED_CAREER_STEP" | "REVIEW_REQUIRED" }>;

const supplied = <T>(fact: SourceFact<T>): fact is { kind: "OBSERVED" | "ASSERTED"; value: T } =>
  fact.kind === "OBSERVED" || fact.kind === "ASSERTED";
const exactYear = (fact: SourceFact<SourceDate>): number | null =>
  supplied(fact) && fact.value.precision !== "IMPRECISE" ? fact.value.year : null;

/** Pure projection of one E.1 station, without classification or catalog
 * inference. Malformed source values throw a fixed error; valid but unsafe
 * evidence produces target-free review. Assertions remain caller claims.
 */
export function normalizeExplicitCareerStep(source: SourceStation): CareerStepNormalizationOutcome {
  if (source === null || typeof source !== "object" || Array.isArray(source)) throw new Error("Invalid source-neutral station contract");
  const review = (...unresolved: [UnresolvedDecision, ...UnresolvedDecision[]]): CareerStepNormalizationOutcome =>
    ({ sourceKey: source.key, kind: "REVIEW_REQUIRED", unresolved });
  const valid = (outcome: CareerStepNormalizationOutcome) => validateNormalizationContract(
    { stations: [source] }, { stations: [outcome] },
  ).ok;
  // Mirror E.2a: use E.1's combined validator with a target-free outcome to
  // check source shape before interpreting any canonical facts.
  const classificationReview = review({ field: "classification", reason: "CLASSIFICATION_UNCERTAIN" });
  if (!valid(classificationReview)) throw new Error("Invalid source-neutral station contract");
  const checked = (outcome: CareerStepNormalizationOutcome): CareerStepNormalizationOutcome => {
    if (!valid(outcome)) throw new Error("CareerStep normalization violated E.1 contract");
    return outcome;
  };
  const classification = source.classification;
  if (classification.kind !== "ASSERTED" || classification.value.type !== "CAREER_STEP") return classificationReview;
  if (source.position.kind !== "ASSERTED") return checked(review({ field: "position", reason: source.position.kind }));
  if (source.degreeStatus.kind === "ASSERTED") return checked(review({ field: "status", reason: "CONFLICTING_FACTS" }));
  if (supplied(source.graduation)) return checked(review({ field: "graduationYear", reason: "CONFLICTING_FACTS" }));
  if (source.catalog.kind === "CONFIRMED" && source.catalog.identity.entity !== "ORGANISATION") {
    return checked(review({ field: "catalogAssociation", reason: "CONFLICTING_FACTS" }));
  }

  const type = classification.value.careerStepType;
  const roleTitle = supplied(source.title) ? source.title.value : null;
  if (type === "OTHER" && !supplied(source.title)) return checked(review({ field: "roleTitle", reason: source.title.kind }));
  const temporalStatus = source.temporalStatus.kind === "ASSERTED" ? source.temporalStatus.value : "UNKNOWN";
  if (temporalStatus === "ONGOING" && supplied(source.end)) return checked(review({ field: "endYear", reason: "CONFLICTING_FACTS" }));
  // Validate precise source year order before UNKNOWN can withhold the end.
  const start = exactYear(source.start);
  const end = exactYear(source.end);
  if (start !== null && end !== null && start > end) return checked(review(
    { field: "startYear", reason: "CONFLICTING_FACTS" }, { field: "endYear", reason: "CONFLICTING_FACTS" },
  ));

  const unresolved: UnresolvedDecision[] = [];
  if (temporalStatus === "UNKNOWN") unresolved.push({ field: "temporalStatus", reason: source.temporalStatus.kind === "MISSING" ? "MISSING" : "UNKNOWN" });
  if (!supplied(source.title)) unresolved.push({ field: "roleTitle", reason: source.title.kind });
  const projectYear = (fact: SourceFact<SourceDate>, field: "startYear" | "endYear", withhold = false): number | null => {
    if (!supplied(fact)) { unresolved.push({ field, reason: fact.kind }); return null; }
    if (fact.value.precision === "IMPRECISE") { unresolved.push({ field, reason: "IMPRECISE_DATE" }); return null; }
    if (withhold) { unresolved.push({ field, reason: "STATUS_UNCERTAIN" }); return null; }
    return fact.value.year;
  };
  const startYear = projectYear(source.start, "startYear");
  const endYear = projectYear(source.end, "endYear", temporalStatus === "UNKNOWN");
  const catalog = source.catalog;
  if (catalog.kind !== "CONFIRMED") unresolved.push({ field: "catalogAssociation", reason: catalog.kind === "CANDIDATE" ? "CATALOG_UNCONFIRMED" : "UNKNOWN" });
  return checked({
    sourceKey: source.key, kind: "RESOLVED_CAREER_STEP", position: source.position.value,
    canonical: {
      type, temporalStatus, roleTitle, roleCategory: null, functionArea: null, location: null,
      organisationId: catalog.kind === "CONFIRMED" ? catalog.identity.id : null, startYear, endYear,
    },
    unresolved,
  });
}
