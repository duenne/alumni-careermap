import { auditFixturePair } from "../fixture-audit";
import { cleanText, readCareerSnapshot, sourceRows, uuid } from "../career-import/mapping";
import { adaptLinkedInSnapshot } from "../normalization/adapt-linkedin-snapshot";
import { normalizeCareerBatch } from "../normalization/normalize-career-batch";
import type { SourceStation, StationClassification, StationOutcome } from "../normalization/contract";

type FixtureDate = { precision: "YEAR" | "MONTH"; year: number; month: number | null } | null;
type FixtureStation = {
  stationId: string; stationType: "EDUCATION" | "POSITION"; titleRaw: string; organisationRaw: string;
  degreeLevel?: string; employmentForm?: string; chronologyIndex: number; isCurrent: boolean;
  startDate: FixtureDate; endDate: FixtureDate;
  fieldCategory?: string | null; branchCategory?: string | null; positionCategory?: string | null;
};
type FixtureProfile = { syntheticId: string; msiAnchor: { stationId: string }; stations: FixtureStation[] };
type Selection = { syntheticId: string; stationId: string; programId: string; confirmation: "SYNTHETIC_TEST_ONLY" };
export type DemoInspectionInput = { source: unknown; expected: unknown; referenceProgramId: unknown; selections: unknown };
export type DemoValidationError = { code: string; profileNumber?: number; stationNumber?: number };
type ResolvedStation = Exclude<StationOutcome, { kind: "REVIEW_REQUIRED" }>;
type PlanKeys = {
  key: string; alumniKey: string; catalogLabel: string | null; locationObservation: string | null;
};
export type DemoStationPlan = PlanKeys & (
  | Omit<Extract<ResolvedStation, { kind: "RESOLVED_DEGREE" }>, "sourceKey">
  | Omit<Extract<ResolvedStation, { kind: "RESOLVED_CAREER_STEP" }>, "sourceKey">
);
export type DemoProfilePlan = {
  key: string; stations: DemoStationPlan[];
  response: { alumniKey: string; referenceDegreeKey: string; referenceProgramId: string; confirmation: "SYNTHETIC_TEST_ONLY" };
};

const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const asserted = <T>(value: T) => ({ kind: "ASSERTED", value }) as const;
class ProfileError extends Error {}
const fail = (code: string): never => { throw new ProfileError(code); };

/** Explicit synthetic test semantics, deliberately local to this demo planner.
 * These declarations are never a classifier/completion heuristic for live data.
 * Keep the Analytics import and its test policy unchanged.
 */
function classification(station: FixtureStation): StationClassification {
  if (station.stationType === "EDUCATION") {
    if (station.degreeLevel === "VOCATIONAL") return { type: "CAREER_STEP", careerStepType: "VOCATIONAL_TRAINING" };
    if (station.degreeLevel === "OTHER" && station.titleRaw === "Auslandssemester Social Innovation") return { type: "CAREER_STEP", careerStepType: "EDUCATION" };
    switch (station.degreeLevel) {
      case "BACHELOR": case "MASTER": case "PHD": case "DIPLOMA": case "CERTIFICATE":
        return { type: "DEGREE", level: station.degreeLevel };
    }
  } else {
    switch (station.employmentForm) {
      case "EMPLOYED": return { type: "CAREER_STEP", careerStepType: "EMPLOYMENT" };
      case "SELF_EMPLOYED": return { type: "CAREER_STEP", careerStepType: "SELF_EMPLOYMENT" };
      case "VOLUNTEER": return { type: "CAREER_STEP", careerStepType: "VOLUNTEERING" };
      case "INTERNSHIP": return { type: "CAREER_STEP", careerStepType: "INTERNSHIP" };
    }
  }
  return fail("AMBIGUOUS_CLASSIFICATION");
}

function matchesDate(fact: SourceStation["start"], expected: FixtureDate): boolean {
  if (fact.kind === "MISSING") return expected === null;
  return fact.kind === "OBSERVED" && fact.value.precision !== "IMPRECISE" && expected !== null
    && fact.value.precision === expected.precision && fact.value.year === expected.year
    && (fact.value.precision !== "MONTH" || fact.value.month === expected.month);
}
function isSelection(value: unknown): value is Selection {
  return record(value) && Object.keys(value).sort().join() === "confirmation,programId,stationId,syntheticId"
    && typeof value.syntheticId === "string" && !!value.syntheticId.trim()
    && typeof value.stationId === "string" && !!value.stationId.trim()
    && uuid(value.programId) && value.confirmation === "SYNTHETIC_TEST_ONLY";
}

/** Low-level, pure semantic inspection, also usable on deliberately invalid test
 * values. This does NOT approve a source or produce an authorized Survey seed.
 * Only planV5DemoSeed applies the pinned source policy. Exclude whole profiles;
 * never salvage partial careers, repair source facts or auto-select references.
 */
export function inspectDemoProfiles(input: DemoInspectionInput) {
  const audit = auditFixturePair(input.source, input.expected);
  const summary = {
    readProfiles: audit.inventory.snapshotEntries, sourceStations: audit.inventory.stations.total,
    sourceEducation: audit.inventory.sourceRecords.education, sourcePositions: audit.inventory.sourceRecords.position,
    plannedProfiles: 0, plannedStations: 0, degrees: 0, careerSteps: 0, referenceDegrees: 0, responses: 0,
    excludedProfiles: audit.inventory.snapshotEntries, validationErrors: 0, vocationalTraining: 0, exchanges: 0,
    monthPrecisionReduced: 0, statusDeclarations: 0, withheldCompanionCategories: 0,
  };
  const validationErrors: DemoValidationError[] = audit.diagnostics.map(d => ({ code: d.code,
    ...(d.entryIndex === undefined ? {} : { profileNumber: d.entryIndex + 1 }),
    ...(d.stationIndex === undefined ? {} : { stationNumber: d.stationIndex + 1 }),
  }));
  const profiles: DemoProfilePlan[] = [];
  const finish = () => {
    summary.plannedProfiles = profiles.length;
    summary.excludedProfiles = summary.readProfiles - profiles.length;
    summary.referenceDegrees = summary.responses = profiles.length;
    summary.validationErrors = validationErrors.length;
    return { profiles, summary, validationErrors };
  };
  if (!audit.ok) return finish();
  if (!summary.readProfiles || !summary.sourceStations) { validationErrors.push({ code: "EMPTY_FIXTURE" }); return finish(); }
  if (!uuid(input.referenceProgramId)) { validationErrors.push({ code: "INVALID_REFERENCE_PROGRAM" }); return finish(); }
  const programId = input.referenceProgramId.toLowerCase();
  if (!Array.isArray(input.selections) || !input.selections.every(isSelection)) {
    validationErrors.push({ code: "INVALID_SYNTHETIC_SELECTION" }); return finish();
  }
  // Types are narrowed only after the structural audit, never by source labels.
  const sources = input.source as { syntheticId: string; snapshot: unknown }[];
  const expected = input.expected as FixtureProfile[];
  const selections: Selection[] = input.selections;
  if (selections.some(s => !sources.some(p => p.syntheticId === s.syntheticId))) {
    validationErrors.push({ code: "REFERENCE_OWNER_NOT_FOUND" }); return finish();
  }
  for (const [index, entry] of sources.entries()) {
    const pair = expected.find(p => p.syntheticId === entry.syntheticId)!;
    let stationNumber: number | undefined;
    try {
      const selected = selections.filter(s => s.syntheticId === entry.syntheticId);
      if (!selected.length) fail("REFERENCE_SELECTION_REQUIRED");
      if (selected.length !== 1) fail("AMBIGUOUS_REFERENCE_SELECTION");
      const selection = selected[0];
      if (selection.programId.toLowerCase() !== programId) fail("REFERENCE_PROGRAM_MISMATCH");
      if (!pair.stations.some(s => s.stationId === selection.stationId)) fail("REFERENCE_STATION_NOT_FOUND");
      const snapshot = readCareerSnapshot(entry.snapshot);
      const rows = sourceRows(snapshot);
      const batch = adaptLinkedInSnapshot(snapshot);
      const metadata = new Map<string, { hint: FixtureStation; row: typeof rows[number] }>();
      const used = new Set<string>();
      for (const [hintIndex, hint] of pair.stations.entries()) {
        stationNumber = hintIndex + 1;
        const matches = rows.filter(r => r.domain === (hint.stationType === "EDUCATION" ? "EDUCATION" : "POSITIONS")
          && r.title === cleanText(hint.titleRaw) && r.provider === cleanText(hint.organisationRaw));
        if (matches.length !== 1 || used.has(matches[0].sourceKey)) fail("AMBIGUOUS_STATION_CORRELATION");
        const row = matches[0]; used.add(row.sourceKey);
        const station = batch.stations.find(s => s.key === row.sourceKey)!;
        if (!matchesDate(station.start, hint.startDate) || !matchesDate(station.end, hint.endDate)) fail("STATION_DATE_MISMATCH");
        station.classification = asserted(classification(hint));
        station.position = asserted(hint.chronologyIndex);
        if (hint.isCurrent && hint.endDate !== null) fail("CONFLICTING_STATION_STATUS");
        // Explicit additional fixture declarations. A real attendance end never
        // proves an award. Missing end stays UNKNOWN; no graduation is invented.
        if (station.classification.value.type === "DEGREE") {
          station.degreeStatus = asserted(hint.isCurrent ? "IN_PROGRESS" : hint.endDate ? "COMPLETED" : "UNKNOWN");
        } else {
          station.temporalStatus = asserted(hint.isCurrent ? "ONGOING" : hint.endDate ? "ENDED" : "UNKNOWN");
        }
        // Source policy declares the known MSI candidate's catalog association.
        // Selection is separate and may NOT reassign another degree's program.
        if (hint.stationId === pair.msiAnchor.stationId && station.classification.value.type === "DEGREE") {
          station.catalog = { kind: "CONFIRMED", identity: { entity: "PROGRAM", id: programId }, confirmation: "TRUSTED_INPUT" };
        }
        metadata.set(station.key, { hint, row });
      }
      stationNumber = undefined;
      if (used.size !== rows.length) fail("INCOMPLETE_STATION_MAPPING");
      const result = normalizeCareerBatch(batch);
      const key = `profile:${index + 1}`;
      const stations = result.stations.map((outcome): DemoStationPlan => {
        const { hint, row } = metadata.get(outcome.sourceKey)!;
        if (outcome.kind === "REVIEW_REQUIRED") {
          stationNumber = pair.stations.indexOf(hint) + 1;
          return fail("UNRESOLVED_STATION");
        }
        const common = { position: outcome.position, unresolved: outcome.unresolved, key: `${key}:station:${outcome.position}`, alumniKey: key,
          catalogLabel: hint.stationId === pair.msiAnchor.stationId ? null : row.provider || null };
        // Preserve the discriminated canonical union; no source IDs/envelopes.
        return outcome.kind === "RESOLVED_DEGREE"
          ? { ...common, kind: outcome.kind, canonical: outcome.canonical, locationObservation: null }
          : { ...common, kind: outcome.kind, canonical: outcome.canonical, locationObservation: row.location || null };
      }).sort((a, b) => a.position - b.position);
      const selectedHint = pair.stations.find(s => s.stationId === selection.stationId)!;
      stationNumber = pair.stations.indexOf(selectedHint) + 1;
      const reference = stations.find(s => s.position === selectedHint.chronologyIndex)!;
      if (reference.alumniKey !== key || reference.kind !== "RESOLVED_DEGREE"
        || reference.canonical.status !== "COMPLETED" || reference.canonical.programId !== programId) fail("INVALID_REFERENCE_DEGREE");
      profiles.push({ key, stations, response: { alumniKey: key, referenceDegreeKey: reference.key,
        referenceProgramId: programId, confirmation: "SYNTHETIC_TEST_ONLY" } });
      for (const station of stations) {
        summary.plannedStations++;
        if (station.kind === "RESOLVED_DEGREE") summary.degrees++; else summary.careerSteps++;
        if ("type" in station.canonical && station.canonical.type === "VOCATIONAL_TRAINING") summary.vocationalTraining++;
      }
      for (const hint of pair.stations) {
        summary.statusDeclarations++;
        summary.exchanges += Number(hint.stationType === "EDUCATION" && hint.degreeLevel === "OTHER");
        summary.monthPrecisionReduced += Number(hint.startDate?.precision === "MONTH") + Number(hint.endDate?.precision === "MONTH");
        summary.withheldCompanionCategories += Number(!!hint.fieldCategory) + Number(!!hint.branchCategory) + Number(!!hint.positionCategory);
      }
    } catch (error) {
      validationErrors.push({ code: error instanceof ProfileError ? error.message : "INVALID_PROFILE",
        profileNumber: index + 1, ...(stationNumber === undefined ? {} : { stationNumber }) });
    }
  }
  return finish();
}
