import type { PrismaClient } from "../../generated/prisma/client";
import { localDemoInstitutionName, type LocalDemoConfiguration } from "./config";

type DatabaseIdentity = {
  database: string; role: string; version: string; superuser: boolean; createDb: boolean; createRole: boolean;
  replication: boolean; bypassRls: boolean; ownsDatabase: boolean; createSchema: boolean; elevatedMembership: boolean;
};
export class LocalDemoDatabaseError extends Error {
  constructor() { super("LOCAL_DEMO_DATABASE_UNAVAILABLE"); this.name = "LocalDemoDatabaseError"; }
}

/** Read-only identity probe on the actual pool. The application/seed role may
 * use DML and row locks, but cannot own the database, create schemas or inherit
 * an administrative role. Recheck before every use, not only at construction.
 */
export async function assertLocalDemoDatabase(client: PrismaClient, configuration: LocalDemoConfiguration): Promise<void> {
  try {
    await client.$transaction(async tx => {
      const [identity] = await tx.$queryRaw<DatabaseIdentity[]>`
        SELECT current_database() AS database, current_user AS role, current_setting('server_version_num') AS version,
          r.rolsuper AS superuser, r.rolcreatedb AS "createDb", r.rolcreaterole AS "createRole", r.rolreplication AS replication,
          r.rolbypassrls AS "bypassRls", (d.datdba = r.oid) AS "ownsDatabase",
          (has_database_privilege(current_user, current_database(), 'CREATE') OR has_schema_privilege(current_user, 'public', 'CREATE')) AS "createSchema",
          EXISTS(SELECT 1 FROM pg_roles elevated WHERE (elevated.rolsuper OR elevated.rolcreatedb OR elevated.rolcreaterole
            OR elevated.rolreplication OR elevated.rolbypassrls) AND pg_has_role(current_user, elevated.oid, 'MEMBER')) AS "elevatedMembership"
        FROM pg_roles r JOIN pg_database d ON d.datname = current_database() WHERE r.rolname = current_user
      `;
      if (!identity || identity.database !== "careermap_v5_demo" || identity.role !== "careermap_v5_demo" || Math.floor(Number(identity.version) / 10000) !== 17
        || [identity.superuser, identity.createDb, identity.createRole, identity.replication, identity.bypassRls, identity.ownsDatabase,
          identity.createSchema, identity.elevatedMembership].some(v => v !== false)) throw new Error();
      const institution = await tx.institution.findUnique({ where: { id: configuration.operatorScope.institutionId }, select: { id: true, name: true } });
      const program = await tx.program.findUnique({ where: { id: configuration.pilotProgramId }, select: { id: true, institutionId: true, name: true, faculty: true } });
      if (!institution || institution.id !== configuration.operatorScope.institutionId || institution.name !== localDemoInstitutionName(configuration.installationId)
        || !program || program.id !== configuration.pilotProgramId || program.institutionId !== institution.id || program.name !== "Management Sozialer Innovationen"
        || configuration.operatorScope.kind === "FACULTY" && program.faculty !== configuration.operatorScope.faculty) throw new Error();
    }, { isolationLevel: "RepeatableRead", timeout: 5000 });
  } catch { throw new LocalDemoDatabaseError(); }
}

