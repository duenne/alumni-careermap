# Phase D.2 canonical synthetic career fixtures

These 12 profiles were newly written for D.2 using neutral, fictional labels and
invented career facts. No source record, text, identifier or expected result was
copied from the local D.1 corpus or from legacy personal data. The provenance
literal records this authorship declaration; a test cannot independently prove
provenance. Review the committed source and this declaration together.

The [MVP Domain Model](../../../docs/architecture/MVP_DOMAIN_MODEL.md) is normative.
The [D.1 audit](../../../docs/architecture/PHASE_D1_FIXTURE_AUDIT.md) checks the
structure of a separate local dataset; its zero diagnostics do not establish
semantic correctness or permission to publish those records. D.2 does not load
that dataset, depend on `.local-fixtures/`, or reuse its provider-shaped format.

## Contract

- `contract.ts` defines the small test-only representation. Degree and CareerStep
  enum/scalar types come from generated Prisma types. It adds no domain entity.
- `inputs.ts` contains independent fictional source histories. `kind` and
  `outcome` are explicitly supplied source facts, not inferred classifier output.
  `academic` describes a degree study/independent academic qualification, without
  asserting completion. Labels distinguish Bachelor, Master, PhD and certificate.
- `expected.ts` contains the separately authored canonical oracle. No expected
  station, status, date, candidate or ordering is calculated from the input.
- `catalog.ts` supplies shared synthetic catalog identities and assembles cases
  by stable IDs `career-01` through `career-12`. Every case has a Survey context
  with reference Program `program-a`. Source associations explicitly stipulate a
  known catalog identity; label equality alone supplies none. Two distinct
  Institutions deliberately share the name `Synthetic University A`.
- `catalog.test.ts` checks source coverage, target existence, unique mappings,
  enum/field/date constraints, catalog exclusion, timelines, privacy and reference
  eligibility. Mutation tests ensure malformed variants are rejected.

Keys are local symbolic correlations, **not** UUIDs or persistent provider IDs.
Station keys are scoped to one case; catalog keys are shared across the catalog.
The enclosing profile supplies Alumni ownership for all its stations and timeline
items. `alumni` contains only a local key; runtime UUIDs and timestamps are omitted.
The selected canonical scalar fields are explicit, including `null` unknowns.
Unrepresented optional domain fields (fieldOfStudy, roleCategory, functionArea,
location, etc.) carry no asserted value. They must not receive guessed defaults.
No AlumniContact, raw personal profile, CV URL or general notes field is supplied.

A source date is `YEAR`, `MONTH`, `IMPRECISE` text, or `null`. Exact year/month facts
retain only the year in the canonical oracle. Imprecise or missing facts retain
`null`; no raw date parser is specified or implemented. Attendance end does not
prove an award or graduation year. In case 09, the stated attendance end remains
in the input while canonical `UNKNOWN` Degree.endYear remains `null`, as required
by the SQL constraint. The unresolved reason explains the difference.

Every source station has one `MAPPED` or `REVIEW_REQUIRED` outcome. A mapped target
is Degree XOR CareerStep, and each canonical station appears once in the mapping
and once in the timeline. This catalog covers one-to-one mappings; later split or
merge cases need an explicit test-contract decision. Review-required classification
has questions and no target, canonical placeholder, or timeline item. `unresolved`
records field-level clarification needs even when classification is known. These
are fixture metadata, not persisted personal notes or new Prisma entities.

Each source station supplies an explicit `timelinePosition` order hint; a resolved
station retains that position in the oracle. Positions are positive and unique,
with gaps and overlaps allowed. Sort by `position` to read it; do not reorder by source array,
start year, graduation year, or highest level. Case 11 deliberately puts the newer
award first. Missing intervals never imply unemployment or extra stations.

`reference.candidateDegreeKeys` lists every known COMPLETED Degree associated with
the Survey's Program. It is an eligibility oracle, **not** selection/confirmation.
`selection: REQUIRES_CONFIRMATION` applies even with one candidate; zero candidates
requires correction before participation. No fixture contains a SurveyResponse or
confirmedAt. Catalog identity confirmation does not confirm a reference Degree.
Profiles with no eligible reference are useful station tests, not complete
donations under the MVP.

## Scenarios and declared timeline

All keys below are local to their case. `D` means DEGREE and `C` CAREER_STEP.
All expected known years come from explicitly supplied source facts.

| Case | Expected canonical stations | Timeline position → target | Reference candidates |
|---|---|---|---|
| 01 Completed Bachelor and Master | BACHELOR COMPLETED 2011–2014, graduation 2014, Program A; MASTER COMPLETED 2015–2017, graduation 2017, Program B | 1 → D degree-bachelor; 2 → D degree-master | degree-bachelor |
| 02 Student employment during a Degree | BACHELOR COMPLETED 2016–2020, graduation 2020; overlapping EMPLOYMENT ENDED 2018–2019 | 1 → D degree-study; 4 → C step-student-work | degree-study |
| 03 Vocational training | VOCATIONAL_TRAINING ENDED 2010–2013; no Degree | 1 → C step-training | None |
| 04 Exchange without separate qualification | BACHELOR IN_PROGRESS since 2024; EDUCATION ENDED in 2025; no extra Degree for exchange | 1 → D degree-study; 2 → C step-exchange | None; study is not completed |
| 05 PhD qualification | PHD COMPLETED 2017–2022; direct Institution A; graduationYear null | 1 → D degree-doctorate | None; no confirmed Program association |
| 06 Independent certificate versus course | CERTIFICATE COMPLETED 2020–2021, graduation 2021, direct Institution A; EDUCATION ENDED in 2022 | 1 → D degree-certificate; 2 → C step-course | None |
| 07 Ongoing employment | EMPLOYMENT ONGOING since 2023; endYear null | 1 → C step-current-work | None |
| 08 Self-employment and volunteering | SELF_EMPLOYMENT ONGOING since 2021; VOLUNTEERING ENDED 2022–2024 | 1 → C step-independent-work; 3 → C step-volunteer | None |
| 09 Missing and imprecise dates | BACHELOR UNKNOWN with all canonical years null; EMPLOYMENT UNKNOWN with null years; INTERNSHIP explicitly ENDED with null years | 1 → D degree-uncertain-study; 5 → C step-undated-work; 8 → C step-ended-internship | None |
| 10 Unknown Organisation | EMPLOYMENT ENDED 2019–2021; organisationKey null despite a matching name in the catalog | 1 → C step-unassigned-work | None |
| 11 Multiple possible reference Degrees | Two distinct BACHELOR COMPLETED awards in Program A: 2006–2009 and 2012–2015; graduation 2009 and 2015 | 1 → D degree-second-award; 4 → D degree-first-award | Both; neither selected |
| 12 Ambiguous qualification or course | REVIEW_REQUIRED; no canonical station; no guessed completion | No timeline item until review | None currently established |

The catalog has 20 source stations, 9 Degrees, 10 CareerSteps, 19 timeline items,
and one unresolved classification. Intentionally unresolved: PhD award year;
case 09 exact dates, completion/end status and catalog identities; case 10
Organisation identity; case 12 qualification-versus-course, award status and
catalog identity. Independent reference selection/confirmation remains pending
for every case. Source provider labels for exchange/course do not establish an
Organisation association.

## Execution and later phases

Use the repository's Node 22 version. Run the focused unit suite without a
database or network:

```sh
npm test -- src/test-fixtures/canonical-careers/catalog.test.ts
```

RED was observed with the contract/tests written and an empty catalog: 37 failed
tests. The initial authored catalog then passed all 37. Source order preservation
was also tested RED (13 failed / 36 passed before supplying the order hints).
The final contract has 49 tests, including scenario coverage and mutation checks.
No production seed or database import is added.

Review verification on 2026-10-12 with Node 22.23.3: all 119 unit tests and all
350 integration tests passed. Integration used the existing disposable PostgreSQL
17 runner, deployed all five migrations, and removed its container afterward.
Prisma validation, lint, typecheck, production build and `git diff --check` passed.
No required check was skipped. Docker Desktop had to be started before the
integration runner could connect.

Phase E may consume `careerCases` as source-independent normalization examples,
comparing resolved stations, mappings, timeline and review needs to this oracle.
It must not convert candidates into a confirmed participation. This is a compact
semantic reference catalog, not comprehensive input/parser coverage.

Questions for D.3:

1. Which raw date/text vocabularies and invalid/reversed-date review outcomes
   should be specified beyond the explicit source facts used here?
2. How should trusted catalog selection and ambiguous same-name associations be
   supplied to normalization without making names identifiers?
3. What review response contract resolves classification and completion while
   preserving source attendance dates that cannot yet become canonical endYear?
4. How should split/merge mappings and semantically duplicate source stations be
   represented and reviewed?
5. Which additional cases should cover DIPLOMA/OTHER, ENDED_WITHOUT_DEGREE,
   explicitly established unemployment, category vocabularies and revised order?
6. What provenance/privacy evidence and retention rules would be needed before
   any separate local corpus could be considered for a later phase?

## Exact review patch file list

```text
src/test-fixtures/canonical-careers/README.md
src/test-fixtures/canonical-careers/catalog.test.ts
src/test-fixtures/canonical-careers/catalog.ts
src/test-fixtures/canonical-careers/contract.ts
src/test-fixtures/canonical-careers/expected.ts
src/test-fixtures/canonical-careers/inputs.ts
```

No application code, schema, migrations, normative model or D.1 files are changed.
