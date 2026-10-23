import { auditFixturePair } from "../fixture-audit";
import { readCareerSnapshot, sourceRows, cleanText } from "../career-import/mapping";
import { adaptLinkedInSnapshot } from "../normalization/adapt-linkedin-snapshot";
import { normalizeCareerBatch } from "../normalization/normalize-career-batch";
import type { SourceStation, StationClassification, StationOutcome } from "../normalization/contract";

export const fields = ["Gesellschaft & Politik", "Wirtschaft & Recht", "Mensch & Gesundheit", "Gestaltung & Kunst", "Natur & Umwelt", "Kommunikation & Medien", "Technik & Information", "IT & Technologie"];
export const sectors = ["Dritter Sektor", "Öffentliche Verwaltung", "Wissenschaft & Bildung", "Beratung", "Produktion & verarbeitendes Gewerbe", "IT & Technologie", "Finanzen & Versicherung", "Handel & Konsumgüter"];
export const jobs = ["Strategie & Planung", "Forschung & Entwicklung", "Führung", "Produktion & operatives Management", "Marketing & Vertrieb", "Controlling & Reporting"];
type OracleDate = { precision: string; year: number; month: number | null } | null;
type OracleStation = {
  stationId: string; stationType: string; titleRaw: string; organisationRaw: string; degreeLevel?: string; employmentForm?: string;
  chronologyIndex: number; isCurrent: boolean; startDate: OracleDate; endDate: OracleDate;
  fieldCategory?: string | null; branchCategory?: string | null; positionCategory?: string | null;
};
export type Oracle = { syntheticId: string; sourceFormat?: string; profile?: object; msiAnchor: { stationId: string }; stations: OracleStation[] };
export type PlannedStation = Exclude<StationOutcome, { kind: "REVIEW_REQUIRED" }> & {
  provider: string | null; field: string | null; sector: string | null; job: string | null; location: string | null; demoAnchor: boolean;
};
export type PlannedProfile = { stations: PlannedStation[] };
export type ImportReport = {
  policy: string; readProfiles: number; sourceStations: number; acceptedProfiles: number; excludedProfiles: number; excludedStations: number;
  degrees: number; careerSteps: number; timelineItems: number; demoAnchors: number; unknownDateStations: number;
  monthPrecisionReduced: number; unknownCategories: number; statusDeclarations: number; exchangeReclassifications: number; unrepresentedEducationFields: number;
  exclusions: { profileNumber: number; code: string }[];
};
export type ImportPlan = { profiles: PlannedProfile[]; report: ImportReport };
const asserted = <T>(value: T) => ({ kind: "ASSERTED", value }) as const;
const fail = (code: string): never => { throw new Error(code); };
function classification(s: OracleStation): StationClassification {
  if (s.stationType === "EDUCATION") {
    if (s.degreeLevel === "VOCATIONAL") return { type: "CAREER_STEP", careerStepType: "VOCATIONAL_TRAINING" };
    // Explicit, narrow fixture declaration: an exchange is not a qualification.
    if (s.degreeLevel === "OTHER" && s.titleRaw === "Auslandssemester Social Innovation") return { type: "CAREER_STEP", careerStepType: "EDUCATION" };
    if (["BACHELOR", "MASTER", "PHD", "DIPLOMA", "CERTIFICATE"].includes(s.degreeLevel ?? "")) return { type: "DEGREE", level: s.degreeLevel as Extract<StationClassification, { type: "DEGREE" }>["level"] };
  } else {
    const types = { EMPLOYED: "EMPLOYMENT", SELF_EMPLOYED: "SELF_EMPLOYMENT", VOLUNTEER: "VOLUNTEERING", INTERNSHIP: "INTERNSHIP" } as const;
    const type = types[s.employmentForm as keyof typeof types];
    if (type) return { type: "CAREER_STEP", careerStepType: type };
  }
  return fail("AMBIGUOUS_CLASSIFICATION");
}
function matchesDate(fact: SourceStation["start"], expected: OracleDate): boolean {
  if (fact.kind === "MISSING") return expected === null;
  if (fact.kind !== "OBSERVED" || fact.value.precision === "IMPRECISE" || expected === null) return false;
  return fact.value.precision === expected.precision && fact.value.year === expected.year
    && (fact.value.precision !== "MONTH" || fact.value.month === expected.month);
}

/** phase-d-v1 is an OPTIONAL, newly authored synthetic test policy, not recovered
 * evidence of completion, full real-world careers, catalog identity or consent.
 * It explicitly accepts companion classifications/order/categories as fixture
 * declarations, asserts closed academic cases completed, and current cases open.
 * No graduation year or SurveyResponse is derived. Raw anchor hints alone do nothing.
 */
export function prepareAnalyticsImport(source: unknown, oracle: unknown, policy?: string, declareDemoAnchors = true): ImportPlan {
  if (policy !== "phase-d-v1") return fail("TEST_POLICY_REQUIRED");
  if (!auditFixturePair(source, oracle).ok) return fail("INVALID_FIXTURE_PAIR");
  const sources = source as { syntheticId: string; snapshot: unknown }[];
  const expected = oracle as Oracle[];
  const report: ImportReport = { policy, readProfiles: sources.length, sourceStations: 0, acceptedProfiles: 0, excludedProfiles: 0, excludedStations: 0, degrees: 0, careerSteps: 0, timelineItems: 0, demoAnchors: 0, unknownDateStations: 0, monthPrecisionReduced: 0, unknownCategories: 0, statusDeclarations: 0, exchangeReclassifications: 0, unrepresentedEducationFields: 0, exclusions: [] };
  const profiles: PlannedProfile[] = [];
  for (const [index, entry] of sources.entries()) {
    const pair = expected.find(p => p.syntheticId === entry.syntheticId)!;
    report.sourceStations += pair.stations.length;
    try {
      const snapshot = readCareerSnapshot(entry.snapshot);
      const rows = sourceRows(snapshot);
      const input = adaptLinkedInSnapshot(snapshot);
      const used = new Set<string>();
      const metadata = new Map<string, { hint: OracleStation; provider: string | null; location: string | null }>();
      for (const hint of pair.stations) {
        const matches = rows.filter(r => !used.has(r.sourceKey) && r.domain === (hint.stationType === "EDUCATION" ? "EDUCATION" : "POSITIONS")
          && r.title === cleanText(hint.titleRaw) && r.provider === cleanText(hint.organisationRaw));
        if (matches.length !== 1) fail("AMBIGUOUS_CORRELATION");
        const row = matches[0]; used.add(row.sourceKey);
        const station = input.stations.find(s => s.key === row.sourceKey)!;
        if (!matchesDate(station.start, hint.startDate) || !matchesDate(station.end, hint.endDate)) fail("ORACLE_MISMATCH");
        station.classification = asserted(classification(hint));
        station.position = asserted(hint.chronologyIndex);
        const academic = station.classification.value.type === "DEGREE";
        if (hint.isCurrent && hint.endDate !== null) fail("CONFLICTING_STATUS");
        const status = hint.isCurrent ? academic ? "IN_PROGRESS" : "ONGOING" : hint.endDate ? academic ? "COMPLETED" : "ENDED" : "UNKNOWN";
        if (academic) station.degreeStatus = asserted(status as "COMPLETED" | "IN_PROGRESS" | "UNKNOWN");
        else station.temporalStatus = asserted(status as "ENDED" | "ONGOING" | "UNKNOWN");
        metadata.set(station.key, { hint, provider: row.provider || null, location: row.location || null });
      }
      if (used.size !== rows.length) fail("INCOMPLETE_MAPPING");
      const result = normalizeCareerBatch(input);
      const stations: PlannedStation[] = result.stations.map(outcome => {
        if (outcome.kind === "REVIEW_REQUIRED") return fail("UNRESOLVED_STATION");
        const { hint, provider, location } = metadata.get(outcome.sourceKey)!;
        const demoAnchor = declareDemoAnchors && hint.stationId === pair.msiAnchor.stationId;
        if (demoAnchor && (outcome.kind !== "RESOLVED_DEGREE" || outcome.canonical.level !== "BACHELOR" || outcome.canonical.status !== "COMPLETED")) fail("INVALID_DEMO_ANCHOR");
        return { ...outcome, provider, location, demoAnchor,
          field: fields.includes(hint.fieldCategory ?? "") ? hint.fieldCategory! : null,
          sector: sectors.includes(hint.branchCategory ?? "") ? hint.branchCategory! : null,
          job: jobs.includes(hint.positionCategory ?? "") ? hint.positionCategory! : null };
      });
      if (declareDemoAnchors && stations.filter(s => s.demoAnchor).length !== 1) fail("INVALID_DEMO_ANCHOR");
      profiles.push({ stations });
      for (const s of stations) {
        const hint = metadata.get(s.sourceKey)!.hint;
        report.statusDeclarations++;
        if (s.kind === "RESOLVED_DEGREE") report.degrees++; else report.careerSteps++;
        if (hint.degreeLevel === "OTHER") report.exchangeReclassifications++;
        if (s.kind === "RESOLVED_CAREER_STEP" && hint.stationType === "EDUCATION" && s.field !== null) report.unrepresentedEducationFields++;
        report.demoAnchors += Number(s.demoAnchor);
        report.monthPrecisionReduced += Number(hint.startDate?.precision === "MONTH") + Number(hint.endDate?.precision === "MONTH");
        if (s.canonical.startYear === null || s.canonical.endYear === null && !("status" in s.canonical ? s.canonical.status === "IN_PROGRESS" : s.canonical.temporalStatus === "ONGOING")) report.unknownDateStations++;
        report.unknownCategories += s.kind === "RESOLVED_DEGREE" || hint.stationType === "EDUCATION" ? Number(s.field === null) : Number(s.sector === null) + Number(s.job === null);
      }
    } catch (error) {
      const codes = ["AMBIGUOUS_CLASSIFICATION", "AMBIGUOUS_CORRELATION", "ORACLE_MISMATCH", "CONFLICTING_STATUS", "INCOMPLETE_MAPPING", "UNRESOLVED_STATION", "INVALID_DEMO_ANCHOR"];
      report.exclusions.push({ profileNumber: index + 1, code: error instanceof Error && codes.includes(error.message) ? error.message : "INVALID_PROFILE" });
      report.excludedStations += pair.stations.length;
    }
  }
  report.acceptedProfiles = profiles.length; report.excludedProfiles = report.exclusions.length; report.timelineItems = report.degrees + report.careerSteps;
  return { profiles, report };
}
