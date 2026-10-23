# V2 – Synthetische Karriereanalyse (jahresgenauer Prototyp)

Stand: 2026-10-23. Ausgangspunkt `main`, `47060aa` (persistent import/review
workflow). Keine Commits oder Pushes. Das normative MVP Domain Model, Prisma-
Schema, alle fünf Migrationen und die bestehenden Normalisierungs-/Review-
Verträge bleiben unverändert. Die Jahresprojektion wurde im Auftrag ausdrücklich
gewählt. Dies ist keine produktiv freigegebene Alumni-Auswertung.

## Einrichtung und Betrieb

Voraussetzungen: Node 22.23.3, Docker, PostgreSQL-17-Image, installierte Chromium-
Browser für Playwright. Die optionalen lokalen Dateien bleiben ausschließlich in
`.local-fixtures/phase-d/`; CI benötigt sie nicht.

```bash
npm ci
npm run db:generate
npm run analytics -- setup
npm run analytics -- dry-run --test-policy phase-d-v1 --declare-demo-anchors
npm run analytics -- import --test-policy phase-d-v1 --declare-demo-anchors
npm run analytics -- report
npm run analytics -- dev
```

Danach: <http://127.0.0.1:3106/dev/analytics>. Der Server bindet ausschließlich
Loopback. Strg+C beendet den Server, die Demo bleibt im eigenen Docker-Volume.
`compose.analytics.yaml` nutzt Port 5434, Datenbank `careermap_analytics_demo`,
Rolle `careermap_analytics` und ein eigenes Volume `analytics_data` im Compose-
Projekt `careermap-analytics`. Die bestehende Workflow-Datenbank auf Port 5433
wird nicht verwendet oder verändert.

`setup` erstellt ausschließlich die separate, gitignorierte Datei
`.env.analytics.local` mit zufälligem Passwort und Modus 0600. Bestehende
`.env.local` und `DATABASE_URL` werden nicht als Analytics-Ziel verwendet.
Ein expliziter `--database`-Parameter ist für Import/Report/Reset möglich; nur
die dedizierte lokale Datenbank und Rolle werden akzeptiert. Niemals echte
Karrieredaten in diese ausschließlich synthetische Datenbank schreiben.

Bewusster Reset (hier dokumentiert, am importierten 100er-Bestand nicht ausgeführt):

```bash
npm run analytics -- reset --confirm-reset careermap_analytics_demo
```

Das leert nur die kanonischen Tabellen der ausdrücklich ausgewählten Demo;
Schema, Migrationen und Volume bleiben erhalten. URL-Prüfung, tatsächlicher
Datenbankname, aktuelle Rolle und PostgreSQL-Hauptversion müssen passen. Schon
ein Survey, Kontakt oder fremdes Program sperrt den Vorgang. Es gibt keinen
automatischen Reset und kein `prisma db push`, `migrate reset` oder DROP DATABASE
im Bedienwerkzeug. Das Löschen anderer Datenbanken wird nicht angeboten.

Protokolle ohne Rohdaten/Quellkennungen lassen sich beispielsweise so sichern:

```bash
mkdir -p artifacts/v2
node --import tsx scripts/analytics.ts dry-run --test-policy phase-d-v1 --declare-demo-anchors > artifacts/v2/dry-run.json
node --import tsx scripts/analytics.ts report > artifacts/v2/database-report.json
```

## Drei vertikale Inkremente und betroffene Dateien

1. V2.1: `src/lib/analytics/prepare.ts`, `safety.ts`, `store.ts`,
   `scripts/analytics.ts`, `compose.analytics.yaml`. Neue minimale Fixtures in
   `test-corpus.ts`, Unit-Tests in `import.test.ts`, echte PostgreSQL-Tests in
   `tests/integration/analytics.test.ts`. Die neuen Tests wurden zunächst ohne
   Implementierung ausgeführt (RED), anschließend grün gemacht. Ein beim echten
   Datenbanktest aufgedeckter Prisma-Fehler bei der Rückgabe eines `void`-Wertes
   aus dem Advisory Lock wurde durch einen expliziten SQL-Textcast behoben.
2. V2.2: `records.ts`, `read.ts`, `client.ts`, `access.ts`,
   `src/app/dev/analytics/page.tsx`, `dashboard.tsx`, `analytics.module.css`.
   Erweiterung des bestehenden `src/proxy.ts`; kein neues Auth-System. RED für
   Auswahl/Timeline vor Erstellung des Dashboards. Datenbanktests prüfen leeren
   Bestand, Zählwerte, Kataloge, Standort und Timeline-Reihenfolge; Interaktions-
   und Zugriffstests prüfen Auswahl, vollständige Details und Entwicklungsgrenze.
3. V2.3: `aggregate.ts` / `aggregate.test.ts`, `sankey.tsx`, Playwright-Konfigurationen
   und Tests `e2e-analytics` / `e2e-analytics-local`. RED vor Erstellung der reinen
   Aggregationsfunktion. Schlankes Layout mit
   [d3-sankey](https://github.com/d3/d3-sankey), React rendert SVG und Interaktion.
   `tsx` ist nur der TypeScript-Runner für lokale Skripte, keine Produktabhängigkeit.

`next.config.ts`, `.gitignore`, `eslint.config.mjs` und `tsconfig.json` berücksichtigen
die separaten generierten Next-Verzeichnisse `.next-analytics` und
`.next-analytics-e2e`. Der normale `test:e2e`-Befehl enthält jetzt auch die neue,
vom lokalen Korpus unabhängige Analytics-Suite. Produktionsschutz wird
zusätzlich in den bestehenden Review-E2E-Tests geprüft – auch bei versehentlich
gesetztem Analytics-Flag. Die neue Analytics-Seite ist dynamisch, liest ohne Cache
und wird in Produktion vor dem Rendering mit 404 abgewiesen. Die Server-Komponente
prüft die Grenze nochmals vor jeder Datenbankabfrage. Forwarded-/Cross-Origin-
Angaben eröffnen keinen Zugriff. Die Rohdateien bleiben vom Standalone-Tracing
ausgeschlossen.

## Datenfluss und synthetische Testdeklarationen

```text
lokaler Snapshot + Companion-Datei
  -> vorhandener struktureller Audit und Allowlist-Projektion (PROFILE bleibt opak)
  -> explizit gewählte synthetische Testpolicy phase-d-v1
  -> vorhandener Snapshot-Adapter und normalizeCareerBatch
  -> geprüfter Schreibplan und numerischer Abdeckungsbericht
  -> eine PostgreSQL-Transaktion: Alumni, Kataloge, Degrees/CareerSteps, TimelineItems
  -> allowlist-basierte PostgreSQL-Rücklesung in einem konsistenten Snapshot
  -> reine Sieben-Stufen-Aggregation
  -> read-only Alumni-Liste, vollständige Timeline und interaktives SVG-Sankey
```

Die Companion-Datei ist ein Zwischenoracle: eindeutige Stationskorrelation über
Domäne/Titel/Anbieter, Datum und Genauigkeit werden gegen die Snapshot-Beobachtungen
geprüft. Es werden keine Companion-Objekte als Datenbankzeilen übernommen. Jede
Quelle wird genau einer normalisierten Station und einem TimelineItem zugeordnet.
Bei Mehrdeutigkeit wird das ganze Profil ausgeschlossen und seine laufende
Eingabenummer mit festem Fehlercode protokolliert. Keine stillen Teilprofile.

`--test-policy phase-d-v1` bedeutet **zusätzliche, neu definierte synthetische
Testannahmen**, ausdrücklich keinen Nachweis durch LinkedIn oder durch Alumni:

- Die deklarierte Qualifikations-/Beschäftigungsart und `chronologyIndex` dürfen
  für diesen Testbestand als Klassifikation und Reihenfolge verwendet werden.
  Einfache, bekannte Vokabularwerte werden umgesetzt; andere Werte sperren das
  Profil. Die zehn exakt bezeichneten Auslandssemester werden ausdrücklich als
  `CareerStep/EDUCATION` deklariert, die 13 Berufsausbildungen als
  `VOCATIONAL_TRAINING`; kein künstlicher OTHER-Degree wird erzeugt.
- Geschlossene akademische Testphasen werden zusätzlich als abgeschlossen
  deklariert; aktuelle akademische Fälle als `IN_PROGRESS`. Das ist eine neue
  Testfalldefinition, **keine Schlussfolgerung aus dem Ende der Teilnahme**.
  Berufliche Testphasen werden entsprechend ENDED/ONGOING deklariert. Fehlen
  die benötigten Fakten, bleibt UNKNOWN erhalten. Widersprüche sperren ein
  Profil. Kein Abschlussjahr wird aus einem Endjahr erzeugt.
- Die bekannte Kategorie-Liste wird als zusätzliche synthetische Kategorisierung
  akzeptiert. Es werden weder Synonyme erfunden noch „Technik & Information“ und
  „IT & Technologie“ stillschweigend gleichgesetzt. Branchen werden nur an dem
  für diese Station neu angelegten Organisationseintrag gespeichert. Gleiche
  Namen führen nicht zum automatischen Zusammenführen von Katalogidentitäten.
- Die importierten Testfälle werden für diese Demo ausdrücklich als vollständige
  synthetische Karrierefälle deklariert. Diese Annahme erlaubt ausgewiesene
  Abwesenheitskategorien. Sie folgt nicht aus der bloßen Abwesenheit eines
  LinkedIn-Eintrags und ist auf echte Profile nicht übertragbar.
- Erst **zusätzlich** mit `--declare-demo-anchors` wird der im Testfall bezeichnete
  eigene, abgeschlossene Bachelor dem separaten synthetischen MSI-Program
  zugeordnet. Die neue Testdeklaration legt alle damit verknüpften Degrees als
  Demoanker fest. Der Program-Name trägt die ausdrückliche Kennzeichnung
  `SYNTHETIC DEMO phase-d-v1`; die Institution ist ebenfalls als synthetischer
  Katalogkontext bezeichnet. Das ersetzt keine Bestätigung einer Teilnahme.

Die kanonischen Program-Verknüpfungen stellen somit die explizite Testzuordnung
bereit. Die ausschließlich lokale Demo interpretiert sie unter dieser
Testpolicy; es gibt keine globale Referenzspalte, keine zusätzliche Referenztabelle
und keinen zweiten Karriere-Datenspeicher. **Kein Survey, keine SurveyResponse,
kein confirmedAt und kein AlumniContact werden angelegt.** Ohne gesonderte
Demoanker-Deklaration bleiben alle Profile für das Sankey ausgeschlossen. Eine
Umstellung der Policy/des Bestands erfordert eine frische Demo oder den bewussten
Reset; es gibt kein automatisches Umdeuten gespeicherter Daten.

Alumni und alle Stationen/Kataloge erhalten zufällige Datenbank-UUIDs. Quell- und
synthetische IDs dienen nur der flüchtigen Korrelation, nie als Primärschlüssel
oder dauerhafte Identitätszuordnung. Namen, E-Mail, Profil-/Providerkennungen,
PROFILE, Beschreibungen/Notizen und Rohprofile werden weder gespeichert noch
protokolliert. Titel/Anbieter/Orte stammen nur aus den erlaubten Karrierefeldern.

## Wiederholbarkeit und Importqualität

Der vollständige akzeptierte Batch wird unter einem transaktionalen PostgreSQL-
Advisory Lock importiert. Bei einem Datenbankfehler werden Profile, Stationen,
Timeline und Kataloge gemeinsam zurückgerollt. Ein Dry-Run validiert und zählt,
schreibt aber nichts.

Idempotenz ist bewusst **Batch-bezogen**, ohne providerbasierte Identitäts-
zuordnung: vorhandene kanonische Profile werden vollständig, einschließlich
Reihenfolge, Kategorien, Status und Katalogbezeichnungen, mit dem Schreibplan
verglichen; zufällige IDs bleiben beim Vergleich außen vor. Ein identischer
Batch wird übersprungen. Andere Inhalte in einer nichtleeren Demo führen zu
`NONEMPTY_DIFFERENT_DATASET`. Kein inkrementelles Upsert, kein Personenmatching
und kein automatisches Löschen. Gleichnamige Personen oder Karrierewege werden
nicht dedupliziert; zwei gleiche synthetische Profile innerhalb eines Batches
bleiben zwei Personen.

Tatsächlich ausgeführt gegen die lokale PostgreSQL-17-Demo:

| Kennzahl | Ergebnis |
|---|---:|
| Eingelesene / importierte Profile | 100 / 100 |
| Bildungsangaben / berufliche Quellstationen | 195 / 237 |
| Akademische Degrees | 172 |
| CareerSteps | 260 |
| TimelineItems | 432 |
| Ausgeschlossene Profile / Stationen | 0 / 0 |
| Explizit deklarierte synthetische Demoanker | 100 |
| Neue synthetische Statusdeklarationen | 432 |
| Auf Jahre reduzierte Monatsangaben | 369 |
| Bildungs-Fachrichtungen ohne kanonisches Zielfeld | 23 |
| Unbekannte Quellkategorien außerhalb des akzeptierten Vokabulars | 0 |
| Stationen mit ungeklärten zeitlichen Eckdaten nach Testdeklaration | 0 |
| Wiederholung: neu importiert / übersprungen | 0 / 100 |

Fehlerkategorien im Bericht: `AMBIGUOUS_CLASSIFICATION`, `AMBIGUOUS_CORRELATION`,
`ORACLE_MISMATCH`, `CONFLICTING_STATUS`, `INCOMPLETE_MAPPING`,
`UNRESOLVED_STATION`, `INVALID_DEMO_ANCHOR`, sonst `INVALID_PROFILE`.
Ein strukturell ungültiges Gesamtpaar wird vor jedem Schreiben abgewiesen.

Bewusste Informationsgrenzen: kanonische Jahre statt Monate; kein
Graduationsnachweis aus Anwesenheitsende; kein Zielfeld für die Fachrichtung
von Ausbildung/Austausch (23 Kategorien werden deshalb nicht in functionArea
oder andere sachfremde Felder geschrieben). Die 23 Stationen selbst, Titel,
Anbieter und Jahre bleiben erhalten. Die Rohdateien bleiben lokal unverändert
für spätere fachliche Nachprüfung. Intermediäre Aliasbezeichnungen,
Beschreibungen, Relativlabels und Herkunftsmetadaten sind keine kanonischen
Notizfelder. Die Zuordnung der Demoanker verwendet den ausdrücklich deklarierten
synthetischen HM/MSI-Katalogkontext statt einer automatischen Namensauflösung.

## Fachliche Aggregation

`aggregateCareers` ist eine reine TypeScript-Funktion ohne Datenbankzugriff und
ohne React. Die UI enthält keine eigenen Auswahl-/Zeitregeln.

Sieben feste Stufen: Ausbildung vor MSI (Fachrichtung), Tätigkeit vor MSI
(Branche und Jobkategorie), BA MSI, Master nach MSI (Fachrichtung), Tätigkeit nach
MSI (Branche und Jobkategorie).

- Genau ein eigener, abgeschlossener Bachelor-Demoanker mit bekannten Start- und
  Endjahren ist erforderlich. Fehlende/mehrdeutige/unzulässige Anker oder ungültige
  Timeline-Positionen sperren das Profil mit nachvollziehbarem Grund.
- Vor MSI verlangt `endYear < anchor.startYear` und eine Position vor dem Anker.
  Nach MSI verlangt `startYear > anchor.endYear` und eine Position nach dem Anker.
  Eindeutig innerhalb liegende Stationen bleiben in der vollständigen Timeline;
  sie sind keine Vor-/Nach-MSI-Stationen dieser festen Ansicht.
- Gleiche Grenzjahre, fehlende Daten, Überschneidungen und Widersprüche zwischen
  Jahren und Positionen ergeben „Zeitlich ungeklärt“, statt ein Vorher/Nachher zu
  behaupten. Die betroffenen Stufen werden konservativ als ungeklärt dargestellt;
  andere gesicherte Stationen werden dadurch nicht aus der Datenbank entfernt.
- Mehrere Stationen einer Stufe bilden eine sortierte Menge ihrer Kategorien.
  Mehrere verschiedene Werte heißen ausdrücklich „Kombination: …“. Alle Personen
  haben pro Stufe nur einen Knoten; es gibt keine Kreuzprodukte von Stationen.
  Bekannte und unbekannte Kategorien können gemeinsam in einer Kombination stehen.
- Fehlen Stationen, folgt nur bei einem ausdrücklich vollständigen Testfall
  „Nicht vorhanden“ bzw. „Kein Master (Testfall vollständig)“. Sonst „Unbekannt“.
  Ein vorhandener Master mit laufendem/unbekanntem Abschlussstatus bleibt eine
  Studienphase. Master vor/während MSI werden nicht als fehlender Master bezeichnet.
- Jeder eingeschlossene Alumni zählt genau **einmal je benachbarter Stufengrenze**.
  Dies sind gemeinsame Personenmerkmale, keine behaupteten Übergänge zwischen
  Einzelstationen. Alle sechs Grenzen müssen dieselbe Personensumme ergeben;
  innere Knoten haben gleiche Zu- und Abflusssummen. Stationsanzahl ist davon getrennt.

Für den lokalen Bestand ergeben sich **100 eingeschlossene Pfade, 72 vollständig
zuordenbare und 28 teilweise ungeklärte Pfade**, 0 Ausschlüsse und exakt **600
Übergangsbeiträge** (100 pro Grenze). 15 Stationen haben eine ungeklärte
Ankerrelation, 35 liegen eindeutig innerhalb des MSI-Studiums. Jahresgrenzen und
die 13 vor MSI liegenden Berufsausbildungen mit nicht darstellbarer Fachrichtung
erklären die teilweise ungeklärten Pfade; diese Kategorien dürfen sich pro Profil
überschneiden. Ungeklärte Ankerrelation ist etwas anderes als fehlende Eckdaten.

Fachliche Produktentscheidung bleibt offen: Eine spätere Ansicht könnte je Stufe
eine einzelne repräsentative Station auswählen (z.B. erste oder letzte Tätigkeit).
Das ergäbe andere Kategorienverteilungen. Der Prototyp verwendet die ausdrücklich
vorab erläuterte Kombination; er legt keine solche Auswahlregel für das Produkt fest.

## Testnachweise und manuelle Abnahme

Alle neuen CI-Tests nutzen neu verfasste Minimalfixtures; kein Phase-D-Rohprofil
wurde ins Repository kopiert. RED -> GREEN ist separat für Import, Dashboard und
Aggregation durchgeführt. Die Aggregationstests prüfen einfachen Pfad, mehrere
Stationen, unbekannten Masterstatus, deklarierte/nicht deklarierte Abwesenheit,
Unklarheiten, Überlappungen, identische/unterschiedliche Kategorien, Summen und
Ankerausschlüsse. PostgreSQL-Tests prüfen zudem Wiederholung, Rollback, Dry-Run,
falsche Datenbank/Resetbestätigung, Kontakte/Antworten und vollständige Rücklesung.

Ausgeführt:

| Prüfung | Ergebnis |
|---|---|
| `npm run lint` | bestanden; generierte `.next-analytics`-Dateien sind explizit ausgeschlossen |
| `npm test` | 903 bestanden, 1 optionaler lokaler Korpustest übersprungen |
| `npm run db:validate` | bestanden |
| `npm run test:integration` | 371 bestanden, 1 optionaler lokaler Alttest übersprungen |
| `npm run typecheck` | bestanden |
| `npm run build` | bestanden; Analytics ist dynamisch |
| `npm run test:e2e:analytics` | 4 bestanden: Desktop/schmal, 20 DB-Profile, Auswahl, Hover/Fokus, Fluss, Zugriffssperre |
| `npm run test:e2e:analytics:local` | 1 bestanden: alle 100 Profile und 432 Timeline-Stationen, 600 Übergangsbeiträge, mobile Breite |
| `npx playwright test` | 4 bestanden: bestehende Review-Demo und Produktionssperren, Desktop/schmal |
| `npm run test:e2e:import` | 30 bestanden: bestehender synthetischer Import-/Review-Flow |
| `npm run test:e2e:workflow` | 2 bestanden: bestehender kompletter persistenter Workflow, Desktop/schmal |
| `git diff --check` | bestanden |

Die bisherigen optionalen Korpustests wurden nicht als bestanden ausgegeben.
Der neue 100er-Durchlauf wurde stattdessen ausdrücklich per CLI und Browser gegen
die isolierte Analytics-Demo ausgeführt. OAuth- und separate Mapping-Browsersuiten
wurden in diesem Auftrag nicht separat ausgeführt. Initiale Sandbox-Sperren bei
Netzwerk/Browser/Serverstart wurden mit erteilten Ausführungsfreigaben erneut
ausgeführt; die oben angegebenen Ergebnisse stammen aus den erfolgreichen Läufen.

Manuelle Abnahme:

1. `npm run analytics -- dev`, lokale URL öffnen; Kennzahlen 100/172/260/432/100/28 prüfen.
2. In der Liste mehrere Profile wählen; Anzahl und Reihenfolge aller Stationen,
   Organisationen, Titel, Status, Jahre und synthetischen Demoanker kontrollieren.
3. Das Diagramm horizontal bis Stufe 7 scrollen, Kategorien/Verbindungen berühren
   oder per Tab fokussieren. Tooltip und Personenanzahl prüfen; Klick hält den
   zusammenhängenden Personenfluss fest. Über Auswahlmenü einen ganzen Pfad
   hervorheben und anschließend „Auswahl aufheben“ verwenden.
4. Kombinationen, gelbe unbekannte/ungeklärte Angaben und graue Abwesenheiten
   unterscheiden; Erläuterung unter dem Diagramm öffnen. 100 Personen pro Grenze
   und 600 Beiträge über alle sechs Grenzen kontrollieren.
5. Auf schmaler Breite müssen Liste/Diagramm innerhalb ihrer Container scrollen.
6. Import erneut ausführen: 0 neu / 100 übersprungen. Ohne Opt-in, mit fremdem Host
   und in Produktion darf Analytics keine Karriereinformationen ausliefern.

Screenshots liegen nur lokal unter `artifacts/v2/` (Desktop/schmal und 100er-Bestand).
Es erfolgte keine Veröffentlichung oder produktive Freigabe. Datenbank und Server
für die manuelle Abnahme bleiben lokal; echte Befragungen verwenden weiterhin
ausschließlich ausdrücklich bestätigte SurveyResponses.
