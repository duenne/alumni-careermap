import { adaptLinkedInSnapshot } from "../normalization/adapt-linkedin-snapshot";
import { applyExplicitReviewAssertions } from "../normalization/apply-explicit-review-assertions";
import { normalizeCareerBatch } from "../normalization/normalize-career-batch";
import { classificationChoices, degreeStatuses, careerStatuses } from "../career-review/preview";
import type { StationOutcome } from "../normalization/contract";
import type { SnapshotProjection } from "../dev-import/json-preview";
import { isNoSnapshotData } from "../dev-import/linkedin/no-data";

export type ImportReview = { sourceKey: string; classification: string; status: string; position: number; catalog: string };
type ResolvedCareer = Extract<StationOutcome, { kind: "RESOLVED_CAREER_STEP" }>;
export type MappedStation = Extract<StationOutcome, { kind: "RESOLVED_DEGREE" }>
  | (Omit<ResolvedCareer, "canonical"> & { canonical: Omit<ResolvedCareer["canonical"], "location"> & { location: string | null } });
export class CareerImportError extends Error {
  constructor(readonly code: "INVALID_SOURCE" | "INCOMPLETE_SOURCE" | "INVALID_REVIEW" | "UNRESOLVED_STATION" | "CONFIRMATION_REQUIRED" | "INVALID_REFERENCE" | "INVALID_CATALOG" = "INVALID_SOURCE") {
    super(code); this.name = "CareerImportError";
  }
}
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const fail = (code: ConstructorParameters<typeof CareerImportError>[0] = "INVALID_SOURCE"): never => { throw new CareerImportError(code); };
export const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const fields = { EDUCATION: ["Degree Name", "School Name", "Start Date", "End Date"], POSITIONS: ["Title", "Company Name", "Started On", "Finished On", "Location"] };
export const cleanText = (value: string): string => value.normalize("NFC").trim();

/** Supports the combined fixture envelope and the bounded live diagnosis.
 * The latter is accepted only with a demonstrated end for BOTH domains.
 * PROFILE, IDs, descriptions, credentials and unknown fields never leave here.
 */
export function readCareerSnapshot(value: unknown): SnapshotProjection {
  if (!record(value)) return fail();
  let elements: unknown = value.elements;
  if (value.kind === "linkedin-raw-preview") {
    if (!Array.isArray(value.domains) || value.domains.length !== 2) return fail("INCOMPLETE_SOURCE");
    elements = value.domains.map(capture => {
      if (!record(capture) || !["EDUCATION", "POSITIONS"].includes(String(capture.domain)) || !Array.isArray(capture.pages)
        || capture.pages.length === 0 || !["HTTP_ERROR", "NO_PAGING"].includes(String(capture.stopped))) return fail("INCOMPLETE_SOURCE");
      const rows: unknown[] = [];
      let ended = false;
      for (const [index, page] of capture.pages.entries()) {
        if (ended || !record(page) || page.page !== index || !record(page.body)) return fail("INCOMPLETE_SOURCE");
        if (page.status === 404 && index > 0 && page.requestKind === "probe" && isNoSnapshotData(page.body)) { ended = true; continue; }
        if (page.status !== 200 || !Array.isArray(page.body.elements) || page.body.elements.length !== 1) return fail("INCOMPLETE_SOURCE");
        const element = page.body.elements[0];
        if (!record(element) || element.snapshotDomain !== capture.domain || !Array.isArray(element.snapshotData)) return fail();
        rows.push(...element.snapshotData);
        if (page.body.paging === undefined && capture.stopped === "NO_PAGING") ended = true;
        else if (!record(page.body.paging) || page.body.paging.start !== index) return fail("INCOMPLETE_SOURCE");
      }
      if (!ended) return fail("INCOMPLETE_SOURCE");
      return { snapshotDomain: capture.domain, snapshotData: rows };
    });
  }
  if (!Array.isArray(elements) || elements.length < 2 || elements.length > 3) return fail();
  const domains = new Map<string, Record<string, string>[]>();
  for (const element of elements) {
    if (!record(element) || typeof element.snapshotDomain !== "string" || domains.has(element.snapshotDomain)) return fail();
    if (element.snapshotDomain === "PROFILE") { domains.set("PROFILE", [{}]); continue; }
    if (element.snapshotDomain !== "EDUCATION" && element.snapshotDomain !== "POSITIONS" || !Array.isArray(element.snapshotData) || element.snapshotData.length > 1000) return fail();
    const names = fields[element.snapshotDomain];
    domains.set(element.snapshotDomain, element.snapshotData.map(row => {
      if (!record(row) || !names.slice(0, 2).some(name => Object.hasOwn(row, name))) return fail();
      return Object.fromEntries(names.map(name => {
        const text = row[name] ?? "";
        if (typeof text !== "string" || text.length > 10_000) return fail();
        return [name, cleanText(text)];
      }));
    }));
  }
  if (!domains.has("EDUCATION") || !domains.has("POSITIONS")) return fail();
  return { elements: ["PROFILE", "POSITIONS", "EDUCATION"].map(domain => ({ snapshotDomain: domain as SnapshotProjection["elements"][number]["snapshotDomain"], snapshotData: domains.get(domain) ?? [{}] })) };
}

export function sourceRows(snapshot: SnapshotProjection) {
  return snapshot.elements.flatMap((element, index) => element.snapshotDomain === "PROFILE" ? [] : element.snapshotData.map((row, i) => ({
    sourceKey: `snapshot:${index}:${i}`, domain: element.snapshotDomain,
    title: row[element.snapshotDomain === "EDUCATION" ? "Degree Name" : "Title"],
    provider: row[element.snapshotDomain === "EDUCATION" ? "School Name" : "Company Name"],
    start: row[element.snapshotDomain === "EDUCATION" ? "Start Date" : "Started On"],
    end: row[element.snapshotDomain === "EDUCATION" ? "End Date" : "Finished On"],
    location: row.Location ?? "",
  })));
}

/** Editable hints only. No academic completion or ongoing activity is inferred. */
export function suggestReviews(snapshot: SnapshotProjection): ImportReview[] {
  return sourceRows(snapshot).map((source, index) => {
    const title = source.title;
    let classification = "";
    if (source.domain === "EDUCATION") {
      if (/\b(ph\.?d\.?|doctor|promotion)/i.test(title)) classification = "DEGREE:PHD";
      else if (/\b(master|m\.\s*sc\.?|m\.\s*a\.?)/i.test(title)) classification = "DEGREE:MASTER";
      else if (/\b(bachelor|b\.\s*sc\.?|b\.\s*a\.?)/i.test(title)) classification = "DEGREE:BACHELOR";
      else if (/\b(ausbildung|vocational)/i.test(title)) classification = "CAREER_STEP:VOCATIONAL_TRAINING";
    } else if (/\b(internship|intern|praktik)/i.test(title)) classification = "CAREER_STEP:INTERNSHIP";
    else if (/\b(founder|self.employed|freelance|selbst)/i.test(title)) classification = "CAREER_STEP:SELF_EMPLOYMENT";
    else if (/\b(volunteer|ehrenamt)/i.test(title)) classification = "CAREER_STEP:VOLUNTEERING";
    else classification = "CAREER_STEP:EMPLOYMENT";
    return { sourceKey: source.sourceKey, classification, status: "UNKNOWN", position: index + 1, catalog: "UNKNOWN" };
  });
}

/** Server and browser recompute the same canonical values from the current
 * source plus explicit review. No client-supplied canonical objects are trusted.
 */
export function mapCareerImport(snapshot: SnapshotProjection, reviews: unknown): { stations: MappedStation[] } {
  const input = adaptLinkedInSnapshot(snapshot);
  if (!Array.isArray(reviews) || reviews.length !== input.stations.length || reviews.length === 0) return fail("INVALID_REVIEW");
  const seen = new Set<string>();
  const updates = reviews.map(review => {
    if (!record(review) || Object.keys(review).length !== 5 || !["sourceKey", "classification", "status", "position", "catalog"].every(key => Object.hasOwn(review, key))
      || typeof review.sourceKey !== "string" || seen.has(review.sourceKey)) return fail("INVALID_REVIEW");
    seen.add(review.sourceKey);
    const choice = classificationChoices.find(c => c.value === review.classification);
    if (!choice) return fail("INVALID_REVIEW");
    const degree = choice.classification.type === "DEGREE";
    if (!(degree ? degreeStatuses : careerStatuses).some(status => status.value === review.status)) return fail("INVALID_REVIEW");
    const catalog = review.catalog;
    if (typeof catalog !== "string") return fail("INVALID_CATALOG");
    const [entity, id, extra] = catalog.split(":");
    if (!["UNKNOWN", "CREATE"].includes(catalog) && (!uuid(id) || extra !== undefined || !(degree ? ["PROGRAM", "INSTITUTION"] : ["ORGANISATION"]).includes(entity))) return fail("INVALID_CATALOG");
    const catalogSelection = uuid(id) ? { identity: { entity, id: id.toLowerCase() }, confirmation: "EXPLICIT_SELECTION" } : undefined;
    return { sourceKey: review.sourceKey, classification: choice.classification, [degree ? "degreeStatus" : "temporalStatus"]: review.status, position: review.position, ...(catalogSelection ? { catalogSelection } : {}) };
  });
  try {
    const enriched = applyExplicitReviewAssertions(input, { updates });
    const result = normalizeCareerBatch(enriched);
    if (result.stations.some(station => station.kind === "REVIEW_REQUIRED")) return fail("UNRESOLVED_STATION");
    const rows = sourceRows(snapshot);
    // E.1's original contract has no location fact. This import boundary adds
    // only the dedicated, allowlisted Location observation, never descriptions
    // or intermediate branch/role/category hints. The preview is the write plan.
    return { stations: result.stations.map(station => {
      if (station.kind === "REVIEW_REQUIRED") return fail("UNRESOLVED_STATION");
      return station.kind === "RESOLVED_DEGREE" ? station : { ...station, canonical: {
        ...station.canonical, location: rows.find(row => row.sourceKey === station.sourceKey)?.location || null,
      } };
    }) };
  } catch (error) { if (error instanceof CareerImportError) throw error; return fail("INVALID_REVIEW"); }
}
