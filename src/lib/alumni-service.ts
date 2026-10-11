import type { PrismaClient } from "../generated/prisma/client";
import { AlumniNotFoundError } from "./survey-response-service";

/** Trusted internal operation. The caller must independently establish permission
 * to delete this profile; an Alumni UUID is not authorization.
 * Hold the shared Alumni lock through commit to serialize with response creation,
 * reference replacement and Degree updates. Never acquire Survey locks here.
 * Delete responses before Alumni so RESTRICT-protected Degrees can cascade.
 */
export async function deleteAlumniProfile(client: PrismaClient, alumniId: string): Promise<void> {
  await client.$transaction(async tx => {
    const [alumni] = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "Alumni" WHERE "id" = ${alumniId}::uuid FOR UPDATE
    `;
    if (!alumni) throw new AlumniNotFoundError(alumniId);

    await tx.surveyResponse.deleteMany({ where: { alumniId: alumni.id } });
    await tx.alumni.delete({ where: { id: alumni.id } });
  }, { isolationLevel: "ReadCommitted" });
}
