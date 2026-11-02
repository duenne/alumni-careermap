import type { PrismaClient, DegreeLevel, DegreeStatus, CareerStepType, CareerStep } from "../../generated/prisma/client";
import { withOpenSurvey } from "../survey-service";
import { validateSurveyAffiliation, createConfirmedResponseInTransaction } from "../survey-response-service";
import type { SurveyResponseServiceConfiguration } from "../operator-scope";
import { parseManualParticipation } from "./manual";

/** Same canonical entities and lock order as the import writer. All data is
 * validated before opening the transaction; success resolves after commit. */
export async function saveManualParticipation(client: PrismaClient, surveyId: string, value: unknown, configuration: SurveyResponseServiceConfiguration) {
  const input = parseManualParticipation(value);
  return withOpenSurvey(client, surveyId, async (tx, survey) => {
    await validateSurveyAffiliation(tx, survey, configuration);
    const alumni = await tx.alumni.create({ data: {} });
    let referenceDegreeId = "", degrees = 0, careerSteps = 0;
    for (const [index, station] of input.stations.entries()) {
      if (station.kind === "DEGREE") {
        // Only an explicit SURVEY selection uses the survey's immutable program.
        // Other institutions are deliberate catalog creations, never name merges.
        const institutionId = station.program === "OTHER" && station.institutionName
          ? (await tx.institution.create({ data: { name: station.institutionName } })).id : null;
        const degree = await tx.degree.create({ data: {
          alumniId: alumni.id, level: station.level as DegreeLevel, status: station.status as DegreeStatus,
          title: station.title, fieldOfStudy: station.fieldOfStudy || null,
          programId: station.program === "SURVEY" ? survey.referenceProgramId : null, institutionId,
          startYear: station.startYear, endYear: station.endYear, graduationYear: station.graduationYear,
        } });
        if (station.key === input.referenceKey) referenceDegreeId = degree.id;
        await tx.alumniTimelineItem.create({ data: { alumniId: alumni.id, type: "DEGREE", degreeId: degree.id, position: index + 1 } });
        degrees++;
      } else {
        const organisationId = station.organisationName ? (await tx.organisation.create({ data: { name: station.organisationName } })).id : null;
        const step = await tx.careerStep.create({ data: {
          alumniId: alumni.id, type: station.type as CareerStepType, temporalStatus: station.status as CareerStep["temporalStatus"],
          roleTitle: station.title, organisationId, location: station.location || null, startYear: station.startYear, endYear: station.endYear,
        } });
        await tx.alumniTimelineItem.create({ data: { alumniId: alumni.id, type: "CAREER_STEP", careerStepId: step.id, position: index + 1 } });
        careerSteps++;
      }
    }
    const response = await createConfirmedResponseInTransaction(tx, survey, {
      surveyId, alumniId: alumni.id, referenceDegreeId, referenceDegreeConfirmed: input.referenceConfirmed,
    });
    return { alumniId: alumni.id, responseId: response.id, degrees, careerSteps, timelineItems: degrees + careerSteps };
  });
}
