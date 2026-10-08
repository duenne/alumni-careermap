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

describe("Phase A through B.2 database contract", () => {
  it("contains only eight domain tables and pseudonymized Alumni columns", async () => {
    const tables = await db.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations' ORDER BY tablename");
    expect(tables.rows.map(row => row.tablename)).toEqual(["Alumni", "CareerStep", "Degree", "Institution", "Organisation", "Program", "Survey", "SurveyResponse"]);
    const columns = await db.query("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Alumni' ORDER BY ordinal_position");
    expect(columns.rows.map(row => row.column_name)).toEqual(["id", "createdAt", "updatedAt"]);
  });

  it("uses UUID PKs, required UTC-capable timestamps, and no custom triggers", async () => {
    const { institution, program, survey, alumni, degree } = await context();
    const response = await insert("SurveyResponse", { surveyId: survey.id, alumniId: alumni.id, referenceDegreeId: degree.id, confirmedAt: new Date().toISOString() });
    const organisation = await insert("Organisation", { name: "Organisation A" });
    const careerStep = await insert("CareerStep", { alumniId: alumni.id, type: "EMPLOYMENT", temporalStatus: "UNKNOWN" });
    for (const row of [institution, program, survey, alumni, degree, response, organisation, careerStep]) {
      expect(row.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(row.createdAt).toBeInstanceOf(Date);
      expect(row.updatedAt).toBeInstanceOf(Date);
    }
    const columns = await db.query("SELECT data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND column_name IN ('createdAt', 'updatedAt', 'confirmedAt')");
    expect(columns.rows).toHaveLength(17);
    for (const row of columns.rows) expect(row).toEqual({ data_type: "timestamp with time zone", is_nullable: "NO" });
    const triggers = await db.query("SELECT tgname FROM pg_trigger WHERE NOT tgisinternal AND tgrelid IN (SELECT oid FROM pg_class WHERE relnamespace = 'public'::regnamespace)");
    expect(triggers.rows).toEqual([]);
  });

  it("defines exactly the normative enum values", async () => {
    for (const [type, labels] of Object.entries({
      SurveyStatus: ["DRAFT", "OPEN", "CLOSED"],
      DegreeLevel: ["BACHELOR", "MASTER", "PHD", "DIPLOMA", "CERTIFICATE", "OTHER"],
      DegreeStatus: ["IN_PROGRESS", "COMPLETED", "ENDED_WITHOUT_DEGREE", "UNKNOWN"],
      CareerStepType: ["EMPLOYMENT", "INTERNSHIP", "EDUCATION", "VOCATIONAL_TRAINING", "VOLUNTEERING", "SELF_EMPLOYMENT", "UNEMPLOYED", "OTHER"],
      CareerStepTemporalStatus: ["ONGOING", "ENDED", "UNKNOWN"],
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

describe("CareerStep", () => {
  async function careerContext(values: Values = {}) {
    const alumni = await insert("Alumni");
    const step = await insert("CareerStep", { alumniId: alumni.id, type: "EMPLOYMENT", temporalStatus: "UNKNOWN", ...values });
    return { alumni, step };
  }

  it("contains only the normative fields", async () => {
    const columns = await db.query("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'CareerStep' ORDER BY ordinal_position");
    expect(columns.rows.map(row => row.column_name)).toEqual(["id", "createdAt", "updatedAt", "alumniId", "type", "temporalStatus", "organisationId", "roleTitle", "roleCategory", "functionArea", "location", "startYear", "endYear"]);
  });

  it("creates a minimal step with a random UUID, timestamps and NULL optional fields", async () => {
    const { alumni, step } = await careerContext();
    expect(step).toMatchObject({ alumniId: alumni.id, type: "EMPLOYMENT", temporalStatus: "UNKNOWN", organisationId: null, roleTitle: null, roleCategory: null, functionArea: null, location: null, startYear: null, endYear: null });
    expect(step.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(step.createdAt).toBeInstanceOf(Date);
    expect(step.updatedAt).toBeInstanceOf(Date);
    const second = await insert("CareerStep", { alumniId: alumni.id, type: "EMPLOYMENT", temporalStatus: "UNKNOWN" });
    expect(second.id).not.toBe(step.id);
    expect(second.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("creates with every optional field", async () => {
    const organisation = await insert("Organisation", { name: "Organisation A" });
    const values = { organisationId: organisation.id, roleTitle: "Technical coordinator", roleCategory: "Category A", functionArea: "Function A", location: "Location A", startYear: 2020, endYear: 2024, temporalStatus: "ENDED" };
    expect((await careerContext(values)).step).toMatchObject(values);
  });

  it("accepts explicit NULL for every optional field on insert and update", async () => {
    const values = { organisationId: null, roleTitle: null, roleCategory: null, functionArea: null, location: null, startYear: null, endYear: null };
    expect((await careerContext(values)).step).toMatchObject(values);
    const organisation = await insert("Organisation", { name: "Organisation A" });
    const { step } = await careerContext({ organisationId: organisation.id, roleTitle: "Technical coordinator", roleCategory: "Category A", functionArea: "Function A", location: "Location A", startYear: 2020, endYear: 2024, temporalStatus: "ENDED" });
    const updated = await db.query('UPDATE "CareerStep" SET "organisationId" = NULL, "roleTitle" = NULL, "roleCategory" = NULL, "functionArea" = NULL, location = NULL, "startYear" = NULL, "endYear" = NULL WHERE id = $1 RETURNING *', [step.id]);
    expect(updated.rows[0]).toMatchObject(values);
  });

  it.each(["EMPLOYMENT", "INTERNSHIP", "EDUCATION", "VOCATIONAL_TRAINING", "VOLUNTEERING", "SELF_EMPLOYMENT", "UNEMPLOYED", "OTHER"])("accepts type %s on insert and update", async type => {
    const { step } = await careerContext({ type, ...(type === "OTHER" ? { roleTitle: "Independent technical project" } : {}) });
    expect(step.type).toBe(type);
    const updated = await db.query('UPDATE "CareerStep" SET type = $1, "roleTitle" = $2 WHERE id = $3 RETURNING type', [type, "Independent technical project", step.id]);
    expect(updated.rows[0].type).toBe(type);
  });

  it.each(["ONGOING", "ENDED", "UNKNOWN"])("accepts temporal status %s without an end year on insert and update", async temporalStatus => {
    const { step } = await careerContext({ temporalStatus });
    expect(step).toMatchObject({ temporalStatus, endYear: null });
    const updated = await db.query('UPDATE "CareerStep" SET "temporalStatus" = $1 WHERE id = $2 RETURNING "temporalStatus"', [temporalStatus, step.id]);
    expect(updated.rows[0].temporalStatus).toBe(temporalStatus);
  });

  it.each(["type", "temporalStatus"])("rejects invalid enum values for %s on insert and update", async column => {
    const { alumni, step } = await careerContext();
    const type = column === "type" ? "INVALID" : "EMPLOYMENT";
    const temporalStatus = column === "temporalStatus" ? "INVALID" : "UNKNOWN";
    await rejectsSql('INSERT INTO "CareerStep" ("alumniId", type, "temporalStatus") VALUES ($1, $2, $3)', [alumni.id, type, temporalStatus], "22P02");
    await rejectsSql(`UPDATE "CareerStep" SET "${column}" = $1 WHERE id = $2`, ["INVALID", step.id], "22P02");
  });

  it.each(["alumniId", "type", "temporalStatus"])("rejects omitted required %s", async column => {
    const alumni = await insert("Alumni");
    const values: Values = { alumniId: alumni.id, type: "EMPLOYMENT", temporalStatus: "UNKNOWN" };
    delete values[column];
    const entries = Object.entries(values);
    await rejectsSql(`INSERT INTO "CareerStep" (${entries.map(([key]) => `"${key}"`).join(", ")}) VALUES ($1, $2)`, entries.map(([, value]) => value), "23502");
  });

  it.each(["id", "createdAt", "updatedAt", "alumniId", "type", "temporalStatus"])("rejects NULL required %s on insert and update", async column => {
    const { alumni, step } = await careerContext();
    const values: Values = { id: randomUUID(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), alumniId: alumni.id, type: "EMPLOYMENT", temporalStatus: "UNKNOWN", [column]: null };
    const entries = Object.entries(values);
    await rejectsSql(`INSERT INTO "CareerStep" (${entries.map(([key]) => `"${key}"`).join(", ")}) VALUES (${entries.map((_, i) => `$${i + 1}`).join(", ")})`, entries.map(([, value]) => value), "23502");
    await rejectsSql(`UPDATE "CareerStep" SET "${column}" = NULL WHERE id = $1`, [step.id], "23502");
  });

  it.each(["id", "alumniId", "organisationId"])("rejects invalid UUID %s on insert and update", async column => {
    const { alumni, step } = await careerContext();
    const values: Values = { alumniId: alumni.id, type: "EMPLOYMENT", temporalStatus: "UNKNOWN", [column]: "invalid" };
    const entries = Object.entries(values);
    await rejectsSql(`INSERT INTO "CareerStep" (${entries.map(([key]) => `"${key}"`).join(", ")}) VALUES (${entries.map((_, i) => `$${i + 1}`).join(", ")})`, entries.map(([, value]) => value), "22P02");
    await rejectsSql(`UPDATE "CareerStep" SET "${column}" = $1 WHERE id = $2`, ["invalid", step.id], "22P02");
  });

  it("requires a real Alumni owner on insert and update", async () => {
    const { step } = await careerContext();
    await rejectsSql('INSERT INTO "CareerStep" ("alumniId", type, "temporalStatus") VALUES ($1, $2, $3)', [randomUUID(), "EMPLOYMENT", "UNKNOWN"], "23503", "CareerStep_alumniId_fkey");
    await rejectsSql('UPDATE "CareerStep" SET "alumniId" = $1 WHERE id = $2', [randomUUID(), step.id], "23503", "CareerStep_alumniId_fkey");
  });

  it("requires a real Organisation when provided on insert and update", async () => {
    const { alumni, step } = await careerContext();
    await rejectsSql('INSERT INTO "CareerStep" ("alumniId", type, "temporalStatus", "organisationId") VALUES ($1, $2, $3, $4)', [alumni.id, "EMPLOYMENT", "UNKNOWN", randomUUID()], "23503", "CareerStep_organisationId_fkey");
    await rejectsSql('UPDATE "CareerStep" SET "organisationId" = $1 WHERE id = $2', [randomUUID(), step.id], "23503", "CareerStep_organisationId_fkey");
    const organisation = await insert("Organisation", { name: "Organisation A" });
    const updated = await db.query('UPDATE "CareerStep" SET "organisationId" = $1 WHERE id = $2 RETURNING "organisationId"', [organisation.id, step.id]);
    expect(updated.rows[0].organisationId).toBe(organisation.id);
  });

  it("protects referenced Organisations and permits deletion when unreferenced", async () => {
    const organisation = await insert("Organisation", { name: "Organisation A" });
    const unused = await insert("Organisation", { name: "Organisation B" });
    const { alumni, step } = await careerContext({ organisationId: organisation.id });
    const second = await insert("CareerStep", { alumniId: alumni.id, type: "INTERNSHIP", temporalStatus: "ENDED", organisationId: organisation.id });
    await db.query('DELETE FROM "Organisation" WHERE id = $1', [unused.id]);
    expect((await db.query('SELECT * FROM "Organisation" WHERE id = $1', [unused.id])).rows).toEqual([]);
    await rejectsSql('DELETE FROM "Organisation" WHERE id = $1', [organisation.id], "23503", "CareerStep_organisationId_fkey");
    await db.query('DELETE FROM "CareerStep" WHERE id = $1', [step.id]);
    await rejectsSql('DELETE FROM "Organisation" WHERE id = $1', [organisation.id], "23503", "CareerStep_organisationId_fkey");
    await db.query('UPDATE "CareerStep" SET "organisationId" = NULL WHERE id = $1', [second.id]);
    await db.query('DELETE FROM "Organisation" WHERE id = $1', [organisation.id]);
    expect((await db.query('SELECT * FROM "Organisation" WHERE id = $1', [organisation.id])).rows).toEqual([]);
    expect((await db.query('SELECT id FROM "CareerStep" WHERE id = $1', [second.id])).rows).toEqual([{ id: second.id }]);
  });

  it("does not delete Alumni or Organisation when deleting a CareerStep", async () => {
    const organisation = await insert("Organisation", { name: "Organisation A" });
    const { alumni, step } = await careerContext({ organisationId: organisation.id });
    await db.query('DELETE FROM "CareerStep" WHERE id = $1', [step.id]);
    expect((await db.query('SELECT id FROM "Alumni" WHERE id = $1', [alumni.id])).rows).toEqual([{ id: alumni.id }]);
    expect((await db.query('SELECT id FROM "Organisation" WHERE id = $1', [organisation.id])).rows).toEqual([{ id: organisation.id }]);
  });

  it("cascades Alumni deletion only to its own CareerSteps, preserving Organisation", async () => {
    const organisation = await insert("Organisation", { name: "Organisation A" });
    const { alumni } = await careerContext({ organisationId: organisation.id });
    await insert("CareerStep", { alumniId: alumni.id, type: "VOLUNTEERING", temporalStatus: "ONGOING" });
    const other = await careerContext({ organisationId: organisation.id });
    await db.query('DELETE FROM "Alumni" WHERE id = $1', [alumni.id]);
    expect((await db.query('SELECT * FROM "CareerStep" WHERE "alumniId" = $1', [alumni.id])).rows).toEqual([]);
    expect((await db.query('SELECT id FROM "CareerStep" WHERE id = $1', [other.step.id])).rows).toEqual([{ id: other.step.id }]);
    expect((await db.query('SELECT id FROM "Organisation" WHERE id = $1', [organisation.id])).rows).toEqual([{ id: organisation.id }]);
  });

  it("uses real immediate foreign keys with NO ACTION key updates", async () => {
    const organisation = await insert("Organisation", { name: "Organisation A" });
    const { alumni, step } = await careerContext({ organisationId: organisation.id });
    for (const [table, id, constraint] of [["Alumni", alumni.id, "CareerStep_alumniId_fkey"], ["Organisation", organisation.id, "CareerStep_organisationId_fkey"]]) {
      await rejectsSql(`UPDATE "${table}" SET id = $1 WHERE id = $2`, [randomUUID(), id], "23503", constraint);
    }
    const fks = await db.query("SELECT conname, confdeltype, confupdtype, condeferrable, condeferred FROM pg_constraint WHERE conrelid = '\"CareerStep\"'::regclass AND contype = 'f' ORDER BY conname");
    expect(fks.rows).toEqual([
      { conname: "CareerStep_alumniId_fkey", confdeltype: "c", confupdtype: "a", condeferrable: false, condeferred: false },
      { conname: "CareerStep_organisationId_fkey", confdeltype: "r", confupdtype: "a", condeferrable: false, condeferred: false },
    ]);
    expect((await db.query('SELECT "alumniId", "organisationId" FROM "CareerStep" WHERE id = $1', [step.id])).rows).toEqual([{ alumniId: alumni.id, organisationId: organisation.id }]);
  });

  it.each(["startYear", "endYear"])("bounds %s to 1..9999 on insert and update, allowing NULL", async column => {
    const { alumni, step } = await careerContext({ temporalStatus: "ENDED" });
    for (const value of [0, -1, 10000]) {
      await rejectsSql(`INSERT INTO "CareerStep" ("alumniId", type, "temporalStatus", "${column}") VALUES ($1, 'EMPLOYMENT', 'ENDED', $2)`, [alumni.id, value], "23514", `CareerStep_${column}_range`);
      await rejectsSql(`UPDATE "CareerStep" SET "${column}" = $1 WHERE id = $2`, [value, step.id], "23514", `CareerStep_${column}_range`);
    }
    for (const value of [1, 9999, null]) {
      await insert("CareerStep", { alumniId: alumni.id, type: "EMPLOYMENT", temporalStatus: "ENDED", [column]: value });
      await db.query(`UPDATE "CareerStep" SET "${column}" = $1 WHERE id = $2`, [value, step.id]);
    }
  });

  it("rejects reversed years on insert and update, allowing equal and incomplete years", async () => {
    const { alumni, step } = await careerContext({ temporalStatus: "ENDED" });
    await rejectsSql('INSERT INTO "CareerStep" ("alumniId", type, "temporalStatus", "startYear", "endYear") VALUES ($1, $2, $3, 2024, 2020)', [alumni.id, "EMPLOYMENT", "ENDED"], "23514", "CareerStep_year_order");
    await rejectsSql('UPDATE "CareerStep" SET "startYear" = 2024, "endYear" = 2020 WHERE id = $1', [step.id], "23514", "CareerStep_year_order");
    for (const values of [{ startYear: 2020, endYear: 2020 }, { startYear: 2020, endYear: null }, { startYear: null, endYear: 2020 }]) {
      await insert("CareerStep", { alumniId: alumni.id, type: "EMPLOYMENT", temporalStatus: "ENDED", ...values });
      await db.query('UPDATE "CareerStep" SET "startYear" = $1, "endYear" = $2 WHERE id = $3', [values.startYear, values.endYear, step.id]);
    }
  });

  it.each(["ONGOING", "UNKNOWN"])("%s forbids a known end on insert, year update and status update", async temporalStatus => {
    const { alumni, step } = await careerContext({ temporalStatus, startYear: 2020 });
    await rejectsSql('INSERT INTO "CareerStep" ("alumniId", type, "temporalStatus", "endYear") VALUES ($1, $2, $3, 2024)', [alumni.id, "EMPLOYMENT", temporalStatus], "23514", "CareerStep_open_status_end");
    await rejectsSql('UPDATE "CareerStep" SET "endYear" = 2024 WHERE id = $1', [step.id], "23514", "CareerStep_open_status_end");
    const ended = await insert("CareerStep", { alumniId: alumni.id, type: "EMPLOYMENT", temporalStatus: "ENDED", endYear: 2024 });
    await rejectsSql('UPDATE "CareerStep" SET "temporalStatus" = $1 WHERE id = $2', [temporalStatus, ended.id], "23514", "CareerStep_open_status_end");
  });

  it.each(["roleTitle", "roleCategory", "functionArea", "location"])("rejects blank optional %s on insert and update", async column => {
    const { alumni, step } = await careerContext();
    for (const value of ["", " ", "\t\r\n", " \t\n"]) {
      await rejectsSql(`INSERT INTO "CareerStep" ("alumniId", type, "temporalStatus", "${column}") VALUES ($1, 'EMPLOYMENT', 'UNKNOWN', $2)`, [alumni.id, value], "23514", `CareerStep_${column}_nonblank`);
      await rejectsSql(`UPDATE "CareerStep" SET "${column}" = $1 WHERE id = $2`, [value, step.id], "23514", `CareerStep_${column}_nonblank`);
    }
  });

  it("requires a nonblank factual roleTitle for OTHER on insert and update", async () => {
    const { alumni, step } = await careerContext();
    await rejectsSql('INSERT INTO "CareerStep" ("alumniId", type, "temporalStatus") VALUES ($1, $2, $3)', [alumni.id, "OTHER", "UNKNOWN"], "23514", "CareerStep_other_roleTitle");
    for (const roleTitle of [null, "", " \t\n"]) {
      await rejectsSql('INSERT INTO "CareerStep" ("alumniId", type, "temporalStatus", "roleTitle") VALUES ($1, $2, $3, $4)', [alumni.id, "OTHER", "UNKNOWN", roleTitle], "23514");
    }
    await rejectsSql('UPDATE "CareerStep" SET type = $1 WHERE id = $2', ["OTHER", step.id], "23514", "CareerStep_other_roleTitle");
    const other = await insert("CareerStep", { alumniId: alumni.id, type: "OTHER", temporalStatus: "UNKNOWN", roleTitle: "Independent technical project" });
    await rejectsSql('UPDATE "CareerStep" SET "roleTitle" = NULL WHERE id = $1', [other.id], "23514", "CareerStep_other_roleTitle");
    const updated = await db.query('UPDATE "CareerStep" SET type = $1, "roleTitle" = $2 WHERE id = $3 RETURNING type, "roleTitle"', ["OTHER", "Independent technical project", step.id]);
    expect(updated.rows[0]).toEqual({ type: "OTHER", roleTitle: "Independent technical project" });
  });

  it("allows multiple and overlapping activities for one Alumni, including duplicate facts", async () => {
    const { alumni, step } = await careerContext({ temporalStatus: "ENDED", startYear: 2020, endYear: 2024 });
    const duplicate = await insert("CareerStep", { alumniId: alumni.id, type: "EMPLOYMENT", temporalStatus: "ENDED", startYear: 2020, endYear: 2024 });
    expect(duplicate.id).not.toBe(step.id);
    await insert("CareerStep", { alumniId: alumni.id, type: "VOLUNTEERING", temporalStatus: "ONGOING", startYear: 2022 });
    expect((await db.query('SELECT id FROM "CareerStep" WHERE "alumniId" = $1', [alumni.id])).rows).toHaveLength(3);
  });

  it("enforces UUID PK uniqueness and an immediate composite owner-target unique index without redundant indexes", async () => {
    const { alumni, step } = await careerContext();
    const second = await insert("CareerStep", { alumniId: alumni.id, type: "INTERNSHIP", temporalStatus: "ENDED" });
    await rejectsSql('INSERT INTO "CareerStep" (id, "alumniId", type, "temporalStatus") VALUES ($1, $2, $3, $4)', [step.id, alumni.id, "EMPLOYMENT", "UNKNOWN"], "23505");
    await rejectsSql('UPDATE "CareerStep" SET id = $1 WHERE id = $2', [step.id, second.id], "23505");
    const indexes = await db.query("SELECT c.relname AS name, i.indisunique, i.indimmediate, ARRAY(SELECT a.attname::text FROM unnest(i.indkey) WITH ORDINALITY AS k(attnum, position) JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum ORDER BY k.position) AS columns FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid WHERE i.indrelid = '\"CareerStep\"'::regclass ORDER BY c.relname");
    expect(indexes.rows).toEqual([
      { name: "CareerStep_alumniId_id_key", indisunique: true, indimmediate: true, columns: ["alumniId", "id"] },
      { name: "CareerStep_organisationId_idx", indisunique: false, indimmediate: true, columns: ["organisationId"] },
      { name: "CareerStep_pkey", indisunique: true, indimmediate: true, columns: ["id"] },
    ]);
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
