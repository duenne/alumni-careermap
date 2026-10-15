# Phase E.2a — Explicit academic Degree normalization

The [MVP Domain Model](MVP_DOMAIN_MODEL.md) remains normative. This increment
starts from verified E.1 commit `63e4d9bafd0e2cc9088c2dadd40d2b6780a31a0c`
on `feat/normalizer-phase-e`, with an initially clean working tree. It does not
change the [E.1 contract or validator](PHASE_E1_NORMALIZATION_CONTRACT.md), the D.2
oracle, Prisma schema, migrations or domain services.

## API and boundary

`normalizeExplicitDegree(source: SourceStation): DegreeNormalizationOutcome`
in `src/lib/normalization/normalize-explicit-degree.ts` projects one E.1 source
station. `DegreeNormalizationOutcome` extracts the existing RESOLVED_DEGREE and
REVIEW_REQUIRED variants; it introduces no domain entity or persistence shape.
The function is synchronous and pure, preserves the source key for temporary
correlation, and does not mutate input or access a database, network or clock.

The input must satisfy E.1's source-neutral fact contract. This is not a raw JSON,
provider, CV or manual-form adapter. A target-free review outcome is used with
the existing combined validator to check source shape before interpreting facts.
Invalid E.1 envelopes, dates, enums, catalog UUIDs or extra provider metadata
throw the fixed error `Invalid source-neutral station contract`. For example,
an ASSERTED DEGREE lacking its mandatory level is malformed input; valid missing
classification is represented by MISSING/UNKNOWN and leads to review instead.
Null and undefined runtime arguments are rejected with the same fixed error
before accessing the station key.
All returned outcomes are checked against E.1, including target-free reviews.
An internal validation failure throws the fixed error
`Degree normalization violated E.1 contract`; it never emits invalid canonical
data or interpolates source text into an exception.

## Resolution policy

| Supplied facts | Result |
|---|---|
| ASSERTED DEGREE with explicit level | Copy the level, without interpreting title/category/provider labels. |
| Classification missing, unknown, or explicitly CAREER_STEP | REVIEW_REQUIRED for classification; no attempted CareerStep normalization. |
| Missing/unknown position | REVIEW_REQUIRED for position. A resolved outcome copies the explicit positive position, including gaps; no chronology sorting. |
| Explicit Degree status | Preserve it. COMPLETED is never inferred from attendance end or even a dedicated graduation date. |
| Missing/unknown status, including ASSERTED UNKNOWN | Resolve classification with canonical UNKNOWN and a status decision. Preserve known start year; withhold known end/graduation years with STATUS_UNCERTAIN. |
| Precise YEAR/MONTH fact | Project its supplied year only, subject to status constraints. |
| Missing/unknown/imprecise date | Canonical null with MISSING, UNKNOWN or IMPRECISE_DATE for that exact field. No free-text parsing or fabricated year. |
| Confirmed Program or Institution | Copy only that catalog ID; preserve Program/direct-Institution exclusion. Catalog confirmation is a supplied claim, not a lookup or reference confirmation. |
| Candidate/name match | Keep both catalog IDs null with CATALOG_UNCONFIRMED. |
| Unknown catalog | Keep both catalog IDs null with UNKNOWN. No artificial catalog row. |
| Supplied observed/asserted title | Copy exactly as supported by E.1; no whitespace/Unicode transformation or inferred fieldOfStudy. |
| Missing/unknown optional title | Null with a title decision. DIPLOMA/OTHER require a supported title, so its absence requires review. |

`fieldOfStudy` always remains null, as required by E.1. A resolved Degree is not
a fully resolved donation: field uncertainty remains explicit, and no reference
Degree selection, SurveyResponse, Alumni identity or contact data is produced.

## Blocking conflicts and field decisions

The following validly shaped source claims produce REVIEW_REQUIRED with fixed
CONFLICTING_FACTS reasons and no canonical target/position:

- Any asserted CareerStep temporal status on the Degree station.
- A confirmed Organisation association where a Degree catalog is required.
- A supplied attendance end while status is explicitly IN_PROGRESS.
- A supplied graduation expression, precise or imprecise, while status is
  explicitly IN_PROGRESS or ENDED_WITHOUT_DEGREE.
- Precise attendance years in reverse order, including when unknown status would
  otherwise hide the canonical end year.
- A precise graduation year before a known attendance start or end year.

Missing/explicitly unknown date envelopes contain no contradictory date value.
UNKNOWN status may therefore retain a supplied attendance end/graduation fact
in the input while withholding its precise year from canonical data with a
STATUS_UNCERTAIN decision. An imprecise expression still receives IMPRECISE_DATE.
No supplied evidence is rewritten to manufacture completion or ongoing study.

Review reports the first blocking condition/group in stable order:
classification, position, temporal-status conflict, catalog-kind conflict,
mandatory title, in-progress attendance end, incompatible graduation, reversed
attendance years, then graduation-year order. It does not claim to inventory
every review need before those blockers are resolved. Resolved field decisions
follow status, title, start/end/graduation dates, then catalog. Reasons contain
fixed tokens, never personal narratives. Source facts remain unchanged for later
review; no split/merge or duplicate-resolution behavior is introduced.

## Compatibility and remaining questions

Tests use independently authored fictional values and expected outcomes. No
D.2 input/expected profile is imported, rewritten or used to calculate an answer.
This increment covers concepts behind D.2's academic cases, especially completed
Bachelor/PhD, unknown graduation and attendance without established completion.
A full test-only D.2 source adapter and comparison harness remain separate work.

No domain architecture change or blocking normative conflict was needed.
Remaining design/validation questions are explicitly deferred:

- Trust/provenance of assertion and catalog-confirmation claims, review response
  protocols and evidence precedence. This function checks supplied consistency;
  it does not independently establish the truth of source text or detect PII.
- Source MONTH ordering within the same canonical year and richer interval/conflict
  semantics. E.2a checks known year bounds and preserves E.1's year-only canonical
  representation; it does not introduce a full chronology solver.
- Text trimming/Unicode normalization under E.1's exact source-evidence rule,
  level aliases, optional fieldOfStudy evidence and ambiguous classification.
- Batch uniqueness/reordering, split/merge/duplicates, reference eligibility and
  confirmation, CareerStep normalization (E.2b), adapters and persistence.

## TDD, verification and targeted review

The baseline's focused E.1 suite passed all 118 tests. Against a review-only
stub, the first E.2a run demonstrated **27 failed / 3 passed**; adding input-contract
boundary tests gave **30 failed / 3 passed (33 total)**. The implemented module
then passed all **33** without changing E.1 tests or D.2 expectations. Every
successful/review test also checks the E.1 validator and unchanged input.

Independent review F1: two null/undefined boundary regressions demonstrated
**2 failed / 33 passed**, receiving JavaScript TypeErrors before the correction.
A null/undefined guard before property access produced **35 passing E.2a tests**,
preserving every existing normalization test and rule.

Final verification after F1 on 2026-10-15 with Node 22.23.3: **272 unit tests** and
**363 integration tests** passed. Integration used the existing disposable
PostgreSQL 17 runner, applied all five unchanged migrations and removed its
container. `npm run db:validate`, `npm run lint`, `npm run typecheck`,
`npm run build` and `git diff --check` passed. New files are additionally checked
with `git diff --no-index --check`, since they are untracked. No required check
was skipped. No commit or push was performed.

Exact targeted E.2a patch files against HEAD:

```text
docs/architecture/PHASE_E2A_EXPLICIT_DEGREE_NORMALIZATION.md
src/lib/normalization/normalize-explicit-degree.ts
src/lib/normalization/normalize-explicit-degree.test.ts
```

E.2b must wait for independent review. No commit or push is performed here.
