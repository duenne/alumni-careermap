import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
let db: PoolClient;
type Values = Record<string, string | number | null>;

// Technical records exist only in a rolled-back transaction; no stored fixtures.
async function insert(table: string, values: Values = {}) {
  const entries = Object.entries(values);
  const sql = entries.length
    ? `INSERT INTO "${table}" (${entries.map(([key]) => `"${key}"`).join(", ")}) VALUES (${entries.map((_, i) => `$${i + 1}`).join(", ")}) RETURNING *`
    : `INSERT INTO "${table}" DEFAULT VALUES RETURNING *`;
  return (await db.query(sql, entries.map(([, value]) => value))).rows[0];
}

async function rejectsSql(sql: string, values: unknown[], code: string, constraint?: string) {
  await db.query("SAVEPOINT negative_case");
  try {
    await expect(db.query(sql, values)).rejects.toMatchObject({ code, ...(constraint ? { constraint } : {}) });
  } finally {
    await db.query("ROLLBACK TO SAVEPOINT negative_case");
    await db.query("RELEASE SAVEPOINT negative_case");
  }
}

async function context() {
  const institution = await insert("Institution", { name: "Institution A" });
  const program = await insert("Program", { institutionId: institution.id, name: "Program A" });
  const survey = await insert("Survey", { name: "Survey A", referenceProgramId: program.id });
  const alumni = await insert("Alumni");
  const degree = await insert("Degree", { alumniId: alumni.id, level: "BACHELOR", status: "COMPLETED", programId: program.id });
  return { institution, program, survey, alumni, degree };
}

beforeAll(async () => {
  const version = await pool.query("SHOW server_version_num");
  expect(Math.floor(Number(version.rows[0].server_version_num) / 10000)).toBe(17);
});
beforeEach(async () => { db = await pool.connect(); await db.query("BEGIN"); });
afterEach(async () => { await db.query("ROLLBACK"); db.release(); });
afterAll(async () => { await pool.end(); });

describe("Phase A and B.1 database contract", () => {
  it("contains only seven domain tables and pseudonymized Alumni columns", async () => {
    const tables = await db.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations' ORDER BY tablename");
    expect(tables.rows.map(row => row.tablename)).toEqual(["Alumni", "Degree", "Institution", "Organisation", "Program", "Survey", "SurveyResponse"]);
    const columns = await db.query("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Alumni' ORDER BY ordinal_position");
    expect(columns.rows.map(row => row.column_name)).toEqual(["id", "createdAt", "updatedAt"]);
  });

  it("uses UUID PKs, required UTC-capable timestamps, and no custom triggers", async () => {
    const { institution, program, survey, alumni, degree } = await context();
    const response = await insert("SurveyResponse", { surveyId: survey.id, alumniId: alumni.id, referenceDegreeId: degree.id, confirmedAt: new Date().toISOString() });
    const organisation = await insert("Organisation", { name: "Organisation A" });
    for (const row of [institution, program, survey, alumni, degree, response, organisation]) {
      expect(row.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(row.createdAt).toBeInstanceOf(Date);
      expect(row.updatedAt).toBeInstanceOf(Date);
    }
    const columns = await db.query("SELECT data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND column_name IN ('createdAt', 'updatedAt', 'confirmedAt')");
    expect(columns.rows).toHaveLength(15);
    for (const row of columns.rows) expect(row).toEqual({ data_type: "timestamp with time zone", is_nullable: "NO" });
    const triggers = await db.query("SELECT tgname FROM pg_trigger WHERE NOT tgisinternal AND tgrelid IN (SELECT oid FROM pg_class WHERE relnamespace = 'public'::regnamespace)");
    expect(triggers.rows).toEqual([]);
  });

  it("defines exactly the normative enum values", async () => {
    for (const [type, labels] of Object.entries({
      SurveyStatus: ["DRAFT", "OPEN", "CLOSED"],
      DegreeLevel: ["BACHELOR", "MASTER", "PHD", "DIPLOMA", "CERTIFICATE", "OTHER"],
      DegreeStatus: ["IN_PROGRESS", "COMPLETED", "ENDED_WITHOUT_DEGREE", "UNKNOWN"],
    })) {
      const result = await db.query("SELECT enumlabel FROM pg_enum WHERE enumtypid = $1::regtype ORDER BY enumsortorder", [`"${type}"`]);
      expect(result.rows.map(row => row.enumlabel)).toEqual(labels);
    }
  });

  it.each(["Institution", "Program", "Survey", "Alumni", "Degree", "SurveyResponse"])("%s enforces UUID identity and required timestamps", async table => {
    const c = await context();
    await insert("SurveyResponse", { surveyId: c.survey.id, alumniId: c.alumni.id, referenceDegreeId: c.degree.id, confirmedAt: new Date().toISOString() });
    await rejectsSql(`UPDATE "${table}" SET id = 'invalid'`, [], "22P02");
    for (const column of ["id", "createdAt", "updatedAt"]) {
      await rejectsSql(`UPDATE "${table}" SET "${column}" = NULL`, [], "23502");
    }
    const second = await db.query(`SELECT id FROM "${table}" LIMIT 1`);
    if (table === "Alumni") await insert("Alumni");
    else if (table === "Institution") await insert("Institution", { name: "Institution B" });
    else return;
    await rejectsSql(`UPDATE "${table}" SET id = $1 WHERE id <> $1`, [second.rows[0].id], "23505");
  });
});

describe("Organisation", () => {
  it("contains only the normative fields and no placeholder records", async () => {
    const columns = await db.query("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Organisation' ORDER BY ordinal_position");
    expect(columns.rows.map(row => row.column_name)).toEqual(["id", "createdAt", "updatedAt", "name", "location", "sector"]);
    expect((await db.query('SELECT * FROM "Organisation"')).rows).toEqual([]);
  });

  it("creates with only a name, generating a UUID and required timestamps", async () => {
    const organisation = await insert("Organisation", { name: "Organisation A" });
    expect(organisation).toMatchObject({ name: "Organisation A", location: null, sector: null });
    expect(organisation.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(organisation.createdAt).toBeInstanceOf(Date);
    expect(organisation.updatedAt).toBeInstanceOf(Date);
  });

  it("creates with all optional fields", async () => {
    const values = { name: "Organisation A", location: "Location A", sector: "Sector A" };
    expect(await insert("Organisation", values)).toMatchObject(values);
  });

  it("rejects a missing name", async () => {
    await rejectsSql('INSERT INTO "Organisation" DEFAULT VALUES', [], "23502");
  });

  it.each(["name", "location", "sector"])("rejects empty and whitespace-only %s on insert and update", async column => {
    const organisation = await insert("Organisation", { name: "Organisation A" });
    for (const value of ["", " ", "\t\r\n", " \t\n"]) {
      const values = column === "name" ? [value] : ["Organisation B", value];
      const columns = column === "name" ? '"name"' : `"name", "${column}"`;
      const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");
      await rejectsSql(`INSERT INTO "Organisation" (${columns}) VALUES (${placeholders})`, values, "23514", `Organisation_${column}_nonblank`);
      await rejectsSql(`UPDATE "Organisation" SET "${column}" = $1 WHERE id = $2`, [value, organisation.id], "23514", `Organisation_${column}_nonblank`);
    }
  });

  it("accepts explicit NULL optional fields on insert and update", async () => {
    expect(await insert("Organisation", { name: "Organisation A", location: null, sector: null })).toMatchObject({ location: null, sector: null });
    const organisation = await insert("Organisation", { name: "Organisation B", location: "Location A", sector: "Sector A" });
    const updated = await db.query('UPDATE "Organisation" SET location = NULL, sector = NULL WHERE id = $1 RETURNING *', [organisation.id]);
    expect(updated.rows[0]).toMatchObject({ location: null, sector: null });
  });

  it("accepts duplicate names and identical name/location combinations on insert and update", async () => {
    const values = { name: "Organisation A", location: "Location A", sector: "Sector A" };
    const first = await insert("Organisation", values);
    const duplicate = await insert("Organisation", values);
    expect(duplicate.id).not.toBe(first.id);
    await insert("Organisation", { name: values.name, location: "Location B" });
    await insert("Organisation", { name: values.name });
    await insert("Organisation", { name: values.name });
    const other = await insert("Organisation", { name: "Organisation B", location: "Location B" });
    const updated = await db.query('UPDATE "Organisation" SET name = $1, location = $2, sector = $3 WHERE id = $4 RETURNING *', [values.name, values.location, values.sector, other.id]);
    expect(updated.rows[0]).toMatchObject(values);
  });

  it("enforces its UUID primary key", async () => {
    const first = await insert("Organisation", { name: "Organisation A" });
    const second = await insert("Organisation", { name: "Organisation B" });
    await rejectsSql('INSERT INTO "Organisation" (id, name) VALUES ($1, $2)', [first.id, "Organisation C"], "23505", "Organisation_pkey");
    await rejectsSql('UPDATE "Organisation" SET id = $1 WHERE id = $2', [first.id, second.id], "23505", "Organisation_pkey");
    await rejectsSql('INSERT INTO "Organisation" (id, name) VALUES ($1, $2)', ["invalid", "Organisation C"], "22P02");
    await rejectsSql('UPDATE "Organisation" SET id = $1 WHERE id = $2', ["invalid", first.id], "22P02");
  });

  it.each(["id", "createdAt", "updatedAt", "name"])("rejects NULL required %s on insert and update", async column => {
    const organisation = await insert("Organisation", { name: "Organisation A" });
    const columns = column === "name" ? '"name"' : `"name", "${column}"`;
    const values = column === "name" ? [null] : ["Organisation B", null];
    const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");
    await rejectsSql(`INSERT INTO "Organisation" (${columns}) VALUES (${placeholders})`, values, "23502");
    await rejectsSql(`UPDATE "Organisation" SET "${column}" = NULL WHERE id = $1`, [organisation.id], "23502");
  });
});

describe("Catalog and Survey", () => {
  it("requires Program institution and name, and a real Institution FK", async () => {
    await rejectsSql('INSERT INTO "Program" (name) VALUES ($1)', ["Program A"], "23502");
    await rejectsSql('INSERT INTO "Program" ("institutionId") VALUES ($1)', [randomUUID()], "23502");
    await rejectsSql('INSERT INTO "Program" (name, "institutionId") VALUES ($1, $2)', ["Program A", randomUUID()], "23503");
  });

  it("uses institution/name/faculty identity with NULLS NOT DISTINCT on insert and update", async () => {
    const { institution, program } = await context();
    const sql = 'INSERT INTO "Program" ("institutionId", name, faculty) VALUES ($1, $2, $3)';
    await rejectsSql(sql, [institution.id, program.name, null], "23505", "Program_institutionId_name_faculty_key");
    const withFaculty = await insert("Program", { institutionId: institution.id, name: program.name, faculty: "Faculty A" });
    await rejectsSql(sql, [institution.id, program.name, "Faculty A"], "23505");
    await rejectsSql('UPDATE "Program" SET faculty = NULL WHERE id = $1', [withFaculty.id], "23505");
    await insert("Program", { institutionId: institution.id, name: program.name, faculty: "Faculty B" });
    await insert("Program", { institutionId: institution.id, name: "Program B" });
    const other = await insert("Institution", { name: institution.name });
    await insert("Program", { institutionId: other.id, name: program.name });
  });

  it.each([
    ["Institution", "name", ""], ["Institution", "name", " \t\n"], ["Institution", "location", " "],
    ["Program", "name", ""], ["Program", "faculty", " "], ["Survey", "name", ""],
  ])("rejects blank %s.%s", async (table, column, value) => {
    await context();
    await rejectsSql(`UPDATE "${table}" SET "${column}" = $1`, [value], "23514");
  });

  it("requires Survey name/referenceProgram, defaults DRAFT, accepts only nonnull valid statuses", async () => {
    const { survey, program } = await context();
    expect(survey.status).toBe("DRAFT");
    await rejectsSql('INSERT INTO "Survey" (name) VALUES ($1)', ["Survey A"], "23502");
    await rejectsSql('INSERT INTO "Survey" ("referenceProgramId") VALUES ($1)', [program.id], "23502");
    await rejectsSql('UPDATE "Survey" SET "referenceProgramId" = $1', [randomUUID()], "23503");
    await rejectsSql('UPDATE "Survey" SET status = NULL', [], "23502");
    await rejectsSql('UPDATE "Survey" SET status = $1', ["INVALID"], "22P02");
    for (const status of ["DRAFT", "OPEN", "CLOSED"]) await db.query('UPDATE "Survey" SET status = $1', [status]);
  });
});

describe("Degree", () => {
  it("requires owner/level/status and enforces owner FK and enum values", async () => {
    const { degree } = await context();
    for (const column of ["alumniId", "level", "status"]) await rejectsSql(`UPDATE "Degree" SET "${column}" = NULL`, [], "23502");
    await rejectsSql('UPDATE "Degree" SET "alumniId" = $1', [randomUUID()], "23503");
    for (const column of ["level", "status"]) await rejectsSql(`UPDATE "Degree" SET "${column}" = $1`, ["INVALID"], "22P02");
    expect(degree.status).toBe("COMPLETED");
  });

  it("allows Program, direct Institution, or neither, never both, and checks catalog FKs", async () => {
    const { degree, institution } = await context();
    await rejectsSql('UPDATE "Degree" SET "institutionId" = $1', [institution.id], "23514");
    await db.query('UPDATE "Degree" SET "programId" = NULL, "institutionId" = $1', [institution.id]);
    await db.query('UPDATE "Degree" SET "institutionId" = NULL');
    for (const column of ["programId", "institutionId"]) await rejectsSql(`UPDATE "Degree" SET "${column}" = $1 WHERE id = $2`, [randomUUID(), degree.id], "23503");
  });

  it.each(["startYear", "endYear", "graduationYear"])("bounds %s to 1..9999, allowing NULL", async column => {
    await context();
    for (const value of [0, -1, 10000]) await rejectsSql(`UPDATE "Degree" SET "${column}" = $1`, [value], "23514");
    for (const value of [1, 9999, null]) await db.query(`UPDATE "Degree" SET "${column}" = $1`, [value]);
  });

  it("enforces known date order and permits equal or incomplete dates", async () => {
    await context();
    await rejectsSql('UPDATE "Degree" SET "startYear" = 2020, "endYear" = 2019', [], "23514");
    await rejectsSql('UPDATE "Degree" SET "startYear" = 2020, "graduationYear" = 2019', [], "23514");
    await rejectsSql('UPDATE "Degree" SET "endYear" = 2020, "graduationYear" = 2019', [], "23514");
    await db.query('UPDATE "Degree" SET "startYear" = 2020, "endYear" = 2020, "graduationYear" = 2020');
    await db.query('UPDATE "Degree" SET "startYear" = NULL, "endYear" = NULL, "graduationYear" = NULL');
  });

  it.each(["IN_PROGRESS", "UNKNOWN"])("%s forbids known end and graduation", async status => {
    await context();
    await db.query('UPDATE "Degree" SET status = $1, "startYear" = 2020', [status]);
    await rejectsSql('UPDATE "Degree" SET "endYear" = 2024', [], "23514");
    await rejectsSql('UPDATE "Degree" SET "graduationYear" = 2024', [], "23514");
  });

  it("ENDED_WITHOUT_DEGREE permits end but no graduation; COMPLETED permits unknown graduation", async () => {
    await context();
    await db.query('UPDATE "Degree" SET status = $1, "endYear" = 2024', ["ENDED_WITHOUT_DEGREE"]);
    await rejectsSql('UPDATE "Degree" SET "graduationYear" = 2024', [], "23514");
    await db.query('UPDATE "Degree" SET status = $1', ["COMPLETED"]);
  });

  it.each(["DIPLOMA", "OTHER"])("%s requires a nonblank title", async level => {
    const { alumni } = await context();
    await rejectsSql('INSERT INTO "Degree" ("alumniId", level, status) VALUES ($1, $2, $3)', [alumni.id, level, "UNKNOWN"], "23514");
    await insert("Degree", { alumniId: alumni.id, level, status: "UNKNOWN", title: "Academic qualification" });
  });

  it.each(["title", "fieldOfStudy"])("rejects blank optional %s", async column => {
    await context();
    await rejectsSql(`UPDATE "Degree" SET "${column}" = $1`, [" \t\n"], "23514");
  });
});

describe("SurveyResponse ownership and deletion", () => {
  async function responseContext() {
    const c = await context();
    const response = await insert("SurveyResponse", { surveyId: c.survey.id, alumniId: c.alumni.id, referenceDegreeId: c.degree.id, confirmedAt: new Date().toISOString() });
    return { ...c, response };
  }

  it("requires all response references and confirmedAt", async () => {
    await responseContext();
    for (const column of ["surveyId", "alumniId", "referenceDegreeId", "confirmedAt"]) await rejectsSql(`UPDATE "SurveyResponse" SET "${column}" = NULL`, [], "23502");
  });

  it("rejects missing references and another Alumni's Degree on insert and update", async () => {
    const { survey, alumni, degree } = await context();
    const other = await insert("Alumni");
    const sql = 'INSERT INTO "SurveyResponse" ("surveyId", "alumniId", "referenceDegreeId", "confirmedAt") VALUES ($1, $2, $3, now())';
    for (const ids of [[randomUUID(), alumni.id, degree.id], [survey.id, randomUUID(), degree.id], [survey.id, alumni.id, randomUUID()], [survey.id, other.id, degree.id]]) await rejectsSql(sql, ids, "23503");
    await insert("SurveyResponse", { surveyId: survey.id, alumniId: alumni.id, referenceDegreeId: degree.id, confirmedAt: new Date().toISOString() });
    await rejectsSql('UPDATE "SurveyResponse" SET "alumniId" = $1', [other.id], "23503", "SurveyResponse_alumniId_referenceDegreeId_fkey");
    await rejectsSql('UPDATE "Degree" SET "alumniId" = $1 WHERE id = $2', [other.id, degree.id], "23503");
  });

  it("allows one response per Alumni/Survey, another Survey, and atomic reference replacement", async () => {
    const { survey, alumni, degree, program } = await responseContext();
    const sql = 'INSERT INTO "SurveyResponse" ("surveyId", "alumniId", "referenceDegreeId", "confirmedAt") VALUES ($1, $2, $3, now())';
    await rejectsSql(sql, [survey.id, alumni.id, degree.id], "23505", "SurveyResponse_surveyId_alumniId_key");
    const another = await insert("Survey", { name: "Survey B", referenceProgramId: program.id });
    await db.query(sql, [another.id, alumni.id, degree.id]);
    const replacement = await insert("Degree", { alumniId: alumni.id, level: "MASTER", status: "COMPLETED", programId: program.id });
    await db.query('UPDATE "SurveyResponse" SET "referenceDegreeId" = $1, "confirmedAt" = now(), "updatedAt" = now() WHERE "surveyId" = $2', [replacement.id, survey.id]);
  });

  it("leaves Survey lifecycle, Program fit, and completed reference status to the future service", async () => {
    const { survey, alumni, institution } = await context();
    const other = await insert("Program", { institutionId: institution.id, name: "Program B" });
    const degree = await insert("Degree", { alumniId: alumni.id, programId: other.id, level: "MASTER", status: "IN_PROGRESS" });
    await insert("SurveyResponse", { surveyId: survey.id, alumniId: alumni.id, referenceDegreeId: degree.id, confirmedAt: new Date().toISOString() });
    await db.query('UPDATE "Survey" SET status = $1', ["CLOSED"]);
    await db.query('UPDATE "SurveyResponse" SET "confirmedAt" = now()');
  });

  it("restricts deletion of referenced Degree, Survey, and used catalogs; prevents key updates", async () => {
    const { institution, program, survey, degree } = await responseContext();
    for (const [table, id] of [["Degree", degree.id], ["Survey", survey.id], ["Program", program.id], ["Institution", institution.id]]) {
      await rejectsSql(`DELETE FROM "${table}" WHERE id = $1`, [id], "23503");
      await rejectsSql(`UPDATE "${table}" SET id = $1 WHERE id = $2`, [randomUUID(), id], "23503");
    }
    const direct = await insert("Institution", { name: "Institution B" });
    await insert("Degree", { alumniId: degree.alumniId, institutionId: direct.id, level: "CERTIFICATE", status: "UNKNOWN" });
    await rejectsSql('DELETE FROM "Institution" WHERE id = $1', [direct.id], "23503");
  });

  it("cascades Alumni deletion to its responses when no referenced Degree blocks it", async () => {
    const { alumni } = await responseContext();
    // Follow the normative delete workflow: remove responses before the profile.
    await db.query('DELETE FROM "SurveyResponse" WHERE "alumniId" = $1', [alumni.id]);
    await db.query('DELETE FROM "Alumni" WHERE id = $1', [alumni.id]);
    expect((await db.query('SELECT * FROM "Degree" WHERE "alumniId" = $1', [alumni.id])).rows).toEqual([]);
    expect((await db.query('SELECT * FROM "SurveyResponse" WHERE "alumniId" = $1', [alumni.id])).rows).toEqual([]);
    const fks = await db.query("SELECT confdeltype, confupdtype FROM pg_constraint WHERE conrelid = '\"SurveyResponse\"'::regclass AND confrelid = '\"Alumni\"'::regclass AND contype = 'f'");
    expect(fks.rows).toEqual([{ confdeltype: "c", confupdtype: "a" }]);
  });
});
