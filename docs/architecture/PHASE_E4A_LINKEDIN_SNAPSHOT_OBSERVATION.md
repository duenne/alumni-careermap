# Phase E.4a — LinkedIn-shaped snapshot observations

The [MVP Domain Model](MVP_DOMAIN_MODEL.md) remains normative. This increment
starts on `feat/normalizer-phase-e` at verified baseline
`236aa033030c9c4977c6f89daa51855e7963cd1e`, with a clean working tree. E.1–E.3b,
the D.2 oracle, Prisma schema and migrations remain unchanged.

## Boundary and supported structure

`adaptLinkedInSnapshot(snapshot: unknown): NormalizationInput` in
`src/lib/normalization/adapt-linkedin-snapshot.ts` is a small pure adapter for
already parsed JSON-like values. It observes a single member snapshot in the
example format. It does not parse JSON bytes, retrieve a profile, authorize an
import or create canonical career data.

The accepted envelope has exactly the root key `elements`, whose array has
exactly three elements. Each element has exactly `snapshotDomain` and
`snapshotData`. There must be exactly one of each case-sensitive domain:
PROFILE, POSITIONS and EDUCATION. Domain order may vary.

- PROFILE data is an array containing exactly one non-null, non-array object.
  Its contents are entirely opaque: no property is enumerated, read, required,
  mapped or retained. An empty object is valid.
- POSITIONS and EDUCATION data are arrays of non-null, non-array objects; empty
  arrays are valid. Each station requires its four own, string-valued fields
  listed below. Missing fields, nulls and non-string values are rejected.
- Extra station fields are ignored without reading their values, including
  Description, Location, Activities, Notes and provider identifiers. Extra root
  or element-envelope keys, unknown domains, duplicate/missing domains and sparse
  array entries are rejected. No partial result is returned on invalid input.

This deliberately bounded schema follows the example structure recognized by
the [D.1 audit](PHASE_D1_FIXTURE_AUDIT.md), without its outer corpus wrapper,
synthetic IDs or expected intermediate station format. D.1 is not reused as a
parser or classifier. The adapter makes no claim to cover every official
LinkedIn API response variant. Decoration documentation does not define this
snapshot schema. No original local corpus or personal profile is loaded.

Malformed input throws the fixed error `Invalid LinkedIn-shaped snapshot contract`.
Errors do not include field values, arbitrary keys, identifiers, source text,
raw records or chained causes. The function does not log. As in E.1/E.3a, the
runtime boundary covers parsed JSON-like data, not adversarial JavaScript
proxies, getters on consumed envelope/observation fields or custom iterators.
PROFILE properties and ignored station properties are never accessed.

## Observation mapping

| Domain | Source fields | E.1 observations |
|---|---|---|
| POSITIONS | Title; Company Name; Started On; Finished On | title; providerLabel; start; end |
| EDUCATION | Degree Name; School Name; Start Date; End Date | title; providerLabel; start; end |

Nonblank title/provider strings are retained verbatim as OBSERVED, including
their whitespace and Unicode form. Empty or whitespace-only title/provider
strings become MISSING because E.1 does not accept blank observed text.
`category` records only the observed domain token. This is source categorization,
not verified classification. No data comes from PROFILE, descriptive fields or
location fields, and no field lacking dedicated E.1 evidence is populated.

Every station has MISSING `classification`, `degreeStatus`, `temporalStatus`,
`graduation` and `position`, and UNKNOWN `catalog`. EDUCATION alone never becomes
a Degree, and a qualification title supplies neither level nor completion.
Attendance end never becomes graduation or proof of an award. An empty employment
end never implies ONGOING. Matching school/company labels do not confirm any
catalog identity. There is no inference of employment type, unemployment, Survey
context, reference Program or reference Degree.

Keys are `snapshot:<elementIndex>:<recordIndex>`, using zero-based structural
indexes in the supplied envelope. PROFILE contributes no station. Keys are
deterministic, unique within this snapshot, ephemeral and independent of provider
IDs or personal text. Domain and record traversal order is retained. No sorting,
chronological inference, merging, splitting or timeline position allocation
occurs, even for overlapping or reversed observed periods.

## Conservative date policy

Date fields must be strings. Trim outer JavaScript whitespace before interpreting
them. Whitespace-only and empty strings become MISSING, not explicit UNKNOWN.
The entire trimmed string must match one supported form to become precise:

| Input after trimming | Observation |
|---|---|
| Exactly four ASCII digits, year 0001 through 9999 | YEAR with numeric year |
| Exactly `Jan`/`Feb`/`Mar`/`Apr`/`May`/`Jun`/`Jul`/`Aug`/`Sep`/`Oct`/`Nov`/`Dec`, one ASCII space, four-digit year 0001–9999 | MONTH with numeric month and year |
| Any other nonblank string | IMPRECISE with the trimmed text, no year/month |

For example, `Mar 2023` is MONTH; `2023` is YEAR. `March 2023`, `mar 2023`,
`Sept 2023`, `Mar  2023`, ISO day dates, `0000`, five-digit years, ranges,
`Present`, `unknown` and malformed expressions all remain IMPRECISE. Unsupported
syntax is not repaired and embedded numeric years are not extracted. Precise
observations remain observations, not canonical status/year assertions. The
adapter neither compares station date order nor fabricates a graduation date.

## E.1 validation and downstream behavior

The adapter constructs fresh E.1 objects and validates its complete output with
`validateNormalizationContract`. Because E.1 exposes combined input/result
validation, it supplies a temporary target-free classification review per source,
following the E.2/E.3a prevalidation pattern. These validation reviews are not
returned as extra input metadata. A validation failure uses the same fixed error.

Passing the output to unchanged `normalizeCareerBatch` yields exactly one
REVIEW_REQUIRED per nonempty source station, with
`classification / CLASSIFICATION_UNCERTAIN`, no canonical target and no position.
This is the existing first-blocker behavior, not a complete inventory of every
missing fact. Empty station arrays yield an empty valid batch. Explicit reviewed
classification and position evidence, plus any necessary status/catalog facts,
must be supplied in a later increment before safe canonical resolution.

The adapter does not mutate source arrays or records and retains no mutable
references to raw data. Only career observations and local keys appear in E.1
wrappers; no raw document, profile, persistent station ID, contact data,
SurveyResponse or reference selection is returned. There are no network calls,
database operations, AI, catalog lookup or new dependencies.

## Synthetic tests, TDD and remaining questions

`src/test-fixtures/linkedin-snapshots/fictional-member.json` was independently
authored for E.4a. Its four stations, profile-shaped personal markers and excluded
metadata are entirely fictional. It contains no copied D.1 source records or D.2
expected values. Tests use it and small independent mutations; they do not load
`.local-fixtures/` or call a provider.

The unchanged batch and D.2 comparison suites first passed 92 tests. Against the
empty adapter stub, the new suite demonstrated **95 failed / 5 passed (100 total)**.
After implementation all **100 passed**, and TypeScript checking passed. Tests
cover multiple stations, all twelve supported months, exact year bounds, blank
and unsupported dates, malformed envelopes/fields, deterministic redacted errors,
opaque PROFILE properties, excluded metadata, unchanged ordering, frozen inputs,
no retained source references, and exact observation-only output. Every successful
JSON-like test path checks E.1 validation, input immutability and downstream
target-free batch outcomes. A separate opaque-property test proves PROFILE field
getters are not read without invoking the snapshot helper that clones input.

No blocking domain conflict was found. Broader snapshot variants, localized date
formats, semantic classification, review-response/evidence enrichment and catalog
trust establishment remain separate decisions. Combining several snapshots would
need an explicit batch-local key namespace; these index keys are not stable IDs
across edits or snapshots. Resource limits and byte-level JSON parsing belong to
a future ingestion boundary. Arbitrary observed career/date text is not inspected
for hidden personal information; this adapter is not a semantic privacy detector.
Real source access, permissions, provenance/retention and production import remain
outside this increment. No change to the canonical model is needed.

## Targeted review files

Final verification on 2026-10-15 with Node 22.23.3: **547 unit tests** and
**363 integration tests** passed. Integration used disposable PostgreSQL 17,
applied all five unchanged migrations and removed its container. Prisma
validation, lint, typecheck, production build, `git diff --check` and individual
new-file whitespace checks passed. No required check was skipped. The complete
patch was checked and applied to a clean export of HEAD, reproducing all four
files byte for byte.

The complete patch against HEAD contains only these four new files:

```text
src/lib/normalization/adapt-linkedin-snapshot.ts
src/lib/normalization/adapt-linkedin-snapshot.test.ts
src/test-fixtures/linkedin-snapshots/fictional-member.json
docs/architecture/PHASE_E4A_LINKEDIN_SNAPSHOT_OBSERVATION.md
```

No commit or push is performed. Stop for independent review before another increment.
