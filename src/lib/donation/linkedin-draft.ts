import { readCareerSnapshot, sourceRows, suggestReviews } from "../career-import/mapping";
import { adaptLinkedInSnapshot } from "../normalization/adapt-linkedin-snapshot";
import type { SourceDate, SourceFact } from "../normalization/contract";
import type { ManualStation } from "./manual";

const year = (fact: SourceFact<SourceDate>): number | null => (fact.kind === "OBSERVED" || fact.kind === "ASSERTED") && fact.value.precision !== "IMPRECISE" ? fact.value.year : null;
/** The existing provider projection and adapter feed the SAME editable form as
 * manual entry. Suggestions are drafts, never a catalog/reference confirmation.
 * Attendance end is not a graduation year. PROFILE and source payloads stop here. */
export function linkedInDraft(value: unknown): ManualStation[] {
  const snapshot = readCareerSnapshot(value), rows = sourceRows(snapshot);
  if (rows.length === 0 || rows.length > 50 || rows.some(row => [row.title, row.provider, row.location].some(text => text.length > 200))) throw new Error("IMPORT_FORM_LIMIT");
  const source = adaptLinkedInSnapshot(snapshot), reviews = suggestReviews(snapshot);
  return rows.map((row): ManualStation => {
    const facts = source.stations.find(station => station.key === row.sourceKey)!;
    const review = reviews.find(review => review.sourceKey === row.sourceKey)!;
    const academic = row.domain === "EDUCATION" && !review.classification.startsWith("CAREER_STEP:");
    const base = { key: row.sourceKey, title: row.title, startYear: year(facts.start), endYear: year(facts.end), status: academic && !review.classification.startsWith("DEGREE:") && year(facts.end) !== null ? "" : review.status };
    return academic ? { ...base, kind: "DEGREE", level: review.classification.split(":")[1] ?? "", program: "OTHER", institutionName: row.provider, fieldOfStudy: "", graduationYear: null }
      : { ...base, kind: "CAREER_STEP", type: review.classification.split(":")[1] ?? "", organisationName: row.provider, location: row.location };
  });
}
