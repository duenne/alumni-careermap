# UI.2a: Local Degree Review Demo

Historical increment note: [UI.2b](PHASE_UI2B_INLINE_TIMELINE.md) supersedes
the separate form and numeric position workflow below. Its combined patch
retains the real assertion pipeline and the adapted UI.2a regression tests.

## Boundary

The `/review` server route adapts the existing fictional E.4a snapshot with
`adaptLinkedInSnapshot`. Only its source-neutral `NormalizationInput` crosses
the client boundary. The raw snapshot, PROFILE, provider identifiers and
excluded metadata are not imported by the interactive client. The four source
cards remain unchanged and in source order, not asserted timeline order.

One form targets the snapshot's third source station, `Synthetic M.Sc.`. This
is a fixed demonstration, not a general import or identity-binding mechanism.
Its key comes from the currently presented adapter output, never a persisted
identifier. A changed input remounts the local draft; a reload clears it.

## Explicit Review

Classification, Degree level, status and positive integer position start empty.
All four must be independently supplied. Editing alone invokes no assertion or
normalization. Submission uses `applyDegreeReviewDraft`, which invokes the real
E.4b.1 `applyExplicitReviewAssertions`, E.3a `normalizeCareerBatch` and
`validateNormalizationContract`. No Phase E contract is changed.

Every submission applies the complete current draft to the same original
observations, never a previously enriched input. Revision and reset therefore
do not overwrite or replay assertions. The existing unrelated local
`src/lib/career-review` helpers are not dependencies of this slice: their broader
partial/multi-station draft contract is not needed here.

The UI separates source observations, explicit review choices, canonical
normalization and remaining decisions. A completed Master at position 1 has
`graduationYear: null`, with exactly `graduationYear/MISSING` and
`catalogAssociation/UNKNOWN` unresolved for that station. The other three
stations retain their original unresolved outcomes. Completion, graduation,
catalog association and timeline order are never inferred from titles or dates.

The draft exists only in React state. There is no save, submission, storage,
API call or production donation. All exception details are replaced by a fixed
German error; source-bearing exceptions are not rendered or logged.

## Interaction and Verification

Controls have visible German labels, blank options, required attributes and
field-linked errors. Invalid submission focuses the affected control; successful
application focuses the result heading. Reset returns focus to classification.
A polite status region announces changes; errors use an alert. Editing hides
the stale result until the next explicit application.

Thirty new jsdom/React DOM tests were written first: RED 30 failed, then GREEN
30 passed. jsdom is a pinned development-only dependency; existing Node tests
keep their environment. Coverage includes independent choices, all levels,
status/graduation independence, exact unresolved inventories, unchanged other
stations, revisions from original evidence, reset, malformed input, redaction,
contract rejection, context changes, privacy and focus/status behavior.

Chromium checks cover 320, 375 and 1440 pixel widths, doubled text size,
interaction, focus, revision, reset, reload, no writes/storage and absence of
excluded fixture data in HTML and downloaded client scripts. This is not a
screen-reader, real-device or cross-browser accessibility certification.

## Remaining Scope

Later increments may extend controlled review to other stations. Catalog and
reference-Degree selection, authentication, consent, persistence, imports and
production donation remain outside this demo. They require separate contracts
and tests; ephemeral source keys provide no session authorization or provenance.
