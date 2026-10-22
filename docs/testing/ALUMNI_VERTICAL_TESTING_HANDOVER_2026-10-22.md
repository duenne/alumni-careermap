# Alumni CareerMap – Vertical Testing Handover

**Datum:** 22.10.2026\
**Status:** Planung nach erfolgreichem UI-Checkpoint, vor Umsetzung/Abnahme V0\
**Repository:** https://github.com/duenne/alumni-careermap\
**Ausgangsbranch:** `feat/alumni-review-ui`\
**Referenzcommit:** `3531a4088220a036314afa5e50411514121bb5ef`\
**CI-Referenz:** https://github.com/duenne/alumni-careermap/actions/runs/39797219168

> **Wichtig:** Dieser Handover ist eine Arbeitszusammenfassung, keine normative Architekturdefinition. Zu Beginn jeder neuen Session den tatsächlichen Git-Stand prüfen. `AGENTS.md`, `docs/architecture/MVP_DOMAIN_MODEL.md`, `docs/requirements/REQUIREMENTS.md` und `docs/requirements/UC-01_ALUMNI_DATA_DONATION.md` sind maßgeblich. Ältere Prototyp-/Handover-Dokumente können überholte Datenmodelle beschreiben.

## 1. Projektziel

Alumni des Studiengangs Management Sozialer Innovationen (MSI) der Hochschule München sollen freiwillig akademische und berufliche Stationen teilen, explizit prüfen und bestätigen. Die pseudonymisierten Karrierewege sollen später studiengangsbezogen aggregiert und unter geeigneten Datenschutzvorkehrungen u. a. als Sankey-Diagramm dargestellt werden.

Geplante Eingangswege: LinkedIn über offizielle autorisierte Schnittstelle, CV und manuelle Eingabe. Alle Wege führen in dasselbe kanonische Domänenmodell.

## 2. Verifizierter technischer Stand am Referenzcommit

- Next.js 16 / React 19 / TypeScript, Prisma 7, PostgreSQL 17.
- Normatives MVP-Modell mit `Alumni`, `Degree`, `CareerStep`, `AlumniTimelineItem`, `Survey`, `SurveyResponse`, optional `AlumniContact` und Katalogentitäten.
- Interaktive Demo auf `/` und `/review` mit fiktivem LinkedIn-Snapshot, normalisierter Beobachtung, Degree-Review und bearbeitbarer Entwurfsreihenfolge.
- Demo ist **keine** produktive Datenspende: keine abgeschlossene Speicherung über die UI, keine reale LinkedIn-OAuth-Anbindung, keine vollständige Profilbearbeitung nach Wiederaufruf und noch kein Sankey-Dashboard.
- GitHub Actions-Lauf #39797219168: `npm ci`, Lint, Unit-Tests, DB-Validierung, Integrationstests, Typecheck und Build erfolgreich.
- Bestehender Integrationstest verwendet isolierten, anschließend entfernten PostgreSQL-17-Dockercontainer; produktive `DATABASE_URL` wird dafür nicht verwendet.
- Die CI-Ergebnisse beweisen nicht automatisch vollständige Browser-User-Journeys.

## 3. Fachliche und technische Leitplanken

- Explizite Bestätigung des konkreten Referenzabschlusses pro `SurveyResponse`. Keine automatische Wahl nach Rang, Datum oder Einzeltreffer.
- Bestätigte `AlumniTimelineItem.position` ist eine **manuelle** Reihenfolge; Datumsreihenfolge ist nur Vorschlag. Überlappungen und Lücken sind erlaubt.
- Unpräzise/fehlende Zeiten, ungeprüfte Abschlüsse und unbekannte Katalogzuordnungen bleiben ungeklärt. Keine erfundenen Werte.
- Name/E-Mail nur im optionalen `AlumniContact`, niemals notwendige Voraussetzung einer bestätigten Datenspende.
- Kein dauerhaftes Speichern von LinkedIn-ID, Rohprofil, Token oder CV-Dateiverweis im kanonischen Karriereprofil.
- PostgreSQL-Migrationen und SQL-Constraints erhalten; kein `prisma db push` als Ersatz.
- Nur synthetische Testdaten. Kein Schreiben in produktive DB und kein öffentlicher Zugriff auf interne Testaggregation.
- Kleine Änderungen, TDD RED → GREEN → REFACTOR. Keine unaufgeforderten Commits, Pushes, Merges, Deployments oder großen Architekturänderungen.
- Eine Alumni-UUID ist **kein** Berechtigungs- oder Wiederaufnahmebeleg.

## 4. Geplante vertikale Inkremente (noch nicht freigegeben/abgenommen)

| ID | Vertikaler Use Case | End-to-End-Ergebnis | Status |
|---|---|---|---|
| V0 | Bestehende Review-Demo | Echte Browser-Journey auf `/review`, Screenshots, kein Persistenzversprechen | **Nächster Vorschlag** |
| V1 | Ein einfaches MSI-Profil speichern | UI → API → Domain-Service → transaktionale PostgreSQL-Speicherung → Nachweis | Geplant |
| V2 | Synthetischen LinkedIn-DMA-Snapshot importieren | Quelle → Normalisierung → Review → derselbe Speicherweg wie V1 | Geplant |
| V3 | Gespeichertes Profil wiederaufrufen und editieren | Berechtigter Zugriff → DB-Lesen → Bearbeiten → Speichern → Reload | Geplant; Zugriffskonzept offen |
| V4 | Sankey aus mehreren bestätigten synthetischen Profilen | PostgreSQL → Aggregationslogik → API → Browserdiagramm | Geplant; Auswertungsregel/Datenschutz offen |
| V5 | Echte LinkedIn-Datenportabilität | Offiziell freigegebene API → bestehende geprüfte Importpipeline | Geplant; Providerfreigabe offen |

**Priorität:** V0 klein und zeitlich begrenzt abschließen, dann rasch zu V1 als erstem echten Full-Stack-Durchstich gehen. Keine umfangreiche neue UI-Politur als Teil von V0.

## 5. V0: Konkretes manuelles Akzeptanzskript aus Codex-Plan

### Start und Ausgangszustand

```bash
nvm use
npm run dev -- --hostname 127.0.0.1 --port 3100
```

1. `http://127.0.0.1:3100/` öffnen, Demo-Hinweis prüfen und „Beispiel-Karriereweg ansehen“ wählen.
2. Auf `/review` prüfen: „Synthetic Internship“, „Synthetic M.Sc.“, „Synthetic Research Assistant“, „Synthetic Short Course“ (letzterer unter „Zeitlich noch einzuordnen“).
3. Erwartung: Referenzabschluss „Noch nicht ausgewählt“, keine Entwurfsplätze, Reihenfolgeübernahme deaktiviert. Screenshot **`01-ausgangszustand`**.

### Entscheidungen und Zeitlinie

4. „Prüfen: Synthetic M.Sc.“ öffnen. Ohne Eingaben anwenden: Fehlermeldung und Fokus auf relevantes Feld prüfen.
5. „Akademischer Abschluss → Master → Abgeschlossen“ auswählen und anwenden. Erwartung: „Im Entwurf geprüft“; Reihenfolge noch offen, kein normalisierter Abschluss.
6. Beim Short Course „Zeitlich einordnen“ öffnen und „Vor Synthetic M.Sc.“ wählen. Vor dem tatsächlichen Einfügen darf sich nichts bewegen.
7. „In den Entwurf einordnen“ klicken. Erwartete Reihenfolge: Internship → Short Course → M.Sc. → Research Assistant. `around 2018` bleibt ungenau.
8. „Reihenfolge für den Entwurf übernehmen“. Erwartung: Entwurfsplätze 1–4, M.Sc. „Teilweise normalisiert“, Abschlussjahr nicht angegeben, Katalogzuordnung unbekannt, Referenz weiterhin ungewählt. Screenshot **`02-bestaetigter-entwurf`**.
9. M.Sc. verschieben: bestätigte Plätze und normalisiertes Ergebnis werden ungültig; angewandte Degree-Entscheidungen bleiben erhalten. Reihenfolge erneut bestätigen.
10. Detailbereiche wechseln: maximal ein Bereich geöffnet; Entscheidungen bleiben erhalten.
11. „Entwurf zurücksetzen“, Ursprungszustand und Fokus prüfen.
12. Erneut bearbeiten und Seite neu laden: ursprüngliche Demo, „Nur Demo – nichts gespeichert“. Screenshot **`03-nach-reload`**.
13. Schmalen Viewport und Tastaturbedienung prüfen; relevante Fehler müssen zugänglich sein.

### Automatisierte V0-Akzeptanz

- Eine browserbasierte Journey (z. B. Playwright, nach Prüfung der vorhandenen Toolchain) bildet die sichtbaren Schritte, Zustandswechsel und Reset/Reload ab.
- Screenshots/Fehlerberichte werden als Testartefakte dokumentiert.
- Keine schreibenden Requests oder Datenbankpersistenz behaupten.
- Bestehende Tests und CI bleiben grün.
- V0 ist **erst nach manueller Abnahme** fertig.

## 6. Offene Produktentscheidungen – empfohlene Arbeitsannahmen, NICHT beschlossen

1. **Pilotdaten:** V0–V4 ausschließlich synthetisch und isoliert. Reale Datenspenden gesondert freigeben. Empfehlung: zustimmen.
2. **Zugang ohne E-Mail:** Vor V3 persönlichen sicheren Wiederaufnahmezugang konzipieren, einschließlich Verlust-/Widerrufsfall. Noch offen.
3. **Erneutes Absenden:** Wiederholung desselben technischen Vorgangs möglichst doppelsicher; keinen späteren Import automatisch mit einer Person zusammenführen. Noch fachlich zu bestätigen.
4. **Sankey:** Erste interne Analyse entlang bestätigter Timeline und expliziter Typ-/Levelinformationen. Zählung von Personen, Stationen und Kanten getrennt testen. Freitext nicht unbemerkt kategorisieren. Details vor V4 klären.
5. **Veröffentlichung:** V4 nur intern/synthetisch; Regeln für Mindestfallzahl, Seltenheit und Verantwortlichkeit müssen vor echter Veröffentlichung entschieden werden.
6. **LinkedIn:** Reale Member Data Portability API erst nach zuverlässiger Fixture-Integration und nach Klärung des Berechtigungsstatus. Keine Secrets im Chat teilen.

## 7. Noch zu sichern

Der zuletzt in die Unterhaltung eingefügte **Codex-Auszug** enthielt den V0-Testablauf und sechs Rückfragen, **nicht** den vollständigen priorisierten Code-Review-Bericht. Daher sind konkrete P0/P1-Findings aus Codex hier **nicht** verifiziert. Vor Beginn von V0 den vollständigen Bericht konsultieren und etwaige Blocker bewusst behandeln.

## 8. Arbeitsprotokoll für jede neue Codex-Session

1. `git status --short`, aktiven Branch und `git rev-parse HEAD` erfassen; nicht ungeprüft vom Referenzcommit ausgehen.
2. `AGENTS.md`, normatives Domain Model, Requirements und diesen Handover lesen; für das aktuelle Inkrement nur relevante Codepfade/Tests vertiefen.
3. Review-Findings/P0-Blocker und offene Entscheidungen prüfen. Vor fachlichen Architekturänderungen fragen.
4. Für **genau ein** freigegebenes Inkrement zuerst RED-Test schreiben, danach minimal implementieren und refaktorieren.
5. Relevante Tests sowie `npm run lint`, `npm test`, `npm run db:validate`, `npm run test:integration`, `npm run typecheck`, `npm run build` ausführen, soweit passend und verfügbar; Ausfälle ehrlich kennzeichnen.
6. Testergebnis, geänderte Dateien, bekannte Einschränkungen, genaue URLs und manuelle Abnahmeschritte berichten. Screenshots bereitstellen, wenn Browser-Sicht Teil der Akzeptanz ist.
7. **Vor Commit/Push auf ausdrückliche Abnahme und Anweisung warten.** Danach Handover-Status mit echtem Commit-SHA und nächsten offenen Punkten aktualisieren.
8. Erst dann neue Session für das nächste Inkrement beginnen.

## 9. Nächster Codex-Auftrag (für frischen Kontext)

> Lies zuerst `AGENTS.md`, `docs/architecture/MVP_DOMAIN_MODEL.md`, `docs/requirements/REQUIREMENTS.md`, `docs/requirements/UC-01_ALUMNI_DATA_DONATION.md` und `docs/testing/ALUMNI_VERTICAL_TESTING_HANDOVER.md`. Prüfe Git-Status, Branch und HEAD. Ziehe den vollständigen Code-Review-Bericht hinzu und nenne eventuelle P0/P1-Blocker. **Arbeite ausschließlich an V0.** Erstelle einen schlanken Browser-E2E-Test für die bestehende Review-Demo nach dem manuellen V0-Akzeptanzskript. Keine produktive Speicherung, kein LinkedIn-OAuth, kein Sankey, kein großes UI-Refactoring. Arbeite TDD-orientiert und halte den Patch klein. Frage nur, wenn eine für V0 entscheidende Unklarheit nicht aus Code/Dokumentation lösbar ist. Dokumentiere RED/GREEN, Testresultate, Screenshots und exakte manuelle Abnahme. **Keine Commits, Pushes oder Merges ohne meine Freigabe.**
