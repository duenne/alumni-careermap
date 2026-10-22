# UI.2b: Unified Timeline and Inline Review

Historical increment note: [UI.2b.1](PHASE_UI2B1_CHRONOLOGY_CONTEXT.md)
supersedes the appended imprecise-date proposal and visible source numbering
below. Its combined patch retains the explicit assertion and review contracts.

Baseline: `248108b973565b4a8b4656c9fa105f2921beeec3`, plus the uncommitted
UI.2a increment. The MVP Domain Model and Phase E remain unchanged.

## Proposal Is Not an Assertion

`proposeDisplayOrder` creates a separate key array; the original observations
retain source traversal order. Only OBSERVED structured YEAR/MONTH starts are
used. Known years sort ascending before unknown, missing and IMPRECISE starts.
Equal/incomparable observations retain source order. Free text is never parsed.

Within a year, contiguous month-precision runs sort by month, stably for ties.
A year-only observation is a barrier: precise months cannot move across it
without reversing a source-order relationship that precision cannot establish.
This avoids the non-transitive comparator produced by treating missing months
as ties while globally comparing surrounding months. No January is invented.

The fixture proposal is Internship, M.Sc., Research Assistant, Short Course.
It is explicitly not a confirmed historical sequence; concurrent stations are
allowed. Original source indices remain visible as `Quellangabe`, separate from
confirmed `Entwurfsplatz` labels. No canonical position is inferred on render
or movement, and no position zero exists.

## Local State and Explicit Actions

`CareerTimeline` owns an original detached input, proposed order, optional
confirmed order, three blank Degree selections and optional applied outcome.
One semantic list contains exactly one article per station. `DegreeReview` is
inside the fixed example's M.Sc. card; the other cards have no fake edit action.
`ObservedDate` reuses the existing precision-preserving formatter. The homepage
and its read-only rendering are behaviorally unchanged.

- Move Up/Down changes only display order, invalidates confirmed order and
  applied output, and retains the user's unapplied Degree choices.
- Explicit order confirmation applies position-only updates for all stations,
  validates their normalization and retains the confirmed order. All four
  stations remain REVIEW_REQUIRED; ordering is not classification review.
- Explicit Degree application requires confirmed order and three independent
  selections. ONE combined update per source supplies positions 1..N, with
  classification, level and status only on the reviewed station.
- Every application calls the real `applyExplicitReviewAssertions`,
  `normalizeCareerBatch` and `validateNormalizationContract` against the SAME
  original observations, never previous enrichment. Revision recomputes.
- Changing Degree choices hides stale output but preserves confirmed ordering.
  Reconfirming after movement establishes positions only; Degree application
  still requires a separate explicit action.
- Reset restores observations, initial proposal, no confirmation, blank choices
  and no output. A changed input remounts the local state, even when ephemeral
  keys are unchanged. Reloads carry no saved draft.

The inline result separates observations, explicit choices, canonical outcome
and unresolved decisions. Completed Master retains `graduationYear: null` and
exactly `graduationYear/MISSING`, `catalogAssociation/UNKNOWN`. Other stations
retain their classification review outcomes; only their explicit position
assertions change. Conflicts remain reviews rather than invented canonical data.

## Privacy and Accessibility

Only the real server-side adapter's source-neutral input enters client state.
No raw snapshot, PROFILE, excluded metadata or provider identifiers enter client
imports or rendered content. Source keys are internal, current-snapshot-only
correlation keys, not authorization or persistent provenance. There is no
network operation, save, storage, API route, database write or consent claim.
Errors are fixed/redacted; source-bearing exceptions are neither logged nor shown.

Native buttons support keyboard activation, named for their station with visible
arrow symbols and title tooltips. Boundaries are disabled. Focus follows the
moved control, or its enabled counterpart at a boundary. Inline errors focus the
field; missing confirmation focuses the order action. Results receive heading
focus, reset focuses the timeline heading. One polite status region announces
actions without announcing every select change. Fields have German labels and
linked errors; no numeric position control remains.

## TDD and Review Boundary

The new timeline suites demonstrated RED: 20 failed, 2 passed; GREEN: 22 passed,
then remained green through shared pipeline/formatter refactoring. The existing
30 UI.2a DOM tests remain, adapted to order confirmation instead of typed numbers;
seven malformed-position cases now exercise positive unique positions across
movement variants. Malformed/duplicate/incomplete order payloads are separately
rejected. Together with 14 adapted SSR tests, the focused review suite has 66 tests.

Chromium checks at 320/375/768/1440px cover Enter/Space movement, boundaries,
focus, confirmation, exact unresolved inventory, revision, invalidation, reset,
reload, doubled text, no horizontal overflow, HTML/client-bundle privacy and
absence of writes/storage. Screenshots were inspected. This is not a
screen-reader, Safari, real-device or full WCAG audit. Long native select labels
may be clipped in their closed control at narrow widths with doubled text;
their complete accessible option labels remain available in the native picker.

Unrelated AGENTS.md, next-env.d.ts and the pre-existing 17-test career-review
helper are preserved and excluded from the combined UI.2a + UI.2b patch.

## Deferred

UI.2c may add manual stations and source-fact editing under separate contracts.
Other station review, catalog confirmation and reference-Degree selection are
not implemented. A reference Degree is an ordinary timeline station selected
explicitly for a particular Survey/Program, never position zero or an automatic
choice from level, year, order or candidate count. No production donation,
authentication, consent, persistence, import or upload is introduced here.
