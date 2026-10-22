# V1b – HM CareerMap: lokaler LinkedIn-OAuth-Test

Stand: 22.10.2026. **Automatisiert mit ausschließlich synthetischen Antworten geprüft. Echte LinkedIn-Autorisierung und manuelle Abnahme sind offen.**

Keine Datenbankpersistenz, neue Migration oder Domänenänderung. Kein Commit, Push oder Merge.
Branch und HEAD bleiben `feat/alumni-review-ui` / `3531a4088220a036314afa5e50411514121bb5ef`.
Die vorhandenen V0-/V1a-Arbeiten bleiben erhalten. Eine gezielte Verschärfung gegenüber V1a ist unten beschrieben.

## Verifizierter Providervertrag und Referenz

Die vorhandene App **HM CareerMap** wird mit dem vom Nutzer im Auth-Tab bestätigten Scope
`r_dma_portability_3rd_party` verwendet. Der Code setzt keine zusätzliche Produktfreigabe voraus.
Die tatsächliche Zustimmung und Berechtigung des Kontos bleiben Gegenstand des manuellen Tests.

- [Third-Party-Produkt](https://learn.microsoft.com/en-us/linkedin/dma/member-data-portability/member-data-portability-3rd-party/): Authorization-Code-Flow und Scope `r_dma_portability_3rd_party`.
- [OAuth-Vertrag](https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow): Autorisierung über `https://www.linkedin.com/oauth/v2/authorization`; serverseitiger Codeaustausch über `https://www.linkedin.com/oauth/v2/accessToken`. Der Redirect muss der registrierten URL entsprechen; State wird geprüft.
- [Snapshot-Vertrag](https://learn.microsoft.com/en-us/linkedin/dma/member-data-portability/shared/member-snapshot-api): `GET https://api.linkedin.com/rest/memberSnapshotData?q=criteria&domain=…`, Header `LinkedIn-Version: 202312`. `paging.total` ist unzuverlässig; bei paginierten Antworten wird bis zum dokumentierten Ende weitergelesen.
- [Domänen](https://learn.microsoft.com/en-us/linkedin/dma/member-data-portability/shared/snapshot-domain): EDUCATION und POSITIONS sind die benötigten Karrierequellen. PROFILE enthält biografische Angaben und wird nicht abgerufen. Das leere `PROFILE.snapshotData: [{}]` im Editor ist ausschließlich die unveränderte Hülle für den vorhandenen Adapter.

Als Altcode-Referenz wurden `alumni-careers/lib/linkedinPortability.ts` und
`linkedinProfileConverter.ts` im benachbarten Checkout gelesen. Keine dortigen
Rohdaten/Fixtures wurden gelesen oder kopiert. Nicht übernommen wurden insbesondere
Tokenpräfix-/Response-Logging, spekulative Member-Authorization-Endpunkte,
unvollständige Domänenresultate, Ersttreffer-Referenzen und das Legacy-Profilmodell.
Der vorhandene neue Provider wurde anhand der offiziellen Verträge geprüft und erweitert.

## Lokale Vorbereitung ohne Übermittlung von Secrets

Die registrierte URL lautet exakt:

```text
http://localhost:3100/auth/linkedin/portability/callback
```

Konfiguration ausschließlich in der privaten, gitignorierten `.env.local`:

```dotenv
CAREERMAP_DEV_IMPORT=1
LINKEDIN_PORTABILITY_MODE=third_party
LINKEDIN_PORTABILITY_SCOPE=r_dma_portability_3rd_party
LINKEDIN_REDIRECT_URI=http://localhost:3100/auth/linkedin/portability/callback
```

Die vorhandenen App-Werte für `LINKEDIN_CLIENT_ID` und `LINKEDIN_CLIENT_SECRET`
werden nur lokal konfiguriert. Sie werden weder für diese Abnahme angefordert noch
in Chat, Terminalausgaben, Screenshots oder Testartefakte übernommen. Kein Access
Token wird als Konfigurationswert benötigt. Die kommentierten Variablennamen
stehen auch in `.env.example`.

Im Repository-Verzeichnis mit installierten Dependencies:

```sh
nvm use
npm run dev:import
```

Ein vorhandener Server auf Port 3100 muss zuvor beendet sein. Nach Änderungen an
privater Konfiguration den Entwicklungsserver neu starten.

**Immer [http://localhost:3100/dev/import](http://localhost:3100/dev/import) öffnen.**
Der Import-Startbefehl bindet an den lokalen Host `localhost`, passend zur registrierten Callback-URL. `localhost` und
`127.0.0.1` sind für Browser-Origin und Cookies unterschiedliche Hosts; deshalb
die Browseradresse für diesen OAuth-Test nicht austauschen. Unter einer zur
konfigurierten Callback-Origin abweichenden Adresse bleibt die Verbindung deaktiviert.
Die Oberfläche unterscheidet jetzt fehlende/ungültige Konfiguration von einer
abweichenden Browseradresse. „Lokale Einrichtung anzeigen“ nennt die benötigten
Variablennamen und festen Einstellungen, niemals konfigurierte App-Werte.
Keine Datenbank ist für V1b nötig.

## Schrittweise Live-Abnahme

Die Live-Abnahme erfolgt separat und manuell, ohne Browser-Automatisierung,
Tracing, Screenshots, JSON-Exporte oder Kopieren echter Inhalte in Testdateien.

1. `/dev/import` aufrufen. Erwartung: leerer Editor, keine Karriereansicht. Bei korrekter lokaler Konfiguration erscheint „HM CareerMap ist lokal konfiguriert. Noch nicht verbunden.“ Andernfalls die lokale Konfiguration/Origin prüfen; die Oberfläche gibt keine Secret-Werte aus.
2. **Mit LinkedIn verbinden** wählen. Erwartung: Weiterleitung auf die offizielle LinkedIn-Autorisierung mit der App HM CareerMap und `r_dma_portability_3rd_party`. Diese Berechtigung umfasst mehr als die zwei tatsächlich abgerufenen Domänen; die Oberfläche weist darauf hin.
3. Eigenes Konto verwenden und Zustimmung prüfen. Nach Freigabe führt LinkedIn zur oben registrierten Callback-URL. Erwartung: sofortige Weiterleitung auf `/dev/import`, sichtbarer Verbindungsstatus. Keine Tokenanzeige; der kurzlebige OAuth-Code wird weder angezeigt noch protokolliert und steht nach der Weiterleitung nicht mehr in der aktiven URL.
4. Optional die Autorisierung in einem separaten Versuch ablehnen. Erwartung: verständliche Abbruch-/Freigabemeldung auf der Importseite. Keine Übernahme einer LinkedIn-Fehlerbeschreibung mit möglichen Rohdaten.
5. **Karrieredaten abrufen** wählen. Erwartung: expliziter Abruf von EDUCATION und POSITIONS einschließlich Folgeseiten. Erst nach erfolgreichem Abruf beider Domänen erscheint die minimierte Projektion im editierbaren JSON; die Anzeige nennt die Anzahl der Ausbildungs- und Berufsangaben.
6. Vollständigkeit lokal mit den bekannten Karriereeinträgen des eigenen Kontos vergleichen. Nicht allein auf die erste Seite oder `paging.total` vertrauen. Die Tests sichern die Pagination mit kontrollierten Antworten ab; sie beweisen nicht den Umfang des echten Kontos. Bei noch nicht verfügbaren Snapshots erscheint eine Meldung; später erneut abrufen. Es werden keine Teilergebnisse als vollständig angezeigt.
7. **LinkedIn-Daten – nur temporäre Vorschau** prüfen. Keine Namen-/E-Mail-/Profil-ID-/Beschreibungsfelder, die für diesen Karrierepfad nicht benötigt werden. **In Karriereansicht übernehmen** ist deaktiviert.
8. Eine JSON-Angabe lokal bearbeiten und **JSON prüfen** wählen. Syntaxfehler müssen verständlich angezeigt werden. Auch nach erfolgreicher Prüfung bleibt die LinkedIn-Herkunft erhalten und die Übergabe gesperrt.
9. **Synthetische Testdaten verwenden** wählen. Erwartung: bisheriges JSON und alle sichtbaren Entscheidungen werden sofort entfernt. Die lokale Token-Sitzung wird beendet, ein laufender Abruf abgebrochen und erst danach die feste Repository-Fixture geladen. Bei einem Fehler wird der alte Zustand nicht wiederhergestellt.
10. Jetzt steht **Synthetische Testdaten** am Editor; Inhalt ausschließlich „Fiktiver LinkedIn-Snapshot“ mit zwei Ausbildungs- und zwei Berufsangaben. Keine vorherige persönliche Angabe bleibt im aktiven Editor oder Review. Der LinkedIn-Abrufbutton ist deaktiviert, bis erneut verbunden wird.
11. **In Karriereansicht übernehmen** wählen. Erwartung: Internship, M.Sc., Research Assistant und Short Course aus der vorhandenen synthetischen Fixture. Keine Degree-Auswahl, Entwurfsposition oder Referenzbestätigung aus einem früheren Entwurf. Der bisherige synthetische Degree-/Reihenfolge-Review funktioniert weiter.
12. Die Fixture erneut verwenden, auch nachdem Entscheidungen getroffen wurden. Erwartung: vollständiger Neustart ohne alte Entscheidungen. Ein eventuell verspätetes Live-Antwortpaket darf weder Editor noch Timeline verändern.
13. **Vorschau leeren** oder die Seite neu laden. Erwartung: keine Karriereinformationen werden wiederhergestellt. Reload beendet nicht zwangsläufig die noch ungenutzte Server-Sitzung; diese läuft spätestens nach 15 Minuten ab. „Vorschau leeren“, Fixture-Austausch oder vollständiger Serverneustart entfernen die lokale Verbindung.

Keine erfolgreiche Datenspende oder Speicherung wird angezeigt. Der echte
Login und die tatsächliche Verfügbarkeit beider Domänen sind noch vom Nutzer abzunehmen.

## Herkunftsgrenze und Schutzmaßnahmen

- Nur die frisch per serverseitiger Fixture-ID aufgelöste synthetische Quelle darf in die Karriereansicht. Editoränderungen entfernen diese Markierung. Eigene/ungeklärte JSON-Eingaben bleiben ebenfalls gesperrt, auch nach „Leeren“ und erneutem Einfügen. Die JSON-Prüfung und Zählung bleiben verfügbar. Das verschärft bewusst den früheren V1a-Vorschauablauf gemäß der V1b-Vorgabe.
- Für eine spätere Speicherung genügt auch diese clientseitige Kennzeichnung nicht; V1b besitzt keinen Persistenzendpunkt.
- Server-RAM enthält nur kurzlebige Token-Sitzungen und laufende Abrufe. Keine Rohprofilablage, Datenbank, Browser-Storage oder Dateien. Der Browser erhält ein HttpOnly-/SameSite=Lax-Cookie mit einer zufälligen Sitzungskennung, niemals den LinkedIn-Token.
- Cookie-Pfad `/` deckt sowohl die registrierte Callback-Route als auch die lokalen API-Routen ab. Nach erfolgreichem Callback wird die Kennung rotiert. OAuth-State ist zufällig, cookiegebunden, gehasht gespeichert, zeitbegrenzt und einmalig verwendbar.
- Token-Sitzungen laufen nach höchstens 15 Minuten, Anmeldeversuche nach fünf Minuten ab. Eine periodische Bereinigung entfernt abgelaufene Sitzungen; Serverneustart entfernt alle. Maximal 32 Sitzungen verhindern unbegrenztes Wachstum.
- Nur Entwicklungsmodus, expliziter Opt-in und lokaler Host/zulässiger Origin. Same-Origin-POST für Start, Abruf und Trennen. Externe Navigation ist ausschließlich als GET im obersten Browserfenster zur genauen Callback-Route und zur Importseite erlaubt. Die Callback-State-Prüfung bleibt erforderlich; die Importseite selbst gibt keine Verbindung frei. Produktion sperrt Seite, APIs und Callback.
- Fehler werden über feste Meldungen abgebildet. Provider-Fehlertexte, Token und Rohantworten werden nicht ausgegeben. Next.js-Requestlogging ignoriert OAuth-API und Callback; Browser-Logweiterleitung zum Terminal ist deaktiviert.
- Keine freie API-/Pagination-Zieladresse. Folgeseiten bleiben auf dem offiziellen Snapshot-Endpunkt und der angefragten Domäne; fremde Hosts, andere Domänen, Schleifen und Token-Queryparameter werden abgewiesen.
- Sicherheitsgrenzen: 100 Seiten/1.000 Einträge pro Domäne, begrenzte Antworten und Gesamtprojektion, Zeitlimits. Überschreitung bedeutet Fehler ohne Teilübernahme, keine stille Kürzung.

## RED → GREEN und automatisierte Nachweise

Vorprüfung der vorhandenen Import-/Provider-Vorarbeit: 36 Tests erfolgreich.
Neue Callback-/Scope-/Cookie- und Fehlervertragstests waren zunächst RED (22 Tests);
Protokoll `artifacts/v1b/red-callback.log`. Ein zusätzlicher Verdrahtungstest fand
einen falschen relativen Callback-Importpfad, der korrigiert wurde
(`red-route-wiring.log`). Die UI-Journey war zunächst in beiden Viewports RED
(`red-ui.log`). Ein Zwischenlauf fand die verlorene Callback-Fehlermeldung beim
React-Effect-Replay; die sichere Ergebnismeldung bleibt jetzt über diesen Replay
erhalten. Der Test für Leeren/Einfügen war ebenfalls RED (`red-origin.log`) und
wurde mit der minimalen Herkunftssperre grün.

Die Provider-Tests mocken ausschließlich HTTP-Antworten. Der Callback-Vertragstest
durchläuft die tatsächlichen Route-Exporte mit einem simulierten Token-Endpunkt.
Die UI-Tests mocken die lokale Provider-Grenze; der synthetische Fixture-Endpunkt
und die vorhandene Review laufen tatsächlich. Automatisierte Browser-Server
überschreiben sämtliche LinkedIn-Konfigurationswerte mit leeren Werten, damit
keine private lokale App-Konfiguration in Tests gelangt.

Die Prüfprotokolle liegen unter `artifacts/v1b/`. Der abschließende Gesamtbrowserlauf
enthält V0, Produktionssperre, V1a und V1b; Details stehen in `full-e2e.log`.
Remote-CI wurde nicht ausgelöst. Keine automatisierten Tests benötigen eine echte
LinkedIn-Verbindung. Die Live-Abnahme bleibt separat offen.

| Prüfung | Tatsächlich ausgeführtes Ergebnis | Protokoll unter `artifacts/v1b/` |
| --- | --- | --- |
| `npm test` | 847 Tests in 25 Dateien erfolgreich | `unit.log` |
| Provider-/Callback-Verträge gezielt | 23 Tests in 3 Dateien erfolgreich | `unit-provider.log` |
| `npm run lint` | erfolgreich | `lint.log` |
| `npm run db:validate` | erfolgreich | `db-validate.log` |
| `npm run test:integration` | 363 Tests in 8 Dateien; isolierter PostgreSQL-17-Container anschließend entfernt | `integration.log` |
| `npm run typecheck` | erfolgreich | `typecheck.log` |
| Produktionsbuild und gesamte Browser-Suite | Build erfolgreich; 2 V0-Journeys, 2 Produktionssperrprüfungen und 22 Importprüfungen erfolgreich | `full-e2e.log` |
| `git diff --check` | erfolgreich | Terminalausgabe |

Der zusätzliche Herkunftstest verändert nur UI-/Browserverhalten; die anschließend
erneut ausgeführte Gesamtbrowser-Suite, Lint und Typecheck prüfen den endgültigen
Code. Domain- und Provider-Code wurden nach den erfolgreichen Unit-/DB-Prüfungen
nicht mehr geändert. Server-Binding und Docker-Prüfung benötigten freigegebenen
Zugriff außerhalb der Sandbox.

Gesicherte HTML-Berichte: `artifacts/v1b/production-report/index.html` und
`artifacts/v1b/import-report/index.html`. Die Screenshots zeigen ausschließlich
die synthetische Fixture nach dem Austausch:
[Desktop](../../artifacts/v1b/screenshots/desktop/v1b-synthetic-replacement.png),
[schmal](../../artifacts/v1b/screenshots/narrow/v1b-synthetic-replacement.png).
RED-Fehlerartefakte liegen unter `artifacts/v1b/red-browser/`; sie enthalten nur
synthetische Testdaten. Aus dem echten LinkedIn-Test wurden keine Artefakte erstellt.

Automatisiert erneut ausführen (nur Mock-Daten; keine echte Verbindung):

```sh
nvm use
CAREERMAP_DEV_IMPORT_TEST=1 npm run test:e2e
```

Der Flag isoliert den Build von einem normalen Entwicklungsserver. Vorhandene
Testserver auf Port 3102/3103 werden nicht übernommen. Nur Import-Suite:
`npm run test:e2e:import`. Aktuelle Berichte öffnen:
`npx playwright show-report` beziehungsweise
`npx playwright show-report playwright-report-v1a`.

## Dateien und Abnahmegrenzen

Angepasst: `.env.example`, `next.config.ts`, `src/proxy.ts`,
`src/lib/dev-import/access.ts`, `src/app/dev/import/import-editor.tsx`,
`src/lib/dev-import/linkedin/config.ts`, `provider.ts`, `routes.ts` und deren Tests,
`playwright.import.config.ts`, `tests/e2e/dev-import-disabled.spec.ts`,
`tests/e2e-import/json-import.spec.ts`, `linkedin-import.spec.ts` sowie der
V1b-Hinweis in der V1a-Abnahmedokumentation.

Neu: die registrierte Callback-Route unter `src/app/auth/linkedin/portability/callback/`,
`callback-contract.test.ts`, `tests/e2e-import/synthetic-origin.spec.ts` und dieses Dokument.
Die bereits vorhandenen Session-, Fehler- und API-Bausteine wurden wiederverwendet.
Sicherungen des vorgefundenen Quellstands liegen unter `artifacts/v1b/start-of-task/`
als nicht ausführbare `.snapshot`-Dateien. Kein privater Konfigurationsinhalt wurde gesichert.

Node.js 22.23.3 und Chromium unter macOS sind die lokale Prüfumgebung. Firefox,
WebKit, reale Mobilgeräte und echte LinkedIn-Antworten sind nicht als getestet ausgewiesen.

## Nachprüfung: deaktivierter Verbindungsbutton

Der laufende lokale Server meldete zunächst `configured: false`. Es gab keine
lokale `.env`-Konfigurationsdatei im Checkout. Die deaktivierte Schaltfläche folgt
diesem Serverstatus; die gemeldete `unload`-Warnung aus `web tool frame.js` ist
kein Nachweis eines OAuth-Fehlers. Der Anwendungscode verwendet keinen
`unload`-/`beforeunload`-Handler.

Minimal ergänzt: Der Status liefert ausschließlich feste Ursachencodes
`NOT_CONFIGURED` oder `ORIGIN_MISMATCH`, niemals App-Werte. Die Oberfläche zeigt
Einrichtungshinweise beziehungsweise die passende lokale Adresse. Der
Import-Startbefehl verwendet jetzt `--hostname localhost`, sodass die ausgegebene
Adresse zum registrierten Callback passt. Die Konfigurations- und Origin-Prüfung
bleibt unverändert erforderlich. Ohne gültige private App-Konfiguration bleibt
die Schaltfläche deaktiviert.

RED: Ein neuer Statusvertragstest und vier Browserprüfungen (zwei Fälle auf
Desktop und schmalem Viewport) schlugen wegen der fehlenden Ursachenanzeige fehl.
GREEN: 848 Unit-Tests, alle 26 Import-Browserprüfungen, Lint, Typecheck und
Produktionsbuild erfolgreich. Der Browserfall mit korrekter Konfiguration
verwendet einen Mock; er führt keine echte Autorisierung aus. Datenbankprüfungen
wurden für diese reine Status-/UI-Korrektur nicht erneut ausgeführt.

Nachweise: `artifacts/v1b-connection-button/red-status.log`, `red-browser.log`,
`unit.log`, `browser.log`, `lint.log`, `typecheck.log` und `build.log`.
Der gesicherte Browserbericht liegt unter
`artifacts/v1b-connection-button/import-report/index.html`.
Geändert wurden `package.json`, `src/lib/dev-import/linkedin/routes.ts` samt
`routes.test.ts` und `callback-contract.test.ts`,
`src/app/dev/import/import-editor.tsx`,
`tests/e2e-import/linkedin-import.spec.ts` und dieses Dokument. Vorhandene lokale
Arbeiten bleiben erhalten; kein Commit oder Push.

Manuell: Die oben beschriebenen Einstellungen und die eigenen App-Werte nur in
der privaten `.env.local` hinterlegen. Den bisherigen Server beenden,
`npm run dev:import` starten und `http://localhost:3100/dev/import` neu öffnen.
Erwartung: „HM CareerMap ist lokal konfiguriert. Noch nicht verbunden.“ und ein
aktiver Verbindungsbutton. Erst anschließend die separate Live-Abnahme durchführen.

## Nachprüfung: 404 beim Formular-POST auf `/linkedin/start`

Nach der privaten Einrichtung meldete der lokale Status `configured: true`.
Der neue Browsertest reproduzierte dennoch den 404 beim tatsächlichen Klick:
Der native Formular-POST sendete `Origin: null`. Ursache war die Kombination
aus `Referrer-Policy: no-referrer` am Importdokument und der strikten
Same-Origin-Prüfung. Dieses Browser-Verhalten ist im
[Fetch-Standard](https://fetch.spec.whatwg.org/#append-a-request-origin-header)
beschrieben. Die bisherige Browserprüfung aktivierte lediglich den Button;
der erfolgreiche Start war bisher nur auf Route-Ebene mit gesetzter Origin geprüft.

Minimale Anwendungskorrektur: Nur das Importdokument verwendet jetzt
`same-origin`, sowohl im Proxy-Header als auch in den Next-Metadaten. Dadurch
bleibt die lokale Formular-Origin erhalten. Externe Ziele erhalten weiterhin
keinen Referrer; API-Antworten und Callback behalten `no-referrer`. Die lokalen
Zugriffsregeln, Origin-Prüfung, State-Prüfung und Token-Handhabung bleiben bestehen.
Die `frame.js`-Warnung über `unload` ist keine Ursache dieses reproduzierten 404.
Der benachbarte Altcode liefert seine Autorisierungs-URL per JSON-POST; seine
abweichende Starttechnik wurde als Referenz gelesen, nicht übernommen.

RED: Der Formular-Klick schlug auf Desktop und im schmalen Viewport mit
`Origin: null` fehl; zusätzlich war der neue Header-Vertragstest rot.
Nach der Korrektur liefert der echte lokale Start-Endpunkt mit synthetischer
App-Konfiguration 303 und eine korrekte LinkedIn-Autorisierungs-URL.
Die Browserprüfung erfasst diese Antwort mit `maxRedirects: 0` und ersetzt sie
vor dem Folgen durch eine lokale HTML-Antwort. Reale App-Werte werden in allen
Browser-Testservern ausdrücklich durch leere oder synthetische Werte überschrieben.
Fremde, fehlende und `null`-Origins werden weiterhin mit 404 abgewiesen.

Ein Fehler im ersten Weiterleitungstest ist ebenfalls dokumentiert:
Playwright fing die Folgeanfrage einer Redirect-Kette nicht ab. Dadurch wurde
der LinkedIn-Autorisierungsendpunkt in zwei Viewports mit der ungültigen App-ID
`synthetic-client` aufgerufen; LinkedIn zeigte eine entsprechende Fehlermeldung.
Es wurden keine echten App-Werte, Tokens oder persönlichen Daten verwendet und
keine Kontoautorisierung durchgeführt. Die korrigierte Testgrenze ersetzt nun
die ursprüngliche 303-Antwort, bevor der Browser weitergeleitet wird.

Abschließende Prüfungen: 849 Unit-Tests, Lint und Typecheck erfolgreich.
`CAREERMAP_DEV_IMPORT_TEST=1 npm run test:e2e` war inklusive Produktionsbuild,
4 Produktions-/V0-Prüfungen, 26 Importprüfungen und 4 neuen OAuth-Startprüfungen
erfolgreich (insgesamt 34 Browserprüfungen). Keine Datenbankänderungen;
Datenbankprüfungen wurden für die Header-Korrektur nicht erneut ausgeführt.

Nachweise unter `artifacts/v1b-oauth-start/`: `red-unit.log`, `red-browser.log`,
`unit.log`, `lint.log`, `typecheck.log`, `browser.log`, `full-e2e.log`.
`intermediate-browser.log` und `intermediate-local-redirect.log` dokumentieren
die anschließende Korrektur des Testaufbaus.
Die ursprünglichen RED-Screenshots/-Traces/-Videos liegen unter
`red-browser-artifacts/` und zeigen ausschließlich die lokale Ablehnung.
Gesicherte Endberichte: `production-report/index.html`,
`import-report/index.html` und `oauth-report/index.html`.
Die Import-Screenshots zeigen weiterhin ausschließlich die synthetische Fixture.

Neu: `playwright.oauth.config.ts` und `tests/e2e-oauth/oauth-start.spec.ts`.
Geändert: `src/app/dev/import/page.tsx`, `src/proxy.ts`,
`src/lib/dev-import/linkedin/routes.test.ts`, `.gitignore`, `package.json`
und dieses Dokument. `npm run test:e2e:oauth` startet den isolierten Test auf
Port 3104; der Gesamtbrowserlauf schließt diese Suite jetzt ein.
Keine Änderung an der Domäne, Speicherung oder privaten Konfiguration.
Kein Commit, Push oder Merge.

Manuell: `http://localhost:3100/dev/import` vollständig neu öffnen, damit die
neuen Dokument-Header und Metadaten aktiv sind, anschließend **Mit LinkedIn
verbinden** wählen. Erwartung: LinkedIn-Autorisierung statt lokalem 404. Bei
einem veralteten Entwicklungsserver diesen mit `npm run dev:import` neu starten.
Den Live-Test weiterhin ohne Traces, Screenshots oder Kopieren persönlicher
JSON-Inhalte durchführen; die übrigen Live-Abnahmeschritte oben bleiben gültig.

## Nachprüfung: 404 nach erfolgreichem Callback

Der vom Nutzer beobachtete Aufruf `/dev/import?linkedin=connected` entsteht erst
nach erfolgreichem Tokenaustausch. Der Proxy blockierte anschließend die
Dokument-Rückleitung, weil ihr `Sec-Fetch-Site` weiterhin `cross-site` war.
Das Beibehalten dieser Klassifikation in Redirect-Ketten ist im
[Fetch-Metadata-Standard](https://www.w3.org/TR/fetch-metadata/#redirects)
beschrieben. Die `frame.js`-Warnung über `unload` verursacht diesen Proxy-404 nicht.

Minimal geändert: Ein gemeinsamer Helfer in `src/lib/dev-import/access.ts`
prüft ausschließlich genaue Dokument-Navigationen per GET im obersten Fenster.
`src/proxy.ts` lässt damit zusätzlich die leere lokale Importseite als
Rückleitungsziel zu. Entwicklung, Opt-in, lokaler Host, zulässige Origin und
Forwarded-Header bleiben geprüft. Fremde/`null`-Origins, POST, iframe-/Fetch-
Zugriffe, Unterpfade, Produktion und alle externen API-Zugriffe bleiben gesperrt.
Der Queryparameter `linkedin=connected` berechtigt zu nichts; der Browser lädt
den tatsächlichen Sitzungsstatus weiterhin über die geschützte API.
Callback-State, Cookie-Rotation und Token-Handhabung wurden nicht geändert.

RED: Der neue Proxy-Vertragstest scheiterte zunächst am abgewiesenen
Rückleitungsziel. Die Browsertraces zeigten den erfolgreichen Callback mit
`connected` und anschließend den tatsächlichen 404 der Importseite. Eine erste
Header-Assertion am durch Playwright abgefangenen Callback musste korrigiert
werden: Chromium ergänzt dessen Fetch Metadata erst nach dem Abfangen.
Die abschließende Assertion prüft stattdessen die echte, nicht abgefangene
Folgeanfrage samt `Sec-Fetch-Site: cross-site` und erwartet Status 200.

Die OAuth-Browsersuite prüft jetzt zusätzlich den vollständigen Ablauf vom
Formular über eine simulierte externe Anmeldeseite, den tatsächlichen Callback
und die tatsächliche 303-Rückleitung bis zum echten lokalen Sitzungsstatus.
Sowohl gültiger als auch ungültiger State werden auf Desktop und schmalem
Viewport geprüft. Der gültige Fall prüft außerdem Cookie-Rotation, Reload und
anschließendes Trennen. Keine Snapshot-Daten werden abgerufen.

Der neue Testhelfer `tests/support/linkedin-token-mock.mjs` wird ausschließlich
über `NODE_OPTIONS` im isolierten Testserver auf Port 3104 geladen. Er verlangt
die feste synthetische Testkonfiguration, simuliert den offiziellen Token-Endpunkt
und blockiert sonstige externe Server-Fetches. Der Anwendungscode besitzt keine
Mock-Umschaltung. Browserseitig werden alle externen Anfragen blockiert;
die simulierte Anmeldeseite liegt auf einer abgefangenen zweiten Loopback-Origin.
Es wurden weder echte App-Werte noch echte Tokens oder persönliche Daten gelesen,
in Artefakte übernommen oder für automatisierte Tests verwendet.

Abschließend erfolgreich: 850 Unit-Tests, Lint, Typecheck und
`CAREERMAP_DEV_IMPORT_TEST=1 npm run test:e2e` einschließlich Produktionsbuild.
Die Browserprüfungen umfassen 4 Produktions-/V0-Fälle, 26 Importfälle und
8 OAuth-Fälle, insgesamt 38. Datenbankprüfungen wurden für diese lokale
Zugriffskorrektur nicht erneut ausgeführt; Domäne und Persistenz bleiben unverändert.

Nachweise unter `artifacts/v1b-oauth-return/`: `red-unit.log`, `red-browser.log`,
`intermediate-browser.log`, `targeted-unit.log`, `unit.log`, `lint.log`,
`typecheck.log`, `browser.log` und `full-e2e.log`.
Die ursprünglichen RED-Screenshots/-Traces/-Videos liegen unter
`red-browser-artifacts/`; sie enthalten ausschließlich synthetische Testzustände.
Gesicherte Endberichte: `production-report/index.html`,
`import-report/index.html` und `oauth-report/index.html`.
Die Screenshots aus der Importprüfung zeigen weiterhin nur die synthetische Fixture.

Geändert: `src/lib/dev-import/access.ts`, `src/proxy.ts`,
`src/lib/dev-import/linkedin/routes.test.ts`, `playwright.oauth.config.ts`,
`tests/e2e-oauth/oauth-start.spec.ts` und dieses Dokument.
Neu: `tests/support/linkedin-token-mock.mjs`.
Vorhandene lokale Arbeiten und private Konfiguration bleiben erhalten.
Kein Commit, Push oder Merge.

Manuell: `http://localhost:3100/dev/import` direkt neu öffnen. Eine noch gültige
Sitzung zeigt bereits „Mit LinkedIn verbunden“. Andernfalls **Mit LinkedIn
verbinden** erneut wählen. Nach Freigabe muss die Importseite ohne 404 erscheinen,
„Mit LinkedIn verbunden“ anzeigen und **Karrieredaten abrufen** aktivieren.
Der Snapshot-Abruf bleibt eine getrennte manuelle Aktion. Bei einem veralteten
Entwicklungsserver mit `npm run dev:import` neu starten. Keine echte
Login-/Profildatenansicht für Screenshots oder Traces verwenden.

## Nachprüfung: 502 beim Snapshot-Abruf – sichere Diagnose

Die frühere Meldung „Format nicht unterstützt oder Abruf zu groß“ war keine
belastbare Größenfeststellung. Sie fasste JSON-, Struktur-, Feld-, Paging- und
Größenfehler zusammen. Der konkrete Live-Fehler ist daher noch nicht als behoben
nachgewiesen; dafür wird ausschließlich die neue, inhaltsfreie Diagnosezeile aus
einem separaten manuellen Abruf benötigt. Keine echten JSON-Inhalte oder Screenshots
werden dafür angefordert. Ein 502 allein beweist keine bestimmte Ursache.

Die offizielle [Snapshot-Dokumentation](https://learn.microsoft.com/en-us/linkedin/dma/member-data-portability/shared/member-snapshot-api)
wurde erneut geprüft: versionierter Domänenabruf mit `202312`, genau ein
Domänenelement pro Antwort und paginierte Snapshot-Daten. Der bestehende
Normalisierungsadapter bleibt unverändert. Das Zielformat im Editor ist ein
einzelnes `elements`-Objekt mit PROFILE, POSITIONS und EDUCATION;
PROFILE enthält weiterhin nur `[{}]`. Das lokale Phase-D-Korpus ist laut seinem
Audit ein separates Profilarray, kein belegter Vertrag der offiziellen API.
Es wurden ausschließlich dessen Dokumentation und neu verfasste beziehungsweise
bereits versionierbare synthetische Testdaten gelesen; keine Inhalte aus
`.local-fixtures/phase-d/` wurden gelesen oder übernommen.

Minimal ergänzt: `INVALID_RESPONSE` beschreibt nur noch ein unerwartetes Format.
`RESPONSE_TOO_LARGE` und `IMPORT_LIMIT_EXCEEDED` unterscheiden Größen- und
Anzahllimits. Der Provider hängt feste Prüfschritt-Codes, die angefragte Domäne,
den nullbasierten Seitenindex und gegebenenfalls den HTTP-Status an. Die Route
und die Oberfläche kopieren ausschließlich erlaubte Werte; zusätzliche Felder,
Providertexte, URL-/Header-Inhalte, Token und Rohdaten werden nicht ausgegeben.
Die sichtbare Seitennummer beginnt bei 1. Es gibt kein neues Diagnose-Logging.

Beispiele für die vollständig teilbare Diagnosezeile:

```text
Diagnose: EDUCATION · Seite 1 · PAGING_START
Diagnose: POSITIONS · Seite 2 · BODY_SIZE
Diagnose: POSITIONS · Seite 1 · HTTP_STATUS · HTTP 426
```

Die Limits sind unverändert: 500.000 Bytes pro Snapshot-Antwort,
10.000 Zeichen je benötigtem Feld, 1.000 Stationen/100 Seiten je Domäne,
200.000 Zeichen für die kompakte Editorprojektion und 45 Sekunden Gesamtzeit.
Ein Fehler übernimmt weiterhin keine Teilergebnisse. Unbekannte Felder werden
nicht als fachliche Angaben interpretiert; fehlende Werte werden nicht erfunden.

RED: Vier neue Unit-Prüfungen und die Diagnose-Browserprüfung auf zwei Viewports
scheiterten zunächst an der zusammengefassten Fehlerbehandlung beziehungsweise
fehlenden Diagnose. GREEN: 854 Unit-Tests, Lint und Typecheck erfolgreich.
Der Gesamtbrowserlauf inklusive Produktionsbuild war erfolgreich: 4 V0-/
Produktionsprüfungen, 28 Importprüfungen und 8 OAuth-Prüfungen, insgesamt 40.
Der vollständige OAuth-Browserablauf prüft jetzt zusätzlich den tatsächlichen
Provider-/Adapter-/API-Durchstich bis zum Editor sowie den anschließenden
vollständigen Fixture-Austausch. Token- und Snapshot-Endpunkte werden serverseitig
mit ausschließlich synthetischen Antworten simuliert; alle sonstigen externen
Server-Fetches bleiben blockiert. Es werden nur EDUCATION und POSITIONS angefordert.

Geändert: `src/lib/dev-import/linkedin/provider.ts`, `errors.ts`, `routes.ts`,
deren vorhandene Tests, `src/app/dev/import/import-editor.tsx`,
`tests/e2e-import/linkedin-import.spec.ts`, `tests/e2e-oauth/oauth-start.spec.ts`,
`tests/support/linkedin-token-mock.mjs` und dieses Dokument.
Neu: `src/lib/dev-import/linkedin/errors.test.ts`.
Keine Änderung an Domäne, Normalisierungsvertrag, privater Konfiguration oder
Persistenz. Datenbankprüfungen wurden für diese Fehlerdiagnose nicht wiederholt.
Kein Commit, Push oder Merge.

Nachweise unter `artifacts/v1b-snapshot-diagnostics/`: `red-unit.log`,
`red-browser.log`, `targeted-unit.log`, `unit.log`, `lint.log`, `typecheck.log`,
`oauth-browser.log` und `full-e2e.log`.
Gesicherte Berichte: `production-report/index.html`, `import-report/index.html`,
`oauth-report/index.html`. RED-Screenshots/-Traces/-Videos unter
`red-browser-artifacts/` enthalten ausschließlich synthetische Testzustände;
die Import-Screenshots im Endbericht zeigen ausschließlich die synthetische Fixture.

Manuell: `/dev/import` vollständig neu laden, bei Bedarf erneut verbinden und
**Karrieredaten abrufen** wählen. Bei erneutem Fehler ausschließlich die Zeile
„Diagnose: …“ mitteilen. Bei Erfolg bleiben echte Angaben nur im temporären
Editor und werden weiterhin erst nach vollständigem Fixture-Austausch für die
Karriereansicht freigegeben. Die tatsächliche Live-Ursache und erfolgreiche
Live-Abnahme bleiben bis zu dieser Rückmeldung offen.
