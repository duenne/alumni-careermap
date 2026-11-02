import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";
import { createHash } from "node:crypto";
import { readLocalDemoConfiguration } from "./config";

import { assertLocalDemoDatabase, LocalDemoDatabaseError } from "./connection-identity";
export { assertLocalDemoDatabase, LocalDemoDatabaseError };

const state = globalThis as unknown as { localDemoDatabase?: { fingerprint: string; client: PrismaClient } };
export async function localDemoClient(): Promise<PrismaClient> {
  const config = readLocalDemoConfiguration();
  const fingerprint = createHash("sha256").update(JSON.stringify(config)).digest("hex");
  if (state.localDemoDatabase && state.localDemoDatabase.fingerprint !== fingerprint) throw new LocalDemoDatabaseError();
  if (!state.localDemoDatabase) state.localDemoDatabase = { fingerprint,
    client: new PrismaClient({ adapter: new PrismaPg({ connectionString: config.databaseUrl, connectionTimeoutMillis: 3000, query_timeout: 5000 }) }) };
  await assertLocalDemoDatabase(state.localDemoDatabase.client, config);
  return state.localDemoDatabase.client;
}
