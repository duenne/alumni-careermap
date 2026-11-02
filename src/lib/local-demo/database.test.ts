import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "../../generated/prisma/client";
import { localDemoEnvironment } from "../../../tests/support/local-demo";
import { readLocalDemoConfiguration, localDemoInstitutionName } from "./config";
import { assertLocalDemoDatabase } from "./database";
vi.mock("server-only", () => ({}));
const config = () => readLocalDemoConfiguration(localDemoEnvironment());
function database() {
  const c = config();
  const identity = { database: "careermap_v5_demo", role: "careermap_v5_demo", version: "170006", superuser: false, createDb: false,
    createRole: false, replication: false, bypassRls: false, ownsDatabase: false, createSchema: false, elevatedMembership: false };
  const institution = { id: c.operatorScope.institutionId, name: localDemoInstitutionName(c.installationId) };
  const program = { id: c.pilotProgramId, institutionId: institution.id, name: "Management Sozialer Innovationen", faculty: "Synthetic faculty" };
  const tx = { $queryRaw: vi.fn(async () => [identity]), institution: { findUnique: vi.fn(async () => institution) }, program: { findUnique: vi.fn(async () => program) } };
  const client = { $transaction: vi.fn(async (fn: (v: typeof tx) => unknown) => fn(tx)) } as unknown as PrismaClient;
  return { client, identity, institution, program, tx };
}
describe("D1.4b actual demo connection identity", () => {
  it("accepts only the restricted PG17 role and the configured installation/catalog", async () => {
    const db = database();
    await expect(assertLocalDemoDatabase(db.client, config())).resolves.toBeUndefined();
    expect(db.tx.institution.findUnique).toHaveBeenCalled();
    expect(db.tx.program.findUnique).toHaveBeenCalled();
  });
  it.each(["database", "role", "version", "superuser", "createDb", "createRole", "replication", "bypassRls", "ownsDatabase", "createSchema", "elevatedMembership"])("rejects wrong actual %s", async key => {
    const db = database();
    Object.assign(db.identity, { [key]: key === "version" ? "160010" : ["database", "role"].includes(key) ? "foreign" : true });
    await expect(assertLocalDemoDatabase(db.client, config())).rejects.toThrow("LOCAL_DEMO_DATABASE_UNAVAILABLE");
  });
  it.each(["installation", "owner", "program", "name", "faculty"])("rejects wrong %s association", async kind => {
    const db = database(), c = config();
    if (kind === "installation") db.institution.name = "Foreign installation";
    if (kind === "owner") db.program.institutionId = "99999999-9999-4999-8999-999999999999";
    if (kind === "program") db.program.id = "99999999-9999-4999-8999-999999999999";
    if (kind === "name") db.program.name = "Master Informatik";
    if (kind === "faculty") c.operatorScope = { kind: "FACULTY", institutionId: db.institution.id, faculty: "Other faculty" };
    await expect(assertLocalDemoDatabase(db.client, c)).rejects.toThrow("LOCAL_DEMO_DATABASE_UNAVAILABLE");
  });
  it("never returns adapter error payloads or credentials", async () => {
    const db = database(); db.tx.$queryRaw.mockRejectedValue(new Error("DO_NOT_EXPOSE_SECRET_URL"));
    await expect(assertLocalDemoDatabase(db.client, config())).rejects.toThrow(/^LOCAL_DEMO_DATABASE_UNAVAILABLE$/);
  });
});
