import type { NormalizationInput, NormalizationResult, StationOutcome } from "./contract";
import { normalizeExplicitDegree } from "./normalize-explicit-degree";
import { normalizeExplicitCareerStep } from "./normalize-explicit-career-step";
import { validateNormalizationContract } from "./validate";

/** Pure composition of E.2 station normalizers. Source array order is retained;
 * canonical values and decisions are passed through unchanged. No batch repair.
 */
export function normalizeCareerBatch(input: NormalizationInput): NormalizationResult {
  if (input === null || typeof input !== "object" || Array.isArray(input) || !Array.isArray(input.stations)) {
    throw new Error("Invalid source-neutral batch contract");
  }
  // As in E.2, target-free reviews let the combined E.1 validator check every
  // source before dispatch. Array.from also exposes sparse/missing entries.
  const reviews = Array.from(input.stations, (source): StationOutcome => ({
    sourceKey: source?.key, kind: "REVIEW_REQUIRED",
    unresolved: [{ field: "classification", reason: "CLASSIFICATION_UNCERTAIN" }],
  }));
  if (!validateNormalizationContract(input, { stations: reviews }).ok) {
    throw new Error("Invalid source-neutral batch contract");
  }
  try {
    const result: NormalizationResult = { stations: input.stations.map((source, index) => {
      const classification = source.classification;
      if (classification.kind !== "ASSERTED") return reviews[index];
      return classification.value.type === "DEGREE"
        ? normalizeExplicitDegree(source)
        : normalizeExplicitCareerStep(source);
    }) };
    if (validateNormalizationContract(input, result).ok) return result;
  } catch {
    // Never forward delegate errors, source values or exception causes.
  }
  throw new Error("Career batch normalization violated E.1 contract");
}
