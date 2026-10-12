type AuditInput = "snapshots" | "expected" | "pair";
type DiagnosticCode =
  | "INPUT_NOT_ARRAY" | "INVALID_ENTRY" | "INVALID_SYNTHETIC_ID" | "DUPLICATE_SYNTHETIC_ID" | "ID_SET_MISMATCH"
  | "INVALID_SNAPSHOT_STRUCTURE" | "INVALID_SOURCE_ELEMENT" | "UNEXPECTED_SOURCE_DOMAIN" | "DUPLICATE_SOURCE_DOMAIN"
  | "MISSING_SOURCE_DOMAIN" | "INVALID_SOURCE_DATA" | "INVALID_PROFILE_RECORD_COUNT" | "INVALID_SOURCE_RECORD" | "INVALID_SOURCE_DATE"
  | "UNEXPECTED_SOURCE_FORMAT" | "INVALID_EXPECTED_PROFILE" | "INVALID_STATIONS" | "INVALID_STATION" | "INVALID_STATION_ID"
  | "DUPLICATE_STATION_ID" | "INVALID_CHRONOLOGY_INDEX" | "DUPLICATE_CHRONOLOGY_INDEX" | "INVALID_DATE"
  | "INVALID_ANCHOR" | "ANCHOR_STATION_NOT_FOUND" | "INVALID_ANCHOR_YEAR" | "INVALID_SUMMARY";

type Location = { entryIndex?: number; elementIndex?: number; recordIndex?: number; stationIndex?: number; field?: string };
export type FixtureAuditDiagnostic = Location & { code: DiagnosticCode; input: AuditInput };

const sourceDomains = ["PROFILE", "EDUCATION", "POSITIONS"] as const;
const sourceFormat = "LINKEDIN_MEMBER_SNAPSHOT_SYNTHETIC_V1";
const degreeLevels = new Set(["BACHELOR", "MASTER", "PHD", "DIPLOMA", "CERTIFICATE", "OTHER"]);
const careerStepTypes = new Set(["EMPLOYMENT", "INTERNSHIP", "EDUCATION", "VOCATIONAL_TRAINING", "VOLUNTEERING", "SELF_EMPLOYMENT", "UNEMPLOYED", "OTHER"]);
const summaryCounts = ["educationCount", "positionCount", "masterCount", "currentMasterCount", "currentPositionCount"];
const summaryFlags = ["hasPriorBachelor", "hasVocationalTraining", "hasPositionBeforeMsi", "hasPositionDuringMsi", "hasPositionAfterMsi", "hasConcurrentStations"];

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function identifier(value: unknown): value is string {
  return typeof value === "string" && /\S/u.test(value);
}
function integer(value: unknown, minimum: number, maximum = Number.MAX_SAFE_INTEGER): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= minimum && value <= maximum;
}

/** Structural inventory of parsed fixture JSON only: no normalization,
 * confirmation, identity mapping or persistence. Diagnostics contain fixed
 * codes/field names and array indexes, never source values or source IDs.
 * IDs are opaque nonblank strings compared exactly; nothing is repaired.
 */
export function auditFixturePair(snapshots: unknown, expected: unknown) {
  const diagnostics: FixtureAuditDiagnostic[] = [];
  const errorCounts: Partial<Record<DiagnosticCode, number>> = {};
  const inventory = {
    snapshotEntries: 0, expectedEntries: 0, snapshotUniqueIds: 0, expectedUniqueIds: 0,
    matchingIds: 0, snapshotOnlyIds: 0, expectedOnlyIds: 0,
    sourceRecords: { profile: 0, education: 0, position: 0 },
    stations: { total: 0, education: 0, position: 0 }, anchors: 0,
    dates: { yearPrecision: 0, monthPrecision: 0, unknown: 0 },
    currentStations: { education: 0, position: 0 },
    educationLevelHints: { canonical: 0, other: 0 },
    positionTypeHints: { canonical: 0, other: 0 },
  };

  function issue(code: DiagnosticCode, input: AuditInput, location: Location = {}) {
    diagnostics.push({ code, input, ...location });
    errorCounts[code] = (errorCounts[code] ?? 0) + 1;
  }

  function entries(value: unknown, input: "snapshots" | "expected", ids: Set<string>) {
    const result: { entry: Record<string, unknown>; entryIndex: number }[] = [];
    if (!Array.isArray(value)) { issue("INPUT_NOT_ARRAY", input); return result; }
    if (input === "snapshots") inventory.snapshotEntries = value.length;
    else inventory.expectedEntries = value.length;
    value.forEach((entry: unknown, entryIndex: number) => {
      if (!record(entry)) { issue("INVALID_ENTRY", input, { entryIndex }); return; }
      if (!identifier(entry.syntheticId)) issue("INVALID_SYNTHETIC_ID", input, { entryIndex });
      else {
        if (ids.has(entry.syntheticId)) issue("DUPLICATE_SYNTHETIC_ID", input, { entryIndex });
        ids.add(entry.syntheticId);
      }
      result.push({ entry, entryIndex });
    });
    return result;
  }

  const snapshotIds = new Set<string>();
  const expectedIds = new Set<string>();
  for (const { entry, entryIndex } of entries(snapshots, "snapshots", snapshotIds)) {
    if (!record(entry.snapshot) || !Array.isArray(entry.snapshot.elements)) {
      issue("INVALID_SNAPSHOT_STRUCTURE", "snapshots", { entryIndex });
      continue;
    }
    const seenDomains = new Set<string>();
    entry.snapshot.elements.forEach((element: unknown, elementIndex: number) => {
      const location = { entryIndex, elementIndex };
      if (!record(element) || typeof element.snapshotDomain !== "string") {
        issue("INVALID_SOURCE_ELEMENT", "snapshots", location);
        return;
      }
      const domain = sourceDomains.find(value => value === element.snapshotDomain);
      if (!domain) { issue("UNEXPECTED_SOURCE_DOMAIN", "snapshots", location); return; }
      if (seenDomains.has(domain)) issue("DUPLICATE_SOURCE_DOMAIN", "snapshots", location);
      seenDomains.add(domain);
      if (!Array.isArray(element.snapshotData)) { issue("INVALID_SOURCE_DATA", "snapshots", location); return; }
      const counter = domain === "PROFILE" ? "profile" : domain === "EDUCATION" ? "education" : "position";
      inventory.sourceRecords[counter] += element.snapshotData.length;
      if (domain === "PROFILE" && element.snapshotData.length !== 1) issue("INVALID_PROFILE_RECORD_COUNT", "snapshots", location);
      element.snapshotData.forEach((item: unknown, recordIndex: number) => {
        const recordLocation = { ...location, recordIndex };
        if (!record(item)) { issue("INVALID_SOURCE_RECORD", "snapshots", recordLocation); return; }
        // PROFILE content is intentionally opaque; personal identifiers are
        // neither required nor read as canonical Alumni fields.
        if (domain === "PROFILE") return;
        const textFields = domain === "EDUCATION" ? ["School Name", "Degree Name"] : ["Company Name", "Title"];
        if (textFields.some(field => typeof item[field] !== "string")) issue("INVALID_SOURCE_RECORD", "snapshots", recordLocation);
        const dateFields = domain === "EDUCATION" ? ["Start Date", "End Date"] : ["Started On", "Finished On"];
        for (const field of dateFields) {
          if (typeof item[field] !== "string") issue("INVALID_SOURCE_DATE", "snapshots", { ...recordLocation, field });
        }
      });
    });
    for (const domain of sourceDomains) {
      if (!seenDomains.has(domain)) issue("MISSING_SOURCE_DOMAIN", "snapshots", { entryIndex });
    }
  }

  function date(value: unknown, location: Location) {
    if (value === null) { inventory.dates.unknown++; return; }
    if (!record(value) || !integer(value.year, 1, 9999) || !(
      (value.precision === "YEAR" && value.month === null) ||
      (value.precision === "MONTH" && integer(value.month, 1, 12))
    )) { issue("INVALID_DATE", "expected", location); return; }
    if (value.precision === "YEAR") inventory.dates.yearPrecision++;
    else inventory.dates.monthPrecision++;
  }

  for (const { entry, entryIndex } of entries(expected, "expected", expectedIds)) {
    const location = { entryIndex };
    if (entry.sourceFormat !== sourceFormat) issue("UNEXPECTED_SOURCE_FORMAT", "expected", location);
    if (!record(entry.profile)) issue("INVALID_EXPECTED_PROFILE", "expected", location);
    if ("summary" in entry) {
      const summary = entry.summary;
      if (!record(summary) || summaryCounts.some(field => field in summary && !integer(summary[field], 0)) ||
        summaryFlags.some(field => field in summary && typeof summary[field] !== "boolean")) {
        issue("INVALID_SUMMARY", "expected", location);
      }
    }
    const stationIds = new Set<string>();
    const chronologyIndexes = new Set<number>();
    if (!Array.isArray(entry.stations)) issue("INVALID_STATIONS", "expected", location);
    else {
      inventory.stations.total += entry.stations.length;
      entry.stations.forEach((station: unknown, stationIndex: number) => {
        const stationLocation = { entryIndex, stationIndex };
        if (!record(station)) { issue("INVALID_STATION", "expected", stationLocation); return; }
        const isEducation = station.stationType === "EDUCATION";
        const isPosition = station.stationType === "POSITION";
        const textFields = ["titleRaw", "organisationRaw", "organisationCanonical", isEducation ? "degreeLevel" : "employmentForm"];
        const optionalTexts = ["description", "location", "relationToMsi", "fieldCategory", "branchCategory", "positionCategory"];
        if ((!isEducation && !isPosition) || textFields.some(field => typeof station[field] !== "string") ||
          typeof station.isCurrent !== "boolean" || ("isMsiAnchor" in station && typeof station.isMsiAnchor !== "boolean") ||
          optionalTexts.some(field => field in station && station[field] !== null && typeof station[field] !== "string")) {
          issue("INVALID_STATION", "expected", stationLocation);
        }
        if (!identifier(station.stationId)) issue("INVALID_STATION_ID", "expected", stationLocation);
        else {
          if (stationIds.has(station.stationId)) issue("DUPLICATE_STATION_ID", "expected", stationLocation);
          stationIds.add(station.stationId);
        }
        if (!integer(station.chronologyIndex, 1)) issue("INVALID_CHRONOLOGY_INDEX", "expected", stationLocation);
        else {
          if (chronologyIndexes.has(station.chronologyIndex)) issue("DUPLICATE_CHRONOLOGY_INDEX", "expected", stationLocation);
          chronologyIndexes.add(station.chronologyIndex);
        }
        for (const field of ["startDate", "endDate"]) date(station[field], { ...stationLocation, field });
        if (isEducation || isPosition) {
          const type = isEducation ? "education" : "position";
          inventory.stations[type]++;
          if (station.isCurrent === true) inventory.currentStations[type]++;
          const hint = isEducation ? station.degreeLevel : station.employmentForm;
          if (typeof hint === "string") {
            const canonical = (isEducation ? degreeLevels : careerStepTypes).has(hint);
            const hints = isEducation ? inventory.educationLevelHints : inventory.positionTypeHints;
            hints[canonical ? "canonical" : "other"]++;
          }
        }
      });
    }
    if (!record(entry.msiAnchor) || !identifier(entry.msiAnchor.stationId)) issue("INVALID_ANCHOR", "expected", location);
    else {
      inventory.anchors++;
      if (!stationIds.has(entry.msiAnchor.stationId)) issue("ANCHOR_STATION_NOT_FOUND", "expected", location);
      for (const field of ["startYear", "endYear"]) {
        if (field in entry.msiAnchor && entry.msiAnchor[field] !== null && !integer(entry.msiAnchor[field], 1, 9999)) {
          issue("INVALID_ANCHOR_YEAR", "expected", { ...location, field });
        }
      }
    }
  }
  inventory.snapshotUniqueIds = snapshotIds.size;
  inventory.expectedUniqueIds = expectedIds.size;
  for (const id of snapshotIds) {
    if (expectedIds.has(id)) inventory.matchingIds++;
    else inventory.snapshotOnlyIds++;
  }
  for (const id of expectedIds) if (!snapshotIds.has(id)) inventory.expectedOnlyIds++;
  if (inventory.snapshotOnlyIds || inventory.expectedOnlyIds) issue("ID_SET_MISMATCH", "pair");
  return { ok: diagnostics.length === 0, inventory, errorCounts, diagnostics };
}
