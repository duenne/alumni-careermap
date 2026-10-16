// Checked by tsc, not counted as runtime Vitest tests.
import type { Assertion, CatalogAssociation, CanonicalCareerStep, CanonicalDegree, SourceDate, StationOutcome } from "./contract";

type Review = Extract<StationOutcome, { kind: "REVIEW_REQUIRED" }>;
type ConfirmedCatalog = Extract<CatalogAssociation, { kind: "CONFIRMED" }>;
declare const canonical: CanonicalDegree;
declare const candidate: Extract<CatalogAssociation, { kind: "CANDIDATE" }>;

// @ts-expect-error A review outcome cannot carry a canonical station.
const review: Review = { sourceKey: "local", kind: "REVIEW_REQUIRED", canonical, unresolved: [{ field: "classification", reason: "UNKNOWN" }] };
// @ts-expect-error Candidate identity is not confirmed identity.
const confirmed: ConfirmedCatalog = candidate;
// @ts-expect-error Imprecise dates cannot assert an exact year.
const date: SourceDate = { precision: "IMPRECISE", text: "around a year", year: 2020 };
// @ts-expect-error Observed status is not an explicit assertion.
const status: Assertion<"COMPLETED"> = { kind: "OBSERVED", value: "COMPLETED" };
// @ts-expect-error Missing required canonical status cannot be defaulted.
const incomplete: CanonicalDegree = { level: "MASTER", title: null, fieldOfStudy: null, programId: null, institutionId: null, startYear: null, endYear: null, graduationYear: null };
// @ts-expect-error Program and direct Institution cannot coexist.
const catalogs: CanonicalDegree = { ...canonical, programId: "program", institutionId: "institution" };
// @ts-expect-error E.1 has no dedicated field-of-study source fact.
const fieldOfStudy: CanonicalDegree["fieldOfStudy"] = "Invented field";
// @ts-expect-error Category labels do not supply verified role categories.
const roleCategory: CanonicalCareerStep["roleCategory"] = "Invented category";
// @ts-expect-error E.1 has no dedicated function-area source fact.
const functionArea: CanonicalCareerStep["functionArea"] = "Invented function";
// @ts-expect-error Provider labels do not supply a station's location.
const location: CanonicalCareerStep["location"] = "Invented location";
void [review, confirmed, date, status, incomplete, catalogs, fieldOfStudy, roleCategory, functionArea, location];
