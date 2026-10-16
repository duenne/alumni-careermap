# Phase E.1 — Source-neutral normalization contract

The [MVP Domain Model](MVP_DOMAIN_MODEL.md) remains normative and unchanged.
E.1 adds transient TypeScript contracts and a pure validator, with no domain
entities, Prisma changes, persistence, normalizer, adapters, UI or routes.

## Baseline

The initial working tree was clean on `feat/normalizer-phase-e`. After fetching
origin, HEAD, local main and origin/main all pointed to
`4782ea98b370e298577824bf5da7c3059cd42826`, the Phase D merge (#3).
Its ancestry includes D.1 `94e0e72`, D.2 `9a58364` and D.3 `82f71ba`.
The feature branch's creation reflog points to this same updated main commit.
The handover's Phase A/B next-step sections are historical; repository history,
the normative model, existing services and the verified Phase D fixtures govern
this increment. No original local profiles were loaded or copied.

## Public contract

`src/lib/normalization/contract.ts` exports:

| Type | Responsibility |
|---|---|
| `SourceStationKey` | Temporary correlation string scoped to one `NormalizationInput`. The caller allocates local tokens, never copies permanent provider IDs. No global identity/idempotency claim. |
| `SourceFact<T>`, `Assertion<T>`, `AbsentFact` | `OBSERVED` value, `ASSERTED` value, explicit `UNKNOWN` with origin, or `MISSING`. Required field envelopes make absence explicit; omitted properties and `undefined` are invalid at runtime. |
| `SourceDate` | Exact YEAR or MONTH at the stated precision, or IMPRECISE text with no numeric year. Missing/unknown endpoints use the outer fact envelope. No parser. |
| `CatalogIdentity`, `CatalogAssociation` | Typed catalog entity plus UUID; UNKNOWN, CANDIDATE with basis, or CONFIRMED with confirmation claim. Name matching is only a candidate basis. |
| `StationClassification`, `SourceStation`, `NormalizationInput` | Observations and separately asserted classification, status and ordering. A title/category/provider label supplies no verified classification. Several academic qualifications and arbitrary source array order are supported. |
| `CanonicalDegree`, `CanonicalCareerStep` | Selected canonical scalar fields, using Prisma types through type-only imports. E.1 narrows fieldOfStudy, roleCategory, functionArea and location to null until dedicated evidence exists. No identity, ownership, timestamps, source keys, contact, raw document or general notes fields. Degree catalog association is Program XOR direct Institution (or neither). |
| `UnresolvedDecision`, `DecisionField` | Field-level review needs with fixed reason codes; no personal narrative or arbitrary diagnostic text. |
| `StationOutcome`, `NormalizationResult` | One resolved Degree, one resolved CareerStep, or REVIEW_REQUIRED per source key. Resolved variants carry canonical scalars, explicit position and unresolved decisions. REVIEW_REQUIRED has a nonempty decision list and forbids canonical data/position. |
| `ContractDiagnostic`, `ContractValidation` | Stable diagnostic codes, INPUT/RESULT side, zero-based station index and optional fixed field token. |

`validateNormalizationContract(input: unknown, result: unknown): ContractValidation`
is exported from `src/lib/normalization/validate.ts`. It checks independently
supplied values; it never constructs, repairs, sorts or mutates them. The report
is not a TypeScript assertion function or a persistence authorization token.

## Unknown and review semantics

MISSING means no information supplied. UNKNOWN means an explicit statement that
the information is unknown, with observed/asserted origin retained. Neither is
an asserted default. IMPRECISE means an expression was supplied, but it supplies
no exact canonical year. MONTH loses precision only in a later explicit canonical
projection to a year; no month is invented for YEAR.

Resolved means the station kind is established, not that every field is known or
that a donation is complete. A Degree may be COMPLETED with null graduationYear;
an explicitly ENDED CareerStep may have null endYear. Missing status can be
represented by canonical UNKNOWN and an explicit unresolved status decision.
An observed attendance end can remain in source facts while canonical UNKNOWN
Degree.endYear is null and a field decision explains the withheld year.

REVIEW_REQUIRED withholds the entire canonical station, including a timeline
position. It must not contain a guessed Degree. A resolved station's field
decisions remain transient review metadata and may concern dates/status/catalogs.
The contract does not turn any unresolved decision into a confirmed fact.

In E.1, resolved classification, non-UNKNOWN status and position require explicit
assertions. Future classification/evidence policy is deferred; labels alone can
never satisfy this policy. Known canonical years must match a dedicated precise
source fact. Graduation uses `graduation`, never `end`. No reference selection
or SurveyResponse field exists, even with one eligible Degree or several awards.

## Runtime responsibilities and limits

The validator checks exact object shapes, discriminators, required properties,
enum vocabularies, nonblank text, integer year/month bounds, catalog UUID syntax,
canonical date/status/title invariants and Degree catalog exclusion. It checks
unique input keys, exactly one outcome per source, no orphan outcomes and unique
positive resolved timeline positions, without assuming chronological array order.
It rejects canonical catalog IDs unless the corresponding supplied association
is CONFIRMED and matches entity/ID. Unsupported years/status/classification/order
are diagnostics, not automatically corrected values. Withholding an exact source
year requires an unresolved field decision. Structural failures stop subsequent
correlation checks to avoid diagnosing malformed values as typed facts.

Independent review corrections add these bounded guarantees:

- **Text evidence (F1):** Non-null Degree.title and CareerStep.roleTitle must
  exactly equal a supplied OBSERVED or ASSERTED `SourceStation.title`. Missing
  or explicitly unknown title facts cannot support non-null canonical text.
  Category/provider labels cannot substitute for title evidence or establish
  classifications/catalog identities. `fieldOfStudy`, `roleCategory`,
  `functionArea` and `location` have no dedicated source facts in E.1, so both
  their types and runtime shapes require null. No additional source fields were
  introduced. Text transformations, even trimming/Unicode normalization, require
  a later specified evidence/projection policy; this validator performs none.
- **Cross-kind assertions (F2):** A resolved CareerStep rejects any ASSERTED
  Degree status, including ASSERTED UNKNOWN, and any value-bearing observed or
  asserted graduation fact, including an imprecise expression. A resolved Degree
  rejects any ASSERTED CareerStep temporal status. Absent/explicitly unknown
  graduation envelopes have no supplied date value and do not establish an
  incompatible graduation claim. These contradictions can be retained in
  REVIEW_REQUIRED with field decisions and no canonical target. Nothing is split
  or silently discarded.
- **Decision consistency (F3):** Checks run for resolved and REVIEW_REQUIRED
  outcomes. MISSING requires the corresponding source fact to be MISSING.
  IMPRECISE_DATE requires a date field with an actually supplied IMPRECISE
  expression. UNKNOWN cannot contradict a known scalar/classification/order or
  precise date; it remains a broad uncertainty reason for absent/explicitly
  unknown facts and imprecise dates, preserving the original tests. Explicit
  ASSERTED UNKNOWN status also supports UNKNOWN. Catalog envelopes never claim
  MISSING; UNKNOWN association decisions are allowed for UNKNOWN/CANDIDATE,
  while a confirmed identity contradicts that reason. Unrepresented text fields
  have missing evidence. Invalid decisions produce indexed `INVALID_DECISION`
  diagnostics without source text.

An exact observed year may still be withheld with CONFLICTING_FACTS or
STATUS_UNCERTAIN, including a graduation year pending status clarification.
These explanations are caller claims: the contract does not contain enough
provenance to prove a conflict or a human's uncertainty. Other review-reason
applicability, exhaustive same-kind assertion consistency and semantic text
truth/privacy validation remain deferred. The validator does not implement a
general conflict solver or require every null optional field to have a decision.

Static contracts prove assignability and disjoint variants for typed callers;
`contract.type-test.ts` checks prohibited assignments with `@ts-expect-error`.
TypeScript does not prove uniqueness, valid numeric ranges, catalog existence,
human confirmation or exact shapes on widened objects. Runtime mutation tests
exercise those shape/value/correlation checks that this pure helper can enforce.
Canonical scalar vocabulary validators are exhaustive against generated types;
unit execution has no generated Prisma runtime import or database dependency.

Confirmation/assertion tags are caller claims, not provenance verification. The
validator does not query catalog existence, authorize assertions or detect
personal information inside otherwise valid free text. A future trusted adapter
and review boundary must establish those facts and project only approved factual
career text. Diagnostics themselves contain no source values, source keys, UUIDs,
arbitrary property names, exceptions or timestamps; traversal order is stable for
the same input. The returned report is safe from source-text interpolation.

There is no Alumni payload in this API. Correlation keys stay on transient source
and outcome wrappers; canonical scalar shapes reject them and other extra fields.
Tests also reject Alumni/contact/provider metadata and reference-selection fields.
This proves the contract boundary, not persistence behavior: E.1 performs no
database writes. Future persistence must use explicit canonical field projection,
generate independent UUIDs and keep temporary mapping/review metadata out of the
canonical database. Contact remains a separate optional purpose.

## Compatibility with the independent D.2 oracle

All six D.2 files and D.3 integration tests remain unchanged. D.2's authored
canonical expectations have already been verified against PostgreSQL 17; they
are not production normalization output. E.1 unit tests use separately authored
small values and never derive expected answers from a normalizer.

Later work needs a **test-only source adapter**: preserve D.2 `kind`/`outcome` as
explicit factual assertions, keep labels as observations, distinguish missing
and imprecise dates, carry supplied order hints, and bind symbolic catalog keys
to explicit test catalog UUIDs. D.2 states catalog associations as confirmed
identities; name equality cannot supply this binding. Level aliases still need
an independently specified interpretation policy; an adapter must not derive a
classification from the expected oracle. D.2 nulls mean no asserted value and
cannot retrospectively prove an explicit UNKNOWN source statement.

A separate **comparison harness** must project future results to D.2 symbolic
target keys, canonical field subsets, mappings, timeline and review decisions.
E.1 embeds the canonical payload in each outcome, while D.2 stores stations,
timeline and mappings separately. D.2 prose questions/reasons need an explicit
test mapping to E.1 field/reason tokens. These adapters/harnesses are not added
in E.1, and the oracle must not be rewritten to fit an implementation.

| D.2 case | Eventual contract exercise |
|---|---|
| 01 | Two resolved Degrees; distinct Programs; no highest/latest reference selection. |
| 02 | Degree plus overlapping EMPLOYMENT; MONTH facts project to years; timeline gap retained. |
| 03 | Vocational assertion yields CareerStep, not Degree. |
| 04 | In-progress Degree plus exchange EDUCATION; no duplicate qualification. |
| 05 | Completed PhD with direct Institution and missing graduation year/field decision. |
| 06 | Independent academic certificate versus nondegree course. |
| 07 | Explicitly ongoing employment, not inferred from a missing end. |
| 08 | Self-employment and volunteering; unknown Organisation stays unassigned. |
| 09 | Imprecise/missing dates, unknown status, withheld attendance end, explicitly ended undated internship. |
| 10 | Matching Organisation label without confirmed identity stays null. |
| 11 | Two candidate awards; revised order independent of years/source order; neither selected. |
| 12 | REVIEW_REQUIRED with field decisions, no canonical station or timeline item. |

## Deferred E.2–E.5 and later questions

- Exact phase allocation remains to be agreed: source adapters/vocabularies, raw
  date parsing/error cases, classification/evidence rules and a D.2 comparison
  harness are future increments, not implied implementations here.
- Split, merge and semantic duplicate resolution are deliberately unsupported.
  E.1 permits one source to one canonical station only; repeated source outcomes
  fail. Multiple distinct stations may overlap and must not be deduplicated by
  dates, labels or catalog names. A future graph/correlation contract is needed.
- Catalog candidate discovery, existence checks, trustworthy confirmation and
  resolving conflicting assertions need a review protocol. Assertion precedence,
  review responses, revalidation and temporary data retention are unspecified.
- Timeline changes after review, independently observed versus asserted order,
  and provenance for algorithmic suggestions need separate policies. Current
  resolved positions require explicit assertions; source order is not chronology.
- Survey-context reference eligibility and explicit human reference confirmation
  remain separate from normalization, under the existing service guarantees.
- Provider/CV/manual adapters, contact collection, persistence/import orchestration,
  SurveyResponse creation, UI, AI and authentication remain outside E.1.

## TDD and review patch

The unchanged D.2 suite first passed 49 tests. With the new types/tests and a
permissive validator stub, E.1 demonstrated RED: **42 failed / 14 passed**. After
implementing validation, all **56 initial tests passed**. Additional edge-case
coverage brought E.1 to **70 passing tests**. Compile-time negative assignments
are checked separately by `npm run typecheck`, not counted as Vitest tests.

Independent review F1–F3: the original 70 tests first passed. Focused regression
tests demonstrated **41 failed / 77 passed (118 total)** against the unchanged
validator, with each contradictory reason/evidence pair exercised independently.
After the bounded corrections, **all 118 E.1 tests passed**, including the
original 70. The CareerStep helper now supplies its existing canonical title as
a source fact; the explicit-ENDED test now records missing years rather than
incorrectly describing its asserted status as missing. All original test
assertions remain. Four additional compile-time checks enforce null-only fields.

Final verification after F1–F3 on 2026-10-15 with Node 22.23.3: **237 unit tests** and
**363 integration tests** passed. Integration used the existing disposable
PostgreSQL 17 runner, applied all five unchanged migrations and removed its
container. `npm run db:validate`, `npm run lint`, `npm run typecheck`,
`npm run build` and `git diff --check` passed. No required check was skipped.
The complete five-file review patch is generated from `git diff HEAD`, covering
all E.1 content rather than only the corrections. No commit or push was performed.

Exact targeted review patch files (all new):

```text
docs/architecture/PHASE_E1_NORMALIZATION_CONTRACT.md
src/lib/normalization/contract.ts
src/lib/normalization/contract.type-test.ts
src/lib/normalization/validate.ts
src/lib/normalization/validate.test.ts
```
