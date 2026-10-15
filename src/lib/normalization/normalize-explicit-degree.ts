import type { SourceDate, SourceFact, SourceStation, StationOutcome, UnresolvedDecision } from "./contract";
import { validateNormalizationContract } from "./validate";

export type DegreeNormalizationOutcome = Extract<StationOutcome, { kind: "RESOLVED_DEGREE" | "REVIEW_REQUIRED" }>;

const supplied = <T>(fact: SourceFact<T>): fact is { kind: "OBSERVED" | "ASSERTED"; value: T } =>
  fact.kind === "OBSERVED" || fact.kind === "ASSERTED";
const exactYear = (fact: SourceFact<SourceDate>): number | null =>
  supplied(fact) && fact.value.precision !== "IMPRECISE" ? fact.value.year : null;

/** Pure projection of an E.1 source station. Assertions/confirmations are caller
 * claims; labels are never classification, catalog or reference evidence.
 * Invalid E.1 source shapes throw a fixed error; valid but unsafe facts require
 * target-free review. Does not mutate input or parse/normalize source text.
 */
export function normalizeExplicitDegree(source: SourceStation): DegreeNormalizationOutcome {
  if (source === null || source === undefined) throw new Error("Invalid source-neutral station contract");
  const review = (...unresolved: [UnresolvedDecision, ...UnresolvedDecision[]]): DegreeNormalizationOutcome =>
    ({ sourceKey: source.key, kind: "REVIEW_REQUIRED", unresolved });
  const valid = (outcome: DegreeNormalizationOutcome) => validateNormalizationContract(
    { stations: [source] }, { stations: [outcome] },
  ).ok;
  // E.1 exposes a combined validator. A target-free outcome checks source shape
  // without asserting canonical facts or needing another validation API.
  const classificationReview = review({ field: "classification", reason: "CLASSIFICATION_UNCERTAIN" });
  if (!valid(classificationReview)) throw new Error("Invalid source-neutral station contract");
  const checked = (outcome: DegreeNormalizationOutcome): DegreeNormalizationOutcome => {
    if (!valid(outcome)) throw new Error("Degree normalization violated E.1 contract");
    return outcome;
  };
  const classification = source.classification;
  if (classification.kind !== "ASSERTED" || classification.value.type !== "DEGREE") return classificationReview;
  if (source.position.kind !== "ASSERTED") return checked(review({ field: "position", reason: source.position.kind }));
  if (source.temporalStatus.kind === "ASSERTED") return checked(review({ field: "temporalStatus", reason: "CONFLICTING_FACTS" }));
  if (source.catalog.kind === "CONFIRMED" && source.catalog.identity.entity === "ORGANISATION") {
    return checked(review({ field: "catalogAssociation", reason: "CONFLICTING_FACTS" }));
  }

  const level = classification.value.level;
  const title = supplied(source.title) ? source.title.value : null;
  if ((level === "DIPLOMA" || level === "OTHER") && !supplied(source.title)) {
    return checked(review({ field: "title", reason: source.title.kind }));
  }
  const status = source.degreeStatus.kind === "ASSERTED" ? source.degreeStatus.value : "UNKNOWN";
  if (status === "IN_PROGRESS" && supplied(source.end)) return checked(review({ field: "endYear", reason: "CONFLICTING_FACTS" }));
  if ((status === "IN_PROGRESS" || status === "ENDED_WITHOUT_DEGREE") && supplied(source.graduation)) {
    return checked(review({ field: "graduationYear", reason: "CONFLICTING_FACTS" }));
  }
  // Check precise source bounds before status-dependent withholding. Unknown
  // status must not conceal a reversed interval or contradictory award year.
  const start = exactYear(source.start);
  const end = exactYear(source.end);
  const graduation = exactYear(source.graduation);
  if (start !== null && end !== null && start > end) return checked(review(
    { field: "startYear", reason: "CONFLICTING_FACTS" }, { field: "endYear", reason: "CONFLICTING_FACTS" },
  ));
  if (graduation !== null && ((start !== null && graduation < start) || (end !== null && graduation < end))) {
    return checked(review({ field: "graduationYear", reason: "CONFLICTING_FACTS" }));
  }

  const unresolved: UnresolvedDecision[] = [];
  if (status === "UNKNOWN") unresolved.push({ field: "status", reason: source.degreeStatus.kind === "MISSING" ? "MISSING" : "UNKNOWN" });
  if (!supplied(source.title)) unresolved.push({ field: "title", reason: source.title.kind });
  const projectYear = (fact: SourceFact<SourceDate>, field: "startYear" | "endYear" | "graduationYear", withhold = false): number | null => {
    if (!supplied(fact)) { unresolved.push({ field, reason: fact.kind }); return null; }
    if (fact.value.precision === "IMPRECISE") { unresolved.push({ field, reason: "IMPRECISE_DATE" }); return null; }
    if (withhold) { unresolved.push({ field, reason: "STATUS_UNCERTAIN" }); return null; }
    return fact.value.year;
  };
  const startYear = projectYear(source.start, "startYear");
  const endYear = projectYear(source.end, "endYear", status === "UNKNOWN");
  const graduationYear = projectYear(source.graduation, "graduationYear", status !== "COMPLETED");
  const catalog = source.catalog;
  if (catalog.kind !== "CONFIRMED") unresolved.push({ field: "catalogAssociation", reason: catalog.kind === "CANDIDATE" ? "CATALOG_UNCONFIRMED" : "UNKNOWN" });
  const association = catalog.kind === "CONFIRMED" && catalog.identity.entity === "PROGRAM"
    ? { programId: catalog.identity.id, institutionId: null }
    : { programId: null, institutionId: catalog.kind === "CONFIRMED" ? catalog.identity.id : null };
  return checked({
    sourceKey: source.key, kind: "RESOLVED_DEGREE", position: source.position.value,
    canonical: { level, status, title, fieldOfStudy: null, ...association, startYear, endYear, graduationYear },
    unresolved,
  });
}
