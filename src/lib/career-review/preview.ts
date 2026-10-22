import type { NormalizationInput, NormalizationResult, StationClassification } from "../normalization/contract";
import { applyExplicitReviewAssertions } from "../normalization/apply-explicit-review-assertions";
import { normalizeCareerBatch } from "../normalization/normalize-career-batch";
import { validateNormalizationContract } from "../normalization/validate";

export type ReviewDraft = { classification: string; status: string; position: string };
export type ReviewDrafts = Readonly<Record<string, ReviewDraft>>;
export type ReviewPreview = { ok: true; result: NormalizationResult } | { ok: false; message: string };

type ClassificationChoice = { value: string; label: string; classification: StationClassification };
export const classificationChoices: ClassificationChoice[] = [
  { value: "DEGREE:BACHELOR", label: "Bachelor", classification: { type: "DEGREE", level: "BACHELOR" } },
  { value: "DEGREE:MASTER", label: "Master", classification: { type: "DEGREE", level: "MASTER" } },
  { value: "DEGREE:PHD", label: "Promotion", classification: { type: "DEGREE", level: "PHD" } },
  { value: "DEGREE:DIPLOMA", label: "Diplom", classification: { type: "DEGREE", level: "DIPLOMA" } },
  { value: "DEGREE:CERTIFICATE", label: "Eigenständiges akademisches Zertifikat", classification: { type: "DEGREE", level: "CERTIFICATE" } },
  { value: "DEGREE:OTHER", label: "Anderer akademischer Abschluss", classification: { type: "DEGREE", level: "OTHER" } },
  { value: "CAREER_STEP:EMPLOYMENT", label: "Beschäftigung", classification: { type: "CAREER_STEP", careerStepType: "EMPLOYMENT" } },
  { value: "CAREER_STEP:INTERNSHIP", label: "Praktikum", classification: { type: "CAREER_STEP", careerStepType: "INTERNSHIP" } },
  { value: "CAREER_STEP:EDUCATION", label: "Kurs oder Austausch ohne eigenen Abschluss", classification: { type: "CAREER_STEP", careerStepType: "EDUCATION" } },
  { value: "CAREER_STEP:VOCATIONAL_TRAINING", label: "Berufsausbildung", classification: { type: "CAREER_STEP", careerStepType: "VOCATIONAL_TRAINING" } },
  { value: "CAREER_STEP:VOLUNTEERING", label: "Ehrenamt", classification: { type: "CAREER_STEP", careerStepType: "VOLUNTEERING" } },
  { value: "CAREER_STEP:SELF_EMPLOYMENT", label: "Selbstständigkeit", classification: { type: "CAREER_STEP", careerStepType: "SELF_EMPLOYMENT" } },
  { value: "CAREER_STEP:UNEMPLOYED", label: "Arbeitslosigkeit", classification: { type: "CAREER_STEP", careerStepType: "UNEMPLOYED" } },
  { value: "CAREER_STEP:OTHER", label: "Andere Tätigkeit", classification: { type: "CAREER_STEP", careerStepType: "OTHER" } },
];
export const degreeStatuses = [
  { value: "COMPLETED", label: "Abgeschlossen" }, { value: "IN_PROGRESS", label: "Noch im Studium" },
  { value: "ENDED_WITHOUT_DEGREE", label: "Ohne Abschluss beendet" }, { value: "UNKNOWN", label: "Unbekannt" },
];
export const careerStatuses = [
  { value: "ONGOING", label: "Laufend" }, { value: "ENDED", label: "Beendet" }, { value: "UNKNOWN", label: "Unbekannt" },
];
const invalidSelection = "Bitte prüfe deine Auswahl. Jede Reihenfolge darf nur einmal vergeben werden.";

/** Presentation helper for drafts against the unchanged observed snapshot.
 * No persisted state or confirmation proof. Every edit starts from input again.
 */
export function previewReview(input: NormalizationInput, drafts: ReviewDrafts): ReviewPreview {
  try {
    const known = new Set(input.stations.map(source => source.key));
    const updates: Record<string, unknown>[] = [];
    for (const [sourceKey, draft] of Object.entries(drafts)) {
      if (!known.has(sourceKey)) throw new Error();
      const update: Record<string, unknown> = { sourceKey };
      const choice = classificationChoices.find(c => c.value === draft.classification);
      if (draft.classification !== "" && !choice) throw new Error();
      if (choice) update.classification = choice.classification;
      if (draft.status !== "") {
        if (!choice) throw new Error();
        const degree = choice.classification.type === "DEGREE";
        if (!(degree ? degreeStatuses : careerStatuses).some(s => s.value === draft.status)) throw new Error();
        update[degree ? "degreeStatus" : "temporalStatus"] = draft.status;
      }
      const position = draft.position.trim();
      if (position !== "") {
        if (!/^[0-9]+$/.test(position) || !Number.isSafeInteger(Number(position)) || Number(position) < 1) {
          return { ok: false, message: "Bitte gib eine positive ganze Zahl für die Reihenfolge ein." };
        }
        update.position = Number(position);
      }
      if (Object.keys(update).length > 1) updates.push(update);
    }
    const enriched = applyExplicitReviewAssertions(input, { updates });
    const result = normalizeCareerBatch(enriched);
    if (!validateNormalizationContract(enriched, result).ok) throw new Error();
    return { ok: true, result };
  } catch {
    return { ok: false, message: invalidSelection };
  }
}
