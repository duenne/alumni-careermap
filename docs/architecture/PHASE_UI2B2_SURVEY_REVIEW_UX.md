# UI.2b.2: Survey Context and Independent Review Draft

Baseline: `248108b973565b4a8b4656c9fa105f2921beeec3`, plus the preserved local
UI.2a/UI.2b/UI.2b.1 increments. The MVP Domain Model remains normative.

## Survey Program Versus Personal Reference

The organizer selects ONLY the Survey's reference Program. They select neither
an alumni's individual Degree nor a required level nor its timeline position.
The alumni later explicitly confirms an own completed Degree matching that
Program. These remain `Survey.referenceProgramId` and
`SurveyResponse.referenceDegreeId`, never a global reference flag or position zero.

The read-only `SurveyContext` server component displays three fixed demo labels:
Hochschule München, Management Sozialer
Innovationen, and Alumni-Karrierewege MSI. No faculty is known or invented.
The labels are presentation data, NOT stored Survey/catalog identities, an
authorized invitation, a token, or an authoritative program association.
No participant program control or query-parameter-based context is introduced.

Reference explanation is now within that context, above the career overview.
It always says **Noch nicht ausgewählt**. The
fixture supplies no confirmed MSI Program association: Synthetic M.Sc. is not
silently selected, regardless of explicit Master/completion review. A missing
matching Degree can be added/corrected in a later increment. Reference selection
is independent of general classification, Degree level and draft chronology.

## Independent State Boundaries

`DegreeReviewDraft` contains three editable blank selections. The pure
`reviewDegreeDraft` checks their explicit allowed values and returns a
`ReviewedDegreeSelection` with level/status ONLY. This is a local applied review,
not an enriched E.1 input, a canonical Degree, a position or a reference claim.

| Action | Local review | Confirmed order / canonical result |
|---|---|---|
| Select without applying | Not accepted | No implicit Degree claims |
| Apply valid review before chronology | Retained, focus on chosen-assertions heading | No Phase E call or fabricated position |
| Place/move station | Accepted choices retained | Ordering and canonical output invalidated |
| Explicit complete-order confirmation | Uses only previously applied choices | One combined real Phase E batch; otherwise position-only batch |
| Edit Degree choices | Previous application discarded until reapplication | Canonical output invalidated; confirmed order may remain |
| Apply after order confirmation | Explicit new/revised review | Recomputes real Phase E batch |
| Reset/context replacement/reload | Cleared | Proposal/unplaced group restored; no confirmed order/output |

Every canonical application starts from ORIGINAL immutable observations through
`applyExplicitReviewAssertions` -> `normalizeCareerBatch` ->
`validateNormalizationContract`. Enriched input is never replayed. No Phase E
implementation or contract changes. A normalization failure retains valid local
choices but returns no partial canonical output; errors remain redacted.

Statuses distinguish **Zu prüfen**, **Im Entwurf geprüft**, **Normalisiert** and
**Weitere Angaben nötig**. Local review plainly
states that order is still open and no Degree has been normalized. Completed
Master still retains null graduationYear, graduationYear/MISSING and
catalogAssociation/UNKNOWN; other stations remain REVIEW_REQUIRED.

## Preserved UX and Security Boundaries

Known/imprecise date groups, explicit relative placement, stable precision rules,
overlaps, no exposed source indexes and positive explicitly confirmed positions
remain unchanged. One card per source stays in the shared career overview.
Only source-neutral adapter output reaches client state. There are no raw
PROFILE imports, provider IDs, persistence, network writes or donation claims.

The existing server-side Survey/SurveyResponse contracts are unchanged: OPEN
guard, trusted operator scope, Program affiliation, Degree ownership/completion/
program matching, explicit reference confirmation and transactional persistence.
This demo calls NONE of those services and therefore cannot authorize a response.
Real survey/invitation resolution and security wiring remain deferred; display
labels and client/query data must never substitute for those server guarantees.

Legacy EducationAnchorSelector and AlumniForm were available and inspected for
terminology, contextual explanation and reviewable stations. No code/data was
copied. Global reference fields, automatic candidate handling, parsed free-text
years, Bachelor-centric before/after grouping, required graduation year, catalog
fetches, personal contact fields and legacy saving behavior are not carried over.

## Verification and Deferred Work

Fourteen new DOM tests demonstrated RED 9 failed/5 passed, then GREEN 14 passed.
After adapting six obsolete dependency/status assertions, all 95 focused tests
pass. Refactoring shares explicit selection validation and limits order-error
focus to the final confirmation action. Existing regressions remain covered.

Chromium checks cover 320/375/768/1440px, keyboard/focus, initial/local/canonical
states, doubled text, no horizontal overflow, unchanged reference context,
query non-authority, HTML/client-bundle privacy, reset/reload and no writes/storage.
No screen-reader, Safari or real-device audit is claimed. Native closed select
labels can clip at narrow doubled-text sizes; complete labels remain available
in the native picker. This build is DEMO ONLY, not production data donation.

Manual station editing/addition (UI.2c), other-station review, catalog/reference
selection, organizer UI, trusted invitation issuance, authorization and storage
require separate increments. No schema, migration, fixture, oracle or service
authorization change is included. Unrelated local agent/generated files and the
17-test career-review helper remain outside the combined review patch.
