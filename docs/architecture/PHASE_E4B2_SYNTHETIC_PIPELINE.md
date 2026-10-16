# Phase E.4b.2 — Synthetic in-memory career normalization

The [MVP Domain Model](MVP_DOMAIN_MODEL.md) remains normative. This test-only
increment starts on `feat/normalizer-phase-e` at verified baseline
`3806e4f81a1391a8e387ea48ee0d61ce8e71ff4c`, with a clean working tree. No existing
file changes: E.1–E.4b.1, the D.2 oracle, schema and migrations remain unchanged.

## Real processing path and independent oracle

`src/lib/normalization/synthetic-career-pipeline.test.ts` calls the actual
`adaptLinkedInSnapshot` → `applyExplicitReviewAssertions` → `normalizeCareerBatch`
→ `validateNormalizationContract` functions. There are no mocks, spies,
replacement implementations or production orchestration wrapper. The private
test harness records intermediate values and checks each stage for mutation.
E.4b.1 also runs batch normalization internally as validation; that existing
behavior remains unchanged.

The source is the unchanged four-station E.4a fictional member snapshot.
`src/test-fixtures/linkedin-snapshots/reviewed-career.expected.ts` was manually
authored before implementing the test harness. It contains explicit additional
synthetic review claims and independent full results. Its imports are type-only;
it never calls the adapter, overlay, normalizers or D.2 oracle. Variants reuse
only manually authored expected entries. No classification, status or position
is derived from a title, date, domain or normalizer output.

| Source key / observation | Explicit review claim | Expected outcome and exact decisions |
|---|---|---|
| snapshot:1:0 / Research Assistant | CAREER_STEP / EMPLOYMENT / ONGOING, position 3 | Resolved; startYear 2023, endYear null; endYear MISSING, catalogAssociation UNKNOWN |
| snapshot:1:1 / Internship | None | Target-free REVIEW_REQUIRED; classification CLASSIFICATION_UNCERTAIN |
| snapshot:2:0 / M.Sc. | DEGREE / MASTER / COMPLETED, position 1 | Resolved; startYear 2019, endYear 2022, graduationYear null; graduationYear MISSING, catalogAssociation UNKNOWN |
| snapshot:2:1 / Short Course | CAREER_STEP / EDUCATION / ENDED, position 5 | Resolved; startYear/endYear null; startYear IMPRECISE_DATE, endYear MISSING, catalogAssociation UNKNOWN |

The main result has one Degree, two CareerSteps, one review and exactly eight
decisions. All catalog IDs stay null. The Master attendance end is not graduation
evidence. The imprecise course start remains an expression, without an invented
year. Source array order stays work, internship, Master, course; asserted positions
remain 3, absent, 1, 5, with gaps and no inferred extra station.

Comparison uses strict deep equality of the entire authored result. All canonical
scalars, null-only fields, source correlation, array order and complete decision
field/reason arrays are checked. No projection, filtering, sorting, defaulting or
open-ended allowance suppresses additional decisions. E.1 validation is checked
separately for every successful full input/result pair.

## Additional scenarios and boundaries

An unreviewed run remains four classification reviews. A conflicting update
explicitly sets the internship ONGOING while preserving its observed February
2020 end: it remains target-free endYear/CONFLICTING_FACTS alongside the other
unchanged results. Partial review covers a Master missing position, employment
missing temporal status, a course missing classification and unknown catalogs.
A separate uncertain Master retains observed attendance end 2022 but canonical
UNKNOWN status and null endYear, with STATUS_UNCERTAIN. All variant results and
decision inventories are authored explicitly. First-blocker reviews are not
represented as exhaustive inventories of every missing fact.

Tests check frozen snapshots/updates, stage immutability, deterministic values,
independent result objects and no shared mutable references between snapshot,
updates, observed input, enriched input and results. Every fictional PROFILE
value and the fixture's provider-ID/narrative/location markers are checked absent
from normalized results. Exact result shapes reject extra fields. This verifies
these synthetic values, not semantic privacy or truth of arbitrary source text.

Two no-review scenarios reorder domains and records within a domain. The same
Master observation changes from `snapshot:2:0` to `snapshot:1:0` after swapping
the education and positions domains; its former key now denotes the Research
Assistant. Reversing position records likewise reassigns those keys. The key
sequence and target-free review result can stay identical while the observations
change. No stale review assertions are replayed in these tests.

Structural-index keys identify locations only within the current snapshot. E.1
validation does not prove cross-snapshot identity. A future UI/API must bind
claims to the currently presented snapshot/version and authorized session before
reusing any review updates. The binding mechanism is intentionally not specified
or implemented here. ASSERTED/EXPLICIT_SELECTION remain supplied claims, not
proof of human review, authorization, provenance, catalog existence or consent.

No testability blocker or domain conflict was found. Broader source formats,
context binding, assertion revision, catalog verification, semantic privacy,
reference confirmation and persistence remain separate work. This is not a
completed donation, production import, SurveyResponse or browser/network test.

## TDD and review files

The unchanged normalization suites first passed **480 tests**. With the oracle
already written and the private test harness unimplemented, actual RED was
**25 failed / 0 passed**. Connecting the harness to the four unchanged production
functions produced **25 passed**; TypeScript checking passed too. RED establishes
the new test harness, not a claimed defect in the already implemented functions.

Fourteen mutations must fail independent comparison: incorrect canonical type,
status, graduation year, position, catalog identity, fabricated review target,
year inferred from imprecise text, Degree/CareerStep target kind, unnecessary
review, missing/additional decisions, wrong reason, output order and missing
source outcome. Five mutants are additionally asserted E.1-valid (unnecessary
review, missing/additional optional decisions, broad UNKNOWN reason and reversed
result order). This proves the independent oracle adds checks beyond structural
acceptance. Neither real originals nor authored expectations are mutated.

Final verification on 2026-10-16 with Node 22.23.3: **672 unit tests** and
**363 integration tests** passed. Integration used disposable PostgreSQL 17,
applied all five unchanged migrations and removed its container. Prisma
validation, lint, typecheck, production build and tracked/untracked whitespace
checks passed. No required check was skipped. The complete patch was checked and
applied to a clean export of HEAD, reproducing every new file byte for byte.

Complete targeted patch against HEAD (all new):

```text
src/lib/normalization/synthetic-career-pipeline.test.ts
src/test-fixtures/linkedin-snapshots/reviewed-career.expected.ts
docs/architecture/PHASE_E4B2_SYNTHETIC_PIPELINE.md
```

No commit or push is performed. Stop pending independent review.
