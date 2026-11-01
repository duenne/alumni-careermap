# D1.4c – Persistenter lokaler Demonstrator und Abnahmepunkt

Stand: 2026-11-01. Branch `feat/v5-survey-demonstrator`, HEAD
`c0d0cbbce9b58d7dc5d55a1f805efb47971c2786` vor und nach der Arbeit.
Kein Commit, Push, Merge oder Deployment.

## Abnahmezustand

Der echte Next.js-16.3.8-Produktionsbuild läuft mit Node 22.23.3 über
`npm start` auf **http://127.0.0.1:3114/admin/surveys**.

| Umfrage | Programm | Status | Antworten |
| --- | --- | --- | ---: |
| A: SYNTHETISCH / DEMO – Alumni MSI | Management Sozialer Innovationen | CLOSED | 100 |
| B: SYNTHETISCH / DEMO – Master Informatik | Master Informatik | DRAFT | 0 |

- A: `aa5104db-9218-422e-ba95-5dd969968a1b`
- B: `6a29857f-c569-4811-b51c-2d3128fa5268`
- Installation: `04fb49b1-4e3b-4fb0-807f-66837beae2f5`
- 100 Alumni, 172 Degrees, 260 CareerSteps, 432 Timeline-Einträge,
  100 ausgewählte Referenzabschlüsse und 100 gültige SurveyResponses.
- Quelle: freigegebener synthetischer Phase-D-Bestand, 195 EDUCATION und
  237 POSITION. Darunter 13 Berufsausbildungen und 10 Auslandssemester;
  keine ausgeschlossenen Profile, keine Validierungsfehler.
- Keine AlumniContact-Einträge; keine realen Einwilligungen, Kontakte oder Tokens.
- Das Master-Programm und B wurden über das authentifizierte Betreiber-UI
  angelegt. B wurde weder direkt per SQL noch durch den Seed erzeugt.

Anmeldung: Benutzer **operator**. Das getrennte Betreiberpasswort steht lokal in
`.local-demo/v5/runtime.json`, Schlüssel `CAREERMAP_SURVEY_ADMIN_TOKEN`.
Es wird hier nicht wiederholt. Die Anwendung und PostgreSQL bleiben für die
Abnahme gestartet. A nicht wieder öffnen und B nicht öffnen, wenn dieser
Abnahmezustand erhalten bleiben soll.

## Architektur und Schutzmechanismen

PostgreSQL 17 läuft in einem eigenen Compose-Projekt mit einem externen,
dauerhaften Docker-Volume. Compose veröffentlicht ausschließlich
`127.0.0.1:5435:5432`. Der installierte PostgreSQL-17-Image-Digest wird bei
Initialisierung festgeschrieben. Die App läuft auf dem Host, ebenfalls nur auf
`127.0.0.1`. Vorhandene Analytics-/Workflow-Container bleiben unverändert.

Installation und Volume besitzen eine zufällige Installationskennung und
übereinstimmende Labels. Der Controller prüft Docker-Unix-Socket, Image-ID,
Container-/Volume-Zuordnung, Portbindung, PostgreSQL-Hauptversion,
`current_database()`, `current_user`, Cluster-Systemkennung und Datenbank-OID.
Nach erstmaliger Bindung werden Cluster-/DB-Austausch und ein fehlendes Volume
abgelehnt. Ein verlorenes Volume wird bei einem späteren Start nicht still
neu angelegt. Docker Engine ab Version 28 ist erforderlich.

`careermap_v5_admin` besitzt das eigene administrative Passwort für Migration
und explizite Kataloginitialisierung. Nur diese Schritte nutzen diese Rolle.
`careermap_v5_demo` erhält CONNECT, Schema-USAGE und DML auf den zehn
Domain-Tabellen, keine DB-/Schema-Eigentümerschaft, kein Schema-CREATE und
keine administrativen Rollenattribute. Die tatsächliche Anwendungsverbindung
prüft zusätzlich die Installationsmarkierung der Hochschule, MSI-Katalog-ID
und Betreiberzuordnung vor jeder Nutzung. Die bisherige Mapping-Verbindung
und deren Zielschutz bleiben unverändert.

Die bisherigen Produktionssperren, Basic-Authentifizierung, Betreiber-Scope-
und Host-/Origin-Prüfungen bleiben wirksam. Import, OAuth/LinkedIn und
Teilnahme-Schreibwege werden nicht freigeschaltet. Die MSI-Projektion wird für
Master Informatik weiterhin ausdrücklich abgelehnt.

Private Dateien liegen unter `.local-demo/v5` (Verzeichnisse 0700,
Konfiguration/Secrets 0600). Fremde/veränderte Konfiguration wird nicht
überschrieben. Compose erhält eine eigene leere Env-Datei und ausschließlich
kontrollierte Variablen; das Adminpasswort wird als Datei eingebunden.
Build und Start erben keine DB-/OAuth-/öffentlichen Variablen oder
`NODE_OPTIONS`. Es gibt keinen Fallback auf `DATABASE_URL` oder `.env.local`.

Der Build entsteht in einem neuen, eigenen Verzeichnis unter
`.local-demo/v5/builds/<UUID>/app`. Nur freigegebene Anwendungsdateien werden
kopiert; keine Env-Dateien, Fixtures oder Installationsdaten. Ein Manifest
bindet Quellen und fertige BUILD_ID. Der normale Standalone-Betriebsweg bleibt
erhalten. ESLint und TypeScript schließen die lokalen Betriebsartefakte aus.

## Reproduzierbarer Betrieb

Voraussetzungen: Node **22.23.3**, installierte Projektabhängigkeiten gemäß
Lockfile, lokales Docker Engine >=28 mit Compose und lokal vorhandenem
`postgres:17-bookworm`-Image. Für Browser-Abnahme außerdem der von Playwright
verwendete Chromium. Ports 3114/5435 müssen frei sein. Kein fremder Dienst
wird automatisch beendet.

Für das erstmalige Seeding werden die beiden bereits auditierten Dateien
unter `.local-fixtures/phase-d` benötigt. Ihre Hashes sind fest in
`src/lib/demo-seed/source-policy.ts` freigegeben; andere Dateien werden
abgelehnt. Der Fixture-Bestand und die privaten Installationsdaten sind nicht
versioniert. Auf einem anderen Rechner müssen diese synthetischen Fixtures
und das freigegebene PostgreSQL-Image gesondert bereitgestellt werden.

Im Repository, mit Node 22 aktiv:

```sh
npm run demo:local -- init
npm run demo:local -- db-up
npm run demo:local -- migrate
npm run demo:local -- catalog-init
npm run demo:local -- seed --confirm-synthetic-references
npm run demo:local -- build
npm run demo:local -- start
```

`migrate` verwendet ausschließlich die fünf vorhandenen versionierten
Migrationen. `catalog-init` fügt die gebundene synthetische Hochschule und das
MSI-Programm ein oder prüft deren unveränderte Identität. Der explizite
Seed-Schalter bestätigt ausschließlich synthetische Testreferenzen.

Im Browser als operator anmelden, im Betreiber-UI den Studiengang
**Master Informatik** ergänzen und die Befragung
**SYNTHETISCH / DEMO – Master Informatik** als Entwurf anlegen. Danach ihre ID
für die Abnahme festhalten:

```sh
npm run demo:local -- record-b --survey-id <ID-aus-dem-UI>
npm run demo:local -- verify
```

Alternativ führt der ausdrücklich aufgerufene Abnahmelauf diesen UI-Schritt
einmalig aus und prüft anschließend den Betrieb:

```sh
node --import tsx scripts/local-demo-acceptance.mjs
```

Dieser Lauf startet eigene App/DB mehrfach neu und erzeugt B nur, wenn noch
keine B registriert ist und eindeutig nur A existiert. Bei unterbrochener
UI-Anlage wird ein vorhandener, nicht registrierter Entwurf nicht dupliziert:
zuerst im UI prüfen, dann mit `record-b` zuordnen. Genau dies war nach dem
ersten unterbrochenen Browser-Harness-Lauf nötig; der vorhandene Entwurf wurde
lesend geprüft und unverändert registriert.

Wiederholtes Seeding ist explizit und idempotent:

```sh
npm run demo:local -- seed --confirm-synthetic-references
npm run demo:local -- verify
```

Ordnungsgemäß beenden und später starten:

```sh
npm run demo:local -- stop
npm run demo:local -- db-stop
npm run demo:local -- db-up
npm run demo:local -- start
npm run demo:local -- verify
```

Start/Neustart migrieren und seeden **nicht**. PostgreSQL-Neustart ist mit
`db-restart` möglich. `db-recreate` ersetzt ausschließlich den eigenen
gestoppten Container unter Erhalt desselben externen Volumes. Kein normaler
Betriebsschritt löscht Volumes. Nach Codeänderungen: `stop`, `build`, `start`.
Ältere Build-Verzeichnisse werden nicht automatisch gelöscht.

## Tatsächlich ausgeführtes RED → GREEN

1. Installationstests zuerst gegen noch nicht implementierte Funktionen:
   **5 fehlgeschlagen, 1 bestanden**, Fehler `D1.4c_NOT_IMPLEMENTED`.
   Log `/tmp/d14c-red.log`.
2. Persistenter Build-Pfad zuerst gegen bisherigen Build-Schutz:
   **1 fehlgeschlagen, 4 bestanden**, `INVALID_LOCAL_DEMO_WORKSPACE`.
   Log `/tmp/d14c-red-persistent-build.log`.
3. Antwortzähler zuerst gegen echte isolierte PG17-Datenbank:
   **1 fehlgeschlagen, 3 bestanden**, `_count.responses` noch nicht vorhanden.
   Log `/tmp/d14c-red-count.log`. Danach **4/4 bestanden**,
   `/tmp/d14c-pg.log`.
4. Reale Abnahme legte einen Shutdown-Timeout offen. Die Weiterleitung eines
   Signals an die ganze npm-Prozessgruppe wurde durch Weiterleitung an npm
   ersetzt; npm und der vorhandene Start-Wrapper reichen Signale gezielt
   weiter. Der anschließende vollständige Stop-/Startlauf bestand mehrfach.
   Ein angefragtes Beenden des zuvor hängenden Prozesses musste nicht mehr
   ausgeführt werden: Der Prozess war bereits beendet.
5. Nach Erzeugung der lokalen Build-Artefakte zeigte Lint deren versehentliche
   Einbeziehung (321 Fehler in generierten Dateien). Gezielter Ausschluss
   von `.local-demo` ergänzt; finaler Lint-Lauf fehlerfrei.

Finale Nachweise:

| Prüfung | Ergebnis | Log/Artefakt |
| --- | --- | --- |
| Unit-Tests mit synthetischem Phase-D-Corpus | 1106 bestanden, keine ausgelassen | `/tmp/d14c-unit-corpus.log` |
| Domain-Integrationen mit Phase-D-Corpus | 377 bestanden, keine ausgelassen | `/tmp/d14c-integration-corpus.log` |
| Dedizierte Demo-PG17-Sicherheitstests | 4 bestanden | `/tmp/d14c-pg.log` |
| Seed-Transaktionen inkl. 100er-Corpus/Rollback | 27 bestanden, keine ausgelassen | `/tmp/d14c-seed-regression-corpus.log` |
| Lint | bestanden | `/tmp/d14c-lint.log` |
| Typecheck | bestanden | `/tmp/d14c-typecheck.log` |
| Prisma-Schemavalidierung | bestanden | `/tmp/d14c-schema.log` |
| Regulärer isolierter Produktionsbuild | bestanden | `/tmp/d14c-build.log` |
| Browser/Neustarts/negative Starts | PASS | `artifacts/v5/acceptance.json` |

Der ursprüngliche Standardlauf hatte 1104 bestandene und zwei ausgelassene
Unit-Tests sowie 376 bestandene und einen ausgelassenen Integrationstest.
Die ausgelassenen Corpus-Tests wurden anschließend explizit mit
`CAREERMAP_PHASE_D_FIXTURES=1` ausgeführt. Die Seed-Regressionen bestanden
zunächst mit 25 Tests und zwei ausgelassenen Corpus-Fällen; der anschließende
explizite `npm run test:demo-seed -- --corpus`-Lauf bestand mit allen 27 Tests,
einschließlich vollständigem Rollback beim Fehler an der letzten Antwort.
Es wurden keine nicht ausgeführten
E2E-Suiten als bestanden gewertet.

## Reale Browser-, Sicherheits- und Persistenznachweise

`scripts/local-demo-acceptance.mjs` hat geprüft:

- Sechs ungültige Startkonfigurationen und öffentliche Bindung scheitern
  vor dem Start von Next.js.
- 21 Browser-Builddateien enthalten weder Installationspasswörter noch die
  absichtlich geerbte Canary `DO_NOT_COPY_D14C_20261101`; keine Env-Datei
  befindet sich im Build-Arbeitsverzeichnis.
- Ohne/falsches Passwort: 401 für Betreiberzugriff; fremde Host-/Origin- und
  Forwarded-Header: 404.
- Import-, LinkedIn- und Teilnahme-POSTs bleiben 404.
- Öffentlicher Link von A zeigt den Schließungshinweis; B ist öffentlich 404.
- Betreiber-UI zeigt A CLOSED/100 und B DRAFT/0; A-Auswertung zeigt 100
  bestätigte Antworten; Master-Projektion bleibt gesperrt.
- Wiederholter Seed ergibt `UNCHANGED`.
- Serverneustart, PostgreSQL-Neustart, Container-Neuerzeugung am gleichen
  Volume sowie vollständiges Stoppen/Starten behalten identische Daten.
- Bei gestoppter Datenbank liefert der tatsächliche App-Healthcheck **503**
  ohne Secrets; nach DB-Start sind Zugriff und Daten unverändert verfügbar.
- `lsof` bestätigt `TCP 127.0.0.1:3114 (LISTEN)`, Docker bestätigt
  `127.0.0.1:5435->5432/tcp`.

Der Hash umfasst die sortierten Inhalte der Domain-Tabellen einschließlich
IDs/Zeitstempeln und des gesamten Katalogs; Kontakte müssen leer sein:

```text
abbb3b0423d12bf3e673ffc062be235bfaee0d15ce11a86e2aa02281939e5b8e
```

Er ist in allen sieben finalen Prüfpunkten identisch. Clusterkennung
`7703291643856609318`, DB-OID `16384` und Volume
`careermap_v5_04fb49b14e3b4fb0807f66837beae2f5_pg17` bleiben ebenfalls erhalten.
Die früheren Hashes ohne Organisationstabelle sind nicht der finale Nachweis.

Screenshots: `artifacts/v5/operator-surveys.png` und
`artifacts/v5/survey-a-analytics.png`. Screenshots und Abnahmereceipt enthalten keine Zugangsdaten. Die privaten
Betriebsdateien enthalten Zugangsdaten und bleiben ausschließlich lokal; sowohl
sie als auch die Abnahmeartefakte sind git-ignoriert.

## Dateien dieses Schritts und Abgrenzung

Neu:

- `compose.v5-demo.yaml`
- `scripts/local-demo.mjs`
- `scripts/local-demo-acceptance.mjs`
- `src/lib/local-demo/installation.ts`
- `src/lib/local-demo/installation.test.ts`
- `src/lib/local-demo/operations.ts`
- `src/lib/local-demo/connection-identity.ts` (bestehende Identitätsprüfung
  unverändert in ein gemeinsam nutzbares Modul extrahiert)
- dieser Bericht

Ergänzt:

- `package.json` – `demo:local`
- `scripts/local-demo-start.mjs` – gezielte Signalweiterleitung
- `src/lib/local-demo/database.ts` – gemeinsame Identitätsprüfung verwenden
- `src/lib/local-demo/build-workspace.ts` und zugehöriger Test – eigener
  persistenter Build-Slot
- `src/lib/surveys/service.ts` und
  `src/app/admin/surveys/survey-manager.tsx` – geschützter Antwortzähler
- `tests/local-demo/database.test.ts` – realer Antwortzählernachweis
- `eslint.config.mjs`, `tsconfig.json` – Betriebsartefakte ausschließen

Der Working Tree war bereits vor D1.4c umfangreich durch D1.1/D1.2/D1.4b und
Nutzerdateien verändert. Diese Änderungen wurden erhalten. Keine bestehende
`.env.local`, andere Nutzerkonfiguration oder fremde Docker-Ressource wurde
überschrieben. Es gibt keine Schemaänderung oder neue Migration.

## Verbleibende Grenzen und Risiken

Dies ist eine lokale synthetische Installation, kein produktives Hosting.
Die Abnahme erfolgte auf diesem macOS-/Docker-Rechner; ein kompletter
Host-Neustart, Stromausfall, Volume-Verlust und Backup/Restore wurden nicht
simuliert. Der Node-Server startet nach einem Host-Neustart nicht automatisch;
der dokumentierte explizite Start ist erforderlich.

Persistenz ersetzt kein Backup. Private Installationskonfiguration und Volume
gehören zusammen; Verlust/Manipulation führt absichtlich zum Abbruch statt zu
einer Neuinitialisierung. Das PostgreSQL-Image wird pro Installation fixiert;
Updates benötigen einen separat geprüften Ablauf. Die Betriebsskripte besitzen
keinen automatischen Update-/Recovery-/Backupcontroller.

Die existierende pg-Warnung zu parallelen Queries in Transaktionen erscheint
auch bei bisherigen Tests; mit der installierten pg-8-Version bestehen die
Prüfungen. Eine Treiberaktualisierung ist nicht Teil dieses Schritts.
Es gibt keine Teilnahme-Schreibfreigabe, Master-Sankey-Projektion, LinkedIn-
Aktion, E-Mail-Aktion oder persönliche Archivfunktion.

**D1.4c endet an diesem Abnahmepunkt. Weitere Funktions- oder Betriebsänderungen
erfordern einen neuen Auftrag.**
