# Phase E.3b — Independent D.2 career fixture comparison

The [MVP Domain Model](MVP_DOMAIN_MODEL.md) remains normative. This test-only
increment starts on `feat/normalizer-phase-e` at verified baseline
`98aadee2ce61a2bd750aca434ec08c879a862a63`, with an initially clean working tree.
The D.2 oracle, E.1–E.3a implementation, schema and migrations remain unchanged.

## Evidence boundary and adapter

`src/test-fixtures/canonical-careers/normalization-adapter.ts` adapts only the
independently authored `SyntheticInputProfile`. It has no runtime imports from
`expected.ts`, `catalog.ts` or the normalizers. Its type-only fixture-contract
import does not load the oracle. The comparison test supplies the existing
12 `careerCases` to the adapter and calls `normalizeCareerBatch` unchanged.

D.2's declared synthetic `kind` and `outcome` meanings are translated explicitly:

| D.2 evidence | E.1 evidence |
|---|---|
| `academic` | ASSERTED DEGREE classification, requiring additional explicit level evidence below |
| `vocational` | ASSERTED CAREER_STEP / VOCATIONAL_TRAINING |
| `exchange`, `course` | ASSERTED CAREER_STEP / EDUCATION |
| `employment`, `internship`, `self-employment`, `volunteering` | Corresponding explicitly asserted CareerStep type |
| `unclear` | MISSING classification; no guessed target |
| Academic `awarded`, `studying`, `left-without-award` | ASSERTED COMPLETED, IN_PROGRESS, ENDED_WITHOUT_DEGREE respectively |
| Career activity `ongoing`, `ended` | ASSERTED ONGOING, ENDED respectively |
| `unspecified` | MISSING status evidence, retaining uncertainty |
| YEAR / MONTH / IMPRECISE dates | Copied OBSERVED date facts with unchanged precision |
| Null date | MISSING, not an explicit UNKNOWN assertion |
| `timelinePosition` | ASSERTED supplied positive integer; absence fails instead of generating a position |

Labels, categories and provider labels remain observations. They never certify a
level, status, graduation, classification or catalog identity. No title parser or
date parser is present. Date objects are copied; station order is preserved.
No end-of-attendance fact becomes graduation or completion evidence.

`academicLevels`, in the same test-only adapter file, is a small separate sidecar
of **additional, independently authored synthetic assertions**. D.2 `academic`
does not itself assert a DegreeLevel. These are newly supplied test facts, not
facts recovered from LinkedIn, titles, provider labels, oracle mapping targets,
`expected.ts` or canonical results:

| Case | Source key | Additional asserted level |
|---|---|---|
| 01 | source-bachelor | BACHELOR |
| 01 | source-master | MASTER |
| 02 | source-study | BACHELOR |
| 04 | source-study | BACHELOR |
| 05 | source-doctorate | PHD |
| 06 | source-certificate | CERTIFICATE |
| 09 | source-uncertain-study | BACHELOR |
| 11 | source-first-award | BACHELOR |
| 11 | source-second-award | BACHELOR |

Tests require exactly these nine academic case/source pairs. Supplying no level
evidence fails closed even when a label sounds like a degree level. Changing
labels does not alter the sidecar assertion, status or graduation evidence.
Compatibility therefore holds for D.2 inputs **plus these declared assertions**;
it does not prove the original inputs alone establish academic levels.

`testCatalogIds` is a separate deterministic test-only UUID catalog: three
Institutions, two Programs and two Organisations. The seven IDs are unique and
have no persisted rows. Two same-name Institutions retain different identities.
Only an explicit D.2 `catalogAssociation` becomes CONFIRMED / TRUSTED_INPUT, as a
declared fixture trust assumption. Unknown keys fail. Null association becomes
UNKNOWN even when the provider label matches a known Organisation. The adapter
performs no name matching, lookup service, ID generation or database operation.

## Independent projection and comparison

`normalization-comparison.test.ts` validates every complete input/result pair
with the existing E.1 validator, then projects actual canonical values into the
D.2 scalar representation. The projection copies actual levels, types, statuses,
titles, years and positions; reverses test catalog UUIDs; and checks E.1's
unrepresented optional canonical text fields remain null. It does not derive
expected scalar values from the normalizer.

D.2 mapping target keys supply only symbolic labels for correlation by source
key. Expected mapping target kind is checked before assigning a label. Full
Degree/CareerStep scalar arrays and timeline target/position arrays are compared
to the unchanged independently authored oracle. Sorting copies for keyed and
position comparisons does not sort inputs or normalization output: both source
key sequences are separately required to match the original source array exactly.
Snapshots check source/fixture immutability and copied dates have no mutable
source reference. E.1 also enforces exact canonical shapes and mappings.

Reference candidates are checked separately using actual projected COMPLETED
Degrees associated with the fixture Survey's reference Program, under the
fixture's common Alumni ownership. All eligible symbolic Degree keys must match
D.2's candidate set, including both candidates in case 11. No reference is
selected or confirmed, and no SurveyResponse, Alumni or persistent station ID is
created. Temporary source keys remain only in normalization wrappers.

## Exact unresolved-decision comparison policy

D.2's human-readable summaries and E.1's fixed field/reason decisions are
different representations. The harness does not compare prose strings with
reason codes and does not require equality between these two schemas.

For resolved stations, every D.2 unresolved field must correspond to an E.1
decision. `programKey`, `institutionKey` and `organisationKey` map to
`catalogAssociation`; duplicate aliases collapse into that one decision. Other
fields retain their names. Independently authored `correspondingDecisions`
requires exact field/reason pairs: MISSING graduation for case 05; case 09's
MISSING statuses/dates, IMPRECISE_DATE start, STATUS_UNCERTAIN attendance end and
UNKNOWN associations; and case 10's UNKNOWN association. A missing required
field, wrong reason or additional unlisted decision fails comparison.

E.1 also emits optional-field decisions absent from D.2's summaries. The closed
`additionalDecisions` allowance requires exactly these seven decisions:

| Case / source | Required additional E.1 decisions |
|---|---|
| 04 / source-study | endYear MISSING; graduationYear MISSING |
| 04 / source-exchange | catalogAssociation UNKNOWN |
| 06 / source-course | catalogAssociation UNKNOWN |
| 07 / source-current-work | endYear MISSING |
| 08 / source-independent-work | endYear MISSING; catalogAssociation UNKNOWN |

These decisions are asserted, not discarded or allowed by an open-ended filter.
There must be no duplicate decision fields or overlap with corresponding fields.

Case 12 has a deliberate representation difference: D.2 lists seven dependent
unresolved fields (`classification`, `level`, `status`, `temporalStatus`,
`endYear`, `graduationYear`, `catalogAssociation`), while E.3a's first-blocking
review emits only `classification / CLASSIFICATION_UNCERTAIN`. The comparison
uses an explicit **classification dependency barrier** policy: assert that exact
seven-field D.2 summary, its review mapping/questions, and the exact single E.1
classification decision. Require no canonical target or position. Every listed
dependent field consequently remains undecided; the test does not claim seven
emitted E.1 decisions. Removing a D.2 dependency or inventing extra review
decisions fails a negative test. A future detailed review inventory would need a
separate contract decision; this increment does not change first-blocker behavior.

All 12 fixtures are representable under the declared supplemental evidence and
comparison policy. No unsupported inference or oracle correction was required.

## Coverage, TDD and limits

Coverage is 12 cases, 20 source stations, nine Degrees, ten CareerSteps,
19 explicit timeline items and one target-free review. The suite checks all
canonical scalars and catalog associations, source-to-target types/correlation,
array order, parallel study/employment, timeline gaps, imprecise/missing years,
completed PhD without graduation year, vocational versus academic training,
certificate versus nondegree course, unconfirmed Organisation labels and
multiple eligible reference Degrees. It checks 21 E.1 decisions, including the
seven additional decisions above.

The unchanged focused catalog/batch suites first passed 93 tests. Against an
unimplemented adapter/comparison harness, the new suite demonstrated actual
RED: **46 failed / 2 passed (48 total)**. Implementation reached **48 passed**.
Thirteen negative/mutation tests first prove their originals compare correctly,
then keep the changed input/result pair E.1-valid while requiring oracle
comparison to fail. They cover Degree level, completion, date, catalog identity,
position, target type, output order, missing/wrong/extra decisions and the
classification dependency policy. This distinguishes independent semantic
comparison from merely repeating the E.1 validator.

The test-only adapter is typed for D.2 fixtures, not a general runtime/provider
input boundary. Authorship and catalog trust remain declared assumptions; tests
cannot prove real-world source truth or privacy of arbitrary text. The compact
D.2 set does not add DIPLOMA/OTHER Degrees, ENDED_WITHOUT_DEGREE, unemployment or
all CareerStep types; existing E.2 suites retain their separate coverage. This
does not specify review responses, source extraction, trust establishment,
split/merge/duplicate resolution, completed donations or persistence. No domain
architecture change was needed.

## Review files

Final verification on 2026-10-15 with Node 22.23.3: **447 unit tests** and
**363 integration tests** passed. Integration used the existing disposable
PostgreSQL 17 runner, deployed all five unchanged migrations and removed its
container. `npm run db:validate`, `npm run lint`, `npm run typecheck`,
`npm run build` and `git diff --check` passed. Individual new-file whitespace
checks also passed. No required check was skipped. The complete patch was checked
and applied to a clean export of HEAD, reproducing all three files byte for byte.

The complete targeted patch against HEAD contains only these new files:

```text
src/test-fixtures/canonical-careers/normalization-adapter.ts
src/test-fixtures/canonical-careers/normalization-comparison.test.ts
docs/architecture/PHASE_E3B_D2_COMPARISON.md
```

No commit or push is performed. Stop for independent review before another increment.
