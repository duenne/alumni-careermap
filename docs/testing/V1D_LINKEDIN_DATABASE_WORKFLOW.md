# V1d – zusammenhängender LinkedIn-/Datenbank-Workflow

Stand: 23.10.2026. Auf Nutzeranweisung wurde zunächst der vorherige Stand als
`fbf3b3b` auf `feat/vertical-test-linkedin` committet und nach `origin` gepusht.
Die anschließende Workflow-Erweiterung einschließlich Vorbelegungen und
Speicherführung wurde vom Nutzer abgenommen und zum Push/Merge nach main freigegeben.

## Lokaler Start

```sh
nvm use
npm run db:workflow
npm run dev:workflow
```

**http://localhost:3100/dev/import** verwenden, passend zur registrierten
LinkedIn-Callback-Adresse. Alle vier Schritte liegen jetzt auf derselben Seite.

`db:workflow` ergänzt das fehlende `POSTGRES_PASSWORD` ausschließlich in der
ignorierten `.env.local`, setzt passende lokale Verbindungs-URLs und eine stabile
Betreiber-ID und erhält die bestehenden LinkedIn-Zeilen. Die Datei erhält Modus
0600; Zugangsdaten werden nicht ausgegeben. Vorhandene vollständig konfigurierte
fremde Datenbankziele werden nicht stillschweigend ersetzt. Der bisher vorhandene
Repository-Platzhalter wird durch die neue lokale Testverbindung ersetzt.

`compose.workflow.yaml` startet PostgreSQL 17 in einem eigenen Compose-Projekt
`careermap-workflow`: Host-Port 5433 auf Loopback, Datenbank
`careermap_workflow_test`, Benutzer `careermap` und benanntes Docker-Volume.
Port ist über `CAREERMAP_WORKFLOW_DB_PORT` vor der Einrichtung konfigurierbar.
Der Runner verwendet Prisma 7.10.0, prüft die PostgreSQL-Version und führt die
vorhandenen fünf versionierten Migrationen per `migrate deploy` aus. Wiederholte
Starts verwenden dieselbe Testdatenbank und denselben Befragungskontext.

**Strg+C beendet nur den Webserver. Profile und Kataloge bleiben im Volume.**
Zum Stoppen der Datenbank ohne Löschen der Daten:

```sh
docker compose --env-file .env.local -f compose.workflow.yaml stop
```

Der ältere `dev:mapping`-Runner bleibt als ausdrücklich temporärer isolierter Test.

## Manuelle Abnahme

1. **Mit LinkedIn verbinden** und die bestehende Freigabe durchlaufen.
   **Karrieredaten als JSON laden** legt die beobachteten Karrierefelder im
   editierbaren JSON-Feld ab, ohne automatische Speicherung.
2. Eines der 100 lokalen Phase-D-Beispiele auswählen und **Durch synthetischen
   Datensatz ersetzen** wählen. Dieser Schritt beendet die LinkedIn-Verbindung,
   entfernt bisherigen JSON-/Review-Zustand und lädt den gewählten synthetischen
   Snapshot. Die Herkunft wird sichtbar angezeigt.
3. Pro Station **Quelldaten bearbeiten** öffnen: Bezeichnung, Anbieter, Beginn,
   Ende und bei Tätigkeiten Ort können direkt angepasst werden. Änderungen setzen
   Beitrag, Referenzbestätigung und bisherigen Speichernachweis zurück. Änderungen
   am gesamten JSON verwerfen zusätzlich die vorhandenen Zuordnungen.
4. Zieltyp, Status, positive eindeutige Timeline-Position und Katalogauswahl prüfen.
   Bei einem präzisen Enddatum sind **Abgeschlossen** für Degrees beziehungsweise
   **Beendet** für Tätigkeiten vorbelegt; bei fehlendem/unpräzisem Ende **Unbekannt**.
   Diese Entwurfswerte sind Vorschläge, keine automatische Abschlussbestätigung.
   Der angegebene Anbieter ist als neuer Katalogeintrag vorausgewählt, falls ein
   Name vorliegt. Gleichnamige bestehende Katalogeinträge werden nicht automatisch
   zusammengeführt. Bewusst geänderte Status-/Katalogwerte bleiben beim Bearbeiten
   der Quelldaten erhalten; unberührte Vorschläge folgen Änderungen an Ende/Anbieter.
5. Den konkreten eigenen abgeschlossenen Referenz-Degree selbst auswählen. Die
   Auswahl ordnet ihn ausdrücklich dem Referenzstudiengang der Testbefragung zu;
   diese Passung muss anschließend bestätigt werden. Andere noch ungeklärte
   Stationen verstecken die Abschlussauswahl nicht mehr. Titel, Fixture-Anker und
   Einzeltreffer bestätigen keine Referenz automatisch.
6. Beide Bestätigungen setzen und **In Testdatenbank speichern**. Die vorhandene
   Transaktion erzeugt vollständiges Profil, Stationen, Timeline und Teilnahme.
   Bestätigung und Rückleseergebnis erscheinen erst nach dem Commit.
   Der Button ist bei geladenen Daten bedienbar. Fehlt eine Voraussetzung, zeigt
   **Noch zu prüfen** die konkreten offenen Punkte; ein Klick fokussiert das erste
   betroffene Feld und führt keinen Schreibaufruf aus. Bearbeitung anderer Stationen
   erhält die gewählte Referenz, macht aber die Bestätigungen ungültig.
7. **Gespeicherter Karriereweg** kontrollieren: Die Timeline zeigt den aus
   PostgreSQL gelesenen Titel, Typ, Status, Katalog, Ort und gespeicherte Jahre in
   bestätigter Positionsreihenfolge. Der Referenzabschluss ist hervorgehoben.
8. Seite neu laden und unter **Gespeicherte Testprofile** denselben Beitrag erneut
   auswählen. Die Timeline wird erneut aus PostgreSQL geladen, ohne Browser-Storage.
9. Mit anderen Phase-D-Beispielen wiederholen. Nach Webserver-Neustart dieselben
   gespeicherten Profile erneut auswählen. Es gibt keine Personenidentifikation
   oder Zusammenführung anhand von Quelldaten.

Die standardmäßige Testbefragung und ihr Betreiber sind synthetisch. Eigene Namen
können vor der ersten Einrichtung über `CAREERMAP_WORKFLOW_INSTITUTION` und
`CAREERMAP_WORKFLOW_PROGRAM` in der privaten Konfiguration vorgegeben werden.
Der Referenzstudiengang eines bestehenden Survey wird nicht nachträglich geändert.
Ein Namenskonflikt zum bestehenden Betreiber-Katalog bricht die Einrichtung ab.

## Grenzen und tatsächlich ausgeführte Prüfungen

Lesen und Schreiben bleiben auf Entwicklungsmodus, Loopback, explizite Freigabe
und die dedizierte Testdatenbank beschränkt. POST benötigt gleiche Origin; dabei
wird die tatsächliche Host-Schreibweise verwendet, weil Next intern 127.0.0.1 zu
localhost normalisiert. Leseabfragen begrenzen sich auf die serverseitig konfigurierte
Betreiber-Institution. Das ist ein lokales Betreiberwerkzeug, kein öffentlicher
Profilzugang anhand einer UUID. Die Liste zeigt die 100 zuletzt bestätigten Profile.
Keine Kontakte, Provider-IDs oder Rohprofile werden aus der Datenbank geliefert.

RED/GREEN: Zwei neue Konfigurationstests scheiterten zunächst am fehlenden Modul.
Der 127.0.0.1-Origin-Test reproduzierte HTTP 404 und ist nach der Korrektur grün.
Die erste OAuth-Testumleitung erfasste die 303-Kette nicht vollständig; sie verwendet
jetzt das bewährte lokale `route.fetch(maxRedirects:0)`-Verfahren und blockiert
externe Ziele ausdrücklich.

Nach Nutzerfeedback wurden Status-/Anbieter-Vorbelegung und Speicherführung
korrigiert. Zwei neue Assertions reproduzierten zunächst UNKNOWN statt der
erwarteten Vorschläge. Die Browserprüfung kontrolliert nun auch, dass vor Abschluss
des Reviews kein Schreibaufruf erfolgt, der erste offene Punkt fokussiert wird,
die Referenz trotz anderer offener Stationen gewählt werden kann und manuelles
UNKNOWN beim Bearbeiten eines Enddatums erhalten bleibt.

Erfolgreich lokal ausgeführt:

| Prüfung | Ergebnis |
| --- | --- |
| Unit-Suite mit Phase-D-Schalter | 883 Tests in 31 Dateien |
| Integration mit Phase-D-Schalter | 367 Tests, kurzlebiges PostgreSQL 17 |
| Bestehende Browser-Suites | 4 Produktion/Demo + 30 Import + 8 OAuth + 6 Mapping |
| Neuer kompletter Workflow | 2 Browserprüfungen, Desktop und 375px |
| Lint, Typecheck, Prisma-Schemavalidierung | erfolgreich |
| Produktionsbuild | erfolgreich |
| Lokale persistente Einrichtung | PostgreSQL 17 verbunden, Migrationen angewendet |

Der neue Integrationstest liest mit einem zweiten Client gespeicherte geänderte
Titel, Anbieter, Status, Referenz und manuelle Reihenfolge zurück. Eine spätere
Entwurfsänderung erscheint nicht im Datenbankergebnis; ein fremder Betreiber erhält
keinen Datensatz. Der Browser durchläuft synthetisches OAuth, Snapshot-Abruf,
vollständigen Fixture-Austausch, Feldbearbeitung, Review, Commit und Wiederaufruf
nach Reload. Nur neu verfasste synthetische Daten erscheinen in Browser-Artefakten.

Timeline-Screenshots: `artifacts/v1d-workflow/desktop-saved-timeline.png` und
`artifacts/v1d-workflow/narrow-saved-timeline.png`.
Die Workflow-Suite ist in `npm run test:e2e` und CI eingetragen. CI für diese neuen
Arbeitsbaumänderungen wurde nicht ausgelöst. Workflow-Browsertests nutzen eine
eigene `.next-workflow-e2e`-Ausgabe, damit der laufende Entwicklungsserver und seine
Sitzung unangetastet bleiben. Die manuelle Abnahme und Merge-Freigabe hat der
Nutzer anschließend ausdrücklich erteilt.

Domänenmodell, Tabellen und Migrationen sind unverändert. Kein produktiver
Datenspende-Endpunkt oder öffentlicher Teilnehmerzugang wurde ergänzt. Der
bestehende prozesslokale Retry-Schutz bleibt bestehen; Reload oder ein neuer Import
erzeugen keine automatische dauerhafte Idempotenzzuordnung.
