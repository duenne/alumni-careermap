# D1.4b – Begrenzter lokaler V5-Produktionsmodus

Stand: 1. November 2026. D1.4b implementiert; D1.4c nicht begonnen.

## Geprüfter Arbeitsstand

Branch vor/nach der Arbeit: `feat/v5-survey-demonstrator`.
HEAD unverändert: `c0d0cbbce9b58d7dc5d55a1f805efb47971c2786`.

Beim Start waren `package.json` und `src/lib/survey-service.ts` bereits durch
D1.2 verändert; D1.1-/D1.2-Code, Berichte und Testkonfigurationen waren
unversioniert vorhanden. Diese Arbeiten wurden erhalten. Insbesondere wurde
`src/lib/survey-service.ts` in D1.4b nicht erneut geändert. Vorhandene
Nutzerdateien, `.agents/`, `.claude/`, `.windsurf/`, `skills-lock.json`,
`--no-reasoning`, lokale Requirements/Handover und private `.env`-Dateien wurden
nicht überschrieben. Keine Commits, Pushes oder Merges.

Gelesene Grundlagen: AGENTS, normatives MVP Domain Model, V5-Handover,
D1.2-Bericht, tatsächlicher D1.1-/D1.2-Code, vorhandene Zugriffskontrollen,
Clients, Startskripte, Tests und Compose-Dateien. Für die Umsetzung wurden der
Prisma-Client-Skill und die installierten Next.js-Dokumente zu Konfiguration,
Phasen, Ausgabeformat und Umgebungsvariablen verwendet.

## Dateiänderungen dieser Etappe

Neue Produktmodule:

- `src/lib/local-demo/config.ts`
- `src/lib/local-demo/request.ts`
- `src/lib/local-demo/database.ts`
- `src/lib/local-demo/build-workspace.ts`
- `src/lib/surveys/client.ts`

Neue kleine Build-/Startbausteine, ohne Installationscontroller:

- `scripts/local-demo-build.mjs`
- `scripts/local-demo-start.mjs`
- `scripts/start-next.mjs`
- `scripts/check-local-demo-start.mjs`

Neue Tests und Dokumentation:

- `src/lib/local-demo/config.test.ts`
- `src/lib/local-demo/access.test.ts`
- `src/lib/local-demo/database.test.ts`
- `src/lib/local-demo/client-health.test.ts`
- `src/lib/local-demo/routes.test.ts`
- `src/lib/local-demo/build-workspace.test.ts`
- `src/lib/local-demo/build-profile.test.ts`
- `src/lib/local-demo/start-gate.test.ts`
- `tests/support/local-demo.ts`
- `tests/local-demo/database.test.ts`
- `scripts/test-local-demo.mjs`
- `vitest.local-demo.config.ts`
- `docs/testing/V5_LOCAL_DEMO_CONFIG.example.json`
- `docs/testing/D1_4B_LOCAL_DEMO_MODE.md`

Angepasste vorhandene Dateien:

- `.gitignore`, `.dockerignore`: privates `.local-demo/` ausschließen.
- `package.json`: Demo-Build/-Start/-Test ergänzen; `npm start` über einen
  vorgeschalteten Prüfer an dieselbe installierte Next-Produktions-CLI delegieren.
- `next.config.ts`: reguläre Ausgabe nur für isolierten Demo-Build;
  normale Standalone-Ausgabe erhalten; Produktionsstart zusätzlich prüfen.
- `src/lib/surveys/access.ts`: expliziter Demo-Zugriff, Scope und Pilot-ID.
- `src/app/api/admin/surveys/route.ts`
- `src/app/api/admin/surveys/[surveyId]/analytics/route.ts`
- `src/app/api/surveys/[surveyId]/route.ts`
- `src/app/admin/surveys/[surveyId]/analytics/page.tsx`
- `src/app/surveys/[surveyId]/page.tsx`
  – diese fünf Dateien verwenden den getrennten Survey-Client-Zugang.
- `src/app/api/health/route.ts`: im Demo-Modus derselbe bewachte Client.
- `src/lib/dev-import/access.ts`, `src/lib/analytics/access.ts`,
  `src/lib/donation/routes.ts`,
  `src/app/surveys/[surveyId]/participate/page.tsx`, `src/proxy.ts`:
  Entwicklungs-/Teilnahmewege bei Demo-Aktivierung geschlossen halten.

`mappingClient`, Mapping-Zielschutz, D1.1-Planer, D1.2-Persister, Prisma-Schema,
Migrationen und bestehende Compose-Dateien blieben unverändert.

## Implementierte Sicherheitsmechanismen

### Explizite Konfiguration

`readLocalDemoConfiguration()` verlangt gleichzeitig:

- `NODE_ENV=production`
- `CAREERMAP_LOCAL_DEMO=v5-synthetic`
- `CAREERMAP_LOCAL_DEMO_PURPOSE=SYNTHETIC_DEMO_ONLY`
- gültige zufällige UUID-v4-Installationskennung
- explizite Origin `http://127.0.0.1:<Port>` ohne Pfad/Benutzerinfo
- explizite PostgreSQL-URL mit Passwort, Rolle `careermap_v5_demo`, Datenbank
  `careermap_v5_demo`, Host `127.0.0.1` und eigenem Port ab 1024
- Betreiber-ID, MSI-Programm-ID, ausdrücklich gewählten Betreiber-Scope
- separates Betreiberpasswort mit mindestens 32 Zeichen, verschieden vom
  Datenbankpasswort; FACULTY benötigt die genaue Fakultät.

`careermap_v5_demo_test`, fremde Hosts, URL-Parameter, Entwicklungs-/E2E-Opt-ins,
LinkedIn-Konfiguration, normale `DATABASE_URL` sowie widersprechende alte
Mapping-/Survey-Konfiguration sind gesperrt. Kein Rückfall auf andere Clients.
Ein gesetzter, aber falscher/leerer Demo-Modus gilt als fehlgeschlagener
Aktivierungsversuch, nicht als Anlass für einen Entwicklungs-Fallback.

### Tatsächliche Verbindung und Installationsbindung

Der neue Client wird ausschließlich aus der geprüften Demo-URL erzeugt. Vor
jeder Herausgabe prüft eine lesende Transaktion:

- tatsächliche Datenbank, tatsächlichen Benutzer und PostgreSQL 17;
- kein Superuser, CREATEDB, CREATEROLE, REPLICATION oder BYPASSRLS;
- keine Datenbank-Ownership, kein Schema-/Datenbank-CREATE-Recht und keine
  Mitgliedschaft in einer über diese Rollenattribute administrativen Rolle;
- vorhandene konfigurierte Betreiberinstitution und MSI-Programmzuordnung;
- genaues MSI-Programmlabel und gegebenenfalls genaue Fakultät.

Die vorhandene Institution dient als Installationsbeleg ohne neue Entität:
Ihr Name muss exakt `SYNTHETISCH / DEMO – V5 <installationId>` sein und ihre ID
der konfigurierten Betreiber-ID entsprechen. Das bestehende MSI-Program muss
dieser Institution gehören. D1.4c muss diesen Katalog explizit initialisieren
und zusätzlich dem eigenen Compose-Projekt/Volume zuordnen.

Eine Konfigurationsänderung bei bereits gecachtem Client erfordert einen
Prozessneustart. Adapter-/SQL-Fehler werden auf
`LOCAL_DEMO_DATABASE_UNAVAILABLE` reduziert. Zugangsdaten werden nicht ausgegeben.

### Survey-Zugriff und geschlossene Eingabewege

Basic-Authentifizierung mit Benutzer `operator`, konstanter Hashvergleich des
Passworts, Betreiber-Scope-Prüfung, Body-Grenzen und Origin-Prüfung bleiben
erhalten. Im Demo-Modus muss der Host exakt der konfigurierten lokalen Origin
entsprechen; fremde Origins und unerlaubte Forwarding-Header werden abgewiesen.
Die bestehende eng begrenzte Ausnahme für öffentliche Dokumentnavigation bleibt
erhalten, nicht für Betreiberzugriffe.

Verwaltung, Einladung und betriebergeschützte Survey-Auswertung verwenden den
neuen Client. Der bestehende DRAFT-Service kann so eine unabhängige Master-
Informatik-Survey erzeugen. Deren Master-Projektion wird weiterhin ausdrücklich
als nicht freigegeben behandelt; keine Umdeutung in einen MSI-Bachelor.

`allowDevImport` verlangt weiterhin development und verweigert zusätzlich
gleichzeitige Demo-Aktivierung. Import-/Analytics-Entwicklungsseiten, OAuth-
Callback und Teilnahme-Seiten werden im Proxy abgewiesen. Donation- und
OAuth-Handler besitzen weiterhin eigene Prüfungen; der Teilnahme-Schreibweg
verlangt ausdrücklich development ohne Demo-Aktivierung. Bestehende Route-
Dateien werden weiterhin kompiliert, sind dadurch aber nicht freigeschaltet.

Der Healthcheck verwendet im Demo-Modus exakt denselben verifizierten Zugang.
Fehler führen zu 503 mit `{ "status": "unavailable" }`, ohne andere Datenbank
abzufragen. Ohne Demo-Modus bleibt der bisherige allgemeine Healthcheck erhalten.

### Getrennte Build- und Laufzeitumgebung

`npm run build:local-demo` erzeugt eine neue private temporäre Laufzeitkopie.
Eine Dateiallowlist übernimmt Anwendungsquellen einschließlich uncommitteter
D1-Dateien, Build-Konfiguration, Lockfile, Prisma-Dateien und die benötigten
Startbausteine. Keine Übernahme von Repository-`.env*`, lokalen Originalfixtures,
privatem Betriebsverzeichnis, Tests oder Quell-Symlinks. Vorhandene Zielordner
werden nicht überschrieben.

Kindprozesse erhalten nur ausgewählte OS-Grundvariablen und die ausdrücklich
benötigten Buildwerte. Keine vererbten DB-/OAuth-Zugangsdaten, öffentlichen
Geheimnisse, Entwicklungsflags oder `NODE_OPTIONS`. Ein eigenes leeres `.npmrc`
verhindert die Übernahme einer fremden npm-Benutzerkonfiguration.

In dieser Kopie werden `npm ci --include=dev` und der unveränderte eigentliche
Buildbefehl `npm run build` ausgeführt. Der Demo-Build nutzt reguläre Ausgabe
für `npm start`. Andere Builds behalten `output: standalone`.

Ein lokales Buildmanifest bindet Quellen und fertige BUILD_ID. Der Starter
verlangt eine fertig gebaute, unveränderte Kopie ohne nachträglich eingeführte
`.env`-/npm-Konfiguration. Die private Laufzeitkonfiguration kommt aus einer
separaten regulären JSON-Datei außerhalb der Anwendung mit Modus 0600.
Unbekannte Konfigurationsschlüssel werden abgewiesen. Die Vorlage enthält
absichtlich leere Pflichtwerte und ist noch keine gültige Installation.

`npm start` besitzt zusätzlich eine Prüfung **vor dem Start der Next-CLI**:
Im Demo-Modus sind explizit `--hostname 127.0.0.1` und der passende Origin-Port
erforderlich. Doppelte/abweichende Host-/Portargumente werden abgewiesen. Der
Next-Konfigurationsbaustein prüft dies bei der Produktions-Serverphase nochmals.
Normale Starts ohne Demo-Modus delegieren unverändert an `next start`.

Der kleine Demo-Starter setzt diese Argumente selbst und leitet unter Unix
SIGINT/SIGTERM an seine eigene Prozessgruppe weiter. Er provisioniert keine
Datenbank, migriert nicht, seedet nicht und verwaltet keine Docker-Volumes.

## Tatsächliches RED → GREEN → REFACTOR

| Lauf | Tatsächlicher Befund |
|---|---|
| Initialer RED-Lauf | 73 Fälle: **57 fehlgeschlagen, 16 bestanden**. Konfigurations-/DB-Scaffolds warfen `D1.4b_NOT_IMPLEMENTED`; positive Produktionszugriffe fehlten. Die bereits ablehnenden Fälle allein waren kein Implementierungsnachweis. |
| Erstes GREEN | Alle 73 Konfigurations-/Zugriffs-/Verbindungsfälle bestanden. |
| Build-Isolations-RED | **3 fehlgeschlagen, 77 bestanden**; Buildbausteine fehlten. |
| Ergänzter Startbindungs-RED | **1 fehlgeschlagen, 37 bestanden** in der Konfigurationssuite; explizite Startargumentprüfung fehlte. |
| Abschließende Unit-Regression | **64 Dateien / 1.097 Tests bestanden**, davon **87 neue D1.4b-Unitfälle**. |
| Neue echte PG17-Prüfung | **4 Integrationstests bestanden** gegen eine eingeschränkte Rolle. |
| Bestehende Integrationsregression mit Corpus-Opt-in | **12 Dateien / 377 Tests bestanden**, keine übersprungen. |

Refactor: reine Konfiguration, Request-Prüfung, SQL-Probe, Client-Auswahl und
Workspace-Erzeugung sind getrennt. Die bisherigen Domain-Services wurden nicht
umgebaut. Gemeinsame Scope- und Seed-Zielvalidierung werden wiederverwendet.

Lint, Typecheck, `prisma validate`, regulärer Demo-Produktionsbuild und separater
normaler Standalone-Produktionsbuild wurden tatsächlich ausgeführt und bestanden.
Der erste isolierte Build scheiterte an einem Sandbox-EPERM beim Aktualisieren
des vorhandenen Prisma-Caches; der freigegebene Wiederholungslauf bestand.
Ein späterer Typecheck fand eine fehlende explizite NODE_ENV-Typisierung im
Start-Test; diese wurde korrigiert und Typecheck sowie betroffener Test bestanden.

Der Demo-Build enthielt **keine `.env`-Dateien**, verwendete reguläre Ausgabe und
erzeugte keinen Standalone-Ordner. In **21 statischen Dateien** wurde der als
vererbte Umgebungsvariable gesetzte synthetische Canary
`DO_NOT_LEAK_BUILD_CANARY` **0-mal** gefunden. Das ist ein konkreter Nachweis der
getesteten Isolation, kein allgemeiner Scanner für beliebige private Quelldaten.

Lokale Nachweislogs: `/tmp/d14b-red.log`, `/tmp/d14b-red-build.log`,
`/tmp/d14b-red-binding.log`, `/tmp/d14b-regression.log`, `/tmp/d14b-pg.log`,
`/tmp/d14b-integration.log`, `/tmp/d14b-lint.log`, `/tmp/d14b-typecheck.log`,
`/tmp/d14b-schema.log`, `/tmp/d14b-build.log`, `/tmp/d14b-normal-build.log`.

## Umfang der echten Datenbankprüfung

`npm run test:local-demo` erzeugt ausschließlich einen neuen temporären,
loopbackgebundenen PG17-Container ohne persistentes Volume. Es wendet die fünf
vorhandenen Migrationen mit einer separaten Test-Administratorrolle an und
gewährt der Anwendungsrolle DML nur auf den kanonischen Tabellen. Sie besitzt
weder die Datenbank noch die Migrationstabellen und hat keine CREATE-Rechte.
Der Testcontainer wird anschließend vollständig entfernt.

Bestanden:

1. Tatsächliche eingeschränkte Verbindung einschließlich Clientfactory und
   Anlegen eines unabhängigen Master-Programs / einer DRAFT-Survey mit 0 Antworten.
2. Abweisung der tatsächlichen administrativen Verbindung.
3. Abweisung falscher Installations-/Programm-/Fakultätszuordnung.
4. Abweisung nach gezielter temporärer CREATE-Rechtevergabe im Testcontainer.

Die vorhandenen Analytics-/Workflow-Container wurden nicht als Ziele verwendet
und liefen bei der Abschlussprüfung weiter. Keine dauerhafte Demo-Datenbank
und kein öffentliches Hosting eingerichtet.

## Reproduktion und noch offene Laufzeitnachweise

Mit Node >=22.23.3 <23 im PATH:

```sh
CAREERMAP_PHASE_D_FIXTURES=1 npm test
npm run test:local-demo
CAREERMAP_PHASE_D_FIXTURES=1 npm run test:integration
npm run lint
npm run typecheck
npm run db:validate
npm run build:local-demo
```

Der letzte Befehl gibt den absoluten Pfad der sauberen gebauten Anwendung aus.
Er überschreibt keine existierende lokale Installation. Nach Bereitstellung
einer passenden Datenbank und einer privaten Konfiguration kann der bereits
vorbereitete Laufzeitbaustein verwendet werden:

```sh
npm run start:local-demo -- --app-dir /absoluter/Pfad/zur/app --config /absoluter/privater/Pfad/config.json
```

Diese positive Server-/Browserprobe wurde in D1.4b **nicht ausgeführt**.
Nachgewiesen sind Unit-/Handlerprüfungen, tatsächliche SQL-/Rechteprüfungen und
vollständige Builds. Noch offen sind tatsächliche HTTP-/Browserzugriffe gegen
den gestarteten Produktionsserver, Socketbindung, Prozessgruppenbeendigung,
Container-/Serverneustart und Volume-Persistenz.

Die Installationsbindung über Katalog-ID und markierten Institutionsnamen ist
keine kryptografische Cluster-/Volumeidentität. Ein privilegierter lokaler
Betreiber bleibt Teil der Vertrauensgrenze. D1.4c muss das zugehörige eigene
Compose-Projekt/Volume prüfen und das vollständige Rollen-/Grantset bestätigen.
Manuelle Fremdstarts, Proxy-/Tunnel-Freigaben und Änderungen geschützter
Konfigurationsdateien sind keine freigegebenen Betriebswege. Das bestehende
Basic-Verfahren bleibt ausschließlich für diese lokale synthetische Umgebung.

## Konkreter Anschlussplan D1.4c

Erst nach ausdrücklicher Freigabe:

1. RED-Betriebstests für ein eigenes Compose-Projekt, ein ausdrücklich
   zugeordnetes persistentes externes Volume, Port-/Namenskollisionen und
   Wiederaufnahme ohne Überschreiben vorhandener Nutzerkonfiguration.
2. Geschützte Erstkonfiguration mit stabilen zufälligen IDs, frischen getrennten
   Passwörtern, eigener administrativer Migrationsrolle und eingeschränkter
   Rolle `careermap_v5_demo`; vorhandene Migrationen anwenden. Keine neuen
   Domain-Entitäten oder migrationsersetzende Schemaoperationen.
3. Markierte Betreiberinstitution gemäß `localDemoInstitutionName()` und das
   genaue MSI-Program initialisieren. D1.2 mit gepinntem 100er-Bestand und
   ausdrücklich synthetischen Referenzauswahlen aufrufen; CLOSED und
   100/172/260/432/100 vollständig zurücklesen.
4. Sauberen Demo-Build starten; tatsächliche Loopback-Sockets sowie Basic-,
   Origin-, Host-, Scope- und gesperrte Import-/Teilnahmeendpunkte testen.
5. B im Browser als Master-Informatik-DRAFT mit eigener ID und 0 Antworten
   erzeugen. Danach Seed wiederholen und A sowie B vollständig vergleichen.
6. Erst Server, dann PostgreSQL-Container geordnet neu starten; IDs, Inhalte,
   Referenzen und Zeitpunkte erhalten nachweisen. Auch Container-Neuerzeugung
   mit demselben Volume prüfen. Fehlendes Volume muss zum Abbruch führen.

Kein solcher Installationscontroller, kein persistentes Volume und keine
Browser-/Neustartetappe wurden in D1.4b begonnen.
