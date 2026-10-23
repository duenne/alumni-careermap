# V1b – temporäre Rohantworten zur lokalen Diagnose

Stand: 23.10.2026, lokaler Nachtrag auf `feat/vertical-test-linkedin`, nach Commit
`11661b3`. Kein weiterer Commit, Push oder Merge. Der Nutzer hat ausdrücklich eine
Rohvorschau vor der weiteren Verarbeitung angefordert.

## Zweck und Bedienung

Der bisherige Normalisierungsweg bricht bei der unbekannten EDUCATION-404 auf
Seite 2 ab. Seine Ursache ist weiterhin nicht als behoben nachgewiesen. Der neue
Rohpfad sammelt die JSON-Antworten unabhängig von Adapter, Feldzuordnung und
Normalisierung und zeigt auch die HTTP-Fehlerantwort an. Der bereitgestellte alte
Konverter wird nicht übernommen; automatische Abschluss-/Berufskategorien oder
Referenzauswahlen bleiben ausgeschlossen.

1. Vorhandenen Entwicklungsserver verwenden oder mit `nvm use` und
   `npm run dev:import` starten. Private App-Konfiguration bleibt wie bisher in
   `.env.local`; keine Werte in Chat, Logs oder Testdateien übernehmen.
2. `http://localhost:3100/dev/import` vollständig neu laden.
3. Bei Bedarf **Mit LinkedIn verbinden** wählen.
4. **Rohe API-Antworten abrufen** wählen.
5. Im vorhandenen JSON-Editor steht anschließend ein Objekt mit
   `kind: "linkedin-raw-preview"`, `complete: false` und einem `domains`-Array.
   Jede Domäne enthält `pages`: nullbasierter Seitenindex, HTTP-`status`,
   `requestKind` und die JSON-Antwort unter `body`.
6. Für EDUCATION auf der zweiten Seite `status` und `body` lokal ansehen.
   `requestKind: "next-link"` bedeutet eine von LinkedIn gelieferte Folgeadresse;
   `"probe"` bedeutet den bisher selbst erzeugten Folgeaufruf ohne `next`-Link.
   POSITIONS wird auch nach einer EDUCATION-404 separat abgefragt.
7. **Vorschau leeren** entfernt den Dump und trennt die Verbindung.
   **Synthetische Testdaten verwenden** entfernt den gesamten alten Zustand,
   trennt die Verbindung und lädt die bekannte Repository-Fixture. Erst diese
   darf in die Karriereansicht. Reload stellt keinen Dump wieder her.

Die Rohvorschau ist schreibgeschützt. **JSON prüfen** und die Übernahme in die
Karriereansicht bleiben dafür gesperrt. Sie ist eine Diagnose, kein vollständiger
Import oder bestätigter Beitrag. Keine Datei wird exportiert oder angelegt.
Für die weitere Analyse nur bereinigte Fehlerangaben ohne Personenkennungen teilen;
keinen vollständigen persönlichen Dump und keine Screenshots hochladen.

## Umfang und Schutz

- Ausschließlich EDUCATION und POSITIONS, keine PROFILE-/Nachrichten-/Kontaktabfrage.
- Höchstens zwei Antworten pro Domäne, je höchstens 500.000 Bytes, insgesamt
  höchstens vier Antworten, 45 Sekunden Gesamtzeit. Eine Pagination ohne Ende wird
  sichtbar als `PREVIEW_LIMIT` beendet; es gibt keine Vollständigkeitsbehauptung.
- JSON-Bodies bleiben fachlich unverändert; insbesondere werden unbekannte Felder
  nicht an den Adapter angepasst oder verworfen. Zugangsdaten und Header-Echos
  werden unabhängig davon redigiert. Bekannte Token-/Secretwerte, Bearer-Werte,
  Credential-Felder und Token-Queryparameter werden ersetzt. Verschachtelungen
  jenseits von 64 Ebenen werden mit einem Marker abgeschnitten.
- HTTP-Fehler wie 404 werden als Antwort erfasst, nicht als erfolgreiches Ende
  interpretiert. Ungültiges JSON, Größen- und Transportfehler erscheinen als feste
  Diagnosecodes. 401/403 verwenden weiterhin den bestehenden Abmelde-/Fehlerpfad.
- Server verarbeitet die Antworten nur während der Anfrage im RAM. Der Session-
  Store erhält keine Rohdaten. Browser hält ausschließlich den aktuellen Editor-
  Zustand; kein Browser-Storage, keine Datenbank und keine Dateien.
- `POST /api/dev/import/linkedin/raw-snapshot` verlangt dieselbe lokale
  Entwicklungsfreigabe, gleiche Origin und gültige HttpOnly-Sitzung wie der
  vorhandene Abruf. `Cache-Control: no-store`, keine Referrer und Einbettungssperre.
  Produktion weist den Endpunkt mit 404 ab. Keine neue Request-/Response-Protokollierung.
- Fixture-Austausch beziehungsweise Trennen bricht laufende Abrufe ab; eine späte
  Rohantwort darf den geleerten oder synthetischen Zustand nicht wiederherstellen.

## RED → GREEN und tatsächlich ausgeführte Prüfungen

Fünf neue Provider-Tests waren zunächst rot, weil der Rohpfad fehlte. Die neue
Browserprüfung fand zunächst den fehlenden Button. Nach der Implementierung
prüfen die Tests unkonvertierbare JSON-Strukturen, unbekannte 404 nach gültigen
Seiten, Fortsetzung mit POSITIONS, Credential-Redaktion, Seiten-/Größengrenzen,
unsichere Folgeadressen, ungültige Autorisierung und das Entfernen beim Austausch.

Erfolgreich ausgeführt:

| Prüfung | Ergebnis |
| --- | --- |
| `npm test` | 866 Tests in 27 Dateien |
| `npm run lint` | erfolgreich |
| `npm run typecheck` | erfolgreich |
| `CAREERMAP_DEV_IMPORT_TEST=1 npm run test:e2e` | Produktionsbuild und 42 Browserprüfungen erfolgreich |
| Browseraufteilung | 4 V0-/Produktionsprüfungen, 30 Importprüfungen, 8 OAuth-Prüfungen |
| `git diff --check` | erfolgreich |

Alle automatisierten Antworten sind synthetisch. Der vollständige OAuth-Test
durchläuft den tatsächlichen Raw-Endpunkt und zeigt `[200,404]` für beide Domänen,
ohne echte Provider-Aufrufe. Die neue Importprüfung kontrolliert Darstellung,
Read-only-Zustand, Review-Sperre, fehlenden Browser-Storage und vollständigen
Fixture-Austausch. Die bisherigen Sicherheits- und Normalisierungstests bleiben grün.
Domäne, Datenbank und Migrationen wurden nicht geändert; Datenbankprüfungen wurden
für diesen temporären Entwicklungspfad nicht erneut ausgeführt. Kein automatisierter
Live-Test, keine echten Rohdaten oder Secrets in Testartefakten.

Nachweise unter `artifacts/v1b-raw-preview/`: `red-unit.log`, `red-browser.log`,
`targeted-unit.log`, `unit.log`, `lint.log`, `typecheck.log`, `browser.log`,
`full-e2e.log`, `red-browser-artifacts/`, `production-report/index.html`,
`import-report/index.html` und `oauth-report/index.html`. Enthaltene Screenshots
zeigen ausschließlich synthetische Zustände.

## Änderungen

`provider.ts` erhält eine getrennte Rohabfrage und Credential-Redaktion. Die
vorhandene Prüfung von Folgeadressen ist als gemeinsamer Helfer extrahiert;
der normale Import bleibt fachlich unverändert. `routes.ts` verwendet für den
Rohabruf dieselben Sitzungs-/Origin-/Abbruchprüfungen. `import-editor.tsx` zeigt
den Dump im bestehenden Editor und verwirft ihn mit dem bestehenden Sitzungszustand.

Neue Datei: `src/lib/dev-import/linkedin/raw-snapshot.test.ts`. Ergänzt wurden
`routes.test.ts`, `tests/e2e-import/linkedin-import.spec.ts`,
`tests/e2e-oauth/oauth-start.spec.ts` und `tests/e2e/dev-import-disabled.spec.ts`.
Vorherige lokale Änderungen bleiben erhalten. Die manuelle Live-Abnahme bleibt offen.
