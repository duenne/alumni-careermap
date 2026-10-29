import type { PrismaClient } from "../../generated/prisma/client";
import { validateOperatorScope, type SurveyResponseServiceConfiguration } from "../operator-scope";
import { InvalidSurveyInputError, isSurveyId } from "./service";
export class CatalogOutsideOperatorScopeError extends Error {}

export function parseCatalogProgram(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join() !== "faculty,institutionId,name") throw new InvalidSurveyInputError();
  const input = value as Record<string, unknown>;
  if (!isSurveyId(input.institutionId) || typeof input.name !== "string" || !(input.faculty === null || typeof input.faculty === "string")) throw new InvalidSurveyInputError();
  const name = input.name.normalize("NFC").trim();
  const faculty = typeof input.faculty === "string" ? input.faculty.normalize("NFC").trim() || null : null;
  if (!name || name.length > 200 || (faculty && faculty.length > 200)) throw new InvalidSurveyInputError();
  return { institutionId: input.institutionId.toLowerCase(), name, faculty };
}

/** Additive only: no reassignment/renaming of existing programs or Surveys. */
export async function createCatalogProgram(client: PrismaClient, value: unknown, configuration: SurveyResponseServiceConfiguration) {
  const data = parseCatalogProgram(value);
  const scope = validateOperatorScope(configuration.operatorScope);
  if (data.institutionId !== scope.institutionId || (scope.kind === "FACULTY" && data.faculty !== scope.faculty)) throw new CatalogOutsideOperatorScopeError();
  // PostgreSQL's existing NULLS NOT DISTINCT unique key handles concurrent duplicates.
  return client.program.create({ data, select: { id: true, institutionId: true, name: true, faculty: true } });
}
