# Alumni CareerMap – neuer Fokus: Erstes vollständig testbares Demonstrator-Deployment

**Datum:** 1. November 2026  
**Status:** Arbeitsauftrag und Übergabe für einen neuen Chat und eine **neue Codex-Entwicklungsrunde**; Implementierung/Deployment noch **nicht** durchgeführt.  
**Repository:** https://github.com/duenne/alumni-careermap  
**Geprüfter `main`-HEAD:** `c0d0cbbce9b58d7dc5d55a1f805efb47971c2786` (1. November 2026, GitHub read-only geprüft). Vor jeder Codex-Arbeit erneut lokalen HEAD und Working Tree verifizieren.  
**Normative Quelle:** `AGENTS.md`, `docs/architecture/MVP_DOMAIN_MODEL.md`, danach Requirements, aktueller Code und Tests.  
**Vollständiges Fachszenario:** Repository-Datei `docs/requirements/UC-02_SURVEY_LIFECYCLE_MASTER_INFORMATIK.md` (exakt vom Nutzer bereitgestellter Text mit AC-01 bis AC-24).  
**Zurückgestellter Themenstrang:** `docs/legacy/V4_EXCEL_IMPORT_ARCHIVE.md`. Dieses Importarchiv ist **kein** Auftrag zur Verarbeitung von Legacy-Daten.

## 1. Zielbild in einem Satz

Ein unabhängig test- und reproduzierbarer Alumni-CareerMap-Demonstrator mit **einer vorhandenen, abgeschlossenen, ausschließlich synthetischen Umfrage einschließlich echter kanonischer Teststationen und aggregierter Auswertung** sowie der Möglichkeit, **eine zweite, eigenständige Umfrage** beispielsweise für den Master Informatik an der Hochschule München neu anzulegen, freizugeben, synthetisch probeweise zu durchlaufen, zu schließen und getrennt auszuwerten.

### 1.1 Zwei voneinander unabhängige Umfragen

| Umfrage | Ausgangszustand | Daten | Im ersten Demonstrator erwartete Funktion |
|---|---|---|---|
| **A – historische Demo-Umfrage** | `CLOSED`, optisch klar **SYNTHETISCH / DEMO** | Bestehende nachweislich synthetische Karriereprofile (nach Möglichkeit vorhandener Phase-D-100er-Bestand), kanonische `Alumni`/`Degree`/`CareerStep`/`TimelineItem` und ausschließlich zu diesem Survey gehörige synthetische `SurveyResponse`-Testdatensätze | In der Übersicht erscheinen, lesbarer geschlossener Einladungslink, keine neuen Teilnahmen, vorhandene Ergebnisse nur berechtigten Personen; kein Datenverlust nach Neustart |
| **B – neue Umfrage** | Vom berechtigten Betreiber neu als `DRAFT` angelegt | Anfangs **0** Antworten, keine Kopie von A; Referenzprogramm **Master Informatik** | Öffnen, Link, synthetische beziehungsweise tatsächlich freigegebene Eingabemöglichkeiten, Abschluss/Schließung, getrennte Ergebnisse; keine Datenbeziehungen zur Demo-Antwortmenge von A |

**Wichtige Abgrenzung:** Synthetische Testprofile sind fiktive Daten und dürfen in einer **isolierten Demo-Datenbank** technisch `SurveyResponse`-Datensätze besitzen, damit der echte Befragungsleseweg getestet wird. Diese Testdatensätze müssen auf allen relevanten Betreiber-/Ergebnisansichten erkennbar **Demo/Synthetisch** heißen und dürfen niemals als tatsächliche Einwilligungen oder echte Alumni-Teilnahmen ausgegeben oder in produktive Analysen überführt werden. Das Verbot fingierter `SurveyResponse` aus V4 gilt ausdrücklich für **historische reale Excel-Daten**; jene bleiben vollständig ausgeschlossen.

### 1.2 Was „vollständig testbar“ bedeutet

Nicht bloß eine erfolgreiche `next dev`-Sitzung und kein Screenshot als Erfolgsnachweis. Ziel ist eine **lokal beziehungsweise auf einem abgesicherten Staging-Ziel persistente, reproduzierbare Deployment-Installation**:

- PostgreSQL **17**, versionierte Migrationen, definierter Installations-/Seedablauf, keine flüchtige Starter-Datenbank, die bei `Ctrl+C` verloren geht.
- `npm run build` und realitätsnahes `npm start` (oder begründete gleichwertige Startstrategie) plus Health-, Auth-, Datenbank- und Browser-Checks; Next.js 16 / Node >=22.23.3 <23.
- Dieselbe alte Umfrage und dieselben Ergebnisse nach **Serverneustart**; Seed ein zweites Mal ist idempotent, verändert keine Betreiberumfragen und vervielfacht keine Antworten.
- Testbare UI-Pfade für den Betreiber und einen simulierten Alumni, inklusive Negativfälle und unabhängiger Umfragegrenzen.
- Keine echten Personen- oder Excel-Daten, keine externe LinkedIn-Freigabe im automatisierten Test, kein E-Mail-Versand an reale Empfänger, kein automatisch öffentliches Hosting.
- Abschlussbericht mit tatsächlich ausgeführten Unit-/Integration-/Browser-/Buildprüfungen und bewusst offenen Kriterien. „Deployment bereit“ erst nach bestandenem Gate.

Ein öffentliches **Produktivdeployment** ist davon zu unterscheiden: Hosting-Ziel, Identitätsanbieter/SSO, Berechtigungskonzept, TLS, Secrets, Backup, Datenverarbeitungsrecht, Löschwege, Publikationssperren und Monitoring sind bisher nicht freigegeben. Ohne diese Faktoren **nur loopback/abgesichertes Staging**, keine Internetfreigabe.

## 2. Verifizierte Ausgangslage am Repository-HEAD

- Bestehende Umfrageverwaltung: `src/lib/surveys/service.ts`, `src/lib/survey-service.ts`, `src/app/admin/surveys/...`. `Survey` hat normativ nur `id`, `name`, `referenceProgramId`, `status` (`DRAFT`, `OPEN`, `CLOSED`) sowie technische Zeitpunkte.
- Synthetischer End-to-End-Teilnahmeweg, geschützter Survey-Leseweg, bestehende Test-Suites und Playwright sind bereits integriert; `package.json` besitzt `dev:integrated`, `test:e2e:integrated`, `test:e2e`, `test:integration`, `db:validate`, `build`.
- Bestehender **100er Analytics-Demo-Bestand** stammt aus einem gesonderten Import- und Datenbankpfad `scripts/analytics.ts`, `src/lib/analytics/prepare.ts`, `src/lib/analytics/store.ts`. Dieser importiert kanonische Profile **ohne Surveys/SurveyResponses** und schützt die separate Demo-Datenbank vor Survey-Teilnahmen. Er ist **noch nicht** die gewünschte geschlossene Umfrage. Daher eine neue isolierte Demo-Seed-Strategie entwerfen, die dieselben fachlich passenden synthetischen Fälle neu verwendet, ohne den bestehenden Testimport umzudeuten, zu zerstören oder Produktionsdaten anzufassen. Lokal optional vorhandene `.local-fixtures/phase-d/` zuerst auf Existenz und sicheren synthetischen Ursprung prüfen.
- `scripts/dev-mapping.mjs` startet für den integrierten Entwicklerbetrieb **jedes Mal eine temporäre PostgreSQL-17-Datenbank** und entfernt sie beim Beenden. Das ist ausdrücklich **kein** persistentes Deployment.
- `src/lib/surveys/analytics.ts` beschränkt aktuell die Projektion auf ein konfigurierte MSI-Programm-ID und `Degree.level === BACHELOR`. Master Informatik würde `UNSUPPORTED_PROJECTION` erhalten. `src/lib/analytics/overview.ts` und `aggregate.ts` enthalten MSI-spezifische Vier-/Sieben-Stufen-Labels und Berechnungen. Für Master Informatik benötigen wir eine **fachlich freigegebene programmunabhängige Referenzprojektion**, keine Ersetzung aller Masterabschlüsse durch MSI-Bachelor und kein Einblenden eines leeren Erfolgsdiagramms.
- Die bestehenden produktiven SQL-Constraints und Normregeln dürfen nicht aufgeweicht werden. `SurveyResponse.referenceDegreeId` referenziert einen **eigenen, zum Survey-Programm passenden, `COMPLETED`** Degree. Für Demo-A muß dies auch in synthetischen Seeds gelten; bei B kann dies ein abgeschlossener Master sein.
- Authentifizierung ist im Prototyp operator-geschützt (lokale Basic-/Token-Prüfungen), **kein nachgewiesenes Hochschul-SSO**. Öffentliche Live-Freigabe ist damit kein bereits erbrachter Leistungsumfang.

## 3. Fachszenario und testbare End-to-End-Journey

Quelle ist `docs/requirements/UC-02_SURVEY_LIFECYCLE_MASTER_INFORMATIK.md`. Keine stillen Abweichungen; als zukünftige Anforderungen behandeln, auch wenn noch nicht modelliert.

**Betreiber (beispielhaft fiktiver Master-Informatik-Verantwortlicher):** Anmeldung/Autorisierung → Übersicht mit A geschlossen → neue Umfrage B für **Master Informatik** anlegen → individuelle Startseite, Datenschutzinformation und Quellen-/Teilnahmebedingungen konfigurieren → Entwurf prüfen → B veröffentlichen → Einladungslinks verwenden → aggregierten Fortschritt prüfen → Erinnerungen vorbereiten → B manuell/terminlich schließen → berechtigte Ergebnisse prüfen und getrennt freigeben → Vorjahres-Archiv einsehen oder neue Umfrage aus altem Template erzeugen.

**Alumna (fiktiv):** Einladung öffnen → Zweck/Datenschutz lesen → Karriereinformationen aus freigeschalteter Quelle laden/eingeben → Master Informatik der HM als **konkreten eigenen Referenz-Degree ausdrücklich auswählen** → Timeline korrigieren → Beitrag bestätigen → genau eine gültige Teilnahme → Danke-Seite → gegebenenfalls opt-in Benachrichtigung und später authentifizierter Zugriff auf **eigene** archivierte Teilnahme.

**Wesentliche Trennung:** Eine geschlossene Umfrage (`CLOSED`) ist **nicht automatisch** „Ergebnisse veröffentlicht“. Das normative `SurveyStatus` kennt keinen separaten Veröffentlichungszustand, keinen geplanten Status und keinen Archivstatus. Die Szenariovorgaben für Personalisierung, Laufzeit, Ergebnisschalter, Erinnerungsprotokoll, Versions-/Snapshot-Verwaltung, opt-in und wiederauffindbare persönliche Teilnahme sind daher **noch nicht** vollständig durch das derzeitige Domain Model gedeckt. Änderungen an Domain Model/Schema sind ein **explizites Architekturentscheidungs-Gate**: nicht implizit zusätzliche Felder oder Tabellen schaffen, auch nicht unter dem Vorwand „nur UI“.

## 4. Priorisierte Umsetzung in kleinen RED → GREEN → REFACTOR-Inkrementen

**Inkrement D0 – Baseline-/Gap-Audit, ohne Änderungen:** Realen lokalen Zustand prüfen, sämtliche AC-01–AC-24 als bereits vorhanden/teilweise/fehlend/Architekturentscheidung/Betriebsentscheidung klassifizieren. 100er-Synthetik-Quelle samt Provenienz verifizieren. Datensicherheitsrisiken und Migrationsbedarf explizit ausweisen.

**Inkrement D1 – Persistenter Demo-Survey-Seed und zweite Umfrage:** Isolierte persistente PostgreSQL-17-Demoinstallation und ausführbare idempotente Seedroutine für A (CLOSED, reale kanonische **fiktive** Stationen, korrekte synthetische SurveyResponse-Paare, kein Rohdaten-/Kontakttransfer); Betreiber kann B als DRAFT für Master Informatik anlegen. Schließung sperrt A serverseitig. 100er-Korpus **nur** wenn vollständig vorhanden und belegbar synthetisch; sonst nicht behaupten, er sei migriert. Vor einer alternativen kleinen synthetischen Seedbasis die Abweichung deutlich ausweisen. Mehrmaliger Seed und Neustart müssen sicher sein. Tests vor Code.

**Inkrement D2 – Programmunabhängige Referenz-/Sankey-Projektion:** Bestehende pure Analytics sinnvoll wiederverwenden, `Degree.level=MASTER` und tatsächliches Survey-Referenzprogramm beachten; vierstufige Ansicht für Referenz-Master ggf. definieren als **Referenzabschluss Master → erste berufliche Position danach (Branche+Job derselben Stelle) → spätere Stationen/Qualifikationen**, aber fachliche Stufen müssen vor Implementierung abgestimmt werden. MSI-Bachelor und synthetisches V2.4-Verhalten unverändert halten; keine gefälschten Vollständigkeitsbehauptungen.

**Inkrement D3 – Kampagnenführung:** Entwurf/Öffnen/Schließen, getrennte öffentliche Anzeige, betreibergeschützte Verwaltung; per Survey konfigurierbare Begrüßung, Titel/Bild, Laufzeit und Pflichtinformationen **nur nach Architekturfreigabe**. Alternativen für erste Version explizit als eingeschränkt ausweisen, nicht als implementiert behaupten. Einladungs-/Erinnerungstexte ohne ungeprüfte Kontaktlistenversendung.

**Inkrement D4 – Teilnahme und Ergebnisfreigabe:** Funktionierender synthetischer E2E-Weg über den bestehenden Editor für Master-Referenz, ausdrückliche Bestätigung und Speichern; Survey-Isolation; nach Schließung keine Einreichung; separater Ergebnisfreigabe-/Privacy-Gate nach freigegebenem Fachmodell. Auswertungs-UI darf bei kleinen Gruppen keine individuellen Kombinationen preisgeben.

**Inkrement D5 – weitergehende UC-01-Funktionen:** Optionaler CV-Import, live LinkedIn falls autorisiert, echte Hochschul-SSO, eigener Archivzugang, persönlich revisionssichere Karrieresnapshots, Benachrichtigung, Wiederholungsvorlage, automatische Zeitfenster und Datenauskunft/Löschung. Diese sind Teil des vom Nutzer gelieferten *Soll*-Szenarios, **nicht** als schon vorhanden zu deklarieren. Wo Schema, Sicherheitskonzept oder Betreiberentscheidung notwendig sind: zuerst Entscheidung und Tests.

**Inkrement D6 – Deployment-Abnahme:** Persistente DB nach Restart, idempotente Seeds, tatsächlicher Produktionsbuild, unabhängige Surveys, Browserkompatibilität, Auth- und Sicherheitsnegativtests, Datenschutzgate, Dokumentation von Version/Installationsschritten/Backups/Rollback, kein öffentliches Deployment ohne Ziel- und Betriebsfreigabe.

## 5. Akzeptanzmatrix: vollständige UC-01-Traceability

Die IDs und Anforderungen folgen dem eingereichten Solltext. **Hier ist keine AC als implementiert abgenommen**; Codex muss pro ID Nachweis/Test/Fehlstelle führen. Die Spalte „Etappe“ beschreibt einen Arbeitsvorschlag, nicht den Ist-Stand.

| AC | Prüfkern | Geplanter Gate/Etappe |
|---|---|---|
| AC-01 | Berechtigte Person kann Survey für passenden Studiengang erstellen | D1/D3, Betreiber-Scope |
| AC-02 | Neue Survey erhält ID und startet als `DRAFT` | D1 |
| AC-03 | Titel, Beschreibung, Foto, Text, Jahrgänge und Laufzeit konfigurieren | D3; **Domain-/Speichergate** |
| AC-04 | Pflicht-Datenschutzinformationen nicht überschreibbar | D3; Rechts-/Textfreigabe |
| AC-05 | Desktop-/Mobile-Startseitenvorschau | D3 |
| AC-06 | Publizierte Kampagnenlinks gehören zum richtigen Survey | D3 |
| AC-07 | Aktiv: alle tatsächlich freigeschalteten Eingabewege | D4/D5; externe LinkedIn-/CV-Gates |
| AC-08 | Konkreten `COMPLETED`-Referenz-Degree ausdrücklich bestätigen | D4 (Master) |
| AC-09 | Stationen vor Abgabe bearbeiten/entfernen | D4 |
| AC-10 | Abbruch zählt nicht als SurveyResponse | D4 |
| AC-11 | Retry derselben Teilnahme erzeugt keine doppelte Response | D4 (Sitzungsgrenze beachten) |
| AC-12 | Aggregierter Umfragefortschritt, Erinnerungsfunktion | D3/D5; Besucherzählung/Tracking-Gate |
| AC-13 | Automatische Schließung am Fristende | D3/D5; zusätzliche Zeitsemantik |
| AC-14 | Auch bereits geladenes Formular darf nach `CLOSED` nicht committen | D1/D4, Race-Test |
| AC-15 | Schließung bewahrt vorhandene Antworten | D1/D4, Neustarttest |
| AC-16 | Ergebnisse erst nach separater Daten-/Privacy-Freigabe | D4/D5; **Publikations-Gate** |
| AC-17 | Mindestfallzahl (nur Vorschlag 5) plus Schutz ungewöhnlicher Kombinationen | D4/D5; vor Live-Freigabe |
| AC-18 | Benachrichtigung nur mit entsprechender Kontaktberechtigung | D5; Opt-in-/Versand-Gate |
| AC-19 | Geschlossener Link erreichbar, keine neue Teilnahme | D1 |
| AC-20 | Eigene archivierte Teilnahme nur mit geeigneter Zugangsprüfung | D5; **Identitäts-Gate** |
| AC-21 | Archivierte Teilnahme schreibgeschützt und ggf. korrigier-/löschbar | D5; **Snapshot-/Privacy-Gate** |
| AC-22 | Neuer Survey aus Vorlage ohne Veränderung der alten Survey | D5; Domänen-/Template-Gate |
| AC-23 | Studiengangs-/Survey-/Rollen-Isolation | Alle Etappen, zentraler Negativtest |
| AC-24 | Status-, Freigabe-, Benachrichtigungs-Audit nachvollziehbar | D3/D5; **Audit-/Domain-Gate** |

**Zusätzliche technische Abnahmebedingungen für D1:** Genau 1 alte `CLOSED`-Demo-Umfrage mit vorgesehenem synthetischem Korpus und korrekten Pairings, 0 akzeptierte zusätzliche Antworten nach Schließung, separate neue `DRAFT`-Umfrage mit 0 Antworten, keine Cross-Survey-Stats, Seed-Retry ohne Duplikate, unveränderte Kataloge nach zweiter Seed-Ausführung, persistenter Zustand nach Neustart.

## 6. Nicht überspringbare Entscheidungen

1. **Deployment-Ziel**: Erst isolierte lokale/persistente Demo oder bereitgestelltes abgesichertes Staging. Kein automatischer Produktions- oder öffentlicher Internetstart.
2. **Datenbasis**: Prüfen, ob Phase-D-100er-Korpus wirklich vollständig synthetisch vorliegt; 100er-Import wurde für SurveyResponse bisher nicht durchgeführt. Demo-Kohorte sichtbar von künftigen echten Spenden trennen.
3. **Master-Analytics**: MSI-Bachelor-spezifisches Sankey kann nicht einfach umbeschriftet werden. Fachlich definierte Master-Referenzprojektion und Fallzahlen erst vor D2 freigeben.
4. **Survey-Konfigurationsdaten**: Normatives `Survey` hat derzeit keine Beschreibung, Foto-, Termin-, Kontakt- und Publikationsversionen; jede persistente Erweiterung erfordert explizite Architekturfreigabe.
5. **Echte Ergebnisfreigabe**: `CLOSED` darf nicht automatisch die Veröffentlichung auslösen. Kleine Kategorien/seltene Pfade müssen geprüft werden; `n>=5` ist nur ein Vorschlag, keine vollständige Schutzgarantie.
6. **Anmeldung/Kontakt/Archiv**: Hochschulaccount, Wiederherstellungscode und historische Snapshots sind nicht durch bestehende UI-Sitzungen zu behaupten. Vor Internetbetrieb eigenes Security-Design.
7. **Betrieb**: Richtiges persistentes PostgreSQL-Volume, DB-Backup/Restore-Test, Secrets, Migrationen, Healthcheck, Neustart und dokumentierter Rollback. Bei Datenverlust oder Ausfall kein positiver Abnahmebericht.

## 7. Erste Codex-Runde D0→D1: ausführbarer Auftrag

**Ausführung:** Codex auf **Extra High (xhigh)**, **frischer Kontext** (`/clear` vorher nach Sicherung dieser Dateien). Dieses Dokument und das vollständige UC-01-Szenario lokal im Codex-Arbeitskontext verfügbar machen; die private XLSX bleibt außerhalb. Erlaubt ist ein neuer Feature-Branch, nicht aber Commit/Push/Merge ohne neue ausdrückliche Freigabe. Der Startauftrag umfasst **nur D0 und D1**, nicht das gesamte UC-01-Projekt in einer einzigen schwer überprüfbaren Codex-Antwort.

```text
Du arbeitest als Codex Extra High (xhigh) an duenne/alumni-careermap.

AUFTRAG: Erstes persistentes, testbares Alumni CareerMap Demo-Deployment,
Inkremente D0 (Ist-Audit) und D1 (synthetische Altumfrage + neue Umfrage).

Lies zuerst vollständig:
- AGENTS.md
- docs/architecture/MVP_DOMAIN_MODEL.md
- docs/requirements/REQUIREMENTS.md
- docs/requirements/UC-01_ALUMNI_DATA_DONATION.md
- docs/testing/V5_DEPLOYMENT_HANDOVER.md
- docs/requirements/UC-02_SURVEY_LIFECYCLE_MASTER_INFORMATIK.md

Die Datei docs/legacy/V4_EXCEL_IMPORT_ARCHIVE.md ist nur
zur Information über den ausdrücklich zurückgestellten historischen Import.
Keine private MSI-XLSX öffnen, kopieren oder verarbeiten.

STARTCHECK
1. git status, Branch, HEAD, alle unversionierten Dateien prüfen;
   vorhandene unversionierte .agents/, .claude/, .windsurf/,
   skills-lock.json und sonstige Nutzeränderungen nicht anfassen.
2. Erwarteter Baseline-HEAD: c0d0cbbce9b58d7dc5d55a1f805efb47971c2786.
   Bei Abweichung dokumentieren und zuerst sicheren Stand ermitteln.
3. Falls möglich aus aktuellem unverändertem main einen neuen
   Feature-Branch feat/v5-survey-demonstrator anlegen.
   Keine bestehenden Änderungen überschreiben.
4. Alle UC-01-Kriterien AC-01 bis AC-24 gegen Code und Tests auditieren:
   vorhanden/teilweise/fehlend/Architektur-Gate/Betriebs-Gate.
   Bei Kollisionen normatives Domain Model respektieren.

D1 – TESTGETRIEBEN
Erstelle zuerst gezielte RED-Tests, dann minimalen GREEN-Code,
anschließend REFACTOR mit vollständiger Regression:

A. Definiere einen isolierten persistenten PG17-Demo-Betrieb,
   unabhängig vom bisherigen temporären dev:integrated-Starter
   und unabhängig von lokalen echten oder bereits belegten DBs.
   Keine gefährlichen Reset-/Overwrite-Defaults, keine Nutzung
   produktiver DB-URLs, keine unkontrollierten öffentlichen Hosts.

B. Erzeuge deterministisch eine klar als SYNTHETISCH/DEMO
   gekennzeichnete ALTE Umfrage für das MSI-Pilotprogramm mit
   SurveyStatus CLOSED. Nutze nach sicherer Prüfung möglichst
   den bestehenden nachweislich synthetischen Phase-D-100er-
   Bestand, nicht die historische reale MSI-Excel-Datei.
   Prüfe, ob der 100er-Korpus lokal verfügbar und inhaltlich
   ausschließlich synthetisch ist. Wenn nein, stoppe die Aussage
   '100 Datensätze importiert' und dokumentiere die Lücke.
   In der Demo-Umfrage liegen kanonische Degree/CareerStep/
   AlumniTimelineItem-Stationen und DEMO-ONLY SurveyResponses,
   deren referenceDegreeId zu einem eigenen COMPLETED-Degree
   im Referenzprogramm gehört. Die Testbestätigung behauptet
   keine Einwilligung realer Alumni. Kein demoAnchor als Ersatz
   für SurveyResponse, kein ImportAnalytics direkt in falsche DB.
   Die alte Umfrage ist über die Verwaltung sichtbar, CLOSED-
   Einladungen sind lesbar, neue Teilnahmen serverseitig verboten.

C. Eine zweite, unabhängige Umfrage muss im Betreiber-UI neu
   angelegt werden können, bevorzugt für den Studiengang
   Master Informatik (HM), mit eigenständiger ID und
   anfänglichem DRAFT-Status ohne kopierte Antworten.
   Die Normvalidierung eines selbst bestätigten Master-Degree
   darf nicht durch eine hardcodierte MSI-Bachelor-Bedingung
   in der Spendenlogik abgewiesen werden.
   Die bestehende MSI-spezifische Sankey-Projektion für B ist
   allerdings derzeit unzureichend; als Lücke für D2 markieren,
   nicht ein falsches Diagramm anzeigen.

D. Seed muss bei Wiederholung idempotent sein; Restart eines
   Produktionsbuild-ähnlichen Servers muss die Daten erhalten.
   Keine Löschung/Reinitialisierung anderer Umfragen oder Daten.
   Datenbanken, Volumes, Secretdateien und Testlogs sicher trennen.

E. Sicherheits- und Regressionstests: geschlossen = kein Submit,
   offene/frische Umfrage unabhängig, keine Cross-Survey-Antwort,
   künstliche Einwilligung nur DEMO-Kontext, nicht öffentlich,
   mehrmaliger Seed ohne Duplikate, Restarts, Berechtigungen,
   keine privaten Excel-/LinkedIn-Daten in Code oder Ausgabe.

NICHT TEIL VON D1
- Keine historische XLSX-Verarbeitung, kein Excel-Konverter.
- Keine neue Prisma-Entität oder normative Domain-Änderung.
- Kein SSO-/Produktivhost-Provisioning ohne Freigabe.
- Keine automatische E-Mail oder echte LinkedIn-Autorisierung.
- Keine impliziten Pflichtfelder für Startseitengestaltung,
  Zeitplanung, Veröffentlichungsstatus, Snapshots oder Consent.
- Keine Behauptung, dass alle AC-01–AC-24 schon erfüllt sind.

ARCHITEKTUR-GATE
Falls D1 ohne normative Änderungen nicht korrekt möglich ist,
STOPPE vor der jeweiligen Implementierung. Gib eine konkrete
Konfliktbeschreibung, Minimaloptionen und deine Empfehlung.
Keine stillen Änderungen an Prisma-Schema oder Migrationen.

VERIFIKATION
Führe die relevanten RED/GRÜN-Testläufe aus sowie nach
Möglichkeit npm run lint, npm test, npm run db:validate,
npm run test:integration, npm run typecheck, npm run build,
relevante Playwright-Suites und die echte persistente
Start-/Stop-/Neustart-Probe. Keine Testerfolge erfinden.

ABSCHLUSSBERICHT
- Geprüfter Branch/HEAD/Status und veränderte Dateien
- Ist-Abdeckung AC-01–AC-24 samt Tests und offener Gates
- Exakter synthetischer Seedbestand: Herkunft und Zahl
- Reproduzierbare Installations-, Seed- und Startbefehle
- Alte geschlossene Survey: Belege (ohne Personen-/Secretdaten)
- Neue DRAFT-Survey: unabhängige Anlage und Nullantwortzahl
- Red/Green/Refactor-Historie und alle tatsächlich gelaufenen Tests
- Persistenz-/Idempotenz-/Isolations-/Sicherheitsbefunde
- Genaue Restlücken für D2 und spätere Inkremente

Nicht committen, pushen oder deployen in eine öffentliche
Umgebung ohne meine ausdrückliche Freigabe.
STOPPE nach D1 und warte auf Abnahme.
```

## 8. Arbeitsweise mit ChatGPT und Codex

- **Diese drei Dateien im lokalen Repository verfügbar halten**: `docs/legacy/V4_EXCEL_IMPORT_ARCHIVE.md`, `docs/testing/V5_DEPLOYMENT_HANDOVER.md`, `docs/requirements/UC-02_SURVEY_LIFECYCLE_MASTER_INFORMATIK.md`. In einem neuen Chat sind sie nicht automatisch sichtbar, sofern sie nicht dort oder als Projektdatei erneut zur Verfügung stehen.
- **Codex**: bisherigen P0/P1b-Kontext erst nach Download/Sicherung mit `/clear` zurücksetzen. Danach die beiden Repository-Dateien für Deployment und Szenario im Codex-Arbeitskontext referenzieren und den D0→D1-Prompt verwenden.
- **ChatGPT neuer Chat**: Deployment-Handover und Original-Szenario anhängen. Kurze Starter-Nachricht: „Wir beginnen bei D0/D1. Prüfe die beiden Anhänge, gib mir die Codex-Prompts einzeln, bewerte nach jedem Run die Tests und Architekturkonflikte. Historischer Excel-Import bleibt vertagt.“
- Nach D1 Test- und Diff-Bericht zurückbringen; **erst danach** D2-Master-Analytics-Design und weitere Inkremente beauftragen. Codex-Kontext an solchen Etappengrenzen bewusst mit `/compact` oder frischem `/clear` plus dieser MD-Übergabe handhaben.

## 9. Unveränderte Grenzen für jede folgende Runde

1. PostgreSQL 17, normative Constraints/Migrationen und Programm-/Survey-Ownership unverändert schützen.
2. Nur vollständig synthetische, nachvollziehbar fiktive Daten in Testsystemen.
3. Keine versehentliche Erzeugung echter Zustimmung oder Vermischung von Demo- und Live-Kohorten.
4. Jeder neue UI-Anspruch muss durch Serverchecks und Negativtests gedeckt sein.
5. Kein stiller Schema-Redesign, kein `prisma db push`, kein destruktiver Seed, kein freier Internetbetrieb mit Demo-Auth.
6. Keine falschen Aussagen über Master-Referenzen, nachfolgende Positionen, Vollständigkeit oder bereits veröffentlichte Ergebnisse.
7. Abnahme nur anhand ausführbarer Reproduktion plus tatsächlicher Testnachweise und bekannter offener Kriterien.
