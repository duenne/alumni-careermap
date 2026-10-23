import { CareerImportError, cleanText, readCareerSnapshot, sourceRows, suggestReviews } from "./mapping";

type PhaseDStation = { stationId: string; stationType: string; titleRaw: string; organisationRaw: string; degreeLevel?: string; employmentForm?: string; chronologyIndex: number; isCurrent: boolean };
export type PhaseDExpected = { syntheticId: string; stations: PhaseDStation[]; msiAnchor: { stationId: string } };

/** The companion file supplies editable hints, never canonical records or a
 * confirmation. Correlation must be unique; station array order is irrelevant.
 */
export function phaseDExample(snapshot: unknown, expected: PhaseDExpected) {
  const projected = readCareerSnapshot(snapshot);
  const rows = sourceRows(projected);
  const reviews = suggestReviews(projected);
  const used = new Set<string>();
  let candidateSourceKey: string | null = null;
  for (const station of expected.stations) {
    const matches = rows.filter(row => !used.has(row.sourceKey) && row.domain === (station.stationType === "EDUCATION" ? "EDUCATION" : "POSITIONS")
      && row.title === cleanText(station.titleRaw) && row.provider === cleanText(station.organisationRaw));
    if (matches.length !== 1) throw new CareerImportError("INVALID_SOURCE");
    const source = matches[0]; used.add(source.sourceKey);
    const review = reviews.find(review => review.sourceKey === source.sourceKey)!;
    review.position = station.chronologyIndex;
    if (station.stationType === "EDUCATION") {
      if (station.degreeLevel === "VOCATIONAL") review.classification = "CAREER_STEP:VOCATIONAL_TRAINING";
      else if (["BACHELOR", "MASTER", "PHD", "DIPLOMA", "CERTIFICATE", "OTHER"].includes(station.degreeLevel ?? "")) review.classification = `DEGREE:${station.degreeLevel}`;
    } else {
      const types: Record<string, string> = { EMPLOYED: "EMPLOYMENT", SELF_EMPLOYED: "SELF_EMPLOYMENT", VOLUNTEER: "VOLUNTEERING", INTERNSHIP: "INTERNSHIP" };
      review.classification = types[station.employmentForm ?? ""] ? `CAREER_STEP:${types[station.employmentForm!]}` : "";
    }
    // isCurrent=false is not evidence of an award. All statuses require review.
    review.status = "UNKNOWN";
    if (station.stationId === expected.msiAnchor.stationId) candidateSourceKey = source.sourceKey;
  }
  if (used.size !== rows.length || !candidateSourceKey) throw new CareerImportError("INVALID_SOURCE");
  return { snapshot: projected, reviews, candidateSourceKey };
}
