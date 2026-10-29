# V3a – Studiengangsbezogene Alumni-Befragung

Stand: 2026-10-28. Lokaler Feature-Branch `feat/v3a-survey-administration`,
ausgehend vom vor Änderungen verifizierten HEAD
`bfb1a7ba336b9e86f2f3c860d5cbb7b6aa808705`.
Keine Commits, kein Push und kein Produktivbetrieb.

## Verhalten und fachliche Grenzen

- `/admin/surveys` bietet bestehende Hochschul-/Studiengangskatalogeinträge im
  vertrauenswürdig konfigurierten Betreiberbereich an. Gemäß Domain Model hat
  eine Installation genau einen Betreiber: fremde Hochschulen werden nicht als
  mögliche Befragungsbetreiber angeboten. FACULTY beschränkt zusätzlich auf den
  exakt konfigurierten Fakultätswert; es gibt keinen Rückfall auf INSTITUTION.
- Ein Name und ein vorhandenes Program erzeugen einen Survey mit dem bestehenden
  Datenbankdefault `DRAFT`. Namen werden getrimmt und NFC-normalisiert (maximal
  200 Zeichen). Der Client kann keinen abweichenden Anfangsstatus setzen.
- Der Programmbezug kann über keinen angebotenen Schreibweg geändert werden.
  Zusätzliche Felder, insbesondere `referenceProgramId` beim Statuswechsel,
  werden abgewiesen. Ein anderer Bezug erfordert einen neuen Survey.
- Öffnen, Schließen und Wiederöffnen verwenden `updateSurveyStatus` und dessen
  bestehende Regeln. Alle drei fachlichen Statuswerte und alle bestehenden
  Übergänge bleiben erlaubt. Die Oberfläche bietet Öffnen/Schließen an.
  Die Betreiberprüfung erfolgt unter derselben Survey-Zeilensperre wie die
  Statusänderung; sie verwendet die bestehende Program-Zuordnungsprüfung.
- Der kopierbare Link `/surveys/<surveyId>` enthält ausschließlich den
  Befragungskontext. Entwürfe sind am Alumni-Einstieg nicht verfügbar (404).
  Geöffnete Surveys zeigen Hochschule, Fakultät, Studiengang und Befragung.
  Geschlossene Surveys zeigen weiterhin diesen Kontext mit einem Schließhinweis.
- Der Alumni-Einstieg demonstriert ausschließlich einen frei erfundenen
  Bachelorabschluss. Sowohl Auswahl als auch Bestätigung starten leer, auch bei
  nur einem Beispielabschluss. Die Prüfung speichert weder Alumni noch Degree
  noch SurveyResponse. Nach Neuladen sind Auswahl und Bestätigung wieder leer.
  Ein währenddessen geschlossener Survey wird bei erneutem Aufruf als geschlossen
  angezeigt; eine bereits geladene Vorschau besitzt ohnehin keinen Speicherweg.
- Keine neuen Entitäten oder Migrationen, keine Änderung des normativen
  Domain Models, kein neuer Importprozess. Keine Excel-Datei und keine lokalen
  Bestandsprofile wurden gelesen oder als Testdaten übernommen.

## Manuelle Abnahme

Voraussetzungen: Node.js gemäß `.nvmrc` (22.23.3), installierte Abhängigkeiten und
laufendes Docker. In der ignorierten privaten `.env.local` ausschließlich für
diesen Test ein eigenes Passwort mit mindestens 32 Zeichen konfigurieren:

```dotenv
CAREERMAP_SURVEY_ADMIN_TOKEN=<eigenes-lokales-testpasswort-mit-mindestens-32-zeichen>
```

Dann:

```sh
npm run dev:surveys
```

Der Starter erstellt einen eigenen kurzlebigen PostgreSQL-17-Container,
wendet die fünf bestehenden versionierten Migrationen an und legt ausschließlich
synthetische Katalogdaten sowie eine Beispielbefragung an. Er verwendet weder
eine bestehende Datenbank noch ein persistentes Volume; vorhandene DB-URLs werden
für diesen Prozess durch die frische Testdatenbank ersetzt. Import, Mapping,
OAuth-Zugriff und Analytics sind in diesem Modus nicht freigeschaltet.
Webserver und Datenbank lauschen ausschließlich an Loopback. `.env.local` wird
nicht verändert. Strg+C beendet Server und Container und entfernt diese Testdaten.
Die bestehenden Workflow-/Analytics-Volumes werden nicht verwendet.

1. `http://127.0.0.1:3110/admin/surveys` öffnen. HTTP-Basic-Benutzername:
   `operator`; Passwort: der selbst konfigurierte Wert.
2. „Synthetic Mapping Institute“ und „Synthetic Teststudium · Synthetic Survey
   Faculty“ auswählen; einen synthetischen Befragungsnamen eingeben.
3. „Als Entwurf anlegen“ anklicken: Status `DRAFT`, noch kein Einladungslink.
4. „Befragung öffnen“ anklicken: Status `OPEN`. Link kopieren und in einer
   separaten privaten Browsersitzung öffnen. Dafür ist kein Betreiberpasswort
   erforderlich. Kontext mit der angelegten Befragung vergleichen.
5. Synthetisches Beispiel öffnen: Radioauswahl und Bestätigung sind leer.
   Die Beispielprüfung wird erst nach beiden bewussten Eingaben möglich.
   Nach der Prüfung erscheint ausdrücklich keine Speicherbestätigung.
6. Im Betreiberbereich „Befragung schließen“ anklicken. Alumni-Seite neu laden:
   Schließhinweis, keine Beispielprüfung. Auch nach Neuladen der Verwaltung
   bleibt der Zustand `CLOSED` erhalten, solange der Testcontainer läuft.
7. „Wieder öffnen“ prüfen. Der Studiengang bleibt bei allen Aktionen gleich.
8. Strg+C im Starter-Terminal. Ein Neustart beginnt mit einer frischen Testdatenbank.

Screenshots der automatisierten Abnahme liegen lokal in
`artifacts/v3a-surveys/{desktop,narrow}-{administration,invitation}.png`.
Sie wurden visuell geprüft. Reports und Screenshots sind ignorierte Artefakte.
Die Demo wurde nach den automatisierten Tests wieder beendet.

## Zugriff und Konfiguration

`CAREERMAP_DEV_SURVEYS=1` schaltet die Routen ausschließlich unter
`NODE_ENV=development` frei. Der vorhandene Loopback-/Origin-/Forwarding-Schutz
wird unabhängig vom Import-Flag wiederverwendet. Administratorseiten und beide
Admin-API-Methoden verlangen zusätzlich das private HTTP-Basic-Passwort.
Die Seiten prüfen vor React-/Flight-Rendering im Proxy und nochmals in der Seite;
die APIs prüfen den Zugriff eigenständig. Fehlendes/zu kurzes Serverpasswort
deaktiviert die Verwaltung (404), falsche/fehlende Anmeldedaten ergeben 401.
Öffentliche Kontextprojektionen benötigen kein Betreiberpasswort.
Ein externer Einladungslink darf als Dokumentnavigation ohne Origin am öffentlichen
Einstieg ankommen; Host-/Forwarding-Prüfungen bleiben bestehen. Die Ausnahme gilt
nicht für Betreiberanmeldung oder Cross-Origin-Fetches. Die Browsertests prüfen
diesen Weg über eine vollständig lokal simulierte externe Einladungsseite.

Schreibzugriffe benötigen die passende Origin, JSON und einen höchstens 4096 Byte
großen Body mit exakt den angebotenen Feldern. Fehlermeldungen enthalten keine
Datenbankfehler oder Zugangsdaten. Antworten sind `no-store`, `no-referrer`,
`nosniff` und gegen Framing geschützt.

Der Demo-Starter konfiguriert `CAREERMAP_SURVEY_OPERATOR_KIND=INSTITUTION` und die
frisch erzeugte `CAREERMAP_MAPPING_OPERATOR_ID`. Das gemeinsame bestehende
Sandbox-Clientmodul verwendet `CAREERMAP_MAPPING_DATABASE_URL`, erlaubt nur die
beiden vorgesehenen lokalen Mapping-/Workflow-Testdatenbanken und prüft PG17.
Bei einer gesondert gestarteten bestehenden synthetischen Workflow-Instanz muss
der Betreiber explizit konfiguriert werden. Für `FACULTY` ist zusätzlich
`CAREERMAP_SURVEY_OPERATOR_FACULTY` exakt und nichtleer erforderlich. Requestdaten
bestimmen oder überschreiben den Betreiber niemals.

## Ausgeführte Prüfungen

RED: Die neuen Zugriffs-, Routing- und Integrationstests wurden vor der
Implementierung ausgeführt und scheiterten an den noch fehlenden Modulen.
Die vorhandenen 371 Integrationstests bestanden bereits in diesem Lauf.
GREEN: Anschließend bestanden die neuen Regeln zusammen mit dem Bestand.
Bei der Browserprüfung wurde eine uneindeutige Beschriftung der Auswahlfelder
gefunden und durch explizite `label`-/`id`-Zuordnung behoben. Für den neuen
Buildordner wurde die bestehende ESLint-Ausschlussliste ergänzt; der Lade-Effect
verarbeitet asynchrone Ergebnisse mit Unmount-Schutz.

| Prüfung | Ergebnis |
|---|---|
| `npx vitest run src/lib/surveys/access.test.ts src/lib/surveys/routes.test.ts` | 8 bestanden |
| `npm run lint` | bestanden |
| `npm test` | 941 bestanden, 1 bestehender optionaler Korpustest übersprungen |
| `npm run db:validate` | bestanden |
| `npm run test:integration` | 374 bestanden, 1 bestehender optionaler Korpustest übersprungen |
| `npm run typecheck` | bestanden |
| `npm run build` | bestanden |
| `npm run test:e2e:surveys` | 4 bestanden, Desktop und 375px |
| Produktions-/Review-Regressionssuite mit `npx playwright test` | 6 bestanden, Desktop und 375px |
| `npm run test:e2e:mapping` | 6 bestanden |
| `npm run test:e2e:workflow` | 2 bestanden |
| `git diff --check` | bestanden |

Die Survey-Browsertests verwenden getrennte Betreiber-/Alumni-Kontexte und prüfen
den tatsächlichen Chromium-Clipboard-Inhalt. Integration prüft zusätzlich
Fremdprogramme, Fakultätsabweichungen, fehlende Programme, Unicode-Normalisierung,
Initialstatus-Injektion, Programmwechselversuche und die sichere Kontextprojektion.
Der Produktionsschutz wird mit gesetztem Opt-in und Testpasswort dennoch auf
404 geprüft. Datenbanken stammen immer aus frischen PostgreSQL-17-Containern.
Sandbox-Sperren für Docker und lokale Serverports wurden nach Ausführungsfreigabe
erneut geprüft. Die beiden optionalen übersprungenen Korpustests wurden nicht als
Erfolg gezählt. Der vorhandene `pg`-Deprecation-Hinweis blieb ohne Testfehler.

Die vollständige Import-/OAuth-/Analytics-Browserkette wurde für V3a nicht erneut
ausgeführt. Die neue Survey-Suite ist sowohl in `npm run test:e2e` als auch im
bestehenden separaten Browserjob der CI eingetragen, inklusive Report-Uploads.
Es wurde keine Remote-CI gestartet. Ein echter Screenreader-Test und eine
fachliche manuelle Abnahme durch den Betreiber stehen noch aus.

## Geänderte Dateien

| Bereich | Dateien |
|---|---|
| Zugriff und Services | `src/lib/surveys/access.ts`, `src/lib/surveys/service.ts`, `src/lib/surveys/routes.ts`, `src/lib/survey-service.ts`, `src/proxy.ts` |
| Betreiberoberfläche | `src/app/admin/surveys/page.tsx`, `src/app/admin/surveys/survey-manager.tsx`, `src/app/api/admin/surveys/route.ts` |
| Alumni-Einstieg | `src/app/surveys/[surveyId]/page.tsx`, `src/app/surveys/[surveyId]/synthetic-entry.tsx`, `src/app/surveys/surveys.module.css`, `src/app/api/surveys/[surveyId]/route.ts` |
| Tests | `src/lib/surveys/access.test.ts`, `src/lib/surveys/routes.test.ts`, `tests/integration/survey-administration.test.ts`, `tests/e2e-surveys/surveys.spec.ts`, `tests/e2e/survey-administration-disabled.spec.ts` |
| Start, Build und CI | `scripts/dev-mapping.mjs`, `playwright.surveys.config.ts`, `playwright.config.ts`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `package.json`, `.gitignore`, `.env.example`, `.github/workflows/ci.yml` |
| Dokumentation | `docs/testing/V3A_SURVEY_ADMINISTRATION.md` |

Die schon beim Start unversionierten Verzeichnisse `.agents/`, `.claude/`,
`.windsurf/` sowie `skills-lock.json` gehören nicht zu V3a. Automatisch angepasste
`next-env.d.ts`-Pfade werden nach den Testservern auf den Ausgangsstand zurückgeführt.

## Offene Architekturfragen und Sicherheitsgrenzen

Für diesen lokalen Umfang ist keine vorgelagerte Architekturänderung nötig.
OD-01 bleibt für das Produkt offen: Der hier verwendete allgemeine Kontextlink
bildet keine individuelle Einladung, Personenidentifikation oder Teilnahmeberechtigung
ab. Das entspricht der bestehenden UUID-Grenze im Domain Model.

Vor produktiver Nutzung bleiben insbesondere Betreiber-Authentifizierung und
Sitzungs-/Berechtigungsverwaltung, individueller Berichtigungs-/Löschzugang ohne
Kontaktdaten, Verarbeitungszwecke, Einwilligung, Aufbewahrung und die Freigaberegeln
für Auswertungen zu entscheiden. V3a trifft dazu keine neue Domain-Entscheidung.

HTTP Basic über Loopback ist nur der Zugangsschutz für diese lokale Demonstration.
Es gibt keine Benutzerkonten, Audit-Protokolle, Passwortsperren oder explizite
Abmeldung; Browser können die Anmeldung bis zum Schließen der Sitzung behalten.
Die Testinstanz darf nicht per Reverse Proxy/Tunnel öffentlich bereitgestellt
werden. Der Start im Produktionsmodus bleibt gesperrt. Survey-Namen und
Katalogangaben werden am Einladungseinstieg angezeigt und dürfen in der Demo
keine personenbezogenen Angaben enthalten. Neue Alumni-Routen liefern keine
Profile, Antworten, Kontaktinformationen oder individuellen Karriereverläufe.

Die Unveränderlichkeit des Referenzprogramms bleibt wie im bestehenden Modell
eine Service-Garantie. Direkte SQL-/Prisma-Zugriffe vertrauenswürdiger Betreiber
können diese Regel umgehen; es wurde bewusst kein neuer Trigger eingeführt.
