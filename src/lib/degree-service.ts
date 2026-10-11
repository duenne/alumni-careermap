import type { Degree, PrismaClient } from "../generated/prisma/client";
import { AlumniNotFoundError } from "./survey-response-service";

const editableFields = [
  "level", "status", "programId", "institutionId", "title", "fieldOfStudy",
  "startYear", "endYear", "graduationYear",
] as const;

export type DegreeChanges = Partial<Pick<Degree, (typeof editableFields)[number]>>;
export type UpdateDegreeInput = { alumniId: string; degreeId: string; changes: DegreeChanges };

export class DegreeNotFoundError extends Error {
  constructor(public readonly degreeId: string) {
    super(`Degree ${degreeId} does not exist`);
    this.name = "DegreeNotFoundError";
  }
}

export class DegreeOwnershipMismatchError extends Error {
  constructor(public readonly degreeId: string, public readonly alumniId: string) {
    super(`Degree ${degreeId} does not belong to Alumni ${alumniId}`);
    this.name = "DegreeOwnershipMismatchError";
  }
}

export class UnsupportedDegreeUpdateFieldError extends Error {
  constructor(public readonly field: string) {
    super(`Degree field ${field} cannot be updated by this service`);
    this.name = "UnsupportedDegreeUpdateFieldError";
  }
}

export class InvalidDegreeUpdateValueError extends Error {
  constructor(public readonly field: string) {
    super(`Degree field ${field} requires a scalar value of its declared type`);
    this.name = "InvalidDegreeUpdateValueError";
  }
}

export class ProtectedDegreeUpdateError extends Error {
  constructor(
    public readonly degreeId: string,
    public readonly surveyResponseId: string,
    public readonly reason: "NOT_OWNED" | "NOT_COMPLETED" | "PROGRAM_MISMATCH",
  ) {
    super(`Updating Degree ${degreeId} would invalidate SurveyResponse ${surveyResponseId}: ${reason}`);
    this.name = "ProtectedDegreeUpdateError";
  }
}

/** Lock Alumni -> Degree, never Survey. Response creation holds the same Alumni
 * lock before validating Degree and inserting a response. At READ COMMITTED,
 * whichever operation waits sees the other's committed changes before checking.
 * Keep Alumni locked through commit so no response can appear after validation.
 * Survey.referenceProgramId is immutable under the MVP service contract.
 */
export async function updateDegree(client: PrismaClient, input: UpdateDegreeInput): Promise<Degree> {
  return client.$transaction(async tx => {
    const entries = Object.entries(input.changes);
    for (const [field, value] of entries) {
      if (!editableFields.some(editable => editable === field)) throw new UnsupportedDegreeUpdateFieldError(field);
      if (value === undefined) continue;
      if (value === null && field !== "level" && field !== "status") continue;
      if (typeof value !== (field.endsWith("Year") ? "number" : "string")) throw new InvalidDegreeUpdateValueError(field);
    }
    // Snapshot only the validated own fields before awaiting database locks.
    const changes = Object.fromEntries(entries) as DegreeChanges;

    const [alumni] = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "Alumni" WHERE "id" = ${input.alumniId}::uuid FOR UPDATE
    `;
    if (!alumni) throw new AlumniNotFoundError(input.alumniId);

    const [degree] = await tx.$queryRaw<Pick<Degree, "id" | "alumniId" | "status" | "programId">[]>`
      SELECT "id", "alumniId", "status", "programId"
      FROM "Degree" WHERE "id" = ${input.degreeId}::uuid FOR UPDATE
    `;
    if (!degree) throw new DegreeNotFoundError(input.degreeId);
    if (degree.alumniId !== alumni.id) throw new DegreeOwnershipMismatchError(degree.id, alumni.id);

    const status = changes.status === undefined ? degree.status : changes.status;
    const programId = changes.programId === undefined ? degree.programId : changes.programId?.toLowerCase() ?? null;
    const responses = await tx.surveyResponse.findMany({
      where: { referenceDegreeId: degree.id },
      select: { id: true, alumniId: true, survey: { select: { referenceProgramId: true } } },
    });
    for (const response of responses) {
      if (degree.alumniId !== response.alumniId) throw new ProtectedDegreeUpdateError(degree.id, response.id, "NOT_OWNED");
      if (status !== "COMPLETED") throw new ProtectedDegreeUpdateError(degree.id, response.id, "NOT_COMPLETED");
      if (programId !== response.survey.referenceProgramId) throw new ProtectedDegreeUpdateError(degree.id, response.id, "PROGRAM_MISMATCH");
    }

    // Explicit scalar assignments: no identity, ownership, relation operations or
    // caller timestamps can enter Prisma persistence through the changes object.
    return tx.degree.update({ where: { id: degree.id }, data: {
      level: changes.level,
      status: changes.status,
      programId: changes.programId,
      institutionId: changes.institutionId,
      title: changes.title,
      fieldOfStudy: changes.fieldOfStudy,
      startYear: changes.startYear,
      endYear: changes.endYear,
      graduationYear: changes.graduationYear,
      updatedAt: new Date(),
    } });
  }, { isolationLevel: "ReadCommitted" });
}
