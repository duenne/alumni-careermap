import type { CanonicalDegree, NormalizationInput, NormalizationResult } from "../../lib/normalization/contract";
import { applyExplicitReviewAssertions, type ExplicitReviewUpdate } from "../../lib/normalization/apply-explicit-review-assertions";
import { normalizeCareerBatch } from "../../lib/normalization/normalize-career-batch";
import { validateNormalizationContract } from "../../lib/normalization/validate";

export const degreeLevels = [
  { value: "BACHELOR", label: "Bachelor" }, { value: "MASTER", label: "Master" },
  { value: "PHD", label: "Promotion" }, { value: "DIPLOMA", label: "Diplom" },
  { value: "CERTIFICATE", label: "Akademisches Zertifikat" },
  { value: "OTHER", label: "Anderer akademischer Abschluss" },
] as const;
export const degreeStatuses = [
  { value: "IN_PROGRESS", label: "Noch im Studium" }, { value: "COMPLETED", label: "Abgeschlossen" },
  { value: "ENDED_WITHOUT_DEGREE", label: "Ohne Abschluss beendet" }, { value: "UNKNOWN", label: "Unbekannt" },
] as const;

export type DegreeReviewDraft = { classification: string; level: string; status: string };
export type ReviewedDegreeSelection = {
  level: CanonicalDegree["level"];
  status: CanonicalDegree["status"];
};
export type AppliedDegreeSelection = ReviewedDegreeSelection & { position: number };
export type DegreeReviewApplication =
  | { ok: true; selection: AppliedDegreeSelection; result: NormalizationResult }
  | { ok: false; field: keyof DegreeReviewDraft | "order" | "form"; message: string };

const failureMessage = "Der Entwurf konnte nicht geprüft werden. Bitte setzen Sie ihn zurück und versuchen Sie es erneut.";

/** Local decisions only: no source enrichment, position or canonical claim. */
export function reviewDegreeDraft(draft: DegreeReviewDraft):
  { ok: true; selection: ReviewedDegreeSelection } | Extract<DegreeReviewApplication, { ok: false }> {
  if (draft.classification !== "degree") return { ok: false, field: "classification", message: "Bitte wählen Sie die Art der Station ausdrücklich aus." };
  const level = degreeLevels.find(option => option.value === draft.level)?.value;
  if (!level) return { ok: false, field: "level", message: "Bitte wählen Sie eine Abschlussart aus." };
  const status = degreeStatuses.find(option => option.value === draft.status)?.value;
  if (!status) return { ok: false, field: "status", message: "Bitte wählen Sie einen Abschlussstatus aus. Unbekannt ist ebenfalls eine bewusste Auswahl." };
  return { ok: true, selection: { level, status } };
}
function positionUpdates(original: NormalizationInput, order: unknown): Array<{ sourceKey: string; position: number }> | null {
  const keys = new Set(original.stations.map(source => source.key));
  if (!Array.isArray(order) || order.length !== original.stations.length || new Set(order).size !== order.length
    || !order.every(key => typeof key === "string" && keys.has(key))) return null;
  return order.map((sourceKey: string, index) => ({ sourceKey, position: index + 1 }));
}
function normalizeUpdates(original: NormalizationInput, updates: ExplicitReviewUpdate[]): NormalizationResult {
  const enriched = applyExplicitReviewAssertions(original, { updates });
  const result = normalizeCareerBatch(enriched);
  if (!validateNormalizationContract(enriched, result).ok) throw new Error();
  return result;
}
export function applyTimelineOrder(original: NormalizationInput, order: unknown):
  { ok: true; result: NormalizationResult } | { ok: false; field: "order"; message: string } {
  const updates = positionUpdates(original, order);
  if (!updates) return { ok: false, field: "order", message: "Bitte übernehmen Sie die vollständige Reihenfolge ausdrücklich." };
  try { return { ok: true, result: normalizeUpdates(original, updates) }; }
  catch { return { ok: false, field: "order", message: failureMessage }; }
}

/** Every submission starts from original observations, never a previous enrichment. */
export function applyDegreeReviewDraft(
  original: NormalizationInput, sourceKey: string, draft: DegreeReviewDraft, confirmedOrder: readonly string[] | null,
): DegreeReviewApplication {
  const updates = positionUpdates(original, confirmedOrder);
  if (!updates) return { ok: false, field: "order", message: "Bitte übernehmen Sie zuerst die Reihenfolge für den Entwurf." };
  const review = reviewDegreeDraft(draft);
  if (!review.ok) return review;
  const { level, status } = review.selection;
  const selected = updates.find(update => update.sourceKey === sourceKey);
  if (!selected) return { ok: false, field: "form", message: failureMessage };
  const position = selected.position;
  try {
    const combined = updates.map(update => update === selected
      ? { ...update, classification: { type: "DEGREE" as const, level }, degreeStatus: status } : update);
    const result = normalizeUpdates(original, combined);
    return { ok: true, selection: { level, status, position }, result };
  } catch {
    return { ok: false, field: "form", message: failureMessage };
  }
}
