import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterAll, beforeAll, expect, it } from "vitest";
import { PrismaClient } from "../../src/generated/prisma/client";
import { saveManualParticipation } from "../../src/lib/donation/manual-service";
import { manualExample } from "../support/manual-participation";
import { deleteAlumniProfile } from "../../src/lib/alumni-service";
import { updateSurveyStatus } from "../../src/lib/survey-service";
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const observer = new Pool({ connectionString: process.env.DATABASE_URL });
let institutionId: string, programId: string, surveyId: string;
const created: string[] = [], organisations: string[] = [];
const config = () => ({ operatorScope: { kind: "INSTITUTION" as const, institutionId } });
beforeAll(async () => {
  institutionId = (await db.institution.create({ data: { name: "Synthetische manuelle Testhochschule" } })).id;
  programId = (await db.program.create({ data: { name: "Master Informatik", institutionId } })).id;
  surveyId = (await db.survey.create({ data: { name: "Synthetischer manueller Teilnahmetest", referenceProgramId: programId, status: "OPEN" } })).id;
});
afterAll(async () => {
  for (const id of created) {
    const steps = await db.careerStep.findMany({ where: { alumniId: id }, select: { organisationId: true } });
    organisations.push(...steps.flatMap(s => s.organisationId ? [s.organisationId] : []));
    await deleteAlumniProfile(db, id);
  }
  await db.organisation.deleteMany({ where: { id: { in: organisations } } });
  await db.survey.delete({ where: { id: surveyId } }); await db.program.delete({ where: { id: programId } }); await db.institution.delete({ where: { id: institutionId } });
  await db.$disconnect(); await observer.end();
});
it("commits a manual Master, actual graduation year, interleaved timeline and one owned confirmed response without contact/raw input", async () => {
  const input = manualExample(); input.stations.reverse();
  const result = await saveManualParticipation(db, surveyId, input, config()); created.push(result.alumniId);
  expect(result).toMatchObject({ degrees: 1, careerSteps: 1, timelineItems: 2 });
  const profile = await db.alumni.findUniqueOrThrow({ where: { id: result.alumniId }, include: { degrees: true, careerSteps: { include: { organisation: true } }, timelineItems: { orderBy: { position: "asc" } }, responses: true, contact: true } });
  expect(profile.degrees[0]).toMatchObject({ level: "MASTER", programId, institutionId: null, startYear: 2018, endYear: 2020, graduationYear: 2020, fieldOfStudy: "Informatik" });
  expect(profile.careerSteps[0]).toMatchObject({ temporalStatus: "ONGOING", endYear: null, organisation: { name: "Synthetischer Arbeitgeber" } });
  expect(profile.timelineItems.map(s => [s.type, s.position])).toEqual([["CAREER_STEP", 1], ["DEGREE", 2]]);
  expect(profile.responses).toHaveLength(1);
  expect(profile.responses[0]).toMatchObject({ surveyId, referenceDegreeId: profile.degrees[0].id, alumniId: profile.id });
  expect(profile.contact).toBeNull(); expect(Object.keys(profile)).not.toContain("input");
});
it("rejects unconfirmed, mismatched and closed submissions without partial profiles or catalogs", async () => {
  const count = await db.alumni.count(), catalogCount = await db.organisation.count();
  const unconfirmed = manualExample(); unconfirmed.referenceConfirmed = false;
  await expect(saveManualParticipation(db, surveyId, unconfirmed, config())).rejects.toThrow();
  await expect(saveManualParticipation(db, surveyId, manualExample(), { operatorScope: { kind: "FACULTY", institutionId, faculty: "Andere synthetische Fakultät" } })).rejects.toThrow();
  await updateSurveyStatus(db, surveyId, "CLOSED");
  await expect(saveManualParticipation(db, surveyId, manualExample(), config())).rejects.toMatchObject({ name: "SurveyNotOpenError" });
  expect(await db.alumni.count()).toBe(count); expect(await db.organisation.count()).toBe(catalogCount);
  await updateSurveyStatus(db, surveyId, "OPEN");
});
it("a concurrent close holding the survey lock prevents a waiting manual save from inserting any profile", async () => {
  const blocker = await observer.connect(); const count = await db.alumni.count();
  let saving: Promise<unknown> | undefined;
  try {
    await blocker.query("BEGIN"); await blocker.query('SELECT id FROM "Survey" WHERE id = $1 FOR UPDATE', [surveyId]);
    const blockerPid = (await blocker.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
    saving = saveManualParticipation(db, surveyId, manualExample(), config());
    const outcome = Promise.allSettled([saving]);
    await expect.poll(async () => (await observer.query("SELECT 1 FROM pg_stat_activity WHERE $1::integer = ANY(pg_blocking_pids(pid)) AND wait_event_type = 'Lock'", [blockerPid])).rowCount, { timeout: 3000 }).toBe(1);
    await blocker.query('UPDATE "Survey" SET status = \'CLOSED\', "updatedAt" = now() WHERE id = $1', [surveyId]);
    await blocker.query("COMMIT");
    expect(await outcome).toMatchObject([{ status: "rejected", reason: { name: "SurveyNotOpenError" } }]);
    expect(await db.alumni.count()).toBe(count);
  } finally { await blocker.query("ROLLBACK"); blocker.release(); await Promise.allSettled([saving]); await updateSurveyStatus(db, surveyId, "OPEN"); }
});
