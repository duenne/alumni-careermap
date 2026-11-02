import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "../../generated/prisma/client";
import { validateOperatorScope, InvalidOperatorConfigurationError, type OperatorScope } from "../operator-scope";
import { createConfirmedResponseInTransaction, validateSurveyAffiliation, InvalidReferenceDegreeError, SurveyOutsideOperatorScopeError, SurveyResponseAlreadyExistsError } from "../survey-response-service";
import { requireOpenSurvey, updateSurveyStatusInTransaction } from "../survey-service";
import { uuid } from "../career-import/mapping";
import { planV5DemoSeed } from "./plan";
import { assertPersistedDemoMatches } from "./reconcile";
import { DemoSeedPersistenceError, validateDemoDatabaseUrl } from "./safety";

export type DemoPersistenceConfiguration = {
  databaseUrl: string; pilotProgramId: string; operatorScope: OperatorScope;
  purpose: "SYNTHETIC_DEMO_ONLY"; catalogPolicy: "SEPARATE_LABELS_NO_CATEGORIES";
};
type Input = Parameters<typeof planV5DemoSeed>[0];
const fail = (code: string): never => { throw new DemoSeedPersistenceError(code); };

async function checkDatabase(tx: Prisma.TransactionClient, databaseUrl: string) {
  const [actual] = await tx.$queryRaw<{ database: string; role: string; version: string }[]>`
    SELECT current_database() AS database, current_user AS role, current_setting('server_version_num') AS version
  `;
  if (!actual || actual.database !== new URL(databaseUrl).pathname.slice(1) || actual.role !== "careermap_v5_demo"
    || Math.floor(Number(actual.version) / 10000) !== 17) fail("UNSUPPORTED_DEMO_DATABASE");
}

/** Server-only library entry point; never register as a public route.
 * Recomputes the source-verified plan, constructs its own guarded connection,
 * and commits exactly one new, clearly synthetic CLOSED Survey atomically.
 * No reset/upsert, existing response edits, source ledger, or ambient DB URL.
 */
export async function persistV5DemoSeed(input: Input, configuration: DemoPersistenceConfiguration) {
  const databaseUrl = validateDemoDatabaseUrl(configuration?.databaseUrl);
  if (configuration.purpose !== "SYNTHETIC_DEMO_ONLY") fail("DEMO_PURPOSE_REQUIRED");
  if (configuration.catalogPolicy !== "SEPARATE_LABELS_NO_CATEGORIES") fail("CATALOG_POLICY_REQUIRED");
  if (!uuid(configuration.pilotProgramId)) fail("INVALID_PILOT_CONFIGURATION");
  const pilotProgramId = configuration.pilotProgramId.toLowerCase();
  const operatorScope = validateOperatorScope(configuration.operatorScope);
  const serviceConfiguration = { operatorScope };
  const plan = planV5DemoSeed(input);
  if (!plan.valid || !plan.profiles.length) fail("INVALID_DEMO_PLAN");
  if (plan.survey.referenceProgramId !== pilotProgramId) fail("PILOT_PROGRAM_MISMATCH");
  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 }) });
  try {
    return await client.$transaction(async tx => {
      await checkDatabase(tx, databaseUrl);
      // One namespace for this closed demo identity; serializes even two empty
      // snapshots. READ COMMITTED sees the winning transaction after the wait.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(171205, 1)::text`;
      const candidates = await tx.survey.findMany({ where: { name: plan.survey.name }, select: { id: true, referenceProgramId: true } });
      if (candidates.length > 1) fail("AMBIGUOUS_DEMO_SURVEY");
      const existing = candidates[0];
      if (existing) {
        await tx.$queryRaw`SELECT id FROM "Survey" WHERE id = ${existing.id}::uuid FOR UPDATE`;
        if (existing.referenceProgramId !== pilotProgramId) fail("DEMO_DATASET_MISMATCH");
      }
      // Existence check before creating a FK-bearing Survey; final scope/name
      // validation is protected by the Program share lock in this transaction.
      const program = await tx.program.findUnique({ where: { id: pilotProgramId }, select: { id: true } });
      if (!program) fail("PILOT_PROGRAM_NOT_FOUND");
      let survey = existing ? await tx.survey.findUniqueOrThrow({ where: { id: existing.id } })
        : await tx.survey.create({ data: { name: plan.survey.name, referenceProgramId: pilotProgramId } });
      // Survey -> Program -> Alumni -> Degree, matching the existing services.
      await validateSurveyAffiliation(tx, survey, serviceConfiguration);
      const pilot = await tx.program.findUniqueOrThrow({ where: { id: pilotProgramId }, select: { name: true } });
      if (pilot.name !== "Management Sozialer Innovationen") fail("PILOT_PROGRAM_MISMATCH");
      if (existing) {
        await assertPersistedDemoMatches(tx, existing.id, plan);
        return { outcome: "UNCHANGED" as const, surveyId: existing.id, status: "CLOSED" as const, syntheticOnly: true as const, report: plan.summary };
      }
      survey = await updateSurveyStatusInTransaction(tx, survey.id, "OPEN", (t, s) => validateSurveyAffiliation(t, s, serviceConfiguration));
      const open = await requireOpenSurvey(tx, survey.id);
      for (const profile of plan.profiles) {
        const alumni = await tx.alumni.create({ data: {} });
        let referenceDegreeId = "";
        for (const station of profile.stations) {
          if (station.kind === "RESOLVED_DEGREE") {
            const institutionId = station.catalogLabel ? (await tx.institution.create({ data: { name: station.catalogLabel } })).id : null;
            const degree = await tx.degree.create({ data: { ...station.canonical, alumniId: alumni.id, institutionId } });
            await tx.alumniTimelineItem.create({ data: { alumniId: alumni.id, type: "DEGREE", degreeId: degree.id, position: station.position } });
            if (station.key === profile.response.referenceDegreeKey) referenceDegreeId = degree.id;
          } else {
            const organisationId = station.catalogLabel ? (await tx.organisation.create({ data: { name: station.catalogLabel } })).id : null;
            const step = await tx.careerStep.create({ data: { ...station.canonical, alumniId: alumni.id, organisationId, location: station.locationObservation } });
            await tx.alumniTimelineItem.create({ data: { alumniId: alumni.id, type: "CAREER_STEP", careerStepId: step.id, position: station.position } });
          }
        }
        await createConfirmedResponseInTransaction(tx, open, { surveyId: survey.id, alumniId: alumni.id, referenceDegreeId,
          // This boundary is reachable only for reviewed synthetic selections
          // in the dedicated demo DB. This is NOT a real person's consent.
          referenceDegreeConfirmed: profile.response.confirmation === "SYNTHETIC_TEST_ONLY" });
      }
      await updateSurveyStatusInTransaction(tx, survey.id, "CLOSED", (t, s) => validateSurveyAffiliation(t, s, serviceConfiguration));
      await assertPersistedDemoMatches(tx, survey.id, plan);
      return { outcome: "CREATED" as const, surveyId: survey.id, status: "CLOSED" as const, syntheticOnly: true as const, report: plan.summary };
    }, { isolationLevel: "ReadCommitted", timeout: 30000, maxWait: 10000 });
  } catch (error) {
    if (error instanceof DemoSeedPersistenceError || error instanceof InvalidOperatorConfigurationError || error instanceof InvalidReferenceDegreeError
      || error instanceof SurveyOutsideOperatorScopeError || error instanceof SurveyResponseAlreadyExistsError) throw error;
    // Never expose adapter errors, SQL payloads, connection strings or tokens.
    throw new DemoSeedPersistenceError("DEMO_TRANSACTION_FAILED");
  } finally { await client.$disconnect(); }
}
