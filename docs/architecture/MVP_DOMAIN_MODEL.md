# MVP Domain Model

## 1. Purpose and MVP Scope

**DECISION:** Dieses Dokument ist die normative, implementierbare MVP-Spezifikation für studiengangsbezogene Alumni-Befragungen.
Grundlagen: [Design Notes](DOMAIN_MODEL_DESIGN_NOTES.md), [Legacy-Audit](../legacy/LEGACY_SCHEMA_AUDIT.md) und [Migration Baseline](../MIGRATION_BASELINE.md).
**DECISION:** Die Design Notes sind Hintergrund; insbesondere ihre globale Alumni-Referenz und zyklischen Constraints werden nicht übernommen. Der Legacy-Audit beschreibt ausschließlich den IST-Zustand.
**DECISION:** Alle Auswertungen verwenden das normalisierte kanonische Modell. LinkedIn, CV, Excel und manuelle Eingabe sind ausschließlich externe Datenquellen, keine zusätzlichen Domainmodelle.

## 2. Deployment Context

**DECISION:** Eine Installation gehört organisatorisch genau zu einer Hochschule oder Fakultät; der MVP benötigt weder Mandantentabelle noch Tenant-IDs.
**DECISION:** PostgreSQL 17 bleibt entsprechend dem Bootstrap die einzige unterstützte Datenbank; alle Entitäten erhalten zufällige UUID-Primärschlüssel.
**DECISION:** Der Betreiber wird in der Instanzkonfiguration festgelegt. Institution ist ein Bildungskatalog, kein Mandant: weitere Einrichtungen dürfen für andere Degrees katalogisiert werden.
Pilotkontext: Institution „Hochschule München“, Program „Management Sozialer Innovationen“, Survey „Alumni-Befragung dieses Studiengangs“; dies sind fachliche Beispiele, keine Fixtures.

## 3. Canonical Entities

**DECISION:** Der MVP umfasst ausschließlich die folgenden neun Kernentitäten und optional AlumniContact. Alle besitzen `id`, `createdAt` und `updatedAt`; technische Zeitpunkte verwenden `timestamptz`/UTC.
In der Tabelle sind Beziehungs- und fachliche Pflichtfelder genannt; mit „optional“ bezeichnete Attribute dürfen NULL sein. Schreibwege pflegen `updatedAt` ausdrücklich.

| Entität | Minimaler Inhalt und Verantwortung |
|---|---|
| Institution | Pflicht: `name`; optional: `location`. Kanonische Bildungseinrichtung. |
| Program | Pflicht: `institutionId`, `name`; optional: `faculty`. Studienangebot; Abschlusslevel liegt am Degree. |
| Survey | Pflicht: `name`, `referenceProgramId`, `status`; beim Erzeugen hat `status` den Default `DRAFT`. Befragung zu genau einem kanonischen Program. |
| Alumni | Pseudonymisierte Profilidentität mit technischen Zeitpunkten; keine globale Referenz und keine direkten Personenidentifikatoren. |
| Degree | Pflicht: `alumniId`, `level`, `status`; optional: `programId` oder direktes `institutionId`, `title`, `fieldOfStudy`, `startYear`, `endYear`, `graduationYear`. Akademische Qualifikationsphase. |
| CareerStep | Pflicht: `alumniId`, `type`, `temporalStatus`; optional: `organisationId`, `roleTitle`, `roleCategory`, `functionArea`, `location`, `startYear`, `endYear`. Berufliche oder sonstige nicht als Degree modellierte Phase. |
| AlumniTimelineItem | Pflicht: `alumniId`, `type`, `position`; genau einer von `degreeId` oder `careerStepId`. Nur Reihenfolge und Stationsverweis. |
| Organisation | Pflicht: `name`; optional: `location`, `sector`. Gemeinsam genutzter Arbeitgeber-/Trägerkatalog. |
| SurveyResponse | Pflicht: `surveyId`, `alumniId`, `referenceDegreeId`, `confirmedAt`. Bestätigte Teilnahme und konkrete Referenzauswahl; kein zweites Karriereprofil. |
| AlumniContact (optional) | Pflicht: `alumniId`; optional: `displayName`, `email`, mindestens eine nichtleere Angabe. Separater Kontaktzweck. |

**DECISION:** SurveyStatus: `DRAFT`, `OPEN`, `CLOSED`. PostgreSQL sichert für `Survey.status` lediglich einen nichtnullen gültigen Enumwert ab; die fachliche Statusregel liegt im Domain-Service.
**DECISION:** Degree-Level: `BACHELOR`, `MASTER`, `PHD`, `DIPLOMA`, `CERTIFICATE`, `OTHER`; CERTIFICATE bezeichnet eine eigenständige akademische Qualifikation.
**DECISION:** Degree-Status: `IN_PROGRESS`, `COMPLETED`, `ENDED_WITHOUT_DEGREE`, `UNKNOWN`; CareerStep-Zeitstatus: `ONGOING`, `ENDED`, `UNKNOWN`.
**DECISION:** CareerStep-Typen: `EMPLOYMENT`, `INTERNSHIP`, `EDUCATION`, `VOCATIONAL_TRAINING`, `VOLUNTEERING`, `SELF_EMPLOYMENT`, `UNEMPLOYED`, `OTHER`.
**DECISION:** Bachelor/Master/Promotion sind Degrees; Ausbildung ist VOCATIONAL_TRAINING, Auslandssemester/Weiterbildung ohne eigenen Abschlussgang EDUCATION, Werkstudententätigkeit EMPLOYMENT. Dasselbe Studium wird nicht zusätzlich als EDUCATION gespeichert.
**DECISION:** Eine Promotionsphase und eine eigenständige wissenschaftliche Beschäftigung beziehungsweise ein duales Studium und seine eigenständige Arbeit dürfen parallel bestehen.

## 4. Core Relations

**DECISION:** Institution hat viele Programs; ein Program gehört genau einer Institution und kann von vielen Surveys und Degrees verwendet werden.
**DECISION:** Alumni besitzt viele Degrees, CareerSteps und TimelineItems, höchstens einen AlumniContact und potenziell mehrere SurveyResponses; jedes dieser Objekte hat genau einen Alumni-Eigentümer.
**DECISION:** SurveyResponse verbindet genau einen Survey, einen Alumni und einen eigenen Degree; `UNIQUE(surveyId, alumniId)` verhindert doppelte Antworten für dasselbe Paar.
**DECISION:** Degree verwendet entweder Program oder eine direkte Institution, niemals beide; bei Program ist die Institution daraus ableitbar. Beide Katalogzuordnungen dürfen für zusätzliche Degrees unbekannt sein.
**DECISION:** Organisationszuordnungen sind optional; unbekannte Träger erfordern keinen künstlichen „Unknown“-Datensatz. TimelineItems enthalten keine kopierten Stationsdaten.
**DECISION:** Alumni-Löschung kaskadiert zu Stationen, TimelineItems, Kontakt und SurveyResponses. Ein durch SurveyResponse referenzierter Degree ist gegen Einzel-Löschung geschützt (`RESTRICT`); vor Profillöschung entfernt der Service dessen Antworten in derselben Transaktion.
**DECISION:** Station-Löschung entfernt ihr TimelineItem; TimelineItem-Löschung entfernt keine Station. Survey-Löschung ist bei Antworten gesperrt. Verwendete Institutionen, Programs und Organisationen sind gegen Löschung geschützt; Schlüsselupdates verwenden `NO ACTION`.

## 5. Survey and Reference Degree Semantics

**DECISION:** `Survey.referenceProgramId` definiert den Befragungsbezug. Dieser Bezug ist im MVP ab Survey-Erstellung fachlich unveränderlich; eine andere Zielgruppe benötigt einen neuen Survey.
**DECISION:** Ausschließlich `SurveyResponse.referenceDegreeId` speichert die konkrete bestätigte Auswahl. Weder `Alumni.referenceDegreeId` noch `Degree.isReference` existieren im MVP.
**DECISION:** Eine gespeicherte SurveyResponse ist bestätigt: alle drei IDs und `confirmedAt` sind Pflicht. Ein ungeklärter Entwurf wird nicht als SurveyResponse gespeichert.
**DECISION:** Der Referenz-Degree gehört zum Antwort-Alumni, hat `programId = Survey.referenceProgramId` und Status `COMPLETED`; ein unbekanntes Abschlussjahr ist trotzdem zulässig.
**DECISION:** Der Survey darf Kandidaten anhand des Programms einschränken; auch ein einziger Kandidat erfordert die ausdrückliche Bestätigung des konkreten Degrees. Auswahl nach höchstem Level, jüngstem Jahr oder erstem Treffer ist unzulässig.
**DECISION:** Die Datenbank garantiert Ownership und Existenz. Program-Passung, Abschlussstatus und tatsächliche Bestätigung prüft der Domain-Service; `confirmedAt` allein beweist keine menschliche Bestätigung.
**DECISION:** Es gibt keinen Pflicht-Rückverweis vom Alumni auf Degree oder SurveyResponse. Die Anlage erfolgt geradlinig: Alumni, Stationen, dann bestätigte Antwort in einer kurzen Transaktion; Kontakt darf später folgen.

## 6. Privacy Boundary

**DECISION:** Name und E-Mail stehen ausschließlich im optionalen AlumniContact. Der Karrierepfad einschließlich bestätigter Antwort muss ohne Kontaktangaben speicherbar sein.
**DECISION:** E-Mail ist weder Alumni-Identität noch global eindeutig; Profilzusammenführung anhand von Kontaktangaben findet nicht statt. UUIDs sind Identifikatoren, keine Zugangsnachweise.
**DECISION:** Es werden keine dauerhafte LinkedIn-ID, CV-Dateiverweise, Rohprofile, privaten Anschriften oder allgemeine personenbezogene Notizen im kanonischen Modell gespeichert.
**DECISION:** Kontakt kann separat gelöscht werden; eine Profillöschung entfernt auch Antworten und Kontakt. Analysen verwenden keine automatischen Kontakt-Joins; Pseudonymisierung ist keine Anonymisierung.
**DEFERRED:** ConsentRecord, ImportRun, ImportSource und weitere operative Modelle gehören nicht zum MVP-Kern. Konkrete Verarbeitungszwecke und Aufbewahrungsregeln bleiben Voraussetzungen des produktiven Betriebs, ohne hier weitere Tabellen vorzugeben.

## 7. Required PostgreSQL Invariants

**DECISION:** Die folgenden Garantien gelten unabhängig vom Schreibweg. Eigene fachliche Trigger, zyklische FKs und aufgeschobene Referenzpflichten werden nicht benötigt.

| Gegenstand | Verbindliche Datenbankgarantie |
|---|---|
| Identität und Beziehungen | UUID-PKs, `NOT NULL` für Pflichtfelder und echte FKs; keine lediglich von Prisma emulierten Beziehungen. |
| Survey | Nichtnuller FK `referenceProgramId → Program.id`; kein zusätzlicher redundanter Institution-Verweis. |
| SurveyResponse | Nichtnuller Survey-FK; Composite FK `(alumniId, referenceDegreeId) → Degree(alumniId, id)` sowie Alumni-FK; `UNIQUE(surveyId, alumniId)`. |
| Ownership-Zielschlüssel | Nichtaufschiebbare `UNIQUE(alumniId, id)` auf Degree und CareerStep als Ziele der Composite FKs. |
| Timeline-Ziel | Nichtnuller Typ DEGREE/CAREER_STEP und XOR-Check für genau den zum Typ passenden Zielverweis. |
| Timeline-Ownership | Composite FKs `(alumniId, degreeId)` beziehungsweise `(alumniId, careerStepId)` auf die Owner-Zielschlüssel, jeweils `MATCH SIMPLE`; direkter Alumni-FK. |
| Timeline-Reihenfolge | `position NOT NULL`, `position > 0`, unmittelbares `UNIQUE(alumniId, position)`; gewöhnliche Unique-Regeln auf degreeId und careerStepId erlauben mehrere NULLs, aber keinen wiederholten Zielverweis. |
| Zeitangaben | Bekannte Jahre liegen in 1..9999; auf Degree und CareerStep gilt `startYear IS NULL OR endYear IS NULL OR startYear <= endYear`. |
| Statuskonsistenz | Laufende Stationen haben kein endYear; Degree.graduationYear nur bei COMPLETED, bei bekannten Werten nicht vor startYear oder endYear. UNKNOWN hat kein bekanntes Ende; ENDED_WITHOUT_DEGREE kein graduationYear. |
| Kataloge | Program-Schlüssel `(institutionId, name, faculty)` mit `NULLS NOT DISTINCT`; Namen/Orte von Institution und Organisation sind keine global eindeutigen Identitäten. |
| Kontakt und Texte | `UNIQUE(AlumniContact.alumniId)`; keine leere Kontaktzeile. Pflichttexte sind nichtleer; optionale Texte NULL oder nichtleer. Degree DIPLOMA/OTHER und CareerStep OTHER verlangen eine sachliche Bezeichnung. |

**DECISION:** Kein kopiertes referenceProgramId in SurveyResponse und kein Drei-Tabellen-Trigger: Der Program-Abgleich bleibt bewusst eine Service-Garantie und kann durch direkte SQL-Änderungen verletzt werden.
**DECISION:** PostgreSQL-spezifische Checks und NULL-Regeln sind später versionierte Migrationsteile; Prisma-Schema allein ist kein Nachweis ihrer Existenz. Erforderliche FK-Indizes werden mit den konkreten Beziehungen angelegt, ohne identische PK-/Unique-Indizes zu verdoppeln.

## 8. Domain-Service Validations

**DECISION:** `DRAFT` dient der Konfiguration und erlaubt keine bestätigten SurveyResponses. Nur bei `OPEN` dürfen SurveyResponses angelegt und geändert werden; `CLOSED` erlaubt keine neuen oder geänderten SurveyResponses. Der Domain-Service prüft diese Regeln bei Statusänderungen und Antwort-Schreibvorgängen unter der gemeinsamen Survey-Zeilensperre.
**DECISION:** Der Schreibservice prüft Betreiberbezug des Survey-Programs, vorhandenen Alumni, passenden eigenen abgeschlossenen Degree und die ausdrückliche Bestätigung vor Anlage/Änderung der Antwort.
**DECISION:** Prüfung und Speicherung erfolgen atomar. Survey- und Alumni-Zeilen werden in konsistenter Reihenfolge gesperrt; alle beteiligten Schreibwege halten diese Sperrkonvention ein, damit parallele Änderungen den geprüften Zustand nicht entwerten.
**DECISION:** Änderungen an Degree.programId/status werden gegen bestehende Antworten geprüft und bei Verletzung abgewiesen. Ownership-Transfers, Änderungen von Program.institutionId und des Survey-Referenzprogramms werden im MVP nicht angeboten; eine andere Institutionszuordnung benötigt einen neuen Program-Katalogeintrag.
**DECISION:** Eine neue Referenzauswahl braucht erneute Bestätigung; sie aktualisiert genau die vorhandene Antwort und confirmedAt, erzeugt keine zweite Teilnahme. Ein fehlender Kandidat verlangt fachliche Korrektur, keinen Scheinabschluss.
**DECISION:** Texte werden getrimmt und Unicode-normalisiert; Katalogzuordnung verwendet bestätigte IDs, keine automatische Zusammenführung durch Namensgleichheit. Semantische Doppelstationen werden fachlich geprüft.
**DECISION:** Timeline-Vergabe startet normalerweise bei 1; dauerhafte Lücken und zeitliche Überlappungen sind erlaubt. Reordering verwendet atomar freie positive Positionen statt negativer Zwischenwerte oder Sequenztrigger.
**DECISION:** Der Service meldet Erfolg erst nach Commit. Keine Transaktion bleibt während menschlicher Eingabe oder späterer Kontakterfassung geöffnet; Kontakterfassung ersetzt keine analytische Teilnahmebestätigung.

## 9. Explicit MVP Simplifications

**DECISION:** Ein Betreiber pro Installation, ein Program pro Survey, ein bestätigter Referenz-Degree pro SurveyResponse und höchstens eine Antwort pro Alumni/Survey.
**DECISION:** Der reguläre MVP-Ablauf erzeugt ein Profil für eine Befragung; Profilwiederverwendung zwischen Befragungen wird noch nicht angeboten. Das relationale Modell verbietet weitere SurveyResponses zu anderen Surveys jedoch nicht global.
**DECISION:** Es gibt weder automatische Referenzauswahl noch automatische Personenidentifikation, Antwortversionierung oder komplexe Survey-Entwurfszustände. Gemeinsame Stationstabellen sind keine eingefrorenen Antwort-Snapshots.
**DECISION:** Profile ohne akademischen Referenzabschluss gehören nicht zum Befragungsablauf. Die Datenbank darf während der normalen Anlage einen Alumni vor seinen Stationen speichern; erst die vollständige bestätigte Antwort gilt als erfolgreich abgeschlossener Vorgang.

## 10. Deferred Phase-2 Cases

- **DEFERRED:** Wiederverwendung derselben Person über mehrere Studiengangsbefragungen, Mehrfachteilnahmen sowie mehrere relevante Studiengänge derselben Institution.
- **DEFERRED:** Institutionenübergreifende Personenidentifikation, automatische Profilzusammenführung und dauerhafte quellenspezifische Identitäts-/Idempotenzzuordnungen.
- **DEFERRED:** Profile ohne akademischen Referenzabschluss und dafür geänderte Referenzsemantik.
- **DEFERRED:** ImportRun, ImportSource, ConsentRecord, detaillierte Herkunftsnachweise und die Implementierung von LinkedIn-/CV-/Excel-Importen.
- **DEFERRED:** Antwortrevisionen und historische Karriere-Snapshots; sie sind keine impliziten MVP-Garantien.

## 11. Legacy Concepts Not Carried Forward

**DECISION:** Keine Felder baDegree, maDegree, baYear, maYear, phdDegree, phdYear, afterBachelor, stepType, predecessorId, successorId oder orderIndex; keine globale Referenzkennzeichnung und keine separaten Altmodelle BachelorProgram/ReferenceDegree.
**DECISION:** Keine Pflichtnamen/-mails in Alumni, Providerkennungen, CV-Verweise, redundanten Stations-/Timelinekopien oder globale Personen-Unique-Regeln auf E-Mail.
**DECISION:** Keine SQLite-Migrationskette, Runtime-DDL/ensureSchema, Vercel-, Supabase- oder AI-Abhängigkeit. Historische Prisma-/SQL-Abweichungen werden nicht als gültige neue Baseline übernommen.

## 12. Acceptance Criteria

- **DECISION:** Ein neu erzeugter Survey hat standardmäßig `status = DRAFT`; PostgreSQL weist NULL und Werte außerhalb `DRAFT`, `OPEN`, `CLOSED` ab.
- **DECISION:** Der Service verhindert bestätigte SurveyResponses in `DRAFT`, erlaubt Anlage/Änderung bei `OPEN` unter den übrigen Regeln und weist Anlage/Änderung bei `CLOSED` ab; konkurrierende Statusänderungen umgehen diese Prüfung nicht.
- **DECISION:** Ein Profil mit eigenem zum Survey-Program passendem bestätigtem Degree und SurveyResponse ist ohne AlumniContact speicherbar; nachträglicher Kontakt bleibt optional.
- **DECISION:** Fremder Referenz-Degree, fehlende Referenz und doppelte Antwort desselben Alumni/Survey scheitern an PostgreSQL; falsches Program, nicht abgeschlossener Degree und fehlende Bestätigung scheitern am Service.
- **DECISION:** Spätere und konkurrierende Service-Änderungen dürfen bestätigte Program-Passung nicht ungültig machen; Referenzwechsel erfordert Bestätigung und ersetzt die bestehende Auswahl atomar.
- **DECISION:** Fremde Timeline-Ziele, Typ-/XOR-Verstöße, doppelte Stationen, nichtpositive/doppelte Positionen und umgekehrte bekannte Jahresgrenzen werden von PostgreSQL abgewiesen; Lücken und Überlappungen funktionieren.
- **DECISION:** Profillöschung entfernt Antworten, Stationen, Timeline und Kontakt; einzeln referenzierte Degrees und verwendete Katalogeinträge bleiben vor unbeabsichtigter Löschung geschützt.
- **DECISION:** Alle zehn beschriebenen Entitäten lassen sich ohne zusätzliche operative Modelle aus einer versionierten PostgreSQL-Migrationsbasis aufbauen; keine Runtime-DDL und keine Legacy-Personendaten sind erforderlich.
