import type { CatalogIdentity, NormalizationInput, SourceStation, SourceStationKey, StationClassification, StationOutcome } from "./contract";
import { normalizeCareerBatch } from "./normalize-career-batch";
import { validateNormalizationContract } from "./validate";

type ReviewAssertionFields = {
  classification: StationClassification;
  degreeStatus: Extract<SourceStation["degreeStatus"], { kind: "ASSERTED" }>["value"];
  temporalStatus: Extract<SourceStation["temporalStatus"], { kind: "ASSERTED" }>["value"];
  position: number;
  catalogSelection: { identity: CatalogIdentity; confirmation: "EXPLICIT_SELECTION" };
};
type AtLeastOne<T> = { [K in keyof T]: Pick<T, K> & Partial<Omit<T, K>> }[keyof T];
export type ExplicitReviewUpdate = { sourceKey: SourceStationKey } & AtLeastOne<ReviewAssertionFields>;
export type ExplicitReviewUpdates = { updates: ExplicitReviewUpdate[] };

const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const exactKeys = (v: Record<string, unknown>, keys: string[]) =>
  Object.keys(v).length === keys.length && keys.every(key => Object.hasOwn(v, key));
const assertionFields = ["classification", "degreeStatus", "temporalStatus", "position"] as const;
const allowedFields = ["sourceKey", ...assertionFields, "catalogSelection"];
function invalidInput(): never { throw new Error("Invalid source-neutral review input"); }
function invalidUpdate(): never { throw new Error("Invalid explicit review assertions"); }
function invalidBatch(): never { throw new Error("Review assertions violated normalization contract"); }

// E.1 exposes combined validation; target-free reviews check input shape and
// source-key uniqueness without making canonical claims or hiding conflicts.
function validInput(value: unknown): value is NormalizationInput {
  if (!record(value) || !Array.isArray(value.stations)) return false;
  const reviews = Array.from(value.stations, (source): StationOutcome => ({
    sourceKey: source?.key, kind: "REVIEW_REQUIRED",
    unresolved: [{ field: "classification", reason: "CLASSIFICATION_UNCERTAIN" }],
  }));
  return validateNormalizationContract(value, { stations: reviews }).ok;
}

/** Add claims to absent assertion fields only. This is not proof of human
 * confirmation, authorization, provenance or catalog existence. Observations
 * stay unchanged; E.2/E.3a decide whether claims permit canonical resolution.
 */
export function applyExplicitReviewAssertions(input: NormalizationInput, updates: unknown): NormalizationInput {
  if (!validInput(input)) invalidInput();
  if (!record(updates) || !exactKeys(updates, ["updates"]) || !Array.isArray(updates.updates)) invalidUpdate();
  const sources = new Map(input.stations.map(source => [source.key, source]));
  const changes = new Map<string, Record<string, unknown>>();
  for (const update of updates.updates) {
    if (!record(update) || !Object.hasOwn(update, "sourceKey") || typeof update.sourceKey !== "string"
      || Object.keys(update).length < 2 || !Object.keys(update).every(key => allowedFields.includes(key))) invalidUpdate();
    const source = sources.get(update.sourceKey);
    if (!source || changes.has(update.sourceKey)) invalidUpdate();
    const enriched: Record<string, unknown> = { ...source };
    for (const field of assertionFields) {
      if (!Object.hasOwn(update, field)) continue;
      // Reject replay too. Revising assertions is a separate review workflow.
      if (source[field].kind === "ASSERTED") invalidUpdate();
      enriched[field] = { kind: "ASSERTED", value: update[field] };
    }
    if (Object.hasOwn(update, "catalogSelection")) {
      const claim = update.catalogSelection;
      if (source.catalog.kind === "CONFIRMED" || !record(claim)
        || !exactKeys(claim, ["identity", "confirmation"]) || claim.confirmation !== "EXPLICIT_SELECTION") invalidUpdate();
      enriched.catalog = { kind: "CONFIRMED", identity: claim.identity, confirmation: "EXPLICIT_SELECTION" };
    }
    changes.set(update.sourceKey, enriched);
  }
  const enriched = { stations: input.stations.map(source => changes.get(source.key) ?? source) };
  // E.1 supplies the enum, UUID, positive integer and exact nested-shape checks.
  if (!validInput(enriched)) invalidUpdate();
  const positions = new Set<number>();
  for (const source of enriched.stations) {
    if (source.position.kind !== "ASSERTED") continue;
    // E.1 checks resolved positions only; reserve all asserted source positions
    // here, including positions on target-free reviews and unchanged stations.
    if (positions.has(source.position.value)) invalidBatch();
    positions.add(source.position.value);
  }
  const detached = structuredClone(enriched);
  try {
    const result = normalizeCareerBatch(detached);
    if (!validateNormalizationContract(detached, result).ok) invalidBatch();
  } catch {
    // Never forward downstream exceptions or their source-bearing causes.
    invalidBatch();
  }
  return detached;
}
