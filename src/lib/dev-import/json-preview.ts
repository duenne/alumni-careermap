import { adaptLinkedInSnapshot } from "../normalization/adapt-linkedin-snapshot";
import type { NormalizationInput, NormalizationResult } from "../normalization/contract";
import { normalizeCareerBatch } from "../normalization/normalize-career-batch";

type Domain = "PROFILE" | "POSITIONS" | "EDUCATION";
export type SnapshotProjection = { elements: { snapshotDomain: Domain; snapshotData: Record<string, string>[] }[] };
export type EditorPreview = { ok: true; json: string; input: NormalizationInput; result: NormalizationResult; counts: { education: number; positions: number } }
  | { ok: false; message: string };

/** Allowlist projection only. Shape/date validation stays in the existing adapter.
 * PROFILE is a deliberately empty envelope required by that adapter, not a fetch.
 */
export function projectSnapshot(value: unknown): SnapshotProjection {
  adaptLinkedInSnapshot(value);
  const snapshot = value as SnapshotProjection;
  return { elements: snapshot.elements.map(element => ({
    snapshotDomain: element.snapshotDomain,
    snapshotData: element.snapshotDomain === "PROFILE" ? [{}] : element.snapshotData.map(item => Object.fromEntries(
      (element.snapshotDomain === "POSITIONS"
        ? ["Title", "Company Name", "Started On", "Finished On"]
        : ["Degree Name", "School Name", "Start Date", "End Date"])
        .map(field => [field, item[field]]),
    )),
  })) };
}

export function parseEditor(text: string): EditorPreview {
  if (text.length > 200_000) return { ok: false, message: "Das JSON ist zu groß (maximal 200.000 Zeichen)." };
  let value: unknown;
  try { value = JSON.parse(text); }
  catch { return { ok: false, message: "Ungültiges JSON. Bitte prüfen Sie die Syntax." }; }
  try {
    const projected = projectSnapshot(value);
    const input = adaptLinkedInSnapshot(projected);
    const result = normalizeCareerBatch(input);
    return {
      ok: true, json: JSON.stringify(projected, null, 2), input, result,
      counts: {
        education: input.stations.filter(station => station.category.kind === "OBSERVED" && station.category.value === "EDUCATION").length,
        positions: input.stations.filter(station => station.category.kind === "OBSERVED" && station.category.value === "POSITIONS").length,
      },
    };
  } catch {
    return { ok: false, message: "Snapshot-Struktur ungültig. Benötigt werden PROFILE, POSITIONS und EDUCATION im Beispiel-Format mit Textfeldern; PROFILE darf ein leeres Objekt enthalten." };
  }
}
