import type {
  CanonicalCareerStep, CanonicalDegree, ContractDiagnostic, ContractValidation,
  DecisionField, NormalizationInput, NormalizationResult, SourceDate, SourceFact, SourceStation, UnresolvedDecision,
} from "./contract";

type Check = (value: unknown) => boolean;
const record = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const text: Check = v => typeof v === "string" && /\S/u.test(v);
const year: Check = v => Number.isInteger(v) && Number(v) >= 1 && Number(v) <= 9999;
const position: Check = v => Number.isSafeInteger(v) && Number(v) > 0;
const uuid: Check = v => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const literal = (...values: unknown[]): Check => v => values.includes(v);
const nullable = (check: Check): Check => v => v === null || check(v);
const array = (check: Check): Check => v => Array.isArray(v) && Array.from(v).every(check);
const union = (...checks: Check[]): Check => v => checks.some(check => check(v));
const shape = (fields: Record<string, Check>): Check => v => record(v)
  && Object.keys(v).length === Object.keys(fields).length
  && Object.entries(fields).every(([key, check]) => Object.hasOwn(v, key) && check(v[key]));
// Exhaustive against the canonical Prisma scalar types, without importing a
// generated runtime module (unit tests also run before prisma generate in CI).
const vocabulary = <T extends string>(values: Record<T, true>): Check => literal(...Object.keys(values));
const degreeLevel = vocabulary<CanonicalDegree["level"]>({ BACHELOR: true, MASTER: true, PHD: true, DIPLOMA: true, CERTIFICATE: true, OTHER: true });
const degreeStatus = vocabulary<CanonicalDegree["status"]>({ IN_PROGRESS: true, COMPLETED: true, ENDED_WITHOUT_DEGREE: true, UNKNOWN: true });
const stepType = vocabulary<CanonicalCareerStep["type"]>({ EMPLOYMENT: true, INTERNSHIP: true, EDUCATION: true, VOCATIONAL_TRAINING: true, VOLUNTEERING: true, SELF_EMPLOYMENT: true, UNEMPLOYED: true, OTHER: true });
const temporalStatus = vocabulary<CanonicalCareerStep["temporalStatus"]>({ ONGOING: true, ENDED: true, UNKNOWN: true });
const sourceDate = union(
  shape({ precision: literal("YEAR"), year }),
  shape({ precision: literal("MONTH"), year, month: v => Number.isInteger(v) && Number(v) >= 1 && Number(v) <= 12 }),
  shape({ precision: literal("IMPRECISE"), text }),
);
const absent = union(shape({ kind: literal("MISSING") }), shape({ kind: literal("UNKNOWN"), origin: literal("OBSERVED", "ASSERTED") }));
const assertion = (check: Check): Check => union(absent, shape({ kind: literal("ASSERTED"), value: check }));
const fact = (check: Check): Check => union(assertion(check), shape({ kind: literal("OBSERVED"), value: check }));
const classification = union(
  shape({ type: literal("DEGREE"), level: degreeLevel }),
  shape({ type: literal("CAREER_STEP"), careerStepType: stepType }),
);
const identity = shape({ entity: literal("PROGRAM", "INSTITUTION", "ORGANISATION"), id: uuid });
const catalog = union(
  shape({ kind: literal("UNKNOWN") }),
  shape({ kind: literal("CANDIDATE"), identity, basis: literal("NAME_MATCH", "SUPPLIED_CANDIDATE") }),
  shape({ kind: literal("CONFIRMED"), identity, confirmation: literal("EXPLICIT_SELECTION", "TRUSTED_INPUT") }),
);
const sourceStation = shape({
  key: text, title: fact(text), category: fact(text), providerLabel: fact(text),
  start: fact(sourceDate), end: fact(sourceDate), graduation: fact(sourceDate),
  classification: assertion(classification), degreeStatus: assertion(degreeStatus),
  temporalStatus: assertion(temporalStatus), position: assertion(position), catalog,
});
const canonicalDegree = shape({
  level: degreeLevel, status: degreeStatus, title: nullable(text), fieldOfStudy: literal(null),
  programId: nullable(uuid), institutionId: nullable(uuid),
  startYear: nullable(year), endYear: nullable(year), graduationYear: nullable(year),
});
const canonicalStep = shape({
  type: stepType, temporalStatus, roleTitle: nullable(text), roleCategory: literal(null),
  functionArea: literal(null), location: literal(null), organisationId: nullable(uuid),
  startYear: nullable(year), endYear: nullable(year),
});
const decisionField = vocabulary<DecisionField>({
  classification: true, level: true, status: true, temporalStatus: true, catalogAssociation: true,
  startYear: true, endYear: true, graduationYear: true, position: true, title: true, fieldOfStudy: true,
  roleTitle: true, roleCategory: true, functionArea: true, location: true,
});
const decision = shape({ field: decisionField, reason: literal(
  "MISSING", "UNKNOWN", "IMPRECISE_DATE", "CLASSIFICATION_UNCERTAIN", "CATALOG_UNCONFIRMED", "STATUS_UNCERTAIN", "CONFLICTING_FACTS",
) });
const outcome = union(
  shape({ sourceKey: text, kind: literal("RESOLVED_DEGREE"), canonical: canonicalDegree, position, unresolved: array(decision) }),
  shape({ sourceKey: text, kind: literal("RESOLVED_CAREER_STEP"), canonical: canonicalStep, position, unresolved: array(decision) }),
  shape({ sourceKey: text, kind: literal("REVIEW_REQUIRED"), unresolved: v => array(decision)(v) && (v as unknown[]).length > 0 }),
);

function knownYear(date: SourceFact<SourceDate>): number | null {
  return (date.kind === "OBSERVED" || date.kind === "ASSERTED") && date.value.precision !== "IMPRECISE" ? date.value.year : null;
}

const supplied = <T>(fact: SourceFact<T>): fact is { kind: "OBSERVED" | "ASSERTED"; value: T } =>
  fact.kind === "OBSERVED" || fact.kind === "ASSERTED";

/** Only contradictions visible in this contract are decidable here. Conflict
 * and status-uncertainty explanations remain claims requiring human review.
 */
function compatibleDecision(source: SourceStation, { field, reason }: UnresolvedDecision): boolean {
  const date = field === "startYear" ? source.start : field === "endYear" ? source.end
    : field === "graduationYear" ? source.graduation : undefined;
  const fact: SourceFact<unknown> = date ?? ({
    classification: source.classification, level: source.classification,
    status: source.degreeStatus, temporalStatus: source.temporalStatus, position: source.position,
    title: source.title, roleTitle: source.title,
  } as Partial<Record<DecisionField, SourceFact<unknown>>>)[field] ?? { kind: "MISSING" };
  if (reason === "IMPRECISE_DATE") return date !== undefined && supplied(date) && date.value.precision === "IMPRECISE";
  if (field === "catalogAssociation") {
    if (reason === "MISSING") return false; // Catalog envelope explicitly says UNKNOWN, CANDIDATE or CONFIRMED.
    if (reason === "UNKNOWN") return source.catalog.kind !== "CONFIRMED";
  }
  if (reason === "MISSING") return fact.kind === "MISSING";
  if (reason === "UNKNOWN") {
    return !supplied(fact) || (date !== undefined && supplied(date) && date.value.precision === "IMPRECISE")
      || ((field === "status" || field === "temporalStatus") && fact.value === "UNKNOWN");
  }
  return true;
}

/** Pure validation of supplied JSON-like contract values. No parsing, inferred
 * defaults, normalization, catalog lookup, reference choice or persistence.
 * Assertion/confirmation tags are caller claims, not proof of their provenance.
 * Diagnostics never interpolate input values, keys, IDs or arbitrary field names.
 */
export function validateNormalizationContract(input: unknown, result: unknown): ContractValidation {
  const diagnostics: ContractDiagnostic[] = [];
  for (const [side, value, check] of [["INPUT", input, sourceStation], ["RESULT", result, outcome]] as const) {
    if (!shape({ stations: Array.isArray })(value)) {
      diagnostics.push({ side, code: "INVALID_SHAPE" });
    } else {
      Array.from((value as { stations: unknown[] }).stations).forEach((station, stationIndex) => {
        if (!check(station)) diagnostics.push({ side, stationIndex, code: "INVALID_SHAPE" });
      });
    }
  }
  // Correlation and semantic checks only run on structurally valid records.
  if (diagnostics.length) return { ok: false, diagnostics };
  const sources = (input as NormalizationInput).stations;
  const outcomes = (result as NormalizationResult).stations;
  const byKey = new Map<string, SourceStation>();
  sources.forEach((source, stationIndex) => {
    if (byKey.has(source.key)) diagnostics.push({ side: "INPUT", stationIndex, code: "DUPLICATE_SOURCE_KEY" });
    byKey.set(source.key, source);
  });
  const mapped = new Set<string>();
  const positions = new Set<number>();
  outcomes.forEach((resolved, stationIndex) => {
    const add = (code: ContractDiagnostic["code"], field?: DecisionField) => {
      diagnostics.push({ side: "RESULT", stationIndex, code, ...(field ? { field } : {}) });
    };
    if (mapped.has(resolved.sourceKey)) add("DUPLICATE_OUTCOME");
    mapped.add(resolved.sourceKey);
    const source = byKey.get(resolved.sourceKey);
    if (!source) { add("SOURCE_NOT_FOUND"); return; }
    for (const decision of resolved.unresolved) {
      if (!compatibleDecision(source, decision)) add("INVALID_DECISION", decision.field);
    }
    if (resolved.kind === "REVIEW_REQUIRED") return;

    const canonical = resolved.canonical;
    const needs = (field: DecisionField) => resolved.unresolved.some(d => d.field === field);
    for (const d of resolved.unresolved) {
      if (!["classification", "catalogAssociation", "position"].includes(d.field) && !Object.hasOwn(canonical, d.field)) add("INVALID_CANONICAL", d.field);
    }
    if (positions.has(resolved.position)) add("DUPLICATE_POSITION", "position");
    positions.add(resolved.position);
    if (source.position.kind !== "ASSERTED" || source.position.value !== resolved.position) add("UNSUPPORTED_FACT", "position");
    const c = source.classification;
    if (resolved.kind === "RESOLVED_DEGREE") {
      if (c.kind !== "ASSERTED" || c.value.type !== "DEGREE" || c.value.level !== resolved.canonical.level) add("UNSUPPORTED_FACT", "classification");
    } else if (c.kind !== "ASSERTED" || c.value.type !== "CAREER_STEP" || c.value.careerStepType !== resolved.canonical.type) add("UNSUPPORTED_FACT", "classification");

    const checkStatus = (fact: SourceStation["degreeStatus"] | SourceStation["temporalStatus"], value: string, field: "status" | "temporalStatus") => {
      if (fact.kind === "ASSERTED") {
        if (fact.value !== value) add("UNSUPPORTED_FACT", field);
      } else if (value !== "UNKNOWN" || !needs(field)) add("UNSUPPORTED_FACT", field);
    };
    if (resolved.kind === "RESOLVED_DEGREE") {
      checkStatus(source.degreeStatus, resolved.canonical.status, "status");
      if (source.temporalStatus.kind === "ASSERTED") add("UNSUPPORTED_FACT", "temporalStatus");
    } else {
      checkStatus(source.temporalStatus, resolved.canonical.temporalStatus, "temporalStatus");
      if (source.degreeStatus.kind === "ASSERTED") add("UNSUPPORTED_FACT", "status");
      if (supplied(source.graduation)) add("UNSUPPORTED_FACT", "graduationYear");
    }
    const title = resolved.kind === "RESOLVED_DEGREE" ? resolved.canonical.title : resolved.canonical.roleTitle;
    if (title !== null && (!supplied(source.title) || source.title.value !== title)) {
      add("UNSUPPORTED_FACT", resolved.kind === "RESOLVED_DEGREE" ? "title" : "roleTitle");
    }

    const checkYear = (date: SourceFact<SourceDate>, value: number | null, field: "startYear" | "endYear" | "graduationYear") => {
      const exact = knownYear(date);
      if (value !== null && value !== exact) add("UNSUPPORTED_FACT", field);
      if (value === null && exact !== null && !needs(field)) add("UNSUPPORTED_FACT", field);
    };
    checkYear(source.start, canonical.startYear, "startYear");
    checkYear(source.end, canonical.endYear, "endYear");
    if (canonical.startYear !== null && canonical.endYear !== null && canonical.startYear > canonical.endYear) add("INVALID_CANONICAL", "endYear");
    if (resolved.kind === "RESOLVED_DEGREE") {
      const d = resolved.canonical;
      checkYear(source.graduation, d.graduationYear, "graduationYear");
      if (d.programId !== null && d.institutionId !== null) add("INVALID_CANONICAL", "catalogAssociation");
      if ((d.status === "IN_PROGRESS" || d.status === "UNKNOWN") && d.endYear !== null) add("INVALID_CANONICAL", "endYear");
      if (d.graduationYear !== null && (d.status !== "COMPLETED"
        || (d.startYear !== null && d.graduationYear < d.startYear)
        || (d.endYear !== null && d.graduationYear < d.endYear))) add("INVALID_CANONICAL", "graduationYear");
      if ((d.level === "DIPLOMA" || d.level === "OTHER") && d.title === null) add("INVALID_CANONICAL", "title");
    } else {
      const s = resolved.canonical;
      if (s.temporalStatus !== "ENDED" && s.endYear !== null) add("INVALID_CANONICAL", "endYear");
      if (s.type === "OTHER" && s.roleTitle === null) add("INVALID_CANONICAL", "roleTitle");
    }
    const associations = resolved.kind === "RESOLVED_DEGREE"
      ? [["PROGRAM", resolved.canonical.programId], ["INSTITUTION", resolved.canonical.institutionId]] as const
      : [["ORGANISATION", resolved.canonical.organisationId]] as const;
    for (const [entity, id] of associations) {
      if (id !== null && (source.catalog.kind !== "CONFIRMED" || source.catalog.identity.entity !== entity
        || source.catalog.identity.id.toLowerCase() !== id.toLowerCase())) add("UNCONFIRMED_CATALOG", "catalogAssociation");
    }
  });
  sources.forEach((source, stationIndex) => {
    if (!mapped.has(source.key)) diagnostics.push({ side: "INPUT", stationIndex, code: "MISSING_OUTCOME" });
  });
  return { ok: diagnostics.length === 0, diagnostics };
}
