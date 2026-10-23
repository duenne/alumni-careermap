import type { Prisma, PrismaClient } from "../../generated/prisma/client";
import { ANALYTICS_DATABASE, ANALYTICS_ROLE, DEMO_INSTITUTION, DEMO_PROGRAM, validateAnalyticsDatabaseUrl } from "./safety";
export type AnalyticsStation = {
  id: string; position: number; kind: "DEGREE" | "CAREER_STEP"; type: string; status: string; title: string | null;
  startYear: number | null; endYear: number | null; graduationYear: number | null;
  provider: string | null; field: string | null; sector: string | null; job: string | null; location: string | null; demoAnchor: boolean;
};
export type AnalyticsProfile = { id: string; completeTestCase: boolean; stations: AnalyticsStation[] };
export type Database = Prisma.TransactionClient | PrismaClient;
export async function checkAnalyticsDatabase(client: Database, url: string) {
  validateAnalyticsDatabaseUrl(url);
  const [info] = await client.$queryRaw<{ version: string; database: string; role: string }[]>`SELECT current_setting('server_version_num') AS version, current_database() AS database, current_user AS role`;
  if (Math.floor(Number(info.version) / 10000) !== 17 || info.database !== ANALYTICS_DATABASE || info.role !== ANALYTICS_ROLE) throw new Error("UNSAFE_ANALYTICS_DATABASE");
  // A donation or contact in this isolated synthetic database is unexpected.
  if (await client.survey.count() || await client.alumniContact.count()) throw new Error("UNEXPECTED_ANALYTICS_DATA");
  const programs = await client.program.findMany({ select: { name: true, institution: { select: { name: true } } } });
  if (programs.length > 1 || programs.some(p => p.name !== DEMO_PROGRAM || p.institution.name !== DEMO_INSTITUTION)) throw new Error("UNEXPECTED_ANALYTICS_DATA");
  if (!programs.length && await client.alumni.count()) throw new Error("UNEXPECTED_ANALYTICS_DATA");
}

/** Allowlisted career projection, no contact/response/profile-source join. */
export async function readRecords(client: Database): Promise<AnalyticsProfile[]> {
  const rows = await client.alumni.findMany({ orderBy: { id: "asc" }, select: { id: true,
    _count: { select: { degrees: true, careerSteps: true } },
    timelineItems: { orderBy: { position: "asc" }, select: { position: true,
      degree: { select: { id: true, level: true, status: true, title: true, fieldOfStudy: true, startYear: true, endYear: true, graduationYear: true,
        institution: { select: { name: true } }, program: { select: { name: true, institution: { select: { name: true } } } } } },
      careerStep: { select: { id: true, type: true, temporalStatus: true, roleTitle: true, roleCategory: true, functionArea: true, location: true, startYear: true, endYear: true,
        organisation: { select: { name: true, sector: true } } } },
    } },
  } });
  return rows.map(row => {
    if (row.timelineItems.length !== row._count.degrees + row._count.careerSteps) throw new Error("INCOMPLETE_CANONICAL_TIMELINE");
    return { id: row.id, completeTestCase: true, stations: row.timelineItems.map(item => {
      const d = item.degree;
      if (d) return { id: d.id, position: item.position, kind: "DEGREE", type: d.level, status: d.status, title: d.title, startYear: d.startYear, endYear: d.endYear, graduationYear: d.graduationYear,
        provider: d.program?.institution.name ?? d.institution?.name ?? null, field: d.fieldOfStudy, sector: null, job: null, location: null, demoAnchor: d.program?.name === DEMO_PROGRAM };
      const s = item.careerStep!;
      return { id: s.id, position: item.position, kind: "CAREER_STEP", type: s.type, status: s.temporalStatus, title: s.roleTitle, startYear: s.startYear, endYear: s.endYear, graduationYear: null,
        provider: s.organisation?.name ?? null, field: s.functionArea, sector: s.organisation?.sector ?? null, job: s.roleCategory, location: s.location, demoAnchor: false };
    }) };
  });
}
export const unknownDate = (s: AnalyticsStation) => s.startYear === null || s.endYear === null && !["ONGOING", "IN_PROGRESS"].includes(s.status);
