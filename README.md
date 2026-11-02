# Alumni CareerMap

Alumni CareerMap ist eine selbst hostbare Open-Source-Anwendung für
studiengangsbezogene Alumni-Befragungen. Alumni erfassen und prüfen ihren Bildungs-
und Berufsweg; Studiengangsleitungen können bestätigte Teilnahmen auswerten und
Karrierepfade in einem Sankey-Diagramm untersuchen.

Die Anwendung verwendet Next.js, React, TypeScript, Prisma und PostgreSQL 17.
Eine Installation gehört zu genau einer Hochschule oder Fakultät. Es sind keine
Vercel-, Supabase- oder KI-Dienste erforderlich.

**Stand: 2. November 2026.** Der aktuelle Stand ist ein lokal betreibbarer
Demonstrator. Eine vollständige Freigabe für öffentliche Befragungen mit echten
Alumni-Daten steht noch aus. Die folgenden Anleitungen unterscheiden deshalb
zwischen dem Ausprobieren, der persistenten Demo und der technischen Docker-Basis.

**Für Lehrende und Studiengangsleitungen:** Das
[Handbuch mit Screenshots (PDF)](docs/Alumni_CareerMap_Handbuch.pdf) erklärt
Befragungsverwaltung, Einladung, Teilnahme und Interpretation der Ergebnisse.
Es zeigt den lokalen Demonstrationsstand. Diese README ergänzt die technische
Einrichtung und den Betrieb.

## Orientierung

- [Funktionsumfang und Grenzen](#funktionsumfang-und-grenzen)
- [Voraussetzungen](#voraussetzungen)
- [Schnellstart aus einem frischen Clone](#schnellstart-aus-einem-frischen-clone)
- [Persistente lokale Demo](#persistente-lokale-demo)
- [Docker-Compose-Basis](#docker-compose-basis)
- [Betrieb, Updates und Datensicherung](#betrieb-updates-und-datensicherung)
- [Vor einem öffentlichen Produktivbetrieb](#vor-einem-öffentlichen-produktivbetrieb)
- [Fehlerbehebung](#fehlerbehebung)
- [Entwicklung und Prüfungen](#entwicklung-und-prüfungen)
- [Weitere Dokumentation und Lizenz](#weitere-dokumentation-und-lizenz)

## Funktionsumfang und Grenzen

| Bereich | Aktueller Stand |
| --- | --- |
| Befragungsverwaltung | Studiengänge ergänzen, Befragungen als Entwurf anlegen, Texte mit Desktop-/Mobilvorschau bearbeiten, öffnen und schließen. Betreiberzugriff mit lokalem HTTP Basic. |
| Teilnahme | Stationen prüfen, ergänzen, korrigieren und ordnen; eigenen abgeschlossenen Referenzabschluss und Beitrag ausdrücklich bestätigen; transaktional speichern. Eingabewege hängen vom Startmodus ab. |
| Manuelle Eingabe | In der persistenten Installation für genau eine ausdrücklich freigeschaltete Befragung verfügbar. |
| LinkedIn | Optionaler Import über eine genehmigte Third-Party-Schnittstelle mit eigener Konfiguration. Für den synthetischen Schnellstart nicht erforderlich. |
| Auswertung | Geschützte, befragungsbezogene Auswertung; die Sankey-Projektion unterstützt derzeit den konfigurierten MSI-Bachelor-Piloten (Management Sozialer Innovationen). Master Informatik kann als Befragung angelegt und durchlaufen werden, besitzt aber noch keine passende Sankey-Projektion. |
| Noch offen | CV-Upload, Hochschul-SSO/Benutzerverwaltung, automatisierte Fristen und Erinnerungen, E-Mail-Versand, gesonderte Ergebnisveröffentlichung und persönlicher Archivzugang. |

Ein Survey ist eine Befragung zu genau einem Referenzstudiengang. Sein Status ist
`DRAFT` (Entwurf), `OPEN` (geöffnet) oder `CLOSED` (geschlossen). Nur geöffnete
Befragungen nehmen neue bestätigte Antworten an. Schließen erhält vorhandene
Antworten und veröffentlicht keine Ergebnisse. Der Referenzstudiengang ist nach
dem Anlegen unveränderlich; eine andere Zielgruppe benötigt eine neue Befragung.

Karriereprofile sind pseudonymisiert, nicht anonym. Optionale Kontaktdaten sind im
Datenmodell getrennt. Daraus folgt noch kein fertiger Benachrichtigungs- oder
Einwilligungsprozess. Synthetische Beispiele sind fiktive Testdaten und dürfen
nicht als reale Alumni-Teilnahmen oder Studienergebnisse behandelt werden.

## Voraussetzungen

| Voraussetzung | Verwendung |
| --- | --- |
| Git | Repository beziehen und einen nachvollziehbaren Versionsstand wählen. |
| Node.js 22 ab 22.23.3, kleiner als 23; npm | Lokale Starter und Entwicklung. `.nvmrc` und Docker-Build verwenden 22.23.3. Bei reinem Compose-Betrieb ist kein Node.js auf dem Host nötig. |
| Docker mit Compose v2 | PostgreSQL und optional die gesamte Anwendung. Für `demo:local` zusätzlich Docker Engine ab Version 28 mit lokalem Unix-Socket. |
| PostgreSQL 17 | Einzige unterstützte Datenbank; wird von den beschriebenen Docker-Startwegen bereitgestellt. |

Die Shell-Beispiele verwenden eine POSIX-Shell. Die persistente Demo setzt eine
lokale Umgebung mit Unix-Dateirechten und `ps` voraus; die bisherige Betriebsabnahme
erfolgte unter macOS mit Docker. Eine allgemeine Windows-Abnahme liegt nicht vor.
Paket- und Image-Downloads benötigen beim ersten Einrichten Netzwerkzugriff.

Den passenden Startweg wählen:

| Ziel | Startweg | Was bleibt nach dem Beenden? |
| --- | --- | --- |
| Den Ablauf erstmals ausprobieren | [Schnellstart](#schnellstart-aus-einem-frischen-clone), ohne zusätzliche Datendateien | Keine Testdaten. |
| Die Demo wiederholt nutzen und manuelle Teilnahme prüfen | [Persistente Demo](#persistente-lokale-demo), mit gesondertem synthetischem 100er-Bestand | Datenbank und private Installationskonfiguration. |
| Container, Migrationen und Healthcheck prüfen | [Compose-Basis](#docker-compose-basis), ohne freigeschaltete Befragungsoberfläche | Datenbankvolume und `.env`. |

## Schnellstart aus einem frischen Clone

Dieser Weg zeigt Verwaltung, synthetische Teilnahme und Auswertung ohne
LinkedIn-Zugang und ohne zusätzliche lokale Datendateien.
**Beim Beenden werden die Testdaten entfernt.** Für Daten über Neustarts hinweg
den Abschnitt [Persistente lokale Demo](#persistente-lokale-demo) verwenden.

```sh
git clone https://github.com/duenne/alumni-careermap.git
cd alumni-careermap
nvm install
nvm use
npm ci
```

`nvm` ist optional; alternativ Node.js in der oben genannten Version installieren.
Docker starten. In einer neuen privaten `.env.local` im Repository-Stamm ein
eigenes Testpasswort mit mindestens 32 Zeichen hinterlegen:

```dotenv
CAREERMAP_SURVEY_ADMIN_TOKEN=HIER_EIN_EIGENES_ZUFAELLIGES_PASSWORT_EINTRAGEN
```

Den Platzhalter ersetzen. Eine vorhandene `.env.local` nur ergänzen. Die Datei
bleibt lokal und wird nicht eingecheckt. Dann:

```sh
npm run dev:integrated
```

Der Starter erzeugt eine isolierte PostgreSQL-17-Testdatenbank, wendet die
versionierten Migrationen an und startet die Anwendung. Er verwendet keine
bestehende Datenbank und kein persistentes Volume. Ohne eigene
LinkedIn-Callback-Konfiguration lautet die Adresse **http://localhost:3100**;
maßgeblich ist die im Terminal ausgegebene Adresse.

1. „Befragungen verwalten“ öffnen. Benutzer: `operator`; Passwort: der selbst
   gesetzte Wert von `CAREERMAP_SURVEY_ADMIN_TOKEN`.
2. Eine Befragung für das vorhandene synthetische MSI-Programm anlegen,
   Einstiegstexte bearbeiten und die Befragung öffnen.
3. Den Einladungslink in einem separaten privaten Browserfenster öffnen und den
   synthetischen Testweg wählen. Testprofil laden, Stationen prüfen, den passenden
   Referenzabschluss auswählen und beide Bestätigungen bewusst setzen.
4. Verbindlich speichern. Im Betreiberfenster die bestätigte Teilnahme und die
   geschützte Auswertung derselben Befragung prüfen.
5. Die Befragung schließen und den Einladungslink erneut prüfen: Neue Beiträge
   sind gesperrt, gespeicherte Antworten bleiben bis zum Beenden erhalten.

`Strg+C` beendet den Starter und entfernt seinen Datenbankcontainer samt Testdaten.
Nur synthetische Angaben verwenden. Details stehen im
[integrierten Testablauf](docs/testing/V3_END_TO_END_INTEGRATION.md).

## Persistente lokale Demo

Dieser Startweg betreibt einen echten Next.js-Produktionsbuild auf dem Host und
PostgreSQL 17 in Docker. Daten bleiben in einem eigenen externen Docker-Volume
erhalten. Die Anwendung bindet ausschließlich an **127.0.0.1:3114**, die Datenbank
an **127.0.0.1:5435**. Beide Ports müssen frei sein.

### Zusätzliche Voraussetzung: synthetischer 100er-Bestand

Der Demo-Seed benötigt zwei gesondert bereitgestellte Dateien:

```text
.local-fixtures/phase-d/all_linkedin_snapshots.json
.local-fixtures/phase-d/all_expected_normalized.json
```

**Diese Dateien sind nicht im Repository enthalten.** Vor diesem Startweg muss
der bereits geprüfte synthetische Bestand vorliegen. Das Programm prüft seine
fest hinterlegten Prüfsummen; beliebige eigene JSON-Dateien sind kein Ersatz.
Es gibt derzeit keinen automatischen Download dieses Bestands. Ohne ihn den
oben beschriebenen Schnellstart verwenden. Keine echten Profile oder Legacy-Daten
in das Repository kopieren. Die Prüfung ist in der
[Quellenrichtlinie](src/lib/demo-seed/source-policy.ts) festgelegt.

### Erstinstallation

Nach Clone, Node-Auswahl und `npm ci` wie beim Schnellstart:

```sh
docker pull postgres:17-bookworm
npm run demo:local -- init
npm run demo:local -- db-up
npm run demo:local -- migrate
npm run demo:local -- catalog-init
npm run demo:local -- seed --confirm-synthetic-references
npm run demo:local -- build
npm run demo:local -- start
```

Die Schritte initialisieren die Installation, starten die Datenbank, migrieren das
Schema, legen den synthetischen Hochschul-/Studiengangskatalog an und erzeugen die
geschlossene Demo-Befragung A mit 100 fiktiven Profilen. Der Seed ist bei
unverändertem Demo-Zustand idempotent und wird nur ausdrücklich ausgeführt.
Start und Neustart migrieren und seeden nicht automatisch.
Bei einem Fehler den Ablauf unterbrechen und die Ursache beheben, bevor der
nächste Schritt ausgeführt wird.

**http://127.0.0.1:3114/admin/surveys** öffnen. Benutzer: `operator`.
Das generierte Betreiberpasswort steht in der privaten Datei
`.local-demo/v5/runtime.json` unter `CAREERMAP_SURVEY_ADMIN_TOKEN`.
Dieser Startweg erzeugt eigene Zugangsdaten und übernimmt nicht das Passwort aus
der `.env.local` des Schnellstarts.

Für den vorgesehenen zweiten Testfall im Betreiberbereich den Studiengang
**Master Informatik** ergänzen und eine Befragung
**SYNTHETISCH / DEMO – Master Informatik** als Entwurf anlegen.
Die UUID steht im Ziel des Links „Auswertung ansehen“:
`/admin/surveys/UUID/analytics`. Die Linkadresse kopieren und nur diese UUID
anstelle von `SURVEY_UUID` einsetzen. B dabei noch als Entwurf belassen;
ein Einladungslink wird erst nach dem Öffnen angezeigt.

```sh
npm run demo:local -- record-b --survey-id SURVEY_UUID
npm run demo:local -- verify
```

In diesem Abnahmezustand prüft `verify` genau A (`CLOSED`, 100 Antworten) und B
(`DRAFT`, 0 Antworten) sowie den synthetischen Datenbestand. Weitere Befragungen
oder Änderungen an B verändern diesen Zustand. Eine fehlgeschlagene Prüfung ist
deshalb nicht automatisch ein Datenbankausfall.

### Manuelle Teilnahme für Befragung B freischalten

Die Erstinstallation aktiviert noch keine Teilnahme-Schreibwege. Um die manuelle
Eingabe lokal zu prüfen, nach `record-b` die Befragung B im Betreiberbereich
öffnen, dann:

```sh
npm run demo:local -- stop
npm run demo:local -- enable-participation --survey-id SURVEY_UUID
npm run demo:local -- start
```

Den Einladungslink von B öffnen und „Selbst eintragen“ wählen. Die Freischaltung
gilt nur für diese registrierte Befragung. Mit fiktiven Studien- und Berufsstationen
testen; Befragung A bleibt getrennt und geschlossen. Im Teilnahmemodus berichtet
`verify` Status und Antwortzahlen beider Befragungen; erneutes Demo-Seeding ist
gesperrt. Eine Master-Teilnahme kann gespeichert werden, auch wenn die
Master-Sankey-Projektion noch nicht verfügbar ist.

Teilnahmesitzungen und Wiederholungsnachweise liegen im Serverprozess und gehen
bei einem App-Neustart verloren. Bereits gespeicherte Beiträge bleiben in
PostgreSQL erhalten. Es gibt keine dauerhafte Personenidentifikation oder
Wiederaufnahmegarantie; nach unklarer Abgabe zuerst den gespeicherten Stand prüfen.

<details>
<summary>Optional: LinkedIn für die lokale Teilnahme einrichten</summary>

Voraussetzung sind der aktivierte Teilnahmemodus und eine eigene genehmigte
LinkedIn-App für das Third-Party-Produkt. Die private `.env.local` ergänzen;
die Platzhalter durch eigene App-Werte ersetzen:

```dotenv
LINKEDIN_PORTABILITY_MODE=third_party
LINKEDIN_PORTABILITY_SCOPE=r_dma_portability_3rd_party
LINKEDIN_CLIENT_ID=EIGENE_CLIENT_ID
LINKEDIN_CLIENT_SECRET=EIGENES_CLIENT_SECRET
LINKEDIN_REDIRECT_URI=http://127.0.0.1:3114/auth/linkedin/portability/callback
```

Die Callback-URL muss exakt in der eigenen LinkedIn-App registriert sein. Der
gezeigte Callback gehört zur persistenten Demo; der Entwicklungs-Schnellstart
verwendet standardmäßig `localhost:3100`. Bei einer abweichenden lokalen
Callback-Origin startet die persistente Demo einen zusätzlichen lokalen Listener;
auch dessen Port muss frei sein.

```sh
npm run demo:local -- stop
npm run demo:local -- enable-linkedin
npm run demo:local -- start
```

`enable-linkedin` übernimmt die konfigurierten Werte ausdrücklich in die private
Datei `.local-demo/v5/linkedin.json`. Spätere Änderungen in `.env.local` werden
beim Start nicht automatisch übernommen. Eine gesetzte Client-ID allein bedeutet
keine funktionierende Schnittstellenfreigabe. Weitere Hinweise stehen in
[`.env.example`](.env.example) und im
[LinkedIn-Testleitfaden](docs/testing/V1B_LINKEDIN_OAUTH_ACCEPTANCE.md), der den
früheren Entwicklungs-Testweg beschreibt.

</details>

## Docker-Compose-Basis

[`compose.yaml`](compose.yaml) startet Datenbank, Migration und Anwendung gemeinsam.
Dieser Weg eignet sich zum Prüfen der Container- und Datenbankbasis aus einem
frischen Clone. Er aktiviert **keine Befragungsverwaltung oder Teilnahme**:
Im regulären Produktionsprofil bleiben diese lokalen Funktionen gesperrt.
Für die vollständige lokale Bedienung einen der obigen Startwege nutzen.

Im Repository-Stamm, sofern noch keine `.env` vorhanden ist:

```sh
cp .env.example .env
```

Eine vorhandene `.env` nur ergänzen. In der Datei zwei Werte setzen:

| Variable | Bedeutung |
| --- | --- |
| `POSTGRES_PASSWORD` | Neues, zufälliges Passwort für die Compose-Datenbankrolle `careermap`. |
| `DATABASE_URL` | `postgresql://careermap:URL_KODIERTES_PASSWORT@db:5432/careermap`; dasselbe Passwort URL-kodiert einsetzen. `db` ist der Hostname innerhalb des Compose-Netzes. |

```sh
docker compose up -d --build
docker compose ps -a
docker compose logs --tail=100 migrate app
curl --fail http://127.0.0.1:3000/api/health
```

Compose wartet auf PostgreSQL, führt `prisma migrate deploy` aus und startet die
App erst nach erfolgreicher Migration. Der Dienst `migrate` endet bei Erfolg
mit Exitcode 0. Die Startseite unter **http://127.0.0.1:3000** zeigt eine fiktive
Vorschau; eine leere Datenbank erhält keine Alumni-Daten und keinen automatischen
Seed. PostgreSQL veröffentlicht hier keinen Host-Port.

```sh
docker compose stop
docker compose start
```

Auch `docker compose down` behält das benannte Datenbankvolume.
**`docker compose down -v` löscht es samt Daten.** Ein geändertes
`POSTGRES_PASSWORD` in der `.env` ändert nicht das Passwort einer bereits
initialisierten Datenbank; eine Rotation muss zusätzlich in PostgreSQL erfolgen.

## Betrieb, Updates und Datensicherung

### Konfiguration und Zustand

| Startweg | Konfiguration | Dauerhafte Daten |
| --- | --- | --- |
| `dev:integrated` | Privates Testpasswort in `.env.local` bzw. Prozessumgebung | Keine; der Starter entfernt seine Testdatenbank beim Beenden. |
| `demo:local` | Automatisch erzeugte private Dateien unter `.local-demo/v5/`; feste Installations-, Cluster- und Volume-Zuordnung | Eigenes externes PostgreSQL-Volume; private Konfiguration gehört zur Installation. |
| `docker compose` | `.env`, Vorlage `.env.example` | Benanntes Compose-Volume `postgres_data` (tatsächlicher Name erhält einen Projektpräfix). |

Die Konfigurationen sind nicht austauschbar. `demo:local` verwendet keinen
Fallback auf `DATABASE_URL` oder `.env.local`; LinkedIn-Werte werden nur durch den
expliziten Freischaltbefehl übernommen. Die privaten Dateien enthalten Secrets.
Nicht einchecken, in Tickets kopieren oder mit Build-Artefakten veröffentlichen.

### Starten, stoppen und beobachten

Für die persistente Demo:

```sh
npm run demo:local -- stop
npm run demo:local -- db-stop
npm run demo:local -- db-up
npm run demo:local -- start
npm run demo:local -- verify
curl --fail http://127.0.0.1:3114/api/health
```

`stop` beendet die App, `db-stop` nur den Datenbankcontainer; das Volume bleibt
erhalten. Der App-Start läuft im Hintergrund. Nach einem Rechnerneustart sind
`db-up` und `start` erneut auszuführen; es gibt keinen eingerichteten Autostart
des Node-Servers. Das App-Log liegt in `.local-demo/v5/server.log`.

`GET /api/health` prüft die Datenbankverbindung: HTTP 200 mit
`{"status":"ok"}` oder HTTP 503 mit `{"status":"unavailable"}`. Der Endpunkt
liefert keine Datenbankdetails. Ein erfolgreicher Healthcheck ersetzt keine
Prüfung von Anmeldung, Befragungsstatus und Teilnahmeablauf.

### Updates und Migrationen

Vor jedem Update den Quellstand festhalten, Änderungen und Migrationen prüfen und
eine wiederherstellbare Sicherung erstellen. Neue Versionen zunächst an einer
isolierten Testinstallation prüfen.

Bei der persistenten Demo zuerst die App stoppen:

```sh
npm run demo:local -- stop
```

Dann den geprüften neuen Quellstand im bisherigen Installationspfad bereitstellen
und die zugehörigen Abhängigkeiten installieren. Die Datenbank muss laufen:

```sh
npm ci
npm run demo:local -- migrate
npm run demo:local -- build
npm run demo:local -- start
npm run demo:local -- verify
```

Anschließend Healthcheck und Betreiberoberfläche prüfen. Jeder Demo-Build erhält
ein eigenes Verzeichnis; ältere Builds werden nicht automatisch gelöscht. Das
PostgreSQL-Image ist pro Installation auf einen Digest festgelegt. Änderungen
des Images oder der gebundenen Compose-Datei benötigen einen gesondert geprüften
Aktualisierungspfad; ein erneutes `init` ersetzt diese Bindung nicht.

Für die Compose-Basis nach Sicherung und Bereitstellung des neuen Quellstands:

```sh
docker compose build
docker compose stop app
docker compose run --rm migrate
docker compose up -d app
```

Nur bei erfolgreich abgeschlossener Migration fortfahren; danach Logs und
Healthcheck prüfen. `docker compose restart` allein baut keinen neuen Code.
Ein Downgrade des App-Codes macht eine Datenbankmigration nicht rückgängig.
Es gibt keinen automatischen Datenbank-Rollback.

Alle Schemaänderungen laufen über versionierte
[Prisma-/PostgreSQL-Migrationen](prisma/migrations). SQL-Checks und echte
Fremdschlüssel sind Teil des Datenmodells. `prisma db push`, Reset oder erneutes
Seeding ersetzen keine Migration.

### Backup und Wiederherstellung

Ein persistentes Volume ersetzt kein Backup. Sicherungen außerhalb der
Installation aufbewahren, den Zugriff beschränken und Wiederherstellung regelmäßig
in einer isolierten Umgebung prüfen. Quellstand, Image-Versionen und benötigte
private Konfiguration zusammen mit dem Sicherungszeitpunkt dokumentieren.

Für die **Compose-Basis** lässt sich ein logisches Datenbankbackup erstellen.
`/sicherer/Pfad` muss ein vorhandenes geschütztes Sicherungsverzeichnis außerhalb
des Repositorys sein; einen neuen Dateinamen verwenden:

```sh
umask 077
docker compose exec -T db pg_dump -U careermap -d careermap --format=custom > /sicherer/Pfad/careermap.dump
```

Exitcode und Dateigröße prüfen. Zum Wiederherstellungstest eine **separate leere
PostgreSQL-17-Datenbank** mit passender Eigentümerrolle `careermap` bereitstellen.
Mit deren Verbindungseinstellungen, nicht mit der laufenden Installation:

```sh
pg_restore --host=RESTORE_HOST --port=RESTORE_PORT --username=careermap --dbname=RESTORE_DB --no-owner --exit-on-error /sicherer/Pfad/careermap.dump
```

Die `RESTORE_*`-Platzhalter ersetzen; der Client muss zu PostgreSQL 17 passen.
Passwörter über eine geschützte PostgreSQL-Passwortdatei oder Passwortabfrage
bereitstellen. Nach dem Restore Tabellen, Constraints, Antwortzahlen und die
Anwendung gegen das isolierte Ziel prüfen. Dieser Test ersetzt keine Sicherung
der privaten `.env` und des verwendeten Quellstands.

Für **`demo:local`** gehören das externe Datenbankvolume und die privaten
Installationsdateien unter `.local-demo/v5/` zusammen. Für eine konsistente
physische Sicherung App und Datenbank geordnet mit `stop` und `db-stop` beenden,
Volume-Inhalt und private Konfiguration geschützt sichern und anschließend wieder
starten. Nicht das Datenverzeichnis einer laufenden PostgreSQL-Instanz kopieren.
Bei einer Wiederherstellung müssen die gebundenen Volume-/Clusterkennungen,
Labels, Dateirechte, Installationspfad und das festgelegte Image erhalten bleiben.
Ein logischer Restore in einen neu erzeugten Cluster wird vom Demo-Starter
absichtlich abgewiesen. Dafür existiert derzeit kein automatisierter Recovery-Befehl und
kein allgemein abgenommener Restore-Ablauf; die Identitätsprüfung nicht umgehen.

## Vor einem öffentlichen Produktivbetrieb

Die vorhandenen Starter binden absichtlich an Loopback und prüfen Host und Origin.
Eine lokale Adresse wie `127.0.0.1` ist auf anderen Rechnern nicht als Einladung
erreichbar. Ein Reverse Proxy oder Tunnel allein macht den Demonstrator nicht zu
einem freigegebenen Alumni-Portal.

Für eine echte Erhebung sind insbesondere noch ein geeignetes Betreiber- und
Rollenmodell, eine geprüfte HTTPS-/Domain-Konfiguration, dauerhafte Sitzungs- und
Zugriffsverfahren sowie abgestimmte Datenschutz-, Auskunfts-, Berichtigungs- und
Löschprozesse erforderlich. Auch ohne Namen können ungewöhnliche Karrierewege
Personen erkennbar machen. Ergebnisfreigabe und Schutz kleiner Gruppen müssen
separat geregelt werden; das Schließen einer Befragung genügt dafür nicht.

Die Betriebsabnahme muss außerdem Autostart, Monitoring, Secrets-Verwaltung,
getrennte Datenbankrechte für Migration und Laufzeit sowie Backup/Restore und
Updates auf dem gewählten Hosting-Ziel umfassen. Die Compose-Basis verwendet
derzeit dieselbe Datenbankrolle für Migration und App; die persistente Demo
trennt diese Rollen bereits. Synthetische Testdaten müssen von echten
Befragungsdaten getrennt bleiben.

## Fehlerbehebung

| Symptom | Prüfung / nächster Schritt |
| --- | --- |
| Node-Versionsfehler | `node --version` mit `.nvmrc` vergleichen; Node 22 ab 22.23.3, kleiner als 23 verwenden. |
| Docker nicht erreichbar | Docker starten; `docker version` und `docker compose version` prüfen. `demo:local` verlangt Engine >=28 und einen lokalen Unix-Socket. |
| `PINNED_POSTGRES17_IMAGE_REQUIRED` / Image fehlt | Vor der ersten Demo-Initialisierung `docker pull postgres:17-bookworm` ausführen. Bestehende Image-Bindungen nicht manuell ersetzen. |
| `DEMO_PORT_ALREADY_IN_USE` | Belegung von 3114/5435 prüfen. Eine schon laufende Instanz verwenden oder den zugehörigen eigenen Dienst geordnet stoppen. |
| Fehlende Fixture-Datei / Prüfsummenfehler beim Seed | Die beiden freigegebenen synthetischen Dateien bereitstellen; alternativ den Schnellstart ohne 100er-Bestand nutzen. |
| 401 im Betreiberbereich | Benutzer `operator` und das Passwort des jeweiligen Startwegs verwenden. Der Browser kann HTTP-Basic-Zugangsdaten zwischenspeichern. |
| 404 für Verwaltung oder Teilnahme | Startmodus, exakte lokale Adresse, Host/Origin, Survey-Status und gegebenenfalls `enable-participation` prüfen. Die Compose-Basis schaltet diese Routen nicht frei. |
| HTTP 503 bei `/api/health` | Datenbankzustand und App-Logs prüfen. Bei Compose zusätzlich `docker compose ps -a` und `docker compose logs --tail=100 db migrate app`. |
| `FOREIGN_OR_MISSING_DEMO_VOLUME` / Identitätsfehler | Installation nicht neu initialisieren. Zugehöriges Volume und geschützte Metadaten prüfen; gegebenenfalls auf den geprüften Sicherungsstand zurückgreifen. |
| Migration fehlgeschlagen | App gestoppt lassen, Migrationsausgabe prüfen und Ursache beheben. Kein Reset, kein `db push` und keine manuelle Manipulation der Migrationshistorie. |
| Master-Auswertung nicht verfügbar | Aktuelle Projektionsgrenze; kein Nachweis fehlender oder verlorener Antworten. Antwortzahl und Befragung getrennt prüfen. |
| LinkedIn nicht verfügbar | Freigeschaltetes Third-Party-Produkt, vollständige private Konfiguration und registrierte Callback-Adresse prüfen. Ohne LinkedIn den synthetischen bzw. freigeschalteten manuellen Weg nutzen. |

Fehlerberichte können über die [GitHub-Issues](https://github.com/duenne/alumni-careermap/issues)
gestellt werden. Version/Commit, Startweg, Fehlermeldung und Schritte zur
Reproduktion angeben; Zugangsdaten und personenbezogene Inhalte aus Logs entfernen.

## Entwicklung und Prüfungen

Nach `npm ci` erzeugt `npm run db:generate` den Prisma-Client. `npm run dev`
startet die Basisoberfläche; für den vollständigen synthetischen Ablauf den
Schnellstart verwenden. Eine Host-Anwendung benötigt eine vom Host erreichbare
PostgreSQL-URL; `db` aus der Compose-Konfiguration ist nur im Docker-Netz erreichbar.
Der ältere persistente Import-/Mapping-Testweg ist im
[Workflow-Leitfaden](docs/testing/V1D_LINKEDIN_DATABASE_WORKFLOW.md) beschrieben.

```sh
npm run lint
npm test
npm run db:validate
npm run test:integration
npm run typecheck
npm run build
```

Die Integrationstests starten eine eigene kurzlebige PostgreSQL-17-Datenbank,
migrieren sie und prüfen unter anderem echte SQL-Constraints. Vorhandene
Datenbank-URLs werden dafür nicht verwendet. Tests arbeiten ausschließlich mit
synthetischen Daten. Optionale Tests mit dem nicht versionierten 100er-Korpus
können ohne diesen Bestand übersprungen werden; übersprungene Tests sind kein
Prüferfolg.

Zusätzliche Datenbankprüfungen für Demo-Seed und lokale Demo:

```sh
npm run test:demo-seed
npm run test:local-demo
```

Browserprüfungen benötigen Chromium und Docker; sie starten eigene Testserver:

```sh
npx playwright install chromium
npm run test:e2e
```

Die Standardprüfungen und Browser-Suites sind in der
[GitHub-Actions-Konfiguration](.github/workflows/ci.yml) beschrieben. Ein Build
benötigt keine produktiven Zugangsdaten und keine laufende Datenbank.
Neue Migrationen für Entwicklungsdatenbanken mit `npm run db:migrate` erstellen,
prüfen und versionieren; auf bestehenden Installationen nur die dafür vorgesehenen
Deploy-Migrationen ausführen (`npm run db:deploy` bzw. `demo:local -- migrate`).

## Weitere Dokumentation und Lizenz

| Dokument | Zweck |
| --- | --- |
| [Handbuch mit Screenshots (PDF)](docs/Alumni_CareerMap_Handbuch.pdf) | Bedienung für Lehrende und Studiengangsleitungen; Verwaltung ab S. 5, Alumni-Ablauf ab S. 10, Auswertung ab S. 13. |
| [Normatives MVP-Datenmodell](docs/architecture/MVP_DOMAIN_MODEL.md) | Verbindliche Domain-Regeln, Datenschutzgrenzen und Datenbankinvarianten. |
| [Architekturübersicht](docs/architecture/REPOSITORY_OVERVIEW.md) und [ER-Datenmodell](docs/architecture/DATA_MODEL.md) | Komponenten, Tabellen, Beziehungen und SQL-Constraints. |
| [Persistente Demo: Abnahme und technische Details](docs/testing/D1_4C_PERSISTENT_LOCAL_ACCEPTANCE.md) | Hintergrund zu Installationsbindung, Volume, Build und Neustart; historischer Abnahmestand vom 1. November. |
| [Befragungseditor](docs/testing/SURVEY_EDITOR.md) | Einstiegstexte, Vorschau und Migration vom 2. November. |
| [Auswertung verstehen](docs/testing/CAREER_UNDERSTANDING.md) | Sankey, Zählweisen und Grenzen der synthetischen Daten. |
| [Anforderungen](docs/requirements/REQUIREMENTS.md), [UC-01: Datenspende](docs/requirements/UC-01_ALUMNI_DATA_DONATION.md), [UC-02: Befragungslebenszyklus](docs/requirements/UC-02_SURVEY_LIFECYCLE_MASTER_INFORMATIK.md) | Fachliches Zielbild; noch offene Funktionen sind darin ausdrücklich zu unterscheiden. |
| [Dependency-Audit](docs/DEPENDENCY_AUDIT.md) | Dokumentierter Untersuchungsstand zu Abhängigkeiten. |

Ältere Phasenberichte dokumentieren den jeweiligen damaligen Stand. Für die
aktuelle Einrichtung gelten diese README, der aktuelle Code und die versionierten
Migrationen; fachlich ist das MVP-Datenmodell maßgeblich.

Lizenz: [GNU General Public License, Version 3 (GPLv3)](LICENSE).
