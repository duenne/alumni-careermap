# V3 – Klassifikationsvorschläge und Studiengangskatalog

Stand: 2026-10-29. Ergänzung zur gemeinsamen Journey auf
<http://localhost:3100/>. Keine Commits, Pushes oder Schemaänderungen.

## Bedeutung und Erfassung der Angaben

| Angabe | Kanonisches Feld | Beispiel |
|---|---|---|
| Fachrichtung des Studiums | `Degree.fieldOfStudy` | Informatik |
| Funktionsbereich einer Tätigkeit | `CareerStep.functionArea` | Personalwesen |
| Jobkategorie der Tätigkeit | `CareerStep.roleCategory` | Softwareentwicklung |
| Branche des Arbeitgebers | `Organisation.sector` | Gesundheitswesen |

Beruf und Branche sind unabhängig: Eine Softwareentwicklerin in einem Krankenhaus
kann die Jobkategorie Softwareentwicklung und die Branche Gesundheitswesen haben.
Die Branche wird beim bewussten Anlegen einer neuen Organisation mitgespeichert.
Eine vorhandene gemeinsam genutzte Organisation wird durch eine Teilnahme nicht
umklassifiziert. Unbekannte Werte bleiben NULL; es gibt keine Pflicht zur Erfindung
einer Kategorie. Die bestehenden manuellen Felder bleiben korrigierbar.

`src/lib/career-import/classification.ts` enthält einen kleinen, lokal ausführbaren
Regelprototyp: fünf Studienrichtungen, vier Jobkategorien und drei Branchen.
Studienrichtungen und Jobkategorien verwenden die Stationsbezeichnung; Branchen
verwenden ausschließlich die Organisationsbezeichnung. Keine Treffer oder mehrere
unterschiedliche Treffer ergeben keinen Vorschlag. Der Funktionsbereich wird
weiterhin manuell erfasst. Die Regeln erkennen nur wenige explizite Wörter; sie
sind weder ein trainiertes Modell noch eine offizielle Taxonomie. Es gibt keine
gemessene Trefferquote oder behauptete Konfidenz. Auch ein einzelner Treffer kann
inhaltlich falsch sein und muss geprüft werden.

Der Editor zeigt Wert und auslösendes Wort an. Erst „…-Vorschlag übernehmen“ trägt
den Wert in ein leeres Reviewfeld ein. Vorhandene Werte werden nicht überschrieben.
Änderungen verwerfen wie bisher Referenz-/Beitragsbestätigungen. Die endgültige
Speicherung verwendet unverändert Normalisierung, Review und CareerImport.
Es gibt keinen zusätzlichen Endpunkt und keine Netzwerkübertragung für diese
Vorschläge, kein Training mit Spenderdaten und keine neue KI-Abhängigkeit.

Vor einem umfangreicheren Klassifikator brauchen wir einen fachlich abgestimmten
Zielkatalog und synthetische Bewertungsfälle mit erwarteten Labels, insbesondere
mehrdeutige Titel und Organisationen. Derselbe Vorschlagsvertrag kann später einen
optional freigegebenen KI-Anbieter aufnehmen. Anbieter, Datenumfang, Umgang mit
personenbeziehbaren Freitexten und Betriebsbedingungen sind dabei noch offen;
es wurde kein externer KI-Zugriff konfiguriert oder getestet.

## Fakultäten und Studiengänge

Unter <http://localhost:3100/admin/surveys> gibt es „Fakultät und Studiengang
ergänzen“. Bestehende Fakultätsangaben stehen als Eingabevorschläge zur Verfügung;
eine neue Fakultätsangabe wird zusammen mit einem Studiengang angelegt. Der neue
Studiengang erscheint nach Commit in der Befragungsauswahl.

Das normative Modell speichert `Program.faculty` als optionalen Text. Eine Fakultät
ohne Studiengang, eigenständige Fakultäts-IDs, globale Fakultätsumbenennungen und
das Verschieben bestehender Programme sind damit nicht implementiert. Eine solche
Erweiterung benötigt zuerst eine Architekturentscheidung; sie wurde zurückgehalten.
Es gibt keine neue Entity oder Migration und keine stille Änderung des Modells.

Die Betreiberhochschule bleibt durch die Installation vorgegeben. Ein
Hochschulbetreiber darf ihr Programme hinzufügen; ein Fakultätsbetreiber nur in
seiner exakt konfigurierten Fakultät. Die API prüft diese Grenzen unabhängig vom
Formular. Keine Ausweitung auf fremde Hochschulen. Der vorhandene Datenbankschlüssel
verhindert doppelte Programme mit gleichem Namen und gleicher Fakultät, auch bei
NULL und parallelen Aufrufen. Duplikate melden 409. Bestehende Survey-Referenzen
bleiben unverändert. Keine Änderung oder Löschung von Bestandsdaten.

Geändert/ergänzt: `src/lib/career-import/classification{,.test}.ts`,
`src/app/dev/mapping/mapping-editor.tsx`, `src/lib/surveys/catalog.ts`,
Survey-Service/-Routen und Routentests, `src/app/admin/surveys/survey-manager.tsx`,
`tests/integration/survey-administration.test.ts` und
`tests/e2e-integrated/workflow.spec.ts`. Ein während der Regression entdeckter
früher Klick vor Hydrierung der alten V3a-Vorschau wird durch einen bis zur
Client-Bereitschaft gesperrten Startbutton in `synthetic-entry.tsx` verhindert;
die vorhandenen Browserprüfungen bleiben unverändert.

Die laufende manuelle Instanz wurde zusätzlich ohne Schreibzugriff auf kanonische
Daten geprüft: Katalogformular sichtbar und bestehende Survey-ID erhalten.
Lokales Ergebnis: `artifacts/v3-integrated/classification-catalog-live-check.json`;
Screenshot: `artifacts/v3-integrated/catalog-administration.png`.

## Manuelle Abnahme

Die bestehende Instanz verwenden; ein erneutes `npm run dev:integrated` würde wie
bisher eine neue temporäre Datenbank anlegen. Für einen späteren frischen Start
gelten Node 22, Docker/PostgreSQL 17 und das private Betreiberpasswort aus der
[V3-Abnahmeanleitung](V3_END_TO_END_INTEGRATION.md).

1. In der Verwaltung einen synthetischen Studiengang mit neuer Fakultätsangabe
   hinzufügen und anschließend in „Neue Befragung“ auswählen.
2. Einen zweiten Studiengang mit derselben Fakultät hinzufügen; die Fakultätsangabe
   aus den Eingabevorschlägen übernehmen. Identische Programme werden abgewiesen.
3. In einer synthetischen Teilnahme eine akademische Station „Master Informatik“
   nennen. Eine vorhandene Fachrichtung zum Testen leeren. Den angezeigten Vorschlag
   prüfen, übernehmen und bei Bedarf manuell korrigieren.
4. Eine Tätigkeit „Software Developer“ bei „Synthetic Krankenhaus“ anlegen bzw.
   korrigieren. Neue Organisation wählen und gegebenenfalls vorhandene Job-/Branchen-
   Testwerte leeren. Job und Branche separat prüfen und übernehmen.
5. Referenzabschluss und Datenspende erneut ausdrücklich bestätigen, speichern und
   im geschützten Dashboard prüfen. Ohne beide Bestätigungen gibt es keinen Commit.

## Testnachweis

Neue Regeltests und der Katalog-Integrationstest wurden zuerst rot ausgeführt
(fehlende Implementierung), danach grün. Alle Daten sind synthetisch.

| Befehl | Ergebnis |
|---|---|
| `npx vitest run src/lib/career-import/classification.test.ts` | 2 bestanden |
| `npm test` | 958 bestanden, 1 bestehender optionaler Korpustest übersprungen |
| `npm run test:integration` | 376 bestanden, 1 bestehender optionaler Korpustest übersprungen |
| `npm run test:e2e:integrated` | 8 bestanden (Desktop und Tablet) |
| `npm run lint` | bestanden |
| `npm run db:validate` | bestanden |
| `npm run typecheck` | bestanden |
| `npm run build` | bestanden, erneut als Teil des vollständigen Browserbefehls |
| `npm run test:e2e` | gesamte Kette bestanden: 73 Tests (6 / 30 / 8 / 6 / 2 / 9 / 4 / 8) |
| `git diff --check` | bestanden |

Integration: Normalisierung einschließlich UUID-Schreibweise, Duplikate, fremde
Hochschule, falsche Fakultät und Erstellung im erlaubten Fakultätskontext.
Browser: Katalogformular, Auswahl des neuen Programms, einzelne Vorschläge,
manuelle Korrektur und fehlende automatische Bestätigungen. Der erweiterte
Speichernachweis verwendet eine eigene geöffnete MSI-Befragung: genau eine
bestätigte Antwort, korrigierte Fachrichtung und übernommene Job-/Branchenwerte
auf derselben kanonischen Tätigkeit. Der neue Test schreibt nicht in die
gemeinsame Befragung des bisherigen OAuth-Tests; im vorherigen Gesamtlauf hatte
dies dessen Annahme über den letzten UUID-sortierten Datensatz verletzt. Die
bestehende OAuth-Prüfung wurde nicht gelockert. Ein Gesamtlauf fand außerdem das
oben beschriebene Hydrierungsproblem der alten V3a-Vorschau.
Die vollständige Browserkette einschließlich Build wurde danach erfolgreich
wiederholt. Laufprotokolle: `/tmp/v3-classification-unit.log`,
`/tmp/v3-classification-catalog-green.log`, `/tmp/v3-classification-browser.log`,
`/tmp/v3-classification-all-browser.log`.
