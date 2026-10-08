import type { Prisma, PrismaClient, Survey, SurveyStatus } from "../generated/prisma/client";

type LockedSurvey = Pick<Survey, "id" | "status" | "referenceProgramId">;

export class SurveyNotFoundError extends Error {
  constructor(public readonly surveyId: string) {
    super(`Survey ${surveyId} does not exist`);
    this.name = "SurveyNotFoundError";
  }
}

export class SurveyNotOpenError extends Error {
  constructor(public readonly surveyId: string, public readonly status: SurveyStatus) {
    super(`Survey ${surveyId} is ${status}; confirmed responses require OPEN`);
    this.name = "SurveyNotOpenError";
  }
}

async function lockSurvey(tx: Prisma.TransactionClient, surveyId: string): Promise<LockedSurvey> {
  const [survey] = await tx.$queryRaw<LockedSurvey[]>`
    SELECT "id", "status", "referenceProgramId"
    FROM "Survey" WHERE "id" = ${surveyId}::uuid FOR UPDATE
  `;
  if (!survey) throw new SurveyNotFoundError(surveyId);
  return survey;
}

/** Use only inside an interactive transaction; subsequent writes must use tx.
 * Lock Survey before Alumni when extending the response-writing service.
 */
export async function requireOpenSurvey(tx: Prisma.TransactionClient, surveyId: string): Promise<LockedSurvey> {
  const survey = await lockSurvey(tx, surveyId);
  if (survey.status !== "OPEN") throw new SurveyNotOpenError(surveyId, survey.status);
  return survey;
}

/** Run already-confirmed database work, never user interaction, under the OPEN
 * guard. The row lock lasts through commit/rollback; results resolve after commit.
 */
export async function withOpenSurvey<T>(
  client: PrismaClient,
  surveyId: string,
  operation: (tx: Prisma.TransactionClient, survey: LockedSurvey) => Promise<T>,
): Promise<T> {
  return client.$transaction(async tx => {
    const survey = await requireOpenSurvey(tx, surveyId);
    return operation(tx, survey);
  }, { isolationLevel: "ReadCommitted" });
}

/** All existing status values and transitions are allowed; the reference
 * Program remains unchanged. Serialize with confirmed-response work on Survey.
 */
export async function updateSurveyStatus(client: PrismaClient, surveyId: string, status: SurveyStatus): Promise<Survey> {
  return client.$transaction(async tx => {
    await lockSurvey(tx, surveyId);
    return tx.survey.update({
      where: { id: surveyId },
      data: { status, updatedAt: new Date() },
    });
  }, { isolationLevel: "ReadCommitted" });
}
