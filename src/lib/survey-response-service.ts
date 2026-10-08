import type { Degree, PrismaClient, SurveyResponse } from "../generated/prisma/client";
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

/** Create only the explicitly selected, already-confirmed response. C.1 commits
 * before returning success. No user interaction occurs inside this transaction.
 * Future Degree writers must also lock Survey -> Alumni -> Degree and validate
 * existing responses before changing a referenced Degree's Program or status.
 * Operator affiliation remains unvalidated: no installation configuration
 * contract exists yet to identify the operator Institution.
 */
export async function createConfirmedSurveyResponse(
  client: PrismaClient,
  input: CreateConfirmedSurveyResponseInput,
): Promise<SurveyResponse> {
  return withOpenSurvey(client, input.surveyId, async (tx, survey) => {
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
