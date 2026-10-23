import type { Degree, Prisma, PrismaClient, Program, Survey, SurveyResponse } from "../generated/prisma/client";
import { InvalidOperatorConfigurationError, validateOperatorScope, type SurveyResponseServiceConfiguration } from "./operator-scope";
import { withOpenSurvey } from "./survey-service";

export type CreateConfirmedSurveyResponseInput = {
  surveyId: string;
  alumniId: string;
  referenceDegreeId: string;
  referenceDegreeConfirmed: boolean;
};

export type ReplaceConfirmedReferenceDegreeInput = CreateConfirmedSurveyResponseInput;

export class AlumniNotFoundError extends Error {
  constructor(public readonly alumniId: string) {
    super(`Alumni ${alumniId} does not exist`);
    this.name = "AlumniNotFoundError";
  }
}

export class ReferenceDegreeNotFoundError extends Error {
  constructor(public readonly referenceDegreeId: string) {
    super(`Reference Degree ${referenceDegreeId} does not exist`);
    this.name = "ReferenceDegreeNotFoundError";
  }
}

type InvalidReferenceDegreeReason = "NOT_OWNED" | "NOT_COMPLETED" | "PROGRAM_MISMATCH";

export class InvalidReferenceDegreeError extends Error {
  constructor(public readonly referenceDegreeId: string, public readonly reason: InvalidReferenceDegreeReason) {
    const explanation = {
      NOT_OWNED: "does not belong to the Alumni",
      NOT_COMPLETED: "is not COMPLETED",
      PROGRAM_MISMATCH: "does not match the Survey reference Program",
    }[reason];
    super(`Reference Degree ${referenceDegreeId} ${explanation}`);
    this.name = "InvalidReferenceDegreeError";
  }
}

export class ReferenceDegreeSelectionRequiredError extends Error {
  constructor() {
    super("An explicit reference Degree ID is required");
    this.name = "ReferenceDegreeSelectionRequiredError";
  }
}

export class ReferenceDegreeConfirmationRequiredError extends Error {
  constructor(public readonly referenceDegreeId: string) {
    super(`Reference Degree ${referenceDegreeId} requires explicit affirmative confirmation`);
    this.name = "ReferenceDegreeConfirmationRequiredError";
  }
}

export class SurveyResponseAlreadyExistsError extends Error {
  constructor(public readonly surveyId: string, public readonly alumniId: string) {
    super(`Alumni ${alumniId} already has a response to Survey ${surveyId}`);
    this.name = "SurveyResponseAlreadyExistsError";
  }
}

export class SurveyResponseNotFoundError extends Error {
  constructor(public readonly surveyId: string, public readonly alumniId: string) {
    super(`Alumni ${alumniId} has no response to Survey ${surveyId}`);
    this.name = "SurveyResponseNotFoundError";
  }
}

export class SurveyOutsideOperatorScopeError extends Error {
  constructor(public readonly surveyId: string, public readonly reason: "INSTITUTION_MISMATCH" | "FACULTY_MISMATCH" | "PROGRAM_NOT_FOUND") {
    super(`Survey ${surveyId} is outside the configured operator scope: ${reason}`);
    this.name = "SurveyOutsideOperatorScopeError";
  }
}

export async function validateSurveyAffiliation(
  tx: Prisma.TransactionClient,
  survey: Pick<Survey, "id" | "referenceProgramId">,
  configuration: SurveyResponseServiceConfiguration,
): Promise<void> {
  const scope = validateOperatorScope(configuration?.operatorScope);
  const institution = await tx.institution.findUnique({ where: { id: scope.institutionId }, select: { id: true } });
  if (!institution) throw new InvalidOperatorConfigurationError("INSTITUTION_NOT_FOUND");

  // Protect affiliation through commit. Both response writers use
  // Survey -> Program -> Alumni -> Degree; Degree updates use Alumni -> Degree.
  const [program] = await tx.$queryRaw<Pick<Program, "id" | "institutionId" | "faculty">[]>`
    SELECT "id", "institutionId", "faculty"
    FROM "Program" WHERE "id" = ${survey.referenceProgramId}::uuid FOR SHARE
  `;
  if (!program) throw new SurveyOutsideOperatorScopeError(survey.id, "PROGRAM_NOT_FOUND");
  if (program.institutionId !== institution.id) throw new SurveyOutsideOperatorScopeError(survey.id, "INSTITUTION_MISMATCH");
  if (scope.kind === "FACULTY" && program.faculty !== scope.faculty) throw new SurveyOutsideOperatorScopeError(survey.id, "FACULTY_MISMATCH");
}

function requireConfirmedReferenceSelection(input: CreateConfirmedSurveyResponseInput): void {
  if (typeof input.referenceDegreeId !== "string" || !input.referenceDegreeId) {
    throw new ReferenceDegreeSelectionRequiredError();
  }
  if (input.referenceDegreeConfirmed !== true) {
    throw new ReferenceDegreeConfirmationRequiredError(input.referenceDegreeId);
  }
}

async function lockAlumni(tx: Prisma.TransactionClient, alumniId: string): Promise<{ id: string }> {
  const [alumni] = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "Alumni" WHERE "id" = ${alumniId}::uuid FOR UPDATE
  `;
  if (!alumni) throw new AlumniNotFoundError(alumniId);
  return alumni;
}

/** Caller must hold the Alumni lock before locking and validating this Degree. */
async function lockReferenceDegree(
  tx: Prisma.TransactionClient,
  referenceDegreeId: string,
  alumniId: string,
  referenceProgramId: string,
): Promise<Pick<Degree, "id" | "alumniId" | "status" | "programId">> {
  const [degree] = await tx.$queryRaw<Pick<Degree, "id" | "alumniId" | "status" | "programId">[]>`
    SELECT "id", "alumniId", "status", "programId"
    FROM "Degree" WHERE "id" = ${referenceDegreeId}::uuid FOR UPDATE
  `;
  if (!degree) throw new ReferenceDegreeNotFoundError(referenceDegreeId);
  if (degree.alumniId !== alumniId) throw new InvalidReferenceDegreeError(degree.id, "NOT_OWNED");
  if (degree.status !== "COMPLETED") throw new InvalidReferenceDegreeError(degree.id, "NOT_COMPLETED");
  if (degree.programId !== referenceProgramId) throw new InvalidReferenceDegreeError(degree.id, "PROGRAM_MISMATCH");
  return degree;
}

/** Create only the explicitly selected, already-confirmed response. C.1 commits
 * before returning success. No user interaction occurs inside this transaction.
 * Degree updates share the Alumni -> Degree locks and validate existing responses.
 * They must not acquire Survey locks after Alumni; creation locks Survey first.
 * Configuration must come from trusted server-side installation configuration,
 * never from alumni-supplied input. Program affiliation is checked before Alumni.
 */
export async function createConfirmedSurveyResponse(
  client: PrismaClient,
  input: CreateConfirmedSurveyResponseInput,
  configuration: SurveyResponseServiceConfiguration,
): Promise<SurveyResponse> {
  return withOpenSurvey(client, input.surveyId, async (tx, survey) => {
    await validateSurveyAffiliation(tx, survey, configuration);
    return createConfirmedResponseInTransaction(tx, survey, input);
  });
}

/** Composition point for atomic profile creation. Caller must already hold the
 * OPEN Survey lock and validateSurveyAffiliation in this SAME transaction.
 * This preserves Survey -> Program -> Alumni -> Degree lock ordering.
 */
export async function createConfirmedResponseInTransaction(
  tx: Prisma.TransactionClient,
  survey: Pick<Survey, "id" | "referenceProgramId">,
  input: CreateConfirmedSurveyResponseInput,
): Promise<SurveyResponse> {
  requireConfirmedReferenceSelection(input);
  const alumni = await lockAlumni(tx, input.alumniId);
  const degree = await lockReferenceDegree(tx, input.referenceDegreeId, alumni.id, survey.referenceProgramId);
  const existing = await tx.surveyResponse.findUnique({
    where: { surveyId_alumniId: { surveyId: survey.id, alumniId: alumni.id } },
  });
  if (existing) throw new SurveyResponseAlreadyExistsError(survey.id, alumni.id);
  return tx.surveyResponse.create({ data: {
    surveyId: survey.id, alumniId: alumni.id, referenceDegreeId: degree.id, confirmedAt: new Date(),
  } });
}

/** Replace only an existing participation, using trusted installation configuration.
 * The C.1 OPEN transaction commits before returning. The shared Alumni lock
 * serializes with Degree updates; after waiting, READ COMMITTED validates the
 * latest committed Degree. No old Degree lock or user interaction is required.
 */
export async function replaceConfirmedReferenceDegree(
  client: PrismaClient,
  input: ReplaceConfirmedReferenceDegreeInput,
  configuration: SurveyResponseServiceConfiguration,
): Promise<SurveyResponse> {
  return withOpenSurvey(client, input.surveyId, async (tx, survey) => {
    await validateSurveyAffiliation(tx, survey, configuration);
    requireConfirmedReferenceSelection(input);
    const alumni = await lockAlumni(tx, input.alumniId);
    const existing = await tx.surveyResponse.findUnique({
      where: { surveyId_alumniId: { surveyId: survey.id, alumniId: alumni.id } },
    });
    if (!existing) throw new SurveyResponseNotFoundError(survey.id, alumni.id);

    const degree = await lockReferenceDegree(tx, input.referenceDegreeId, alumni.id, survey.referenceProgramId);
    const confirmedAt = new Date();
    return tx.surveyResponse.update({ where: { id: existing.id }, data: {
      referenceDegreeId: degree.id,
      confirmedAt,
      updatedAt: confirmedAt,
    } });
  });
}
