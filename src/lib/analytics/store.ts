import { createHash } from "node:crypto";
import type { PrismaClient } from "../../generated/prisma/client";
import type { ImportPlan } from "./prepare";
import { checkAnalyticsDatabase, readRecords, type AnalyticsProfile, type AnalyticsStation } from "./records";
import { ANALYTICS_DATABASE, DEMO_INSTITUTION, DEMO_PROGRAM } from "./safety";

function fingerprint(profiles: AnalyticsProfile[]) {
  const sorted = profiles.map(p => JSON.stringify(p.stations.toSorted((a, b) => a.position - b.position).map(s => ({ ...s, id: undefined })))).sort();
  return createHash("sha256").update(JSON.stringify(sorted)).digest("hex");
}
function plannedRecords(plan: ImportPlan): AnalyticsProfile[] {
  return plan.profiles.map(p => ({ id: "", completeTestCase: true, stations: p.stations.map(s => {
    const c = s.canonical;
    const degree = "level" in c;
    return { id: "", position: s.position, kind: degree ? "DEGREE" : "CAREER_STEP", type: degree ? c.level : c.type, status: degree ? c.status : c.temporalStatus,
      title: degree ? c.title : c.roleTitle, startYear: c.startYear, endYear: c.endYear, graduationYear: degree ? c.graduationYear : null,
      provider: s.demoAnchor ? DEMO_INSTITUTION : s.provider, field: degree ? s.field : null, sector: degree ? null : s.sector, job: degree ? null : s.job, location: degree ? null : s.location, demoAnchor: s.demoAnchor } satisfies AnalyticsStation;
  }) }));
}

/** Whole-batch immutable idempotency: compare complete canonical content while
 * ignoring random IDs. Different data in a nonempty demo DB fail closed. No
 * provider identifiers, source ledger, new tables or identity matching needed.
 */
export async function importAnalytics(client: PrismaClient, url: string, plan: ImportPlan, dryRun = false) {
  await checkAnalyticsDatabase(client, url);
  if (dryRun) return { imported: 0, skipped: 0, dryRun: true, report: plan.report };
  return client.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(172901001)::text`;
    await checkAnalyticsDatabase(tx, url);
    const existing = await readRecords(tx);
    if (existing.length) {
      if (fingerprint(existing) !== fingerprint(plannedRecords(plan))) throw new Error("NONEMPTY_DIFFERENT_DATASET");
      return { imported: 0, skipped: existing.length, dryRun: false, report: plan.report };
    }
    if (!plan.profiles.length) return { imported: 0, skipped: 0, dryRun: false, report: plan.report };
    if (await tx.program.count() || await tx.institution.count() || await tx.organisation.count()) throw new Error("NONEMPTY_DIFFERENT_DATASET");
    const institution = await tx.institution.create({ data: { name: DEMO_INSTITUTION } });
    const program = await tx.program.create({ data: { name: DEMO_PROGRAM, institutionId: institution.id } });
    for (const profile of plan.profiles) {
      const alumni = await tx.alumni.create({ data: {} });
      for (const s of profile.stations) {
        if (s.kind === "RESOLVED_DEGREE") {
          const institutionId = !s.demoAnchor && s.provider ? (await tx.institution.create({ data: { name: s.provider } })).id : null;
          const degree = await tx.degree.create({ data: { ...s.canonical, alumniId: alumni.id, institutionId, programId: s.demoAnchor ? program.id : null, fieldOfStudy: s.field } });
          await tx.alumniTimelineItem.create({ data: { alumniId: alumni.id, type: "DEGREE", degreeId: degree.id, position: s.position } });
        } else {
          const organisationId = s.provider ? (await tx.organisation.create({ data: { name: s.provider, sector: s.sector } })).id : null;
          const step = await tx.careerStep.create({ data: { ...s.canonical, alumniId: alumni.id, organisationId, roleCategory: s.job, location: s.location } });
          await tx.alumniTimelineItem.create({ data: { alumniId: alumni.id, type: "CAREER_STEP", careerStepId: step.id, position: s.position } });
        }
      }
    }
    return { imported: plan.profiles.length, skipped: 0, dryRun: false, report: plan.report };
  }, { timeout: 60_000, maxWait: 10_000 });
}
export async function resetAnalytics(client: PrismaClient, url: string, confirmation: string) {
  if (confirmation !== ANALYTICS_DATABASE) throw new Error("RESET_CONFIRMATION_REQUIRED");
  await checkAnalyticsDatabase(client, url);
  await client.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(172901001)::text`;
    await checkAnalyticsDatabase(tx, url);
    await tx.alumni.deleteMany(); await tx.program.deleteMany(); await tx.institution.deleteMany(); await tx.organisation.deleteMany();
  });
}
