import type { Prisma, PrismaClient } from "../../generated/prisma/client";
import { validateOperatorScope, type SurveyResponseServiceConfiguration } from "../operator-scope";
import { validateSurveyAffiliation } from "../survey-response-service";
import { updateSurveyStatus } from "../survey-service";

export class InvalidSurveyInputError extends Error {}
const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export const isSurveyId = uuid;
function record(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join() !== [...keys].sort().join()) throw new InvalidSurveyInputError();
  return value as Record<string, unknown>;
}
export function parseSurveyCreation(value: unknown) {
  const input = record(value, ["name", "referenceProgramId"]);
  if (typeof input.name !== "string" || !uuid(input.referenceProgramId)) throw new InvalidSurveyInputError();
  const name = input.name.normalize("NFC").trim();
  if (!name || name.length > 200) throw new InvalidSurveyInputError();
  return { name, referenceProgramId: input.referenceProgramId };
}
export function parseSurveyStatus(value: unknown) {
  const input = record(value, ["surveyId", "status"]);
  if (!uuid(input.surveyId) || !["DRAFT", "OPEN", "CLOSED"].includes(input.status as string)) throw new InvalidSurveyInputError();
  return { surveyId: input.surveyId, status: input.status as "DRAFT" | "OPEN" | "CLOSED" };
}

function programScope(configuration: SurveyResponseServiceConfiguration): Prisma.ProgramWhereInput {
  const scope = validateOperatorScope(configuration?.operatorScope);
  return { institutionId: scope.institutionId, ...(scope.kind === "FACULTY" ? { faculty: scope.faculty } : {}) };
}
const programSelect = { id: true, name: true, faculty: true, institution: { select: { id: true, name: true } } } as const;
const surveySelect = { id: true, name: true, status: true, referenceProgram: { select: programSelect } } as const;
export type SurveyContext = Prisma.SurveyGetPayload<{ select: typeof surveySelect }>;
export type SurveyAdministration = Awaited<ReturnType<typeof listSurveyAdministration>>;

export async function listSurveyAdministration(client: PrismaClient, configuration: SurveyResponseServiceConfiguration) {
  const where = programScope(configuration);
  const scope = validateOperatorScope(configuration?.operatorScope);
  const [institutions, surveys] = await Promise.all([
    client.institution.findMany({ where: { id: scope.institutionId }, select: {
      id: true, name: true, programs: { where, select: { id: true, name: true, faculty: true }, orderBy: [{ name: "asc" }, { id: "asc" }] },
    } }),
    client.survey.findMany({ where: { referenceProgram: where }, select: surveySelect, orderBy: [{ createdAt: "desc" }, { id: "asc" }] }),
  ]);
  return { institutions, surveys, facultyScope: scope.kind === "FACULTY" ? scope.faculty : null };
}

/** Creation and affiliation check commit together; failure leaves no Survey.
 * There is deliberately no reference-program update entry point.
 */
export async function createSurvey(client: PrismaClient, value: unknown, configuration: SurveyResponseServiceConfiguration) {
  const data = parseSurveyCreation(value);
  validateOperatorScope(configuration?.operatorScope);
  return client.$transaction(async tx => {
    const survey = await tx.survey.create({ data }); // Schema default DRAFT.
    await validateSurveyAffiliation(tx, survey, configuration);
    return survey;
  }, { isolationLevel: "ReadCommitted" });
}

export async function changeSurveyStatus(client: PrismaClient, value: unknown, configuration: SurveyResponseServiceConfiguration) {
  const input = parseSurveyStatus(value);
  return updateSurveyStatus(client, input.surveyId, input.status, (tx, survey) => validateSurveyAffiliation(tx, survey, configuration));
}

/** Public projection: catalog context only, never response/profile joins.
 * DRAFT is unavailable; CLOSED retains context and a closure notice in the UI.
 */
export async function readSurveyInvitation(client: PrismaClient, surveyId: string, configuration: SurveyResponseServiceConfiguration) {
  if (!uuid(surveyId)) return null;
  return client.survey.findFirst({ where: {
    id: surveyId, status: { in: ["OPEN", "CLOSED"] }, referenceProgram: programScope(configuration),
  }, select: surveySelect });
}
