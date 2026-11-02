# Befragungsverwaltung und Alumni-Einstieg (2026-11-02)

Die Übersicht priorisiert Bearbeiten, Auswertung und Einladungslink und zeigt
Status sowie bestätigte Teilnahmen ohne technische Enum-Bezeichnungen.
Der Editor bearbeitet Namen und fünf strukturierte Textbausteine je Survey.
Die gemeinsame Einführungskomponente rendert Vorschau und tatsächlichen Einstieg;
Teilnahmeaktionen und verbindliche Systemhinweise bleiben außerhalb der Redaktion.
HTML-Eingaben erscheinen als Text. Leere optionale Felder verwenden Standardtexte.

Speichern prüft den Betreiberbereich und die beim Öffnen gelesene `updatedAt`.
Ein Konflikt liefert HTTP 409 / EDIT_CONFLICT und erhält die Eingaben im Editor.
Speichern ändert weder Status noch Referenzprogramm. Ungespeicherte Änderungen
werden beim Verlassen oder Neuladen angezeigt; Verwerfen schreibt nichts.

## Prüfung

- `src/lib/surveys/edit.test.ts`: Normalisierung, Längen und geschützte Felder.
- `src/lib/surveys/routes.test.ts`: Authentifizierung, Origin, Bodylimit, Konflikte.
- `src/app/admin/surveys/survey-manager.interaction.test.ts`: Vorschau, Speichern,
  Verwerfen, Konflikterhalt und Navigation mit ungespeicherten Eingaben.
- `src/app/surveys/[surveyId]/synthetic-entry.interaction.test.ts`: Gespeicherte
  Texte in beiden Einstiegsvarianten, Systemhinweise und reine Textdarstellung.
- `tests/integration/survey-administration.test.ts`: PostgreSQL 17, Migration,
  SQL-Constraints, Befragungstrennung, Betreiber-/Fakultätsgrenzen, Konflikte.
- `tests/e2e-surveys/surveys.spec.ts`: Desktop und Mobil, Bearbeiten, Verwerfen,
  Vorschau, Speichern, Neuladen und öffentlicher Einstieg; kein horizontaler
  Überlauf, auch bei 320 px mit 200 % Schriftgröße im Editor.

Die Testdaten sind synthetisch; Tests nutzen eine eigene kurzlebige Datenbank.
Die Migration `20261102163000_survey_entry_texts` ergänzt ausschließlich nullable
Spalten und Text-Checks. Für die bestehende lokale Installation erfolgt die
Aktualisierung über `demo:local -- migrate`, einen neuen Build und Neustart.
Logoherkunft: `public/BRANDING.md`.
