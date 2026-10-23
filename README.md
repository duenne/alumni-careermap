# Alumni CareerMap

Self-hostbare Open-Source-Anwendung mit Next.js, React, TypeScript, Prisma
und PostgreSQL 17. Die Domänengrundlage aus Phase A und Phase B ist vollständig:
Institution, Program, Survey, Alumni, Degree, SurveyResponse, Organisation,
CareerStep, AlumniTimelineItem und das optionale AlumniContact bilden die zehn
kanonischen Domänenentitäten. Es gibt keine Seed- oder Alumni-Daten.
Die fachliche Quelle ist [`docs/architecture/MVP_DOMAIN_MODEL.md`](docs/architecture/MVP_DOMAIN_MODEL.md).

## Repository-Dokumentation

- [Architekturübersicht mit Komponentendiagrammen](docs/architecture/REPOSITORY_OVERVIEW.md): aktueller Arbeitsbaum, Oberfläche, Normalisierung, Domain-Services und Deployment.
- [Datenmodell mit ER-Diagramm](docs/architecture/DATA_MODEL.md): alle zehn Tabellen, Kardinalitäten, Schlüssel, SQL-Constraints und Löschregeln.

## Voraussetzungen

- Node.js 22.23.3 (lokal und CI über `.nvmrc`, Docker über den Image-Tag).
  `package.json#engines` unterstützt ausschließlich Node.js 22 ab diesem Patchstand.
- npm
- Docker mit Docker Compose

## Start mit Docker Compose

1. `.env.example` nach `.env` kopieren.
2. Ein neues lokales `POSTGRES_PASSWORD` setzen und denselben Wert URL-kodiert
   in `DATABASE_URL` einsetzen. Der Datenbankhost ist `db`.
3. `docker compose up -d --build` ausführen.
4. `http://localhost:3000` öffnen.

Compose startet PostgreSQL, führt `prisma migrate deploy` aus und startet danach
die Anwendung. Die fünf versionierten PostgreSQL-Migrationen bauen das vollständige
Schema von Phase A und Phase B auch auf einer leeren Datenbank auf.
PostgreSQL 17 ist die einzige unterstützte Datenbank.

`GET /api/health` prüft mit Prisma die Datenbankverbindung und antwortet mit
HTTP 200 (`{"status":"ok"}`) oder HTTP 503 (`{"status":"unavailable"}`).
Der Endpunkt gibt keine Datenbankdetails aus.

`docker compose down` beendet die Container; das Datenbankvolume bleibt bestehen.
Für öffentliches Hosting ist HTTPS über die vorhandene Hosting-Infrastruktur
einzurichten. Die Anwendung bindet auf dem Host zunächst nur an Loopback.

## Lokale Entwicklung und Prüfungen

Der [vollständige lokale LinkedIn→Datenbank-Workflow](docs/testing/V1D_LINKEDIN_DATABASE_WORKFLOW.md)
startet mit `npm run dev:workflow` unter `http://localhost:3100/dev/import`.
Die Einrichtung ergänzt das private PostgreSQL-Passwort in `.env.local` und
startet eine separate PostgreSQL-17-Testdatenbank mit persistentem Docker-Volume.
LinkedIn-JSON laden, durch eines der 100 lokalen Beispiele ersetzen, bearbeiten,
bestätigt speichern und als Datenbank-Timeline wieder anzeigen erfolgt auf einer Seite.
Der [temporäre Mapping-Test](docs/testing/V1C_JSON_DATABASE_MAPPING.md) bleibt separat verfügbar.

```sh
nvm install
nvm use
npm ci
npm run db:generate
npm run dev
```

Für eine lokal laufende Next.js-Anwendung muss `DATABASE_URL` auf eine lokal
erreichbare PostgreSQL-Instanz zeigen. Die Compose-Datenbank veröffentlicht
standardmäßig keinen Host-Port.

```sh
npm run lint
npm test
npm run db:validate
npm run test:integration
npm run typecheck
npm run build
```

Integrationstests benötigen Docker. `npm run test:integration` startet einen
isolierten PostgreSQL-17-Container, migriert eine leere Datenbank und prüft die
DB-Invarianten direkt über SQL. Die vorhandene `DATABASE_URL` wird nicht benutzt;
der Testcontainer wird anschließend entfernt. Technische Testdatensätze leben
nur in zurückgerollten Transaktionen; es gibt keine Fixture-Dateien oder Seeds.
Die CI führt bei Pushes und Pull Requests dieselben Prüfungen aus, einschließlich
eines expliziten Typechecks vor dem Produktionsbuild.

Tests verwenden keine personenbezogenen Alumni-Daten. Builds benötigen weder Datenbankzugriff noch
Secrets. Generierter Prisma-Code und lokale `.env`-Dateien werden nicht versioniert
und nicht in den Docker-Build-Kontext übernommen.

Neue fachliche Migrationen werden später mit `npm run db:migrate` erstellt und
versioniert. SQL-only Checks und `NULLS NOT DISTINCT` müssen dabei erhalten bleiben;
`prisma db push` ersetzt die Migrationen nicht. Produktionsmigrationen laufen über `npm run db:deploy`; es gibt
keinen automatischen Seed.

Die Analyse verbleibender Dependency- und ESLint-Probleme steht in
[`docs/DEPENDENCY_AUDIT.md`](docs/DEPENDENCY_AUDIT.md).
