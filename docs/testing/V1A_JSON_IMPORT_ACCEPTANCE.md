# V1a – Lokaler synthetischer JSON-Import

**V1b-Nachtrag:** Die ursprünglichen V1a-Nachweise bleiben historische Nachweise.
Mit der LinkedIn-Anbindung ist die Übergabe eigener oder bearbeiteter JSON-Eingaben
an die Karriereansicht gesperrt; auch in den Schritten 7–8 bleibt es bei JSON-Prüfung
und Zählung. Nur eine frisch vom Server geladene synthetische Fixture darf in die
Timeline. Live-Test und aktuelle Prüfungen: [V1B_LINKEDIN_OAUTH_ACCEPTANCE.md](V1B_LINKEDIN_OAUTH_ACCEPTANCE.md).

Status: testbare Abnahmeversion, manuelle Nutzerabnahme offen. Kein Commit, Push,
Merge oder Deployment. V1a speichert weder Profile noch Browserentwürfe und
implementiert keine LinkedIn-OAuth-Anbindung.

## Ausgangsstand und Abgrenzung

Branch: `feat/alumni-review-ui`, HEAD unverändert
`3531a4088220a036314afa5e50411514121bb5ef`.

Beim Start dieses Auftrags war `/dev/import` bereits als unversionierter Entwurf
vorhanden. Dazu gehörten Editor, Styles, Parser, Fixture-Handler, Zugriffsguard,
Importtests, Import-Testkonfiguration und erste Skript-/CI-Anpassungen. Diese
Vorarbeiten wurden vervollständigt, nicht verworfen. Die gesicherten V0-/V1a-
Dateien und der damalige getrackte Diff liegen lokal unter
`artifacts/v1a/start-of-current-task/`. TypeScript-Sicherungen tragen zusätzlich
die Endung `.snapshot`, damit der Typecheck sie nicht als Projektquellen behandelt.

V0 war laut vorhandenen Protokollen technisch geprüft. Eine ausdrückliche
manuelle Abnahme ist weder in der Unterhaltung noch in der Dokumentation belegt.
Offen bleiben die manuellen Schritte 1–12 in
[V0_REVIEW_DEMO_ACCEPTANCE.md](V0_REVIEW_DEMO_ACCEPTANCE.md), insbesondere
Tastaturbedienung, Platzierung, Bestätigung, Verschieben, Reset und Reload bei
Desktop- und schmalem Viewport. V1a ist durch den aktuellen Auftrag unabhängig
davon zur Implementierung freigegeben; dies erklärt V0 nicht nachträglich für
abgenommen.

### Zuordnung der vorhandenen Änderungen

| Bereich | Dateien / Änderungen |
| --- | --- |
| V0-Vorarbeit | `tests/e2e/review-demo.spec.ts`, grundlegende `playwright.config.ts`, `scripts/start-e2e.mjs`, Playwright-Abhängigkeit/Lockfile, ursprüngliche CI-Browserintegration und V0-Dokumentation |
| V1a | `src/app/dev/import/`, `src/app/api/dev/import/fixture/`, `src/lib/dev-import/`, `tests/e2e-import/`, `playwright.import.config.ts`, Import-Buildverzeichnis in `next.config.ts`, vorhandene Opt-in-Erklärung in `.env.example` |
| V1a-Ergänzungen dieses Auftrags | Fixture-Auswahl und vollständiger Austausch, Batch-Normalisierung, zusätzliche Akzeptanzfälle und Erweiterung von `tests/e2e/dev-import-disabled.spec.ts`, `dev:import`, gemeinsamer E2E-Befehl, CI-Artefaktname, dieses Dokument |
| Gemeinsam genutzt | `package.json`, Workflow und Testkonfiguration; Änderungen für spätere getrennte Commits anhand der Sicherung prüfen, keine pauschale Übernahme aller Arbeitsbaumänderungen |
| Unabhängige Vorarbeiten | Agenten-/Skill-Dateien, `src/lib/career-review/` und generierte Typdateien; kein fachlicher Umbau durch V1a |

## Start und URL

Mit installierten Projektabhängigkeiten und der Node-Version aus `.nvmrc`:

```sh
nvm use
npm run dev:import
```

URL: [http://127.0.0.1:3100/dev/import](http://127.0.0.1:3100/dev/import).
Port 3100 muss frei sein. Das Skript bindet ausdrücklich an `127.0.0.1` und setzt
den serverseitigen Entwicklungs-Opt-in `CAREERMAP_DEV_IMPORT=1`. Die Seite
benötigt keine Datenbank und fragt `/api/health` nicht ab.

Die Seite und der Fixture-GET-Handler prüfen serverseitig Entwicklungsmodus,
Opt-in, lokalen Host sowie Origin-/Forwarding-Angaben. Ohne Opt-in oder im
Produktionsmodus gibt es keinen Importzugang. Der Entwicklungsserver darf nicht
über einen öffentlichen Proxy oder Tunnel bereitgestellt werden; die unterstützte
Betriebsart ist die Loopback-Bindung des obigen Skripts. Header oder eine
Fixture-ID sind keine Teilnehmerauthentifizierung.

## Verfügbare Fixture

Eine vorhandene Snapshot-Fixture: **Fiktiver LinkedIn-Snapshot**, ID
`fictional-member`, aus
`src/test-fixtures/linkedin-snapshots/fictional-member.json`.

Sie enthält zwei Ausbildungsangaben (M.Sc., Short Course) und zwei Berufsangaben
(Research Assistant, Internship), überlappende Zeiträume, ein ungenaues Datum und
fehlende Endangaben. Der Server liefert nur erlaubte Karrierefelder;
`PROFILE.snapshotData` wird zu `[{}]`. Die kanonischen D.2-Fälle sind kein zweites
Snapshotformat und werden nicht künstlich in eine neue Fixture-Bibliothek kopiert.

## Manueller Akzeptanztest

1. Seite öffnen. Erwartung: leerer JSON-Editor, keine Karriereansicht, Live-Abruf
   und LinkedIn-Verbindung deaktiviert. Die Seite erklärt den temporären Charakter.
2. Im Feld **Synthetischer Datensatz** den vorhandenen Snapshot wählen und
   **Synthetische Testdaten verwenden** anklicken. Erwartung: formatiertes,
   editierbares JSON und **2 Ausbildungsangaben · 2 Berufsangaben**.
3. **In Karriereansicht übernehmen** anklicken. Erwartung: vier Stationen in der
   vorhandenen Timeline, Short Course zunächst zeitlich ungeklärt. Referenz bleibt
   **Noch nicht ausgewählt**; Reihenfolge ist noch nicht bestätigt.
4. **Prüfen: Synthetic M.Sc.** öffnen. Akademischer Abschluss, Master,
   Abgeschlossen wählen und ausdrücklich anwenden. Erwartung: **Im Entwurf geprüft**,
   noch kein normalisierter Abschluss ohne Reihenfolge.
5. Short Course vor M.Sc. platzieren und Reihenfolge übernehmen. Erwartung:
   Entwurfsplätze 1–4 und teilweise normalisierter Master; kein erfundenes
   Abschlussjahr und keine bestätigte Katalogzuordnung.
6. Erneut **Synthetische Testdaten verwenden** anklicken. Erwartung: kompletter
   Editorinhalt ersetzt, alte Karriereansicht entfernt. Nach erneuter Übernahme
   sind Auswahlfelder leer, Reihenfolge unbestätigt und der Short Course wieder
   separat. Auch derselbe Snapshot beginnt einen neuen Entwurf.
7. Im JSON den Titel `Synthetic Research Assistant` durch
   `Synthetic Edited Role` ersetzen. Erwartung schon während des Editierens:
   alte Ansicht verschwindet und die Übernahme ist bis zur Prüfung gesperrt.
8. **JSON prüfen**, danach **In Karriereansicht übernehmen**. Erwartung: die
   neue Tätigkeitsbezeichnung erscheint, die alte nicht. Die feste Degree-Prüfung
   des Beispiels wird eigenen Eingaben nicht automatisch zugeordnet. Details,
   Platzierung und Reihenfolge verwenden weiterhin die aktive Quelle.
9. JSON-Syntax beschädigen, etwa die letzte schließende Klammer entfernen.
   **JSON prüfen** zeigt eine verständliche Fehlermeldung und fokussiert den
   Editor; keine alte Ansicht bleibt als vermeintlich gültiges Ergebnis stehen.
10. Mit **Synthetische Testdaten verwenden** ersetzen. Erwartung: fehlerhafte
    Eingabe und eigene Änderungen vollständig entfernt. Kein Zusammenführen.
11. Seite neu laden oder **Vorschau leeren** wählen. Erwartung: leerer Editor,
    keine Stationen, keine Bestätigung. Es gibt keine gespeicherte Datenspende.
12. Bei 375 Pixel Breite wiederholen. Formular und Timeline müssen bedienbar
    bleiben. Im Netzwerk erscheinen keine Profil-Schreibrequests; eigener
    JSON-Editorinhalt wird nicht hochgeladen. Local-/Session-Storage bleiben leer.

Alle manuellen und automatisierten Beispiele verwenden ausschließlich synthetische
Daten. Keine echten Profile in Screenshots, Logs oder Testdateien aufnehmen.

## Datenfluss und Herkunftsgrenze

`JSON → vorhandener LinkedIn-Adapter → Allowlist-Projektion → vorhandener Adapter
→ normalizeCareerBatch → bestehende CareerTimeline`.

Die erneute Adapterprüfung nach der Projektion sichert deren Vertrag. Es gibt
keinen zweiten Normalisierer. Ungeprüfte Beobachtungen bleiben REVIEW_REQUIRED;
Datumsende bedeutet keinen Abschluss, EDUCATION bedeutet noch keinen Degree.
Die bestehende Review führt spätere explizite Entscheidungen durch die unveränderte
Assertion-/Normalisierungspipeline.

Jede Editierung entfernt Validierung, Fixture-Zuordnung, Review-Ziel und sichtbare
Timeline. Ein Fixture-Austausch leert den kompletten Entwurf schon vor dem Abruf.
Verspätete Abrufantworten dürfen neuere Eingaben nicht überschreiben. Source Keys
sind weiterhin nur lokale Adapterkorrelationen; kein alter Komponentenstatus wird
auf eine ausgetauschte Quelle übertragen.

Die Anzeige **Synthetische Testdaten** ist reine lokale Darstellung. Es existiert
kein Speicherendpunkt. Eine spätere Speicherung darf weder dieser Anzeige noch
einer clientseitigen Fixture-ID vertrauen; sie benötigt einen separat geprüften
serverseitigen Herkunfts-/Vorgangskontext. Keine Provider-ID, Rohprofile oder Tokens
werden im kanonischen Modell ergänzt.

## Automatisierte Ausführung

```sh
nvm use
npm run test:e2e
```

Der Standardbefehl baut die Produktion, prüft V0 und die Produktionssperre, danach
den Entwicklungsimport. Ein erfolgreicher Standardlauf enthält somit die
Importtests. Die CI führt dieselben Suites nach einem gemeinsamen Build aus.

Nur den Import prüfen:

```sh
npm run test:e2e:import
```

Die Importtests starten ihren eigenen lokalen Entwicklungsserver auf Port 3103
mit separatem `.next-import-test`-Verzeichnis und unbrauchbarer lokaler DB-Adresse.
Die Produktionssuite verwendet Port 3102. Vorhandene Server werden nicht
wiederverwendet. `npx playwright test` allein prüft bewusst nur die
Produktionssuite; für die Gesamtabnahme den npm-Gesamtbefehl verwenden.

Erfolgreiche Pipeline-Tests laufen ohne Adapter-/Normalisierungs-Mocks. Zwei
zusätzliche Tests simulieren ausschließlich einen Transportfehler beziehungsweise
verzögern eine echte Fixture-Antwort. HTTP-Tests prüfen den echten Entwicklungs-
Handler und unzulässige Anfragen. Die Produktionssuite prüft Seite und API mit
absichtlich gesetztem Opt-in auf HTTP 404.

## TDD und Nachweise

- Vorprüfung: 130 relevante Tests erfolgreich.
- RED: neue Browserakzeptanz für den noch fehlenden Fixture-Selector schlug fehl;
  Protokoll `artifacts/v1a/current-red.log`. Der Unit-Test für das echte
  Batch-Normalisierungsergebnis schlug ebenfalls fehl (1 fehlgeschlagen,
  14 bestanden), `current-unit-red.log`.
- GREEN: vorhandenen Editor gezielt ergänzt; fokussierte Unit-Tests und zehn
  Import-Browserprüfungen erfolgreich. Keine Änderung an der ursprünglichen
  V0-Demo oder den Phase-E-Funktionen.
- REFACTOR: aktive Session enthält das vom Server für die aktuelle Fixture
  gelieferte Review-Ziel; kein blind fest verdrahteter Schlüssel für eigenes JSON.
  Gemeinsame Browserausführung verwendet die vorhandenen beiden Konfigurationen.

Die Remote-CI und manuelle Abnahme sind ohne späteren Push beziehungsweise
Nutzerprüfung nicht als ausgeführt anzusehen.

### Tatsächlich ausgeführte Prüfungen

Node.js 22.23.3; lokale Chromium-Prüfung unter macOS. Firefox, WebKit, echte
Mobilgeräte und Linux-Remote-CI sind nicht als ausgeführt ausgewiesen.

| Prüfung | Ergebnis | Protokoll unter `artifacts/v1a/` |
| --- | --- | --- |
| Vorprüfung Review/Import | 130 Tests erfolgreich | Terminalausgabe |
| RED Import-Unit | 1 fehlgeschlagen, 14 bestanden | `current-unit-red.log` |
| RED Browser | Fehlende Fixture-Auswahl reproduziert | `current-red.log` |
| `npm run lint` | erfolgreich, auch nach dem Runtime-Nachtrag | `runtime-lint.log` |
| `npm test` | 824 Tests in 22 Dateien erfolgreich | `runtime-unit.log` |
| `npm run db:validate` | erfolgreich | `current-db-validate.log` |
| `npm run test:integration` | 363 Tests in 8 Dateien erfolgreich; isolierter PostgreSQL-17-Container anschließend entfernt | `current-integration.log` |
| `npm run typecheck` | erfolgreich, auch nach dem Runtime-Nachtrag | `runtime-typecheck.log` |
| `npm run test:e2e` inklusive Produktionsbuild | erfolgreich: 2 V0-Journeys, 2 Produktionssperrprüfungen und 12 Importtests | `runtime-full-e2e.log` |
| `git diff --check` | erfolgreich | Terminalausgabe |

Server-Binding und Docker waren zunächst durch die Sandbox blockiert; die Tests
liefen danach mit freigegebenem Zugriff. Der erste Typecheck fand zu breit erfasste
Sicherungsdateien sowie zu eng inferierte Test-Header-Typen. Die Sicherungen wurden
erhalten und als `.snapshot` aus den TypeScript-Quellen genommen; die Testfälle
erhielten explizite Header-Typen. Der anschließende Typecheck war erfolgreich.

### Screenshots

Die vier PNGs wurden aus dem erfolgreichen Lauf kopiert und visuell geprüft.
Sie enthalten ausschließlich die synthetische Repository-Fixture.

| Zustand | Desktop | Schmal |
| --- | --- | --- |
| Aktive Karriereansicht | [PNG](../../artifacts/v1a/screenshots/desktop/synthetische-karriereansicht.png) | [PNG](../../artifacts/v1a/screenshots/narrow/synthetische-karriereansicht.png) |
| Geprüfter Entwurf | [PNG](../../artifacts/v1a/screenshots/desktop/synthetischer-review-entwurf.png) | [PNG](../../artifacts/v1a/screenshots/narrow/synthetischer-review-entwurf.png) |

Der Produktionsbericht liegt unter `playwright-report/index.html`, der
Importbericht unter `playwright-report/v1a/index.html`. Bei Fehlern werden
Screenshot, Trace und Video angelegt. Artefakte sind ignorierte lokale
Abnahmenachweise; es wurden keine echten Profildaten verwendet.

### Dateiliste dieses Auftrags gegenüber der gesicherten Vorarbeit

- `src/app/dev/import/import-editor.tsx`
- `src/app/dev/import/page.tsx` (Runtime-Nachtrag)
- `src/app/dev/import/import.module.css`
- `src/lib/dev-import/json-preview.ts`
- `src/lib/dev-import/json-preview.test.ts`
- `src/lib/dev-import/fixture-route.test.ts`
- `tests/e2e-import/json-import.spec.ts`
- `tests/e2e/dev-import-disabled.spec.ts`
- `package.json`
- `.github/workflows/ci.yml`
- `src/proxy.ts` (Runtime-Nachtrag, neu)
- `docs/testing/V1A_JSON_IMPORT_ACCEPTANCE.md` (neu)

Maschinenlesbare Liste: `artifacts/v1a/current-task-changes.json`. Die schon
vorhandenen API-/Guard-Dateien und Konfigurationen gehören zum gesamten
V1a-Arbeitsstand und wurden erhalten. Die Seite wurde im Runtime-Nachtrag angepasst. Insbesondere
sind V0-Journey, Schema, Migrationen und die Phase-E-Implementierung unverändert.

## Runtime-Nachtrag: negative Performance-Zeitstempel

Der gemeldete Stack in `flushComponentPerformance` entspricht einem
[bekannten React-/Next-Entwicklungsfehler](https://github.com/react/react/issues/37561)
bei abgebrochenen oder fehlerhaften Flight-Komponenten. Die installierte
Next-Version 16.3.8 enthält die betroffenen ungeschützten Messpfade. Der konkrete
sporadische Performance-Fehler war im ersten lokalen Diagnose-Lauf nicht
reproduzierbar; deshalb wird dieser Lauf nicht als Fehlerreproduktion ausgegeben.

Die lokale Entwicklungssperre antwortet nun in `src/proxy.ts`, ausschließlich für
`/dev/import/:path*` und `/api/dev/import/:path*`, bevor React gerendert wird.
`ImportPage` ist synchron und ruft weder `headers()` noch `notFound()` auf. Die
API behält zusätzlich ihren eigenen Guard. Unzulässige Anfragen erhalten direkt
HTTP 404 als ungecachte Textantwort, ohne React-Fehler-/Hydrationspfad. Es wurden
keine Performance-APIs überschrieben, Fehler unterdrückt oder Abhängigkeiten
aktualisiert.

TDD: Der neue Browsertest für die Ablehnung vor dem Rendering schlug zunächst in
beiden Viewports fehl (`runtime-guard-red.log`: HTML statt direkter Textantwort).
Nach der Korrektur bestehen Ablehnung, anschließender erlaubter Reload und der
vollständige Importablauf ohne unbehandelte Browserfehler. Der Gesamtlauf enthält
jetzt 16 erfolgreiche Browserprüfungen. Dieser Test belegt die Vermeidung des
auslösbaren Renderpfads, nicht die Reparatur des Upstream-Frameworks insgesamt.

Nach Übernahme des Nachtrags den vorhandenen Entwicklungsserver beenden und mit
`npm run dev:import` neu starten; anschließend `/dev/import` neu laden. Ein Start
ohne Opt-in gibt weiterhin absichtlich keinen Importzugang frei.

## Offene Abnahme und Grenzen

V1a ist technisch geprüft; die manuelle Nutzerabnahme ist offen. Dasselbe gilt
weiterhin für die manuelle V0-Abnahme. Der gespeicherte Auditvergleich aus V0 mit
9 hohen und 2 mittleren Paketbefunden wurde nicht durch neue Paketinstallationen
verändert und in V1a nicht neu abgefragt.

Die feste Degree-Prüfung ist nur für die unveränderte serverseitige Fixture
freigeschaltet. Eigene JSON-Eingaben verwenden ihre eigenen Stationen für Details
und zeitliche Einordnung; eine allgemeine Klassifikations-/Korrekturoberfläche,
Referenzbestätigung und Speicherung sind spätere Inkremente. Das ist keine
vollständige Datenspende und kein Nachweis einer realen Providerfreigabe.

## Kleinster nächster Schritt zur echten LinkedIn-Anbindung

Providerfreigabe für Member Data Portability API (3rd Party) und zulässige Scopes
bestätigen; dann den offiziellen paginierten Responsevertrag mit kontrollierten
HTTP-Vertragstests an dieselbe Pipeline anbinden. Der übergebene Altcode ist
Referenzmaterial, kein Bestandteil von V1a. Vor einer späteren Wiederverwendung
sind insbesondere Pagination, einheitliche Mockgrenzen, Endpointvertrag und
Token-/Fehlerlogging zu prüfen. Keine Secrets im Chat übermitteln.
