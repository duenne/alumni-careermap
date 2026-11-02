# Karrierewege verstehen

Die Standardansicht der MSI-Auswertung beschreibt die **gespeicherte Stationsreihenfolge**. Sie beantwortet: Welche Stationstypen sind vor dem Referenzeintrag erfasst, welcher Eintrag folgt darauf und welcher weitere Eintrag ist zuletzt erfasst? Das ist keine Ableitung zeitlich strikt getrennter Phasen und keine Behauptung einer heutigen Tätigkeit.

Bekannte Stationsinhalte bleiben bei gleichen Jahresgrenzen, Überlappungen oder fehlenden Jahren sichtbar. Die bisherigen strikten Vier-/Sieben-Stufen-Projektionen bleiben als zusätzliche Ansichten verfügbar. Das kanonische Modell, Referenzbestätigungen und gespeicherte Daten werden nicht verändert.

## Überblick und Einzelwege

- Alle vollständigen Folgen von Stationstypen werden mit ihrer Profilzahl gebündelt. Wiederholte Beschäftigungen und Zwischenstationen bleiben erhalten.
- Eine gewählte Folge grenzt das Diagramm auf ihre Profile ein. Die Profilwahl zeigt sämtliche konkreten Stationen unmittelbar am Diagramm, einschließlich Titel, Organisation, Zeiträumen, erfassten Kategorien und Studienstatus.
- Die neue Übersicht benötigt keine bekannten Referenzjahre. Referenz-Ownership und -Bestätigung werden weiterhin durch die vorhandenen serverseitigen Dienste abgesichert; die Darstellung prüft eindeutige, abgeschlossene MSI-Bachelorreferenzen und gültige Stationsreihenfolgen.
- Kategorien stammen ausschließlich aus den kanonischen Daten. Fehlen Kategorien, werden vorhandene Tätigkeits-/Studientitel und Organisationsbezeichnungen verwendet, ohne daraus Branchen oder Aufgabenklassen zu erfinden.
- Bei mehr als zwölf unterschiedlichen Bezeichnungen in der letzten Spalte bleiben die acht häufigsten und fehlende weitere Einträge einzeln sichtbar. Die übrigen Bezeichnungen werden ausdrücklich als „Weitere Stationen“ mit Bezeichnungszahl gebündelt. Die Kategorie bleibt anklickbar; sämtliche enthaltenen Profile und ihre vollständigen Stationen bleiben erreichbar. In eingegrenzten Stationsfolgen wird die Übersicht neu berechnet.
- Jede Spaltengrenze zählt jedes enthaltene Profil genau einmal. Die Häufigkeiten von Branchen, Aufgaben, Studien-/Tätigkeitstiteln und Organisationen zählen ein Profil pro Bezeichnung höchstens einmal; Summen über verschiedene Bezeichnungen können deshalb die Profilzahl überschreiten.

## Prüfung mit der lokalen synthetischen Demo

Die laufende lokale Demobefragung enthält 100 Profile und 432 Stationen mit 38 unterschiedlichen Folgen von Stationstypen. 50 Profile enthalten Masterphasen, zehn davon mehrere. Die Demo enthält Stationsbezeichnungen, aber keine hinterlegten Branchen-, Job- oder Fachkategorien. Sie unterscheidet sich darin von der separaten kategorisierten Analytics-Testdatenbank.

Die Browserabnahme vergleicht auf dem Desktop alle 100 ausgewählten Profile und ihre 432 Stationen mit der kanonischen Projektion der geschützten Demo-API. Tablet und Mobilgerät prüfen zusätzlich den längsten Weg mit zwölf Stationen. Diagrammbeschriftungen werden auf Überlappungen und Abschneiden geprüft; jede der drei Spaltengrenzen muss 100 Beiträge enthalten. Dabei erfolgen keine schreibenden HTTP-Aufrufe.

Lokale Abnahmebelege und Screenshots: `artifacts/career-understanding/acceptance.json` sowie `*-100-*.png` (gitignoriert).

Automatisierte Regressionen:

```sh
npm test -- src/lib/analytics src/app/dev/analytics
npm run test:e2e:analytics
```

Die Unit-Tests prüfen insbesondere Jahresgrenzen, fehlende Zeiten, fehlende Kategorien, wiederholte Stationen, explizite Referenzen, ungültige Timelines, Profilzählung und gebündelte Bezeichnungen. Die Browsertests verwenden eigenständige synthetische PostgreSQL-Fixtures auf Desktop, Tablet und Mobilgerät und prüfen Auswahl über Stationsfolgen, Diagrammkategorien und vollständige Einzelwege.

## Feinschliff: Fragen vor Detailanalyse

Die Darstellung führt in drei Schritten durch die Daten: **(1) vier gezielte Fragen**, **(2) Karriereverläufe im Sankey**, **(3) konkrete Stationsfolgen und Einzelwege**. Technische Optionen und Methodik folgen danach. Je Frage ist eine kleine Auswertung geöffnet. Zählweisen und Diagrammbedienung sind über beschriftete, per Tastatur und Touch erreichbare Fragezeichen aufklappbar. Wesentliche Einschränkungen, insbesondere fehlende Branchenangaben und die Bedeutung der Reihenfolge, bleiben direkt beim Ergebnis sichtbar.

Der lesende Abgleich der laufenden synthetischen Demobefragung ergibt:

| Frage | Ergebnis aus den 100 gespeicherten Profilen |
|---|---|
| Vorerfahrungen | 37 Profile haben Einträge vor dem MSI-Eintrag, 63 keine früheren Einträge. 15 enthalten dort Beschäftigung, 13 Berufsausbildung, 13 Ehrenamt, sieben einen weiteren Bachelor und fünf Selbstständigkeit. Mehrere Typen je Profil sind möglich. Das ist keine Aussage über geografische Herkunft. |
| Nächster Eintrag hinter MSI | 36 Masterstudium, 27 Beschäftigung, 14 Praktikum, neun Weiterbildung/Austausch, neun Selbstständigkeit, ein Ehrenamt; vier ohne weiteren Eintrag. Diese Position ist kein Nachweis eines Beginns nach dem Abschluss. |
| Weiterstudium | 50 Profile enthalten danach Masterphasen, zehn davon mehrere. 15 unterschiedliche Masterbezeichnungen sind erfasst. Häufigste Bezeichnung: „M.A. Internationale Entwicklung“ bei sechs von 50 Masterprofilen (12 %). Die Bezeichnungen werden nicht zu vermeintlich gleichen Studiengängen zusammengeführt. |
| Erster sicher nach MSI begonnener Berufsschritt | Für 95 Profile eindeutig bestimmbar: 85 Beschäftigungen und zehn selbstständige Tätigkeiten, kein Praktikum unter diesen 95 ausgewählten ersten Stationen. Für fünf Profile ist dieser Beginn nicht bestimmbar. Die 14 Praktika als nächste Timeline-Einträge sind damit nicht gleichzusetzen. |
| Späterer Berufsweg | 95 Profile haben berufliche Stationen hinter dem Referenzeintrag. Als zuletzt erfasste berufliche Rolle ist „Wissenschaftliche:r Mitarbeiter:in“ am häufigsten (acht von 95); beim ersten sicher nach MSI begonnenen Berufsschritt „Product Manager Civic Tech“ (sieben von 95). |
| Branchen bei Einstieg und späterem Verlauf | Für keine der jeweils 95 ausgewählten beruflichen Stationen ist eine Branche hinterlegt. Eine Branchenverteilung oder dominierende Branche lässt sich deshalb nicht belegen. Arbeitgebernamen und Berufsbezeichnungen werden dafür nicht als Ersatz verwendet. |

Die Prozentangaben beziehen sich je nach Frage ausdrücklich auf alle Profile, Masterprofile oder die ermittelten beruflichen Stationen. Der Wechsel zwischen Berufseinstieg und letzter erfasster beruflicher Station berechnet Branchen und Tätigkeiten aus derselben jeweils ausgewählten Station. Eine später erfasste Branche darf eine fehlende Einstiegsbranche nicht auffüllen.
