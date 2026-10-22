# UI.2b.1: Chronology Clarity and Reference Context

Historical increment note: [UI.2b.2](PHASE_UI2B2_SURVEY_REVIEW_UX.md) supersedes
the review-before-ordering dependency and the isolated reference notice below.
Its combined patch retains the separate unplaced group and placement contracts.

Verified baseline: `248108b973565b4a8b4656c9fa105f2921beeec3`, with the existing
uncommitted UI.2a and UI.2b increments preserved. The normative domain model,
Phase E, fixtures, homepage, Prisma and migrations remain unchanged.

## Known Dates Versus Unplaced Observations

`proposeDisplayOrder` now returns only observations with an OBSERVED structured
YEAR or MONTH start. Existing stable year ordering, month-precision runs and
year-only barriers are preserved. Missing, unknown, asserted and IMPRECISE
starts are excluded, not appended as apparently later events. No free text is
parsed into a date or year.

The fixture's known-date proposal is Internship (2019), M.Sc. (2019), Research
Assistant (March 2023). Short Course remains separately under **Zeitlich noch
einzuordnen**, with unchanged `around 2018` and **Zeitliche Einordnung unbekannt**.
This is not a fourth/later chronological event. Equal years need not be
sequential; concurrent activities remain possible.

The two named lists share one card renderer and have disjoint source keys.
Every observation exists once. The unplaced list retains original traversal
order. Original array order and ephemeral correlation keys remain internal;
`Quellangabe N` labels are removed. No position is shown before confirmation.

## Explicit Placement and Confirmation

Each unplaced card offers an initially blank, labelled select: **Vor/Nach** a
named currently placed station. A separate **In den Entwurf einordnen** action
performs insertion; merely selecting an option does not place or assert anything.
Choices bind to the current snapshot's original source, not its mutable display
index, so moving an anchor before application does not change its identity.

If every start is unknown, the first placement requires the explicit option
**Als erste Station im Entwurf**. Nothing is initially assigned position zero
or an inferred first position. The confirmation button remains disabled until
every included station has been placed. The handler also guards incomplete order.

Placement is a local display choice, not a Phase E assertion or date correction.
After insertion, the card still says its time is unknown and placement manual.
Only explicit ordering confirmation applies unique positive positions 1..N.
Confirmed labels use the actual chosen **Entwurfsplatz**. They describe the draft,
not historical temporal precedence. Moving invalidates confirmation and any
applied result. Reset restores the known proposal, unplaced cards, blank placement
and Degree choices, and no applied result. Changed context/reload discards state.

## Degree Review and Reference Context

The three independent Degree selectors remain blank initially. Review requires
all placements plus ordering confirmation. Every application recomputes the full
position batch and the single reviewed Degree's explicit claims from ORIGINAL
observations through the unchanged `applyExplicitReviewAssertions`,
`normalizeCareerBatch` and `validateNormalizationContract` functions.

Completed Master retains `graduationYear: null`, `graduationYear/MISSING` and
`catalogAssociation/UNKNOWN`. Other stations remain REVIEW_REQUIRED despite
their explicitly supplied positions. Observed values, date precision and source
correlation do not change.

**Referenzabschluss für die Befragung** is informational, always **Noch nicht
ausgewählt**. It explains separate confirmation for a particular survey/program.
The fixture establishes no valid program/catalog association. No candidate,
catalog ID, reference assertion, special position or SurveyResponse is created.

## Accessibility, Privacy and TDD

Placement labels and local uncertainty explanations are next to the controls.
Invalid placement focuses its select and links its error. Degree application
with unplaced observations focuses the first placement select rather than a
disabled confirmation button. Movement follows the moved control; an entirely
undated first placement focuses the station heading when both arrows are disabled.
One polite live region announces actions. Native selects/buttons support keyboard
use. No new dependency or framework is introduced in this increment.

The new 15 interaction tests demonstrated RED 15 failed, then GREEN 15 passed.
A further assertion reproduced and fixed focus loss when the first entirely
undated station was placed. After shared-renderer formatting/refactoring, all
81 review tests pass: the 30 UI.2a, 12 UI.2b and 14 SSR regressions remain, with
10 display/order tests adapted and 15 new chronology tests. These include all
six before/after anchor choices, complete-order gating, exact unresolved results,
reference context, reset, unchanged evidence and all-undated input.

Only source-neutral observations enter the client. No raw PROFILE, excluded
metadata, provider identifiers or raw snapshot are imported there. There are no
writes, storage, API routes, consent or donation claims. Exceptions remain redacted.
The pre-existing AGENTS.md, next-env.d.ts and 17-test helper stay outside the patch.

Chromium verification covers 320/375/768/1440px, initial/unplaced and reviewed
states, doubled text, keyboard placement and Enter/Space movement, focus,
confirmation/invalidation/reset, unselected reference context, no overflow and
HTML/client-bundle privacy. This is not a screen-reader, Safari, real-device or
full accessibility certification. Native closed select labels may clip at narrow
widths with doubled text; the native picker retains complete accessible labels.

Manual source editing/addition, general station review and reference confirmation
remain separate future increments. No chronology fact or reference is inferred.
