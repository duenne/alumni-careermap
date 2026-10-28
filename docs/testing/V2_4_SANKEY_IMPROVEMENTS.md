# V2.4 – Sankey Usability & Aggregation

Ausgangspunkt: `feat/vertical-prototype-aggregation`, HEAD
`f95de319cb49c83bf83432443fc672f64233b290`. Stand: 2026-10-23.
Vor Beginn waren nur die bereits vorhandenen Skill-Verzeichnisse und
`skills-lock.json` unversioniert; sie bleiben unangetastet. Während der damaligen
Implementierung erfolgte kein Commit oder Push. Die anschließende freigegebene
Checkpoint-Prüfung ist in `V2_4_CHECKPOINT.md` dokumentiert.

## Ausgangszustand und Umfang

Die bestehende Sieben-Stufen-Aggregation kombiniert alle Kategorien einer
Person je Stufe. Unabhängige Branchen-/Jobmengen sind gemeinsame Profilmerkmale,
keine Paarungen einzelner Stellen. Die feste Grafikbreite betrug 2460 Pixel;
zahlreiche Kombinationen und große graue Flüsse erschwerten den Überblick.

Die neue Standardansicht hat vier Stufen: BA MSI, Master-Fachrichtung, erste
berufliche Branche nach MSI und Jobkategorie derselben Stelle. Die bisherige
Aggregation bleibt unverändert als **Gesamte Karrierehistorie –
Kategorienkombinationen** erhalten. Alle Daten werden weiterhin einmal aus
PostgreSQL geladen; Ansichtswechsel, Filter und Hervorhebungen arbeiten lokal
auf diesen kanonischen Profilen.

Domain Model, Prisma-Schema, Migrationen, Import, Normalisierung, Datenbank-
Schreibwege, Entwicklungsschutz und Karriere-Review wurden nicht verändert.
Es gibt keine neuen Entitäten, Tabellen, Kategorienvokabulare oder Abhängigkeiten.
Die vorhandene d3-sankey-Bibliothek wird weiterverwendet.

## Umsetzung und Akzeptanzkriterien

Die Umsetzung erfolgte in drei Inkrementen mit RED -> GREEN -> REFACTOR:

1. **V2.4a:** 20 neue Tests in `src/lib/analytics/overview.test.ts` vor
   `overview.ts`. Sie prüfen insbesondere Stellenfolge/Branchenwechsel,
   Arbeitgeber-/Jobpaarung, Gleichstände, unbekannte Jahre, Überlappungen,
   zulässige Tätigkeitstypen, Master-Mehrfachfälle und Status, fehlende Anker,
   Personen-/Flusssummen und Unveränderlichkeit der Eingaben. Die acht Tests der
   bisherigen Aggregation blieben unverändert und bestehen weiter.
2. **V2.4b:** Layout-/Interaktionstests vor Erstellung von `sankey-layout.ts` und
   Überarbeitung von `sankey.tsx`/`analytics.module.css`. Sie prüfen Default und
   Umschaltung, Häufigkeitssortierung mit deterministischen Gleichständen,
   Beschriftungen, Anteile, fehlend/unbekannt, vollständige Pfade und Fixierung.
3. **V2.4c:** Tests vor `filters.ts` und Filterintegration. Sie prüfen sichere
   Masterpräsenz, kombinierte Filter, geänderte Grundgesamtheit/Prozente,
   Profilauswahl und -wechsel, Reset, leere Ergebnisse und Tastatur-Alternativen.
   Danach Chromium mit 20 CI-Testprofilen und dem lokalen 100er-Bestand.

Überprüfbare Abnahmebedingungen: vier Stufen standardmäßig; sieben Stufen
weiterhin erreichbar; Branche/Job immer von einer ausgewählten Station; kein
Tie-Break über Array-Reihenfolge oder Timeline-Position; eine Person je Grenze;
gleiche Zu-/Abflusssummen; Desktop ohne horizontales Scrollen; vollständige
Timeline bei Auswahl; keine zusätzlichen Datenbankabrufe durch Filter/Wechsel.

## Auswahl der ersten beruflichen Station

`aggregateOverview` ist eine reine TypeScript-Funktion. Sie verwendet die
bestehende Aggregation zur unveränderten Prüfung von Demoanker, Timeline und
Ownership im bereits pseudonymisierten Lesevertrag. Fehlende, mehrdeutige,
unzulässige oder undatierte Anker führen weiterhin zu ausgewiesenen Ausschlüssen.
Es wird kein Referenzabschluss aus Titeln oder Rohdatenhinweisen erfunden.

Die explizite Auswahl beruflicher Tätigkeitstypen lautet `EMPLOYMENT`,
`SELF_EMPLOYMENT`, `INTERNSHIP`. Ausbildung, Weiterbildung, Studium,
Arbeitslosigkeit, Ehrenamt und `OTHER` liefern keine automatische erste Stelle.
Dies ist eine Auswahlregel für diese Übersicht, keine Umklassifikation der
gespeicherten Stationen. Sie bleiben vollständig in der Timeline und Historie.

Ein Kandidat braucht ein bekanntes Startjahr **strikt größer als das MSI-Endjahr**
und eine Timeline-Position hinter dem eigenen Demoanker. Unter diesen Kandidaten
wird das kleinste Startjahr gesucht. Ein fehlendes Endjahr hindert eine Auswahl
nicht, wenn der Beginn eindeutig ist. Titel, Name des Arbeitgebers, Aktualität,
Endjahr und Array-Reihenfolge sind keine Tie-Breaker.

Zwei oder mehr Kandidaten mit gleichem frühestem Jahr ergeben **Mehrere mögliche
erste Tätigkeiten**, keine gewählte Stations-ID. Auch gleiche Kategorien erlauben
keine erfundene Auswahl einer konkreten Station. Eine möglicherweise frühere
undatierte Tätigkeit, ein Beginn im MSI-Endjahr oder eine widersprüchliche
Position ergibt **Erste Tätigkeit zeitlich ungeklärt**. Ein bekannt späterer
Problemfall verdrängt keine bereits eindeutig frühere zulässige Stelle.

Vor MSI-Ende begonnene Beschäftigungen werden nicht zu nach MSI begonnenen Stellen
umgedeutet, auch wenn sie über das Studium hinauslaufen. Die Abwesenheitskategorie
heißt deshalb **Kein Stellenbeginn nach MSI (Testfall vollständig)**; sie behauptet
nicht, die Person habe nach MSI überhaupt nicht gearbeitet. Ohne ausdrücklich
vollständigen synthetischen Testfall heißt der Zustand unbekannt.

Bei einer eindeutigen Auswahl stammen **Branche und Jobkategorie aus derselben
CareerStep-ID**: Branche von deren Organisation, Jobkategorie von dieser Station.
Fehlende Werte bleiben unabhängig als „Branche unbekannt“ oder „Jobkategorie
unbekannt“ sichtbar. Es entstehen weder Mengen beruflicher Kategorien noch
Kreuzprodukte verschiedener Stellen.

## Masterstudium und Zählweise

Ein Master ist eine `DEGREE/MASTER`-Phase mit eindeutig nach MSI liegendem Beginn
und entsprechender Timeline-Position. Der Abschlussstatus muss dafür nicht
COMPLETED sein: laufende, abgebrochene und im Status unbekannte Studienphasen
bleiben als Studienphasen erhalten. Die Ansicht heißt Master**studium**, nicht
Masterabschluss; die Timeline zeigt den tatsächlichen Status.

Genau eine passende Phase liefert ihre Fachrichtung. Mehrere passende Phasen
ergeben **Mehrere Masterstudien**, auch bei identischen Fachrichtungen. Diese
bewusst allgemeine Mehrfachkategorie verhindert neue Kombinationsexplosionen und
wählt keine bevorzugte Fachrichtung. Alle Fachrichtungen und Phasen bleiben in
der vollständigen Timeline sichtbar. Eine Mehrfachkategorie ist eine bekannte
Mehrfachsituation, keine fehlende Angabe.

Möglicherweise nach MSI liegende oder überlappende Masterphasen bleiben zeitlich
ungeklärt. Mindestens eine sichere Nach-MSI-Phase begründet „mit Masterstudium
nach MSI“, auch wenn weitere Phasen zeitlich ungeklärt sind. Sonst ist die
Masterpräsenz unbekannt. Nur vollständig deklarierte synthetische Fälle ohne
möglichen Nach-MSI-Master dürfen „Kein Master“ anzeigen. Bei ausschließlich früheren
Phasen lautet das präziser „Kein Master nach MSI“.

Jede eingeschlossene Person liefert genau eine Einheit an jeder benachbarten
Stufengrenze: **3 Beiträge** in der Übersicht, **6** in der Historie. Mehrere Stellen
erzeugen kein Mehrfachzählen und keine Bruchteile. Master und erste Stelle müssen
nicht aufeinander folgen; ihre Verbindung zeigt gemeinsame Personenmerkmale.
Die tatsächliche Branche-/Jobpaarung der ersten Stelle ist hingegen gesichert.

## Filter, Auswahl und Bedienung

- **Masterstudium:** alle / mit / ohne Masterstudium nach MSI. Beide Ansichten
  verwenden dieselbe reine Präsenzprüfung. Unbekannte Fälle werden aus „mit“ und
  „ohne“ entfernt und gesondert gezählt; sie werden nicht zu „kein Master“.
- **Analyse-Schwerpunkt:** alle / Branchen / Jobkategorien / Fachrichtungen.
  Dies ist ausdrücklich ein Darstellungsfokus. Er verändert keine Personengruppe,
  Knotenwerte oder Bandbreiten. Kombination mit dem Masterfilter ist möglich.
- Die aktuelle Personenzahl, ausgeblendete Fälle, Unklarheiten und
  Übergangsbeiträge stehen direkt am Diagramm. Prozentwerte beziehen sich auf
  **alle aktuell dargestellten Personen**, nicht auf Stationen oder nur bekannte
  Kategorien. Die Hervorhebung verändert die Bezugsmenge nicht.
- Hover über Knoten oder Verbindung verwendet ausschließlich die zugehörigen
  `alumniIds`, um ganze dargestellte Personenpfade hervorzuheben. Klick/Enter/
  Leertaste fixiert die Auswahl; erneuter Klick oder Escape löst sie. Eine
  Fixierung hat Vorrang vor zufälligem Hover. „Auswahl aufheben“ entfernt auch
  die separate Profilauswahl.
- Die Alumni-Auswahl zeigt weiterhin alle Timeline-Stationen. Ein durch den
  Masterfilter ausgeblendetes Profil wird erklärt, statt einen anderen Pfad zu
  erfinden. Unklare Pfadstufen werden in der Auswahlmeldung benannt. „Alle Filter
  zurücksetzen“ setzt Masterfilter und Fokus zurück; die Timeline bleibt erhalten.
- Die SVG-Knoten besitzen **einen** wandernden Tabstopp. Pfeile wechseln Knoten,
  Pos1/Ende springen, Enter/Leertaste fixiert, Escape löst. Nicht jede Verbindung
  muss mit Tab durchlaufen werden. Beschriftete Auswahlfelder bieten dieselbe
  Knoten-/Verbindungsauswahl ohne Hover. Eine vollständige Häufigkeitstabelle mit
  Stufe, Kategorie, Personen und Prozenten dient als Textalternative.

## Visuelle Umsetzung

Die vier Stufen verwenden die verfügbare Containerbreite. Beschriftungen werden
vollständig umgebrochen; Knotenabstände berücksichtigen die benötigten Textzeilen.
Standard ist absteigende Personenhäufigkeit, Gleichstände werden nach deutschem
Kategorienamen und stabiler Knoten-ID geordnet. Alphabetische Sortierung ist
optional. d3 führt zwölf Relaxationsschritte für die Verbindungsanordnung aus.
Die Kategoriegruppen bleiben trotzdem bewusst nach Häufigkeit geordnet; eine
garantiert global kreuzungsfreie Anordnung wird nicht behauptet.

Apricot, Blau, Grün und Lavendel bleiben semantisch erhalten. Abwesenheitsknoten
sind neutral und ihre Verbindungen haben geringere Deckkraft, **bei unveränderten
Breiten**. Unbekannte Angaben sind gelb und zusätzlich ausdrücklich beschriftet.
Kategorien und Zahlen sind somit nicht allein über Farbe erkennbar.

Die Vollansicht behält die große Breite für sieben Spalten. Lange Kombinationen
können dort visuell auf zwei Zeilen verkürzt werden; Tooltip, Statusmeldung,
Auswahlfelder und Häufigkeitstabelle enthalten den vollständigen Text. Die
Übersicht verkürzt ihre Kategorien nicht. Unter 720 Pixeln Inhaltsbreite wird sie
innerhalb ihres Containers horizontal scrollbar, damit Schrift lesbar bleibt.

## Frisch berechneter Vergleich des 100er-Bestands

Reproduzierbar mit `npm run analytics:compare`. Das neue **rein lesende** Skript
`scripts/analytics-comparison.ts` liest einmal den kanonischen PostgreSQL-Bestand
über den bestehenden geschützten Leseweg und berechnet beide Funktionen auf
demselben Array. Es importiert und verändert keine Daten. Nur aggregierte Zahlen
und Kategorien werden nach `artifacts/v2.4/comparison.json` geschrieben; keine
Profilkennungen oder Quelldaten. Die lokalen Phase-D-Dateien werden nicht gelesen.

| Kennzahl | Gesamthistorie | Neue Übersicht |
|---|---:|---:|
| Personen / ausgeschlossene Personen | 100 / 0 | 100 / 0 |
| Knoten / Verbindungen | 81 / 133 | 24 / 56 |
| Beiträge über alle Stufengrenzen | 600 | 300 |
| Pfade mit unbekannten / zeitlich ungeklärten Stufen | 28 | 0 |
| Nicht auf eine einzelne Fachrichtung/Station reduzierbare Mehrfachfälle | Kombinationen je Stufe | 10 Personen mit mehreren Masterstudien |
| Eindeutig ausgewählte erste berufliche Stationen | keine Stationsauswahl | 95 |
| Vollständige Fälle ohne passenden neuen Stellenbeginn | keine Stationsauswahl | 5 |
| Mehrere mögliche / zeitlich ungeklärte erste Tätigkeiten | keine Stationsauswahl | 0 / 0 |
| Personen mit / ohne Masterstudium nach MSI | 50 / 50 nach gemeinsamer Filterprüfung | 50 / 50 |

Es gibt 40 Personen mit genau einer und 10 mit mehreren Nach-MSI-Masterphasen:
insgesamt 60 Phasen, davon 55 synthetisch als COMPLETED deklarierte und 5 laufende.
Im lokalen Bestand ist die Masterpräsenz bei keiner Person unbekannt. Beide
Masterfilter ergeben daher jeweils 50 Personen; Tests decken zusätzlich echte
Unklarheitszustände ab.

Häufigste Branchen der **ersten ausgewählten Stelle**, Bezugsmenge 100:
Dritter Sektor 29, Beratung 15, Wissenschaft & Bildung 13, IT & Technologie 12,
Öffentliche Verwaltung 10, Produktion & verarbeitendes Gewerbe 7,
Finanzen & Versicherung 5, Handel & Konsumgüter 4; weitere 5 ohne neuen Stellenbeginn.

Häufigste Jobkategorien derselben Stellen: Strategie & Planung 26,
Produktion & operatives Management 20, Controlling & Reporting 15,
Forschung & Entwicklung 13, Führung 13, Marketing & Vertrieb 8;
weitere 5 ohne neuen Stellenbeginn. Die acht Branchen und sechs Jobkategorien
werden nicht zu künstlichen Kombinationen aufgefächert.

Zum Vergleich heißen die häufigsten bisherigen **reinen Einzelknoten** nach MSI
Dritter Sektor 19 und Strategie & Planung 19. Diese Werte sind nicht die gesamte
Branchen-/Jobpräsenz: 30 Personen stehen in mindestens einer beruflichen
Kategorienkombination. Deshalb ist etwa 29 vs. 19 keine Zunahme tatsächlicher
Alumni, sondern eine andere, ausdrücklich definierte Projektion desselben Bestands.

Die 28 Unklarheiten der Historie betreffen 13 vor-MSI-Ausbildungsfachrichtungen
und 15 unklare Nach-MSI-Arbeitsmengen. Die neue Frage betrachtet keine
Vor-MSI-Ausbildung und nur den ersten zulässigen neuen beruflichen Beginn.
Vor MSI begonnene Überschneidungen disqualifizieren daher nicht automatisch eine
spätere eindeutig neu begonnene Stelle. Keine Station wurde dafür gelöscht oder
zeitlich korrigiert. Die zehn Mehrfach-Master bleiben ausdrücklich als Mehrfachfall
sichtbar, auch wenn dies kein unbekannter/zeitlich ungeklärter Pfad ist.

## Visuelle Nachweise und Prüfungen

Bei rechnerisch 1280 Pixeln verfügbarer Breite misst das Layout der Übersicht
1280 × 650 statt 2460 × 1550 der vergleichbaren neu geordneten Vollansicht.
Chromium prüft Desktop (1440), Tablet (834) und Mobil (375). Für Desktop/Tablet
wird horizontaler Überlauf im Vier-Stufen-Container ausgeschlossen. Der lokale
100er-Test kontrolliert zusätzlich echte SVG-Textgrenzen: keine vertikalen
Labelüberschneidungen je Spalte und keine außerhalb der Grafik liegenden Labels.
Er zählt weiterhin sämtliche 432 Timeline-Stationen aller 100 Profile.

Screenshots sind lokal unter `artifacts/v2.4/` gespeichert:
`overview-100.png`, `desktop-overview-100.png`, `tablet-overview-100.png`,
`mobile-overview-100.png` sowie die drei `*-overview-20.png`-CI-Beispiele.
Die Darstellung ist im Browser geprüft; ein gesonderter Test mit realer
Screenreader-Software wurde nicht durchgeführt.

Tatsächlich ausgeführte Prüfungen:

| Befehl / Lauf | Ergebnis |
|---|---|
| Bestehende Aggregation + Dashboard vor Änderungen | 9 bestanden |
| V2.4a: neue und alte Aggregation | 28 bestanden (20 neu + 8 unverändert) |
| V2.4b: Layout und Interaktion nach RED | 5 bestanden |
| V2.4c und alle gezielten Analytics-Unit-/UI-Tests | 51 bestanden |
| `npm run lint` | bestanden |
| `npm test` | 933 bestanden, 1 optionaler alter lokaler Korpustest übersprungen |
| `npm run db:validate` | bestanden |
| `npm run test:integration` | 371 bestanden, 1 optionaler alter lokaler Korpustest übersprungen |
| `npm run typecheck` | bestanden |
| `npm run build` | bestanden |
| `npm run test:e2e` | gesamte Kette bestanden: 59 Chromium-Tests |
| darin Review / Produktionsschutz | 4 bestanden |
| darin Import / OAuth-Mocks / Mapping / persistenter Workflow | 30 / 8 / 6 / 2 bestanden |
| darin Analytics Desktop / Tablet / schmal | 9 bestanden (3 je Bildschirmgröße) |
| `npm run test:e2e:analytics:local` | 1 bestanden: 100 Profile, 432 Stationen, Filter, Prozente und Labelgeometrie |
| `npm run analytics:compare` | beide Aggregationen auf demselben DB-Snapshot berechnet |
| `git diff --check` | bestanden |

Alle neuen CI-Tests laufen mit neu erstellten synthetischen Minimalfixtures;
kein lokaler 100er-Datensatz ist Voraussetzung für CI. Die beiden übersprungenen
alten Korpustests werden nicht als bestanden ausgegeben. Stattdessen wurde der
100er-Bestand ausdrücklich über die vorhandene lokale Browserabnahme und den
neuen lesenden Vergleich geprüft. Keine der angeforderten Prüfungskategorien
blieb unausgeführt. Ein gesonderter Screenreader-Praxistest bleibt offen.

Die RED-Läufe scheiterten vor der jeweiligen Implementierung wie beabsichtigt.
Browserprüfungen deckten anschließend die zunächst uneindeutigen zugänglichen
Select-Namen und einen Konflikt zwischen Hover und Tastaturfixierung auf. Beides
wurde in der UI korrigiert; der Regressionstest hält zusätzlich fest, dass Hover
über eine andere Kategorie die fixierten Personenpfade nicht ersetzt. Eine
Viewport-Prüfung scrollt die Grafik zuerst vertikal in Sicht; der strikte Test
gegen horizontalen Überlauf bleibt erhalten. Kein Test wurde entfernt und keine
Flusssummen-Assertion abgeschwächt. Nach Sandbox-Sperren wurden die erforderlichen
Browser-/Datenbankaufrufe mit Ausführungsfreigabe wiederholt.

Manuelle Abnahme: lokalen Entwicklungsserver wie bisher mit
`npm run analytics -- dev` starten und <http://127.0.0.1:3106/dev/analytics>
öffnen. Standardmäßig müssen vier Stufen und 100 Personen sichtbar sein. Die
Masterfilter ergeben je 50, der Fokus verändert die Zahl nicht. Ein Profil mit
mehreren Masterphasen zeigt den Mehrfachknoten; seine vollständige Timeline bleibt
erreichbar. Knoten/Verbindung fixieren, eine andere Kategorie berühren, erneut
klicken oder Escape drücken. Anschließend zur Gesamthistorie wechseln: 100
Personen, 600 Beiträge und die bisherigen Kombinationen. Über „Alle Filter
zurücksetzen“ und „Auswahl aufheben“ lassen sich Zustände getrennt zurücksetzen.

## Offene fachliche Entscheidungen und Grenzen

- „Beratung“ und „Selbstständigkeit“ sind hinsichtlich Branche, Jobkategorie oder
  Erwerbsform weiterhin fachlich zu klären. Dieses Inkrement übernimmt vorhandene
  kanonische Kategorien und löst diese Klassifikationsfrage nicht.
- Fachrichtungen von Berufsausbildungen erhalten kein neues Datenbankfeld.
- Jahresgenauigkeit erlaubt keine Auswahl innerhalb desselben Startjahres.
  Die Mehrdeutigkeits-/Unklarheitskategorien sind deshalb Teil des Ergebnisses.
- Die neue erste-Stelle-Regel beantwortet eine andere Frage als die späteste
  Beschäftigung oder der gesamte Verlauf. Ehrenamt ist hier kein erster beruflicher
  Stellenbeginn; es bleibt in der Gesamthistorie sichtbar. Das ist keine Löschung.
- Die knappe Mehrfach-Master-Kategorie verzichtet bewusst auf einen einzelnen
  stellvertretenden Fachbereich. Details bleiben in den individuellen Timelines.
- Die synthetische Vollständigkeitsdeklaration und Demoanker sind keine menschlich
  bestätigten Befragungsteilnahmen. Es erfolgt keine Produktionsfreigabe.
