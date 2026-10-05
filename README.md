# Alumni CareerMap

Self-hostbarer Open-Source-Bootstrap mit Next.js, React, TypeScript, Prisma
und PostgreSQL. Es sind noch keine Domainmodelle oder Alumni-Daten enthalten.

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
die Anwendung. Das Schema hat zunächst keine Domainmodelle und keine fachlichen
Migrationen. PostgreSQL ist die einzige unterstützte Datenbank.

`GET /api/health` prüft mit Prisma die Datenbankverbindung und antwortet mit
HTTP 200 (`{"status":"ok"}`) oder HTTP 503 (`{"status":"unavailable"}`).
Der Endpunkt gibt keine Datenbankdetails aus.

`docker compose down` beendet die Container; das Datenbankvolume bleibt bestehen.
Für öffentliches Hosting ist HTTPS über die vorhandene Hosting-Infrastruktur
einzurichten. Die Anwendung bindet auf dem Host zunächst nur an Loopback.

## Lokale Entwicklung und Prüfungen

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
npm run typecheck
npm run build
```

Tests verwenden keine Alumni-Daten. Builds benötigen weder Datenbankzugriff noch
Secrets. Generierter Prisma-Code und lokale `.env`-Dateien werden nicht versioniert
und nicht in den Docker-Build-Kontext übernommen.

Neue fachliche Migrationen werden später mit `npm run db:migrate` erstellt und
versioniert. Produktionsmigrationen laufen über `npm run db:deploy`; es gibt
keinen automatischen Seed.

Die Analyse verbleibender Dependency- und ESLint-Probleme steht in
[`docs/DEPENDENCY_AUDIT.md`](docs/DEPENDENCY_AUDIT.md).
