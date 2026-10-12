# Phase D.1 — Synthetic Fixture Structural Audit

The [MVP Domain Model](MVP_DOMAIN_MODEL.md) remains normative. This audit inventories
the supplied snapshot/expected pairs; it does not normalize, validate human
confirmation, create domain objects or persist data. The expected file is an
intermediate station representation, not a canonical Prisma fixture or an approved
SurveyResponse oracle.

## Reproduction and report contract

Use the project's Node 22 version and run from the repository root:

```sh
node --experimental-strip-types scripts/audit-phase-d-fixtures.mjs
```

Defaults are the read-only, untracked inputs:

- `.local-fixtures/phase-d/all_linkedin_snapshots.json`
- `.local-fixtures/phase-d/all_expected_normalized.json`

Two explicit file arguments may replace these paths. The command reads both files,
prints deterministic JSON and exits 0 for structurally valid inputs or 1 for
errors. It reports byte counts and SHA-256 fingerprints, never source text, source
IDs, arbitrary field keys, input paths or exception messages. Invalid JSON and
file-read failures are sanitized; malformed input is never repaired.

`auditFixturePair(snapshots, expected)` in `src/lib/fixture-audit.ts` accepts parsed
JSON as `unknown` and returns `ok`, `inventory`, `errorCounts` and `diagnostics`.
Diagnostics identify the input and zero-based array indexes, with fixed field
names where applicable. Their order follows input traversal; no timestamps or
random values enter the report. To investigate a diagnostic, inspect the indexed
record locally without copying its content into a report.

The unit tests author small in-memory examples and temporary CLI inputs. They do
not load the local corpus; a fresh checkout can run CI without either JSON file.
`.local-fixtures/` is ignored in the repository as well as the existing local Git
exclude. Never include either original JSON file in a patch or commit.

## Inventory of the supplied inputs

| Measure | Observed count |
|---|---:|
| Snapshot entries / unique synthetic IDs | 100 / 100 |
| Expected entries / unique synthetic IDs | 100 / 100 |
| Matching IDs / IDs present on only one side | 100 / 0 |
| PROFILE records | 100 |
| Source EDUCATION records / expected EDUCATION stations | 195 / 195 |
| Source POSITIONS records / expected POSITION stations | 237 / 237 |
| Total expected stations | 432 |
| MSI anchors with existing station references | 100 |
| Structured date endpoints with YEAR precision | 385 |
| Structured date endpoints with MONTH precision | 369 |
| NULL date endpoints | 110 |
| Stations marked current: EDUCATION / POSITION | 5 / 105 |
| Education level hints matching canonical DegreeLevel tokens | 182 |
| Education level hints outside DegreeLevel: VOCATIONAL | 13 |
| Position employment-form hints matching CareerStepType tokens | 25 |
| Position employment-form hints requiring a different vocabulary | 212 |
| Structural diagnostics | 0 |

Each of the 432 stations contributes two date endpoints, giving
**864 = 385 + 369 + 110**. Matching token counts describe
vocabulary only; they do not establish valid Degrees, CareerSteps or completion.
The reusable audit does not hard-code 100 profiles or require gapless ordering.

Fingerprints of the read-only files used for this inventory:

| Input | Bytes | SHA-256 |
|---|---:|---|
| Snapshots | 262952 | `c218dd34ef364e9e76d4bc470c35c1ef7a6391ed5ef1895045b3950759df6aef` |
| Expected | 479425 | `f5cb2d130a8755ae81ddbefa90b3bb65d7e04c35434303473779ad103d9293f0` |

## Structural findings and boundaries

The recognized local format is `LINKEDIN_MEMBER_SNAPSHOT_SYNTHETIC_V1` on expected
entries, paired with snapshot `elements` containing exactly one PROFILE,
EDUCATION and POSITIONS domain. This is recognition of the supplied fixture
format, not a claim of compatibility with an official LinkedIn API.

Both roots are arrays of objects. Each entry requires an opaque, nonblank string
`syntheticId`; IDs are unique within each input and both ID sets match exactly.
No ID trimming, case folding, UUID conversion or identity inference occurs.

Source domain data must be arrays of records, with exactly one PROFILE record.
PROFILE content is opaque: personal fields are not required or mapped. Source
education records require string school/qualification and start/end fields;
position records require string company/title and start/end fields. Empty date
strings are allowed. Raw date text is type-checked without parsing its meaning.

Expected entries require a profile object, the recognized source format, a
stations array and an anchor with a station reference. Each station requires a
nonblank station ID, EDUCATION/POSITION discriminator, positive integer
`chronologyIndex`, boolean `isCurrent`, text-typed title/organization/classification
fields and both date endpoint fields. Station IDs and chronology indexes are
unique within a profile, with reuse allowed across profiles. Gaps and array order
different from chronology-index order are allowed. Optional station text/boolean
metadata and optional summary counts/flags are type-checked when present.

An endpoint is NULL or `{year, month, precision}`: year is an integer in 1..9999;
YEAR precision requires NULL month; MONTH requires an integer month in 1..12.
Optional anchor years are NULL or integers in 1..9999. All declared anchors
resolve to stations. Existence alone does not prove that the target is an eligible
Degree; the audit intentionally allows any existing station target.

These checks do not compare narrative content between inputs, prove one-to-one
station correspondence, validate category semantics, infer completion, verify
date parsing, enforce temporal status/year relationships or confirm the reference.
Source/expected aggregate station counts agree, but that alone does not prove the
expected normalization is correct. A structurally valid report is not permission
to persist the expected representation unchanged.

Diagnostic code families:

| Area | Codes |
|---|---|
| Inputs and identity sets | `INPUT_NOT_ARRAY`, `INVALID_ENTRY`, `INVALID_SYNTHETIC_ID`, `DUPLICATE_SYNTHETIC_ID`, `ID_SET_MISMATCH` |
| Snapshot structure | `INVALID_SNAPSHOT_STRUCTURE`, `INVALID_SOURCE_ELEMENT`, `UNEXPECTED_SOURCE_DOMAIN`, `DUPLICATE_SOURCE_DOMAIN`, `MISSING_SOURCE_DOMAIN`, `INVALID_SOURCE_DATA`, `INVALID_PROFILE_RECORD_COUNT`, `INVALID_SOURCE_RECORD`, `INVALID_SOURCE_DATE` |
| Expected format/stations | `UNEXPECTED_SOURCE_FORMAT`, `INVALID_EXPECTED_PROFILE`, `INVALID_STATIONS`, `INVALID_STATION`, `INVALID_STATION_ID`, `DUPLICATE_STATION_ID`, `INVALID_SUMMARY` |
| Anchor, dates and order | `INVALID_ANCHOR`, `ANCHOR_STATION_NOT_FOUND`, `INVALID_ANCHOR_YEAR`, `INVALID_DATE`, `INVALID_CHRONOLOGY_INDEX`, `DUPLICATE_CHRONOLOGY_INDEX` |
| Command input failures | `FILE_READ_FAILED`, `INVALID_JSON`, `INVALID_ARGUMENTS` |

## Mapping assessment

“Direct” below means a structurally compatible value or hint, not authorization
to persist it. No mapping in this table is implemented by D.1.

| Source or expected concept → canonical target | Classification | Assessment |
|---|---|---|
| EDUCATION → Degree or CareerStep | Ambiguous | Academic qualifications are Degrees; vocational training, exchanges and courses without an independent qualification are CareerSteps. Do not create a Degree for every EDUCATION row or duplicate a Degree as EDUCATION. |
| Academic `degreeLevel` token → Degree.level | Direct | 182 hints use canonical tokens, conditional on the station actually being a Degree. Raw qualification titles still need interpretation; matching a token does not prove an award. |
| VOCATIONAL level hint → CareerStep.type | Requires semantic transformation | 13 EDUCATION rows use a non-Degree level hint. Assess vocational training versus other learning; do not coerce the hint into Degree.OTHER. |
| OTHER qualification → Degree or nondegree learning | Ambiguous | An independent academic qualification may be CERTIFICATE/OTHER; a course without one is EDUCATION. OTHER/DIPLOMA require a factual title. |
| `isCurrent` and education end date → Degree.status | Ambiguous | A past date or `false` does not distinguish COMPLETED, ENDED_WITHOUT_DEGREE and UNKNOWN. A current hint requires semantic assessment of IN_PROGRESS. |
| Education end date → Degree.graduationYear | Not available in source | There is no separate authoritative graduation field. Do not equate attendance ending with graduation or invent a year; a completed reference may have unknown graduationYear. |
| POSITION → CareerStep | Requires semantic transformation | Choose the appropriate canonical type from factual activity. EMPLOYED and SELF_EMPLOYED are aliases, not canonical enum values; inactivity cannot be inferred from gaps. |
| INTERNSHIP employment-form hint → CareerStep.type | Direct | 25 hints match a canonical type token, subject to factual review. Role categories and employment forms are not interchangeable. |
| Current/end hints → CareerStep.temporalStatus | Ambiguous | Distinguish ONGOING, ENDED and UNKNOWN. Unknown end dates do not imply ongoing work; ENDED may have NULL endYear. ONGOING/UNKNOWN require NULL endYear. |
| Education school / generic organization labels → Institution | Requires semantic transformation | The shared legacy organization field mixes education providers and employers. Resolve a confirmed education catalog association; an unknown catalog can remain NULL. |
| Qualification/field labels → Program | Ambiguous | Labels are not catalog IDs and fieldCategory is not a Program identity. Resolve a canonical Program or a direct Institution, never both on a Degree. |
| Program ID and faculty affiliation | Not available in source | No authoritative canonical Program ID or faculty scalar is supplied. Use catalog selection and trusted operator configuration; do not derive affiliation from profile text or names. |
| Position company / organization labels → Organisation | Requires semantic transformation | Confirm catalog IDs after future text normalization. Names are not globally unique and must not drive automatic merging or artificial Unknown rows. |
| Position title → CareerStep.roleTitle | Requires semantic transformation | Preserve the factual role after future trimming/Unicode normalization. Generic descriptions are not a canonical notes field; OTHER requires a factual title. |
| Field, position and branch categories → fieldOfStudy, roleCategory, sector | Ambiguous | Existing category vocabularies are intermediate hints. Confirm their meaning and ownership; a branch hint is not automatically an Organisation sector. |
| YEAR/MONTH endpoints → startYear/endYear | Requires semantic transformation | Canonical dates retain years only. Preserve unknown values and do not fabricate months, exact dates or graduation. D.2 must establish raw date parsing separately. |
| `chronologyIndex` → AlumniTimelineItem.position | Direct | Positive unique integers can provide an ordering hint and may retain gaps. Do not sort solely by dates; overlaps are allowed and user revisions must remain possible. |
| Station IDs/type → Timeline target references | Requires semantic transformation | Resolve Degree versus CareerStep and later canonical UUID targets; the Timeline stores only order and references, with owner checks and XOR. |
| `relationToMsi`, `isMsiAnchor` → relative grouping | Requires semantic transformation | There are no corresponding persisted canonical station fields. Grouping is derived relative to the confirmed reference; source hints cannot supply it authoritatively. Do not add legacy flags or copied data. |
| MSI labels/anchor → Survey.referenceProgramId | Not available in source | The selected Survey defines an existing immutable Program. MSI hints do not supply trusted catalog IDs or operator affiliation. |
| `msiAnchor.stationId` → SurveyResponse.referenceDegreeId | Must be explicitly confirmed by the user | Even one candidate requires explicit selection and affirmative confirmation. Validate own COMPLETED Degree, Program fit, OPEN Survey and operator scope through the existing services. Never auto-select the anchor. |
| Source IDs → domain primary keys/timestamps | Not available in source | Generate random UUIDs and server timestamps later. Fixture/provider IDs are transient correlation hints, not canonical identity or access credentials. |
| Contact collection purpose/authorization → optional AlumniContact | Not available in source | Contact has a separate optional purpose; imported name-like fields do not establish that purpose or permission to collect contact. Email/notification consent is not established by this fixture. |

Excluded mappings: firstName, lastName and provider identifiers have no permitted
Alumni target. They remain opaque and must never be used to populate Alumni or
match identities. Their presence also does not trigger automatic AlumniContact
creation.

## Ambiguities, privacy and provenance limits

The files contain name-like fields, headlines, summaries, descriptions and other
profile-shaped fields. “Synthetic” filenames, IDs and the source-format label do
not establish that those values were generated without personal data. No
generator/provenance evidence was supplied for this audit, and structure checking
cannot establish absence of personal information or rights to reuse it.

The report deliberately omits these values, original IDs and entire source
records. Whole-file fingerprints establish reproducibility only; they are not
provenance or privacy certification. Unknown extra fields remain opaque, so the
audit is not a personal-data detector. Keep the original files local and read-only;
do not promote them to CI fixtures, production seeds, imported profiles or review
patches. D.2 tests should continue to use newly authored minimal examples.

The major unresolved semantic questions are qualification versus training/course,
completion versus attendance ending, category vocabularies, canonical catalog
identity and explicit reference confirmation. None is resolved by the 100 anchors
or by a zero-error structural audit.

## Proposed D.2 tests and explicitly deferred decisions

Proposed minimal, newly authored normalization cases:

1. Academic Degree, vocational training and nondegree course/exchange records;
   independent concurrent employment must survive without duplicating a Degree.
2. Degree level aliases and ambiguous OTHER qualifications; factual titles for
   DIPLOMA/OTHER and CareerStep OTHER; ambiguous completion must remain unresolved.
3. Employment, internship, student work, self-employment and unknown activities;
   semantic aliases must not create new enum values or infer unemployment from gaps.
4. Year-only, month precision, empty/unknown dates, invalid ranges, reversed years
   and overlaps; unknown end versus ongoing must stay distinct. Do not infer
   graduationYear from education endYear.
5. Missing catalogs, identical organization names and ambiguous Program names;
   Degree Program/direct Institution exclusion, NULL associations and exact operator
   faculty boundaries must survive normalization.
6. Timeline gaps, revised ordering and split/reclassified stations; preserve
   ownership and exactly one target without copying station details.
7. An anchor pointing to training, an ineligible Degree, multiple eligible Degrees
   or a single eligible Degree; none may become a confirmed reference automatically.
8. Profile/provider identifiers and narrative text must not reach Alumni, canonical
   notes or reports; optional contact stays separate and is never inferred.

Deferred: normalization API and algorithms, supported raw date/text vocabularies,
semantic duplicate detection, catalog resolution/confirmation workflow, source
station correlation after reclassification, donation persistence orchestration,
user interaction/authorization, configuration deployment wiring, contact/consent
collection, provenance verification and retention rules. No API integration,
scraping, database writes, new models/migrations, UI or AI services are implemented.

D.1 is structurally ready for D.2 test design. This readiness does not resolve
semantic ambiguity or authorize publishing/persisting the original corpus.
