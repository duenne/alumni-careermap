# Szenario UC-01: Eine Alumni-Umfrage erstellen, durchführen und abschließen

**Projekt:** Alumni CareerMap – Hochschule München  
**Anwendungsfall:** Alumni-Befragung für den Studiengang Master Informatik  
**Hauptakteur:** Studiengangsleiter  
**Weitere Akteure:** Alumni, Systemadministration  
**Ziel:** Karrierewege der Absolventinnen und Absolventen erfassen, aggregiert auswerten und den Teilnehmenden zugänglich machen.

**Status:** Fachliches Soll-Szenario zur Verifikation und testgetriebenen Implementierung.

---

## 1. Ausgangssituation und Motivation

Prof. Dr. Martin Weber (fiktiver Name) leitet den Masterstudiengang Informatik an der Hochschule München.

Er möchte erfahren, wie sich die beruflichen und akademischen Karrierewege seiner Absolventinnen und Absolventen nach dem Studienabschluss entwickelt haben.

Insbesondere interessieren ihn folgende Fragen:

- In welchen Branchen arbeiten die Alumni?
- Welche beruflichen Positionen haben sie unmittelbar nach ihrem Masterabschluss übernommen?
- Welche typischen Karrierewege zeichnen sich über mehrere berufliche Stationen hinweg ab?
- Wie viele Absolventinnen und Absolventen haben promoviert oder weitere Qualifikationen erworben?
- Welche Entwicklungen lassen sich in unterschiedlichen Abschlussjahrgängen erkennen?

Die Ergebnisse sollen die Weiterentwicklung des Studiengangs unterstützen, Studieninteressierten eine realistische Vorstellung möglicher Karrierewege vermitteln und den Alumni selbst interessante Einblicke in die Entwicklung ihres Netzwerks ermöglichen.

Um diese Informationen zu erheben, möchte Prof. Weber eine freiwillige Alumni-Umfrage über die Plattform Alumni CareerMap durchführen.

Er plant eine Erhebungsphase von rund vier Wochen, in der die Alumni ihre Bildungs- und Berufswege über LinkedIn, einen Lebenslauf oder manuell bereitstellen können.

## 2. Anmeldung und Anlegen einer neuen Umfrage

Prof. Weber öffnet Alumni CareerMap und meldet sich mit seinem Hochschulaccount an.

Das System erkennt ihn als berechtigten Studiengangsverantwortlichen für den Studiengang Master Informatik. Er gelangt auf eine Verwaltungsoberfläche, auf der er seine bisherigen Umfragen, deren Status und die wichtigsten Kennzahlen sehen kann.

Er wählt die Funktion **„Neue Alumni-Umfrage erstellen“**.

Das System öffnet einen Assistenten. Zunächst werden die grundlegenden Eigenschaften festgelegt:

| Einstellung | Beispielwert |
|---|---|
| Titel | Karrierewege unserer Informatik-Alumni 2026 |
| Hochschule | Hochschule München |
| Studiengang | Master Informatik |
| Zielgruppe | Absolventinnen und Absolventen des Studiengangs |
| Abschlussjahrgänge | 2015–2026 |
| Geplanter Start | 16. November 2026 |
| Geplantes Ende | 15. Dezember 2026 |
| Sprache | Deutsch |
| Verantwortliche Person | Prof. Weber |
| Status | Entwurf |

Die Hochschule und der Studiengang werden nach Möglichkeit aus bereits hinterlegten Stammdaten ausgewählt. Prof. Weber muss diese Informationen nicht jedes Mal erneut erfassen.

Das System legt eine neue Umfrage mit einer eindeutigen ID an. Sie ist zunächst nur für berechtigte Personen sichtbar.

**Erwartetes Systemverhalten:** Mehrere Umfragen dürfen parallel oder nacheinander existieren. Jede Umfrage besitzt ihre eigene Konfiguration, Laufzeit, Teilnehmerzuordnung und Auswertung. Eine neue Umfrage verändert keine bereits abgeschlossene Umfrage.

## 3. Personalisierung der Startseite

Prof. Weber möchte den Alumni erklären, warum ihre Teilnahme wichtig ist. Er öffnet deshalb den Bereich **„Startseite gestalten“**.

Das System stellt eine Standardvorlage bereit, die er für seinen Studiengang anpassen kann.

Er hinterlegt ein Porträtfoto, seinen Namen, seine Funktion, die Bezeichnung des Studiengangs und einen persönlichen Begrüßungstext.

Der zentrale Einführungstext lautet beispielsweise:

> **Liebe Absolventinnen und Absolventen unseres Masterstudiengangs Informatik,**
>
> wir möchten besser verstehen, welche beruflichen Wege unsere Alumni nach ihrem Studium eingeschlagen haben.
>
> Eure Erfahrungen helfen uns, die beruflichen Entwicklungsmöglichkeiten unserer Absolventinnen und Absolventen sichtbar zu machen und unseren Studiengang kontinuierlich weiterzuentwickeln.
>
> Gleichzeitig möchten wir Euch die Möglichkeit geben, Einblicke in die Karrierewege Eurer ehemaligen Kommilitoninnen und Kommilitonen zu erhalten.
>
> Die Teilnahme ist freiwillig und dauert nur wenige Minuten, wenn Ihr Eure vorhandenen Karrieredaten übernehmt.
>
> Nach Abschluss der Befragung stellen wir die Ergebnisse in einer interaktiven Auswertung bereit.
>
> Vielen Dank für Eure Unterstützung!

Prof. Weber kann die Texte bearbeiten und ergänzende Inhalte hinzufügen, etwa die Ziele der Befragung, den vorgesehenen Auswertungszeitraum oder einen Kontakt für Rückfragen.

Die Plattform ergänzt die Seite um standardisierte, nicht frei überschreibbare Informationen zum Datenschutz, zur Freiwilligkeit, zu den Datenquellen und zur Verwendung der eingereichten Daten.

Im unteren Bereich erscheint die Schaltfläche **„Meinen Karriereweg teilen“**.

Über die Vorschaufunktion sieht Prof. Weber die Startseite sowohl in der Desktop- als auch in der mobilen Darstellung.

Er prüft, ob seine persönliche Ansprache, die Angaben zum Studiengang und die Datenschutzhinweise verständlich und vollständig sind.

**Erwartetes Systemverhalten:** Die personalisierte Seite gehört eindeutig zur jeweiligen Umfrage. Änderungen an einer anderen Umfrage dürfen sie nicht beeinflussen. Sicherheitsrelevante Informationen, insbesondere Einwilligungstexte, dürfen nicht durch frei gestaltete Inhalte ersetzt werden.

## 4. Festlegen der Umfragebedingungen

Im nächsten Schritt konfiguriert Prof. Weber die Durchführung.

Die Plattform schlägt die drei bereits vorgesehenen Möglichkeiten zur Erfassung von Karriereinformationen vor:

1. LinkedIn-Daten freigeben, sofern die entsprechende Schnittstelle verfügbar und autorisiert ist.
2. Einen Lebenslauf als PDF hochladen.
3. Den Karriereweg manuell eingeben.

Alle drei Eingabewege führen zum gleichen normalisierten Datenmodell.

Prof. Weber legt außerdem fest, dass die Absolventinnen und Absolventen ihren Masterabschluss in Informatik an der Hochschule München als Referenzabschluss auswählen beziehungsweise bestätigen sollen.

Dieser Abschluss bildet den Ankerpunkt der späteren Karrierepfadanalyse. Die beruflichen und akademischen Stationen werden zeitlich davor, währenddessen oder danach eingeordnet.

Er entscheidet, dass die Teilnehmenden ihre Daten vor dem Absenden überprüfen und einzelne Stationen bearbeiten oder entfernen können.

Zusätzlich legt er fest, dass die Teilnahme keine Registrierung mit Klarnamen voraussetzt. Freiwillige Kontaktdaten für Ergebnisbenachrichtigungen werden erst nach dem Speichern des Karrierewegs abgefragt.

Die Ergebnisse sollen nach Abschluss der Befragung für die Teilnehmenden verfügbar werden. Kleine Auswertungsgruppen werden zum Schutz vor Reidentifikation unterdrückt; als vorläufiger Konfigurationswert dient eine Mindestgruppengröße von fünf Personen.

Prof. Weber speichert die Einstellungen. Die Umfrage bleibt im Entwurfsstatus, bis er sie ausdrücklich veröffentlicht.

## 5. Veröffentlichung und Verteilung der Umfrage

Am 16. November 2026 öffnet Prof. Weber die fertig konfigurierte Umfrage und wählt **„Umfrage veröffentlichen“**.

Das System überprüft, ob alle verpflichtenden Einstellungen vorhanden sind: Zielgruppe, Startseite, Laufzeit, Datenschutzinformationen, Eingabemöglichkeiten und Verantwortlichkeit.

Anschließend erhält die Umfrage den Status **„Aktiv“**.

Für die veröffentlichte Umfrage wird eine dauerhaft eindeutige URL bereitgestellt, beispielsweise nach dem Muster:

`https://<career-map-domain>/survey/<survey-id>`

Diese Adresse bleibt auch nach dem Ende der Befragung gültig, zeigt dann allerdings die archivierte Umfrage und nicht mehr das Teilnahmeformular.

Prof. Weber möchte die Einladung über zwei Kanäle verbreiten.

### Verbreitung über LinkedIn

Er öffnet die LinkedIn-Alumni-Gruppe des Studiengangs und veröffentlicht dort einen Beitrag mit seinem persönlichen Aufruf sowie dem Link zur Befragung.

Die CareerMap-Plattform stellt ihm einen vorbereiteten Einladungstext und einen Link zur Verfügung, den er übernehmen und verändern kann.

Die Veröffentlichung in der LinkedIn-Gruppe erfolgt im ersten Schritt manuell. Eine automatisierte Veröffentlichung oder der Versand persönlicher LinkedIn-Nachrichten wird nicht vorausgesetzt.

### Verbreitung per E-Mail

Zusätzlich verschickt Prof. Weber die Einladung über einen vorhandenen, für diesen Zweck zulässig nutzbaren E-Mail-Verteiler.

Auch hierfür stellt die Plattform einen vorbereiteten Einladungstext bereit. Optional kann ein integrierter E-Mail-Versand eingerichtet werden.

Für LinkedIn und E-Mail kann das System unterschiedliche, aber zur selben Umfrage gehörende Links erzeugen. Damit lässt sich später beispielsweise nachvollziehen, über welchen Kanal ein Aufruf erfolgte, ohne die Identität einzelner Personen zu erfassen.

Prof. Weber sieht in der Verwaltungsoberfläche, dass die Umfrage aktiv ist und ihre öffentliche Startseite aufgerufen werden kann.

**Erwartetes Systemverhalten:** Sämtliche Verteilungslinks führen zur gleichen Umfrage. Mehrere Zugriffe über unterschiedliche Kanäle dürfen nicht automatisch mehrere abgeschlossene Teilnahmen derselben Person erzeugen.

## 6. Teilnahme aus Sicht einer Alumna

Petra hat den Master Informatik 2020 an der Hochschule München abgeschlossen. Sie sieht den Aufruf in ihrer LinkedIn-Gruppe und klickt auf den Link.

Die personalisierte Seite von Prof. Weber öffnet sich.

Sie erkennt sofort, wer die Umfrage durchführt, weshalb ihre Daten erhoben werden und welchen Nutzen die Teilnahme hat. Außerdem sieht sie das geplante Ende der Erhebung sowie Informationen darüber, wie ihre Daten verarbeitet und ausgewertet werden.

Petra klickt auf **„Meinen Karriereweg teilen“**.

Sie entscheidet sich für die Freigabe ihrer LinkedIn-Daten.

Nach dem Berechtigungsprozess erhält das System – soweit von der freigegebenen Schnittstelle bereitgestellt – ihre Studienabschlüsse und beruflichen Stationen.

Die Daten werden in ein gemeinsames internes Format übertragen. Petra erhält eine Übersicht aller erkannten Stationen.

Sie sieht beispielsweise ihren Bachelorabschluss an einer anderen Hochschule, den Master Informatik an der Hochschule München, eine Werkstudententätigkeit, ihre erste Stelle als Softwareentwicklerin und ihre aktuelle Tätigkeit als IT-Projektleiterin.

Petra bestätigt ausdrücklich den Master Informatik an der Hochschule München als Referenzabschluss.

Anschließend kontrolliert sie die chronologisch angeordneten Stationen. Sie korrigiert die Bezeichnung einer Tätigkeit, ergänzt ein fehlendes Datum und entfernt eine Station, die sie nicht in die Auswertung aufnehmen möchte.

Sie sieht zudem die Informationen zur Datenverwendung und erteilt die für die Teilnahme erforderliche ausdrückliche Einwilligung.

Erst danach wählt sie **„Karriereweg speichern und teilnehmen“**.

Das System prüft die Daten, speichert die freigegebenen Stationen und verknüpft die abgeschlossene Teilnahme mit der konkreten Umfrage.

Petra erhält eine Bestätigung. Auf der Danke-Seite kann sie freiwillig ihre E-Mail-Adresse hinterlegen und auswählen, ob sie informiert werden möchte, sobald die Auswertung verfügbar ist.

Sie entscheidet sich dafür.

Das System stellt ihr außerdem eine Möglichkeit zur Verfügung, ihre abgegebene Teilnahme später wieder aufzurufen. Dafür kann beispielsweise ein sicherer persönlicher Zugangslink oder ein Wiederherstellungscode verwendet werden.

**Erwartetes Systemverhalten:** Unvollständige oder abgebrochene Eingabevorgänge zählen nicht als abgeschlossene Teilnahme. Importierte Daten werden nicht ungeprüft gespeichert. Ein und derselbe bestätigte Karriereweg soll innerhalb einer Umfrage nicht mehrfach gezählt werden.

## 7. Beobachtung des Umfragefortschritts

Eine Woche nach Veröffentlichung öffnet Prof. Weber die Verwaltungsoberfläche.

Er sieht eine Übersicht zum Verlauf seiner Umfrage.

Diese enthält die Anzahl der Aufrufe, begonnenen Teilnahmen, abgeschlossenen Teilnahmen und gegebenenfalls abgebrochenen Vorgänge.

Außerdem sieht er aggregierte Angaben zur Qualität der Daten, etwa wie viele Karrierewege mindestens eine akademische und eine berufliche Station enthalten und welche Abschlussjahrgänge bislang vertreten sind.

Eine beispielhafte Darstellung könnte folgendermaßen aussehen:

| Kennzahl | Beispielwert |
|---|---:|
| Aufrufe der Startseite | 480 |
| Begonnene Teilnahmen | 190 |
| Abgeschlossene Teilnahmen | 132 |
| Davon mit mehreren beruflichen Stationen | 107 |
| Vertretene Abschlussjahrgänge | 9 |
| Verbleibende Laufzeit | 15 Tage |

Die Zahlen sind fiktiv und dienen der Veranschaulichung.

Prof. Weber erkennt, dass bereits viele Alumni teilgenommen haben, einige Abschlussjahrgänge allerdings noch schwach vertreten sind.

Er kann nach aggregierten Kriterien filtern, ohne dafür personenbezogene Karriereprofile einsehen zu müssen.

Eine tatsächliche Rücklaufquote wird nur angezeigt, wenn die Anzahl der eindeutig eingeladenen Personen und die Zuordnung der Antworten verlässlich bekannt sind. Bei einem offenen LinkedIn-Gruppenlink ist dies nicht ohne Weiteres möglich.

**Erwartetes Systemverhalten:** Der Studiengangsleiter sieht standardmäßig aggregierte Teilnahme- und Qualitätskennzahlen. Personenbezogene Einzeldaten sind nicht allein aufgrund seiner Rolle als Studiengangsleiter zugänglich.

## 8. Versand von Erinnerungen

Am 27. November 2026 bemerkt Prof. Weber, dass die Zahl neuer Teilnahmen zurückgeht.

Er möchte die Alumni erneut zur Teilnahme motivieren.

Dazu öffnet er innerhalb der Umfrage die Funktion **„Erinnerung vorbereiten“**.

Das System schlägt ihm einen Text vor, der auf den bisherigen Erfolg der Aktion und die verbleibende Laufzeit Bezug nimmt.

Prof. Weber passt die Nachricht an und teilt sie erneut in der LinkedIn-Alumni-Gruppe. Darüber hinaus versendet er eine Erinnerungs-E-Mail.

Wenn die Plattform über eine berechtigte und zuverlässige Zuordnung zu einem E-Mail-Empfängerkreis verfügt, sollen bereits abgeschlossene Teilnahmen bei erneuten Einladungen möglichst ausgeschlossen werden.

Bei einem offenen LinkedIn-Beitrag ist das nicht möglich. Deshalb enthält die Nachricht einen Hinweis, dass Personen, die bereits teilgenommen haben, nichts weiter unternehmen müssen.

Eine zweite Erinnerung verschickt Prof. Weber am 7. Dezember 2026.

In der Verwaltungsoberfläche wird dokumentiert, wann eine Erinnerung vorbereitet oder über die Plattform versendet wurde, über welchen Kanal sie verbreitet wurde und welche Umfrage sie betrifft.

**Erwartetes Systemverhalten:** Erinnerungstexte und Versandzeitpunkte gehören zur jeweiligen Umfrage. Die Plattform darf nicht behaupten, gezielt nur Nichtteilnehmende zu erreichen, wenn keine verlässliche Zuordnung vorliegt. Benachrichtigungen an individuelle Kontakte erfolgen nur auf einer passenden datenschutzrechtlichen Grundlage.

## 9. Entscheidung zum vorzeitigen Abschluss

Am 10. Dezember 2026 betrachtet Prof. Weber erneut die Ergebnisse.

Inzwischen liegen genügend vollständig erfasste Karrierewege vor, um aussagekräftige aggregierte Auswertungen zu erstellen.

Auch die Verteilung über verschiedene Abschlussjahrgänge erscheint ihm ausreichend.

Obwohl die Umfrage ursprünglich bis zum 15. Dezember geöffnet bleiben sollte, entscheidet er, sie bereits jetzt zu beenden.

Er öffnet die Umfrageverwaltung und wählt **„Umfrage schließen“**.

Das System zeigt einen Bestätigungsdialog mit dem aktuellen Stand der Erhebung und weist darauf hin, dass nach dem Schließen keine neuen Antworten mehr angenommen werden.

Prof. Weber bestätigt den Abschluss.

Die Umfrage wechselt vom Status „Aktiv“ in den Status **„Geschlossen“**. Das tatsächliche Abschlussdatum und die verantwortliche Person werden gespeichert.

Bereits vollständig abgegebene Karrierewege bleiben erhalten. Angefangene, aber noch nicht abgeschlossene Teilnahmen werden nicht nachträglich als gültige Antworten gezählt.

Personen, die den ursprünglichen Einladungslink aufrufen, sehen jetzt die Information, dass die Befragung abgeschlossen ist.

Ein erneutes Ausfüllen der Umfrage ist nicht mehr möglich.

**Erwartetes Systemverhalten:** Die Schließung muss serverseitig durchgesetzt werden. Ein bereits geöffnetes Formular darf nicht allein deshalb noch neue Daten annehmen, weil die Benutzeroberfläche vor dem Schließzeitpunkt geladen wurde. Für laufende Sitzungen kann eine gesonderte Nachlaufregel definiert werden; diese muss aber eindeutig und testbar sein.

## 10. Erstellung und Freigabe der Ergebnisse

Nach dem Schließen bereitet das System die Auswertungen aus den gültigen, freigegebenen Karriereinformationen vor.

Dazu werden die akademischen und beruflichen Stationen anhand des gemeinsamen Datenmodells verarbeitet.

Der Masterabschluss in Informatik an der Hochschule München dient als gemeinsamer Referenzpunkt.

Prof. Weber öffnet die Ergebnisvorschau.

Er sieht beispielsweise interaktive Sankey-Diagramme zu typischen Karrierewegen, Verteilungen beruflicher Positionen und Branchen, weitere akademische Qualifikationen und Unterschiede zwischen Abschlussjahrgängen.

Er kann prüfen, ob die Datenqualität ausreichend ist und ob einzelne Kategorien zu klein sind, um sie datenschutzkonform darzustellen.

Das System veröffentlicht keine individuellen Karrierewege, aus denen einzelne Alumni ohne entsprechende Freigabe identifiziert werden könnten.

Nachdem Prof. Weber die Auswertung geprüft hat, wählt er **„Ergebnisse für Teilnehmende freigeben“**.

Die Umfrage erhält zusätzlich den Veröffentlichungsstatus **„Ergebnisse verfügbar“**.

Die veröffentlichte Auswertung wird mit einer Versionsnummer und einem Zeitpunkt versehen. Dadurch ist später nachvollziehbar, auf welchem Stand sie basiert.

**Erwartetes Systemverhalten:** Das Schließen der Datenerhebung und das Veröffentlichen der Ergebnisse sind getrennte Vorgänge. Eine Umfrage kann geschlossen sein, obwohl ihre Auswertung noch geprüft wird. Berechtigte Löschungen oder widerrufene Einwilligungen müssen auch nach der Ergebniserstellung berücksichtigt werden können.

## 11. Benachrichtigung der Teilnehmenden

Nachdem die Ergebnisse freigegeben wurden, möchte Prof. Weber alle erreichbaren Teilnehmenden darüber informieren.

Er öffnet die Funktion **„Teilnehmende über Ergebnisse informieren“**.

Das System zeigt an, wie viele Teilnehmende eine passende Benachrichtigungsmöglichkeit hinterlegt haben und wie viele ohne Kontaktangaben teilgenommen haben.

Prof. Weber überprüft den vorbereiteten Benachrichtigungstext:

> **Die Ergebnisse unserer Alumni-Umfrage sind verfügbar**
>
> Vielen Dank, dass Du Deinen Karriereweg mit uns geteilt hast.
>
> Die Befragung zum Masterstudiengang Informatik der Hochschule München ist inzwischen abgeschlossen.
>
> Ab sofort kannst Du die aggregierten Karrierewege unserer Absolventinnen und Absolventen ansehen und Deinen eigenen eingereichten Karriereweg erneut aufrufen.
>
> Vielen Dank für Deinen Beitrag zu diesem gemeinsamen Überblick.

Die Nachricht enthält einen Link zur Ergebnisübersicht und gegebenenfalls einen sicheren persönlichen Zugang zur eigenen früheren Teilnahme.

Das System versendet die Benachrichtigungen nur an Personen, für die eine entsprechende Kontaktmöglichkeit und Benachrichtigungsberechtigung vorliegen.

Für anonym Teilnehmende ohne Kontaktdaten ist keine individuelle E-Mail möglich. Sie können die Ergebnisse über ihren erhaltenen Zugangslink beziehungsweise über eine andere bei der Teilnahme festgelegte Zugangsmethode abrufen.

**Erwartetes Systemverhalten:** Die Benachrichtigung wird nur einmal pro Veröffentlichungsversion versendet, sofern keine ausdrücklich gewünschte erneute Benachrichtigung erfolgt. Fehlgeschlagene Zustellungen werden protokolliert, ohne dabei das System mehrfach unkontrolliert versenden zu lassen.

## 12. Zugriff auf die abgeschlossene Umfrage

Petra erhält die Ergebnisbenachrichtigung und öffnet den enthaltenen Link.

Sie gelangt zur Alumni CareerMap-Plattform und sieht die abgeschlossene Umfrage „Karrierewege unserer Informatik-Alumni 2026“.

Die Seite zeigt weiterhin den ursprünglichen Titel, den verantwortlichen Studiengang, den personalisierten Einführungstext von Prof. Weber und den Zeitraum der Befragung.

Anstelle der Teilnahme-Schaltfläche steht dort jetzt **„Umfrage abgeschlossen – Ergebnisse ansehen“**.

Nach ihrer Zugangsprüfung kann Petra die aggregierten Karrierepfade erkunden und nachvollziehen, wie sich verschiedene Berufs- und Bildungswege entwickelt haben.

Zusätzlich öffnet sie den Bereich **„Meine früheren Teilnahmen“**.

Hier findet sie die Umfrage von 2026 und kann ihre damals eingereichten Karrierestationen ansehen.

Diese abgegebene Teilnahme wird zunächst schreibgeschützt dargestellt. Sie dokumentiert die Angaben, die Petra zum Zeitpunkt der Befragung freigegeben hatte.

Falls die Plattform zusätzlich ein dauerhaftes Alumni-Profil anbietet, kann Petra dieses unabhängig davon aktualisieren. Eine spätere Änderung ihres aktuellen Karrierewegs verändert nicht automatisch den dokumentierten Datenstand der abgeschlossenen Umfrage.

Davon unberührt bleiben ihr Recht auf Auskunft, Berichtigung beziehungsweise Löschung und die Möglichkeit, eine Einwilligung zu widerrufen. Eine zulässige Datenlöschung muss auch Auswirkungen auf die archivierte Teilnahme und gegebenenfalls die veröffentlichte Auswertung haben können.

**Erwartetes Systemverhalten:** Ein abgeschlossener Erhebungsvorgang bleibt als Archiv zugänglich, ohne dass dadurch eine erneute Datenabgabe ermöglicht wird. Das persönliche Teilnahmeprotokoll ist nur für die berechtigte Person sichtbar; die aggregierte Auswertung ist entsprechend der festgelegten Zugriffsregeln verfügbar.

## 13. Spätere Wiederholung der Umfrage

Im folgenden Jahr möchte Prof. Weber erneut untersuchen, wie sich die Karrierewege seiner Alumni entwickelt haben.

Er öffnet seine abgeschlossene Umfrage von 2026 und wählt **„Neue Umfrage auf Grundlage dieser Umfrage erstellen“**.

Das System legt eine neue, eigenständige Umfrage an und übernimmt auf Wunsch die allgemeine Konfiguration, die Texte der Startseite und die Einstellungen zur Datenerhebung.

Prof. Weber aktualisiert die Begrüßung, ergänzt neue Abschlussjahrgänge und legt den neuen Zeitraum fest.

Die abgeschlossene Umfrage von 2026 bleibt unverändert und ist weiterhin über das Archiv erreichbar.

Bereits erfasste Alumni-Profile werden nicht ungefragt einer neuen Umfrage zugeordnet. Eine erneute Verwendung vorhandener Karrieredaten erfolgt nur, soweit die dazu erforderliche Berechtigung vorliegt.

Für berechtigte zurückkehrende Alumni kann die Plattform anbieten, ihren vorhandenen Karriereweg zu überprüfen, zu aktualisieren und für die neue Erhebung erneut freizugeben.

Dadurch muss eine Person nicht bei jeder Befragung ihren gesamten Lebenslauf neu eingeben.

**Erwartetes Systemverhalten:** Wiederholte Befragungen sind eigenständige Kampagnen mit eigenen Laufzeiten, Einwilligungs- und Teilnahmevorgängen sowie Ergebnisversionen. Die zugrunde liegenden Alumni-Stammdaten können gemeinsam genutzt werden, wenn dies datenschutzrechtlich und fachlich zulässig ist.

---

# 14. Fachliche Zustände einer Umfrage

Eine Umfrage durchläuft während ihres Lebenszyklus mehrere Zustände. Diese sollten in der Implementierung explizit modelliert werden.

| Status | Bedeutung | Erlaubte Aktionen |
|---|---|---|
| Entwurf | Umfrage wird vorbereitet | Bearbeiten, Vorschau, Veröffentlichen, Verwerfen |
| Geplant | Veröffentlichung ist terminiert | Bearbeiten im zulässigen Umfang, Termin ändern |
| Aktiv | Teilnahme ist möglich | Antworten erfassen, Fortschritt ansehen, Erinnerungen vorbereiten, Schließen |
| Geschlossen | Datenerhebung beendet | Antworten auswerten, Ergebnisse prüfen |
| Ergebnisse veröffentlicht | Auswertung freigegeben | Ergebnisse ansehen, Teilnehmende informieren |
| Archiviert | Umfrage langfristig abgeschlossen | Historische Auswertung und berechtigte frühere Teilnahmen einsehen |

Die Zustände der Datenerhebung und der Ergebnisveröffentlichung können technisch auch als getrennte Statusfelder umgesetzt werden. Dies ist insbesondere sinnvoll, damit eine geschlossene Umfrage nicht automatisch als veröffentlicht gilt.

# 15. Akzeptanzkriterien für die Implementierung

Die folgenden Anforderungen dienen als Grundlage für automatisierte Tests und die fachliche Abnahme.

| ID | Akzeptanzkriterium |
|---|---|
| AC-01 | Ein berechtigter Studiengangsleiter kann eine neue Umfrage für einen ihm zugeordneten Studiengang anlegen. |
| AC-02 | Eine Umfrage erhält eine eindeutige ID und wird zunächst als Entwurf gespeichert. |
| AC-03 | Der Studiengangsleiter kann Titel, Beschreibung, Bild, Begrüßungstext, Zielgruppe und Zeitraum konfigurieren. |
| AC-04 | Verpflichtende Datenschutzinformationen bleiben unabhängig von der Personalisierung erhalten. |
| AC-05 | Die Umfrage kann vor Veröffentlichung in einer Desktop- und mobilen Vorschau betrachtet werden. |
| AC-06 | Nach Veröffentlichung führen alle gültigen Kampagnenlinks zur richtigen Umfrage. |
| AC-07 | Eine aktive Umfrage akzeptiert Karriereinformationen über alle dafür freigeschalteten Eingabewege. |
| AC-08 | Die teilnehmende Person muss ihren Referenzabschluss ausdrücklich auswählen oder bestätigen. |
| AC-09 | Importierte Stationen können vor der endgültigen Freigabe geprüft, korrigiert und entfernt werden. |
| AC-10 | Abgebrochene Vorgänge zählen nicht als abgeschlossene Teilnahmen. |
| AC-11 | Eine erneute Übermittlung derselben Teilnahme erzeugt keinen zusätzlichen gültigen Antwortdatensatz. |
| AC-12 | Der Studiengangsleiter sieht den aggregierten Fortschritt seiner Umfrage und kann Erinnerungen vorbereiten. |
| AC-13 | Die Umfrage wird zum konfigurierten Endzeitpunkt automatisch geschlossen, sofern sie nicht zuvor manuell beendet wurde. |
| AC-14 | Nach einer manuellen Schließung verhindert das Backend neue Einreichungen, auch über bereits geöffnete Formulare. |
| AC-15 | Das Schließen einer Umfrage löscht keine gültigen Antworten. |
| AC-16 | Ergebnisse können erst nach Abschluss der definierten Daten- und Datenschutzprüfungen veröffentlicht werden. |
| AC-17 | Kleine Gruppen werden gemäß der konfigurierten Mindestgruppengröße nicht identifizierend ausgewertet. |
| AC-18 | Ergebnisbenachrichtigungen werden nur an berechtigt kontaktierbare Personen versendet. |
| AC-19 | Nach Abschluss bleibt die öffentliche Umfrageseite erreichbar, bietet aber keine erneute Teilnahme mehr an. |
| AC-20 | Eine teilnehmende Person kann ihre eigene archivierte Teilnahme nach geeigneter Zugangsprüfung ansehen. |
| AC-21 | Die archivierten Antworten sind gegen gewöhnliche nachträgliche Änderungen gesperrt; Datenschutzrechte bleiben gewährleistet. |
| AC-22 | Ein Studiengangsleiter kann eine neue Umfrage auf Grundlage einer früheren Umfrage erstellen, ohne die vorherige zu verändern. |
| AC-23 | Berechtigungen und Daten unterschiedlicher Studiengänge und Umfragen sind konsequent voneinander getrennt. |
| AC-24 | Alle wesentlichen Statuswechsel, Freigaben und Benachrichtigungsvorgänge sind nachvollziehbar protokolliert. |

# 16. Offene Produktentscheidungen

Vor der technischen Umsetzung sollten einige fachliche Fragen ausdrücklich entschieden werden.

**Identität und Wiedererkennung:** Soll eine Teilnahme vollständig ohne Benutzerkonto möglich sein? Falls ja, wird für den späteren Zugriff auf die eigene Teilnahme ein sicherer Wiederherstellungscode benötigt. Alternativ kann ein optionales Konto beziehungsweise ein E-Mail-basierter Zugangsmechanismus verwendet werden.

**Beziehung zwischen Umfrage und Alumni-Profil:** Ist der eingereichte Karriereweg ein dauerhaftes, künftig aktualisierbares Alumni-Profil oder zunächst ausschließlich ein Datensatz innerhalb einer bestimmten Umfrage? Empfohlen wird die Trennung zwischen dem normalisierten Alumni-Profil und einer kampagnenspezifischen Teilnahme einschließlich ihres Datenstands.

**Schließen laufender Teilnahmen:** Was passiert, wenn eine Person gerade Daten eingibt, während der Studiengangsleiter die Umfrage schließt? Das System benötigt eine eindeutige Regel für die Behandlung solcher Sitzungen.

**Ergebnisfreigabe:** Werden die aggregierten Ergebnisse ausschließlich für teilnehmende Alumni und Studiengangsverantwortliche geöffnet oder auch für Studierende und Studieninteressierte? Unterschiedliche Zielgruppen könnten unterschiedliche Ansichten erhalten.

**Archivierung und Datenlebenszyklus:** Wie lange bleiben Umfragekonfigurationen, Antworten, Zugangscodes und Auswertungen erhalten? Wie werden nachträgliche Löschungen und Einwilligungswiderrufe berücksichtigt?

**Erneute Teilnahme:** Wenn eine Alumna in zwei aufeinanderfolgenden Jahren teilnimmt, sollen beide historischen Stände abrufbar sein und gleichzeitig ein aktueller Karriereweg gepflegt werden können?

Diese Entscheidungen bestimmen maßgeblich die Datenmodellierung, die Rechteverwaltung und die späteren E2E-Tests.

---

**Zielzustand:** Ein Studiengangsleiter kann den vollständigen Lebenszyklus einer Alumni-Befragung eigenständig verwalten – von der Konfiguration und personalisierten Ansprache über die Datenerhebung und Erinnerungskommunikation bis zum Abschluss, zur Veröffentlichung und zur langfristig kontrollierten Bereitstellung der Ergebnisse.