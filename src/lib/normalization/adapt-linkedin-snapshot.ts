import type { NormalizationInput, SourceDate, SourceFact, SourceStation, StationOutcome } from "./contract";
import { validateNormalizationContract } from "./validate";

const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const keys = (v: Record<string, unknown>, required: string[]) =>
  Object.keys(v).length === required.length && required.every(key => Object.hasOwn(v, key));
function invalid(): never { throw new Error("Invalid LinkedIn-shaped snapshot contract"); }
const missing = () => ({ kind: "MISSING" }) as const;
const observed = <T>(value: T) => ({ kind: "OBSERVED", value }) as const;
const text = (value: string): SourceFact<string> => /\S/u.test(value) ? observed(value) : missing();
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function date(value: string): SourceFact<SourceDate> {
  const trimmed = value.trim();
  if (trimmed === "") return missing();
  if (/^[0-9]{4}$/.test(trimmed) && Number(trimmed) >= 1) {
    return observed({ precision: "YEAR", year: Number(trimmed) });
  }
  const match = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) ([0-9]{4})$/.exec(trimmed);
  if (match && Number(match[2]) >= 1) {
    return observed({ precision: "MONTH", year: Number(match[2]), month: months.indexOf(match[1]) + 1 });
  }
  return observed({ precision: "IMPRECISE", text: trimmed });
}

/** Observations only, for parsed JSON-like values in the documented example
 * envelope. PROFILE and extra station fields are opaque. No classification,
 * status, timeline or catalog inference; no source text in errors.
 */
export function adaptLinkedInSnapshot(snapshot: unknown): NormalizationInput {
  if (!record(snapshot) || !keys(snapshot, ["elements"]) || !Array.isArray(snapshot.elements) || snapshot.elements.length !== 3) invalid();
  const seen = new Set<string>();
  const stations: SourceStation[] = [];
  for (const [elementIndex, element] of snapshot.elements.entries()) {
    if (!record(element) || !keys(element, ["snapshotDomain", "snapshotData"])) invalid();
    const domain = element.snapshotDomain;
    if (domain !== "PROFILE" && domain !== "POSITIONS" && domain !== "EDUCATION") invalid();
    if (seen.has(domain) || !Array.isArray(element.snapshotData)) invalid();
    seen.add(domain);
    if (domain === "PROFILE") {
      if (element.snapshotData.length !== 1 || !record(element.snapshotData[0])) invalid();
      continue; // Never enumerate or access PROFILE properties.
    }
    const fields = domain === "POSITIONS"
      ? ["Title", "Company Name", "Started On", "Finished On"] as const
      : ["Degree Name", "School Name", "Start Date", "End Date"] as const;
    for (const [recordIndex, item] of element.snapshotData.entries()) {
      if (!record(item)) invalid();
      const values = fields.map(field => Object.hasOwn(item, field) ? item[field] : undefined);
      if (!values.every((value): value is string => typeof value === "string")) invalid();
      stations.push({
        key: `snapshot:${elementIndex}:${recordIndex}`,
        title: text(values[0]), category: observed(domain), providerLabel: text(values[1]),
        start: date(values[2]), end: date(values[3]), graduation: missing(),
        classification: missing(), degreeStatus: missing(), temporalStatus: missing(),
        position: missing(), catalog: { kind: "UNKNOWN" },
      });
    }
  }
  // Three unique supported domains above imply exactly one of each. E.1 only
  // exposes combined validation, so supply target-free reviews as in E.2/E.3a.
  const input: NormalizationInput = { stations };
  const reviews: StationOutcome[] = stations.map(source => ({
    sourceKey: source.key, kind: "REVIEW_REQUIRED",
    unresolved: [{ field: "classification", reason: "CLASSIFICATION_UNCERTAIN" }],
  }));
  if (!validateNormalizationContract(input, { stations: reviews }).ok) invalid();
  return input;
}
