import type { PrismaClient } from "../../generated/prisma/client";
import { checkAnalyticsDatabase, readRecords, unknownDate } from "./records";
export async function readAnalytics(client: PrismaClient, url: string) {
  return client.$transaction(async tx => {
    await checkAnalyticsDatabase(tx, url);
    const profiles = await readRecords(tx);
    const stations = profiles.flatMap(p => p.stations);
    return { profiles, counts: { profiles: profiles.length, degrees: stations.filter(s => s.kind === "DEGREE").length,
      careerSteps: stations.filter(s => s.kind === "CAREER_STEP").length, timelineItems: stations.length,
      demoAnchors: profiles.filter(p => p.stations.filter(s => s.demoAnchor && s.status === "COMPLETED").length === 1).length,
      unknownDateStations: stations.filter(unknownDate).length } };
  }, { isolationLevel: "RepeatableRead" });
}
