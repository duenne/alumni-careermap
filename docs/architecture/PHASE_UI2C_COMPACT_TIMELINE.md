# UI.2c: Compact Timeline Presentation

Presentation correction on the preserved local UI.2a-UI.2b.2 work, based on
`248108b973565b4a8b4656c9fa105f2921beeec3`. The normative domain model and
Phase E implementation, fixtures and review helpers are unchanged.

## One Overview, One Inline Detail

The default **Zeitliche Übersicht** shows each observation once: observed period,
title, organisation and review status. No initial form or detailed date list.
Structured starts remain in the existing provisional order; imprecise/missing
starts remain under **Zeitlich noch einzuordnen**. `ObservedDate` retains exact
source precision and missing-end labels. No free-text year parsing or inference.
Final order confirmation/reset actions follow the overview, rather than pushing
the first station below a large block of controls and status text.

`activeStationKey` is presentation state only. **Prüfen** opens the nominated
demo Degree review; other stations have working read-only details. Relative
placement is revealed through **Zeitlich einordnen** and still requires a separate
explicit insertion action. Only one detail area is mounted at a time, inside its
original station. Disclosure buttons expose expanded/controlled relationships.

Closing or switching panels does not change the local review, confirmed order or
canonical result. Those remain owned by the existing timeline session, not its
collapsible child. Opening focuses the detail heading; closing restores the
trigger. Existing field-error, movement, placement, result and reset focus is
retained. Confirmation with an applied review opens that station's result.

The server view nominates the fixed demo's E.4a source record `snapshot:2:0`
ONLY when the whole presented input equals the original fixed adapter output.
It does not assume that the third input station is academic, infer eligibility
from its title/category, or enable the form for replacement snapshots. This is
a narrow demo binding, not persistent identity, snapshot authorization or proof
of provenance. The raw fixture stays on the server; only source-neutral adapter
output and the nominated ephemeral key reach the interactive component.

## Preserved Decisions

Local review can precede order confirmation, but never produces a fabricated
position or premature canonical Degree. Placement/movement invalidates confirmed
order and dependent output while retaining accepted local Degree decisions.
Only explicit complete-order confirmation supplies positions 1..N. All combined
applications use ORIGINAL observations and the real Phase E functions.

Completed Master still has null graduation year and unresolved
graduationYear/MISSING and catalogAssociation/UNKNOWN. Other stations remain
REVIEW_REQUIRED. Survey Program is fixed demo presentation; personal reference
Degree remains **Noch nicht ausgewählt**. No saving, networking, new station,
reference confirmation or production data donation is implemented.

## TDD and Verification

Baseline: 792 unit tests. Eleven new jsdom tests demonstrated RED (11 failed)
against the previous UI; GREEN includes all 106 focused review tests. Earlier
interaction tests now explicitly open the editor/placement controls; their
normalization, immutability, ambiguity, error-redaction and privacy assertions
remain. Context replacement tests additionally reject the old blind target
binding. The presentation refactor reuses `ObservedDate` and centralizes
disclosure/focus handling without another sorting or review mechanism.
The visual refinement moving final confirmation below the overview also had a
failing interaction assertion first (1 failed / 10 passed), then GREEN again.
Full unit coverage is 803 tests in the worktree, including the preserved 17-test
independent helper; the combined review patch has 786. PostgreSQL 17 integration
covers 363 tests. Lint, typecheck, schema validation and build are checked for
both the current source and a clean patched HEAD export. The current-source
build runs in an exact source copy to avoid Next rewriting protected
`next-env.d.ts` or disrupting the user's existing dev server.

Test logs and real Chromium screenshots are local under
`/tmp/alumni-ui2c-testlogs/` and `/tmp/alumni-ui2c-screenshots/`.
Browser acceptance covers compact/open views, 320/375/768/1440px and 200% text,
keyboard interaction, focus, overflow and HTML/client-bundle privacy. This is
not a screen-reader, Safari or physical-device accessibility audit. Native select
labels may require opening the picker at narrow doubled-text sizes. Vertical
scrolling remains necessary; no fixed-height panels hide controls.

Manual source editing/addition and other-station classification are deferred.
The dated UI handover mentioned in the task was not found in the repository;
the current UI.2b.2 decision record and actual worktree were inspected instead.
