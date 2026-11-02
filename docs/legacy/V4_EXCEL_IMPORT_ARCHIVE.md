# Alumni CareerMap – V4-Importarchiv für spätere Umsetzung

**Stand:** 1. November 2026  
**Status:** Archivierter Analyse- und Spezifikationsstand, **nicht fachlich freigegebener Import**.  
**Neuer Projektfokus:** Zuerst ein vollständig testbarer, isolierter Demo-/Staging-Deployment-Pfad mit synthetischen Umfragen. Die historische MSI-Excel-Konvertierung und -Vorschau sind zurückgestellt.  
**Repository:** https://github.com/duenne/alumni-careermap  
**Geprüfte Ausgangsrevision:** `main` / `c0d0cbbce9b58d7dc5d55a1f805efb47971c2786`.

> **Datenschutz:** Dieses Dokument enthält nur Struktur-, Mengen- und Entscheidungsinformationen. Die originale Excel-Datei enthält personenbezogene beziehungsweise pseudonymisierte Karriereinformationen. Sie gehört **nie** in Git/GitHub, CI, öffentliche Testdaten, Cloud-Codex-Kontexte oder ungeprüfte Logs. Auch Pseudonyme sind nicht anonym. Alle tatsächlichen Quellprüfungen und ein künftiger Import erfordern einen autorisierten Verarbeitungsbereich, definierte Zwecke, Rechtsgrundlage, Rollen, Aufbewahrungs- und Löschregeln.

## A. Was für später aufgehoben werden muss

**Ausgangsdatei:** `MSI-Karrierewege_2026-10-21(1).xlsx` (lokale Kopie der privaten Originaldatei). Erwarteter SHA-256 laut vorherigem Quellaudit: `b0715354cc3b66d950652af2c110e1ea99d675879b738addd6833f60e9e8cc18`. Hash vor späterer Verarbeitung erneut lokal prüfen; der Hash selbst liefert keine Verarbeitungsberechtigung.

**Sieben Arbeitsblätter:** `Stationentabelle (alle)` (Primärquelle), `Profile` (Mitgliedschaft), `Werdegang` (Gegenprüfung), `Bündelung (Sankey)` (Vergleichsauswertung), `Kategorien` (Taxonomie), `Übersicht` (aggregierte Kontrolle), `Datenhinweise` (Quellsemantik).

**Basisbilanz aus lesender Prüfung:**

| Gegenstand | Wert |
|---|---:|
| Primäre Stationszeilen | 1.279 |
| Eindeutige Stationskennungen | 1.279 |
| Unterschiedliche Profilbezeichner | 115 |
| Scope `evaluated` | 105 Profile / 1.196 Stationen |
| Übrige Profile | 10 Profile / 83 Stationen |
| Automatische Vorschläge | 794 Zeilen |
| `Zuordnung offen` | 485 Zeilen |
| MSI-Ausgangspunkt-Markierungen insgesamt | 110 bei 109 Profilen |
| MSI-Markierungen im `evaluated`-Scope | 106 bei 105 Profilen |
| MSI-Doppelkandidaten | 1 Profil mit 2 Markierungen |
| Kollisionen `(Pseudonym, Quellreihenfolge)` | **2 Kollisionsgruppen, 5 Stationen, 2 Profile**; 3 zusätzliche Belegungen |
| Startpräzision | Monat 1.010; Jahr 252; unbekannt 17 |
| Endpräzision | Monat 883; Jahr 227; laufend 152; unbekannt 17 |

**Achtung:** Die historische Aussage „MSI bestätigt“ ist weder persönlicher Survey-Consent noch `SurveyResponse` noch eine verbindliche `referenceDegreeId`. Die Auswertung der 105 Profile ersetzt keine persönliche Bestätigung. Kein historischer Input darf als bestätigte Survey-Teilnahme importiert werden.

## B. Exaktes Originalschema – 37 Spalten

1. `Pseudonym`
2. `Zeitfenster`
3. `Organisation / Ausbildungsstätte`
4. `Funktion / Studium`
5. `Art der Tätigkeit`
6. `Beginn`
7. `Ende`
8. `Laufend`
9. `Beschäftigungsart / Bildungsstufe`
10. `Datentyp`
11. `Fachrichtung`
12. `Jobkategorie`
13. `Branche`
14. `Prüfstatus`
15. `Stationskennung`
16. `Stationsart`
17. `Beginn · Genauigkeit`
18. `Ende · Genauigkeit`
19. `Zeitraum · Originalangabe`
20. `Tätigkeits- / Studienbeschreibung`
21. `Originaltext · bereinigter Abschnitt`
22. `Früherer Originaltext · bereinigt`
23. `Organisationssektor`
24. `Quellabschnitt`
25. `PDF-Seite`
26. `Quellreihenfolge`
27. `Importversion`
28. `Erfassungsstatus`
29. `Fehlende Angaben / Prüfhinweise`
30. `Fachrichtung · Herkunft`
31. `Jobkategorie · Herkunft`
32. `Branche · Herkunft`
33. `Beschäftigungsart / Bildungsstufe · Herkunft`
34. `Zuordnung · Begründungen`
35. `Recherchequellen`
36. `Prüfnotizen`
37. `Neuimport · Abgleichhinweis`

Das Quellschema trennt `Beschäftigungsart / Bildungsstufe` **nicht** in zwei Spalten. „MSI bestätigt“ und „MSI · Ausgangspunkt“ sind **keine** zusätzlichen Originalheader. Die verbleibenden Quellfelder enthalten teils sensible Freitexte, die nur privat zu prüfen sind. Der Quellsektor `Organisationssektor` ist nicht automatisch die wirtschaftliche `Branche`.

## C. Historische 8/9/8-Kategorisierung (eigenes Vokabular)

**Job (8):** Führung; Strategie und Planung; Forschung und Entwicklung; Produktion und operatives Management; Controlling und Reporting; Marketing und Vertrieb; Beratung; Selbstständigkeit.

**Branche (9):** Produktion und verarbeitendes Gewerbe; IT und Technologie; Finanzen und Versicherungen; Handel und Konsumgüter; Gesundheitswesen und Pharma; Medien und Publishing; Öffentliche Verwaltung; Wissenschaft und Bildung; Dritter Sektor.

**Fachrichtung (8):** Mensch & Gesundheit; Kommunikation & Medien; Technik & Information; Wirtschaft & Recht; Gesellschaft & Politik; Natur & Umwelt; Stadt & Kultur; Gestaltung & Kunst.

Diese Kategorien weichen von der synthetischen V2.4-Testtaxonomie (`src/lib/analytics/prepare.ts`) und den heuristischen V3-Vorschlagslabels (`src/lib/career-import/classification.ts`) ab. Keine Namensgleichheit impliziert Identität, keine automatische dimensionsübergreifende Zuordnung. **„Beratung“** ist historisch Jobkategorie und synthetisch eventuell Branche. **„Selbstständigkeit“** als historisches Joblabel belegt nicht die Erwerbsform `SELF_EMPLOYMENT`. `Stadt & Kultur` darf nicht verloren gehen.

Die alten Kategorien sollen später in drei unabhängigen Quell-Dimensionen erhalten bleiben. Die fachliche kanonische Bedeutung ist getrennt: `Degree.fieldOfStudy`, `CareerStep.roleCategory`, ggf. `CareerStep.functionArea`, `Organisation.sector`.

Weitere Quellbesonderheiten aus dem Audit: `Organisationssektor` ist für die 1.279 Zeilen derzeit `Nicht zugeordnet`; `Stationsart` verteilt sich auf Beruf 958, Studium/Ausbildung 319, Praktikum 2. Die kombinierte Spalte `Beschäftigungsart / Bildungsstufe` enthält einen anomalen Wert `108` bei einer Zeile; nicht als bewiesenes Fachlabel interpretieren. Historische Vorschläge oder offene Kategorien liefern keinen automatischen Freigabestatus.

## D. Verbindliche Architekturgrenzen bei Wiederaufnahme

**Normativ:** `docs/architecture/MVP_DOMAIN_MODEL.md` im dann aktuellen Repo; ferner `AGENTS.md`, `docs/requirements/REQUIREMENTS.md`, `docs/requirements/UC-01_ALUMNI_DATA_DONATION.md`. Aktueller Code und normative Dokumente sind vor Wiederaufnahme erneut zu prüfen; dieser Archivstand überschreibt niemals später beschlossene Architektur.

Das bestehende Domain Model enthält `Alumni`, `Degree`, `CareerStep`, `AlumniTimelineItem`, `Institution`, `Program`, `Organisation`, `Survey`, `SurveyResponse`, optional `AlumniContact` (PostgreSQL 17). `SurveyResponse.referenceDegreeId` ist ausschließlich der ausdrücklich bestätigten Teilnahme vorbehalten. Keine Änderung des Domain Models, keine neuen produktiven Tabellen, keine Prisma-Migration, kein `prisma db push` zum Einführen einer Excel-Sonderstruktur.

**Vorgesehener, noch nicht implementierter lokaler Ablauf:**

1. Original-XLSX nur auf autorisiertem System lesen, nie aus dem Repository.
2. Jede physische Primärzeile separat im geschützten lokalen Quellledger mit Quellrevision, Datumstyp, Eindeutigkeit und Scope nachweisen.
3. Pro Profil aus fachlich sicheren Zeilen `NormalizationInput { stations: SourceStation[] }` erzeugen; unveränderten bestehenden Vertrag nutzen (`src/lib/normalization/contract.ts`, `validate.ts`, `normalize-career-batch.ts`, `apply-explicit-review-assertions.ts`).
4. Zusätzliche Taxonomien, Herkunft, Originalpräzision, Prüfnotizen und MSI-Ankerkandidaten bleiben im lokalen typisierten **Sidecar**. Kein Missbrauch von `SourceStation.category` für zusätzliche Dimensionen.
5. `Degree`-/`CareerStep`-/Timeline-Projektion **nur als lokale Preview** und ohne Speicherung. Keine `SurveyResponse`, kein `confirmedAt`, kein `saveCareerImport`, keine Mischung mit Analytics einer Umfrage.
6. Vor einer Legacy-Sankey-Ansicht gesonderten reinen Projektionstyp mit `UNCONFIRMED_LEGACY` definieren und fachlich freigeben. Die aktuelle Survey-Analytics kennt nur echte SurveyResponses und darf nicht durch falsche Demoanker umgangen werden.

**Wichtiges Sonderthema:** Die später vorgesehene synthetische, abgeschlossene Demo-Umfrage für das erste Deployment ist **nicht** dieser Legacy-Import. Rein künstliche, geprüfte Demo-Teilnahmen dürfen im explizit isolierten Demo-System als synthetische `SurveyResponse`-Testdatensätze existieren; der historische reale MSI-Bestand darf dadurch keinerlei Teilnahmebestätigung erhalten.

## E. Feldgruppen und Zielzuordnung

| Quelle | Verarbeitung | Mögliche fachliche Zielprojektion |
|---|---|---|
| `Pseudonym`, `Stationskennung`, `Quellreihenfolge`, Importstand | lokal geschützte Identität, Revision, Positionsreview | Keine direkte kanonische ID; `AlumniTimelineItem.position` erst nach Prüfung |
| `Organisation / Ausbildungsstätte` | `providerLabel` als Beobachtung | Organisation/Institution/Program nur über verifizierte Katalogreferenz |
| `Funktion / Studium` | beobachteter `title`, nach NFC/Trim | `Degree.title` bzw. `CareerStep.roleTitle` |
| `Stationsart`, `Art der Tätigkeit`, `Beschäftigungsart / Bildungsstufe` | gemeinschaftliche Klassifikation und Review | `Degree.level` oder `CareerStep.type` |
| `Beginn`, `Ende`, Genauigkeiten, `Laufend` | exaktes Quellenformat, Plausibilitäts- und Statusprüfung | `startYear`, `endYear`, `Degree.status` oder `CareerStep.temporalStatus` |
| `Fachrichtung`, `Jobkategorie`, `Branche` | unabhängige, herkunftsbehaftete fachliche Entscheidungen | `Degree.fieldOfStudy`, `CareerStep.roleCategory`, `Organisation.sector`; ggf. `functionArea` nur gesondert |
| Prüfstatus, Herkunft, Original-/Recherchetexte und Notizen | ausschließlich privates Staging, Review-Reason-Codes | Keine dauerhaften kanonischen Freitext-/Provenienzfelder |
| MSI-Markierung | lokale Kandidatenprüfung | Ausschließlich unbestätigter Preview-Anker, niemals SurveyResponse |

**Typregel:** Bachelor/Master/Promotion → `Degree` mit nachgewiesenem Level; Berufsausbildung → `VOCATIONAL_TRAINING`, Praktikum → `INTERNSHIP`, Werkstudium → `EMPLOYMENT`, belegte Selbstständigkeit → `SELF_EMPLOYMENT`, Ehrenamt → `VOLUNTEERING`, Weiterbildung ohne eigenen akademischen Abschluss → `EDUCATION`; Schule, Volontariat, Trainee, unklare Ausbildungsarten oder Zertifikate benötigen bedingte Regeln/Review. Doppelabbildung derselben Ausbildung ist verboten. Parallele Stationen bleiben getrennt.

**Zeitregel:** `MONTH`, `YEAR`, `IMPRECISE`, `UNKNOWN`, laufend und fehlend sauber unterscheiden. Ungültige Monatsreihenfolge auch innerhalb gleichen Jahres erkennen. In der kanonischen Jahresprojektion keine Monate oder Abschlussjahre erfinden; `endYear` ist nicht `graduationYear`; leerer Endzeitpunkt bedeutet nicht automatisch laufend. Keine automatische Umordnung trotz Quellpositionskonflikten.

## F. Zeilenbilanz und Reviewprotokoll

Vier exklusive Stati pro **physischem** Quellvorkommen:

| Status | Bedeutung | Auswertung |
|---|---|---|
| `TECHNICALLY_INVALID` | notwendiges Quellschema, Typ oder Identität nicht sicher nutzbar | separat in Fehlerbilanz, keine erfundene Normalisierungsstation |
| `SOURCE_EXCLUDED` | technischer gültiger, expliziter Scope-/Fachausschluss | nachweisbar, bei anderem Scope neu zu beurteilen |
| `REVIEW_REQUIRED` | fachliche Klassifikation, Chronologie, Status, Kategorie oder Kandidatenwahl nicht geklärt | nur gekennzeichnete geschützte Review-Timeline |
| `ACCEPTED_FOR_PREVIEW` | fachlich und technisch dokumentiert geprüfte lokale Vorschau-Projektion | noch immer **keine** Alumni-Zustimmung/Survey-Teilnahme |

Priorität: technisch ungültig > außerhalb Scope > Review > Preview. Alle 1.279 Zeilen müssen genau einmal bilanziert werden, unabhängig von Scope. Aus `evaluated` verbleiben 83 außerhalb des betrachteten Scopes (außer vorrangig technisch invalid). Konflikte erhalten gesonderte Reason-Codes. Ein einziger automatischer historischer Vorschlag ist kein Abnahmesignal.

**Timeline vs. Sankey:** Review-Timeline darf unbestätigte, aber lesbare Stationen anzeigen, deutlich markiert. Ein Sankey darf unbekannte Kategorien zeigen, jedoch bei unsicherer erster Stelle, ungeklärter Ankerwahl, unklarer zeitlicher Beziehung oder blockierter relevanter Station keinen gesicherten Pfad erfinden. Die reale Legacy-Sankey-Projektion erfordert ein getrenntes späteres Design.

## G. Schlüssel, Idempotenz, Scope

- Schützenswerte Dataset-/Profil-/Station-Schlüssel über deterministische HMAC- oder gleichwertig kontextgebundene geschützte Identität; kein Klartext-Pseudonym als öffentliches ID-Format. Pro Quellvorkommen zusätzlich physische Zeile/Blatt und Quellrevision.
- Stationskennung + verifizierte Profilzugehörigkeit sind die fachliche Identität; die Original-Reihenfolge ist keine Identität. `SourceStation.key` ist nur batchlokal, nicht produktiv global eindeutig.
- Trenne Hash der XLSX-Datei von inhaltlichem Fingerabdruck; gleiches fachliches Manifest, Mapping-Version, Scope und Reviewrevision ergeben deterministische Ergebnisse; keine Zeitstempel/zufälligen IDs im Vergleich.
- Keine automatische Profilidentitätszusammenführung über Namen, LinkedIn, Arbeitgeber, E-Mail oder Ähnlichkeit. Ungeklärte Revisionen invalidieren bisherige manuelle Entscheidungen; nichts wird stillschweigend überschrieben.
- `evaluated` = 105 Profile/1.196 Stationen als erste Vergleichsabnahme; `all` = 115/1.279 für Gesamtbilanz. Vor jeder Auswertung Mitgliedschaft über privates explizites Profilmanifest belegen; nie per ersten 105 Reihen ableiten.
- Genau ein passender MSI-Kandidat ermöglicht erst nach Betreiberprüfung einen unbestätigten Preview-Anker; mehrere Kandidaten bleiben ohne automatische Wahl blockiert.
- Frühere V2.4-Sankey-Regeln zur ersten Beschäftigung und zur Kopplung von Branche/Job **derselben** CareerStep-ID beachten; kein `completeTestCase=true` bei unvollständiger historischer Biografie.

## H. Entscheidungsstand bei Unterbrechung

**Die P1/P1b-Spezifikation wurde im Gespräch erörtert, aber D1–D12 wurden nicht vom Nutzer abschließend fachlich freigegeben.** Keine Umsetzung starten, die diese Freigabe voraussetzt.

| ID | Vorgeschlagene Entscheidung | Späteres Gate |
|---|---|---|
| D1 | `evaluated` als erste Sicht, `all` als volle Bilanz | Vor Konverter |
| D2 | Exaktes 37-Spalten-Quellschema, keine stille Formatannahme | Vor XLSX-Reader |
| D3 | Historische 8/9/8-Taxonomie als eigener Namensraum | Vor Mapping |
| D4 | Strikte Typ-/Status-/Zeitregeln, Mehrdeutigkeit bleibt Review | Vor Konverter |
| D5 | Doppelte Quellreihenfolge erkennt 2 Kollisionsgruppen/5 Zeilen; fachlich später auflösen | Vor Konverterregel |
| D6 | Kein automatischer MSI-Referenzabschluss oder Survey-Consent | Immer |
| D7 | Typisiertes geschütztes Kategorien-Sidecar, Kernvertrag unverändert | Vor Konverter |
| D8 | Vier Statuswerte, eine Zeile → ein Status, Reihenfolge und Scope separat | Vor Konverter |
| D9 | Schlüsselrevision und manuelle Reviewrevision, keine automatische Merge-Logik | Vor Konverter |
| D10 | Timeline-Review ≠ Sankey-Zulassung; keine falsche Vollständigkeit | Vor Vorschau |
| D11 | Separate Legacy-Sankey-Schnittstelle und Datenschutz-Gates | Vor Legacy-P3 |
| D12 | Autorisierte lokale Betriebsumgebung, Recht, Retention, Löschregeln | Vor Realdateizugriff |

## I. Geplante RED-Tests für die spätere Wiederaufnahme

Nur mit eigens erstellten **synthetischen** Fixtures:

1. Exakte 37-Header-Prüfung; problematische Typen, Formeln, ungültige Werte, Groß-/Kleinschreibung.
2. 1:1-Zeilenledger, keine stillen Drops, Statussumme und Scopewechsel `evaluated`/`all`.
3. Identitätskollisionen, zwei und drei wiederholte Positionen, fehlende Kennungen, stabile Quell- und Stationsrevision.
4. Monats- und Jahrespräzision, unbekannte Zeit, laufend, Datumswidersprüche, GraduationYear separat.
5. Bachelor, Master, Promotion, Werkstudium, Berufsausbildung, Praktikum, Ehrenamt, Selbstständigkeit, Volontariat, Auslandssemester, Zertifikate, Paralleljobs.
6. Unbestätigte MSI-Markierungen: keine SurveyResponse und kein Bezug zu bestätigter Survey-Analytics.
7. Getrennte Kategorie-/Sektor-/Funktionsdimensionen; historische 8/9/8-Originalwerte; automatische Vorschläge bleiben ungeprüft.
8. Organisatorische/Katalog-IDs nur bei bestätigter Identität; keine Branchenänderung geteilter Katalogeinträge.
9. Private Dateipfad- und Ausgabepfadschutzregeln; keine Netz-/DB-Zugriffe; keine Rohdaten in Logs, CI oder Git.
10. Idempotente Dry-runs; keine Datenänderung ohne explizite Freigabe; Tests erlauben begründete Ausschlüsse.
11. Geschützte Review-Timeline mit sichtbaren Unklarheiten, spätere Sankey-Sperrregel und unbekannte Dimension.
12. Null-Kontamination der Befragungsdatenbank und des SurveyResponse-Lesevertrags.

## J. Quellen und historische Anhänge

Hiermit werden die wesentlichsten vorherigen Spezifikationen **wortgetreu im Anhang gesichert**, damit der neue Chat die alten Codex-Kontexte nicht benötigt. Falls ältere Anhänge von den korrigierten Feststellungen in Abschnitt A–I abweichen, gelten für dieses Archiv die aktualisierten Abschnitte A–I; bei tatsächlicher späterer Implementierung sind normative Repo-Dokumente maßgeblich.

- `V4_P1B_ABNAHMEENTWURF_2026-11-01.md` – jüngster, nicht freigegebener fachlicher Mapping-Entwurf.
- `ALUMNI_CAREERMAP_V4_P0_P1_MAPPING_ENTWURF_2026-10-30.md` – vorgelagerter P0/P1-Entwurf.
- `ALUMNI_CAREERMAP_V4_EXCEL_HANDOVER_2026-10-30(1).md` – ursprüngliches Excel-Handover.

---



# Anhang 1 – P1b-Abnahmeentwurf (Originaltext)

# Alumni CareerMap V4 — P1b: fachlicher Abnahmeentwurf

**Stand:** 2026-11-01  
**Status:** Vorschlag; **noch nicht fachlich abgenommen**.  
**Referenz:** `duenne/alumni-careermap`, `main`, `c0d0cbbce9b58d7dc5d55a1f805efb47971c2786` (im Codex-P1b-Lauf geprüft).  
**Grundlagen:** Codex-Export P0/P1/P1b, normatives `docs/architecture/MVP_DOMAIN_MODEL.md`, separate lesende Prüfung der ursprünglichen MSI-XLSX.  
**Datenschutz:** Dieses Dokument enthält keine Alumni-Einzelzeilen, Rohprofile, Pseudonyme oder Original-Karrieretexte. Es kann zur technischen Abstimmung genutzt werden; die originale XLSX und geschützte Sidecars bleiben außerhalb des öffentlichen Repositorys.

## 1. Gegenstand und Grenzen

Zunächst nur P2 als synthetisch testgetriebener, offline arbeitender Konverterkern, **ohne echte Excel-Daten einzulesen** und ohne Speicherung. Normative Entitäten, Prisma-Schema, Migrationen, `SourceStation` und `NormalizationInput` bleiben unverändert. `SurveyResponse`, `confirmedAt`, `saveCareerImport` und die bestätigte Survey-Analytics werden nicht verwendet. Ein historischer MSI-Kandidat ist keine persönliche Bestätigung. Keine Vermischung mit synthetischen Demoankern (`demoAnchor`) und kein `completeTestCase=true` für den realen Bestand.

Die spätere reale lokale Ausführung (einschließlich geeigneter Schutzumgebung und Rechtsgrundlage) und die separate Legacy-Sankey-Vorschau benötigen eigenständige Freigaben.

## 2. Prüfbasis aus der XLSX

- 7 Arbeitsblätter; `Stationentabelle (alle)` ist Primärquelle, übrige Blätter sind Kontroll-/Metadatenquellen.
- 1.279 Stationszeilen mit 1.279 eindeutigen Stationskennungen bei 115 Profilbezeichnern.
- `evaluated`: 105 Profile, 1.196 Stationen; `all`: 115 Profile, 1.279 Stationen; damit 10 zusätzliche Profile und 83 weitere Stationen.
- 794 Zeilen mit historischem `Automatischer Vorschlag`, 485 mit `Zuordnung offen`. Kein Wert beweist neue fachliche Freigabe.
- 110 MSI-Ausgangspunkt-Markierungen bei 109 Profilen insgesamt; bei den 105 ausgewerteten Profilen 106 Markierungen bei 105 Profilen. Keine automatische Auswahl des Doppelkandidaten.
- **Korrektur vom 2026-11-01:** Bei Kombination `(Pseudonym, Quellreihenfolge)` liegen **2 Kollisionsgruppen mit 5 betroffenen Stationszeilen in 2 Profilen** vor (Gruppengrößen 2 und 3). Die frühere Zahl **3** bezeichnet *zusätzliche Belegungen* gegenüber eindeutigen Paaren, nicht drei Kollisionsgruppen.

## 3. Alle 37 Originalspalten — Zuordnungspolitik

Original-Header in Reihenfolge:

1. Pseudonym
2. Zeitfenster
3. Organisation / Ausbildungsstätte
4. Funktion / Studium
5. Art der Tätigkeit
6. Beginn
7. Ende
8. Laufend
9. Beschäftigungsart / Bildungsstufe
10. Datentyp
11. Fachrichtung
12. Jobkategorie
13. Branche
14. Prüfstatus
15. Stationskennung
16. Stationsart
17. Beginn · Genauigkeit
18. Ende · Genauigkeit
19. Zeitraum · Originalangabe
20. Tätigkeits- / Studienbeschreibung
21. Originaltext · bereinigter Abschnitt
22. Früherer Originaltext · bereinigt
23. Organisationssektor
24. Quellabschnitt
25. PDF-Seite
26. Quellreihenfolge
27. Importversion
28. Erfassungsstatus
29. Fehlende Angaben / Prüfhinweise
30. Fachrichtung · Herkunft
31. Jobkategorie · Herkunft
32. Branche · Herkunft
33. Beschäftigungsart / Bildungsstufe · Herkunft
34. Zuordnung · Begründungen
35. Recherchequellen
36. Prüfnotizen
37. Neuimport · Abgleichhinweis

**Feldregeln:**

- `Pseudonym`, `Stationskennung`, Quellrevision und Zeilenvorkommen nur für geschützte lokale Identitäts- und Bilanzierungszwecke; nicht als kanonische Personen-/Stations-IDs.
- `Organisation / Ausbildungsstätte` zu beobachtetem `providerLabel`, nicht zu einer bestätigten Organisation-ID. `Funktion / Studium` zu beobachtetem `title`, nach fachlicher Klassifikation zu `Degree.title` bzw. `CareerStep.roleTitle`.
- `Art der Tätigkeit`, `Beschäftigungsart / Bildungsstufe`, `Stationsart` dienen der Typentscheidung. Kein einzelnes Feld erzwingt eine uneindeutige Typ- oder Statusentscheidung.
- `Beginn`, `Ende`, `Laufend` mit den beiden Genauigkeitsfeldern kontrolliert parsen; Jahrprojektion ohne erfundene Monate, Abschlussdaten oder Enden. Originalpräzision im privaten Staging erhalten.
- `Quellreihenfolge` kann nur nach Eindeutigkeits-/Positivprüfung als `position` übernommen werden; Konflikte bleiben `REVIEW_REQUIRED` und werden nicht per Tie-Break aufgelöst.
- Fachrichtung, Jobkategorie, Branche, ihre Herkunft, Original-/Recherchetexte, Prüf- und Importmetadaten gehören in ein privates typisiertes Sidecar bzw. Entscheidungsprotokoll; sie werden nicht in den unveränderten Normalisierungskern hineingeschmuggelt.
- `Organisationssektor` ist nicht automatisch gleich der Wirtschaftskategorie `Branche`.
- Weder `MSI bestätigt` noch `MSI · Ausgangspunkt` ist ein eigener der 37 Header; diese Werte sind Quellinhalt bzw. abgeleitete Markierungen, deren genaue Semantik gesondert zu prüfen ist.
- Für `graduationYear` existiert kein ausdrücklich eigenständiges Quellabschlussdatum unter den 37 Headern. Ein Endjahr ist **kein** Abschlussnachweis.

## 4. Originaltaxonomie bewahren

**Jobkategorien (8):** Führung; Strategie und Planung; Forschung und Entwicklung; Produktion und operatives Management; Controlling und Reporting; Marketing und Vertrieb; Beratung; Selbstständigkeit.

**Branchen (9):** Produktion und verarbeitendes Gewerbe; IT und Technologie; Finanzen und Versicherungen; Handel und Konsumgüter; Gesundheitswesen und Pharma; Medien und Publishing; Öffentliche Verwaltung; Wissenschaft und Bildung; Dritter Sektor.

**Fachrichtungen (8):** Mensch & Gesundheit; Kommunikation & Medien; Technik & Information; Wirtschaft & Recht; Gesellschaft & Politik; Natur & Umwelt; Stadt & Kultur; Gestaltung & Kunst.

Die historischen Labels bilden einen eigenen, versionierten Namensraum. Die synthetischen `src/lib/analytics/prepare.ts`-Labels und die heuristischen `src/lib/career-import/classification.ts`-Vorschläge sind **keine** historischen Autoritäten. Schreibweisenalias dürfen nur ausdrücklich kontrolliert zugeordnet werden. Besonders: `Beratung` als historische Jobkategorie ist nicht `Beratung` als synthetische Branche; `Selbstständigkeit` als historisches Joblabel beweist nicht allein `SELF_EMPLOYMENT`; `Stadt & Kultur` darf nicht automatisch auf eine andere Fachrichtung reduziert werden. Keine kategoriedimensionsübergreifende Ersetzung.

## 5. Normalisierung, Review und Preview

Die vier **exklusiven Zeilenstatuswerte** bleiben:

- `ACCEPTED_FOR_PREVIEW`: technisch und fachlich freigegebene Projektion; kein ungeprüfter Vorschlag als Fachlabel.
- `REVIEW_REQUIRED`: lesbare Quellstation mit offener fachlicher Entscheidung; in einer geschützten Review-Timeline mit klarer Kennzeichnung darstellbar.
- `SOURCE_EXCLUDED`: gültige, ausdrücklich außerhalb des gewählten Scopes oder fachlich ausgeschlossen; Zeile bleibt bilanziert.
- `TECHNICALLY_INVALID`: Quellstruktur/Identität nicht sicher verarbeitbar; Diagnose bleibt bilanziert.

Priorität: technische Ungültigkeit > Scope-Ausschluss > Review > Freigabe. Scope-Mitgliedschaft ist separat zu bilanzieren, damit Fehler außerhalb des betrachteten Scopes nicht verschwinden.

Feldbezogene Kategorienfreigaben (`Fachrichtung`, `Jobkategorie`, `Branche` und ggf. `Funktionsbereich`) werden als eigener Datentyp mit Quellenwert, Provenienz, Freigabestand, Stationsrevision und Begründung privat geführt. Vor einer separaten Vorschau wird nur der **freigegebene** Wert in ein eigenes Preview-DTO projiziert; ungeprüfte Werte bleiben als solche angezeigt oder unbekannt. Die Kernobjekte werden nicht verändert.

Für Sankey gilt: Unbekannte *Kategorie* bei gesicherter Stationenauswahl darf als unbekannte Dimension erscheinen. Ungewisse *Stationenwahl*, mehrfacher MSI-Anker oder unsichere Zeit-/Reihenfolgebeziehung können den betreffenden Pfadabschnitt blockieren. Für die erste vollständige Sankey-Ansicht gilt konservativ: Profile mit einem gesperrten erforderlichen Abschnitt nicht einschließen, aber in einer Diagnoseliste gesondert zählen. Noch keine tatsächliche Sankey-Implementierung in P2.

## 6. Fachliche Typ- und Zeitregeln

- Bachelor/Master/Promotion: `Degree` mit fachlich belegtem `level`; Status unabhängig prüfen.
- Berufsausbildung: `CareerStep/VOCATIONAL_TRAINING`; Praktikum: `INTERNSHIP`; Werkstudententätigkeit: `EMPLOYMENT`; belegte Selbstständigkeit: `SELF_EMPLOYMENT`; Ehrenamt: `VOLUNTEERING`.
- Eigenständiger akademischer Zertifikatsabschluss: nach Prüfung `Degree/CERTIFICATE`. Weiterbildung und Auslandssemester ohne eigenständigen akademischen Abschluss: `CareerStep/EDUCATION`. Schule/Abitur, Trainee und Volontariat: bedingte Mapping-Regeln, bei Zweifel Review.
- Parallele Stationen bleiben getrennt. Keine doppelte Abbildung desselben Studiums als Degree und EDUCATION.
- `Laufend=Ja` bei konsistentem Befund erlaubt `IN_PROGRESS` bzw. `ONGOING` und kein `endYear`. Leer/Unbekannt ist nicht laufend. `Laufend=Nein` oder ein Endjahr beweisen keinen Abschluss.
- Monatsangaben werden präzise validiert, als Jahreswerte kanonisch projiziert und im privaten Staging mit Originalpräzision erhalten. Unbekannte Angaben bleiben unbekannt, chronologische Widersprüche bleiben Reviews.

## 7. Vorgeschlagene Entscheidungen (zur Freigabe)

| ID | Entscheidungsvorschlag | Gate |
|---|---|---|
| D1 | `evaluated` (105 Profile) als erste Vergleichskohorte; vollständige Bilanz über 115 Profile | Vor P2 |
| D2 | Ein exaktes 37-Spalten-Schema; unbekannte Zellwerte diagnostizieren statt erraten | Vor P2 |
| D3 | 8/9/8-Taxonomie als eigene Quellnorm; automatische Vorschläge nicht ungeprüft übernehmen | Vor P2 |
| D4 | Typ-/Status- und Zeitregeln gemäß P1b, Mehrdeutigkeit bleibt Review | Vor P2 |
| D5 | Zwei Kollisionsgruppen (5 Stationen, 2 Profile) nach späterer privater Prüfung klären; P2 erkennt und sperrt sie | Vor P2 Regel, Einzelfall später |
| D6 | MSI-Kandidaten nur als unbestätigte lokale Anker behandeln, Mehrfachfälle nicht automatisch auswählen | Vor P2 |
| D7 | Typisiertes privates Kategorien-Sidecar und getrennte Preview-Projektion; keine Änderungen am Kern | Vor P2 |
| D8 | Vier exklusive Zeilenstatuswerte und vollständige Bilanz jedes Quellvorkommens | Vor P2 |
| D9 | P2 nur mit synthetischen Testdaten, offline und seiteneffektfrei; kein Zugriff auf die private XLSX | Vor P2 |
| D10 | Keine Katalog-IDs anhand von Namen, zunächst UNKNOWN | Vor P2 |
| D11 | Separate Legacy-Sankey-Semantik und konservative Pfadsperren | Vor P3 |
| D12 | Autorisierte Rechtsgrundlage, lokale Schutzumgebung, Zugriffs-, Aufbewahrungs- und Löschregeln vor realer XLSX-Ausführung | Vor realer Datenverarbeitung |

## 8. P2-Eingrenzung und RED-Tests

P2 nur als eigener Branch nach ausdrücklicher Freigabe und mit **synthetischen** Fixtures. Zuerst RED-Tests für alle 37 Header, Typisierung, Status-/Datumslogik, Identitäts-/Revisionsbildung, Scopepartition, 1:1-Zeilenbilanz, 2/3-fache Reihenfolgekollisionen, mehrfachen/fehlenden MSI-Kandidaten, Kategorie-Vorschlag vs. Freigabe, Feld-/Sankey-Auswertbarkeit, Determinismus und Privacy-Gates. Danach minimaler Adapter bis GREEN, anschließend REFACTOR. Bestehende Normalisierungs- und CI-Tests müssen weiter bestehen; kein DB-Zugriff und keine produktive Datenmigration. Keine Commits oder Pushes ohne ausdrücklichen Auftrag.

**Freigabestatus:** Bis zur ausdrücklichen fachlichen Zustimmung weiterhin nur Entwurf. **P2-Start ist noch nicht erteilt.**



# Anhang 2 – P0/P1-Mappingentwurf (historischer Arbeitsstand)

# Alumni CareerMap V4 – P0/P1-Audit und Mapping-Spezifikation (Entwurf zur fachlichen Abnahme)

**Stand:** 2026-10-30 · **Status:** ENTWURF, NICHT FREIGEGEBEN · **Umfang:** nur lesende Bestandsaufnahme und Architektur-/Mapping-Entscheidungsvorlage. Kein Converter, keine Datenbank, kein Git-Commit.

## 0. Arbeitsgrundlagen und Vertrauensgrenzen

- GitHub: `duenne/alumni-careermap`, `main` HEAD `c0d0cbbce9b58d7dc5d55a1f805efb47971c2786`, am 30.10.2026 über GitHub-Branch-API verifiziert. Letzter Actions-Run auf diesem HEAD: `40964540044`, `completed/success`. **Lokaler Checkout-/Working-Tree-Status nicht geprüft**, da kein lokaler Git-Checkout vorliegt.
- Verbindliche Architektur: `AGENTS.md`; `docs/architecture/MVP_DOMAIN_MODEL.md`; `docs/requirements/REQUIREMENTS.md`; `docs/requirements/UC-01_ALUMNI_DATA_DONATION.md`. Gesehen: V3-Integrations-/Klassifikations-, V2.4-Sankey-Dokumente, `prisma/schema.prisma`, `src/lib/normalization/{contract,normalize-career-batch,normalize-explicit-degree,normalize-explicit-career-step,apply-explicit-review-assertions}.ts`, `src/lib/career-import/{mapping,service,classification}.ts`, `src/lib/surveys/analytics.ts`, `src/lib/analytics/{aggregate,overview,records}.ts`.
- Private XLSX wurde in der Chat-Sitzung als hochgeladener Anhang **nur im Arbeitsspeicher lesend** ausgewertet; kein Quellinhalt wird in diesen Bericht kopiert. Das ist **nicht gleichbedeutend mit ausschließlich lokaler Verarbeitung auf dem Entwicklungsrechner**. Für Codex P2–P4: private Rohdateien nur auf dem berechtigten lokalen Betreibersystem, außerhalb Git, ohne Übermittlung an entfernte Agent-Tools, GitHub, CI oder Drittdienste.
- Quelle: `MSI-Karrierewege_2026-10-21.xlsx`; SHA-256 `b0715354cc3b66d950652af2c110e1ea99d675879b738addd6833f60e9e8cc18`. SHA-256 als Versionsbeleg, **nicht** als vollständiger Datenschutzbeweis.

## 1. Validierte Bestandszahlen (nur Aggregate)

| Prüfkriterium | Ergebnis |
|---|---:|
| `Stationentabelle (alle)` | 1.279 Datenzeilen, 37 Spalten |
| Eindeutige Pseudonyme / eindeutige Stationskennungen | 115 / 1.279 |
| `Profile` / `Werdegang` | 105 Profile / 1.196 Stationen |
| Zusätzliche Profile außerhalb 105er-Auswertung | 10 Profile / 83 Stationen |
| `Prüfstatus`: Automatischer Vorschlag / Zuordnung offen | 794 / 485 |
| Davon in 105er-Gruppe | 744 / 452 |
| Davon in zehn zusätzlichen Profilen | 50 / 33 |
| `Fachrichtung=MSI · Ausgangspunkt`: alle | 110 Stationen / 109 Profile |
| `Fachrichtung=MSI · Ausgangspunkt`: ausgewertete 105 | 106 Stationen / 105 Profile; 1 Profil mit 2 Kandidaten |
| `Laufend=Ja` | 152 Stationen |
| Beginn: Monat / Jahr / unbekannt | 1.010 / 252 / 17 |
| Ende: Monat / Jahr / laufend / unbekannt | 883 / 227 / 152 / 17 |
| Mehrfachbelegte (Pseudonym, Quellreihenfolge)-Kombinationen | 3 zusätzliche Belegungen; **Quellreihenfolge ist kein Schlüssel** |

Die sieben Blätter sind `Übersicht`, `Stationentabelle (alle)`, `Profile`, `Werdegang`, `Bündelung (Sankey)`, `Kategorien`, `Datenhinweise`. Primärquelle ist ausschließlich `Stationentabelle (alle)`; andere Blätter dienen Kontrolle und fachlicher Interpretation, nie stiller Ersetzung von Rohzeilen.

Die Kategorienübersicht führt 8 Jobkategorien, 9 Branchen und 8 Fachrichtungen. Ihre Summen 742 (Job), 581 (Branche), 130 (Fachrichtung) entsprechen **exakt den 105 ausgewerteten Profilen**; die entsprechenden Treffer bei allen 115 Profilen sind 786, 619 und 145. Die Übersicht darf nicht als 115er-Gesamtstatistik ausgewiesen werden.

Zusätzliche QA-Punkte: Fünf verdächtige Quellreihenfolge-Feldwerte und ein nicht regulärer Eintrag im Feld `Beschäftigungsart / Bildungsstufe` sind bei der späteren lokalen Rohdatenprüfung explizit zu validieren; das Spreadsheet-Parsing kann hier eine Rolle spielen. **Keine automatische Bereinigung**. Zwei Organisations-/Ausbildungsstätten-Angaben und sechs Funktions-/Studienbezeichnungen fehlen bzw. sind nicht aussagekräftig. Mindestens diese Klassen auf Prüfpositionen abbilden.

## 2. Normative Semantik – harte Grenzen

1. Der normative MVP hat `Alumni`, `Degree`, `CareerStep`, `AlumniTimelineItem`, `Institution`, `Program`, `Organisation`, `Survey`, `SurveyResponse` und optional `AlumniContact`. Der Handover-Altstand mit globalem Referenzabschluss oder `Degree.isReference` ist **nicht gültig**.
2. **Nur `SurveyResponse.referenceDegreeId` bezeichnet eine konkrete, bestätigte persönliche Referenz.** Historische `MSI bestätigt=Ja`-Felder und `MSI · Ausgangspunkt` sind ausschließlich historische / analytische Indizien; sie beweisen weder Teilnahme, Einwilligung, Studienabschluss noch persönliche Referenzauswahl.
3. `saveCareerImport` erzeugt `Alumni`, Stationen **und** `SurveyResponse` transaktional nach zwei ausdrücklichen Bestätigungen. Er ist für den historischen Massenkonverter ausdrücklich tabu. Ebenso darf `readSurveyAnalytics` keine Legacy-Datensätze zählen, da es ausschließlich bestätigte `SurveyResponse` verarbeitet.
4. Der Normalisierungskontrakt `SourceStation` enthält quellneutrale `SourceFact`-Evidenz, aber weder Quellenmetadaten noch `sector`, `fieldOfStudy`, `roleCategory`, Referenzmarker oder identifizierende Texte. Seine reinen Normalisierer projizieren diese zusätzlichen Kategorien auf `null`; zusätzliche Details gehören in ein **separates, lokales Review-/Preview-Layer**, nicht in das normative Datenmodell und nicht unbesehen in den LinkedIn-spezifischen `ImportReview`.
5. Ein unbestätigter Referenzkandidat darf nicht einfach als `referenceDegreeId` in `AnalyticsProfile` übergeben werden: der vorhandene 4-/7-Stufen-Sankey würde diesen als **„Bestätigten MSI-Bachelor“** bezeichnen. `demoAnchor` ist ebenfalls unzulässig, weil es synthetische Testanker bedeutet. P3 braucht gegebenenfalls einen separaten `UNCONFIRMED LEGACY`-Projektionsadapter mit neutralem Referenzkandidatentyp und gesonderter Beschriftung.
6. Pseudonymisierte Werdegänge bleiben personenbezogene Daten. Keine öffentliche Einzelpfad-/Screenshot-/Quelltextausgabe. Eine Pilotabnahme ist keine datenschutzrechtliche Produktivfreigabe.

## 3. Feld-zu-Feld-Mapping (Entwurf, nach P1-Abnahme für P2 verbindlich)

| Excel-Primärspalte | Staging-Fakt / `SourceStation` | Vorgesehene Projektion in kanonisches Modell | Regel / Risiko |
|---|---|---|---|
| `Pseudonym` | privater `profileSourceKey` | später neue `Alumni`-UUID, **niemals** automatisches globales Matching | nur gleicher Quellschlüssel in gleicher Datei-/Version; keine Namen, Mails, LinkedIn-IDs |
| `Stationskennung` | privater `stationSourceKey`; in `SourceStation.key` profillokal namespacen | später Zuordnung auf neue Degree-/CareerStep-UUIDs | stabiler Identitätsschlüssel, nicht `Quellreihenfolge` oder Titel; Dubletten technisch invalid |
| physische Excel-Datenzeile | privater `sourceRowOrdinal` | kein Feld | für Verlustbilanz und deterministische Prüfreihenfolge |
| `Quellreihenfolge` | privater `sourceOrder` | vorgeschlagene `AlumniTimelineItem.position` erst nach Konfliktprüfung | drei mehrdeutige Profil-/Reihenfolge-Paare; keine unbegründete Chronologiekorrektur |
| `Zeitfenster`, `Zeitraum · Originalangabe` | private Originaltext-Evidenz | nicht direkt | nur Kontroll-/Plausibilitätsangaben, nicht Ersatz für Beginn/Ende |
| `Beginn`, `Beginn · Genauigkeit` | `start`: `OBSERVED` `MONTH` / `YEAR` / `IMPRECISE` oder `UNKNOWN` | `Degree.startYear` / `CareerStep.startYear` | nur echte Präzision; `YYYY-MM` → MONTH; Jahr → YEAR; unlesbar bleibt ungenau |
| `Ende`, `Ende · Genauigkeit`, `Laufend` | `end` plus eigener privater expliziter Status-Evidenzblock | `endYear` und nach Review `Degree.status` oder `CareerStep.temporalStatus` | laufend ≠ unbekannt; fehlendes Ende ≠ laufend oder abgeschlossen; Widersprüche blockieren |
| `Funktion / Studium` | `title` `OBSERVED` oder `MISSING` | `Degree.title` oder `CareerStep.roleTitle` je geprüfter Station | Bezeichnung alleine ist kein Typ-/Levelbeweis |
| `Art der Tätigkeit`, `Stationsart`, `Beschäftigungsart / Bildungsstufe` | `category` als beobachteter Herkunftshinweis; Typ-/Level-Vorschlag separat | `Degree.level` oder `CareerStep.type` nur nach Review-Aussage | drei Quellspalten gemeinsam berücksichtigen, Widersprüche -> Review |
| `Organisation / Ausbildungsstätte` | `providerLabel`, evtl. `MISSING`; `catalog` standardmäßig `UNKNOWN`/`CANDIDATE` | bei Degree `Program` **oder** `Institution`; bei CareerStep `Organisation` | gleiche Namen keine Identität; ggf. verifizierte Katalog-ID erforderlich; kein Name-Upsert |
| `Fachrichtung` | eigene private fachliche Kategorienevidenz | `Degree.fieldOfStudy` **nur** nach Review; niemals Arbeits-Funktionsbereich | `MSI · Ausgangspunkt` ist Referenzkandidat-Marker, keine Confirmed Reference |
| `Jobkategorie` | eigene private Jobkategorie-Evidenz | `CareerStep.roleCategory` nach Review | `Zuordnung offen`/`Nicht anwendbar` keine kanonischen Kategorien |
| `Branche` | eigene private Branche-Evidenz | `Organisation.sector` nur bei bewusst gewählter/neu bestätigter Organisation | unterschiedliche Identität und Semantik gegenüber Job; vorhandenen Katalog nicht still überschreiben |
| `Organisationssektor` | separater privater Vorschlag, hier durchgehend `Nicht zugeordnet` | **nicht automatisch** `Organisation.sector` | kein eigenständiger bestätigter Branchenbeleg |
| `Prüfstatus`, `... · Herkunft`, `Zuordnung · Begründungen` | private Evidenz samt Begründungen/Prüfbedarf | keine normative Entität | `Automatischer Vorschlag`, `Zuordnung offen`, `Manuell bestätigt` hier keine Alumni-Bestätigung |
| `Datentyp`, `Importversion`, `Erfassungsstatus`, `Quellabschnitt`, `PDF-Seite`, `Quellreihenfolge` | private Provenienz / Prüflog | keine kanonischen Felder | auditierbar und minimiert; keine Quellenangaben in API/CI/Repo |
| `Tätigkeits- / Studienbeschreibung`, `Originaltext · bereinigter Abschnitt`, `Früherer Originaltext · bereinigt`, `Fehlende Angaben / Prüfhinweise`, `Recherchequellen`, `Prüfnotizen`, `Neuimport · Abgleichhinweis` | ggf. streng geschütztes privates Sidecar, getrennt vom Staging-Überblick | **nicht** in kanonisches Modell, allgemeine Logs oder Git | personenbezogene Freitexte minimieren; spezielle Retention/Löschung |
| `Profile.MSI bestätigt`, `Profile.MSI Beginn`, `Profile.MSI Abschluss`, `Profile.Masterstatus`, `Profile.Zu prüfen` | separate Sekundärprüfung im lokalen Review | keine automatische Bestätigung, keine Graduation aus Degree-Ende | keine 105er-Profilzeile ersetzt eine Primärstation |
| `Werdegang.Nr./Phase` | Sekundärabgleich, Zeilenzahl und Chronologiehinweis | keine automatische Referenz- oder Reihenfolgenwahl | Sicht für 105 Profile; nicht die Quelle aller 115 |
| `Bündelung (Sankey)` / `Übersicht` | Aggregationsvergleich | keine Einzelstationen | historischer Maßstab, ggf. andere Vollständigkeitsannahmen |

### 3.1 Datums- und Statusvertrag

- Evidenz `OBSERVED` = aus Quelle beobachtet, **keine** Prüfung der inhaltlichen Wahrheit; `ASSERTED` = kontrollierte Review-Behauptung, **keine** Einwilligung; `MISSING` = kein Ausgangswert; `UNKNOWN` = explizit unbekannt. `IMPRECISE` trägt unverstandenen Originaltext ausschließlich im privaten Staging; nicht durch aktuelles Jahr/Monat ersetzen.
- Bei Monatsdaten darf im kanonischen Jahr-Feld nur das tatsächlich beobachtete Jahr stehen. Jeder Präzisionsverlust wird gezählt, die Originalpräzision bleibt im Staging. Unbekannte Datumswerte werden `null`.
- Bei einer Laufend-Markierung mit konsistent fehlendem Endwert: Karrierephase als **Statuskandidat** `ONGOING`; akademische Phase `IN_PROGRESS` erst nach fachlicher Prüfung. `Nein` mit bekanntem Enddatum legt bei Arbeit `ENDED` nahe, beweist bei Degree **nicht** `COMPLETED`. `ENDED_WITHOUT_DEGREE` braucht explizite Evidenz. Bei unbekanntem Status kann der Normalisierer das kanonische `endYear` zurückhalten, obwohl das private Quelljahr erhalten bleibt.
- Ein bekannter Studien-Endzeitpunkt ist **nicht** automatisch `Degree.graduationYear`. `COMPLETED` nur aufgrund eines tragfähigen expliziten Nachweises/Review; Bachelor-MSI-Referenzkandidat bleibt trotzdem unbestätigt im Sinne von SurveyResponse.
- Reversed interval, Status-/Datumskonflikt, schwankende Reihenfolge, zeitliche Parallelität: nicht automatisch korrigieren. Parallele Grade und Jobs sind grundsätzlich zulässig.

### 3.2 Stationstyp-/Level-Entscheidung

| Quellbezeichnung | Normativer Typ-Kandidat | Verbindliche Bedingung |
|---|---|---|
| Bachelor / Master / Promotion | `DEGREE` mit `BACHELOR` / `MASTER` / `PHD` | Quelle bestätigt wirklich eigenständigen akademischen Qualifikationsgang; Status separat |
| Berufsausbildung | `CAREER_STEP:VOCATIONAL_TRAINING` | Bildungs-/Berufsausbildung, nicht Bachelor/Degree |
| Praktikum, Praxissemester | `CAREER_STEP:INTERNSHIP` | eigenständige Praxisstation; auch parallel zum Studium |
| Werkstudium / Nebenjob | `CAREER_STEP:EMPLOYMENT` | keine INTERNSHIP- oder STUDIUM-Duplikate |
| Anstellung | `CAREER_STEP:EMPLOYMENT` | Art der Tätigkeit gegen weitere Hinweise kontrollieren |
| Selbstständig | `CAREER_STEP:SELF_EMPLOYMENT` | Tätigkeitsform, **keine Branche** |
| Ehrenamt | `CAREER_STEP:VOLUNTEERING` | bei explizitem Ehrenamt |
| Austausch / Auslandssemester | `CAREER_STEP:EDUCATION` | sofern keine eigene akademische Abschlussqualifikation nachgewiesen |
| Weiterbildung / Zertifikat | `CAREER_STEP:EDUCATION` oder `DEGREE:CERTIFICATE` | akademisch eigenständiges Zertifikat vs. Weiterbildung prüfen |
| Schule / Abitur | meist `CAREER_STEP:EDUCATION` | kein fingierter Bachelor-/Master-Degree; Darstellung fachlich bestätigen |
| Trainee / Volontariat | `EMPLOYMENT` oder `INTERNSHIP` | Anstellungs-/Ausbildungscharakter prüfen, keine starre Regel |
| Studium (ohne Angabe) / Ausbildung (unspezifisch) | zunächst `REVIEW_REQUIRED` | keine stille `DEGREE:OTHER`- oder Bachelor-Annahme |
| Unerwartete Werte, fehlende Art, Typwiderspruch | `REVIEW_REQUIRED` oder `TECHNICALLY_INVALID` | semantische Mehrdeutigkeit vs. strukturelle Fehler unterscheiden |

## 4. Kategoriekatalog und Crosswalk

Excel-`Kategorien`: **Jobkategorie** J1 Führung; J2 Strategie und Planung; J3 Forschung und Entwicklung; J4 Produktion und operatives Management; J5 Controlling und Reporting; J6 Marketing und Vertrieb; J7 Beratung; J8 Selbstständigkeit.

**Branche** B1 Produktion und verarbeitendes Gewerbe; B2 IT und Technologie; B3 Finanzen und Versicherungen; B4 Handel und Konsumgüter; B5 Gesundheitswesen und Pharma; B6 Medien und Publishing; B7 Öffentliche Verwaltung; B8 Wissenschaft und Bildung; B9 Dritter Sektor.

**Fachrichtung** F1 Mensch & Gesundheit; F2 Kommunikation & Medien; F3 Technik & Information; F4 Wirtschaft & Recht; F5 Gesellschaft & Politik; F6 Natur & Umwelt; F7 Stadt & Kultur; F8 Gestaltung & Kunst.

- Excel-IDs und Originalbezeichnungen bleiben in privater Revisionssicht erhalten; originale Kategorien **nicht** anhand bloßer Strings still auf andere Taxonomien reduzieren. Das aktuelle V3-`classification.ts` ist nur ein kleiner regelbasierter Vorschlagskatalog (5 Felder / 4 Tätigkeiten / 3 Branchen) und **kein** fachlich identischer Crosswalk.
- Zunächst `reviewedMapping` getrennt je Dimension, mit Original-ID, geprüfter Zielformulierung, Mapping-Version, Prüfperson/Prüfentscheidung und Abweichungsgrund. Vorschläge sind Kandidaten; endgültiger fachlicher Zielwert erst nach Freigabe. Textähnlichkeit ist keine Katalog-ID.
- `Beratung` und `Selbstständigkeit` tauchen unter den Jobkategorien auf; die Januar-2026-Fachnotizen thematisieren diese Grenzziehung. `Selbstständigkeit` als Berufstyp, nicht Branche. `Beratung` als Tätigkeitsfunktion / Jobkategorie und ggf. eigenständige Beratungsbranche muss ausdrücklich diskutiert werden; nicht automatisiert verschieben.
- Ein unbekannter Arbeitgeber kann ohne erfundene `Organisation` bleiben. `Organisation.sector` nicht auf einer bereits gemeinsam genutzten Organisation still verändern; Konflikte pro Arbeitgeber separat prüfen.

## 5. Status- und Entscheidungsmatrix (1 Status pro Primärzeile)

**Statusrangfolge** vor fachlichem Abschluss: strukturelle Invalidität > expliziter Scope-Ausschluss > Review-Blocker > geprüfte Vorschautauglichkeit. Der Status ist pro Zeile exakt einer der vier Werte; detaillierte, mehrfache `reasons[]` bleiben separat. Revisionen ändern den Status, löschen die ursprüngliche Zeile nie.

| Status | Genau dann | Darstellung / Korrelation |
|---|---|---|
| `TECHNICALLY_INVALID` | identitätskritischer Quellfehler (fehlende/duplizierte Stationskennung, fehlende Profilschlüssel, nicht sicher interpretierbares Zeilenformat) oder unmöglicher Integritätsvertrag, so dass selbst ein sicherer `SourceStation` nicht erzeugt werden kann | Ledger-Eintrag mit privat nachvollziehbarem Fehler; nie als Station projizieren; kein stiller Drop |
| `SOURCE_EXCLUDED` | technisch identifizierbare, ausdrücklich **für den gewählten Scope** nicht zugelassene Zeile (z.B. 83 Zeilen außerhalb `evaluated`), oder fachlich dokumentierter, explizit freigegebener Quellausschluss | nicht aus Gesamtbilanz verlieren; für `scope=all` neu bewerten; nicht aufgrund unvollständiger Angaben ausschließen |
| `REVIEW_REQUIRED` | identifizierbare Zeile mit unsicherem Typ, Abschluss-/Zeitstatus, Katalog-/Kategorienmapping, Quellreihenfolge, Referenzkonflikt, unklaren Daten oder noch nicht explizit geprüfter Quellklassifikation | in privater Timeline mit Review-Warnung sichtbar; **nicht** als bestätigter Beitrag zählen; aggregierte Sankey-Projektion nur bei separater fachlicher Zulässigkeit |
| `ACCEPTED_FOR_PREVIEW` | keine technischen und Scope-Blocker; erforderliche Typ-, Status-, Zeit-, Katalog- und Kategorienfragen durch Betreiber als **Vorschau-Mapping** entschieden, mit Versions-/Evidenznachweis | nur lokale, ausdrücklich *unbestätigte* Vorschau; **niemals** SurveyResponse/Consent/Graduation impliziert |

WICHTIG: Ein Quellstatus `Automatischer Vorschlag` oder `MSI bestätigt=Ja` genügt **nie** für `ACCEPTED_FOR_PREVIEW`. `REVIEW_REQUIRED` kann bei unvollständiger Biografie zulässig bleiben; P3 zeigt solche Profile als Prüfpositionen und behauptet kein `Kein Master`.

Für den Basisaudit `scope=evaluated`: Summe aller vier Status = 1.279; davon **83** explizit `SOURCE_EXCLUDED: OUTSIDE_EVALUATED_SCOPE` (sofern nicht vorrangig technisch invalid). 1.196 ausgewählte Zeilen werden nicht automatisch akzeptiert. `scope=all`: keine dieser 83 Zeilen nur aufgrund des bisherigen 105er-Scope ausschließen.

## 6. Idempotenz- und Identitätsstrategie (P2, noch keine Implementierung)

- **Normalisierungs-Batch:** `normalizeCareerBatch` pro Profil aufrufen (oder gleichwertige profillokale Validierung), da `SourceStation.position` im Batch eindeutig sein muss. `SourceStation.key` ist im Batch eindeutig und beim übergreifenden Ledger durch den Profilschlüssel namespacet.
- **Profile-Key:** `(sourceFamily="MSI_XLSX", sourceDatasetFingerprint, pseudonym)` zur Reconciliation innerhalb genau dieser Quellversion. Für neue Datei-Versionen eine eigene geschützte Vergleichstabelle mit nachvollziehbarer Betreiberentscheidung; ohne bewusste Zuordnung keine Cross-Version-Identitätsbehauptung.
- **Station-Key:** `(profileSourceKey, Stationskennung)`; Quellreihenfolge, Arbeitgeber und Titel sind nicht stabil genug. Identische Stationskennung innerhalb des Quellbestands führt in den Fehlerledger, nicht zu stiller Deduplizierung.
- **Quellversion:** SHA-256 der XLSX und versionierte Konverter-/Mapping-Spezifikation; **keine** produktive `ImportRun`-/`ImportSource`-Entität. Staging-Korrelationsschlüssel nur lokal, getrennt von UUIDs im kanonischen Modell.
- **Reihenfolge:** tatsächliche Excel-Reihenfolge als lückenlosen, deterministischen physischen Tie-Breaker behalten; `Quellreihenfolge` als beobachteter Hinweis, nicht als ID. Konflikte ausgeben; keine implizite lineare Sortierung paralleler Stationen als historische Tatsache ausweisen.
- **Dry-run:** gleiche Eingabe + gleiche Mapping-Version + gleicher Scope → byte-stabile, deterministische normalisierte Prüfsicht nach definierter Serialisierung (private Pfade, Uhrzeiten und Laufzeit-Zufallswerte nicht in deterministischen Kern aufnehmen); Prüfsummen/Counts gleich. Keine automatische kanonische Personenzusammenführung.

## 7. Scope und späterer geschützter Sankey

- Vorschlag: **105 als manuell zu kontrollierende primäre Sicht**, aber 115 immer als vollständige Quelldatenbilanz. Die zusätzlichen zehn Profile/83 Stationen bleiben dokumentiert; Entscheidung darüber ist offen.
- Preview-Referenzkandidat **nur** nach expliziter Betreiberprüfung, und nur für die gesonderte Vorschauprojektion. Ein Profil mit zwei MSI-Markierungen bleibt `REFERENCE_AMBIGUOUS`; kein erster/jüngster MSI-Kandidat per Default.
- Vier Stufen: Ankerkandidat, Masterstudium, **Branche und Jobkategorie derselben zuerst zulässigen beruflichen Station**; überlappende oder zeitlich unklare erste Stellen -> unbekannt/ambig. Sieben Stufen: Kategorienkombinationen vor/nach MSI, **keine** frei erfundenen direkten Stationen-Paarungen.
- Bestehende Aggregatoren arbeiten mit `AnalyticsProfile.referenceDegreeId` und `demoAnchor` und sind semantisch **nicht direkt** Legacy-kompatibel. Kein `completeTestCase=true`, wenn Vollständigkeit nicht belegt. Eine getrennte P3-Projektion erfordert vor Umsetzung gesonderten Entwurf/Tests; kein Durchreichen der Legacy-Kohorte an `readSurveyAnalytics`.

## 8. Fachliche Entscheidungen zur Freigabe

| ID | Entscheidung (Vorschlag) | Freigabebedarf |
|---|---|---|
| D1 | `evaluated` (=105 / 1.196) ist Abnahme-Primärscope; `all` (=115 / 1.279) muss wählbar und immer bilanziert sein | Betreiber |
| D2 | Automatische Zuordnungsvorschläge und Excel-„bestätigt“ bleiben unbestätigte Vorschläge; Einzelentscheidung im lokalen Review | Betreiber |
| D3 | Strikte Typmatrix Abschnitt 3.2; `Studium (ohne Angabe)`, `Ausbildung`, Trainee/Volontariat und Weiterbildung zunächst Review | Fachverantwortung |
| D4 | Jahr/Monat/Unbekannt erhalten; Abschlussjahr ist **nicht** Graduationsjahr; Status nicht aus Enddatum allein | Fachverantwortung |
| D5 | Excel-Taxonomie in drei getrennten Dimensionen als Original erhalten; Umgang mit `Beratung`, `Selbstständigkeit` und Kategorieabweichungen explizit entscheiden | Fachverantwortung |
| D6 | Bei Doppel-MSI-Kandidat keine automatische Wahl; eindeutige Operator-Referenzauswahl für Preview, **nicht** SurveyResponse | Betreiber |
| D7 | Bestätigte Katalogidentitäten nur per expliziter Auswahl; keine automatische Institution-/Organisations-Merge-Logik | Architektur/Betreiber |
| D8 | Chronologie mit Quellreihenfolge und physischem Ordinal prüfen; Original parallel erhalten; Sortierungs-/Konfliktregel schriftlich bestätigen | Fachverantwortung |
| D9 | Originaltexte und sensible Provenienz ausschließlich in privatem, zeitlich begrenztem Sidecar; datenschutzrechtliche Zweck-/Rechtsgrundlage für Bearbeitung muss geklärt sein | Datenschutz/Betreiber |
| D10 | Sankey nur separat und eindeutig „UNCONFIRMED LEGACY“, keine bestätigte Survey-Kohorte, keine Vollständigkeitsbehauptung | Fachverantwortung / Architektur |

**Freigabestatus:** Keine dieser Entscheidungen ist durch die Erstellung dieses Entwurfs freigegeben. Es gilt für P2 **NO-GO**, bis fachliche Entscheidungen dokumentiert sind.

## 9. RED-Tests für P2 nach Freigabe (nur vollständig synthetische XLSX-Fixtures)

1. Genau eine Ledger-Position pro synthetischer Quellzeile; `accepted + review + excluded + invalid = total`; 105/115-Scope separat reproduzierbar (synthetische Äquivalente, keine Originalidentitäten).
2. Identische SourceKey-/ProfilKey-Kombinationen ohne Duplikate, doppelte Stationskennung oder fehlende Profil-ID -> Fehlerstatus ohne Verlust; wiederholte Dry-runs byte-stabil.
3. `SourceStation`-Kontrakt: `OBSERVED`/`ASSERTED`/`MISSING`/`UNKNOWN`, `MONTH`/`YEAR`/`IMPRECISE`, keine erfundenen Monats-/Abschlusswerte; nur berechtigte Assertion.
4. `Laufend=Ja` vs. leeres Ende ohne laufend; inkonsistente Status-/Endesemantik; Studium beendet ≠ abgeschlossen; separates `graduationYear`.
5. Bachelor, Master, Promotion als Degree, Berufsausbildung/Praktikum/Werkstudium/Ehrenamt/Selbstständigkeit/Austausch/Weiterbildung/Schule/Trainee als passende bzw. mehrdeutige CareerSteps; keine Doppelabbildung desselben Studiums.
6. Doppel-MSI-Kandidat blockiert Vorschau-Ankerwahl, Einzelkandidat ist **nicht** persönliche Referenzbestätigung; `MSI bestätigt=Ja` ändert nicht die SurveyResponse-Zahl.
7. Kategorieprüfungen für Fachrichtung, Job, Branche, Organisation und nicht anwendbar/offen; `Beratung` und `Selbstständigkeit` nicht mit Branche verwechseln.
8. Gleicher Arbeitgebername ohne bestätigte gemeinsame Identität -> zwei Kandidaten, keine automatische UUID-Gleichsetzung; vorhandene Katalog-Branche unverändert.
9. Zwei zeitlich überlappende Stationen und widersprüchliche Quellfolge bleiben in Staging erhalten; kein stilles Überschreiben durch Sortierung.
10. Private Pfad-Guards: Quelle außerhalb Git, Output außerhalb Git, kein Netzwerk, kein DB-Zugriff, dry-run Default, Maximalgröße, `--scope evaluated|all`, kein Dateitext in Fehlern/Logs.
11. Quelltext-/Notiz-Payload darf nicht im öffentlichen JSON, in Test-Snapshots, Git-Änderungen, Bildschirmfotos oder Logs stehen; allenfalls lokales Sidecar mit geregelter Löschung.
12. Fehlende Referenz, fehlende Kategorie, unbekannter Master: keine künstliche `completeTestCase`, keine fiktive `SurveyResponse`, keine Kontaktdaten.

**Vor P2:** `git status`, Commit-Baseline und CI sowie die normativen Dateien im tatsächlichen lokalen Codex-Checkout erneut lesen; Next.js-Agent-Dokumentation befolgen, falls später UI-Änderungen erfolgen. Erst nach Freigabe auf eigenem Feature-Branch TDD RED→GREEN→REFACTOR; kein Commit/Push/Merge/Deployment ohne getrennte Anweisung.

## 10. Vorschlag Codex-Kontextmanagement

- **Jetzt nach P0/P1**: Audit, Entscheidungen, offene Punkte und HEAD als kurze, unkritische `V4_P1_DECISION_SUMMARY` außerhalb des privaten Excel-Bestands zusammenfassen; anschließend Codex-Kontext **komprimieren** oder für P2 eine neue, saubere Sitzung verwenden.
- **Vor P2**: neuer Codex-Chat mit diesem abgenommenen Mapping, originalen normativen Repo-Dateien und synthetischen Fixtures. Keine Roh-XLSX, Pseudonyme oder Freitexte in den Codex-Chat kopieren.
- **Nach P2**: nach reproduzierten RED/GREEN-, Audit- und Testnachweisen komprimieren/neu starten. **Vor P3** dasselbe nach der Sicherheits-/Datenflussentscheidung; **vor P4** erneut für unabhängige Abnahme.
- Bei wachsendem Kontext, wiederholten Missverständnissen bei Referenzsemantik oder durchgehenden Dialogen über mehrere Entwicklungsphasen eher **neuen Codex-Kontext** statt fortgesetzter Komprimierung wählen.

---

**P0/P1-Fazit:** Eine deterministische Konvertierung ist als externe, lokale Staging-Transformation plausibel, erfordert aber die explizite Trennung von Quelle, Review, Katalogauswahl und kanonischer Survey-Bestätigung. Keine Änderung des normativen Datenmodells ist für P0/P1 erforderlich oder freigegeben.



# Anhang 3 – V4-Excel-Handover (historischer Arbeitsstand)

# Alumni CareerMap – Handover für neuen Chat: V4 Excel → Abnahme

**Stand:** 30.10.2026  
**Pilot:** Hochschule München, Management Sozialer Innovationen (MSI)  
**Ziel:** Bestehende Excel-Werdegänge verlustkontrolliert in eine quellneutrale CareerMap-Importvorbereitung konvertieren und in einer lokal geschützten, ausdrücklich **unbestätigten** Abnahmevorschau prüfen. Keine fingierte Datenspende, keine Produktivfreigabe.

## 1. Verifizierter GitHub-Stand

- Repository: https://github.com/duenne/alumni-careermap
- Branch `main`, HEAD `c0d0cbbce9b58d7dc5d55a1f805efb47971c2786` (Merge V3 end-to-end survey journey into main, 29.10.2026).
- GitHub Actions auf genau diesem Commit: Run #40964540044, **success** (https://github.com/duenne/alumni-careermap/actions/runs/40964540044).
- Integrierte Funktionen: Survey-Verwaltung, LinkedIn-/synthetischer Teilnahmeweg, Review, bewusste Bestätigung, transaktionale Karriere-/SurveyResponse-Speicherung, geschützter Survey-Analytics-Leseweg und interaktiver 4-/7-Stufen-Sankey.
- Normative Quellen **vor jeder Änderung lesen**: `AGENTS.md`, `docs/architecture/MVP_DOMAIN_MODEL.md`, `docs/requirements/REQUIREMENTS.md`, `docs/requirements/UC-01_ALUMNI_DATA_DONATION.md` und relevanten Code/Tests. Weiter: `docs/testing/V3_END_TO_END_INTEGRATION.md`, `docs/testing/V3_CLASSIFICATION_AND_CATALOG.md`, `docs/testing/V2_4_SANKEY_IMPROVEMENTS.md`.
- Technischer Stack: Next.js App Router, TypeScript, Prisma, PostgreSQL 17, Vitest, Playwright, d3-sankey. `AGENTS.md` verlangt RED→GREEN→REFACTOR, keine persönlichen Legacy-Daten im Repository, nur synthetische Testfixtures, keine Schemaänderungen ohne Architekturentscheidung, kein Commit/Push ohne ausdrückliche Anweisung.

## 2. Geprüfte Eingabedatei

**Datei:** `MSI-Karrierewege_2026-10-21.xlsx` (separat im neuen Chat erneut bereitstellen; nur auf autorisiertem, lokalem System für echte Daten verarbeiten).  
**SHA-256:** `b0715354cc3b66d950652af2c110e1ea99d675879b738addd6833f60e9e8cc18`.

| Blatt | Struktur und fachliche Rolle |
|---|---|
| `Stationentabelle (alle)` | 1.279 Zeilen, 37 Spalten, **115 Pseudonyme** und 1.279 eindeutige Stationskennungen; maßgebliche Roh-/Stationsquelle für die Konvertierung |
| `Profile` | 105 Profile; Sekundärkontrolle, nicht der Beleg einer persönlichen CareerMap-Bestätigung |
| `Werdegang` | 1.196 Stationen zu den 105 ausgewerteten Profilen; Kontrollsicht |
| `Bündelung (Sankey)` | historische Aggregation zum Plausibilisieren, **nicht** Quelle für kanonische Einzelstationen |
| `Kategorien` | 8 Jobkategorien, 9 Branchen, 8 Fachrichtungskategorien mit Beschreibungen |
| `Übersicht` | historische statistische Ausgangswerte für Vergleich |
| `Datenhinweise` | Quell-/Prüfhinweise, Grenzen der Chronologie und Klassifikation |

- 10 zusätzliche Pseudonyme mit 83 Stationen stehen in `Stationentabelle (alle)`, aber nicht in den 105 Profilen/1.196 Werdegangszeilen. **Explizite Scope-Entscheidung** und nachvollziehbare Ausnahmen notwendig.
- `Prüfstatus`: 794 × „Automatischer Vorschlag“, 485 × „Zuordnung offen“. Weder ist automatisch persönlich verifiziert.
- `Fachrichtung = MSI · Ausgangspunkt`: insgesamt 110 Stationszeilen bei 109 Profilen; innerhalb der 105 ausgewerteten Profile 106 Zeilen bei 105 Profilen: **ein Profil hat zwei MSI-Referenzkandidaten**. Keine automatische Auswahl.
- Zeitgenauigkeiten sind teils Monat, teils Jahr, teils unbekannt; laufende und unbekannte Enden unterscheiden. Originalmonate dürfen bei Projektion ins Jahresmodell nicht als künstliche Monate erfunden werden; Präzisionsverlust im Bericht dokumentieren.
- Spalten enthalten zum Teil lange Quellabschnitte, Beschreibungen, PDFs-/Recherchenotizen und ggf. identifizierende Freitexte; Pseudonymisierung ist keine Anonymisierung. Nicht in Repo, CI, Browserartefakte oder allgemeine Logs ausgeben.
- Historische `Profile.MSI bestätigt = Ja` ist **kein** bestätigter Referenz-Degree einer freiwilligen CareerMap-SurveyResponse, keine Einwilligung und keine Garantie einer vollständigen Biografie.
- Fachrichtung, Jobkategorie, Branche und Organisationssektor sind unterschiedliche Dimensionen; „Zuordnung offen“ und „Nicht anwendbar“ nicht unbesehen als kanonische Textkategorien persistieren.

## 3. Relevante aktuelle Code-Schnittstellen

- `src/lib/normalization/contract.ts`: quellneutraler `NormalizationInput`, `SourceStation`, OBSERVED/ASSERTED/MISSING/UNKNOWN, Datumspräzision YEAR/MONTH/IMPRECISE, explizite Klassifikation, Status und Position; `normalizeCareerBatch`.
- `src/lib/career-import/mapping.ts`: LinkedIn-orientierte Snapshot-Aufbereitung und `ImportReview` (Klassifikation, Status, Position, Katalog, Detailfelder); **nicht** eine allgemeine Excel-API.
- `src/lib/career-import/service.ts`: `saveCareerImport` verlangt explizite Referenz- und Beitragsbestätigungen, erzeugt in einer Transaktion auch `SurveyResponse`. **Für historische Excel-Daten nicht direkt einsetzen.**
- `src/lib/surveys/analytics.ts`: `readSurveyAnalytics` wertet **nur** bestätigte `SurveyResponse` des ausgewählten Surveys aus; die MSI-Bachelor-Projektion ist auf `CAREERMAP_MSI_PROGRAM_ID` begrenzt. Fehlende Stationen sind in Survey-Kohorten nicht als nachgewiesene Abwesenheit zu interpretieren.
- `src/lib/analytics/aggregate.ts`, `overview.ts`, Sankey-Komponenten: wiederverwendbar für **klar getrennte, betreibergeschützte** Abnahmeprojektion, sofern sie unbestätigte Kandidaten nicht als bestätigt ausgeben. Die getrennte V2.4-Synthetik-Datenbank ist **kein** Importziel für echte Legacy-Profile.
- Das normative PostgreSQL-Datenmodell umfasst Alumni, Degree, CareerStep, AlumniTimelineItem, Institution, Program, Organisation, Survey, SurveyResponse und optional AlumniContact; Quellen/Excel bleiben externe Vorverarbeitung, kein neues Domainmodell ohne ADR.

## 4. V4-Zielzustand und Sicherheitsgrenze

**Für Abnahme, vor rechtlicher/fachlicher Importfreigabe:**
1. Lokale, getrennte XLSX-Quelle **außerhalb des Git-Repos**; read-only ingest.
2. Deterministische, versionsgekennzeichnete **Staging-/Review-JSON**-Dateien mit SourceKey und Status/Evidenz (nur lokal), nicht als erfundener LinkedIn-Snapshot.
3. Quellneutraler Adapter nach `NormalizationInput` und bestehender Normalisierung; explizite `REVIEW_REQUIRED`-Fälle, keine Datenverluste ohne dokumentierte Entscheidung.
4. Dry-run/Auditbericht mit Quell- und Zielanzahlen, Vollständigkeit je Profil, Dubletten, Datums-/Statuskonflikten, Kategorietaxonomie, Referenzkandidaten und Ausnahmen.
5. Geschützte lokale **UNCONFIRMED LEGACY / NICHT BESTÄTIGT**-Abnahmeansicht: Profile/Timelines und, soweit fachlich zulässig, abgeleitetes 4-/7-Stufen-Sankey. KEINE `SurveyResponse`, kein Eintrag in die bestätigten Survey-Analytics, kein Public Endpoint/Deployment.
6. Erst nach expliziter Entscheidung über Datenherkunft, Rechtsgrundlage, Prüfung und Referenzzuordnung ist eine spätere kontrollierte kanonische Übernahme zu planen. Nicht in dieser Runde automatisch vollziehen.

**Nicht Teil der Aufgabe:** Einwilligungen nachtragen, Surveys fälschen, LinkedIn erneut abrufen, CV-Import, allgemeines IAM/Deployment, Produktionsmigration oder öffentliche Visualisierung personenbezogener Muster.

## 5. Abnahme-Gates

- Reconciliation: 1.279 Quelleinträge erhalten je **einen expliziten Bearbeitungsstatus**, und ihre Summe passt exakt; Wahl 105er-Kohorte ergibt 1.196, zehn außerhalb erfasste Profile/83 Stationen werden begründet ausgewiesen.
- Kein automatisches Akzeptieren von „Automatischer Vorschlag“, offenen Kategorien oder MSI-Referenzkandidaten.
- Doppelte MSI-Kandidaten, undatierte, überlappende, laufende oder mehrdeutige Stationen als Reviewfälle sichtbar.
- Fachrichtung (Abschluss/Studium), `CareerStep.functionArea`, `roleCategory` und `Organisation.sector` bleiben getrennt.
- Kategorienmapping ist dokumentiert; Excel-Taxonomie darf nicht unbemerkt auf V2.4-Testkategorien reduziert werden.
- Datumsprecision- und Textfeld-Verlustanalyse, konservative Statuslogik, keine künstliche Vollständigkeit.
- Nur synthetische Fixtures in Unit-/Integration-/Browser-Tests und GitHub CI. Lokale private Daten nicht in Snapshots, Screenshots, Logs oder Git.
- Schutz von Betreiberdaten durch serverseitige Zugriffskontrolle und expliziten **non-production**-Schalter; keine gewöhnliche SurveyResponse-Ergebnisansicht als Ersatz für eine Legacy-Abnahme.
- Tests: `npm run lint`, `npm test`, `npm run db:validate`, `npm run test:integration`, `npm run typecheck`, `npm run build`, relevante Playwright-Suites, vollständige Regression nach Integration. Berichte über tatsächlich ausgeführte Tests und offene Grenzen.

## 6. Empfohlene Arbeitsreihenfolge

**P0:** Sicherer neuer Branch von aktuellem `main`; Dateizugriff/Privatsphäre prüfen, Git-Status sichern.  
**P1:** Nur Lesen/Audit + verbindliche Mapping-Spezifikation und Statusregeln; keine Speicherung.  
**P2:** Testgetriebener, quellneutraler XLSX-Konverter mit Review-JSON, Verlust-/Abgleichbericht und strikt lokalen Ausgabedateien; synthetische Testworkbook.  
**P3:** Betreiber-geschützte lokale Abnahmevorschau und optional getrennte, klar unbestätigte Sankey-Projektion; keine kanonische SurveyResponse.  
**P4:** End-to-End-Abnahme mit 105er-Scope, zehn Ausnahmen, 1.279er-Gesamtabgleich, reproduzierbarer Anleitung und finalem Risiko-/Freigabebericht.

Die vollständigen Copy-&-Paste-Prompts stehen in `ALUMNI_CAREERMAP_V4_CODEX_PROMPTS_2026-10-30.md`.

## 7. Für den neuen Chat

Lade diese Handover-Datei und die Excel-Datei erneut hoch. Teile mit: „Wir machen V4 – Bestandsdatenmigration zur lokalen Abnahme. Bitte arbeite auf Basis dieses Handovers und prüfe zuerst den aktuellen main-Stand; zunächst nur P0/P1. Gib mir die Freigabe-Gates und später nacheinander die Codex-Prompts für P2–P4. Verwende für Codeänderungen Codex mit Extra High Thinking und teste ausschließlich mit synthetischen Fixtures. Originaldaten bleiben außerhalb des Repositories.“

**Hinweis:** Ein neuer Chat sieht nicht automatisch die in einem alten Chat angehängte Excel-Datei oder die Original-Kontextgeschichte. Dateien daher erneut bereitstellen. Dieses Handover ist eine Momentaufnahme; bei abweichendem aktuellen HEAD gilt der GitHub-Stand und das normative Domainmodell.

