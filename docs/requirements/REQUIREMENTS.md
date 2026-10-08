# Konsolidierte funktionale Anforderungen

Die folgenden Anforderungen unterscheiden zwischen bereits festgelegten Domain-Regeln, dem jetzt beschriebenen Produktziel und Funktionen, die noch nicht implementiert sind.

## A. Befragungskontext und Referenzabschluss

**FR-01 – Studiengangsbezogener Einladungslink**

Ein Einladungslink kann eine konkrete Alumni-Befragung festlegen. Hochschule, Fakultät und Studiengang werden daraus angezeigt.

**FR-02 – Alternative Studiengangsauswahl**

Ohne vorausgewählte Befragung soll eine Person aus verfügbaren Studiengangsbefragungen auswählen können. Die Auswahl bestimmt einen bestehenden Survey; sie ändert nicht nachträglich dessen Referenzprogramm.

**FR-03 – Persönlicher Referenzabschluss**

Die Anwendung muss den konkreten eigenen Studienabschluss ermitteln oder erfassen, der zur ausgewählten Befragung gehört.

**FR-04 – Ausdrückliche Bestätigung**

Der persönliche Referenzabschluss muss explizit bestätigt werden. Ein passendes Studium allein genügt nicht.

**FR-05 – Fachliche Validierung**

Der bestätigte Referenzabschluss muss zum Survey-Studiengang gehören, dem jeweiligen Alumni gehören und abgeschlossen sein.

## B. Datenerfassung

**FR-06 – Drei Eingabewege**

Die Anwendung soll LinkedIn, CV-Upload und manuelle Eingabe anbieten.

**FR-07 – LinkedIn als bevorzugter Weg**

Bei technisch verfügbarer und autorisierter Schnittstelle werden Ausbildungs- und Berufsangaben einmalig importiert. Eine dauerhafte Synchronisierung ist nicht vorgesehen.

**FR-08 – CV-Import**

Ein PDF-Lebenslauf kann als alternative Quelle für eine Karriereübersicht dienen. Die extrahierten Ergebnisse müssen überprüfbar sein.

**FR-09 – Manuelle Erfassung**

Alle für die Befragung erforderlichen akademischen und beruflichen Stationen können ohne externe Datenquelle erfasst werden.

**FR-10 – Einheitliches Datenmodell**

Alle drei Eingabewege müssen auf dieselben kanonischen Entitäten normalisieren. Quelldaten werden nicht als zweite Karriere-Datenbank gespeichert.

## C. Karriereweg und Timeline

**FR-11 – Mehrere Stationen**

Beliebig viele fachlich relevante Degrees und CareerSteps können zu einem Alumni-Profil gehören.

**FR-12 – Parallele Stationen**

Gleichzeitige Studien- und Beschäftigungsphasen sind zulässig.

**FR-13 – Unvollständige Angaben**

Unbekannte optionale Jahreszahlen und Organisationen dürfen fehlen. Es werden keine künstlichen „Unknown“-Organisationen erzeugt.

**FR-14 – Bearbeitbare Timeline**

Alumni können vor dem Speichern ihren Karriereweg prüfen, ergänzen, berichtigen, neu ordnen und Stationen entfernen.

**FR-15 – Ankerbasierte Darstellung**

Der ausgewählte Referenzabschluss wird hervorgehoben. Die Darstellung kann Stationen im Verhältnis zum Referenzstudium gruppieren, ohne die zugrunde liegenden Stationen oder Überschneidungen zu verändern.

## D. Teilnahme und Datenspeicherung

**FR-16 – Teilnahme ohne Kontaktdaten**

Ein vollständiges Karriereprofil einschließlich bestätigter SurveyResponse muss ohne AlumniContact speicherbar sein.

**FR-17 – Verbindlicher Abschluss**

Eine erfolgreiche Datenspende erfordert die bewusste Bestätigung des Beitrags und des Referenzabschlusses.

**FR-18 – Transaktionale Speicherung**

Der Speichervorgang darf keine bestätigte Teilantwort hinterlassen. Eine erfolgreiche Rückmeldung erfolgt erst nach dem Commit.

**FR-19 – Survey-Status**

Bestätigte neue Antworten sind nur bei geöffneten Befragungen zulässig.

**FR-20 – Keine doppelte Teilnahme**

Pro Survey und Alumni-Profil existiert höchstens eine SurveyResponse.

## E. Datenschutz und Kontakt

**FR-21 – Separater Kontaktbereich**

Name und E-Mail-Adresse werden ausschließlich im optionalen AlumniContact gespeichert, nicht im kanonischen Alumni-Karriereprofil.

**FR-22 – Keine dauerhaften Quellprofile**

LinkedIn-Rohdaten, dauerhafte Providerkennungen, Tokens und CV-Dateiverweise gehören nicht in das kanonische Modell.

**FR-23 – Freiwillige Ergebnisbenachrichtigung**

Alumni können sich nach der Datenspende für die Zusendung von Ergebnissen registrieren. Dafür ist eine E-Mail-Adresse notwendig.

**FR-24 – Kontakt unabhängig löschen**

Ein AlumniContact kann entfernt werden, ohne die analytischen Stationen zu löschen.

**FR-25 – Profillöschung**

Eine vollständige Löschung des Alumni-Profils entfernt dessen zugehörige Karriereinformationen, Kontakte und SurveyResponses.

## F. Ergebnisauswertung

**FR-26 – Studiengangsbezogene Aggregation**

Ausgewertet werden bestätigte Befragungsteilnahmen und deren kanonische Karriereinformationen im Kontext des jeweiligen Referenzstudiengangs.

**FR-27 – Freigabeschwelle**

Eine Auswertung darf nur freigegeben werden, wenn die festzulegenden Datenschutz- und Mindestfallzahlregeln erfüllt sind.

**FR-28 – Ergebniszustellung**

Registrierte Alumni können nach Freigabe über die verfügbaren Ergebnisse benachrichtigt werden.

**FR-29 – Schutz vor Rückschlüssen**

Seltene Stationen, kleine Kategorien und ungewöhnliche Kombinationen müssen bei der Veröffentlichung berücksichtigt werden. Eine Mindestzahl für die Gesamtbefragung allein ist kein ausreichender Schutz.

---

# 5. Abbildung der bisherigen Excel-Struktur

Die vorhandene MSI-Werdegangstabelle liefert die fachlichen Kategorien, die auch weiterhin berücksichtigt werden sollen.

| Bisherige Spalte | Kanonisches Modell beziehungsweise Auswertung |
|---|---|
| Alumni | Alumni, pseudonymisierte Profilidentität |
| Werdegang | AlumniTimelineItem.position |
| Ausbildung vor MSI | CareerStep oder Degree, abhängig von der Qualifikation |
| Ausbildung vor MSI: Fachrichtung | Degree.fieldOfStudy oder künftige fachliche Kategorisierung |
| Organisation vor MSI | Organisation, wenn vorhanden |
| Tätigkeit vor MSI: Branchenkategorie | Organisation.sector beziehungsweise fachliche Kategorisierung |
| Position Titel vor MSI | CareerStep.roleTitle |
| Tätigkeit vor MSI: Jobkategorie | CareerStep.roleCategory |
| BA MSI | Degree; Referenz über SurveyResponse |
| MA | Weiterer Degree |
| Fachrichtung | Degree.fieldOfStudy beziehungsweise fachliche Kategorisierung |
| Organisation | Organisation, wenn vorhanden |
| Branchenkategorie | Organisation.sector beziehungsweise fachliche Kategorisierung |
| Position Titel | CareerStep.roleTitle |
| Jobkategorie | CareerStep.roleCategory |

Die alten Spalten „vor MSI“ und „nach MSI“ sind keine eigenständigen Datenmodelle mehr. Sie entstehen aus der Interpretation des geordneten Karrierewegs relativ zum bestätigten Referenzabschluss.

Ein Wert wie „Kein Master“ beschreibt das Fehlen einer entsprechenden Station. Er soll nicht als künstlicher Masterabschluss gespeichert werden.

Die historische Excel-Struktur enthält außerdem weniger präzise Zeitinformationen als das neue Modell. Fehlende Zeitangaben müssen deshalb als unbekannt behandelt werden.

---

# 6. Abgrenzung zum bestehenden MVP

Das normative MVP Domain Model bleibt zunächst unverändert.

Bereits festgelegt sind insbesondere:

- Eine Installation hat einen organisatorischen Betreiber.
- Ein Survey besitzt genau ein Referenzprogramm.
- Der Referenzabschluss wird ausschließlich in SurveyResponse festgelegt.
- Die eigentlichen Karriereinformationen befinden sich in Degree, CareerStep und AlumniTimelineItem.
- AlumniContact ist optional und vom Karriereprofil getrennt.
- PostgreSQL 17 ist die einzige unterstützte Datenbank.

**Noch nicht Bestandteil des implementierten Domain-Fundaments** sind die fertigen Importprozesse, die Datenspende-Oberfläche, der E-Mail-Versand und die Ergebnisvisualisierung.

Diese Funktionen beschreiben das angestrebte End-to-End-Produkt, nicht den aktuellen Stand von Phase A.

---

# 7. Offene Entscheidungen vor der Umsetzung

**OD-01 – Einladungslinks**

Sind Links generell für alle Alumni eines Studiengangs nutzbar, oder erhalten Personen individuelle Einladungen? Ein individueller Link kann die spätere Zuordnung erleichtern, würde aber zusätzliche Identitäts- und Datenschutzfragen aufwerfen.

**OD-02 – LinkedIn-Berechtigungen**

Welche Berechtigungen und Daten liefert die tatsächlich freigeschaltete LinkedIn-Schnittstelle? Was darf nach der Freigabe technisch abgerufen werden, und was wird für den einmaligen Import tatsächlich benötigt?

**OD-03 – CV-Verarbeitung**

Erfolgt die PDF-Auswertung lokal automatisiert, durch einen berechtigten Administrator oder zunächst über manuelle Nachbearbeitung durch die spendende Person? Welche temporären Speicher- und Löschregeln gelten?

**OD-04 – Timeline-Gruppierung**

Nach welcher nachvollziehbaren Regel werden Stationen mit überlappenden oder fehlenden Jahren als vor, während oder nach dem Referenzstudium dargestellt?

**OD-05 – Teilnahme ohne Kontaktdaten**

Wie kann eine Person ohne hinterlegte Kontaktinformationen später auf ihren Datensatz zugreifen oder die Löschung verlangen? Der Survey-Link ist dafür kein geeigneter persönlicher Zugangsnachweis.

**OD-06 – Ergebnisschwelle**

Ab welcher Fallzahl und unter welchen zusätzlichen Kriterien darf eine Auswertung veröffentlicht werden? Sollen synthetische Testdatensätze selbstverständlich aus der produktiven Freigabeentscheidung ausgeschlossen bleiben?

**OD-07 – Benachrichtigung**

Wie wird der freiwillige Wunsch nach Ergebniszusendung dokumentiert, technisch ausgeführt und widerrufen? AlumniContact allein bildet diesen vollständigen Prozess noch nicht ab.

**OD-08 – Datenschutz und Einwilligung**

Welche Verarbeitungszwecke, Rechtsgrundlagen, Aufbewahrungsregeln und organisatorischen Löschverfahren werden für den produktiven Betrieb festgelegt?

**OD-09 – Zeitpunkt des LinkedIn-Imports**

Wird der LinkedIn-Weg für den allerersten nutzbaren Pilotbetrieb vorausgesetzt, oder wird zunächst derselbe Nutzerablauf mit manueller Eingabe und synthetischen Profilen Ende-zu-Ende validiert?
