# V2.4 – geprüfter Checkpoint

Prüfung am 2026-10-28 auf `feat/vertical-prototype-aggregation`.
Ausgangs-HEAD lokal und nach `git fetch` auch remote:
`f95de319cb49c83bf83432443fc672f64233b290`.
V2.4-Commit: `1e31bde81bf079f182ce271dc3f1b173f069769c`
(`feat(analytics): improve sankey career path overview`).

## Umfang und Ausschlüsse

Die 19 V2.4-Dateien umfassen die Vier-Stufen-Übersicht, lokale Masterfilter,
Darstellungsfokus, Layout, Interaktion, synthetische Tests, den lesenden Vergleich
und die zugehörige Dokumentation. Fachliche Regeln und Grenzen stehen in
[V2_4_SANKEY_IMPROVEMENTS.md](V2_4_SANKEY_IMPROVEMENTS.md).
Domain Model, Datenbankschema, Migrationen und Schreibwege bleiben unverändert.

Die schon vorhandenen unversionierten Verzeichnisse `.agents/`, `.claude/`,
`.windsurf/` und `skills-lock.json` gehören nicht zum Checkpoint. Ebenfalls
ausgeschlossen sind `.env*`, Zugangsdaten, Datenbanken, persönliche Daten,
`.local-fixtures/phase-d/`, Screenshots und andere generierte Artefakte.
Die durch die Testserver erzeugte Änderung von `next-env.d.ts` wurde auf den
vorherigen Inhalt zurückgeführt. Die Commit-Auswahl wurde explizit geprüft;
es wurden keine Verzeichnisse pauschal hinzugefügt.

## Erneut ausgeführte lokale Prüfungen

Node.js 22.23.3 gemäß `.nvmrc`, Abhängigkeiten gemäß `package-lock.json`,
Chromium aus Playwright 1.64.1. Integration und persistente Browserprüfungen
verwenden eigene kurzlebige PostgreSQL-17-Container und versionierte Migrationen.

| Befehl | Ergebnis |
|---|---|
| `npx vitest run src/lib/analytics src/app/dev/analytics` | 51 bestanden |
| `npm run lint` | bestanden |
| `npm test` | 933 bestanden, 1 bestehender optionaler Korpustest übersprungen |
| `npm run db:validate` | bestanden |
| `npm run test:integration` | 371 bestanden, 1 bestehender optionaler Korpustest übersprungen |
| `npm run typecheck` | bestanden |
| `npm run build` innerhalb `npm run test:e2e` | bestanden |
| `npm run test:e2e` | alle 59 Chromium-Tests bestanden |
| davon Review / Produktionsschutz | 4 bestanden |
| davon Import / OAuth / Mapping / Workflow | 30 / 8 / 6 / 2 bestanden |
| davon `npm run test:e2e:analytics` | 9 bestanden: Desktop, Tablet, schmal |
| `npm run test:e2e:analytics:local` | 1 bestanden: 100 Profile und 432 Stationen |
| `npm run analytics:compare` | Bestand und dokumentierte Aggregationszahlen bestätigt |
| `git diff --check` und Prüfung des Index | bestanden |

Keine Abweichung von den dokumentierten 933 / 371 / 59 bestandenen Tests.
Die beiden bestehenden optionalen Korpustests sind ausdrücklich keine bestandenen
Tests. Es wurden keine Tests entfernt, neu übersprungen oder abgeschwächt.
Anfangs durch die Sandbox blockierte Docker-/Server-/Datenbankprüfungen wurden
mit Ausführungsfreigabe erfolgreich wiederholt. Ein realer Screenreader-Test
wurde weiterhin nicht durchgeführt.

## Nachgewiesener CI-Abbruch und Korrektur

Der [alte Lauf 39984473493](https://github.com/duenne/alumni-careermap/actions/runs/39984473493)
auf dem Ausgangs-HEAD wurde im einzigen Job nach 15 Minuten während Mapping
abgebrochen. Das Log zeigt:

- Browserbereitstellung: 16:11:28 bis 16:23:50 UTC, rund 12 Minuten 22 Sekunden.
- Review, Import und OAuth bestanden; Mapping wurde abgebrochen.
- Workflow wurde nicht mehr ausgeführt; Analytics fehlte im Workflow vollständig.

Die separate CI-Korrektur behält sämtliche regulären Prüfungen im Job `checks`
(15 Minuten) und führt sämtliche Browser-Suites im unabhängigen Job `browsers`
(30 Minuten) aus. Beide verwenden fest `ubuntu-24.04`, Node aus `.nvmrc` und
`npm ci`. Dadurch verbraucht langsame Browserbereitstellung kein Budget der
regulären Prüfungen. Chromium und Systemabhängigkeiten werden weiterhin vollständig
mit `npx playwright install --with-deps chromium` installiert; es wird kein
unbelegter Cache-Geschwindigkeitsgewinn vorausgesetzt.

Der Browserjob erstellt einen eigenen Produktionsbuild und führt anschließend
Review, Import, OAuth, Mapping, Workflow und ausdrücklich
`npm run test:e2e:analytics` sequenziell aus. Die Reihenfolge vermeidet Konflikte
zwischen den gemeinsam verwendeten lokalen Ports. Analytics-HTML-Reports und
Testergebnisse werden mit den vorhandenen Browserartefakten hochgeladen.

Die Workflow-YAML wurde lokal geparst und auf die vollständige Befehlsabdeckung
geprüft: vor der Korrektur fehlte Analytics, danach besteht die Prüfung.
Die tatsächliche GitHub-Ausführung ist separat zu beurteilen: lokale erfolgreiche
Tests bedeuten noch keinen erfolgreichen Remote-Lauf. Den Lauf zum Checkpoint
findet man über seine Commit-SHA in GitHub Actions; dessen Abschlussstatus ist
für die CI-Abnahme maßgeblich.

## Reproduktion und Weiterentwicklung

In einem frischen Checkout Node aus `.nvmrc` verwenden, `npm ci` ausführen,
Docker für PostgreSQL 17 bereitstellen und die obigen regulären Prüfungen starten.
Für die gesamte Browserkette zuerst
`npx playwright install --with-deps chromium`, dann `npm run test:e2e` ausführen.
Diese Kette benötigt keinen lokalen Phase-D-Korpus und enthält Analytics.
Der optionale lokale 100er-Test und `analytics:compare` benötigen zusätzlich die
bereits eingerichtete separate Analytics-Demo; ihre Daten und Konfiguration
werden nicht mitgeliefert.

Für die nächste Entwicklungsphase einen neuen Branch vom finalen Checkpoint
erstellen. Dieser Checkpoint enthält keinen V3-Code und keinen Merge nach `main`.
