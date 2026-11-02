import { classificationChoices, degreeStatuses, careerStatuses } from "../career-review/preview";

type Station = { key: string; title: string; status: string; startYear: number | null; endYear: number | null };
export type ManualDegree = Station & { kind: "DEGREE"; level: string; program: "SURVEY" | "OTHER"; institutionName: string; fieldOfStudy: string; graduationYear: number | null };
export type ManualCareerStep = Station & { kind: "CAREER_STEP"; type: string; organisationName: string; location: string };
export type ManualStation = ManualDegree | ManualCareerStep;
export type ManualParticipation = { stations: ManualStation[]; referenceKey: string; referenceConfirmed: boolean; contributionConfirmed: boolean };
export class ManualParticipationError extends Error {
  constructor(message = "Bitte prüfe die Angaben zu deinen Stationen, insbesondere Abschlussart, Status und Jahreszahlen.") { super(message); this.name = "ManualParticipationError"; }
}
const fail = (message?: string): never => { throw new ManualParticipationError(message); };
function record(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join() !== [...keys].sort().join()) return fail();
  return value as Record<string, unknown>;
}
const text = (value: unknown, required = false): string => {
  if (typeof value !== "string" || value.length > 200) return fail();
  const clean = value.normalize("NFC").trim(); if (required && !clean) return fail(); return clean;
};
const year = (value: unknown): number | null => value === null ? null
  : Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 9999 ? value as number : fail();

/** A bounded manual-input adapter to the canonical model. No identities,
 * inferred degree levels, contact data or client-controlled catalog IDs. */
export function parseManualParticipation(value: unknown, requireConfirmations = true): ManualParticipation {
  const input = record(value, ["stations", "referenceKey", "referenceConfirmed", "contributionConfirmed"]);
  if (!Array.isArray(input.stations) || input.stations.length < 1 || input.stations.length > 50
    || typeof input.referenceConfirmed !== "boolean" || typeof input.contributionConfirmed !== "boolean") return fail();
  const seen = new Set<string>();
  const stations = input.stations.map((value): ManualStation => {
    const kind = value?.kind;
    if (!["DEGREE", "CAREER_STEP"].includes(kind)) return fail();
    const item = record(value, ["key", "kind", "title", "status", "startYear", "endYear", ...(kind === "DEGREE"
      ? ["level", "program", "institutionName", "fieldOfStudy", "graduationYear"] : ["type", "organisationName", "location"])]);
    const key = text(item.key, true); if (seen.has(key)) return fail(); seen.add(key);
    const base = { key, title: text(item.title, true), status: text(item.status, true), startYear: year(item.startYear), endYear: year(item.endYear) };
    if (base.startYear !== null && base.endYear !== null && base.startYear > base.endYear) return fail();
    if (kind === "DEGREE") {
      const level = text(item.level, true), graduationYear = year(item.graduationYear);
      if (!classificationChoices.some(c => c.value === `DEGREE:${level}`) || !degreeStatuses.some(s => s.value === base.status)
        || !["SURVEY", "OTHER"].includes(String(item.program))
        || (["IN_PROGRESS", "UNKNOWN"].includes(base.status) && base.endYear !== null)
        || (graduationYear !== null && (base.status !== "COMPLETED" || base.startYear !== null && graduationYear < base.startYear || base.endYear !== null && graduationYear < base.endYear))) return fail();
      const institutionName = text(item.institutionName);
      return { ...base, kind, level, program: item.program as ManualDegree["program"], institutionName: item.program === "SURVEY" ? "" : institutionName, fieldOfStudy: text(item.fieldOfStudy), graduationYear };
    }
    const type = text(item.type, true);
    if (!classificationChoices.some(c => c.value === `CAREER_STEP:${type}`) || !careerStatuses.some(s => s.value === base.status)
      || (base.status !== "ENDED" && base.endYear !== null)) return fail();
    return { ...base, kind: "CAREER_STEP", type, organisationName: text(item.organisationName), location: text(item.location) };
  });
  const fingerprints = new Set<string>();
  for (const station of stations) {
    const signature = JSON.stringify(Object.entries(station).filter(([key]) => key !== "key").map(([key, value]) => [key, typeof value === "string" ? value.toLocaleLowerCase("de") : value]));
    if (fingerprints.has(signature)) return fail("Eine Station ist doppelt erfasst. Bitte entferne die doppelte Station oder korrigiere ihre Angaben.");
    fingerprints.add(signature);
  }
  const referenceKey = text(input.referenceKey, true);
  const reference = stations.find(s => s.key === referenceKey);
  if (!reference || reference.kind !== "DEGREE" || reference.status !== "COMPLETED" || reference.program !== "SURVEY") return fail("Bitte wähle deinen eigenen abgeschlossenen Studienabschluss in diesem Studiengang aus.");
  if (requireConfirmations && (!input.referenceConfirmed || !input.contributionConfirmed)) return fail("Bitte bestätige den gewählten eigenen Abschluss und die Abgabe deines Karrierewegs.");
  return { stations, referenceKey, referenceConfirmed: input.referenceConfirmed, contributionConfirmed: input.contributionConfirmed };
}
