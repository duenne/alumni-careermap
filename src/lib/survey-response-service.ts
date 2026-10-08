import type { Degree, PrismaClient, Program, SurveyResponse } from "../generated/prisma/client";
import { InvalidOperatorConfigurationError, validateOperatorScope, type SurveyResponseServiceConfiguration } from "./operator-scope";
import { withOpenSurvey } from "./survey-service";

export type CreateConfirmedSurveyResponseInput = {
  surveyId: string;
  alumniId: string;
  referenceDegreeId: string;
  referenceDegreeConfirmed: boolean;
};

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

export class SurveyOutsideOperatorScopeError extends Error {
  constructor(public readonly surveyId: string, public readonly reason: "INSTITUTION_MISMATCH" | "FACULTY_MISMATCH" | "PROGRAM_NOT_FOUND") {
    super(`Survey ${surveyId} is outside the configured operator scope: ${reason}`);
    this.name = "SurveyOutsideOperatorScopeError";
  }
}

/** Create only the explicitly selected, already-confirmed response. C.1 commits
 * before returning success. No user interaction occurs inside this transaction.
 * Future Degree writers must also lock Survey -> Alumni -> Degree and validate
 * existing responses before changing a referenced Degree's Program or status.
 * Configuration must come from trusted server-side installation configuration,
 * never from alumni-supplied input. Program affiliation is checked before Alumni.
 */
export async function createConfirmedSurveyResponse(
  client: PrismaClient,
  input: CreateConfirmedSurveyResponseInput,
  configuration: SurveyResponseServiceConfiguration,
): Promise<SurveyResponse> {
  return withOpenSurvey(client, input.surveyId, async (tx, survey) => {
    const scope = validateOperatorScope(configuration?.operatorScope);
    const institution = await tx.institution.findUnique({ where: { id: scope.institutionId }, select: { id: true } });
    if (!institution) throw new InvalidOperatorConfigurationError("INSTITUTION_NOT_FOUND");

    // Keep affiliation stable until commit without changing the relative
    // Survey -> Alumni -> Degree order of the existing exclusive row locks.
    const [program] = await tx.$queryRaw<Pick<Program, "id" | "institutionId" | "faculty">[]>`
      SELECT "id", "institutionId", "faculty"
      FROM "Program" WHERE "id" = ${survey.referenceProgramId}::uuid FOR SHARE
    `;
    if (!program) throw new SurveyOutsideOperatorScopeError(survey.id, "PROGRAM_NOT_FOUND");
    if (program.institutionId !== institution.id) throw new SurveyOutsideOperatorScopeError(survey.id, "INSTITUTION_MISMATCH");
    if (scope.kind === "FACULTY" && program.faculty !== scope.faculty) throw new SurveyOutsideOperatorScopeError(survey.id, "FACULTY_MISMATCH");

    if (typeof input.referenceDegreeId !== "string" || !input.referenceDegreeId) {
      throw new ReferenceDegreeSelectionRequiredError();
    }
    if (input.referenceDegreeConfirmed !== true) {
      throw new ReferenceDegreeConfirmationRequiredError(input.referenceDegreeId);
    }

    const [alumni] = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "Alumni" WHERE "id" = ${input.alumniId}::uuid FOR UPDATE
    `;
    if (!alumni) throw new AlumniNotFoundError(input.alumniId);

    const [degree] = await tx.$queryRaw<Pick<Degree, "id" | "alumniId" | "status" | "programId">[]>`
      SELECT "id", "alumniId", "status", "programId"
      FROM "Degree" WHERE "id" = ${input.referenceDegreeId}::uuid FOR UPDATE
    `;
    if (!degree) throw new ReferenceDegreeNotFoundError(input.referenceDegreeId);
    if (degree.alumniId !== alumni.id) throw new InvalidReferenceDegreeError(degree.id, "NOT_OWNED");
    if (degree.status !== "COMPLETED") throw new InvalidReferenceDegreeError(degree.id, "NOT_COMPLETED");
    if (degree.programId !== survey.referenceProgramId) throw new InvalidReferenceDegreeError(degree.id, "PROGRAM_MISMATCH");

    const existing = await tx.surveyResponse.findUnique({
      where: { surveyId_alumniId: { surveyId: survey.id, alumniId: alumni.id } },
    });
    if (existing) throw new SurveyResponseAlreadyExistsError(survey.id, alumni.id);

    return tx.surveyResponse.create({ data: {
      surveyId: survey.id,
      alumniId: alumni.id,
      referenceDegreeId: degree.id,
      confirmedAt: new Date(),
    } });
  });
}
