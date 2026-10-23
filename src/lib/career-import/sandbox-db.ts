import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";
import { validateMappingDatabaseUrl } from "./sandbox";

const state = globalThis as unknown as { mappingClient?: PrismaClient };
export async function mappingClient(): Promise<PrismaClient> {
  if (!state.mappingClient) {
    const connectionString = validateMappingDatabaseUrl(process.env.CAREERMAP_MAPPING_DATABASE_URL);
    state.mappingClient = new PrismaClient({ adapter: new PrismaPg({ connectionString, connectionTimeoutMillis: 3000, query_timeout: 5000 }) });
  }
  const [{ version }] = await state.mappingClient.$queryRaw<{ version: string }[]>`SELECT current_setting('server_version_num') AS version`;
  if (Math.floor(Number(version) / 10000) !== 17) throw new Error("PostgreSQL 17 required");
  return state.mappingClient;
}
