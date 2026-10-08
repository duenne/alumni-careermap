Status: Design analysis / background.
Not the normative MVP implementation specification.

The normative MVP model is defined in:
MVP_DOMAIN_MODEL.md

# Domain Model Target

Status: normativer Architekturentscheid für die neue selbst hostbare Alumni CareerMap. Dieses Dokument definiert das Soll; es implementiert weder Prisma noch SQL.

Grundlagen sind die vollständig gelesenen Dokumente [Migration Baseline](../MIGRATION_BASELINE.md) und [Legacy Schema Audit](../legacy/LEGACY_SCHEMA_AUDIT.md). Der Audit beschreibt ausschließlich den Repository-IST-Zustand und ist keine Implementierungsanweisung. Auch seine Bezeichnungen „Target“ und „nicht übernehmen“ sind historische Aussagen. Bei fachlichen Modellentscheidungen ist dieses Dokument maßgeblich.

**DECISION:** „MUSS“ bezeichnet eine verbindliche Anforderung. Datenbankinvarianten gelten unabhängig vom Schreibweg, insbesondere auch für direkte SQL-Zugriffe. Eine explizit aufgeschobene Invariante muss spätestens beim erfolgreichen Commit gelten. Fachliche Schreibabläufe ergänzen diese Regeln; ihre Grenzen werden ausdrücklich genannt.

## 1. Design Goals

- **DECISION:** PostgreSQL ist die einzige unterstützte Datenbank. PostgreSQL 17 ist entsprechend der bestehenden Compose-Konfiguration und dem akzeptierten Bootstrap die verbindliche aktuelle Betriebs- und CI-Testbaseline. Die benötigte Fähigkeit `NULLS NOT DISTINCT` setzt technisch mindestens PostgreSQL 15 voraus; daraus folgt keine Supportzusage für PostgreSQL 15, 16 oder 18.
- **DECISION:** Alle Analysen lesen ausschließlich den normalisierten kanonischen Kern. LinkedIn, CV, Excel und manuelle Eingabe sind Datenquellen, keine parallelen Domainmodelle.
- **DECISION:** Ein Karriereprofil kann einschließlich Reference Degree ohne Namen, E-Mail, LinkedIn-Kennung oder CV-Datei gespeichert werden. Freiwillige Kontaktangaben dürfen später ergänzt und unabhängig gelöscht werden.
- **DECISION:** Integrität wird vorzugsweise durch Schlüssel, Fremdschlüssel, `NOT NULL` und zeilenlokale Checks abgesichert. Eigene Trigger sind für die hier definierten fachlichen Invarianten nicht erforderlich.
- **DECISION:** Parallele Stationen, unvollständige Jahresangaben und unbekannte Katalogzuordnungen sind zulässig. Das System erfindet keine Abschlüsse, Zeitpunkte, Organisationen oder Identitäten.
- **DECISION:** Self-Hosting erfordert keine spezifische Hostingplattform, keinen externen Identitätsanbieter und keinen externen Analyse- oder KI-Dienst. Die Architektur der Baseline bleibt der technische Rahmen.

## 2. Non-Goals

- **DECISION:** Dieses Dokument entwirft keine Authentifizierung, Rollenarchitektur oder komplexe IAM-Lösung.
- **DECISION:** UI, Datenimporte, LinkedIn-Anbindung, KI-Funktionen, Migration historischer Datensätze und Deployment werden hier nicht implementiert.
- **DECISION:** Es gibt keine zweite kanonische Repräsentation in CV-JSON, Excel-Zeilen, Providerobjekten, flachen Bachelor-/Master-Spalten oder Timeline-Kopien.
- **DECISION:** Exakte Tagesdaten, vollständige Lebensläufe, Kontaktdatenanreicherung und automatische Personenidentifikation sind keine Anforderungen des analytischen Kerns.
- **DECISION:** Die pseudonymisierte Speicherung wird nicht als Anonymisierung bezeichnet. Seltene Kombinationen von Stationen können Personen auch ohne Kontakttabelle identifizierbar machen.

## 3. Canonical Entities

**DECISION:** Die sieben Kernentitäten bleiben erhalten. Jede hat eine vorab erzeugbare, zufällige UUID als Primärschlüssel. Schlüssel tragen weder Personenmerkmale noch externe Kennungen. IDs dienen der internen Identität und sind keine Zugangsnachweise.

| Entität | Bedeutung und Kardinalität |
|---|---|
| `Alumni` | Ein pseudonymisiertes Karriereprofil. Besitzt mindestens einen `Degree`, genau einen davon als Reference Degree und beliebig viele `CareerStep`-Datensätze. |
| `Degree` | Eine akademische Qualifikationsphase einer Person, einschließlich ihres Abschlusses, falls erworben. Gehört genau einem Alumni. |
| `CareerStep` | Eine einzelne berufliche, außerakademische Ausbildungs- oder andere Karrierephase. Gehört genau einem Alumni. |
| `AlumniTimelineItem` | Eine Position in der redaktionell geordneten Timeline eines Alumni; referenziert genau einen eigenen Degree oder CareerStep. |
| `Program` | Ein kanonischer akademischer Studiengang an genau einer Institution. Keine individuelle Teilnahme. |
| `Institution` | Eine Bildungseinrichtung als gemeinsam genutzter Katalogeintrag. |
| `Organisation` | Eine Organisation als Arbeitgeber, Praxisbetrieb, Einsatzstelle oder sonstiger Träger. Keine Person und keine individuelle Station. |

**DECISION:** Die operative Ebene besteht bei entsprechendem Zweck aus `AlumniContact`, `ConsentRecord` und einem minimalen `ImportRun`. Eine eigene Tabelle `ImportSource` wird zunächst nicht benötigt: Die Quellenart ist ein kontrollierter Wert des ImportRun. Diese Entitäten sind keine Voraussetzung für ein pseudonymisiertes Profil und keine analytischen Dimensionen.

## 4. Privacy Boundary

| Legacy-Attribut in Alumni | Normative Entscheidung |
|---|---|
| `fullName` | **DECISION:** Entfällt im Kern. Optionaler Anzeigename in `AlumniContact`, nur für Kontaktzwecke; kein verpflichtender amtlicher Vollname. |
| `email` | **DECISION:** Entfällt im Kern. Optional in `AlumniContact`; weder Personenprimärschlüssel noch globale Unique-Regel. Geteilte oder später geänderte Adressen sind möglich. |
| `linkedInId` | **DECISION:** Entfällt dauerhaft im Kern und in der Kontakttabelle. Allenfalls kurzlebig für einen ausdrücklich begonnenen Import nötig; kein dauerhafter Identitätsabgleich über Providerkennungen. |
| `cvFileUrl` | **DECISION:** Entfällt. Der kanonische Datensatz enthält weder öffentliche URL noch dauerhaften Verweis auf ein Originaldokument. |
| `code` | **DECISION:** Entfällt als zusätzlicher Legacy-Identifier. Die zufällige Alumni-ID genügt intern; ein etwaiger späterer Kontakt- oder Bearbeitungscode wäre ein eigener operativer Zweck. |

**DECISION:** `Alumni` speichert nur `id`, `referenceDegreeId` und technische Erstellungs-/Änderungszeitpunkte. Kein Name, keine E-Mail, kein Geburtsdatum, keine Anschrift, keine Providerkennung und keine aus diesen Angaben abgeleiteten Hashes gehören hinein. Das Karriereprofil selbst bleibt personenbezogen im weiteren Sinn und wird entsprechend minimiert.

**DECISION:** `AlumniContact` ist eine optionale 0..1-Erweiterung mit `alumniId` als Primär- und Fremdschlüssel. Sie enthält höchstens einen optionalen Anzeigenamen, eine optionale E-Mail und technische Zeitpunkte. Mindestens eine der beiden Angaben muss nichtleer sein. Es gibt keinen leeren Pflicht-Kontaktdatensatz und keinen Kontaktzwang bei der Profilerfassung.

**DECISION:** `ConsentRecord` dokumentiert ausschließlich tatsächlich erklärte, zweckbezogene Entscheidungen: Alumni-Bezug, kontrollierter Zweck, Version des Erklärungstexts, Zeitpunkt, positive Ereignisnummer und Entscheidung (`GRANTED` oder `WITHDRAWN`). Es kopiert weder Namen noch Adresse, IP-Adresse, User-Agent oder CV-Inhalte. Ereignisse werden im gewöhnlichen Betrieb ergänzt, nicht als pauschales Boolean in Alumni überschrieben. Die Ereignisnummer ist je Alumni und Zweck eindeutig, wird beim serialisierten Ergänzen erhöht und bestimmt auch bei gleichen Zeitpunkten die Reihenfolge. Eine Widerrufsentscheidung beendet die Verwendung für ihren Zweck; die operative Kontaktfreigabe muss zusätzlich zum bloßen Vorhandensein einer Adresse geprüft werden.

**DECISION:** Der vorläufig einzige Kontaktzweck heißt `CONTACT`; analytische Nutzung wird nicht implizit durch eine Kontakterlaubnis legitimiert. Welche Nachweise dafür erforderlich sind, bleibt OQ-1. Das Profil darf technisch vor und unabhängig von einer freiwilligen Kontaktentscheidung entstehen.

**DECISION:** `ImportRun` enthält nur eine zufällige ID, Quellenart (`MANUAL`, `LINKEDIN`, `CV`, `EXCEL`), Beginn/Ende, Status, Zähler, eine begrenzte Fehlerklassifikation und gegebenenfalls eine kurzlebige technische Wiederholungskennung. Es enthält keine Rohdaten, Dateinamen, URLs, Provider-Personenkennungen, Freitextfehler mit Nutzdaten oder dauerhafte Alumni-Zuordnung. Manuelle Eingabe erfordert keinen ImportRun. Dauerhafte Herkunft pro Feld ist kein Ziel dieses Modells.

**DECISION:** Eingaben werden vor Übernahme normalisiert und validiert. Rohdateien und Providerantworten dürfen nur zweckgebunden und zeitlich begrenzt in einer separaten operativen Verarbeitung existieren. Nach erfolgreicher Übernahme werden sie gelöscht; für Fehler/Abbruch ist eine endliche Ablaufzeit verpflichtend. Sie sind niemals analytische Datenquelle. Konkrete Fristen stehen in OQ-2.

**DECISION:** Analytische Abfragen und Exporte verwenden den Kern und verbinden ihn nicht automatisch mit Kontaktdaten oder Einwilligungsereignissen. Personenbeziehbare freie Titel werden auf den nötigen fachlichen Inhalt begrenzt; ein allgemeines `CareerStep.note` wird nicht übernommen. Arbeitsplatzorte werden höchstens als Stadt/Region/Land geführt, niemals als Privatadresse.

## 5. Entity Responsibilities

| Entität | Verbindliche Felder beziehungsweise Verantwortung |
|---|---|
| `Alumni` | Profilidentität und genau eine Referenzauswahl; keine eigenen Abschluss-, Arbeitgeber- oder Reihenfolgefelder. |
| `Degree` | `alumniId`, `level`, `status`; optional `startYear`, `endYear`, `graduationYear`, fachlicher Titel und Fachgebiet sowie eine Katalogzuordnung. Status: `IN_PROGRESS`, `COMPLETED`, `ENDED_WITHOUT_DEGREE`, `UNKNOWN`. |
| `CareerStep` | `alumniId`, `type`, `temporalStatus`; optional Jahre, Tätigkeitsbezeichnung, Tätigkeitskategorie, Funktionsbereich und Stationsort. Kein Abschlusslevel und keine Kopie eines Degree. |
| `AlumniTimelineItem` | `alumniId`, `type`, positive `position`, genau einer der beiden Zielverweise. Keine Kopien von Titel, Jahren oder Organisation. |
| `Program` | Pflichtfelder `institutionId`, `name`; optionale `faculty`. Die Fakultät ist ein Katalogmerkmal des Programms, kein Merkmal in Alumni. |
| `Institution` | Pflichtfeld `name`, optionaler Ort. Verlässliche institutionelle Identität wird durch die UUID repräsentiert, nicht allein durch einen Namen. |
| `Organisation` | Pflichtfeld `name`, optionaler Ort und optionale Branchenklassifikation `sector`. Der Ort bezeichnet den Katalogeintrag; ein abweichender Arbeitsort steht auf der Station. |

**DECISION:** Ein Degree verweist entweder auf ein bekanntes Program oder direkt auf eine Institution, wenn der Studiengang unbekannt ist; er darf auch beides unbekannt lassen. `programId` und direktes `institutionId` dürfen niemals zugleich gesetzt sein. Bei vorhandenem Program wird die Institution ausschließlich über `Program.institutionId` ermittelt. So kann kein Degree einen Studiengang mit einer widersprüchlichen Hochschule kombinieren, und die Hochschulzuordnung wird nicht redundant gespeichert.

**DECISION:** Program bezeichnet das benannte fachliche Studienangebot, nicht die individuell angestrebte Abschlussstufe. Ein identisch benanntes Angebot derselben Institution/Fakultät darf von Bachelor- und Master-Degrees gemeinsam referenziert werden; das Level steht ausschließlich am Degree. Fachlich unterschiedlich benannte Angebote bleiben separate Programme. Der Program-Katalogschlüssel benötigt deshalb kein zusätzliches Level, und Program dupliziert keine Degree-Qualifikation.

**DECISION:** Ein CareerStep darf eine Organisation oder eine Institution als Träger referenzieren, höchstens eine davon. `institutionId` ist nur für `EDUCATION` und `VOCATIONAL_TRAINING` zulässig. `UNEMPLOYED` hat keinen Träger. Eine Universität als Arbeitgeber wird in ihrer Arbeitgeberrolle als Organisation geführt; ein gemeinsames umfassendes Rechtsträgermodell wird dafür nicht eingeführt.

**DECISION:** Die Branchenklassifikation des Arbeitgebers liegt in `Organisation.sector`; das gleichbedeutende Legacy-Feld `CareerStep.industry` entfällt. Tätigkeitskategorie und Funktionsbereich beschreiben dagegen die individuelle Arbeit und bleiben optional. Für unbekannte Organisationen wird kein künstlicher „Unknown“-Datensatz angelegt.

**DECISION:** Jede Degree- und CareerStep-Zeile darf unabhängig von ihrer Timeline-Präsenz existieren. Standardmäßige fachliche Erfassung legt Station und TimelineItem gemeinsam an. Analytische Vollständigkeit wird an den Stationstabellen gemessen; eine Timeline darf eine Teilmenge darstellen. „Jede Station muss in der Timeline sein“ ist ausdrücklich keine Datenbankinvariante.

**DECISION:** Zeitpunkte der technischen Metadaten verwenden PostgreSQL `timestamptz` und werden in UTC verarbeitet. Jeder autorisierte Schreibweg ist für die korrekte Aktualisierung von `updatedAt` verantwortlich. Ein Prisma-Attribut allein begründet keine Datenbankgarantie für Änderungen durch direkte SQL-Zugriffe. Die Metadaten sind kein unveränderbares Auditprotokoll.

## 6. Required PostgreSQL Invariants

Die folgende Liste ist normativ und beschreibt Anforderungen, keine auszuführende DDL.

| ID | Invariante | Geforderte Absicherung |
|---|---|---|
| PG-1 | Jede Entität hat eine eindeutige, nichtleere Identität. | UUID-Primärschlüssel; Pflichtattribute `NOT NULL`. |
| PG-2 | Jedes persistierte Alumni besitzt genau einen eigenen Reference Degree. | Nichtnullable Referenz plus zusammengesetzter, aufgeschobener FK gemäß Abschnitt 7. |
| PG-3 | Degrees und CareerSteps haben existierende Eigentümer. | Nichtnullable `alumniId` mit FK auf Alumni und `ON DELETE CASCADE`. |
| PG-4 | Ein TimelineItem verweist typgerecht auf genau ein Ziel. | Nichtnuller Typ und zeilenlokaler XOR-Check; keine zwei und keine null Zielverweise. |
| PG-5 | Das Timeline-Ziel gehört demselben Alumni. | Zusammengesetzte FKs gemäß Abschnitt 8. |
| PG-6 | Timelinepositionen sind positiv und je Alumni eindeutig. | `NOT NULL`, Check `position > 0`, nichtaufschiebbares Unique auf `(alumniId, position)`. |
| PG-7 | Jede Station kommt pro Timeline höchstens einmal vor. | Je ein gewöhnlicher Unique auf `degreeId` beziehungsweise `careerStepId`; mehrere NULL-Werte bleiben hier ausdrücklich erlaubt. |
| PG-8 | Bekannte Jahresgrenzen widersprechen sich nicht. | Zeilenlokale Checks gemäß Abschnitt 10. |
| PG-9 | Ein Program hat eine Institution und einen eindeutigen Katalogschlüssel einschließlich fehlender Fakultät. | FK, `NOT NULL` und `UNIQUE NULLS NOT DISTINCT` gemäß Abschnitt 11. |
| PG-10 | Degree-Katalogverweise und CareerStep-Träger entsprechen Abschnitt 5. | FKs und zeilenlokale Checks für Ausschluss und zulässige Typen. |
| PG-11 | Höchstens eine Kontaktzeile je Alumni, keine verwaisten Kontaktdaten oder Einwilligungen. | Kontakt-PK `alumniId`, nichtnullable Alumni-FKs, Löschkaskaden; Check gegen leere Kontaktzeilen. |
| PG-12 | Pflichttexte sind nicht nur Leerraum; optionale Texte sind NULL oder nichtleer. | Zeilenlokale Nichtleer-Checks, auch bei direkten SQL-Schreibzugriffen. |
| PG-13 | Erläuterungsbedürftige Abschluss-/Stationsarten sind fachlich bezeichnet. | Zeilenlokale Checks verlangen einen nichtleeren Degree-Titel bei Level DIPLOMA oder OTHER und eine nichtleere CareerStep-Bezeichnung bei Typ OTHER. |
| PG-14 | Consent-Ereignisse sind pro Alumni und Zweck eindeutig geordnet. | Positive, nichtnulle Ereignisnummer und Unique auf Alumni, Zweck und Ereignisnummer; das monotone Ergänzen ist ein serialisierter fachlicher Schreibablauf. |

**DECISION:** Alle FKs verwenden echte PostgreSQL-Constraints. Rein von Prisma emulierte Relationen erfüllen diese Anforderungen nicht. Auf FK-Zielpaaren verwendete Unique-Constraints sind nicht aufschiebbar. Abgesehen vom Reference-Degree-Rückverweis bleiben die hier definierten Constraints unmittelbar wirksam.

**DECISION:** In einer späteren Implementierung sind SQL-spezifische Regeln ausdrücklich versionierte Bestandteile der PostgreSQL-Migrationskette. Prisma-Schema, zusätzliche Datenbankregeln und tatsächlich erzeugte Datenbank müssen gemeinsam überprüft werden. Datenbankfähigkeiten, die Prisma nicht vollständig ausdrückt, dürfen nicht ersatzlos entfallen. Siehe [Prisma: Unsupported database features](https://www.prisma.io/docs/orm/v7/prisma-schema/data-model/unsupported-database-features).

## 7. Reference Degree Design Decision

**DECISION:** Gewählt wird ausschließlich `Alumni.referenceDegreeId` als nichtnullable Referenz auf einen eigenen Degree. `Degree.isReference` entfällt. Ein Reference Degree ist die fachlich ausgewählte akademische Bezugsstation für Auswertungen, nicht automatisch der höchste, jüngste oder erste Abschluss. Seine Auswahl behauptet nicht, dass die Qualifikation bereits erworben wurde; dafür gilt `Degree.status`.

### Vergleich der relationalen Alternativen

| Kriterium | 1. Degree.isReference und verbesserte Constraints/Trigger | 2. Alumni.referenceDegreeId und Composite FK — gewählt | 3. Separate ReferenceDegree-Zuordnung |
|---|---|---|---|
| Datenintegrität | Partieller Unique sichert nur höchstens eine Referenz. Vollständige Existenzprüfung benötigt Trigger auf Alumni und Degree, Prüfung alter/neuer Eigentümer und abgesicherte Nebenläufigkeit. | Pflichtfeld sichert eine Auswahl; zusammengesetzter FK sichert Existenz und eigenen Eigentümer. Keine Zähltrigger. | Ein Unique/PK auf alumniId sichert höchstens eine Zuordnung. Jeder Alumni braucht zusätzlich eine garantierte Zuordnung, also erneut einen Pflicht-Rückverweis oder Trigger. |
| Neuer Alumni | Transaktion mit anschließendem Referenzdegree; Alumni-Insert muss ebenfalls eine Endprüfung auslösen. | Alumni- und Degree-ID vorab vergeben; Alumni mit Referenz-ID, dann Degree in derselben Transaktion anlegen. | Zusätzliche Zeile und bei vollständiger Garantie derselbe zyklische Erzeugungsbedarf. |
| Referenzwechsel | Alten Marker zuerst entfernen, neuen setzen; sofortiger partieller Index verbietet Zwischenzustand mit zwei Referenzen. | Ein Update an Alumni; neuer Degree muss spätestens bei Commit als eigener Degree existieren. | Update der Zuordnung; Pflicht zur Zuordnung bleibt separat zu sichern. |
| Degree löschen | Trigger muss letzte Referenz abfangen und Ersatz innerhalb derselben Transaktion erlauben. | Nichtreferenzdegree frei löschbar; Referenzdegree nur mit Ersatz oder Löschung des Alumni in derselben Transaktion. | Zuordnung blockiert Löschung, garantiert allein aber keinen Ersatz. |
| Alumni löschen | Trigger muss erkennen, dass der Eigentümer ebenfalls gelöscht wurde. | Ownership-Kaskade entfernt Degrees; aufgeschobener Rück-FK hat danach keinen referenzierenden Alumni mehr. | Zusätzliche Kaskaden und gegebenenfalls zyklischer Rück-FK. |
| Transaktionen | Benutzerdefinierte Endprüfungen und Sperrstrategie nötig; bloßes COUNT genügt nicht als Nebenläufigkeitsentwurf. | PostgreSQL-FK-Prüfung und eindeutige Zielschlüssel sichern den Commit; atomare Schreibabläufe bleiben erforderlich. | Mehr Beziehungen ohne zusätzlichen fachlichen Nutzen. |
| Prisma | Boolean leicht darstellbar; zentrale Garantie bleibt in SQL-Triggern/Indexdefinitionen verborgen. | Skalare IDs und Relationen darstellbar; Aufschiebbarkeit erfordert zusätzliche versionierte PostgreSQL-Definition. Zyklus wird explizit transaktional geschrieben. | Tabelle leicht darstellbar; Garantie „mindestens eine“ bleibt weiterhin SQL-spezifisch. |
| Wartbarkeit | Verhalten verteilt auf partiellen Index, mehrere Triggerereignisse und Sonderfälle. | Ein benannter Pflichtverweis mit dokumentiertem Insert- und Löschablauf; deklarative Integrität. | Zusätzliche Indirektion ohne benötigte eigene Attribute oder Historie. |

### Verbindlicher Constraint-Vertrag

- **DECISION:** `Degree` hat neben dem UUID-PK einen nichtaufschiebbaren eindeutigen Zielschlüssel `(alumniId, id)`.
- **DECISION:** `(Alumni.id, Alumni.referenceDegreeId)` referenziert `(Degree.alumniId, Degree.id)`. Beide Referenzspalten sind immer `NOT NULL`.
- **DECISION:** Ausschließlich dieser Rückverweis ist `DEFERRABLE INITIALLY DEFERRED`, mit `ON DELETE NO ACTION` und `ON UPDATE NO ACTION`. `RESTRICT` wird hier nicht eingesetzt, weil die Endprüfung bis zum Transaktionsabschluss möglich sein muss. Der Ownership-FK `Degree.alumniId → Alumni.id` bleibt unmittelbar und verwendet `ON DELETE CASCADE`.
- **DECISION:** IDs sind fachlich unveränderlich. Ein Transfer von Stationen zwischen Alumni ist kein normaler Bearbeitungsvorgang. Jeder administrative Korrekturversuch muss dieselben Ownership- und Referenzconstraints erfüllen; ein referenzierter Degree kann seinem bisherigen Alumni nicht unbemerkt entzogen werden.

Die Unterscheidung zwischen `NO ACTION` und `RESTRICT`, zusammengesetzte FKs sowie `NULLS NOT DISTINCT` sind PostgreSQL-Fähigkeiten; siehe [PostgreSQL: Constraints](https://www.postgresql.org/docs/17/ddl-constraints.html). Aufschiebbare Constraints werden spätestens beim Commit geprüft; `NOT NULL` und `CHECK` werden durch Aufschieben nicht ausgesetzt. Siehe [PostgreSQL: SET CONSTRAINTS](https://www.postgresql.org/docs/17/sql-set-constraints.html).

### Erzeugen, Ändern und Löschen

1. **DECISION:** Beim Erzeugen werden Alumni-ID und Referenzdegree-ID vorab bestimmt. Eine Transaktion legt zuerst Alumni mit der bereits nichtnullen Referenz-ID an, dann den dazugehörigen Degree und optional weitere Stationen/TimelineItems. Ein Commit ohne passenden Degree schlägt fehl. Name, E-Mail und Kontaktfreigabe sind hierfür nicht erforderlich.
2. **DECISION:** Beim Wechsel wird die Referenz auf einen vorhandenen eigenen Degree gesetzt oder ein neuer eigener Degree innerhalb derselben Transaktion angelegt. Andere Transaktionen sehen keinen erfolgreich committeden Alumni ohne gültige Referenz.
3. **DECISION:** Ein Referenzdegree darf innerhalb einer Transaktion gelöscht und ersetzt werden. Am Ende muss der Alumni auf einen existierenden eigenen Degree zeigen. `SET NULL` ist kein erlaubter Löschpfad.
4. **DECISION:** Beim Löschen des Alumni entfernt die Ownership-Kaskade die Degrees; die aufgeschobene Rückreferenzprüfung darf die vollständige Löschung nicht verhindern.
5. **DECISION:** Ein Profil ohne irgendeine akademische Qualifikationsphase ist kein gültiger persistierter Alumni dieses Modells. Es wird kein Schein-Degree und kein dauerhaft nullable Reference Degree erzeugt. Unvollständige Eingaben werden vor Beginn der kurzen atomaren Schreibtransaktion vervollständigt. Keine Datenbanktransaktion bleibt über menschliche Bearbeitungsschritte oder eine spätere Kontakterfassung hinweg geöffnet. Eine spätere Erweiterung auf andere Zielgruppen ist OQ-3.

**DECISION:** Ein einzelnes Prisma-Nested-Create wird nicht vorausgesetzt. Die spätere Implementierung muss den Zyklus mit explizit vergebenen IDs und einer interaktiven Transaktion abbilden. Fehler beim Commit müssen als fehlgeschlagene gesamte Profilspeicherung behandelt werden. Gleichzeitige Bearbeitungen dürfen keine ungültigen Referenzen erzeugen. Änderungen an demselben Profil werden transaktional am Alumni serialisiert: Lesen, Ableiten und Schreiben des aktuellen Datenbankzustands erfolgen unter demselben Alumni-Zeilenlock. Diese Serialisierung sichert den Transaktionsablauf, erkennt für sich allein aber keine veralteten Client-Eingaben.

**REJECTED:** Der historische partielle Unique-Index plus Degree-only-Zähltrigger wird nicht repariert und weitergeführt. Insbesondere fehlen dort der Alumni-Insert, die alte Owner-ID beim Transfer und die Ausnahme für vollständig gelöschte Alumni. Auch eine neue Triggeranlage ohne Bestandsvalidierung wäre keine rückwirkende Integritätsgarantie.

**REJECTED:** Die separate Zuordnungstabelle wird mangels eigener fachlicher Attribute verworfen. Dass ein Feld namens `referenceDegreeId` im historischen Audit als entfernt aufgeführt ist, verbietet nicht seine begründete Wiedereinführung mit einem neuen, vollständigen Constraint-Vertrag.

## 8. Timeline Ownership Design Decision

| Ansatz | Bewertung |
|---|---|
| Composite Foreign Keys | **DECISION:** Gewählt. Existenz und gleicher Eigentümer werden deklarativ auch unter Nebenläufigkeit gesichert. |
| Trigger | **REJECTED:** Würden zusätzlich Änderungen an Timeline und beiden Zieltabellen sowie Sperrverhalten berücksichtigen müssen; kein Vorteil gegenüber FK. |
| Reine Application Validation | **REJECTED:** Direkte SQL-Zugriffe und konkurrierende Änderungen könnten die Prüfung umgehen. Nützlich für Fehlermeldungen, nicht als Integritätsgrenze. |

**DECISION:** Degree und CareerStep besitzen jeweils einen nichtaufschiebbaren Unique-Zielschlüssel `(alumniId, id)`. Timeline verwendet die beiden FKs `(alumniId, degreeId) → Degree(alumniId, id)` und `(alumniId, careerStepId) → CareerStep(alumniId, id)`. Zusätzlich besteht der direkte nichtnullable FK zum Alumni. Alle drei Löschbeziehungen verwenden `CASCADE`.

**DECISION:** Die zusammengesetzten Zielverweise verwenden `MATCH SIMPLE`. Beim ungenutzten Verweis ist die Ziel-ID NULL; dieser FK wird daher nicht geprüft. Der typabhängige XOR-Check und das nichtnulle `alumniId` garantieren, dass der genutzte Verweis vollständig vorliegt und geprüft wird. `MATCH FULL` würde die gewollte teilweise NULL-Belegung des ungenutzten Verweises verhindern.

**DECISION:** Ownership wird nicht durch zusätzliche einfache Degree-/CareerStep-FKs als Ersatz geprüft. Die zusammengesetzten FKs sind die maßgebliche Beziehung. Updates von Schlüssel- oder Ownership-Spalten kaskadieren nicht automatisch in andere Eigentumsbeziehungen; `ON UPDATE NO ACTION` vermeidet implizite Transfers.

## 9. Timeline Ordering Rules

| Frage | Verbindliche Regel |
|---|---|
| Muss `position > 0` sein? | **DECISION:** Ja, durch PostgreSQL-Check; NULL ist ebenfalls unzulässig. |
| Beginnt die Timeline bei 1? | **DECISION:** Die initiale fachliche Vergabe beginnt bei 1. Der gespeicherte Mindestwert muss nach Änderungen nicht 1 bleiben; dies ist keine Datenbankinvariante. |
| Müssen Positionen lückenlos sein? | **DECISION:** Nein. Dauerhafte Lücken sind zulässig und haben keine fachliche Bedeutung. |
| Sind vorübergehende Lücken beim Bearbeiten erlaubt? | **DECISION:** Ja. Auch vorübergehend gelten positive, pro Alumni eindeutige Positionen. |
| Darf ein Degree mehrfach vorkommen? | **DECISION:** Nein. Ein Unique auf der nichtleeren degreeId verhindert dies. |
| Darf ein CareerStep mehrfach vorkommen? | **DECISION:** Nein. Ein Unique auf der nichtleeren careerStepId verhindert dies. |

**DECISION:** Position ist eine Darstellungsreihenfolge und kein zeitlicher Beweis. Parallel verlaufende Stationen erhalten verschiedene Positionen und dürfen gleiche oder überlappende Jahre haben. Die Darstellung sortiert aufsteigend nach Position; eine sichtbare laufende Nummer kann unabhängig davon bei 1 beginnen.

**DECISION:** Reihenfolgeänderungen erfolgen atomar und für denselben Alumni serialisiert. Wegen unmittelbar eindeutiger Positionen darf die Implementierung freie positive Zwischenpositionen verwenden; sie muss dabei den Wertebereich berücksichtigen. Temporär negative Positionen, automatische Lückenschließung und Sequenztrigger werden nicht benötigt.

**REJECTED:** `predecessorId`, `successorId`, zusätzliche `orderIndex`-Spalten und automatisch erzwungene lückenlose Reihenfolgen werden nicht übernommen.

## 10. Date Rules

**DECISION:** Die kleinste fachliche Zeitauflösung ist zunächst ein Kalenderjahr. Bekannte Jahreswerte sind ganze Zahlen zwischen 1 und 9999. Die Datenbank prüft diesen stabilen Wertebereich; sie verwendet keine vom jeweils aktuellen Datum abhängige Jahresgrenze.

**DECISION:** Für Degree und CareerStep gilt: Wenn `startYear` und `endYear` beide bekannt sind, muss `startYear <= endYear` gelten. Die Datenbank sichert explizit die Bedingung „startYear ist NULL oder endYear ist NULL oder startYear <= endYear“. Gleiche Jahre sind erlaubt. NULL bedeutet fehlendes Wissen, niemals Null als Jahr oder automatisch „läuft noch“.

**DECISION:** CareerStep hat den Pflichtstatus `ONGOING`, `ENDED` oder `UNKNOWN`. Für `ONGOING` muss `endYear` NULL sein; für `ENDED` darf das Endjahr unbekannt bleiben. `UNKNOWN` mit Endjahr ist widersprüchlich und wird abgewiesen: ein bekanntes tatsächliches Endjahr verlangt `ENDED`. Geplante Endjahre werden in diesem Modell nicht gespeichert.

**DECISION:** Beim Degree bestimmt `status` den Verlauf. `IN_PROGRESS` verlangt `endYear = NULL` und `graduationYear = NULL`. `ENDED_WITHOUT_DEGREE` verlangt `graduationYear = NULL`. `UNKNOWN` verlangt unbekanntes Ende und unbekanntes Abschlussjahr. Nur `COMPLETED` darf ein `graduationYear` besitzen, muss dieses bei fehlendem Wissen aber nicht besitzen. Für beendete Degrees darf `endYear` unbekannt bleiben.

**DECISION:** Wenn Start- und Abschlussjahr bekannt sind, gilt `startYear <= graduationYear`. Wenn End- und Abschlussjahr bekannt sind, gilt `endYear <= graduationYear`: Ende der Qualifikationsphase und formale Verleihung dürfen auseinanderliegen. Beide Regeln werden in PostgreSQL geprüft. `graduationYear` darf nicht aus einem unbekannten Endjahr geraten oder aus der Timelineposition abgeleitet werden.

**DECISION:** Eine Promotion kann sich mit Beschäftigung überschneiden, ein Master mit Werkstudententätigkeit. Es gibt keinen Exclusion-Constraint und keine globale Prüfung auf überschneidungsfreie Lebensläufe. Der Reference Degree begrenzt weder den erlaubten Beginn anderer Stationen noch deren Reihenfolge.

## 11. Unique / Identity Rules

**DECISION:** UUIDs sind Identitätsschlüssel; beschreibende Namen sind grundsätzlich keine Personenidentität. Änderungen von Kontaktadressen, Titeln oder Katalogbezeichnungen erzeugen keinen neuen Alumni. Importe dürfen Personen nicht allein anhand von Namen, E-Mail, Stationen oder LinkedIn-Kennungen automatisch zusammenführen.

| Gegenstand | Normative Regel und Bewertung der Legacy-NULL-Semantik |
|---|---|
| Program | **DECISION:** Schlüssel `(institutionId, name, faculty)` mit `NULLS NOT DISTINCT`. Derselbe kanonische Name mit unbekannter Fakultät wird je Institution nur einmal katalogisiert. Die Legacy-NULL-Duplikate sind hier unbeabsichtigt und werden verhindert. Institution-Scope verhindert die ungewollte Gleichsetzung gleichnamiger Programme unterschiedlicher Hochschulen. |
| Organisation | **DECISION:** Der Legacy-Unique auf `(name, location)` entfällt vollständig. Namen und Ortsangaben identifizieren Organisationen fachlich nicht zuverlässig, auch bei nichtnullen Orten. Gleichnamige Organisationen bei unbekanntem oder gleichem Ort dürfen als verschiedene UUIDs existieren. Mehrere NULL-Orte sind hier bewusst zulässig, nicht bloß ein unbeabsichtigtes PostgreSQL-Schlupfloch. |
| Institution | **DECISION:** Der globale Unique auf `name` entfällt. Gleichnamige Einrichtungen sind möglich; UUID und eine bestätigte Katalogzuordnung bestimmen Identität. |
| AlumniContact.email | **DECISION:** Keine globale Unique-Regel und keine Verwendung als Alumni-Schlüssel. |
| Timeline-Ziel-IDs | **DECISION:** Gewöhnliches Unique mit NULLS DISTINCT ist richtig: Viele Einträge haben den jeweils ungenutzten Zielverweis NULL. |

**DECISION:** Unbekannt ist NULL, niemals leerer String oder ein Text wie „N/A“. Texte werden vor Übernahme getrimmt und in Unicode-NFC normalisiert. Ein benannter Katalogschlüssel vergleicht die gespeicherten normalisierten Werte deterministisch und zunächst unter Beachtung der Groß-/Kleinschreibung; automatische Kleinschreibung oder Akzententfernung verändert die Identität nicht. Die konkrete spätere PostgreSQL-Definition muss diese Vergleichssemantik reproduzierbar festlegen.

**DECISION:** Der Program-Schlüssel ist ein vereinbarter Katalogschlüssel, keine Behauptung über reale Hochschulverzeichnisse. `name` muss unterschiedliche Programme innerhalb derselben Institution/Fakultät fachlich unterscheidbar bezeichnen. Ein Konflikt wird geklärt; weder neue NULL-Duplikate noch automatische Zusammenführung lösen ihn. Unbekannte Institutionen rechtfertigen kein globales Program ohne Scope: Der Degree darf in diesem Fall vorerst ohne programId bestehen.

**DECISION:** Bei Organisation und Institution liefern gleiche Namen/Orte lediglich Matching-Kandidaten. Bei unklarer Identität wird eine Zuordnung offengelassen oder nach fachlicher Bestätigung ein eigenständiger Katalogeintrag gewählt. Derselbe Import darf nicht allein wegen eines fehlenden Unique-Schlüssels bei jedem Wiederholen neue Katalogzeilen anlegen; Wiederaufnahme einer Übernahme muss bestätigte kanonische IDs innerhalb ihres operativen Lebenszyklus wiederverwenden. Nach dessen Ablauf gibt es keine behauptete globale Provider-Idempotenz.

**DECISION:** Indizes auf Namen/Orten dürfen Suche und Duplikatprüfung unterstützen, garantieren aber keine Identität. Vorhandene PK-/Unique-Indizes werden nicht durch identische normale Indizes verdoppelt. FK-Indizes und zusätzliche Analyseindizes werden anhand der späteren Lösch- und Abfragepfade festgelegt; der Auditbefund fehlender Indizes wird nicht mit pauschaler Übernahme aller Legacy-Indizes gelöst.

## 12. Cascade / Delete Semantics

| Löschung | Ergebnis |
|---|---|
| Alumni | **DECISION:** Löscht Degrees, CareerSteps, TimelineItems, AlumniContact und ConsentRecords über echte FKs kaskadierend. Geteilte Katalogeinträge bleiben bestehen. |
| Nichtreferenzdegree | **DECISION:** Löscht zugehöriges TimelineItem kaskadierend. Andere Stationen bleiben bestehen; Positionslücken sind erlaubt. |
| Referenzdegree | **DECISION:** Scheitert spätestens beim Commit, solange der Alumni bleibt und keinen gültigen Ersatz hat. Ersatz und Löschung des alten Degree dürfen dieselbe Transaktion bilden. |
| CareerStep | **DECISION:** Löscht seinen Timelineeintrag kaskadierend. |
| TimelineItem | **DECISION:** Löscht ausschließlich die Darstellung, nicht die Station. |
| AlumniContact | **DECISION:** Löscht die Kontaktangaben, ohne Karriereprofil und Stationen zu entfernen. Kontakt ist danach mangels Adresse nicht möglich. Ein Widerruf wird separat zweckbezogen dokumentiert. |
| ConsentRecord | **DECISION:** Keine Löschkaskade nach oben. Zweckgebundene Aufbewahrung und spätere Bereinigung dürfen nicht durch beliebige History-Edits ersetzt werden. Vollständige Alumni-Löschung entfernt auch diese Zeilen. |
| Program, Institution, Organisation | **DECISION:** Löschung wird bei vorhandenen fachlichen Referenzen durch `RESTRICT` verhindert. Katalogkorrektur/-zusammenführung verlangt zuvor eine explizite, transaktionale Neuzuordnung. |
| ImportRun | **DECISION:** Löschung entfernt ausschließlich operative Metadaten; sie verändert niemals den kanonischen Karrierepfad. |

**DECISION:** Verwendete Kataloge werden nicht wie im Legacy-Modell pauschal mit `SET NULL` abgetrennt. Ein unbeabsichtigtes Katalog-Delete darf keine vorhandenen fachlichen Zuordnungen unbemerkt verlieren lassen. Bei bewusstem Entfernen einer Zuordnung ist eine ausdrückliche Bearbeitung der Station nötig.

**DECISION:** Vollständige Profillöschung ist physische Löschung; ein Soft-Delete mit dauerhaft erhaltenen personenbezogenen Detailzeilen ist kein Ersatz. Noch laufende Verarbeitung und temporäre Quelldateien müssen bei einem entsprechenden Löschvorgang ebenfalls beendet beziehungsweise bereinigt werden. Backups und Fristen gehören zu OQ-2; eine FK-Kaskade behauptet keine sofortige Löschung aus Backups.

**DECISION:** Fachliche IDs und Ownership werden nicht per `ON UPDATE CASCADE` umgehängt. Alle nicht eigens abweichend genannten Update-Aktionen sind `NO ACTION`. Gemeinsame Kataloge dürfen keine persönlichen CV-Freitexte oder Kontaktdaten als Nebenablage aufnehmen.

## 13. Allowed Station Types

**DECISION:** Degree beschreibt eine zusammenhängende akademische Qualifikationsphase. Die Phasen Bachelor, Master und Promotion werden jeweils genau einmal als Degree modelliert, einschließlich des gegebenenfalls erworbenen Abschlusses. Studienverlauf und Abschluss werden nicht als zwei gleichbedeutende Stationen gespeichert.

**DECISION:** Die Degree-Level sind `BACHELOR`, `MASTER`, `PHD`, `DIPLOMA`, `CERTIFICATE`, `OTHER`. `CERTIFICATE` bezeichnet nur eine eigenständige akademische Zertifikatsqualifikation, nicht jeden Kursnachweis. `DIPLOMA` und `OTHER` sind akademische Abschlussarten; der Titel muss die Bedeutung erläutern. Zeilenlokale PostgreSQL-Checks verlangen für beide Level einen nichtnullen, nichtleeren Titel und für CareerStep-Typ `OTHER` eine nichtnulle, nichtleere Bezeichnung. Berufsausbildungen werden nicht wegen eines Zeugnisses zum Degree. Der Begriff Degree behauptet bei `IN_PROGRESS` oder `ENDED_WITHOUT_DEGREE` keinen erworbenen Titel.

| Station / vorhandener CareerStepType | Modell und Abgrenzung |
|---|---|
| Bachelor, Master, Promotion | **DECISION:** Je eine Degree-Zeile mit entsprechendem Level, Status und optionalen Jahren. Kein zusätzlicher EDUCATION-CareerStep für dasselbe Studium. |
| Ausbildung / `VOCATIONAL_TRAINING` | **DECISION:** CareerStep für eine berufliche Ausbildung, unabhängig davon, ob begonnen, beendet oder abgebrochen. Ein Abschlusszeugnis erzeugt keinen zusätzlichen Degree. |
| Auslandssemester / `EDUCATION` | **DECISION:** Eigenständiger CareerStep für eine abgegrenzte Bildungsphase ohne eigenen akademischen Abschlussgang, beispielsweise Austausch oder Weiterbildung. Darf einen Degree zeitlich überlappen, ohne dessen gesamtes Studium nochmals abzubilden. |
| Praktikum / `INTERNSHIP` | **DECISION:** CareerStep, auch als Bestandteil eines Studiums oder einer Ausbildung, wenn eine tatsächlich unterscheidbare Praxisphase erfasst wird. |
| Werkstudententätigkeit / `EMPLOYMENT` | **DECISION:** CareerStep EMPLOYMENT; die Werkstudententätigkeit wird durch die Tätigkeitskategorie bezeichnet. Keine besondere Bildungsstation. |
| Beschäftigung / `EMPLOYMENT` | **DECISION:** Eine konkrete Beschäftigungsphase. Rollenwechsel können eigene fachlich unterscheidbare Phasen begründen. |
| Ehrenamt / `VOLUNTEERING` | **DECISION:** CareerStep für eine eigenständige ehrenamtliche Tätigkeit. |
| Selbstständigkeit / `SELF_EMPLOYMENT` | **DECISION:** CareerStep; Organisation optional. Kein künstlicher Arbeitgeberdatensatz mit dem Namen der Person. |
| Arbeitslosigkeit / `UNEMPLOYED` | **DECISION:** Nur eine ausdrücklich angegebene Phase, niemals automatisch aus einer Timeline-Lücke abgeleitet; ohne Organisation oder Institution. |
| Sonstige Phase / `OTHER` | **DECISION:** Nur für fachlich relevante Phasen außerhalb dieser Kategorien, mit einer knappen sachlichen Bezeichnung; kein Auffangbecken für Rohdaten oder sensible Erläuterungen. |

**DECISION:** `EDUCATION` und `VOCATIONAL_TRAINING` bleiben zulässig, erhalten aber die obigen engen Bedeutungen. Ein importerzeugtes Education-Objekt muss anhand seines fachlichen Inhalts entweder zu Degree oder CareerStep normalisiert werden. Providerbezeichnungen bestimmen nicht den Zieltyp.

**DECISION:** Ein duales Studium kann Degree und eine eigenständige berufliche Ausbildungs- oder Beschäftigungsphase enthalten, wenn diese unterschiedliche tatsächliche Sachverhalte beschreiben. Ein Promotionsdegree und eine parallele wissenschaftliche Beschäftigung sind ebenfalls verschieden. Dieselben Zeitangaben allein machen Stationen weder identisch noch unzulässig.

**DECISION:** Vermeidung semantischer Doppelmodellierung ist eine fachliche Validierung aller Eingabewege. Die Datenbank verhindert doppelte Timeline-Verweise, kann aber nicht allein anhand ähnlicher Titel/Jahre entscheiden, ob zwei reale Phasen dieselbe Tätigkeit sind. Es wird deshalb kein irreführender Unique auf Alumni, Typ und Jahresgrenzen eingeführt.

## 14. Legacy Concepts Explicitly Rejected

| Auditbefund / Legacy-Konzept | Normative Behandlung |
|---|---|
| Degree-only-Trigger und partieller Referenzindex | **REJECTED:** Ersetzt durch Pflichtreferenz mit Composite FK; alle fünf im Audit beschriebenen Lücken/Sonderfälle werden durch den Vertrag in Abschnitt 7 adressiert. |
| Fehlender Ownership-Schutz in Timeline | **REJECTED:** Ein einfacher Ziel-FK reicht nicht; Composite FKs sind verpflichtend. |
| Nur Positions-Unique, keine positive Position, wiederholte Ziele | **REJECTED:** Positive Position und eindeutige Stationsverweise werden ergänzt; dauerhafte Lücken werden dagegen bewusst akzeptiert. |
| Fehlende Timelinezeile für eine Station | **DECISION:** Kein Integritätsfehler. Die optionale Darstellung wird ausdrücklich von den kanonischen Stationen getrennt. |
| Fehlende Jahres-, Nichtleer- und NULL-Regeln | **REJECTED:** Explizite Jahres-/Statuschecks und Textregeln ersetzen implizite Annahmen. |
| Pflichtname/Pflichtmail und Provider-/CV-Verweise in Alumni | **REJECTED:** Entfernt zugunsten minimalem Profil, optionalem Kontakt und begrenzter Quellenverarbeitung. |
| Program global nur über name/faculty eindeutig | **REJECTED:** Institution-Scope und ausdrückliche NULL-Gleichheit erforderlich. |
| Organisation über name/location und Institution über name als Identität | **REJECTED:** Beschreibende Namen sind keine zuverlässige globale Identität. |
| Abweichende CareerStep-Löschaktion in Prisma und historischer Migration | **REJECTED:** Das neue Modell verlangt nachweislich CASCADE bei Alumni-Löschung, nicht bloß eine Prisma-Zieldeklaration. |
| Fehlende Indizes/SQL-only-Regeln gegenüber Prisma | **REJECTED:** Weder Prisma allein noch SQL allein ohne Abgleich beschreibt die implementierte Gesamtgarantie. Alle verpflichtenden Regeln müssen im erzeugten PostgreSQL-Katalog nachweisbar sein. |
| Frühe SQLite-Migrationen bei PostgreSQL-Provider | **REJECTED:** Keine behauptete lauffähige PostgreSQL-Baseline. Die spätere Implementierung braucht eine reproduzierbare, reine PostgreSQL-Migrationsbasis. |
| Runtime-DDL in ensureSchema | **REJECTED:** Keine Schemaänderung beim normalen Anwendungsstart oder Request. Änderungen erfolgen ausschließlich über versionierte Migrationen; Laufzeitprüfungen dürfen höchstens lesend prüfen. |
| Alte flache Abschlussfelder in Alumni und BachelorProgram/ReferenceDegree als Altmodelle | **REJECTED:** Keine zweite fachliche Wahrheit. Abschlüsse in Degree, Studiengänge in Program, Referenzauswahl nach Abschnitt 7. |
| afterBachelor, stepType und doppelte Klassifikations-/Organisationstexte | **REJECTED:** Keine Legacy-Abkürzungen oder unnormalisierten Alternativfelder. Typ, Kategorie und Organisationsbezug erhalten die hier definierten Bedeutungen. |
| predecessorId/successorId/orderIndex | **REJECTED:** Reihenfolge allein durch AlumniTimelineItem.position. |
| Automatische Aussage über CvUpload aus Audit-Scope | **REJECTED:** Der Audit hat diese Tabelle nicht bewertet. Die neue Entscheidung gegen dauerhafte Quelldokumente folgt aus dieser Soll-Architektur, nicht aus einer behaupteten Legacy-Feststellung. |
| @updatedAt als behauptete SQL-Garantie | **REJECTED:** Alle Schreibwege müssen technische Zeitpunkte pflegen; Prisma-Verhalten ist kein Trigger. |

**DECISION:** Eine spätere Übernahme prüft vorhandene Daten vor Aktivierung der neuen Constraints vollständig. Unbekannte oder widersprüchliche Datensätze werden nicht durch erfundene Referenzdegrees, stilles Zusammenführen von Personen oder pauschales Weglassen von Constraints „repariert“. Dieser Schritt enthält weder eine Datenübernahme noch synthetische oder reale Datensätze.

## 15. Open Questions

Alle verbleibenden offenen Entscheidungen sind hier vollständig aufgeführt. Bis zu ihrer Klärung gelten die ausdrücklich beschriebenen Grenzen; keine dieser Fragen setzt die beschlossenen Kerninvarianten außer Kraft.

1. **OPEN QUESTION OQ-1 — Zwecke und Nachweisinhalte:** Welche konkreten Zwecke und Versionen von Erklärungen benötigt der jeweilige Betreiber für analytische Verarbeitung und Kontakt? Das Modell trennt diese Zwecke und speichert keine vorweggenommene pauschale Einwilligung. Vor produktiver Verarbeitung müssen erforderliche Nachweise und die Texte fachlich festgelegt werden.
2. **OPEN QUESTION OQ-2 — Aufbewahrungsfristen:** Welche endlichen Fristen gelten für fehlgeschlagene/abgebrochene Imports, ImportRun-Metadaten, nicht mehr benötigte Kontaktdaten, ConsentRecords und Backups? Erfolgreich übernommene Rohquellen werden bereits verbindlich gelöscht. Konkrete Fristen und die Behandlung eines Löschwunsches in Backups müssen vor produktivem Betrieb dokumentiert sein.
3. **OPEN QUESTION OQ-3 — Zielgruppe ohne akademischen Degree:** Soll später auch ein Profil ganz ohne akademische Qualifikationsphase zulässig sein, beispielsweise ausschließlich mit Berufsausbildung? Der aktuelle Vertrag erlaubt das ausdrücklich nicht. Eine Erweiterung erfordert einen neuen fachlichen Referenzbegriff und eine revidierte Architekturentscheidung, keinen nullable Workaround.
4. **OPEN QUESTION OQ-4 — Kontrollierte Klassifikationen:** Welche Taxonomien gelten für Tätigkeitskategorie, Funktionsbereich, Branchen und sachliche OTHER-Bezeichnungen? Bis zur Festlegung bleiben die Klassifikations- und Taxonomiezuordnungen optional; die Pflicht zur sachlichen Bezeichnung bei OTHER gilt unabhängig davon. Quellenwerte werden nicht als neue unkontrollierte Enums eingeführt. Die Stationstypen und Degree-Level selbst sind bereits entschieden.

## 16. Acceptance Criteria for the later implementation

Die folgenden Nachweise gehören in die spätere Implementierung. Dieses Dokument fügt keine Tests, kein Schema und keine Migration hinzu.

- **DECISION:** Eine leere PostgreSQL-Datenbank kann ausschließlich aus der versionierten Migrationsbasis aufgebaut werden. Anwendungscode führt keine DDL aus. Prisma-Relationen, SQL-only-Constraints, FKs einschließlich Löschaktionen und erforderliche Indizes sind im tatsächlichen Datenbankkatalog überprüfbar.
- **DECISION:** Profilanlage mit gültigem eigenem Referenzdegree gelingt ohne jede Kontaktzeile. Alumni allein, fehlender Degree, fremder Reference Degree und NULL-Referenz scheitern; jeweils auch bei direkten SQL-Schreibzugriffen.
- **DECISION:** Referenzwechsel, Neuanlage und Ersatz eines Referenzdegree funktionieren in einer Transaktion. Löschen der einzigen Referenz ohne Ersatz scheitert beim Commit. Vollständige Alumni-Löschung funktioniert einschließlich aller abhängigen Zeilen. Ein Ownership-Wechsel kann weder alte Referenz noch Timeline ungültig zurücklassen.
- **DECISION:** Nebenläufige Referenzwechsel und konkurrierende Löschungen lassen keinen ungültigen Commit zu. Transaktionsfehler führen zu vollständigem Rollback; die Anwendung meldet keine erfolgreiche Speicherung vor dem Commit.
- **DECISION:** Timeline-Verweise auf fremde Degrees und CareerSteps, falsche Typen, beide oder keine Ziel-IDs sowie fehlende Ziele werden von PostgreSQL abgewiesen. Die ungenutzte nullable Hälfte eines gültigen Eintrags funktioniert.
- **DECISION:** Position 0, negative/NULL-Positionen, doppelte Positionen und wiederholte Stationsverweise werden abgewiesen. Positive Lücken, ein Mindestwert größer als 1 nach Bearbeitung, fehlende TimelineItems sowie überlappende Stationsjahre sind gültig. Ein atomarer Reihenfolgetausch funktioniert ohne Abschalten von Constraints.
- **DECISION:** Umgekehrte bekannte Jahresgrenzen, Werte außerhalb 1..9999 und widersprüchliche Status-/Endjahreskombinationen werden abgewiesen. Unbekannte Start-/Endjahre, ausdrücklich laufende Phasen und Abschlüsse mit unbekanntem Abschlussjahr funktionieren nach Abschnitt 10.
- **DECISION:** Ein zweites Program mit derselben Institution, demselben Namen und NULL-Fakultät scheitert; dasselbe Programlabel an einer anderen Institution gelingt. Degree kann nicht zugleich Program und direkte Institution speichern. Unbekannte Katalogzuordnungen benötigen keine erfundenen Stammdaten.
- **DECISION:** Unterschiedliche Institutionen und Organisationen dürfen gleiche Namen beziehungsweise Orte besitzen. Kein Import führt sie allein deshalb automatisch zusammen. Bestätigte kanonische Zuordnungen werden bei Wiederaufnahme wiederverwendet.
- **DECISION:** Bachelor/Master/Promotion, Ausbildung, Auslandssemester, Praktikum, Werkstudententätigkeit, Ehrenamt, Beschäftigung, Selbstständigkeit sowie parallele Phasen lassen sich ohne doppelte Darstellung desselben Sachverhalts zuordnen. Bildungsquellen werden nach Semantik und nicht nach Providerobjekttyp normalisiert.
- **DECISION:** Kontaktdaten können nachträglich ergänzt und separat gelöscht werden. Kontaktfreigabe und analytische Verarbeitung bleiben getrennt. Analytische Abfragen benötigen keinen Join auf die operative Ebene; Logs/Importfehler enthalten keine Rohprofile.
- **DECISION:** Alumni enthält keine direkten Identifikatoren, Providerkennungen oder Dateiverweise. Eine Profil-Gesamtlöschung entfernt auch Kontakt- und Consent-Zeilen; temporäre Verarbeitung wird entsprechend bereinigt. Gemeinsam genutzte Katalogeinträge bleiben erhalten und enthalten keine kopierten persönlichen Quelldaten.
- **DECISION:** Kataloglöschung mit Referenzen scheitert kontrolliert. Bewusste Katalogkorrekturen verlieren weder Stationsdaten noch Zuordnungen unbemerkt. Technische Zeitpunkte werden von allen vorgesehenen Schreibwegen gepflegt.
- **DECISION:** Vor produktivem Betrieb sind OQ-1 und OQ-2 beantwortet. OQ-3 und OQ-4 dürfen nur unter den dokumentierten Einschränkungen offenbleiben. Spätere automatisierte Nachweise verwenden ausschließlich neu erzeugte synthetische Daten und keine persönlichen Fixtures.
