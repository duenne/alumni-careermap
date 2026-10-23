# V1c – JSON auf das Datenbankschema abbilden

Stand: 23.10.2026. Lokaler vertikaler Zwischentest, ausdrücklich für JSON-Mapping
und Einspeisung in eine isolierte Testdatenbank angefordert. Das normative
[MVP Domain Model](../architecture/MVP_DOMAIN_MODEL.md) bleibt unverändert;
Schema, SQL-Constraints und die fünf versionierten Migrationen bleiben erhalten.
Keine Commits oder Pushes.

## Start und manuelle Prüfung

```sh
nvm use
npm run dev:mapping
```

Öffnen: **http://localhost:3104/dev/mapping**. Docker muss laufen. Der Runner
erzeugt einen neuen PostgreSQL-17-Container mit zufälligem Passwort und Port,
spielt `prisma migrate deploy` ein und startet einen eigenen Next.js-Dev-Server.
Er verwendet weder die vorhandene `DATABASE_URL` noch ein bestehendes Volume.
Die Datenbank heißt `careermap_mapping_test`; API und Client verlangen zusätzlich
den expliziten Mapping-Schalter, Loopback und Entwicklungsmodus. Der Schreibaufruf
braucht eine passende Origin. Produktion weist Oberfläche und API mit 404 ab.

1. **Beispiel laden** lädt die bekannte Repository-Fixture. Wenn die beiden
   Dateien in `.local-fixtures/phase-d/` verfügbar und strukturell gültig sind,
   stehen außerdem alle 100 Beispiele im Auswahlfeld bereit. Es werden nur
   erlaubte Karrierefelder geliefert, keine PROFILE-Daten oder Original-IDs.
2. Alternativ das kombinierte Snapshot-JSON oder die bisherige rohe
   LinkedIn-Vorschau in den Editor einfügen und **JSON zuordnen** wählen.
   Die konkrete Rohvorschau mit gültigen ersten Seiten und anschließender
   No-data-404 bei beiden zusätzlichen Probe-Abfragen wird unterstützt.
   `PREVIEW_LIMIT`, unbekannte Fehler und fehlende Domänen werden abgewiesen.
   Die alte Rohvorschau selbst bleibt eine begrenzte Diagnose mit `complete:false`.
3. Pro Station Zieltyp, Status, Reihenfolge und Katalogzuordnung prüfen.
   Unklare akademische Angaben und Kurse erfordern eine manuelle Typauswahl.
   **Unbekannt** bleibt ein erlaubter Status. Bei UNKNOWN wird ein beobachtetes
   Ende entsprechend dem bestehenden Normalisierungsvertrag nicht gespeichert;
   für bekannte beendete Tätigkeiten **Beendet** wählen.
4. Beim konkreten Referenzabschluss **Abgeschlossen** und den Studiengang der
   Testbefragung auswählen. Zusätzliche Degrees können ohne Katalogzuordnung
   bleiben. Ein Institutionsname allein erfüllt keine Program-Passung.
5. **Kanonische Datenbankvorschau anzeigen** öffnen. Bekannte Jahre, NULL-Werte,
   Stationstypen und Reihenfolge prüfen. Semester-/Monatspräzision wird nicht als
   Datum gespeichert. Das Abschlussjahr wird nicht aus dem Studienende erfunden.
6. Unter **Konkreter Referenzabschluss** selbst wählen; auch ein einzelner
   Kandidat bleibt zunächst ungewählt. Referenzauswahl und Beitrag bestätigen.
7. **In Testdatenbank speichern** erzeugt Alumni, Degrees, CareerSteps,
   AlumniTimelineItems und SurveyResponse in einer Transaktion. Die Erfolgsmeldung
   mit Anzahlen und zufälliger Profil-ID erscheint nach dem Commit. Es wird kein
   AlumniContact angelegt. Ein Fehler rollt das gesamte Profil und neu angelegte
   Katalogeinträge zurück.
8. JSON bearbeiten oder neu laden: sämtliche Review- und Referenzentscheidungen
   werden verworfen. Reload stellt den Browserentwurf nicht wieder her; die
   gespeicherten Testprofile bleiben bis zum Stoppen des Servers in PostgreSQL.
9. **Strg+C** im Runner beendet den Server und entfernt Container und Testdaten.

Die voreingestellte Institution und der Studiengang sind ausdrücklich synthetisch.
Für einen eigenen fachlich passenden Referenzkontext kann der lokale Betreiber
den Runner mit benannten Katalogen starten:

```sh
npm run dev:mapping -- --institution 'Beispielhochschule' --program 'Beispielstudiengang'
```

Diese Startparameter sind separate Betreiberkonfiguration. Sie werden nicht aus
dem Alumni-JSON oder einem Quellanker ermittelt. Einen echten Abschluss nur einem
tatsächlich passenden Studiengang zuordnen. Die LinkedIn-Vorschau auf Port 3100
bleibt getrennt; es gibt keinen automatischen Transfer oder erneuten Providerabruf.

## Mapping und verbleibende Ungewissheit

| Eingabe | Datenbankziel und Regel |
| --- | --- |
| EDUCATION / POSITIONS im kombinierten Snapshot oder vollständig erfasste Rohseiten | Gemeinsame allowlistbasierte Eingabe; feste Domänenreihenfolge für lokale Stationsschlüssel, keine Provider-IDs |
| Degree Name / Title | Getrimmter, NFC-normalisierter Degree.title / CareerStep.roleTitle |
| Typvorschlag oder Phase-D-Level | Erst nach Review ASSERTED; akademisch → Degree, VOCATIONAL → VOCATIONAL_TRAINING, Kurs/Austausch → EDUCATION |
| EMPLOYED / SELF_EMPLOYED / VOLUNTEER / INTERNSHIP | Bearbeitbare Vorschläge EMPLOYMENT / SELF_EMPLOYMENT / VOLUNTEERING / INTERNSHIP |
| Start Date / End Date / Started On / Finished On | Vorhandener Datumsadapter; präzise Jahre → startYear/endYear, fehlende/unpräzise Angaben → NULL; Statuskonflikte verhindern die Übernahme |
| Abschlussstatus | Explizite Review-Angabe; aus Jahr, Titel oder `isCurrent:false` folgt kein COMPLETED |
| Abschlussjahr | NULL; die Quellen liefern keinen unabhängigen Nachweis für graduationYear |
| Location einer Tätigkeit | Eigene allowlistbasierte Beobachtung → CareerStep.location; identisch in Vorschau und Schreibplan |
| School Name / Company Name / organisationRaw | Label zur Prüfung, keine Identität; bestätigte bestehende ID oder ausdrücklich neuer Institution-/Organisation-Eintrag, ansonsten NULL |
| Vorhandenes Program | Bestätigte ID, Program/direct Institution XOR bleibt bestehen; Referenz muss zum Survey passen |
| chronologyIndex | Bearbeitbarer Reihenfolgevorschlag; eindeutig positiv, Lücken und Überlappungen bleiben erlaubt |
| Phase-D-msiAnchor | Nur sichtbarer Kandidatenhinweis; keine automatische Referenz oder Teilnahme |
| PROFILE, Kennungen, Beschreibung, Notes, Activities | Verworfen; keine Alumni-Attribute, Kontakte, Rohprofile oder Notizen daraus |
| fieldCategory / positionCategory / branchCategory / relationToMsi | Nicht stillschweigend in fieldOfStudy, roleCategory, Organisation.sector oder neue Modellfelder übernommen; ihre Semantik ist nicht bestätigt |

Die E.1-Normalisierung bleibt unverändert. Das neue Importmodul ergänzt daran die
erlaubte Location-Beobachtung, bestätigt existierende Katalog-IDs und orchestriert
die komplette Speicherung. Die vorhandene OPEN-/Betreiber-/Referenzvalidierung
wird innerhalb derselben Transaktion wiederverwendet, mit Sperrfolge
Survey → Program → Alumni → Degree. Gleichnamige Katalogeinträge werden nicht
automatisch zusammengeführt. Rohdaten und Review-Objekte werden nicht persistiert.

Die Phase-D-Paare werden über `syntheticId` lokal korreliert; pro Station muss
Domäne/Titel/Anbieter eindeutig passen. Ein mehrdeutiger Treffer bricht ab.
Originaldateien bleiben unverändert und unversioniert. Der Nutzer hat ihre
Verwendung als lokale Testbeispiele ausdrücklich angefordert; sie werden nicht
als Repository-Fixtures oder Produktions-Seeds übernommen. Next-Standalone-Traces
und der Docker-Build-Kontext schließen `.local-fixtures/` aus.

## Tatsächlich ausgeführte Prüfungen

RED: Die Mapping- und Route-Suites scheiterten zunächst am fehlenden Modul.
Zwei zusätzliche Provider-Tests scheiterten mit INVALID_RESPONSE für den konkreten
No-data-Wortlaut; nach gemeinsamem Matcher sind sie grün. Die erste Browserrunde
erreichte bereits den PostgreSQL-Commit, hatte aber zwei mehrdeutige Alert-Selektoren
wegen des Next.js-Route-Announcers; nach Eingrenzung auf main waren alle vier grün.

- Unit-Suite mit explizitem Korpus-Schalter: 878 erfolgreich. Ohne Schalter:
  877 erfolgreich, 1 optionaler lokaler Korpustest übersprungen.
- `npm run test:mapping:corpus`: 100 Profile / 432 Stationen, 182 Degrees und
  250 CareerSteps. Im Test ausdrücklich gesetzte Review-Angaben bestätigen nur
  den synthetischen Anker als COMPLETED; weitere Status bleiben UNKNOWN.
- `CAREERMAP_PHASE_D_FIXTURES=1 npm run test:integration`: 366 Tests erfolgreich;
  zusätzlich zum normalen Service-Test werden alle 100 lokalen Beispiele über
  den echten Importservice gespeichert und mit einer zweiten Prisma-Verbindung
  zurückgelesen. Jahre und Positionen werden mit den unabhängigen Begleitdaten
  verglichen, ohne Quellwerte in Assertion-Fehlern auszugeben.
- `npm run test:e2e:mapping`: vier Browserprüfungen, Desktop und 375px; bestätigter
  Commit, deaktiviertes Speichern vor Bestätigung, gleicher Receipt bei Retry,
  Austausch/Reload, kein Browser-Storage und kein horizontaler Overflow.
- Synthetische Screenshots: `artifacts/v1c-mapping/desktop-saved.png` und
  `artifacts/v1c-mapping/narrow-saved.png`; Browserbericht `playwright-report-mapping/`.
- Lint, Prisma-Schemavalidierung, Typecheck und Produktionsbuild erfolgreich.
- Vorhandene Browser-Suites ebenfalls erfolgreich: vier Produktions-/Demo-,
  30 Import- und acht OAuth-Prüfungen. Zusammen mit Mapping 46 Browserprüfungen.
- Standalone-Trace geprüft: keine `.local-fixtures`-Originale im API-Trace oder
  Standalone-Ausgabeverzeichnis. Die ursprünglichen lokalen Dateien bleiben lokal.

Die Mapping-Browserprüfung ist in `npm run test:e2e` und im bestehenden CI-Workflow
ergänzt. CI selbst wurde nicht ausgelöst; die genannten Ergebnisse sind lokale
Ausführungen. Der optionale Korpus-Test läuft in frischen Checkouts ohne lokale
Originaldateien nicht; die übrigen Tests verwenden neu verfasste synthetische Daten.

Retry-Schutz: gleicher Browser-Submit mit gleicher ID und gleichem Inhalt wird
innerhalb von 15 Minuten auf diesem Serverprozess zusammengeführt. Abweichender
Inhalt unter derselben ID wird abgewiesen. Das ist kein dauerhafter Wiederaufnahme-
oder Idempotenzmechanismus über Reload/Serverneustarts hinweg. Ein neuer Import
erzeugt ein neues pseudonymisiertes Profil; keine Personenidentifikation.

Nicht Bestandteil: produktiver Datenspende-Endpunkt, dauerhafter Profilzugang,
Kontakt-/Benachrichtigungsworkflow, automatische Kategorien oder Diagramme.
