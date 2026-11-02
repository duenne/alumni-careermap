# Gemeinsamer Stil und Alumni-Journey (2026-11-02)

Die Gestaltung der Befragungsverwaltung gilt auch für Einstieg, Alumni-Erfassung,
Prüfung, Bestätigung, Startseite, Beispiel-Karriereweg, Import-/Mapping-Ansichten
und die geschützte Auswertung. Gemeinsame Variablen in `globals.css` definieren
Flächen, Rahmen, Radien, Akzentfarbe und Fokusdarstellung. Fachliche Farben im
Sankey und Statusfarben bleiben unterscheidbar.

Die reguläre Teilnahme zeigt vier Schritte: Weg auswählen, Werdegang erfassen,
Angaben prüfen, Abgeschlossen. Die Fortschrittsanzeige kennzeichnet den aktuellen
Schritt mit `aria-current="step"`; abgeschlossene Schritte sind zusätzlich als
Text für assistive Technik verfügbar. Dieselbe Darstellung wird auch im älteren
Entwicklungsablauf verwendet, mit dessen vorhandenen Schrittnamen.

Die Erfassung zeigt den Hochschul-/Studiengangsbezug, Stationskarten, dezente
Verschiebe-/Entfernen-Aktionen und eine hervorgehobene Referenzauswahl. Die Prüfung
markiert den gewählten Abschluss und behält beide ausdrücklichen Bestätigungen.
Nach Prüfung und Speicherung wird die passende Überschrift fokussiert;
Validierungsfehler erhalten Fokus. Die Quittung ist auch nach erneutem Laden
verfügbar, solange die bereits bestehende Teilnahmesitzung verfügbar ist.

Keine Änderung an Domainmodell, Datenbank, OAuth, Quellabruf oder Speicherregeln.
Die Befragungsinformationen öffnen während der Erfassung in einem neuen Tab.

## Relevante Prüfungen

- `manual-entry.interaction.test.ts`: Fortschritt von Erfassung bis Quittung,
  ausdrückliche Referenzauswahl, zwei Bestätigungen, Fehler und Wiederholung.
- `linkedin-entry.interaction.test.ts` und `participation-start.interaction.test.ts`:
  Übernahme, manuelle Alternative und Start einer Teilnahmesitzung.
- `scripts/test-manual-participation.mjs`: isolierter Produktionsbuild mit eigener
  PostgreSQL-17-Datenbank, manuelle und simulierte LinkedIn-Journey, Desktop/Mobil,
  Fokus, Quittung, Reload und keine doppelten Antworten. Prüfung auf horizontalen
  Überlauf auch bei 320 px mit 200 % Schriftgröße in der Prüfungsansicht.
- Standard-, Survey- und integrierte Browsertests: Startseite, Karriereweg-Prüfung,
  Betreiberverwaltung, geschützter Sankey und Legacy-Entwicklungsablauf.

Alle Eingaben in diesen Tests sind synthetisch. Die laufende Installation wird
nicht mit Testbeiträgen befüllt.
