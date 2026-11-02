# D1.2 – Transaktionale Persistierung des synthetischen V5-Demo-Seeds

Stand: 1. November 2026. D1.2 nach ausdrücklicher Freigabe implementiert und
getestet. Keine weitere Deployment-/UI-Etappe begonnen.

## Geprüfter Arbeitsstand und Dateien

Branch unverändert `feat/v5-survey-demonstrator`, HEAD unverändert
`c0d0cbbce9b58d7dc5d55a1f805efb47971c2786`. Die unversionierten Nutzerdateien
und die sechs D1.1-Dateien waren beim Start vorhanden und blieben unverändert.
Kein Commit, Push oder Merge. Der Build änderte vorübergehend `next-env.d.ts`;
diese ausschließlich generierte Änderung wurde auf den Startinhalt zurückgeführt.

Geänderte versionierte Dateien:

- `src/lib/survey-service.ts`: vorhandene Statusänderung als kleinen
  Transaktionsbaustein extrahiert; bisherige öffentliche Funktion delegiert an
  denselben Baustein, mit unveränderten Sperren und Autorisierungsprüfungen.
- `package.json`: ausschließlich `test:demo-seed` ergänzt.

Neu angelegte D1.2-Dateien:

- `src/lib/demo-seed/persist.ts`: bewachter Persistierungseinstieg.
- `src/lib/demo-seed/reconcile.ts`: vollständiger Vergleich des eigenen Graphen.
- `src/lib/demo-seed/safety.ts`: expliziter Schutz des Datenbankziels.
- `src/lib/demo-seed/safety.test.ts`: zwölf datenbankfreie Zielschutztests.
- `tests/demo-seed/persist.test.ts`: 27 PostgreSQL-Integrationstests mit Corpus-Opt-in.
- `scripts/test-demo-seed.mjs`: ausschließlich eigener temporärer PG17-Testcontainer.
- `vitest.demo-seed.config.ts`: separate, explizite Integrationstestkonfiguration.
- `docs/testing/D1_2_DEMO_SEED_PERSISTENCE.md`: dieser Bericht.

Keine Änderungen an Prisma-Schema, Migrationen, Domainregeln, Analytics-Import,
UI oder Betreiber-Authentifizierung.

## Quellen und Sicherheitsgrenze

Grundlage bleiben `AGENTS.md`, das normative `MVP_DOMAIN_MODEL.md`, die
Requirements/UC-01, die relevanten UC-02-Status-/Isolationsregeln,
`V5_DEPLOYMENT_HANDOVER.md` und der
[D1.1-Bericht](D1_1_DEMO_SEED_PLANNER.md). Bestehende Survey-, Antwort- und
Importdienste sowie Schema/SQL wurden geprüft. Verwendete Referenzen:
Prisma-Client-Skill (Transaktionen, parametrisierte Raw Queries), Prisma-CLI-Skill
(versioniertes `migrate deploy`) und die installierte Next.js-Vitest-Anleitung.

Die Quellfreigabe und Provenienzgrenzen aus D1.1 bleiben unverändert. Insbesondere
ist ein SHA-256-Wert kein eigenständiger Herkunftsnachweis. Nur die zwei bereits
freigegebenen, bytegenau gepinnten synthetischen Quellen werden akzeptiert.

Der Persistierungseinstieg nimmt **keinen fertigen Plan und keinen fremden
Prisma-Client** entgegen. Er berechnet den D1.1-Plan erneut und erzeugt seinen
eigenen Client aus einer explizit übergebenen, geprüften URL. Keine Verwendung
einer impliziten `DATABASE_URL`, keine öffentliche Route und kein automatischer
Seed beim Serverstart.

Erlaubt sind ausschließlich `postgresql:`, die Loopback-Adresse `127.0.0.1`, ein
expliziter Port ab 1024, ein nichtleeres Passwort, die Rolle `careermap_v5_demo`
und die Datenbank `careermap_v5_demo` oder `careermap_v5_demo_test`. Query-/Hash-
Parameter, andere Datenbanken, andere Rollen und entfernte Hosts sind gesperrt.
Die tatsächliche Datenbank, Rolle und PostgreSQL-Hauptversion 17 werden innerhalb
der Transaktion erneut geprüft. Zusätzlich erforderlich:

- `purpose: "SYNTHETIC_DEMO_ONLY"`
- `catalogPolicy: "SEPARATE_LABELS_NO_CATEGORIES"`
- separat vertrauenswürdig konfigurierte `pilotProgramId` und `operatorScope`.

Die Eingabe muss dieselbe Pilot-ID verwenden. Die vorhandene Program-Zeile muss
existieren, `Management Sozialer Innovationen` heißen und zum Betreiber bzw.
zur konfigurierten Fakultät gehören. Kein Program oder Betreiber wird durch den
Seed neu erzeugt, umbenannt oder anhand eines Profillabels aufgelöst.

Unbekannte Datenbank-/Adapterfehler werden auf `DEMO_TRANSACTION_FAILED`
reduziert, ohne SQL-Payloads oder Verbindungsdaten weiterzureichen. Bekannte
Domainfehler mit festen Gründen bleiben nachvollziehbar.

## Transaktion und Wiederholbarkeit

1. Quelle und vollständigen fachlichen Plan vor dem Datenbankzugriff prüfen.
   Bei irgendeinem Planfehler keine Persistierung, auch kein gültiger Teilbatch.
2. Tatsächliches PG17-Ziel prüfen; transaktionale Advisory-Sperre für die
   reservierte Demo-Identität erwerben. READ COMMITTED sieht nach dem Warten
   den gegebenenfalls bereits vollständig committeten Gewinner.
3. Vorhandene Survey mit exakt reserviertem Namen prüfen. Mehrere Treffer oder
   ein abweichendes Programm führen zum Abbruch. Eine vorhandene Survey wird
   niemals geöffnet oder verändert.
4. Für eine neue Demo eine Survey als DRAFT erzeugen, mit vorhandener
   Program-Zeilensperre den Betreiberbezug prüfen und über denselben
   Statusdienst-Baustein OPEN setzen. Survey → Program → Alumni → Degree
   bleibt die Sperrreihenfolge.
5. Neue Alumni, Stationen und TimelineItems mit zufälligen Datenbank-UUIDs
   erzeugen. Nur geprüfte explizite synthetische Referenzauswahlen an
   `createConfirmedResponseInTransaction` übergeben. Dieser prüft Ownership,
   COMPLETED, Programm und doppelte Teilnahme erneut. Die Survey ist während
   sämtlicher Antwortanlagen nachweislich OPEN.
6. Über den Statusdienst CLOSED setzen, den vollständigen eigenen Graphen in
   derselben Transaktion zurücklesen und mit dem Plan vergleichen. Erst nach
   erfolgreichem Commit einen Beleg mit `syntheticOnly: true` zurückgeben.

Der gesamte Batch einschließlich Katalogen, Antworten und Statuswechseln liegt
in **einer** Transaktion. Ein Fehler nach der 100. Antwort oder sogar nach dem
CLOSED-Update entfernt durch Rollback sämtliche neu angelegten Datensätze.
Es gibt keine Fehler-Injektionsschnittstelle im Produktcode; die Tests ersetzen
gezielt die vorhandenen Service-Kompositionspunkte durch Vitest-Mocks.

Bei Wiederholung wird nur der Graph dieser Demo verglichen: Profilanzahl und
Multiplizität, jede Station einschließlich aller kanonischen Werte, Reihenfolge,
Katalogdaten, eigene Referenzzuordnung, bestätigte Antwort und CLOSED-Status.
Auch zusätzliche Stationen, Kontakte, weitere Survey-Zuordnungen eines
Demo-Alumni oder unzulässig geteilte neue Katalogidentitäten widersprechen dem
erwarteten Graphen. Technische Zeitpunkte und zufällige UUIDs werden nicht als
fachliche Identität verwendet. Ein identischer Retry schreibt **nichts**, auch
keine neuen Zeitpunkte. Drift liefert `DEMO_DATASET_MISMATCH`, ohne Reparatur,
Reset, Upsert oder Profilzusammenführung.

Die Idempotenz benötigt keine neue Tabelle, keine Providerkennungen und keinen
persistierten Fixture-Schlüssel. Ihre Grenze ist die reservierte Survey und
deren vollständiger Graph: Eine manuelle vollständige Entfernung dieser
Identität ist ohne operatives Ledger nicht historisch nachweisbar.

## Explizite Behandlung der Kataloge und Testbestätigungen

Die Pflichtentscheidung aus D1.1 wird durch die zusätzliche Katalog-Policy
sichtbar getroffen: Pro nichtleerem Anbieterlabel einer zusätzlichen Degree-
Station eine neue Institution; pro entsprechender CareerStep-Station eine neue
Organisation. Gleiche Namen werden niemals automatisch zusammengeführt.
Fehlende Anbieter bleiben NULL. Der Referenz-Degree verwendet ausschließlich
das bestehende MSI-Program und keine redundante direkte Institution.

Berufliche Ortsbeobachtungen werden nach `CareerStep.location` übernommen.
Die bereits in D1.1 ausgewiesenen Companion-Kategoriehinweise bleiben bewusst
außerhalb der kanonischen Fachrichtungs-/Branchen-/Jobfelder. Keine stillen
Synonyme, keine künstlichen Unknown-Kataloge und keine erfundenen Abschlussjahre.

Es werden keine Kontakte, Rohprofile, Provider-IDs, Tokens, Beschreibungen oder
planinternen Schlüssel gespeichert. `response.referenceProgramId` ist weiterhin
nur ein Prüfbeleg des Plans und wird nicht als Datenbankspalte behandelt.

Der bestehende Antwortdienst erzeugt technisch `confirmedAt`. Dieses Datum ist
im dedizierten, als `SYNTHETISCH / DEMO – Alumni MSI` bezeichneten Survey eine
**synthetische Testbestätigung, keine Einwilligung eines realen Alumni**. Die
explizite Quellfreigabe, Demo-Zieldatenbank und Zweckdeklaration bleiben daher
Voraussetzungen. Kein Zugang zu produktiven Analysen wurde ergänzt.

## Tatsächlich ausgeführtes RED/GREEN und Regression

Node 22.23.3; lokale Logs unter `/tmp/d12-*.log`.

| Lauf | Tatsächliches Ergebnis |
|---|---|
| RED Zielschutz | 12 Tests fehlgeschlagen, `D1.2_NOT_IMPLEMENTED` |
| RED PostgreSQL | 14 fehlgeschlagen, 10 bestanden; die Persistierung fehlte. Die zehn generischen Ablehnungsprüfungen waren allein noch kein Implementierungsnachweis. |
| Erster GREEN-Lauf | 12 Zielschutztests und 25 Integrationstests bestanden, einschließlich 100er-Bestand |
| Ergänzte Rücklese-/100er-Rollbackprüfung und Refactor | **27 Integrationstests bestanden**, kein übersprungener D1.2-Test bei `--corpus` |
| Gesamte Unit-Regression mit lokalem Corpus-Opt-in | **56 Dateien / 1.010 Tests bestanden** |
| Bestehende Integrationstest-Suite | **12 Dateien / 376 bestanden, 1 übersprungen** |
| Lint | bestanden |
| Typecheck einschließlich Prisma-Client-Generierung | bestanden |
| `prisma validate` | bestanden |
| Produktionsbuild | bestanden |

Der übersprungene bestehende Test ist der optionale 100er-Roundtrip in
`tests/integration/career-import-service.test.ts`; dessen eigenes
`CAREERMAP_PHASE_D_FIXTURES=1` war beim normalen Integrationsregressionslauf
nicht gesetzt. Der neue 100er-Persistierungs- und 100er-Rollbacktest sowie die
D1.1-Corpus-Prüfung wurden dagegen ausdrücklich ausgeführt. In beiden PG-Suiten
erschien dieselbe pg-DeprecationWarning zu überlappenden `client.query()`-
Aufrufen; sie verursachte keinen Testfehler. Kein Treiber oder Adapter geändert.

Die 27 D1.2-Integrationstests decken unter anderem ab:

- korrekt geschlossene Demo, vollständige Timeline und Referenzpaare;
- unveränderte IDs und Zeitpunkte beim Retry über eine frische Verbindung;
- parallele Seeds: genau einmal CREATED, einmal UNCHANGED;
- Rollback bei falschem Owner, Status, Programm und doppelter Antwort;
- Rollback nach Antwortanlage, nach CLOSED und nach verfälschter Rücklesung;
- Quellfehler, fehlende Auswahl, falscher Zweck und falsche Katalog-Policy;
- fehlendes/falsches MSI-Program sowie falsche Institution/Fakultät;
- Abbruch bei veränderten Stationen, Katalogen, Antworten oder Survey-Status;
- Ablehnung mehrdeutiger reservierter Survey-Identität;
- unveränderte unabhängige Master-Survey einschließlich Profil und Antwort;
- serverseitige CLOSED-Sperre durch den bestehenden Antwortdienst;
- vollständiger 100er-Seed, unveränderter Retry und Rollback nach Antwort 100.

## Exakt nachgewiesener 100er-Bestand

| Persistierte Entität / fachlicher Fall | Anzahl |
|---|---:|
| Neue CLOSED-Demo-Survey | 1 |
| Alumni | **100** |
| Degrees | **172** |
| CareerSteps | **260** |
| AlumniTimelineItems | **432** |
| Eigene COMPLETED-MSI-Referenzen / SurveyResponses | **100 / 100** |
| Berufsausbildungen / Auslandssemester als CareerSteps | **13 / 10** |
| AlumniContacts | **0** |

Quellinventar weiterhin 195 EDUCATION und 237 POSITION. Keine ausgeschlossenen
Profile und keine künstlichen Ersatzdaten. Der zweite Lauf erzeugt keine
weiteren Zeilen und verändert keine vorhandene Zeile. Beim absichtlich nach der
100. Antwort ausgelösten Fehler bleibt die Datenbank exakt auf dem Stand vor
dem Seed, einschließlich Katalogen und Surveys.

## Reproduktion und aktueller Betriebszustand

Mit Node 22.23.3 im PATH und verfügbarem Docker:

```sh
npm run test:demo-seed -- --corpus
CAREERMAP_PHASE_D_FIXTURES=1 npm test
npm run test:integration
npm run lint
npm run typecheck
npm run db:validate
npm run build
```

Der erste Befehl erzeugt immer einen neuen, ausschließlich an Loopback
gebundenen PG17-Container mit zufälligem Namen/Port/Passwort, wendet nur die fünf
vorhandenen versionierten Migrationen an und entfernt ausschließlich diesen
Testcontainer nach Abschluss. Er verwendet niemals eine vorhandene DB-URL oder
ein bestehendes Volume. Ohne `--corpus` sind die zwei lokalen 100er-Tests opt-in
übersprungen. Die Testdateien verweigern den Start ohne die spezielle Test-URL.

Die Bibliotheksverwendung für eine spätere ausdrücklich bereitgestellte Demo
ist konkret:

```ts
await persistV5DemoSeed(
  { policy: "v5-demo-phase-d-100-v1", sourceText, expectedText,
    referenceProgramId: trustedMsiProgramId, selections: reviewedSyntheticSelections },
  { databaseUrl: explicitDedicatedDemoUrl, pilotProgramId: trustedMsiProgramId,
    operatorScope: trustedOperatorScope, purpose: "SYNTHETIC_DEMO_ONLY",
    catalogPolicy: "SEPARATE_LABELS_NO_CATEGORIES" },
);
```

In dieser Etappe wurden ausschließlich neu erzeugte Testdatenbanken beschrieben.
Die vor und nach der Arbeit laufenden Container `careermap-analytics-db-1` und
`careermap-workflow-db-1` wurden nicht als Seedziele verwendet und liefen
anschließend weiter. Alle eigenen Testcontainer wurden entfernt. Es existiert
deshalb aus D1.2 **kein dauerhaft gestartetes Demo-Deployment**.

Nicht ausgeführt: Playwright, Produktionsserver-/Container-Neustart,
Volume-Persistenz, Backup/Restore oder öffentliche Bereitstellung. Diese Etappe
beweist die transaktionale Bibliothek und Wiederholung über neue Verbindungen,
keine Deployment-Abnahme. Ein persistenter lokaler Demo-Betrieb mit expliziten
Ziel-/Volume-/Neustartprüfungen bleibt ein eigener nächster Auftrag. Keine
weitergehende Etappe wurde begonnen.
