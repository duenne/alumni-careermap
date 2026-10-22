# V0 – Review-Demo: Testnachweis und manuelle Abnahme

Stand: 22.10.2026. **Implementiert und lokal automatisiert geprüft; manuelle Abnahme ausstehend.**
Es wurde ausschließlich V0 umgesetzt. Kein Commit, Push oder Merge wurde ausgeführt.

## Ausgangsstand und Review

- Branch: `feat/alumni-review-ui`.
- HEAD: `3531a4088220a036314afa5e50411514121bb5ef` (unverändert).
- Vorhandene Änderungen beim Start: `AGENTS.md`, `next-env.d.ts`; unversioniert waren `.agents/`, `.claude/`, `.windsurf/`, `docs/testing/`, `skills-lock.json`, `src/lib/career-review/`. Diese Vorarbeiten wurden nicht inhaltlich verändert. Die vom Build automatisch umgeschriebene `next-env.d.ts` wurde auf ihren beim Start vorgefundenen Inhalt zurückgesetzt.
- Der angeforderte undatierte Handover existiert nicht. Gelesen wurde [der datierte Handover](ALUMNI_VERTICAL_TESTING_HANDOVER_2026-10-22.md), insbesondere Abschnitt 5 mit dem V0-Ablauf.
- Ein vollständiger Code-Review-Bericht liegt im Repository nicht vor. Die verbundene GitHub-Suche fand keinen PR zum aktuellen Branch. Der Bericht wurde beim Nutzer angefragt; P0/P1-Findings daraus konnten nicht verifiziert werden. Die Prüfung der relevanten Demo-Codepfade ergab keinen nachgewiesenen V0-Blocker; das ersetzt den fehlenden Bericht nicht.
- `npm audit` meldet sowohl am HEAD-Lockfile als auch nach V0 identische Befunde: **9 high, 2 moderate, 0 critical**, jeweils Exitcode 1. Playwright fügt keinen Audit-Befund hinzu. Der Vergleich liegt in `artifacts/v0/audit-comparison.json`. Bestehende Dependency-Befunde wurden nicht durch ungeprüfte Updates verändert; Hintergrund: [Dependency Audit](../DEPENDENCY_AUDIT.md).

## RED → GREEN → REFACTOR

1. **Vorprüfung:** Die bestehenden Einstieg-/Review-Tests liefen zuerst: 8 Dateien, 120 Tests erfolgreich.
2. **RED – fehlende Infrastruktur:** Die neue Browser-Journey wurde zuerst geschrieben. `npm run test:e2e` scheiterte mit `Missing script: "test:e2e"`. Das ist ein Infrastruktur-RED, kein behaupteter UI-Defekt. Protokoll: `artifacts/v0/red-missing-runner.log`.
3. **Umgebung:** npm-Download, lokales Server-Binding und Docker-Zugriff wurden zunächst durch die Sandbox gesperrt. Die erforderlichen Aufrufe wurden anschließend mit freigegebenem Zugriff erfolgreich wiederholt. Der erste Build war bereits erfolgreich; der Browser-Start scheiterte dort an `listen EPERM` (`artifacts/v0/e2e-first.log`).
4. **Erster echter Browserlauf:** Beide Projekte scheiterten im Testhelfer für native Selects: Home/Pfeiltaste/Tab übernahm unter macOS die Auswahl nicht (`Bitte auswählen` statt `Akademischer Abschluss`). Korrektur ausschließlich im Test: Auswahl über native Tastatur-Texteingabe mit anschließender Tab-Taste. Fehlerprotokoll: `artifacts/v0/red-browser-select.log`; Screenshots, Videos, Traces und Fehlerkontext liegen unter `artifacts/v0/first-browser-failure/`.
5. **GREEN:** Derselbe Akzeptanzablauf besteht in beiden Viewports. Es war **keine Änderung an UI-Funktionen** erforderlich.
6. **REFACTOR:** Kleine gemeinsame Helfer für Tastaturnavigation, Zustandsprüfungen und Screenshots; benannte Testschritte entsprechend dem Handover. Der Testserver startet den vorhandenen Standalone-Build einschließlich statischer Assets, entsprechend dem Hinweis von Next.js zu `output: "standalone"`.

## Minimaler Patch

| Datei | Zweck |
| --- | --- |
| `tests/e2e/review-demo.spec.ts` | Eine vollständige Browser-Journey nach Handover, zweimal ausgeführt: Desktop und schmaler Viewport |
| `playwright.config.ts` | Chromium, ein Worker, keine automatischen Wiederholungen, eigener lokaler Server auf Port 3102, HTML-Bericht und Fehlerartefakte |
| `scripts/start-e2e.mjs` | Statische Assets zum Standalone-Build kopieren und dessen Server starten |
| `package.json`, `package-lock.json` | Exakt fixiertes `@playwright/test` 1.64.1 und `test:e2e`-Kommando; drei neue Pakete, keine Updates bestehender Pakete |
| `.gitignore`, `eslint.config.mjs` | Generierte Browserberichte und lokale Testartefakte ignorieren |
| `.github/workflows/ci.yml` | Chromium installieren, den vorhandenen Produktionsbuild testen und Berichte/Screenshots als `v0-browser-tests` für 14 Tage hochladen |
| Dieses Dokument | Testnachweis und manuelle Abnahmeanleitung |

Die Journey verwendet echte Tab-/Enter-Ereignisse und native Select-Texteingabe. Sie prüft Feldfehler einschließlich Fokus, `aria-invalid` und zugänglicher Beschreibung, genau einen geöffneten Detailbereich, unveränderte Quelltexte, manuelle Platzierung, Normalisierung, Entwertung durch Verschieben, Reset und Reload. In Ausgangszustand, bestätigtem Entwurf und nach Reload wird zusätzlich auf horizontalen Seitenüberlauf geprüft.

Nicht-lesende Browser-Requests werden vor dem Senden blockiert und lassen den Test fehlschlagen. Beide erfolgreichen Läufe beobachteten **keine schreibenden Requests und keine unbehandelten Browserfehler**. Der Testserver erhält eine unbrauchbare lokale `DATABASE_URL`; die Demo benötigt keine Datenbank. Das ist kein Nachweis einer produktiven Speicherung. Keine Domänenänderung, Migration, OAuth- oder Sankey-Implementierung ist enthalten.

## Ausgeführte Prüfungen

Alle erfolgreichen Prüfungen liefen lokal mit Node.js **22.23.3**.

| Prüfung | Ergebnis | Lokales Protokoll |
| --- | --- | --- |
| Review-/Einstiegstests vor Infrastrukturänderung | 120 Tests in 8 Dateien bestanden | Terminalausgabe der Vorprüfung |
| `npm run lint` | Exitcode 0 | `artifacts/v0/lint.log` |
| `npm test` | 809 Tests in 20 Dateien bestanden | `artifacts/v0/unit.log` |
| `npm run db:validate` | Exitcode 0 | `artifacts/v0/db-validate.log` |
| `npm run test:integration` | 363 Tests in 8 Dateien bestanden, isolierter PostgreSQL-17-Dockercontainer anschließend entfernt | `artifacts/v0/integration.log` |
| `npm run typecheck` | Exitcode 0 | `artifacts/v0/typecheck.log` |
| `npm run build` als Teil von `npm run test:e2e` | Prisma-Generierung und Next.js-Produktionsbuild erfolgreich | `artifacts/v0/e2e-green.log` |
| `npm run test:e2e` | 2/2 Browser-Journeys bestanden, 1280 × 900 und 375 × 812 | `artifacts/v0/e2e-green.log` |
| `git diff --check` | Exitcode 0 | Terminalausgabe |

Remote-CI wurde nicht ausgeführt, da kein Push freigegeben ist. Lokal wurde Chromium unter macOS geprüft; Firefox, WebKit, reale Mobilgeräte und der Linux-CI-Lauf sind nicht als geprüft ausgewiesen. Die beiden Screenshots des bestätigten Entwurfs wurden zusätzlich visuell kontrolliert. Die manuelle Nutzerabnahme bleibt offen.

## Automatisiert selbst ausführen

Im Repository-Verzeichnis:

```bash
nvm use
npm ci
npx playwright install chromium
npm run test:e2e
```

`npm run test:e2e` baut die Anwendung, startet selbst einen lokalen Standalone-Server auf `127.0.0.1:3102`, führt beide Journeys aus und beendet den Server wieder. Port 3102 muss frei sein; ein bereits laufender Server wird bewusst nicht übernommen. Eine Datenbank ist für diesen Browser-Test nicht nötig. Ein parallel laufender Entwicklungsserver sollte vor dem Produktionsbuild beendet werden, da beide `.next/` verwenden.

Für sichtbare Browserfenster: `npm run test:e2e -- --headed`.
Nach einem bereits erfolgreichen Build genügt `npx playwright test`.
HTML-Bericht öffnen: `npx playwright show-report`.
Auf Linux bei fehlenden Systembibliotheken: `npx playwright install --with-deps chromium` (so auch in CI konfiguriert).

## Manuelle Abnahme im Browser

```bash
nvm use
npm run dev -- --hostname 127.0.0.1 --port 3100
```

1. [Startseite öffnen](http://127.0.0.1:3100/). Den Hinweis auf fiktive Daten ohne Datenspende prüfen. „Beispiel-Karriereweg ansehen“ führt zu [Review](http://127.0.0.1:3100/review).
2. Die Vorschlagsliste enthält Internship → M.Sc. → Research Assistant. Der Short Course steht separat unter „Zeitlich noch einzuordnen“. Referenzabschluss: „Noch nicht ausgewählt“. Keine Entwurfsplätze; Reihenfolgeübernahme deaktiviert. Das entspricht Screenshot `01-ausgangszustand`.
3. „Prüfen: Synthetic M.Sc.“ öffnen und ohne Eingaben „Auswahl im Entwurf anwenden“ betätigen. Es erscheint eine Fehlermeldung; Fokus liegt auf „Art der Station“. Akademischer Abschluss auswählen. Ohne Abschlussart erneut anwenden: Fehler und Fokus dort. Master wählen, ohne Abschlussstatus erneut anwenden: Fehler und Fokus dort.
4. Abgeschlossen wählen und anwenden. Erwartet: „Im Entwurf geprüft“, „Reihenfolge noch offen“, noch kein normalisiertes Ergebnis.
5. Beim Short Course „Zeitlich einordnen“ öffnen. Optional zunächst ohne Platzierung einordnen: Feldfehler mit Fokus. „Vor Synthetic M.Sc.“ wählen. Allein die Auswahl verschiebt noch nichts.
6. „In den Entwurf einordnen“ betätigen. Erwartete Reihenfolge: Internship → Short Course → M.Sc. → Research Assistant. `around 2018` bleibt ungenau.
7. „Reihenfolge für den Entwurf übernehmen“ betätigen. Entwurfsplätze 1–4, M.Sc. „Teilweise normalisiert“. Abschlussjahr nicht angegeben, Katalogzuordnung unbekannt, Referenz weiter ungewählt. Das entspricht Screenshot `02-bestaetigter-entwurf`.
8. M.Sc. mit dem Aufwärtspfeil verschieben. Bestätigte Plätze und normalisiertes Ergebnis verschwinden; Master/Abgeschlossen bleiben erhalten. Reihenfolge erneut bestätigen: M.Sc. hat jetzt Entwurfsplatz 2 und wieder ein normalisiertes Ergebnis.
9. Internship-Details öffnen, danach M.Sc. prüfen: maximal ein Detailbereich offen, Auswahl und Ergebnis bleiben erhalten. Schließen führt den Fokus zurück zum auslösenden Button.
10. „Entwurf zurücksetzen“ betätigen. Ursprüngliche Liste, Short Course wieder separat, keine Bestätigung/Normalisierung; Fokus auf „Zeitliche Übersicht“. M.Sc. erneut öffnen: alle drei Auswahlfelder leer.
11. M.Sc. erneut bearbeiten und anwenden, dann Seite neu laden. Ursprünglicher Demo-Zustand mit „Nur Demo – nichts gespeichert“. Das entspricht Screenshot `03-nach-reload`.
12. Auf 375 Pixel Viewportbreite wiederholen. Mit Tab/Shift+Tab navigieren, Buttons per Enter betätigen und Selects per Tastatur wählen. Fokus und Fehlermeldungen müssen erreichbar und sichtbar sein; kein horizontaler Seitenüberlauf.

Keine erfolgreiche Datenspende oder Speicherung bestätigen: V0 sichert ausschließlich den flüchtigen Demo-Entwurf ab.

## Screenshots und Testartefakte

Die PNGs werden bei jedem Lauf unter `test-results/` erzeugt und in den HTML-Bericht `playwright-report/index.html` eingebunden. Der Bericht enthält außerdem die benannten Testschritte und pro Projekt das JSON-Attachment `browser-evidence` mit Viewport, schreibenden Requests und Browserfehlern. Bei Fehlern kommen Screenshot, Trace-ZIP, Video und Fehlerkontext hinzu; bei erfolgreichen Läufen werden Trace und Video nicht behalten.

Eine lokale Kopie der sechs erfolgreichen Screenshots liegt zusätzlich unter `artifacts/v0/screenshots/`:

| Zustand | Desktop | Schmal |
| --- | --- | --- |
| Ausgangszustand | [01](../../artifacts/v0/screenshots/desktop/01-ausgangszustand.png) | [01](../../artifacts/v0/screenshots/narrow/01-ausgangszustand.png) |
| Bestätigter Entwurf | [02](../../artifacts/v0/screenshots/desktop/02-bestaetigter-entwurf.png) | [02](../../artifacts/v0/screenshots/narrow/02-bestaetigter-entwurf.png) |
| Nach Reload | [03](../../artifacts/v0/screenshots/desktop/03-nach-reload.png) | [03](../../artifacts/v0/screenshots/narrow/03-nach-reload.png) |

Berichte, Screenshots, Browserinstallationen und lokale Protokolle sind generierte, nicht zu commit­tende Artefakte. Die CI-Erweiterung lädt ihre Berichte erst nach einem später ausdrücklich freigegebenen Push/PR-Lauf hoch. Die lokale Kopie in `artifacts/v0/` wurde für diese Abnahme bereitgestellt und wird vom Testskript nicht automatisch aktualisiert.
