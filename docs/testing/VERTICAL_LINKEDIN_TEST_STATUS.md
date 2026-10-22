# Vertikaler LinkedIn-Test – veröffentlichter Zwischenstand

## Umfang

Dieser Stand baut auf `feat/alumni-review-ui` bei `3531a4088220a036314afa5e50411514121bb5ef`
auf. Enthalten sind V0-Browsertests, der synthetische V1a-JSON-Pfad und die lokale
V1b-Third-Party-OAuth-Anbindung einschließlich sicherer Snapshot-Diagnose.
Die kanonische Domäne, bestehende Normalisierung und PostgreSQL-Migrationen
bleiben unverändert. Es gibt keine Profilpersistenz in diesem Inkrement.

Die Veröffentlichung wurde vom Nutzer ausdrücklich beauftragt. Frühere Hinweise
„kein Commit/Push“ in den einzelnen Abnahmeprotokollen beschreiben den damaligen
Arbeitsstand. Dieser Commit ist keine abgeschlossene Live-Abnahme.

## Tatsächlich geprüfte Ergebnisse

Die zuletzt lokal ausgeführten Prüfungen vor der Veröffentlichung:

| Prüfung | Ergebnis |
| --- | --- |
| `npm test` | 854 Tests in 26 Dateien erfolgreich |
| `npm run lint` | erfolgreich |
| `npm run typecheck` | erfolgreich |
| `CAREERMAP_DEV_IMPORT_TEST=1 npm run test:e2e` | Produktionsbuild und 40 Browserprüfungen erfolgreich |
| Browseraufteilung | 4 V0-/Produktionsprüfungen, 28 Importprüfungen, 8 OAuth-Prüfungen |

Der letzte Datenbank-Integrationslauf vor den reinen Browser-/Diagnosekorrekturen
umfasste 363 erfolgreiche Prüfungen gegen einen isolierten PostgreSQL-17-Container.
Er wurde anschließend entfernt. Diese Datenbankprüfungen wurden für die letzten
Status-/Header-/Diagnoseänderungen nicht wiederholt.

Die Tests verwenden ausschließlich synthetische Daten. Die vollständige
Browserprüfung umfasst Formularstart, simulierte externe Anmeldung, echten lokalen
Callback, simulierten serverseitigen Tokenaustausch, Cookie-Rotation, Rückleitung,
Reload, Snapshot-Projektion, JSON-Editor und vollständigen Fixture-Austausch.
Der Testserver überschreibt private App-Konfiguration; externe Provider-Fetches
werden simuliert beziehungsweise blockiert.

GitHub Actions führt zusätzlich zu den vorhandenen Checks alle drei Browsersuiten
aus und stellt HTML-Berichte und Fehlerartefakte als `browser-tests` bereit.
Ein erfolgreicher lokaler Lauf ist kein Nachweis einer erfolgreichen GitHub-CI;
deren Ergebnis ist am jeweiligen Commit zu prüfen.

## Offener Live-Befund

Der Nutzer konnte sich bei LinkedIn anmelden. Die Start- und Callback-
Rückleitungsfehler wurden reproduziert, korrigiert und synthetisch abgesichert.
Der echte Snapshot-Abruf liefert weiterhin 502; die konkrete Ursache ist offen.
Die frühere Sammelmeldung unterschied Format und Größe nicht zuverlässig.
Die neue Anzeige liefert ausschließlich eine feste Diagnosekennung mit Domäne,
Seite und gegebenenfalls HTTP-Status. Zur Eingrenzung wird nur diese Zeile benötigt.
Größenlimits wurden nicht angehoben. Es wurden keine echten JSON-Inhalte gelesen,
kopiert oder für automatisierte Tests verwendet.

## Lokal nachvollziehen

```sh
nvm use
npm ci
npx playwright install chromium
CAREERMAP_DEV_IMPORT_TEST=1 npm run test:e2e
```

Für die manuelle lokale Abnahme: private `.env.local` gemäß
[V1b-Abnahmeanleitung](V1B_LINKEDIN_OAUTH_ACCEPTANCE.md) einrichten,
`npm run dev:import` starten und `http://localhost:3100/dev/import` öffnen.
Echte Angaben bleiben temporär; nur die synthetische Fixture darf in die
Karriereansicht übernommen werden.

Weitere Abläufe und RED/GREEN-Nachweise:
[V0](V0_BROWSER_ACCEPTANCE.md), [V1a](V1A_JSON_IMPORT_ACCEPTANCE.md),
[V1b](V1B_LINKEDIN_OAUTH_ACCEPTANCE.md).
Private Konfiguration, `.local-fixtures/`, Build-Verzeichnisse, lokale Logs,
Screenshots und Testberichte gehören nicht zum Git-Commit. Lokale Nachweise liegen
unter `artifacts/v1b-snapshot-diagnostics/` und den zuvor dokumentierten
Inkrementverzeichnissen. Separate lokale Architektur-Dokumentation und
installierte Skill-Pakete werden durch diesen Commit nicht verändert.
