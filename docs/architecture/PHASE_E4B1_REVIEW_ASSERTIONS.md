# Phase E.4b.1 — Explicit review assertion overlay

The [MVP Domain Model](MVP_DOMAIN_MODEL.md) remains normative. This increment
starts on `feat/normalizer-phase-e` at verified baseline
`78399b1d9cefdcbed6cc778514c5c303c5222c70`, with an initially clean working tree.
E.1–E.4a, the D.2 oracle, schema and migrations remain unchanged.

## Public contract

`applyExplicitReviewAssertions(input: NormalizationInput, updates: unknown):
NormalizationInput` adds supplied claims to absent review fields in an existing
E.1 input. It returns enriched source evidence, not canonical stations or a
confirmed donation. The module exports `ExplicitReviewUpdate` and
`ExplicitReviewUpdates` for callers authoring typed payloads.

The exact envelope is `{ updates: ExplicitReviewUpdate[] }`. Each update contains
an exact `sourceKey` and at least one of the following own fields:

| Field | Supplied value | Enriched E.1 value |
|---|---|---|
| classification | `{ type: "DEGREE", level: DegreeLevel }` or `{ type: "CAREER_STEP", careerStepType: CareerStepType }` | ASSERTED classification |
| degreeStatus | Existing Degree status enum value, including UNKNOWN | ASSERTED degreeStatus |
| temporalStatus | Existing CareerStep temporal status enum value, including UNKNOWN | ASSERTED temporalStatus |
| position | Positive safe integer | ASSERTED position |
| catalogSelection | `{ identity: { entity: "PROGRAM" \| "INSTITUTION" \| "ORGANISATION", id: string }, confirmation: "EXPLICIT_SELECTION" }` | CONFIRMED association with the explicitly supplied typed UUID and EXPLICIT_SELECTION claim |

For example, the E.4a education observation can receive this independent claim:

```ts
const updates: ExplicitReviewUpdates = {
  updates: [{
    sourceKey: "snapshot:2:0",
    classification: { type: "DEGREE", level: "MASTER" },
    degreeStatus: "COMPLETED",
    position: 1,
  }],
};
```

The mapped union requires at least one assertion in typed updates. E.1 types
provide classification/status/catalog vocabularies; numbers and UUID strings
still require runtime checks. Runtime validation rejects empty entries, unknown
or repeated source keys, extra fields, undefined/null assertion values, arbitrary
SourceStation replacements and malformed nested values. Keys are compared
exactly, without trimming, case folding or normalization. An empty updates array
is a valid no-op, subject to full input/batch validation; empty input is valid too.

## Evidence preservation and conflicts

Only MISSING or UNKNOWN assertion fields can be filled. UNKNOWN absence markers
with either origin are eligible; `ASSERTED` status values of UNKNOWN are existing
assertions and cannot be replaced. Already ASSERTED classification, degreeStatus,
temporalStatus and position reject both changes and identical replay. Adding
other missing fields in a subsequent call is permitted. Revising assertions and
reordering previously asserted positions require a later workflow.

`title`, `category`, `providerLabel`, `start`, `end` and `graduation` are never
update fields, regardless of whether their facts are observed, asserted or absent.
Their values, precision and uncertainty remain unchanged. No graduation assertion
is added: the example's completed Master retains canonical graduationYear null
with a MISSING decision. Labels, domains, dates and structural indexes supply no
classification, level, completion, employment type, ONGOING status or position.

Catalog UNKNOWN and CANDIDATE associations stay unchanged unless a separate
`catalogSelection` with EXPLICIT_SELECTION is supplied. Selection may explicitly
choose the candidate or a different identity. No candidate ID is copied implicitly,
and no provider label is matched to a catalog. Existing CONFIRMED associations,
including TRUSTED_INPUT, reject reselection or replay; unrelated updates preserve
them. UUID syntax and entity type are checked, without establishing database
existence. A selected Program or Institution on a CareerStep remains that typed
claim and produces review; it never becomes an Organisation implicitly.

Well-shaped contradictory claims remain in the enriched input. For example,
ONGOING with an observed end produces target-free endYear/CONFLICTING_FACTS;
cross-kind status assertions remain target-free reviews too. Partial classification
or position claims do not invent the missing counterpart. Where E.2 permits
resolution with uncertain status or optional facts, its existing UNKNOWN/null
values and field decisions remain intact. Existing first-blocker review behavior
is preserved; it is not a complete inventory of every unresolved field.

## Validation, positions and purity

Original and enriched inputs pass E.1 combined validation using a temporary
target-free classification review per source, as in E.2/E.3a. This checks exact
source shapes and unique keys without making canonical claims. The enriched
input additionally requires unique positions across **all ASSERTED source
positions**, including unchanged stations and those still requiring review.
This explicit check covers a constraint E.1 applies only to resolved outcomes.
Collisions fail the whole transformation; no stations are dropped or renumbered.

A detached copy is run through `normalizeCareerBatch`, and the complete returned
batch is checked with E.1. Invalid batches and delegate exceptions fail without
returning partial enrichment. Valid REVIEW_REQUIRED outcomes are accepted. The
normalized result is validation-only and is not returned as extra metadata.

Errors use only these fixed messages, with no source diagnostics or chained cause:

- Invalid original input: `Invalid source-neutral review input`.
- Invalid update, unknown/duplicate key, assertion replay or invalid enriched
  source shape: `Invalid explicit review assertions`.
- Duplicate asserted positions, invalid completed batch or downstream exception:
  `Review assertions violated normalization contract`.

No error/log includes source keys, titles, provider labels, identifiers or arbitrary
source text. The function does not log. It accepts the same JSON-like values as
E.1; adversarial proxies, getters and custom iterators are outside this boundary.
All returned values are detached from both arguments. Input/update objects,
frozen data, original station array order and source keys are preserved. Position
gaps and parallel activities remain intact. There is no persistence, ID generation,
reference selection, SurveyResponse, catalog lookup, network operation or new dependency.

## Trust boundary and deferred work

ASSERTED and EXPLICIT_SELECTION are **supplied claims**. This pure transformation
cannot prove human review, affirmative confirmation, authorization, provenance,
catalog existence or consent. A UUID is neither a checked catalog row nor a proof
of selection. The future UI/API must bind assertions to the currently presented
snapshot and an authorized session. E.4a structural-index keys are ephemeral:
changed/reordered snapshots must not reuse these claims without separate context
validation. This increment provides no persistent source identity or consent
guarantee.

Snapshot/context binding, authorization, catalog existence checks, assertion
revision/replay policy beyond rejection, confirmed-catalog changes, date correction,
reordering, richer review inventories, split/merge/duplicate resolution and
production ingestion remain separate work. No blocking domain conflict was found.

## TDD and review files

The unchanged E.4a and E.3a focused suites first passed **144 tests**. The new suite
demonstrated actual RED against a pass-through stub: **99 failed / 1 passed
(100 total)**. Implementation then passed all **100**, followed by TypeScript
checking. Expectations are independently authored synthetic values, using the
unchanged E.4a fictional snapshot. No canonical expectations are calculated from
normalization results, and no personal corpus or D.2 oracle is read.

Tests check canonical Master/employment values, unknown graduation, catalog claims,
partial/cross-kind/conflicting assertions, unreviewed sources, observed-fact
preservation, exact keys, malformed enums/UUIDs/positions, extra/replacement fields,
assertion replay, review-station position collisions, frozen inputs, detached
outputs and deterministic order/errors. Every successful overlay is normalized
and checked against E.1. Fault-injected invalid batches and source-bearing delegate
exceptions exercise validation and error redaction without changing production APIs.

Final verification on 2026-10-15 with Node 22.23.3: **647 unit tests** and
**363 integration tests** passed. Integration used disposable PostgreSQL 17,
applied all five unchanged migrations and removed its container. Prisma
validation, lint, typecheck, build, tracked and untracked whitespace checks all
passed. No required check was skipped. The complete patch was checked and applied
to a clean export of HEAD, reproducing all three files byte for byte.

Complete targeted patch files against HEAD (all new):

```text
src/lib/normalization/apply-explicit-review-assertions.ts
src/lib/normalization/apply-explicit-review-assertions.test.ts
docs/architecture/PHASE_E4B1_REVIEW_ASSERTIONS.md
```

No commit or push is performed. Stop pending independent review.
