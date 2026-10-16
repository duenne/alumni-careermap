# Phase E.3a — Source-neutral batch normalization

The [MVP Domain Model](MVP_DOMAIN_MODEL.md) remains normative. This increment
starts on `feat/normalizer-phase-e` at verified baseline
`7de73131c51c43e792d39e12ee1bf99935049c63`, with an initially clean working tree.
E.1, E.2a, E.2b, the D.2 oracle, schema and migrations remain unchanged.

## API and dispatch

`normalizeCareerBatch(input: NormalizationInput): NormalizationResult` in
`src/lib/normalization/normalize-career-batch.ts` composes the existing station
normalizers without adding classification rules or a new domain representation.

| Valid source classification | Dispatch/outcome |
|---|---|
| ASSERTED DEGREE with required level | `normalizeExplicitDegree(source)` |
| ASSERTED CAREER_STEP with required type | `normalizeExplicitCareerStep(source)` |
| MISSING or UNKNOWN | REVIEW_REQUIRED with a classification/CLASSIFICATION_UNCERTAIN decision; no canonical target or position. Neither station normalizer is called. |

The function traverses the original source array once for dispatch. It returns
one outcome per source in that array order, preserving ephemeral correlation
keys. It passes every delegated canonical value, position and unresolved decision
through unchanged. It does not sort by dates, positions, level or source labels,
fill timeline gaps, merge overlaps or create placeholder stations. Explicit
positions govern a later timeline representation; array order is not chronology.
An empty valid input returns `{ stations: [] }`.

## Validation and errors

The public parameter uses E.1's typed contract with runtime checking of JSON-like
values. Root shape/array guards run before property access. A target-free review
for each source is passed with the full input to the existing E.1 validator,
following E.2's prevalidation pattern. `Array.from` exposes sparse/missing source
entries to validation. No delegated normalizer runs until all source shapes and
source-key uniqueness pass. Malformed classifications, including OBSERVED
classification or ASSERTED classification missing its required level/type, are
invalid input rather than candidates for label-based repair.

After dispatch, the complete original input/result pair is validated again.
E.1 enforces exact source/outcome correlation, unique resolved positions,
canonical consistency and decision shapes. Review outcomes have no position, so
source position hints on review stations do not reserve resolved timeline slots.
Duplicate resolved positions, orphan/duplicate mappings, missing/invalid outcomes
and invalid canonical facts fail the batch; nothing is silently renumbered,
dropped, reclassified or replaced with a placeholder.

Errors have fixed messages and no source diagnostics or chained cause:

- Invalid root/source shape or duplicate source keys:
  `Invalid source-neutral batch contract`.
- Invalid completed result or a delegated normalizer failure:
  `Career batch normalization violated E.1 contract`.

A valid station-level conflict remains a REVIEW_REQUIRED outcome alongside
other resolved outcomes. A batch-level contract failure throws and returns no
partial result. Delegate exception messages are discarded. The boundary does not
decode adversarial JavaScript getters/proxies; it accepts the same JSON-like
source-neutral values as the preceding increments.

## Purity and scope limits

Input arrays/stations are never mutated, including frozen inputs. Outputs are
new result structures with no retained mutable input references under the
existing station normalizers. There are no database calls, catalog lookups, ID
generation, provider adapters, AI, SurveyResponse creation or reference selection.
Only existing confirmed catalog IDs may appear through E.2's canonical outcomes;
source keys stay temporary wrapper metadata. No extra profile/contact payload is
accepted or returned.

This is not a full donation or persistence API: an empty or review-only batch
can be valid here without being eligible for survey participation. Catalog and
assertion trust, semantic text privacy/truth, source-month chronology within a
year and first-blocking-condition review behavior retain E.1/E.2's limitations.
There is no cross-station semantic duplicate, split/merge or identity resolution.

No domain architecture change or blocking normative conflict was needed.
Review-response workflows, richer evidence rules, reference confirmation and
persistence remain open subsequent work. The full D.2 adapter/comparison harness
and LinkedIn Snapshot adapter are explicitly separate increments. D.2 profiles,
catalogs and expected results are neither imported by these tests nor rewritten.

## TDD and verification

The unchanged focused E.1/E.2 suites first passed **236 tests**. Against a minimal
empty-result stub, the new suite demonstrated **43 failed / 1 passed (44 total)**.
The implementation then passed all **44**. Expectations are independently
authored fictional values, not results calculated by the delegated normalizers.
All successful batch tests check E.1 acceptance, source immutability and exact
source/outcome order. Additional tests cover deterministic/frozen input, explicit
dispatch, preserved uncertainty, parallel study/work, multiple Degrees, gaps,
nonchronological order, duplicate keys/positions and malformed runtime inputs.
Fault-injected delegate results exercise missing/orphan/duplicate mappings,
fabricated facts/targets and redaction of delegate exceptions without changing
the production station APIs.

Final verification on 2026-10-15 with Node 22.23.3: **399 unit tests** and
**363 integration tests** passed. Integration used the disposable PostgreSQL 17
runner, applied all five unchanged migrations and removed its container.
`npm run db:validate`, `npm run lint`, `npm run typecheck`, `npm run build` and
`git diff --check` passed. New untracked files also pass individual
`git diff --no-index --check` checks. No required check was skipped.
The complete three-file patch against HEAD is verified by clean-directory
application and byte-for-byte reproduction of every file.

Complete targeted review patch files against HEAD (all new):

```text
docs/architecture/PHASE_E3A_BATCH_NORMALIZATION.md
src/lib/normalization/normalize-career-batch.ts
src/lib/normalization/normalize-career-batch.test.ts
```

No commit or push is performed. Stop for independent review before another increment.
