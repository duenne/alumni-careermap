# UI.1 / UI.1a — Entry and read-only career observations

Baseline: `11c0db2b9e9f8fe4c40aaf168dbc08c91d60e114` on
`feat/alumni-review-ui`. The MVP Domain Model remains normative.

## Scope and presentation

`/` explains the purpose of collecting alumni career paths and offers one primary
action, **Beispiel-Karriereweg ansehen**, linking to `/review`.
Both routes call the existing `adaptLinkedInSnapshot` with the unchanged fictional
E.4a fixture. Both routes are server components and are statically prerendered.
There is no import, upload, consent, authentication, review submission or saving.

The shared `ObservedStations` component shows only OBSERVED title, organisation
label, category and dates, with a compact variant for the entry page. Cards retain
source traversal order; the displayed list is not an asserted career timeline.
POSITIONS is labelled **Positionsangabe**, EDUCATION **Ausbildungsangabe**.
Neither establishes a CareerStep classification or academic Degree. All four
observations are **Zu prüfen**. Assertions, catalog IDs, completion, graduation,
ongoing status and reference selection are not projected into this UI.

Year and month precision use matching HTML `time` values. Imprecise source text
such as `around 2018` stays verbatim and is labelled as imprecise. Missing end
dates show **Ende nicht angegeben**; explicitly unknown facts remain unknown.
An empty input has a plain empty state. Adapter failures show a fixed fallback
with a return link; source values and exception messages are not displayed.

PROFILE values, excluded station metadata and provider IDs never reach the view.
Only the real adapter's source-neutral observations are passed to the server
component. There is no client-side JSON dump or fixture serialization.

## Design and accessibility

White/light-grey surfaces, charcoal text and a restrained red accent provide a
quiet academic visual direction. The small route mark is original, not an
institutional logo or claim of endorsement. System fonts avoid remote assets.
Cards have a 6px radius; sections remain unframed. The layout starts with one
column; the review uses two columns on wider screens and the compact entry preview
can use four. No connecting lines or numbered station positions imply chronology.

German document language, one main landmark and H1, a keyboard skip link, visible
focus outlines, heading-labelled articles, a named list and date definition lists
support navigation. Review state is communicated with text as well as colour.
Browser checks cover 320/375/768/1440px, keyboard navigation, image loading,
horizontal overflow, doubled text size and privacy of the full rendered HTML.
Screenshots were visually inspected. No screen-reader or cross-browser audit has
been performed; these checks do not establish full accessibility conformance.

All seven permitted legacy UI files were available in the sibling `alumni-careers`
checkout and consulted for terminology and flow only. The reference deployment
could not be retrieved through the web tool. No legacy backend, data or assets
were used.

## TDD and local review boundary

The initial worktree already contained an interactive review draft and its helper
tests. Original local changes are preserved in `/tmp/ui1-initial-worktree.patch`.
The route's UI was adapted to this requested read-only increment; the pre-existing
`src/lib/career-review/` helper and tests are untouched and unused by UI.1.
Pre-existing generated changes to AGENTS.md/next-env.d.ts are outside this slice.

The UI.1 focused suite demonstrated **13 failed / 2 passed** before implementation,
then **15 passed**. The complete local suite passed **704 tests**, including 17
pre-existing helper tests outside the targeted patch. PostgreSQL 17 integration
passed **363 tests** using the existing disposable database runner and all five
unchanged migrations. Lint, Prisma validation, typecheck and production build
passed with Node 22.23.3. No dependency changes were required.
The targeted patch also applied byte-identically to a clean HEAD export, whose
unit suite passed **687 tests** without the pre-existing interactive helper.

## UI.1a — Purpose and meaningful preview

The entry page replaces generic informational columns with all four actual fixture
observations, each present once and still marked **Zu prüfen**. The three planned
steps are **Angaben übernehmen → Stationen prüfen → Karrierewege sichtbar machen**.
The last step explicitly says **Zukünftig**. The only primary action remains the
example navigation; there are no nonfunctional review, import or saving controls.

The review distinguishes **Beobachtet** from **Noch offen**, explains that source
order is not confirmed chronological order, and describes future explicit human
review in plain German. The shared component only formats existing observations;
it introduces no adapter, classifier, date parser or domain normalization rule.
Local array indices serve as React rendering keys, without exposing the source
correlation keys or asserting timeline positions.

UI.1a demonstrated RED with **6 failed / 16 passed**, followed by **22 passed**
before and after extracting the shared renderer. The complete current worktree
passes **711 unit tests**. The targeted UI.1 + UI.1a patch passes **694 unit tests**
on a clean HEAD export; the difference is the same 17 pre-existing helper tests.
Both worktrees pass **363 PostgreSQL 17 integration tests**. No fixture, Phase E
implementation, oracle, Prisma schema, migration or package dependency is changed.

Browser verification covers both routes at 320/375/768/1440px, with normal and
doubled text size (16 layout checks), exact observation presence/order, source
uncertainty, keyboard skip/navigation and absence of excluded data in full HTML.
Screenshots are local review artifacts, not repository data. Assistive-technology
and cross-browser testing remain future verification work.

## UI.2

Next work can add controlled explicit assertions through
`applyExplicitReviewAssertions`, bound to the presented observations. It needs
separate tests for user actions, conflicting claims and revision/context handling.
Reference confirmation and persistence remain separate decisions. UI.1 neither
supplies these assertions nor claims that any observation has been confirmed.
