import type { Prisma, PrismaClient } from "../../generated/prisma/client";
import { validateOperatorScope, type SurveyResponseServiceConfiguration } from "../operator-scope";
import { validateSurveyAffiliation } from "../survey-response-service";
import { updateSurveyStatus, SurveyNotFoundError } from "../survey-service";
import { entryFields, entryKeys, type EntryContent } from "./entry-content";

export class InvalidSurveyInputError extends Error {}
export class SurveyEditConflictError extends Error {}
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

export function parseSurveyEdit(value: unknown) {
  const input = record(value, ["surveyId", "expectedUpdatedAt", "name", ...entryKeys]);
  if (!uuid(input.surveyId) || typeof input.name !== "string" || typeof input.expectedUpdatedAt !== "string"
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(input.expectedUpdatedAt)
    || !Number.isFinite(Date.parse(input.expectedUpdatedAt))) throw new InvalidSurveyInputError();
  const name = input.name.normalize("NFC").trim();
  if (!name || name.length > 200) throw new InvalidSurveyInputError();
  const content = {} as EntryContent;
  for (const key of entryKeys) {
    const value = input[key];
    if (value !== null && typeof value !== "string") throw new InvalidSurveyInputError();
    const text = value?.normalize("NFC").trim() || null;
    if (text && text.length > entryFields[key].max) throw new InvalidSurveyInputError();
    content[key] = text;
  }
  return { surveyId: input.surveyId, expectedUpdatedAt: input.expectedUpdatedAt, name, ...content };
}

/** The conditional write prevents an older editor from overwriting newer changes.
 * Both the lookup and update are restricted to the configured operator scope.
 */
export async function editSurvey(client: PrismaClient, value: unknown, configuration: SurveyResponseServiceConfiguration) {
  const { surveyId, expectedUpdatedAt, ...content } = parseSurveyEdit(value);
  const referenceProgram = programScope(configuration);
  return client.$transaction(async tx => {
    const existing = await tx.survey.findFirst({ where: { id: surveyId, referenceProgram }, select: { updatedAt: true } });
    if (!existing) throw new SurveyNotFoundError(surveyId);
    const updatedAt = new Date(Math.max(Date.now(), existing.updatedAt.getTime() + 1));
    const result = await tx.survey.updateMany({
      where: { id: surveyId, referenceProgram, updatedAt: new Date(expectedUpdatedAt) },
      data: { ...content, updatedAt },
    });
    if (result.count !== 1) throw new SurveyEditConflictError();
    return tx.survey.findUniqueOrThrow({ where: { id: surveyId }, select: { ...surveySelect, updatedAt: true } });
  });
}

function programScope(configuration: SurveyResponseServiceConfiguration): Prisma.ProgramWhereInput {
  const scope = validateOperatorScope(configuration?.operatorScope);
  return { institutionId: scope.institutionId, ...(scope.kind === "FACULTY" ? { faculty: scope.faculty } : {}) };
}
const programSelect = { id: true, name: true, faculty: true, institution: { select: { id: true, name: true } } } as const;
const surveySelect = { id: true, name: true, status: true,
  entryHeading: true, entryIntro: true, entryWelcome: true, entryPurpose: true, entryContact: true,
  referenceProgram: { select: programSelect } } as const;
export type SurveyContext = Prisma.SurveyGetPayload<{ select: typeof surveySelect }>;
export type SurveyAdministration = Awaited<ReturnType<typeof listSurveyAdministration>>;

export async function listSurveyAdministration(client: PrismaClient, configuration: SurveyResponseServiceConfiguration) {
  const where = programScope(configuration);
  const scope = validateOperatorScope(configuration?.operatorScope);
  const [institutions, surveys] = await Promise.all([
    client.institution.findMany({ where: { id: scope.institutionId }, select: {
      id: true, name: true, programs: { where, select: { id: true, name: true, faculty: true }, orderBy: [{ name: "asc" }, { id: "asc" }] },
    } }),
    client.survey.findMany({ where: { referenceProgram: where }, select: { ...surveySelect, updatedAt: true, _count: { select: { responses: true } } }, orderBy: [{ createdAt: "desc" }, { id: "asc" }] }),
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
