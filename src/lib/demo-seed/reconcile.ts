import type { Prisma } from "../../generated/prisma/client";
import type { planV5DemoSeed } from "./plan";
import { DemoSeedPersistenceError } from "./safety";

type Plan = ReturnType<typeof planV5DemoSeed>;
const mismatch = (): never => { throw new DemoSeedPersistenceError("DEMO_DATASET_MISMATCH"); };
// Canonical JSON ignores object key order, UUIDs and technical timestamps.
// Array order matters within timelines; profile multiplicities are preserved.
function canonicalJson(value: unknown): string {
  const sorted = (v: unknown): unknown => Array.isArray(v) ? v.map(sorted)
    : v !== null && typeof v === "object" ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, child]) => [k, sorted(child)])) : v;
  return JSON.stringify(sorted(value));
}

const degreeSelect = { id: true, alumniId: true, level: true, status: true, title: true, fieldOfStudy: true, programId: true, institutionId: true,
  startYear: true, endYear: true, graduationYear: true, institution: { select: { id: true, name: true, location: true, _count: { select: { degrees: true, programs: true } } } } } as const;
const stepSelect = { id: true, alumniId: true, type: true, temporalStatus: true, roleTitle: true, roleCategory: true, functionArea: true, location: true,
  organisationId: true, startYear: true, endYear: true, organisation: { select: { id: true, name: true, location: true, sector: true, _count: { select: { careerSteps: true } } } } } as const;

/** Caller holds Survey, then Program. Match the common Alumni -> Degree lock
 * order before reading a graph; catalog row locks keep labels stable as well.
 */
async function lockGraph(tx: Prisma.TransactionClient, surveyId: string) {
  await tx.$queryRaw`SELECT a.id FROM "Alumni" a JOIN "SurveyResponse" r ON r."alumniId" = a.id WHERE r."surveyId" = ${surveyId}::uuid ORDER BY a.id FOR UPDATE OF a`;
  await tx.$queryRaw`SELECT d.id FROM "Degree" d JOIN "SurveyResponse" r ON r."alumniId" = d."alumniId" WHERE r."surveyId" = ${surveyId}::uuid ORDER BY d.id FOR SHARE OF d`;
  await tx.$queryRaw`SELECT c.id FROM "CareerStep" c JOIN "SurveyResponse" r ON r."alumniId" = c."alumniId" WHERE r."surveyId" = ${surveyId}::uuid ORDER BY c.id FOR SHARE OF c`;
  await tx.$queryRaw`SELECT t.id FROM "AlumniTimelineItem" t JOIN "SurveyResponse" r ON r."alumniId" = t."alumniId" WHERE r."surveyId" = ${surveyId}::uuid ORDER BY t.id FOR SHARE OF t`;
  await tx.$queryRaw`SELECT i.id FROM "Institution" i JOIN "Degree" d ON d."institutionId" = i.id JOIN "SurveyResponse" r ON r."alumniId" = d."alumniId" WHERE r."surveyId" = ${surveyId}::uuid ORDER BY i.id FOR SHARE OF i`;
  await tx.$queryRaw`SELECT o.id FROM "Organisation" o JOIN "CareerStep" c ON c."organisationId" = o.id JOIN "SurveyResponse" r ON r."alumniId" = c."alumniId" WHERE r."surveyId" = ${surveyId}::uuid ORDER BY o.id FOR SHARE OF o`;
}

/** Full comparison of the seed's own graph, not a global count or a name match.
 * No contact values, raw sources or provider IDs are selected.
 */
export async function assertPersistedDemoMatches(tx: Prisma.TransactionClient, surveyId: string, plan: Plan): Promise<void> {
  await lockGraph(tx, surveyId);
  const survey = await tx.survey.findUniqueOrThrow({ where: { id: surveyId }, select: { name: true, status: true, referenceProgramId: true } });
  if (survey.status !== "CLOSED" || survey.name !== plan.survey.name || survey.referenceProgramId !== plan.survey.referenceProgramId) mismatch();
  const responses = await tx.surveyResponse.findMany({ where: { surveyId }, select: {
    alumniId: true, referenceDegreeId: true, confirmedAt: true,
    alumni: { select: { id: true, contact: { select: { id: true } }, responses: { select: { surveyId: true } },
      degrees: { select: degreeSelect }, careerSteps: { select: stepSelect },
      timelineItems: { orderBy: { position: "asc" }, select: { type: true, position: true, degreeId: true, careerStepId: true } },
    } },
  } });
  const catalogIds = new Set<string>();
  const stored = responses.map(response => {
    const alumni = response.alumni;
    if (alumni.contact || alumni.responses.length !== 1 || alumni.responses[0].surveyId !== surveyId
      || !response.confirmedAt || alumni.timelineItems.length !== alumni.degrees.length + alumni.careerSteps.length) mismatch();
    const reference = alumni.degrees.find(d => d.id === response.referenceDegreeId);
    if (!reference || reference.alumniId !== response.alumniId || reference.status !== "COMPLETED" || reference.programId !== survey.referenceProgramId) mismatch();
    let referencePosition: number | null = null;
    const stations = alumni.timelineItems.map(item => {
      if (item.type === "DEGREE") {
        const degree = alumni.degrees.find(d => d.id === item.degreeId);
        if (!degree || degree.alumniId !== alumni.id || item.careerStepId !== null) return mismatch();
        if (degree.id === response.referenceDegreeId) referencePosition = item.position;
        const institution = degree.institution;
        if (institution) {
          if (catalogIds.has(`institution:${institution.id}`) || institution._count.degrees !== 1 || institution._count.programs !== 0) mismatch();
          catalogIds.add(`institution:${institution.id}`);
        }
        return { kind: "RESOLVED_DEGREE", position: item.position, canonical: {
          level: degree.level, status: degree.status, title: degree.title, fieldOfStudy: degree.fieldOfStudy,
          programId: degree.programId, institutionId: null, startYear: degree.startYear, endYear: degree.endYear, graduationYear: degree.graduationYear,
        }, catalog: institution ? { name: institution.name, location: institution.location } : null };
      }
      const step = alumni.careerSteps.find(s => s.id === item.careerStepId);
      if (!step || step.alumniId !== alumni.id || item.degreeId !== null) return mismatch();
      const organisation = step.organisation;
      if (organisation) {
        if (catalogIds.has(`organisation:${organisation.id}`) || organisation._count.careerSteps !== 1) mismatch();
        catalogIds.add(`organisation:${organisation.id}`);
      }
      return { kind: "RESOLVED_CAREER_STEP", position: item.position, canonical: {
        type: step.type, temporalStatus: step.temporalStatus, roleTitle: step.roleTitle, roleCategory: step.roleCategory,
        functionArea: step.functionArea, location: step.location, organisationId: null, startYear: step.startYear, endYear: step.endYear,
      }, catalog: organisation ? { name: organisation.name, location: organisation.location, sector: organisation.sector } : null };
    });
    if (referencePosition === null) mismatch();
    return canonicalJson({ referencePosition, stations });
  }).sort();
  const planned = plan.profiles.map(profile => canonicalJson({
    referencePosition: profile.stations.find(s => s.key === profile.response.referenceDegreeKey)!.position,
    stations: profile.stations.map(s => ({ kind: s.kind, position: s.position,
      canonical: s.kind === "RESOLVED_DEGREE" ? s.canonical : { ...s.canonical, location: s.locationObservation },
      catalog: !s.catalogLabel ? null : s.kind === "RESOLVED_DEGREE"
        ? { name: s.catalogLabel, location: null } : { name: s.catalogLabel, location: null, sector: null },
    })),
  })).sort();
  if (canonicalJson(stored) !== canonicalJson(planned)) mismatch();
}
