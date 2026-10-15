# Phase E.2b — Explicit CareerStep normalization

The [MVP Domain Model](MVP_DOMAIN_MODEL.md) remains normative. This increment
starts from E.2a commit `1dcc443cdd05ec962282bce0fcbb9517b2d876dd` on
`feat/normalizer-phase-e`, with an initially clean working tree. E.1, E.2a,
the D.2 oracle, schema, migrations and domain services remain unchanged.

## API and validation boundary

`normalizeExplicitCareerStep(source: SourceStation): CareerStepNormalizationOutcome`
in `src/lib/normalization/normalize-explicit-career-step.ts` projects one E.1
station. The return type extracts existing RESOLVED_CAREER_STEP and
REVIEW_REQUIRED variants; it adds no domain entity. The synchronous function
has no database, network, clock or random dependency, and does not mutate input.

The public parameter uses the existing typed E.1 contract. At runtime, null,
undefined, arrays and non-object roots are rejected before property access.
The module then follows E.2a's validation approach: pass the source and a
target-free classification review through the combined E.1 validator before
interpreting station facts. Malformed fact envelopes, enums, year/month values,
UUIDs, blank supplied text, invalid positions and extra metadata throw the fixed
error `Invalid source-neutral station contract`. Missing classification is a
valid MISSING/UNKNOWN envelope and requires review; ASSERTED CAREER_STEP without
its required careerStepType is malformed and throws. OTHER with an absent title
requires review, whereas a supplied blank title violates the E.1 source shape.

Every returned outcome is E.1-validated, including target-free reviews. A failed
internal output check throws `CareerStep normalization violated E.1 contract`.
Neither error interpolates source text, arbitrary keys, identifiers or diagnostics.
This boundary handles JSON-like contract values; it is not a provider/document
adapter or a decoder for adversarial JavaScript getters/proxies.

## Canonical projection policy

| Source facts | Outcome |
|---|---|
| ASSERTED CAREER_STEP and explicit careerStepType | Preserve exactly EMPLOYMENT, INTERNSHIP, EDUCATION, VOCATIONAL_TRAINING, VOLUNTEERING, SELF_EMPLOYMENT, UNEMPLOYED or OTHER. Labels never classify stations; nondegree education and vocational training do not become Degrees. |
| Missing/unknown classification or ASSERTED DEGREE | Target-free REVIEW_REQUIRED for classification, without reclassification. |
| Explicit positive position | Copy it unchanged, including gaps. Missing/unknown position requires review. No ordering is calculated. |
| ASSERTED temporal status | Preserve ONGOING, ENDED or UNKNOWN. No missing end implies ONGOING; no gap creates unemployment. |
| Missing/unknown temporal status | Canonical UNKNOWN with MISSING/UNKNOWN temporalStatus decision. ASSERTED UNKNOWN also gets an UNKNOWN decision. |
| YEAR/MONTH source date | Copy the supplied year, subject to temporal-status constraints. No month or date precision is invented. |
| Missing/unknown/imprecise date | Null with MISSING, UNKNOWN or IMPRECISE_DATE for that field. No text parsing. |
| UNKNOWN status and precise source end | Keep known startYear; withhold endYear with STATUS_UNCERTAIN. The source end fact remains unchanged. |
| ENDED with no known end year | Preserve ENDED and null endYear with the corresponding field decision. |
| ONGOING with absent/explicitly unknown end | Preserve ONGOING and null endYear with MISSING/UNKNOWN. A value-bearing end is a blocking conflict. |
| CONFIRMED ORGANISATION | Copy its ID only. Confirmation is a supplied claim, not an existence lookup or name match. |
| CANDIDATE catalog association | Null organisationId with CATALOG_UNCONFIRMED, including NAME_MATCH candidates. |
| UNKNOWN catalog association | Null organisationId with UNKNOWN; no placeholder Organisation. |
| Supplied observed/asserted source.title | Copy exactly to roleTitle. No label substitution, trimming or Unicode transformation. |
| Missing/unknown title | Null roleTitle with a truthful decision, except OTHER requires review. |

`roleCategory`, `functionArea` and `location` always remain null under E.1.
Canonical fields are constructed explicitly, never by spreading source metadata.
No Alumni/contact fields, provider IDs, raw profiles, reference selections,
SurveyResponses or graduation fields are returned. The temporary source key stays
on the outcome wrapper. Supported career text can still contain personal content:
this code checks evidence correspondence, not semantic truth or PII absence.

## Blocking conflicts and review behavior

Validly shaped but incompatible evidence becomes REVIEW_REQUIRED with fixed
CONFLICTING_FACTS field decisions and no canonical or position property:

- Any asserted degreeStatus, including ASSERTED UNKNOWN: `status` decision.
- Any value-bearing OBSERVED/ASSERTED graduation fact, including imprecise
  expressions: `graduationYear` decision. Missing or explicitly unknown envelopes
  contain no date value and are not a positive cross-kind claim.
- CONFIRMED PROGRAM/INSTITUTION: `catalogAssociation` decision.
- ONGOING with any supplied end expression, including imprecise text: `endYear`
  decision. No source evidence is silently dropped to force an ongoing station.
- Precise start year after precise end year: `startYear` and `endYear` decisions.
  The check precedes UNKNOWN status withholding, so an invalid interval is not
  hidden by canonical null endYear.

Review returns the first blocking condition/group in stable order:
classification, position, Degree status, graduation evidence, catalog kind,
required OTHER title, ongoing-end conflict, then reversed years. Resolved field
decisions follow temporal status, roleTitle, start/end dates, then catalog.
Neither path claims to inventory every possible review need. Source facts remain
unchanged for later clarification; there is no split, merge or duplicate solver.

One input produces one outcome. Parallel activities and explicit timeline gaps
survive independent calls; no batch sorting, deduplication or global uniqueness
is performed. A later batch layer must use E.1's source/outcome/position checks.

## D.2 relationship and remaining questions

Tests independently author synthetic source facts and expected results; no D.2
oracle is imported or calculated from implementation output. This increment
covers concepts behind D.2 cases 02–04 and 06–10: student employment, vocational
training, nondegree learning, ongoing work, self-employment/volunteering,
uncertain dates/status and unassigned Organisation. It additionally covers all
eight types, explicit unemployment, OTHER and incompatible assertions.
The D.2 source adapter and canonical comparison harness remain later work.

No domain architecture change or blocking conflict was required. Open questions:

- Provenance/trust of assertions and catalog confirmations, review responses and
  evidence precedence. The function preserves supplied claims, not verified truth.
- Source-month ordering within a single canonical year, richer interval semantics
  and free-text date parsing. Current conflict checks compare exact known years.
- Text normalization under E.1's exact-evidence rule and dedicated evidence for
  the three null-only CareerStep text fields.
- Batch coordination, split/merge/duplicates, reference confirmation, adapters,
  privacy/retention workflows and persistence. None is added here.

## TDD, verification and review patch

The unchanged E.1/E.2a focused suites passed **153 tests**. Against a minimal
review-only stub, E.2b demonstrated **79 failed / 4 passed (83 total)**. The
implementation then passed all **83**. Every returned-outcome test checks E.1
acceptance, deterministic results, source immutability and exact allowed fields.
Runtime-invalid cases check the fixed redacted error. Additional coverage includes
recursively frozen source values, all eight types, both confirmation mechanisms,
cross-kind conflicts, overlapping activities and timeline gaps.

Final verification on 2026-10-15 with Node 22.23.3: **355 unit tests** and
**363 integration tests** passed. Integration used the disposable PostgreSQL 17
runner, applied all five unchanged migrations and removed its container.
`npm run db:validate`, `npm run lint`, `npm run typecheck`, `npm run build` and
`git diff --check` passed. New untracked files also pass individual
`git diff --no-index --check` checks. No required check was skipped.
The complete targeted patch includes all three new files against HEAD and is
verified by clean-directory application and byte-for-byte file comparison.

Complete targeted patch files against HEAD (all new):

```text
docs/architecture/PHASE_E2B_EXPLICIT_CAREER_STEP_NORMALIZATION.md
src/lib/normalization/normalize-explicit-career-step.ts
src/lib/normalization/normalize-explicit-career-step.test.ts
```

No commit or push is performed. Stop for independent review before another increment.
