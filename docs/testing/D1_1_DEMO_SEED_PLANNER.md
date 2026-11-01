# D1.1 – Datenbankfreier V5-Demo-Seedplaner

Stand: 1. November 2026. D1.1 abgeschlossen; D1.2 nicht begonnen.

## Arbeitsbaum und Umfang

Start auf `main`, HEAD `c0d0cbbce9b58d7dc5d55a1f805efb47971c2786`,
entsprechend der vorgegebenen Baseline. Keine Änderungen versionierter Dateien
vorhanden. Der zuvor nicht vorhandene Branch `feat/v5-survey-demonstrator` wurde
von diesem HEAD angelegt. HEAD blieb unverändert; kein Commit oder Push.

Bereits vorhandene unversionierte Nutzerdateien blieben unangetastet:
`--no-reasoning`, `.agents/`, `.claude/`, `.windsurf/`, `skills-lock.json`,
`docs/legacy/V4_EXCEL_IMPORT_ARCHIVE.md`,
`docs/requirements/UC-02_SURVEY_LIFECYCLE_MASTER_INFORMATIK.md` und
`docs/testing/V5_DEPLOYMENT_HANDOVER.md`.

Neu angelegt wurden ausschließlich:

- `src/lib/demo-seed/plan.ts`
- `src/lib/demo-seed/source-policy.ts`
- `src/lib/demo-seed/profile-plan.ts`
- `src/lib/demo-seed/plan.test.ts`
- `src/lib/demo-seed/local-corpus.test.ts`
- `docs/testing/D1_1_DEMO_SEED_PLANNER.md`

Keine bestehenden Quelltexte, Fixtures, Requirements, Prisma-Schemata oder
Migrationen geändert. Kein Datenbankzugriff des Planers, keine Persistierung,
CLI, UI, Authentifizierungsänderung oder Deploymentfunktion ergänzt.

## Normative Grundlagen und Quellfreigabe

Gelesen wurden `AGENTS.md`, `MVP_DOMAIN_MODEL.md`, `REQUIREMENTS.md`, UC-01,
UC-02 und `V5_DEPLOYMENT_HANDOVER.md` sowie relevante bestehende Normalizer,
Fixture-Audits, Mappingfunktionen, SurveyResponse-Services und SQL-Constraints.
Für die Tests wurde die installierte Next.js-Anleitung
`node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md` gelesen.

Die D0-Angaben aus dem Auftrag (100 synthetische Profile, 432 Stationen,
195 EDUCATION / 237 POSITION) wurden reproduziert. Ein eigenständiger
D0-Abschlussbericht oder Generatornachweis liegt nicht als Repository-Datei
vor. Die Freigabe des Bestands als synthetisch beruht auf dem D1.1-Auftrag nach
abgeschlossenem D0. Die Byte-Identität ist unabhängig davon durch die bereits
in `docs/architecture/PHASE_D1_FIXTURE_AUDIT.md` dokumentierten SHA-256-Werte
reproduzierbar. Prüfsummen allein beweisen keine synthetische Herkunft.

Die geschlossene Quell-Policy-Allowlist enthält:

| Policy | Herkunft und Umfang |
|---|---|
| `v5-demo-mini-v1` | Bestehendes, neu verfasstes synthetisches `minimalCorpus()` aus `analytics/test-corpus.ts`; JSON.stringify der beiden Arrays; 1 Profil / 4 Stationen |
| `v5-demo-phase-d-100-v1` | Ausschließlich das vom Auftrag freigegebene lokale Phase-D-Dateipaar; 100 Profile / 432 Stationen |

Für den 100er-Bestand gelten bytegenau:

| Datei unter `.local-fixtures/phase-d/` | SHA-256 |
|---|---|
| `all_linkedin_snapshots.json` | `c218dd34ef364e9e76d4bc470c35c1ef7a6391ed5ef1895045b3950759df6aef` |
| `all_expected_normalized.json` | `f5cb2d130a8755ae81ddbefa90b3bb65d7e04c35434303473779ad103d9293f0` |

Unbekannte Policies, insbesondere die bestehende Analytics-Policy `phase-d-v1`,
werden abgewiesen. Aufrufer können keine eigenen freigegebenen Prüfsummen
einschleusen. Fehlende Dateieningaben, abweichende Bytes, unvollständige Paare
oder falsche Inventargrößen liefern feste Fehlercodes. Die Originaldateien
wurden nur gelesen und nicht in versionierte Fixtures kopiert.

## API, fachliche Entscheidungen und Modulgrenzen

`planV5DemoSeed({ policy, sourceText, expectedText, referenceProgramId,
selections })` prüft zuerst die Quellfreigabe und plant anschließend rein aus
den Eingabewerten. Es liest weder Dateien noch Umgebungsvariablen und benötigt
keinen Prisma-Client. Das Ergebnis enthält Survey-Zielzustand, Quellnachweis,
Profil-/Stationspläne, Referenzen, Antwortpläne, Summen und Validierungsfehler.
Quellfehler werfen `DemoSourceError` mit festem Code; fachliche Fehler erscheinen
als feste Codes mit Profil-/Stationsnummern. Ein fachlich fehlerhafter Gesamtplan
hat `valid: false`; nur vollständig gültige Profile erscheinen darin.

`inspectDemoProfiles()` ist die separate fachliche Prüfschicht für gültige und
bewusst ungültige Testdaten. Sie erteilt **keine Quellfreigabe** und erzeugt keinen
autorisierten Survey-Seed. Eine spätere Persistierung muss den öffentlichen
Planer selbst erneut aus vertrauenswürdigen Eingaben aufrufen; ein vom Client
übergebener Plan oder ein verändertes `valid`-Flag genügt niemals.

Wiederverwendet werden der strukturelle Fixture-Audit, die Allowlist-Projektion
`readCareerSnapshot`, der Snapshot-Adapter, `normalizeCareerBatch` und dessen
Domainvalidierung. Der Analytics-Import wird weder aufgerufen noch verändert.
Die kleinen synthetischen Klassifikations-/Statusdeklarationen bleiben bewusst
von dessen eigener Policy getrennt. `phaseDExample()` wird nicht verwendet:
dessen OTHER-Mapping bildet die zehn Auslandssemester nicht korrekt als
CareerStep/EDUCATION ab.

Die beiden freigegebenen Policies erklären ausdrücklich zusätzliche fiktive
Testfakten: bekannte Qualifikationstypen und Reihenfolge aus dem Companion,
aktuelle akademische Fälle als IN_PROGRESS, vergangene akademische Fälle mit
bekanntem Ende als COMPLETED; beruflich entsprechend ONGOING/ENDED. Ohne
bekanntes Ende und ohne Aktualitätsdeklaration bleibt UNKNOWN erhalten. Diese
Testfalldefinition ist keine Schlussfolgerungsregel für echte Alumni. Widersprüche
werden abgewiesen. Abschlussjahre werden niemals aus Anwesenheitsenden erzeugt.
Monatsdaten werden nachvollziehbar auf Jahre reduziert.

Nur die bekannte MSI-Kandidatenstation erhält unter der Policy die explizite
Katalogzuordnung zum vom vertrauenswürdigen Aufrufer gelieferten Pilotprogramm.
Das wählt noch keine Antwortreferenz. Zusätzlich ist je Profil genau eine
Auswahl `{ syntheticId, stationId, programId, confirmation:
"SYNTHETIC_TEST_ONLY" }` erforderlich. Keine Auswahl nach erstem Treffer,
höchstem Abschluss oder jüngstem Jahr. Eine Auswahl kann keinen anderen
Degree ins MSI-Programm umhängen. Die ausgewählte Station muss zum selben
Profil gehören, ein COMPLETED-Degree sein und dieselbe Programm-ID tragen.
Mehrdeutige Stationskorrelationen und Mehrfachauswahlen werden abgewiesen.

Planinterne Schlüssel wie `profile:1:station:2` sind nur lokale Referenzen,
keine Datenbank-UUIDs, Providerkennungen oder persistenten Idempotenzschlüssel.
`response.referenceProgramId` ist ein Prüfbeleg im Plan, keine zusätzliche
SurveyResponse-Spalte. Es gibt weder `confirmedAt` noch menschliche Einwilligung
im Plan. Die Antworten tragen ausschließlich `SYNTHETIC_TEST_ONLY`.

Der Survey heißt `SYNTHETISCH / DEMO – Alumni MSI` und hat den Zielzustand CLOSED.
Der Plan hält den notwendigen Schreibablauf DRAFT → OPEN → CLOSED fest.
Er legitimiert keine Antwortanlage in einem bereits geschlossenen Survey.

PROFILE, Kontakte, OAuth-Tokens, Provider-/synthetische IDs, Beschreibungen und
Rohprofile verlassen die Prüfschicht nicht. Akademische/berufliche Titel und
Anbieterlabels sind erlaubte Karrierefelder. Anbieterlabels bleiben getrennte
Katalogvorschläge; keine automatische Zusammenführung gleicher Namen.
Berufliche Orte bleiben als `locationObservation` erhalten. Die 669 nichtleeren
Companion-Kategoriehinweise werden ausdrücklich gezählt, jedoch nicht als
kanonische Fachrichtungen, Branchen oder Jobkategorien behauptet. Diese
semantische Katalog-/Kategorienentscheidung bleibt für D1.2 sichtbar offen.

## Tatsächlich ausgeführtes RED → GREEN → REFACTOR

Alle Läufe erfolgten mit Node 22.23.3. Die Logs liegen lokal unter `/tmp/d11-*.log`.

| Lauf | Tatsächliches Ergebnis |
|---|---|
| Erste gezielte Suite einschließlich 100er-Fixture, vor Implementierung | **34 fehlgeschlagen**; RED-Scaffold wirft `D1.1_NOT_IMPLEMENTED`, erwartete Policy-/Validierungsergebnisse fehlen |
| Erste Implementierungsprüfung | 33 bestanden, 1 fehlgeschlagen; zu breiter Seiteneffekt-Testregex traf auch den Namen `matchesDate`; auf Wortgrenze korrigiert |
| Erster GREEN-Lauf | **34 bestanden** |
| Ergänzte Negativfälle | 35 bestanden, 2 fehlgeschlagen: fremder abgeschlossener Degree wurde fälschlich MSI zugeordnet; weitere Erwartung verlangte Fehler ohne tatsächlich vorhandene Stationsnummer |
| Korrektur der Programmzuordnung und präzisierte Fehlererwartung | **38 bestanden**, einschließlich 100er-Fixture |
| Ergänzter Datenschutz-RED-Test | 37 bestanden, 1 fehlgeschlagen: ungültige Programmkonfiguration wurde als Text im Survey-Plan ausgegeben |
| Korrektur und vollständige Regression | **998 bestanden**, darunter alle **39 D1.1-Tests**, beide lokalen Corpus-Tests eingeschaltet |

Im Refactor wurden die Quellfreigabe und fachliche Prüfung getrennt, die
discriminated TypeScript-Union der kanonischen Stationsarten erhalten und
Profil-/Stationsdiagnosen präzisiert. Der transitive Laufzeit-Importgraph wird
auf I/O-, Datenbank-, Netzwerk-, Zufalls-, Zeit- und Umgebungszugriffe geprüft;
Prisma-/pg-Laufzeitimporte sind zusätzlich durch werfende Test-Mocks gesperrt.

## Ergebnis des 100er-Tests

| Messgröße | Anzahl |
|---|---:|
| Gelesene / gültig planbare Profile | 100 / **100** |
| Quellstationen EDUCATION / POSITION | 195 / 237 |
| Gültig planbare Stationen insgesamt | **432** |
| Degrees / CareerSteps | **172 / 260** |
| Berufsausbildungen als VOCATIONAL_TRAINING | 13 |
| Auslandssemester als EDUCATION-CareerStep | 10 |
| Eindeutige eigene COMPLETED-Referenzabschlüsse | **100** |
| Gültig geplante Antwortdatensätze | **100** |
| Profilausschlüsse / Validierungsfehler | **0 / 0** |
| Auf Jahrespräzision reduzierte Monatsendpunkte | 369 |
| Ausdrücklich synthetische Statusdeklarationen | 432 |

Keine nicht transformierbaren Profile und keine künstlichen Ersatzstationen.
Die Zahlen bezeichnen ausschließlich Planung; **0 Datenbankeinträge erzeugt**.
Ohne zusätzliche Referenzauswahlen entstehen keine gültigen Antwortpläne.

Der bestehende allgemeine Phase-D-Reviewtest erwartet unverändert 182 Degrees /
250 CareerSteps. Er verwendet einen anderen Mappingpfad, der Auslandssemester
als OTHER-Degree führt. Das ist eine bekannte Altpfad-Lücke, keine Abweichung
des neuen Seedplaners. Der bestehende Analytics-Pfad und der neue Planer zählen
fachlich richtig 172 / 260; bestehende Tests wurden nicht umgeschrieben.

## Reproduktion und ausgeführte Regression

Node 22.23.3 muss im PATH stehen. Für diese Prüfung wurde der vorhandene lokale
Node unter `/Users/sebastian/.nvm/versions/node/v22.23.3/bin` verwendet.

```sh
CAREERMAP_PHASE_D_FIXTURES=1 npm test -- src/lib/demo-seed/plan.test.ts src/lib/demo-seed/local-corpus.test.ts
CAREERMAP_PHASE_D_FIXTURES=1 npm test
npm run lint
npm run typecheck
npm run db:validate
npm run build
```

Die vollständige Regression mit gesetztem Fixture-Opt-in bestand mit **55
Testdateien / 998 Tests**, darunter Normalizer, Career-Import, Analytics,
Donation, Survey-Routen und Datenschutz-/Zugriffsprüfungen. Lint, Typecheck,
Prisma-Schemavalidierung und Produktionsbuild wurden tatsächlich ausgeführt
und bestanden. `prisma generate` erzeugte nur den ignorierten Client; keine
Migration und keine Datenbankverbindung.

Integrationstests und Playwright-/Persistenz-/Neustarttests wurden bewusst nicht
ausgeführt: Ihre bestehenden Starter erzeugen und beschreiben PostgreSQL-
Testdatenbanken. D1.1 beschränkt sich ausdrücklich auf den reinen Planer ohne
Datenbankeinträge. Es gibt deshalb keinen Nachweis für persistierte Antworten,
Idempotenz, tatsächlichen CLOSED-Schreibschutz oder Neustartbeständigkeit aus
dieser Etappe.

## Offene Punkte und konkreter Vorschlag für D1.2

Keine offene Testfehlfunktion des Planers. Die tatsächliche Existenz, MSI-
Identität und Betreiberzugehörigkeit der konfigurierten Programm-UUID sind rein
funktional nicht beweisbar. Der Test verwendet eine synthetische UUID als
Katalog-Stellvertreter. Vor Persistierung sind diese Beziehungen erneut zu
prüfen; außerdem Herkunftsnachweis/D0-Bericht als Betriebsbeleg verfügbar halten
und die Katalog-/Kategorienbehandlung explizit festlegen.

D1.2 erst nach ausdrücklicher Freigabe:

1. RED-Integrationstests auf einer ausdrücklich isolierten PostgreSQL-17-Demo
   für atomaren Rollback, falsches Programm/Ownership, doppelte Antworten,
   Wiederholung, nichtleeren abweichenden Bestand und parallele Seeds.
2. Plan im vertrauenswürdigen Serverprozess neu berechnen; bei irgendeinem
   Validierungsfehler gesamten Persistierungslauf abbrechen. Keine fremde DB
   oder bestehende Betreiberumfrage verändern; kein Reset und kein Namens-Upsert.
3. Unter Batch-Sperre und bestehenden Survey-/Program-/Alumni-/Degree-
   Sperrkonventionen eine neue SYNTHETISCH/DEMO-Survey als DRAFT anlegen, OPEN
   setzen, neue zufällige UUIDs für Alumni/Stationen/Kataloge zuordnen und
   TimelineItems sowie geprüfte Demo-Antworten atomar schreiben. Bestehende
   Domainservices/Transaktionskomposition nutzen und zum Schluss CLOSED setzen.
4. Idempotenz ohne neue Tabellen über strikten Vergleich des vollständigen
   eigenen Demo-Batches prüfen. Identische Wiederholung nur überspringen;
   abweichende oder mehrdeutige Daten ablehnen. Keine Provideridentitäten als
   Datenbankschlüssel und keine automatische Personen-Zusammenführung.
5. In derselben Transaktion beziehungsweise nach Commit gezielt zurücklesen:
   100 eigene COMPLETED-Referenzen, UNIQUE Survey/Alumni, 432 Timelineziele und
   CLOSED-Endzustand. Fehler injizieren und vollständigen Rollback nachweisen;
   anschließend separaten persistenten Neustart-/Isolationsnachweis planen.

Dieser Vorschlag ist keine begonnene D1.2-Implementierung.
