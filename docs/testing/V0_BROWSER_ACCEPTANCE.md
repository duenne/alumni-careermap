# V0 – Browser-Test und manuelle Abnahme

Stand: 22.10.2026. **Implementiert und automatisiert geprüft; manuelle Abnahme offen.** Kein Commit, Push oder Merge erfolgt.

## Ausgangspunkt und Abgrenzung

- Branch: `feat/alumni-review-ui`.
- HEAD: `3531a4088220a036314afa5e50411514121bb5ef`.
- Gelesen: `AGENTS.md`, MVP Domain Model, Requirements, UC-01 und das tatsächlich vorhandene `ALUMNI_VERTICAL_TESTING_HANDOVER_2026-10-22.md`. Der im Auftrag genannte undatierte Handover-Pfad existiert nicht.
- Bereits beim Start waren Playwright-Konfiguration, Browser-Journey, CI-/Ignore-/Skriptänderungen sowie weitere unversionierte Dateien vorhanden. Diese wurden nicht als eigene Neuentwicklung ausgegeben oder gelöscht. Die bisher fehlende Testabhängigkeit wurde ergänzt und die vorbereitete Journey erstmals ausführbar geprüft.
- Keine Änderung am Anwendungscode, Domänenmodell, Prisma-Schema oder an Migrationen durch diese V0-Arbeit. Keine Speicherung, OAuth- oder Sankey-Implementierung.

Ein vollständiger priorisierter Code-Review-Bericht war weder im Repository noch in einem PR zum aktiven Branch auffindbar. Das Handover warnt ausdrücklich vor dieser Lücke. Der Bericht wurde beim Nutzer angefragt; seine unbekannten P0/P1-Findings können daher nicht als erledigt gelten. Die lokale Prüfung der V0-Codepfade und der Browserablauf ergaben keinen nachgewiesenen UI-Fehler. `docs/DEPENDENCY_AUDIT.md` enthält ältere offene Abhängigkeitsbefunde; die Installation meldete 11 Paketbefunde (2 moderate, 9 high). Es wurde kein erneuter vollständiger Security-Audit vorgenommen.

## RED → GREEN → REFACTOR

1. **RED, Infrastruktur:** Unter Node 22.23.3 scheiterte der Import von `@playwright/test` mit `ERR_MODULE_NOT_FOUND`. Testdatei und Konfiguration waren vorhanden, die Dependency fehlte in Manifest und Lockfile. Die Test-Discovery war damit nicht reproduzierbar ausführbar. Logs: `artifacts/v0/logs/01-red-missing-playwright.log` und `01-red-e2e-discovery.log` (letzteres zusätzlich mit npm-Netzwerkfehler).
2. **GREEN, minimale Ergänzung:** `@playwright/test@1.64.1` exakt als Development-Dependency samt Lockfile ergänzt. Die Discovery findet zwei Ausführungen derselben Journey. Ein erster vollständiger Lauf baute erfolgreich, scheiterte aber am Sandbox-Verbot für den lokalen Port (`EPERM`, `03-first-browser-run.log`). Nach Freigabe des lokalen Testservers bestanden beide Browserläufe.
3. **REFACTOR/Abschluss:** Vorhandene Rollen-/Label-Selektoren, kleine Tastaturhelfer und `test.step`-Gruppen geprüft und beibehalten. Kein nachgewiesener Produktfehler, daher kein UI-Refactoring. Den Testserver in der isolierten V0-Kopie passend zu Next.js `output: standalone` über `scripts/start-e2e.mjs` gestartet, einschließlich kopierter öffentlicher und Build-Assets; damit entfällt die Warnung zu `next start`. Berichte und Screenshots zusätzlich laufunabhängig gesichert; V0 von parallel entstandener Import-Arbeit für die Verifikation isoliert.

Der rote Nachweis betrifft die fehlende Browser-Testinfrastruktur. Es wird kein zuvor fehlgeschlagener fachlicher UI-Test behauptet. Die 112 vorhandenen Review-Tests bestanden bereits vor der Ergänzung.

## Testumfang und Infrastruktur

`tests/e2e/review-demo.spec.ts` bildet die 13 Schritte aus Abschnitt 5 des Handovers ab: Einstieg über `/`, Ausgangszustand, alle drei Degree-Validierungsfehler samt Fokus/ARIA-Zuordnung, explizite Auswahl, Short-Course-Platzierung erst nach Bestätigung, Reihenfolgeübernahme, offenes Abschlussjahr/Katalog/Referenz, Entwertung durch Verschieben, Detailwechsel, Reset und Reload.

Die gesamte Interaktion erfolgt mit Tab, Enter und Pfeiltasten. Ausführung in Chromium mit 1280 × 900 und 375 × 812; zusätzlich Prüfung auf horizontalen Seitenüberlauf. Keine Aussage über andere Browser oder vollständige Screenreader-Kompatibilität.

Die V0-Konfiguration startet einen eigenen lokalen Produktionsserver auf `127.0.0.1:3102`, verwendet keinen vorhandenen Server und setzt eine nicht erreichbare Test-Datenbankadresse. Schreibende Browser-Requests werden abgefangen, blockiert und lassen den Test fehlschlagen. Unbehandelte Browserfehler werden ebenfalls geprüft. Der Test erwartet in beiden Kategorien leere Listen. Das belegt den beobachteten Browserablauf, keine allgemeine Persistenzanalyse aller Serverpfade.

Zum V0-Paket gehören nur Playwright-Konfiguration/Journey, `test:e2e`, die fixierte Dependency mit Lockfile, passende Ignore-Einträge, CI-Browserinstallation/Testlauf/Artefaktupload und diese Dokumentation. Der CI-Upload bewahrt HTML-Bericht und `test-results/` 14 Tage auf. Remote-CI wurde nicht ausgelöst.

## Parallele Änderungen und reproduzierbare V0-Kopie

Während der Prüfung erschienen zusätzliche Dateien unter `src/lib/dev-import/`, `src/app/dev/`, `src/app/api/dev/` und `tests/e2e-import/` sowie Änderungen an gemeinsamen Konfigurationen. Unter anderem wurde `test:e2e` um einen Import-Test erweitert und der V0-Serverbefehl geändert. Diese Änderungen stammen nicht aus dieser V0-Arbeit und wurden nicht zurückgesetzt. Die Herkunft wurde beim Nutzer angefragt.

Ein Gesamtprüflauf im gemeinsamen Arbeitsverzeichnis scheiterte zu diesem Zeitpunkt: 809 Tests bestanden, aber zwei zusätzliche Import-Suites konnten noch fehlende Module nicht laden; der Typecheck meldete ebenfalls Import-Dateien. Diese Fehler wurden nicht durch Änderungen außerhalb V0 behoben. Logs: `11-unit.log`, `14-typecheck.log`.

Für einen belastbaren V0-Nachweis wurde `/tmp/alumni-v0-3531a40` aus dem genannten HEAD plus ausschließlich den V0-Dateien erstellt. Die Kopie besitzt eigene installierte Dependencies und enthält keine Import-Erweiterungen. Ihr schlanker Standalone-Testserver benötigt weder Import-Flags noch zusätzliche App-Konfiguration. Ein zunächst versuchter Build mit verlinktem `node_modules` scheiterte an Turbopacks Dateisystemgrenze (`22-isolated-build.log`); mit eigener Dependency-Kopie bestand der unveränderte Produktionsbuild.

Das separat bereitgestellte `artifacts/v0/v0-only.patch` beschreibt ausschließlich V0 gegenüber HEAD. Es ist zur Prüfung bzw. Anwendung auf einem sauberen Checkout dieses HEAD gedacht, **nicht** zum ungeprüften Anwenden auf das bereits geänderte gemeinsame Arbeitsverzeichnis.

## Ausgeführte Prüfungen

| Prüfung | Ergebnis / Log unter `artifacts/v0/logs/` |
| --- | --- |
| Review-Tests vor Ergänzung | 7 Dateien, 112 Tests bestanden; `02-baseline-review-tests.log` |
| V0-Browser-Journey im ursprünglichen Arbeitsstand | 2/2 bestanden; `04-browser-run.log` |
| Lint im gemeinsamen Arbeitsverzeichnis | bestanden; `10-lint.log` |
| Prisma-Validierung | bestanden; `12-db-validate.log` |
| PostgreSQL-17-Integration | 8 Dateien, 363 Tests bestanden; `13-integration.log`; nach Freigabe des Docker-Sockets, temporärer Container wieder entfernt |
| Unit-Tests in isolierter V0-Kopie | 19 Dateien, 792 Tests bestanden; `21-isolated-unit.log` |
| Produktionsbuild in isolierter V0-Kopie | bestanden; `23-isolated-build.log` |
| Lint in isolierter V0-Kopie | bestanden; `24-isolated-lint.log` |
| Typecheck in isolierter V0-Kopie | bestanden; `25-isolated-typecheck.log` |
| Browser-Journey in isolierter V0-Kopie | 2/2 bestanden; `26-isolated-browser.log` |

Der gemeinsame Branch wird wegen der parallelen Änderungen nicht pauschal als grün oder commit-ready bezeichnet.

## Selbst automatisiert ausführen

Auf einem sauberen Checkout mit dem V0-Paket oder in der bereitgestellten V0-Kopie:

```bash
nvm use
npm ci
npx playwright install chromium
npm run test:e2e
npx playwright show-report
```

In der bereits eingerichteten lokalen Kopie genügt nach `cd /tmp/alumni-v0-3531a40` und `nvm use` der Befehl `npm run test:e2e`. Port 3102 muss frei sein. Playwright startet und beendet seinen Server selbst. Auf Linux benötigt die Erstinstallation gegebenenfalls `npx playwright install --with-deps chromium`.

Im gemeinsam bearbeiteten Arbeitsverzeichnis ist `npm run test:e2e` inzwischen durch die parallele Import-Arbeit erweitert. Für ausschließlich V0 dort ausdrücklich `npx playwright test --config playwright.config.ts` gegen einen passenden frischen Build verwenden; für einen isolierten Nachweis die oben beschriebene V0-Kopie nutzen.

## Manuelle Abnahme im Browser

Für die bereitgestellte V0-Kopie mit bereits gebauter Anwendung:

```bash
cd /tmp/alumni-v0-3531a40
nvm use
HOSTNAME=127.0.0.1 PORT=3100 node scripts/start-e2e.mjs
```

Alternativ auf einem sauberen V0-Checkout: `nvm use`, `npm ci`, dann `npm run dev -- --hostname 127.0.0.1 --port 3100`.

1. `http://127.0.0.1:3100/` öffnen. Den Hinweis auf fiktive Daten prüfen, „Beispiel-Karriereweg ansehen“ wählen.
2. Auf `/review` Internship, M.Sc., Research Assistant und den separat stehenden Short Course prüfen.
3. Referenz „Noch nicht ausgewählt“, keine Entwurfsplätze, Reihenfolgeübernahme deaktiviert. Mit Screenshot `01-ausgangszustand` vergleichen.
4. M.Sc. „Prüfen“ öffnen. Ohne Auswahl anwenden: Fehlermeldung; Fokus auf „Art der Station“. Mit unvollständiger Auswahl entsprechend Abschlussart und Abschlussstatus prüfen.
5. „Akademischer Abschluss“, „Master“, „Abgeschlossen“ auswählen und anwenden. Erwartung: „Im Entwurf geprüft“, Reihenfolge noch offen; noch kein normalisierter Abschluss.
6. Short Course „Zeitlich einordnen“ öffnen. „Vor Synthetic M.Sc.“ auswählen. Allein diese Auswahl darf die Reihenfolge nicht verändern.
7. „In den Entwurf einordnen“ aktivieren. Erwartung: Internship → Short Course → M.Sc. → Research Assistant. `around 2018` bleibt ungenau.
8. Reihenfolge übernehmen. Plätze 1–4, M.Sc. „Teilweise normalisiert“, Abschlussjahr „Nicht angegeben“, Katalogzuordnung unbekannt, Referenz ungewählt. Mit `02-bestaetigter-entwurf` vergleichen.
9. M.Sc. nach oben verschieben: Plätze und normalisiertes Ergebnis entfallen, angewandte Degree-Auswahl bleibt bestehen. Reihenfolge erneut übernehmen; M.Sc. erhält Platz 2.
10. Zwischen Internship-Details und M.Sc.-Prüfung wechseln. Höchstens ein Detailbereich geöffnet; Master/Abgeschlossen bleiben erhalten.
11. „Entwurf zurücksetzen“: ursprüngliche Reihenfolge, Short Course separat, keine Plätze, Fokus auf „Zeitliche Übersicht“. Die erneut geöffneten Degree-Felder sind leer.
12. Nochmals Degree-Auswahl anwenden, dann Browser neu laden. Wieder ursprüngliche Demo mit „Nur Demo – nichts gespeichert“. Mit `03-nach-reload` vergleichen.
13. Den Ablauf auch bei 375 × 812 und per Tastatur durchführen: Tab/Shift+Tab, Enter, Pfeiltasten. Fehler müssen beschrieben und ihre Felder fokussiert werden; kein horizontaler Seitenüberlauf.

Abnahme offen lassen, bis diese sichtbaren Ergebnisse bestätigt sind. Anschließend Server mit Ctrl+C beenden. V1 oder weitere Inkremente sind nicht Bestandteil dieser Abnahme.

## Screenshots und Artefakte

- `artifacts/v0/screenshots/chromium-desktop/` und `chromium-narrow/`: jeweils `01-ausgangszustand.png`, `02-bestaetigter-entwurf.png`, `03-nach-reload.png` — sechs Vollseiten-Screenshots, visuell stichprobenartig geprüft.
- `artifacts/v0/browser-report/index.html`: gesicherter HTML-Bericht mit Schritten, Screenshot-Anhängen und JSON-Anhang `browser-evidence` (Viewport, schreibende Requests, Browserfehler).
- `artifacts/v0/logs/`: RED-Nachweise, Infrastrukturfehler und Prüfprotokolle; erfolgreiche und fehlgeschlagene Läufe bleiben unterscheidbar.
- `artifacts/v0/v0-only.patch`: prüfbarer V0-Patch gegenüber dem Ausgangs-HEAD.
- Reguläre neue Läufe schreiben `playwright-report/` und `test-results/`. Bei Browser-Testfehlern bleiben zusätzlich Screenshot, Trace und Video erhalten. Aus den erfolgreichen Läufen werden keine Fehler-Traces oder Videos behauptet.

Artefaktverzeichnisse sind absichtlich gitignored; der Patch und die Screenshots sind lokale Abnahmeartefakte. Kein Commit, Push, Merge oder Deployment wurde ausgeführt.
