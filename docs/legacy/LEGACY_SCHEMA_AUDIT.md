Die Prüfung ist abgeschlossen. Die Migration enthält den typabhängigen XOR-CHECK für Timeline-Verweise und den partiellen Unique-Index für Referenzabschlüsse. Der zusätzliche Trigger hat jedoch Lücken und kann Löschungen blockieren. Mehrere im Prisma-Schema deklarierte Indizes fehlen außerdem in den eingecheckten Migrationen; ich kennzeichne deshalb Zieldefinition und SQL-Nachweis getrennt. Dateien wurden nicht geändert.
**Das kanonische Target-Schema besteht aus den sieben genannten Modellen in `prisma/schema.prisma`, ergänzt um SQL-Regeln aus den Migrationen.** Prisma-Schema und Migrationen sind allerdings nicht vollständig deckungsgleich. Insbesondere ist „genau ein Reference Degree pro Alumni“ durch den vorhandenen Trigger **nicht lückenlos abgesichert**.

Die folgende Spezifikation beschreibt den Repository-Stand. Der tatsächliche Zustand einer produktiven PostgreSQL-Datenbank wurde nicht abgefragt. Keine Dateien wurden geändert; Dumps, Fixtures und personenbezogene Datensätze wurden nicht untersucht.

Als Quellen werden nachfolgend verwendet:

| Kürzel | Exakte Datei |
|---|---|
| **S** | prisma/schema.prisma |
| **T** | prisma/migrations/20260508120000\_timeline\_refactor/migration.sql |
| **R** | prisma/migrations/20260508143000\_enforce\_exactly\_one\_reference\_degree/migration.sql |
| **P** | prisma/migrations/20251220120000\_add\_missing\_columns\_postgres/migration.sql |
| **E** | lib/ensureSchema.ts |

**A. Aktuelles Target-Schema**

Die Datenquelle ist PostgreSQL (**S**, Zeilen 5–9). Es gibt bei den sieben Modellen keine `@map`\-/`@@map`\-Umbenennungen: Tabellen- und Spaltennamen entsprechen den Modell- und Feldnamen.

„Pflicht“ bedeutet nachfolgend `NOT NULL`. Ein Pflichtfeld mit Default muss beim Anlegen nicht ausdrücklich übergeben werden. Alle nicht ausdrücklich genannten Defaults fehlen.

**Gemeinsame Felder aller sieben Modelle**

Diese drei Spalten gehören zu **jeder** der sieben Tabellen:

| Feld | Prisma-Typ | PostgreSQL-Zieltyp | Pflicht | Default / Verhalten |
|---|---|---|---|---|
| `id` | `Int` | `INTEGER`, automatisch generiert | Ja | `@id @default(autoincrement())`; neue Tabellen in **T** verwenden `SERIAL PRIMARY KEY` |
| `createdAt` | `DateTime` | `TIMESTAMP(3)` ohne Zeitzone | Ja | `now()`; in **T** `DEFAULT CURRENT_TIMESTAMP` |
| `updatedAt` | `DateTime` | `TIMESTAMP(3)` ohne Zeitzone | Ja | Prisma `@updatedAt`; kein SQL-Default und kein eigener Update-Trigger definiert |

`@updatedAt` ist Prisma-Verhalten. Direkte SQL-Schreibzugriffe müssen `updatedAt` selbst setzen beziehungsweise aktualisieren.

Die PostgreSQL-Typen für `Alumni` und die übernommenen Basisfelder von `CareerStep` sind hier die **Zielabbildung des aktuellen Prisma-Schemas**. Die eingecheckten frühen Erstellungsmigrationen dieser Tabellen verwenden noch SQLite-Syntax; sie belegen keine vollständig rekonstruierbare PostgreSQL-Baseline.

**Alumni** — zusätzlich zu den gemeinsamen Feldern; Quelle: **S**, Zeilen 36–53.

| Feld | Prisma-Typ | PostgreSQL-Typ | Pflicht | Weitere Regel |
|---|---|---|---|---|
| `code` | `String?` | `TEXT` | Nein | Unique |
| `fullName` | `String` | `TEXT` | Ja | — |
| `email` | `String` | `TEXT` | Ja | Unique; zusätzlicher normaler Index |
| `linkedInId` | `String?` | `TEXT` | Nein | Unique im Target |
| `cvFileUrl` | `String?` | `TEXT` | Nein | Keine FK-Beziehung |

**Degree** — zusätzlich zu den gemeinsamen Feldern; Quellen: **S**, Zeilen 93–117; **T**, Zeilen 33–45.

| Feld | Prisma-Typ | PostgreSQL-Typ | Pflicht | Weitere Regel |
|---|---|---|---|---|
| `alumniId` | `Int` | `INTEGER` | Ja | FK → `Alumni.id` |
| `institutionId` | `Int?` | `INTEGER` | Nein | FK → `Institution.id` |
| `programId` | `Int?` | `INTEGER` | Nein | FK → `Program.id` |
| `level` | `DegreeLevel` | Enum `"DegreeLevel"` | Ja | Kein Default |
| `title` | `String?` | `TEXT` | Nein | — |
| `fieldOfStudy` | `String?` | `TEXT` | Nein | — |
| `graduationYear` | `Int?` | `INTEGER` | Nein | Keine Jahresbereichsprüfung |
| `isReference` | `Boolean` | `BOOLEAN` | Ja | Default `false`; partieller Unique-Index und Constraint-Trigger |

**CareerStep** — zusätzlich zu den gemeinsamen Feldern; Quellen: **S**, Zeilen 119–147; **T**, Zeilen 58–80.

| Feld | Prisma-Typ | PostgreSQL-Typ | Pflicht | Weitere Regel |
|---|---|---|---|---|
| `alumniId` | `Int` | `INTEGER` | Ja | FK → `Alumni.id` |
| `organisationId` | `Int?` | `INTEGER` | Nein | FK → `Organisation.id` |
| `type` | `CareerStepType` | Enum `"CareerStepType"` | Ja | Kein Default |
| `roleTitle` | `String?` | `TEXT` | Nein | — |
| `roleCategory` | `String?` | `TEXT` | Nein | — |
| `industry` | `String?` | `TEXT` | Nein | — |
| `functionArea` | `String?` | `TEXT` | Nein | — |
| `location` | `String?` | `TEXT` | Nein | — |
| `startYear` | `Int?` | `INTEGER` | Nein | — |
| `endYear` | `Int?` | `INTEGER` | Nein | — |
| `note` | `String?` | `TEXT` | Nein | — |

Es gibt keinen SQL-CHECK für `startYear <= endYear` und keinen CHECK für zulässige Jahresbereiche.

**AlumniTimelineItem** — zusätzlich zu den gemeinsamen Feldern; Quellen: **S**, Zeilen 149–168; **T**, Zeilen 47–56.

| Feld | Prisma-Typ | PostgreSQL-Typ | Pflicht | Weitere Regel |
|---|---|---|---|---|
| `alumniId` | `Int` | `INTEGER` | Ja | FK → `Alumni.id` |
| `type` | `TimelineItemType` | Enum `"TimelineItemType"` | Ja | Kein Default |
| `position` | `Int` | `INTEGER` | Ja | Gemeinsam mit `alumniId` unique; kein Default |
| `degreeId` | `Int?` | `INTEGER` | Bedingt | Bei `type = DEGREE` zwingend gesetzt |
| `careerStepId` | `Int?` | `INTEGER` | Bedingt | Bei `type = CAREER_STEP` zwingend gesetzt |

Die beiden Ziel-FKs sind auf Spaltenebene nullable. Ihre bedingte Pflicht beziehungsweise ihr Ausschluss wird ausschließlich durch den SQL-CHECK geregelt.

**Program** — zusätzlich zu den gemeinsamen Feldern; Quellen: **S**, Zeilen 66–77; **T**, Zeilen 14–21.

| Feld | Prisma-Typ | PostgreSQL-Typ | Pflicht | Weitere Regel |
|---|---|---|---|---|
| `name` | `String` | `TEXT` | Ja | Zusammengesetztes Unique mit `faculty` |
| `faculty` | `String?` | `TEXT` | Nein | Zusammengesetztes Unique mit `name` |

**Institution** — zusätzlich zu den gemeinsamen Feldern; Quellen: **S**, Zeilen 55–64; **T**, Zeilen 6–12.

| Feld | Prisma-Typ | PostgreSQL-Typ | Pflicht | Weitere Regel |
|---|---|---|---|---|
| `name` | `String` | `TEXT` | Ja | Unique |
| `location` | `String?` | `TEXT` | Nein | — |

**Organisation** — zusätzlich zu den gemeinsamen Feldern; Quellen: **S**, Zeilen 79–91; **T**, Zeilen 23–31.

| Feld | Prisma-Typ | PostgreSQL-Typ | Pflicht | Weitere Regel |
|---|---|---|---|---|
| `name` | `String` | `TEXT` | Ja | Zusammengesetztes Unique mit `location` |
| `location` | `String?` | `TEXT` | Nein | Zusammengesetztes Unique mit `name` |
| `sector` | `String?` | `TEXT` | Nein | — |

Für die Textfelder sind keine Längenbegrenzungen, Format-CHECKs oder Nichtleer-CHECKs definiert. Insbesondere bedeutet `NOT NULL` bei Textfeldern nicht „nicht leer“.

**Relationsfelder im Prisma-Modell**

Diese Felder gehören zur Prisma-API, sind aber **keine zusätzlichen Datenbankspalten**:

| Modell | Relationsfelder |
|---|---|
| `Alumni` | `degrees: Degree[]`, `careerSteps: CareerStep[]`, `timelineItems: AlumniTimelineItem[]` |
| `Degree` | `alumni: Alumni`, `institution: Institution?`, `program: Program?`, `timelineItems: AlumniTimelineItem[]` |
| `CareerStep` | `alumni: Alumni`, `organisation: Organisation?`, `timelineItems: AlumniTimelineItem[]` |
| `AlumniTimelineItem` | `alumni: Alumni`, `degree: Degree?`, `careerStep: CareerStep?` |
| `Program` | `degrees: Degree[]` |
| `Institution` | `degrees: Degree[]` |
| `Organisation` | `careerSteps: CareerStep[]` |

Quelle: **S**, jeweilige Modellblöcke. Es gibt keine zusätzliche Relationstabelle.

**Enums**

Alle Werte sind exakt und einschließlich Großschreibung angegeben:

| Enum | Werte |
|---|---|
| `DegreeLevel` | `BACHELOR`, `MASTER`, `PHD`, `CERTIFICATE`, `DIPLOMA`, `OTHER` |
| `CareerStepType` | `EMPLOYMENT`, `INTERNSHIP`, `EDUCATION`, `VOCATIONAL_TRAINING`, `VOLUNTEERING`, `SELF_EMPLOYMENT`, `UNEMPLOYED`, `OTHER` |
| `TimelineItemType` | `DEGREE`, `CAREER_STEP` |

Prisma-Definition: **S**, Zeilen 11–34. Native PostgreSQL-Enum-Typen: **T**, Zeilen 1–4 (prisma/migrations/20260508120000\_timeline\_refactor/migration.sql:1).

**Primärschlüssel**

Alle sieben Tabellen besitzen ausschließlich den einspaltigen Primärschlüssel `id`. Keine besitzt einen zusammengesetzten Primärschlüssel.

Die PostgreSQL-Zielnamen sind:

| Tabelle | PK-Name |
|---|---|
| `Alumni` | `Alumni_pkey` |
| `Degree` | `Degree_pkey` |
| `CareerStep` | `CareerStep_pkey` |
| `AlumniTimelineItem` | `AlumniTimelineItem_pkey` |
| `Program` | `Program_pkey` |
| `Institution` | `Institution_pkey` |
| `Organisation` | `Organisation_pkey` |

Diese Namen folgen der PostgreSQL-/Prisma-Namenskonvention. **T** erstellt die fünf neuen Tabellen mit unbenanntem `PRIMARY KEY`; `Alumni` und `CareerStep` werden dort lediglich verändert. Jeder PK besitzt einen zugehörigen eindeutigen Index.

**Foreign Keys und referenzielle Aktionen**

| FK-Name | Referenz | `ON DELETE` im Target | `ON UPDATE` im Target | Beleg |
|---|---|---|---|---|
| `Degree_alumniId_fkey` | `Degree.alumniId → Alumni.id` | `CASCADE` | `CASCADE` | **T:117** |
| `Degree_institutionId_fkey` | `Degree.institutionId → Institution.id` | `SET NULL` | `CASCADE` | **T:118** |
| `Degree_programId_fkey` | `Degree.programId → Program.id` | `SET NULL` | `CASCADE` | **T:119** |
| `CareerStep_alumniId_fkey` | `CareerStep.alumniId → Alumni.id` | `CASCADE` | `CASCADE` | **S:137**; Migrationsabweichung unten |
| `CareerStep_organisationId_fkey` | `CareerStep.organisationId → Organisation.id` | `SET NULL` | `CASCADE` | **T:120** |
| `AlumniTimelineItem_alumniId_fkey` | `AlumniTimelineItem.alumniId → Alumni.id` | `CASCADE` | `CASCADE` | **T:121** |
| `AlumniTimelineItem_degreeId_fkey` | `AlumniTimelineItem.degreeId → Degree.id` | `CASCADE` | `CASCADE` | **T:122** |
| `AlumniTimelineItem_careerStepId_fkey` | `AlumniTimelineItem.careerStepId → CareerStep.id` | `CASCADE` | `CASCADE` | **T:123** |

Die SQL-Definitionen stehen gesammelt in **T**, ab Zeile 117 (prisma/migrations/20260508120000\_timeline\_refactor/migration.sql:117). Die dort angelegten FKs sind nicht als `DEFERRABLE` deklariert.

`CareerStep.alumniId` verlangt im aktuellen Prisma-Schema ausdrücklich `onDelete: Cascade`; das nicht ausgeschriebene `onUpdate` entspricht dem Prisma-Default `Cascade`. Die alte FK-Definition verwendet dagegen `ON DELETE RESTRICT ON UPDATE CASCADE`. Die Target-Migration ersetzt diesen FK nicht. Beleg für diese Abweichung: prisma/migrations/20251130120000\_add\_step\_type/migration.sql:21.

Damit ist `CASCADE` hier eindeutig die **aktuelle Zieldefinition**, aber nicht durch eine entsprechende PostgreSQL-Änderungsmigration nachgewiesen.

**Unique Constraints und eindeutige Indizes**

Zusätzlich zu den Primärschlüsseln gelten:

| Name | Tabelle / Spalten | Target / SQL-Nachweis |
|---|---|---|
| `Alumni_code_key` | `Alumni(code)` | **S:41**; PostgreSQL-DDL **P:32–42**; zusätzlich **E:7** |
| `Alumni_email_key` | `Alumni(email)` | **S:43**; Anlage bereits in früher SQLite-Migration, siehe unten |
| `Alumni_linkedInId_key` | `Alumni(linkedInId)` | **S:44**; keine entsprechende Anlage in den eingecheckten Migrationen |
| `Institution_name_key` | `Institution(name)` | **S:60**; SQL-`UNIQUE` in **T:10** |
| `Program_name_faculty_key` | `Program(name, faculty)` | **S:76**; benannter SQL-Constraint **T:20** |
| `Organisation_name_location_key` | `Organisation(name, location)` | **S:90**; benannter SQL-Constraint **T:30** |
| `AlumniTimelineItem_alumniId_position_key` | `AlumniTimelineItem(alumniId, position)` | **S:164**; `CREATE UNIQUE INDEX` **T:154** |
| `Degree_reference_per_alumni` | `Degree(alumniId) WHERE isReference = true` | Ausschließlich SQL: **T:111** |

Die frühere Anlage von `Alumni_email_key` ist in prisma/migrations/20251125172215\_init\_alumni\_career\_steps/migration.sql:49 enthalten. Dies ist keine PostgreSQL-Baseline.

Die SQL-Unterscheidung ist relevant: `Institution`, `Program` und `Organisation` erhalten `UNIQUE`\-Constraints mit zugehörigen Indizes. Für Timeline-Reihenfolge und Referenzabschluss werden ausdrücklich **Unique-Indizes** angelegt.

Keine dieser Eindeutigkeitsregeln ist als aufschiebbar definiert.

Bei nullable Spalten gilt die normale PostgreSQL-NULL-Semantik; `NULLS NOT DISTINCT` wird nirgends festgelegt:

- Mehrere Alumni dürfen `code = NULL` beziehungsweise `linkedInId = NULL` besitzen.
- Mehrere Programme dürfen denselben `name` mit `faculty = NULL` besitzen.
- Mehrere Organisationen dürfen denselben `name` mit `location = NULL` besitzen.

**Normale, nicht eindeutige Indizes**

Alle folgenden Indizes sind im aktuellen Prisma-Target enthalten:

| Name | Tabelle / Spalten | Beleg in **S** | Anlage in Migrationen |
|---|---|---|---|
| `Alumni_email_idx` | `Alumni(email)` | 52 | Nicht vorhanden |
| `Degree_alumniId_idx` | `Degree(alumniId)` | 114 | **T:152** |
| `Degree_level_idx` | `Degree(level)` | 115 | Nicht vorhanden |
| `Degree_graduationYear_idx` | `Degree(graduationYear)` | 116 | Nicht vorhanden |
| `CareerStep_alumniId_idx` | `CareerStep(alumniId)` | 142 | **T:153** |
| `CareerStep_type_idx` | `CareerStep(type)` | 143 | Nicht vorhanden |
| `CareerStep_industry_idx` | `CareerStep(industry)` | 144 | Nicht vorhanden |
| `CareerStep_roleCategory_idx` | `CareerStep(roleCategory)` | 145 | Nicht vorhanden |
| `CareerStep_startYear_idx` | `CareerStep(startYear)` | 146 | Nicht vorhanden |
| `AlumniTimelineItem_alumniId_type_idx` | `AlumniTimelineItem(alumniId, type)` | 165 | Nicht vorhanden |
| `AlumniTimelineItem_degreeId_idx` | `AlumniTimelineItem(degreeId)` | 166 | Nicht vorhanden |
| `AlumniTimelineItem_careerStepId_idx` | `AlumniTimelineItem(careerStepId)` | 167 | Nicht vorhanden |

Die Namen ohne explizite SQL-Anlage sind die aus Prisma abgeleiteten Target-Namen. Die Indizes verwenden den Standard-Indextyp B-tree.

Es sind insbesondere **keine zusätzlichen Indizes** auf `Degree.institutionId`, `Degree.programId` oder `CareerStep.organisationId` deklariert. Ein FK erzeugt auf seiner referenzierenden Spalte nicht automatisch einen Index.

**Alle SQL-only CHECK Constraints**

Für die sieben Target-Modelle ist genau ein expliziter `CHECK` in den Migrationen definiert:

```
CONSTRAINT "timeline_item_exactly_one_ref" CHECK (
  ("type" = 'DEGREE'
    AND "degreeId" IS NOT NULL
    AND "careerStepId" IS NULL)
  OR
  ("type" = 'CAREER_STEP'
    AND "careerStepId" IS NOT NULL
    AND "degreeId" IS NULL)
)
```

Quelle: **T**, Zeilen 112–115 (prisma/migrations/20260508120000\_timeline\_refactor/migration.sql:112).

Dieser CHECK sichert gemeinsam mit `type NOT NULL`:

- Genau einer der beiden Ziel-FKs ist gesetzt.
- Der gesetzte FK passt zum `TimelineItemType`.
- Weder beide gesetzten noch beide leeren Ziel-FKs sind zulässig.

Die FKs sichern zusätzlich die Existenz des jeweiligen Zielobjekts.

**Nicht abgesichert** wird, dass `AlumniTimelineItem.alumniId` mit `Degree.alumniId` beziehungsweise `CareerStep.alumniId` übereinstimmt. Es gibt dafür weder zusammengesetzte FKs noch einen zusätzlichen Trigger.

**Alle partiellen Unique-Indizes**

Für die Target-Modelle existiert genau einer:

```
CREATE UNIQUE INDEX "Degree_reference_per_alumni"
ON "Degree" ("alumniId")
WHERE "isReference" = true;
```

Quelle: **T**, Zeile 111 (prisma/migrations/20260508120000\_timeline\_refactor/migration.sql:111).

Er garantiert **höchstens einen** Referenzabschluss je `alumniId`. Beliebig viele Abschlüsse mit `isReference = false` bleiben zulässig. Der Index garantiert allein keinen vorhandenen Referenzabschluss.

**Alle ausdrücklich definierten Trigger und Funktionen**

Für die sieben Target-Modelle enthalten die Migrationen genau eine benutzerdefinierte Triggerfunktion und einen Constraint-Trigger. PostgreSQL-interne FK-Trigger sind hiervon zu unterscheiden.

Die Funktion lautet:

```
CREATE OR REPLACE FUNCTION enforce_exactly_one_reference_degree()
RETURNS TRIGGER AS $$
DECLARE
  v_alumni_id INTEGER;
  v_ref_count INTEGER;
  v_degree_count INTEGER;
BEGIN
  v_alumni_id := COALESCE(
    NEW."alumniId", OLD."alumniId", NEW.id, OLD.id
  );

  SELECT COUNT(*) INTO v_degree_count
  FROM "Degree" d
  WHERE d."alumniId" = v_alumni_id;

  SELECT COUNT(*) INTO v_ref_count
  FROM "Degree" d
  WHERE d."alumniId" = v_alumni_id
    AND d."isReference" = true;

  IF v_degree_count = 0 OR v_ref_count <> 1 THEN
    RAISE EXCEPTION
      'Alumni % must have exactly one reference degree (degrees=%, references=%)',
      v_alumni_id, v_degree_count, v_ref_count;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
```

Quelle: **R**, Zeilen 1–19 (prisma/migrations/20260508143000\_enforce\_exactly\_one\_reference\_degree/migration.sql:1).

Der dazugehörige Trigger:

```
CREATE CONSTRAINT TRIGGER degree_exactly_one_reference_check
AFTER INSERT OR UPDATE OR DELETE ON "Degree"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION enforce_exactly_one_reference_degree();
```

Quelle: **R**, Zeilen 21–25 (prisma/migrations/20260508143000\_enforce\_exactly\_one\_reference\_degree/migration.sql:21).

Sein Verhalten:

- Er reagiert ausschließlich auf `INSERT`, `UPDATE` und `DELETE` an `Degree`, jeweils pro Zeile.
- Die Prüfung ist standardmäßig bis zum Transaktionsende aufgeschoben.
- Sie kann durch `SET CONSTRAINTS` früher ausgelöst werden.
- Sie verlangt für die ausgewählte Alumni-ID mindestens einen Abschluss und exakt einen Referenzabschluss.
- Jeder `UPDATE` löst sie aus, auch wenn `alumniId` und `isReference` unverändert bleiben.
- Der partielle Unique-Index bleibt unabhängig davon sofort wirksam.

Der `DO $$ ... $$`\-Block in **P**, Zeilen 32–42, legt bedingt `Alumni_code_key` an. Er ist ein anonymer Ausführungsblock, keine dauerhaft gespeicherte Funktion.

**Bewertung der drei zentralen Invarianten**

| Anforderung | Technische Absicherung | Tatsächliche Reichweite |
|---|---|---|
| Genau ein Reference Degree je Alumni | Partieller Unique-Index **T:111** und deferred Constraint-Trigger **R** | Höchstens einer zuverlässig; Existenzprüfung mit Lücken |
| Timeline referenziert genau Degree oder CareerStep | CHECK **T:112–115**, Enum, `NOT NULL`, FKs **T:122–123** | Exklusivität, Typzuordnung und Existenz abgesichert; gleicher Alumni-Eigentümer nicht abgesichert |
| Eindeutige Timeline-Reihenfolge | Unique-Index `(alumniId, position)` **T:154** | Keine doppelte Position innerhalb eines Alumni |

Bei der Reference-Degree-Regel bestehen konkret folgende Grenzen:

1. **Alumni ohne Abschlüsse werden nicht generell verhindert.**  
   Auf `Alumni` existiert kein entsprechender Trigger. Ein Alumni-Insert ohne einen Degree-Schreibvorgang löst die Prüfung nicht aus.
2. **Ein Wechsel von `Degree.alumniId` prüft nur die neue Alumni-ID.**  
   `COALESCE` bevorzugt `NEW.alumniId`. Der bisherige Alumni kann dadurch seinen einzigen Referenzabschluss verlieren, ohne dass dieser Trigger dessen Endzustand prüft.
3. **Das kaskadierende Löschen eines Alumni mit Abschlüssen kann scheitern.**  
   Die kaskadierten Degree-Löschungen lösen den Trigger aus. Dieser findet anschließend null Abschlüsse und wirft eine Exception. Er prüft nicht, ob der zugehörige Alumni ebenfalls gelöscht wurde.
4. **Die Triggeranlage validiert keine bestehenden Datensätze rückwirkend.**  
   **R** enthält keine vollständige Bestandsprüfung. Der zuvor angelegte Unique-Index prüft bei seiner Erstellung zwar Mehrfachreferenzen, aber keine fehlenden Referenzen.
5. **Ein Referenzwechsel muss den sofort wirksamen Unique-Index berücksichtigen.**  
   Innerhalb einer Transaktion kann zunächst die bisherige Referenz deaktiviert und anschließend die neue aktiviert werden. Eine zwischenzeitlich doppelte Referenz ist trotz deferred Trigger unzulässig.

Für die Timeline-Reihenfolge gilt zusätzlich:

- Positionen sind nur **je Alumni**, nicht global eindeutig.
- Es gibt keinen CHECK für `position > 0`.
- Es gibt keine Pflicht zu lückenlosen oder bei 1 beginnenden Positionen.
- Es gibt keine automatische Positionsvergabe.
- Es gibt keine Eindeutigkeitsregel auf `degreeId` oder `careerStepId`: Dasselbe Zielobjekt darf mehrfach in der Timeline vorkommen.
- Kein Constraint verlangt überhaupt einen Timeline-Eintrag für jeden Degree oder CareerStep.

**Abweichungen zwischen Target und eingechecktem SQL**

Für eine technische Übernahme müssen diese Unterschiede ausdrücklich erhalten bleiben:

| Punkt | Aktuelle Zieldefinition | Nachweis in Migrationen |
|---|---|---|
| `Alumni.linkedInId` eindeutig | Ja, **S:44** | **T:135** legt nur die Spalte an; Unique-Index fehlt |
| Zehn normale Indizes | In **S** deklariert | Keine entsprechende Anlage; siehe Indexliste |
| `CareerStep.alumniId ON DELETE CASCADE` | Ja, **S:137** | Keine Umstellung des früheren `RESTRICT`\-FK |
| Timeline-XOR | Nicht in Prisma ausdrückt | Ausschließlich **T:112–115** |
| Partieller Referenz-Unique-Index | Nicht in Prisma ausdrückt | Ausschließlich **T:111** |
| Reference-Degree-Trigger | Nicht in Prisma ausdrückt | Ausschließlich **R** |
| PostgreSQL-Baseline | Provider PostgreSQL | Frühe Erstellungsmigrationen enthalten SQLite-Syntax |

Die Laufzeit-Ergänzung in **E**, Zeilen 5–8, behandelt ausschließlich `Alumni.code` und dessen Unique-Index. Sie ergänzt keine der fehlenden Timeline- oder Reference-Degree-Regeln.

Daher wäre weder die alleinige Übernahme von `schema.prisma` noch die Behauptung einer vollständig konsistenten PostgreSQL-Migrationskette eine exakte Beschreibung dieses Repository-Stands.

**B. Legacy-/historische Felder, die nicht übernommen werden sollen**

Maßgeblich ist die explizite Bereinigung in der aktuellen Target-Migration. Die folgenden Felder sind **kein Bestandteil** des oben spezifizierten Targets:

| Ehemaliger Ort | Ausgeschlossene Felder |
|---|---|
| `Alumni` | `faculty`, `bachelorProgramId`, `baDegree`, `baYear`, `maDegree`, `maYear`, `phdDegree`, `phdYear`, `referenceDegreeId` |
| `CareerStep` | `afterBachelor`, `stepType`, `organisation`, `branchCategory`, `jobCategory`, `positionTitle`, `educationField`, `predecessorId`, `successorId`, `orderIndex` |

Exakte Entfernung: **T**, Zeilen 125–150 (prisma/migrations/20260508120000\_timeline\_refactor/migration.sql:125).

Auch die Tabellen `ReferenceDegree` und `BachelorProgram` werden ausdrücklich entfernt (**T:138–139**). Ihre früheren Felder, Constraints und Defaults gehören nicht zum Target.

Für die Übernahme bedeutet das:

- Abschlussdaten liegen in `Degree`.
- Die Referenzkennzeichnung liegt in `Degree.isReference`.
- Programme liegen in `Program`.
- Organisationen werden über `CareerStep.organisationId` referenziert.
- Die Reihenfolge liegt ausschließlich in `AlumniTimelineItem.position`.
- `Program.faculty` ist ein **aktuelles** Feld; ausgeschlossen ist das frühere `Alumni.faculty`.

Frühere Modelle und Importformate sind keine zusätzliche Quelle für Target-Felder. Das weiterhin separat im Prisma-Schema vorhandene Modell `CvUpload` liegt außerhalb der ausdrücklich auf sieben Modelle begrenzten Analyse; daraus folgt keine Einstufung als deprecated.