import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";
import { validateAnalyticsDatabaseUrl } from "./safety";
const state = globalThis as unknown as { analyticsClient?: PrismaClient; analyticsUrl?: string };
export function analyticsClient() {
  const url = validateAnalyticsDatabaseUrl(process.env.CAREERMAP_ANALYTICS_DATABASE_URL);
  if (!state.analyticsClient || state.analyticsUrl !== url) {
    state.analyticsClient = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, connectionTimeoutMillis: 3000, query_timeout: 5000 }) });
    state.analyticsUrl = url;
  }
  return { client: state.analyticsClient, url };
}
