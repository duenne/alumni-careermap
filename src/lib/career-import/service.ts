import type { PrismaClient } from "../../generated/prisma/client";
import type { SurveyResponseServiceConfiguration } from "../operator-scope";
import { withOpenSurvey } from "../survey-service";
import { createConfirmedResponseInTransaction, validateSurveyAffiliation } from "../survey-response-service";
import { CareerImportError, mapCareerImport, readCareerSnapshot, sourceRows, uuid, type ImportReview } from "./mapping";

export type ImportReceipt = { alumniId: string; responseId: string; degrees: number; careerSteps: number; timelineItems: number };

/** Trusted caller supplies operator configuration separately. Source, decisions,
 * catalogs, reference and contribution are checked again before any persistence.
 * No profile lookup/merge by source IDs, names or contacts is performed.
 */
export async function saveCareerImport(client: PrismaClient, input: unknown, configuration: SurveyResponseServiceConfiguration): Promise<ImportReceipt> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new CareerImportError();
  const value = input as Record<string, unknown>;
  if (Object.keys(value).length !== 6 || !["snapshot", "reviews", "surveyId", "referenceSourceKey", "referenceConfirmed", "contributionConfirmed"].every(key => Object.hasOwn(value, key))) throw new CareerImportError();
  if (value.referenceConfirmed !== true || value.contributionConfirmed !== true) throw new CareerImportError("CONFIRMATION_REQUIRED");
  if (!uuid(value.surveyId) || typeof value.referenceSourceKey !== "string") throw new CareerImportError("INVALID_REFERENCE");
  const surveyId = value.surveyId;
  const snapshot = readCareerSnapshot(value.snapshot);
  const mapped = mapCareerImport(snapshot, value.reviews);
  const reviews = structuredClone(value.reviews) as ImportReview[];
  const rows = sourceRows(snapshot);
  const reference = mapped.stations.find(station => station.sourceKey === value.referenceSourceKey);
  if (!reference || reference.kind !== "RESOLVED_DEGREE" || reference.canonical.status !== "COMPLETED") throw new CareerImportError("INVALID_REFERENCE");
  return withOpenSurvey(client, surveyId, async (tx, survey) => {
    await validateSurveyAffiliation(tx, survey, configuration);
    if (reference.canonical.programId !== survey.referenceProgramId) throw new CareerImportError("INVALID_REFERENCE");
    const alumni = await tx.alumni.create({ data: {} });
    let referenceDegreeId = "", degrees = 0, careerSteps = 0;
    for (const station of mapped.stations) {
      const review = reviews.find(review => review.sourceKey === station.sourceKey)!;
      const source = rows.find(row => row.sourceKey === station.sourceKey)!;
      const data = { ...station.canonical };
      if (review.catalog === "CREATE") {
        if (!source.provider) throw new CareerImportError("INVALID_CATALOG");
        // Each explicit creation is separate. Equal names never imply identity.
        if (station.kind === "RESOLVED_DEGREE" && "institutionId" in data) {
          data.institutionId = (await tx.institution.create({ data: { name: source.provider } })).id;
        } else if ("organisationId" in data) {
          data.organisationId = (await tx.organisation.create({ data: { name: source.provider } })).id;
        }
      } else if (review.catalog !== "UNKNOWN") {
        const [entity, id] = review.catalog.split(":");
        const exists = entity === "PROGRAM" ? await tx.program.findUnique({ where: { id }, select: { id: true } })
          : entity === "INSTITUTION" ? await tx.institution.findUnique({ where: { id }, select: { id: true } })
          : await tx.organisation.findUnique({ where: { id }, select: { id: true } });
        if (!exists) throw new CareerImportError("INVALID_CATALOG");
      }
      if (station.kind === "RESOLVED_DEGREE" && "level" in data) {
        const degree = await tx.degree.create({ data: { ...data, alumniId: alumni.id } });
        if (station.sourceKey === reference.sourceKey) referenceDegreeId = degree.id;
        await tx.alumniTimelineItem.create({ data: { alumniId: alumni.id, type: "DEGREE", degreeId: degree.id, position: station.position } });
        degrees++;
      } else if ("type" in data) {
        const step = await tx.careerStep.create({ data: { ...data, alumniId: alumni.id } });
        await tx.alumniTimelineItem.create({ data: { alumniId: alumni.id, type: "CAREER_STEP", careerStepId: step.id, position: station.position } });
        careerSteps++;
      }
    }
    const response = await createConfirmedResponseInTransaction(tx, survey, {
      surveyId, alumniId: alumni.id, referenceDegreeId, referenceDegreeConfirmed: true,
    });
    return { alumniId: alumni.id, responseId: response.id, degrees, careerSteps, timelineItems: degrees + careerSteps };
  });
}
