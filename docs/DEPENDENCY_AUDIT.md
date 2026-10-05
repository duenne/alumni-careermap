# Dependency audit

Stand: 2026-10-05. Next.js 16.3.8, React 19.3.0, Prisma 7.10.0.
Die Bereinigung betrifft ausschließlich Dependencies, Laufzeitversion und CI.
Prisma-Schema, API-Verhalten und Anwendungscode wurden nicht geändert.

## Vollständiger Ausgangsbefund

`npm audit` meldete neun hohe Paketbefunde. Das sind vier Advisories in drei
ursächlich betroffenen Paketen; npm zählt auch die betroffenen übergeordneten
Dependencies. Der moderate MySQL-Befund wird beim Paket unter dessen höchster
Severity zusammengefasst.

| Paket / Advisory | Ursache | Pfad | Einordnung | Entscheidung |
| --- | --- | --- | --- | --- |
| `braces` 3.0.3, [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) | Stack-Exhaustion durch tief verschachtelte Brace-Patterns; high | `eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces` | Transitive Development-Dependency | Kein veröffentlichter Patch; unverändert |
| `deepmerge-ts` 7.1.5, [GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx) | Stack-Exhaustion bei rekursiven Objektgraphen; high | `prisma → @prisma/config → deepmerge-ts` | Transitive CLI-Dependency; durch optionalen Peer auch im Produktionsgraphen | Fix erst ab 8.0.0; kein ungeprüfter Major-Override |
| `mysql2` 3.15.3, [GHSA-3f6p-5ww8-9rcr](https://github.com/advisories/GHSA-3f6p-5ww8-9rcr) | Auth-Plugin-Downgrade kann Klartext-Zugangsdaten preisgeben; high | `prisma → mysql2` | Transitive CLI-Dependency; durch optionalen Peer auch im Produktionsgraphen | Gezielter Override auf 3.24.5; Fix ab 3.22.0 |
| `mysql2` 3.15.3, [GHSA-rgwj-5xj2-c3m3](https://github.com/advisories/GHSA-rgwj-5xj2-c3m3) | Unbegrenzte Dekompression kann DoS auslösen; moderate | `prisma → mysql2` | Derselbe CLI-Pfad | Derselbe Override; Fix ab 3.23.1 |

Die neun Paketbefunde waren vollständig:

- Direkte Development-Dependencies: `eslint-config-next`, `prisma`.
- Transitive Development-Dependencies: `@next/eslint-plugin-next`, `fast-glob`,
  `micromatch`, `braces`.
- Transitive CLI-Dependencies mit `devOptional` im Lockfile: `@prisma/config`,
  `deepmerge-ts`, `mysql2`. Auch `prisma` ist mit `devOptional` markiert.
- Keine direkt unter `dependencies` deklarierte Dependency hatte einen eigenen
  Audit-Befund.

## Produktionsgraph und tatsächlicher App-Container

`prisma` ist in `package.json` als Development-Dependency deklariert.
`@prisma/client`, eine Production-Dependency, deklariert jedoch `prisma` als
optionalen Peer. npm nimmt deshalb die CLI und deren Abhängigkeiten auch in den
Produktionsgraphen auf. `--omit=dev` alleine entfernt diesen Pfad nicht.
Vor der Bereinigung meldete dieser Audit vier hohe Paketbefunde:
`prisma`, `@prisma/config`, `deepmerge-ts`, `mysql2`.

Der Standalone-App-Container enthält ausschließlich die vom Next.js-Build
benötigten Runtime-Dateien. Im neu gebauten App-Container wurden `prisma`,
`@prisma/config`, `deepmerge-ts`, `mysql2`, `braces` und `eslint` mit Nodes
Modulauflösung geprüft: alle waren nicht auflösbar. Das ersetzt keine allgemeine
Sicherheitsprüfung des Images. Das Build- und Migrationsimage enthält weiterhin
CLI- und Entwicklungswerkzeuge und muss getrennt vom App-Image bewertet werden.

MySQL wird von der Anwendung nicht unterstützt oder verwendet. `mysql2` wird
von der Prisma-CLI mitgebracht; der Override fügt keine Datenbankfunktion hinzu.

## Durchgeführte Dependency-Änderung

- `mysql2`: 3.15.3 → 3.24.5, ausschließlich unter `prisma` über `overrides`.
  Beide Advisories sind damit behoben. Das Update bleibt innerhalb Major 3;
  die [Upstream-Releases](https://github.com/sidorares/node-mysql2/releases)
  und die veröffentlichten Node-Engine-Anforderungen wurden geprüft.
- `prisma`, `@prisma/client`, `@prisma/adapter-pg`: weiterhin 7.10.0,
  nun gemeinsam exakt fixiert. Der Override gilt damit für den geprüften
  CLI-Stand. Bei einem Prisma-Update muss er erneut geprüft werden.
- Das Lockfile enthält die erforderlichen Änderungen der transitiven
  MySQL-Abhängigkeiten. Next.js, React und die übrigen direkten Paketversionen
  wurden nicht aktualisiert.

Prisma-Konfigurationsladen, Client-Generierung, Produktionsbuild, PostgreSQL-
Migrationen und die Prisma-Abfrage im Healthcheck funktionieren mit dem Override.
Ein MySQL-Verbindungstest wurde nicht durchgeführt, weil MySQL nicht unterstützt
wird.

## Verbleibende Befunde und verworfene Fix-Vorschläge

Nach der Änderung: `npm audit` **8 high**, `npm audit --omit=dev` **3 high**,
beide mit Exitcode 1.

- Fünf Paketbefunde entlang des `braces`-Pfads. Das Advisory nennt keinen Patch;
  auch die npm-Registry führt weiterhin 3.0.3 als aktuelle Version.
- Drei Paketbefunde entlang des `deepmerge-ts`-Pfads. Prisma 7.10.0 bindet
  7.1.5 exakt ein. Version 8 verändert unter anderem das Zusammenführen von
  Map-Werten und Mutationsverhalten; siehe die
  [Breaking Changes](https://github.com/RebeccaStevens/deepmerge-ts/releases/tag/v8.0.0).
  Der Major-Override wird deshalb nicht allein aufgrund eines grünen
  Bootstrap-Builds als allgemein Prisma-kompatibel angenommen.
- npm empfiehlt nach dem Fix einen Wechsel von `eslint-config-next` auf
  14.2.35 und von Prisma auf 6.12.0. Das wären Major-Downgrades des verwendeten
  Stacks, keine kompatiblen Updates. `npm audit fix --force` wurde nicht benutzt.

Diese Befunde bleiben sichtbar. Erforderlich sind geprüfte Upstream-Updates
für den Next.js-Lint-Pfad und die Prisma-Konfiguration.

## ESLint

Es liegt keine React-Kompatibilitätswarnung beim erfolgreichen Lint-Lauf unter
ESLint 9 vor. npm meldet die EOL-Deprecation von ESLint 9.39.5.
[ESLint 9 ist seit 2026-08-06 nicht mehr gepflegt](https://eslint.org/version-support/).

Das aktuelle `eslint-config-next` 16.3.8 bringt unter anderem
`eslint-plugin-react` 7.37.5 und `eslint-plugin-jsx-a11y` 6.10.2 mit.
Ihre veröffentlichten Peer-Bereiche unterstützen ESLint 9, aber nicht ESLint 10.
Der vorangegangene ESLint-10-Versuch scheiterte an der entfernten
`context.getFilename`-API in den React-Regeln.

Die vorhandenen Core-Web-Vitals-, React-, Accessibility- und TypeScript-Regeln
bleiben aktiv. Es wurden keine Regeln deaktiviert, Warnungen unterdrückt,
Peer-Anforderungen umgangen oder Kompatibilitäts-Shims eingeführt.
Die EOL-Warnung bleibt als offener Punkt bestehen. Für ein unterstütztes
Upgrade dieses Presets müssen dessen Plugins ESLint 10 unterstützen.
Eine alternative React-Lint-Suite wäre eine separate Migration des Regelsatzes.

## Node.js und CI

- `.nvmrc`: 22.23.3; lokal mit `nvm install` und `nvm use` aktivieren.
- `package.json#engines`: `>=22.23.3 <23`.
- Docker: `node:22.23.3-bookworm-slim`.
- CI: `.github/workflows/ci.yml` liest `.nvmrc` und führt `npm ci`, Lint,
  Tests und Build aus. Ein Remote-CI-Lauf wurde nicht ausgelöst.

Die lokalen Prüfungen und der Docker-App-Container verwendeten beide tatsächlich
Node.js 22.23.3 mit npm 10.9.9. Es gab keine Node-Engine-Warnung mehr.

## Verifikation

| Prüfung | Ergebnis |
| --- | --- |
| `npm run lint` | Exitcode 0 |
| `npm test` | Exitcode 0; zwei Tests bestanden |
| `npm run build` | Exitcode 0; Prisma-Generierung und Next.js-Build erfolgreich |
| `npm audit` | Exitcode 1; acht hohe Paketbefunde |
| `npm audit --omit=dev` | Exitcode 1; drei hohe Paketbefunde |
| Compose-Neubau und Start | Erfolgreich; Migrationscontainer Exitcode 0 |
| `GET /api/health` | HTTP 200, `{"status":"ok"}` |
| PostgreSQL | `pg_isready` und `SELECT 1` erfolgreich |
| `docker compose down` | Exitcode 0; Testcontainer und Netzwerk entfernt |

Compose wurde in einem separaten Testprojekt mit einem neu generierten,
temporären Passwort außerhalb des Repositorys ausgeführt.
Das ausschließlich für die Prüfung erzeugte Volume und die temporäre
Passwortdatei wurden anschließend entfernt.
