import type { PrismaClient } from "../../generated/prisma/client";

export type SavedCareer = {
  responseId: string; alumniId: string; surveyName: string; programName: string; confirmedAt: string;
  stations: { id: string; position: number; kind: "DEGREE" | "CAREER_STEP"; title: string | null; type: string; status: string; startYear: number | null; endYear: number | null; provider: string | null; program: string | null; location: string | null; reference: boolean }[];
};
export type SavedCareerSummary = { responseId: string; confirmedAt: string; stationCount: number };

/** Local operator tool only: caller must enforce the development/loopback gate.
 * Scope comes from server installation configuration, never from a query ID.
 */
export async function readSavedCareer(client: PrismaClient, responseId: string, institutionId: string): Promise<SavedCareer | null> {
  const response = await client.surveyResponse.findFirst({ where: { id: responseId, survey: { referenceProgram: { institutionId } } }, include: {
    survey: { include: { referenceProgram: true } },
    alumni: { include: { timelineItems: { orderBy: { position: "asc" }, include: {
      degree: { include: { institution: true, program: { include: { institution: true } } } }, careerStep: { include: { organisation: true } },
    } } } },
  } });
  if (!response) return null;
  return { responseId: response.id, alumniId: response.alumniId, surveyName: response.survey.name, programName: response.survey.referenceProgram.name, confirmedAt: response.confirmedAt.toISOString(),
    stations: response.alumni.timelineItems.map(item => {
      if (item.degree) {
        const degree = item.degree;
        return { id: item.id, position: item.position, kind: "DEGREE", title: degree.title, type: degree.level, status: degree.status, startYear: degree.startYear, endYear: degree.endYear,
          provider: degree.program?.institution.name ?? degree.institution?.name ?? null, program: degree.program?.name ?? null, location: null, reference: degree.id === response.referenceDegreeId };
      }
      const step = item.careerStep!;
      return { id: item.id, position: item.position, kind: "CAREER_STEP", title: step.roleTitle, type: step.type, status: step.temporalStatus, startYear: step.startYear, endYear: step.endYear,
        provider: step.organisation?.name ?? null, program: null, location: step.location, reference: false };
    }),
  };
}
export async function listSavedCareers(client: PrismaClient, institutionId: string): Promise<SavedCareerSummary[]> {
  const responses = await client.surveyResponse.findMany({ where: { survey: { referenceProgram: { institutionId } } }, orderBy: { confirmedAt: "desc" }, take: 100,
    select: { id: true, confirmedAt: true, alumni: { select: { _count: { select: { timelineItems: true } } } } },
  });
  return responses.map(row => ({ responseId: row.id, confirmedAt: row.confirmedAt.toISOString(), stationCount: row.alumni._count.timelineItems }));
}
