import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "../../src/generated/prisma/client";
import { saveCareerImport } from "../../src/lib/career-import/service";
import { readCareerSnapshot } from "../../src/lib/career-import/mapping";
import { phaseDExample, type PhaseDExpected } from "../../src/lib/career-import/phase-d";
import { readFile } from "node:fs/promises";

const writer = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const reader = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
let institutionId: string, programId: string, surveyId: string;
const created: string[] = [];
const snapshot = readCareerSnapshot({ elements: [
  { snapshotDomain: "EDUCATION", snapshotData: [{ "Degree Name": "Synthetic B.Sc.", "School Name": "Synthetic school", "Start Date": "2017", "End Date": "2021" }] },
  { snapshotDomain: "POSITIONS", snapshotData: [{ Title: "Synthetic developer", "Company Name": "Synthetic employer", "Started On": "Mar 2021", "Finished On": "", Location: "Synthetic town" }] },
] });
const input = () => ({ snapshot, reviews: [
  { sourceKey: "snapshot:2:0", classification: "DEGREE:BACHELOR", status: "COMPLETED", position: 1, catalog: `PROGRAM:${programId}` },
  { sourceKey: "snapshot:1:0", classification: "CAREER_STEP:EMPLOYMENT", status: "ONGOING", position: 3, catalog: "CREATE" },
], surveyId, referenceSourceKey: "snapshot:2:0", referenceConfirmed: true, contributionConfirmed: true });
const config = () => ({ operatorScope: { kind: "INSTITUTION" as const, institutionId } });

beforeAll(async () => {
  const institution = await writer.institution.create({ data: { name: "Synthetic mapping operator" } }); institutionId = institution.id;
  const program = await writer.program.create({ data: { name: "Synthetic mapping program", institutionId } }); programId = program.id;
  const survey = await writer.survey.create({ data: { name: "Synthetic mapping survey", referenceProgramId: programId, status: "OPEN" } }); surveyId = survey.id;
});
afterAll(async () => {
  for (const alumniId of created) {
    const steps = await writer.careerStep.findMany({ where: { alumniId } });
    await writer.surveyResponse.deleteMany({ where: { alumniId } });
    await writer.alumni.delete({ where: { id: alumniId } });
    await writer.organisation.deleteMany({ where: { id: { in: steps.flatMap(s => s.organisationId ? [s.organisationId] : []) } } });
  }
  await writer.survey.delete({ where: { id: surveyId } });
  await writer.program.delete({ where: { id: programId } });
  await writer.institution.delete({ where: { id: institutionId } });
  await Promise.all([writer.$disconnect(), reader.$disconnect()]);
});

describe("reviewed JSON -> committed PostgreSQL profile", () => {
  it("saves the complete profile, catalogs, timeline and response atomically and reads it through another client", async () => {
    const receipt = await saveCareerImport(writer, input(), config()); created.push(receipt.alumniId);
    const profile = await reader.alumni.findUniqueOrThrow({ where: { id: receipt.alumniId }, include: { degrees: true, careerSteps: { include: { organisation: true } }, timelineItems: { orderBy: { position: "asc" } }, responses: true, contact: true } });
    expect(profile.degrees).toHaveLength(1); expect(profile.careerSteps).toHaveLength(1);
    expect(profile.degrees[0]).toMatchObject({ status: "COMPLETED", level: "BACHELOR", graduationYear: null, institutionId: null, programId });
    expect(profile.careerSteps[0]).toMatchObject({ type: "EMPLOYMENT", location: "Synthetic town", organisation: { name: "Synthetic employer" } });
    expect(profile.timelineItems.map(t => [t.type, t.position])).toEqual([["DEGREE", 1], ["CAREER_STEP", 3]]);
    expect(profile.responses[0]).toMatchObject({ surveyId, referenceDegreeId: profile.degrees[0].id });
    expect(profile.contact).toBeNull();
    expect(Object.keys(profile).sort()).not.toContain("snapshot");
  });
  it("rejects missing confirmations, wrong reference program, conflicts and closed surveys without partial writes", async () => {
    const count = await writer.alumni.count(); const catalogCount = await writer.organisation.count();
    const missingReference = input(); missingReference.referenceConfirmed = false;
    const missingContribution = input(); missingContribution.contributionConfirmed = false;
    const mismatch = input(); mismatch.reviews[0].catalog = "UNKNOWN";
    const badCatalog = input(); badCatalog.reviews[1].catalog = "ORGANISATION:00000000-0000-4000-8000-000000000999";
    for (const value of [missingReference, missingContribution, mismatch, badCatalog]) {
      await expect(saveCareerImport(writer, value, config())).rejects.toThrow();
      expect(await writer.alumni.count()).toBe(count); expect(await writer.organisation.count()).toBe(catalogCount);
    }
    await writer.survey.update({ where: { id: surveyId }, data: { status: "CLOSED" } });
    await expect(saveCareerImport(writer, input(), config())).rejects.toThrow();
    expect(await writer.alumni.count()).toBe(count);
    await writer.survey.update({ where: { id: surveyId }, data: { status: "OPEN" } });
  });
  it.skipIf(process.env.CAREERMAP_PHASE_D_FIXTURES !== "1")("round-trips all 100 local examples / 432 stations against independent companion years and ordering", async () => {
    const sources = JSON.parse(await readFile(".local-fixtures/phase-d/all_linkedin_snapshots.json", "utf8")) as { syntheticId: string; snapshot: unknown }[];
    const expected = JSON.parse(await readFile(".local-fixtures/phase-d/all_expected_normalized.json", "utf8")) as (PhaseDExpected & { stations: { startDate: { year: number } | null; endDate: { year: number } | null }[] })[];
    let total = 0;
    for (const source of sources) {
      const pair = expected.find(row => row.syntheticId === source.syntheticId)!;
      const example = phaseDExample(source.snapshot, pair);
      const reviews = example.reviews.map(review => ({ ...review, status: review.sourceKey === example.candidateSourceKey ? "COMPLETED" : "UNKNOWN", catalog: review.sourceKey === example.candidateSourceKey ? `PROGRAM:${programId}` : "UNKNOWN" }));
      const receipt = await saveCareerImport(writer, { snapshot: example.snapshot, reviews, surveyId, referenceSourceKey: example.candidateSourceKey, referenceConfirmed: true, contributionConfirmed: true }, config()); created.push(receipt.alumniId);
      const profile = await reader.alumni.findUniqueOrThrow({ where: { id: receipt.alumniId }, include: { timelineItems: { include: { degree: true, careerStep: true }, orderBy: { position: "asc" } }, responses: true, contact: true } });
      expect(profile.timelineItems.length === pair.stations.length).toBe(true);
      expect(profile.responses.length).toBe(1); expect(profile.contact).toBeNull();
      for (const station of pair.stations) {
        const item = profile.timelineItems.find(item => item.position === station.chronologyIndex)!;
        const row = item.degree ?? item.careerStep!;
        // Boolean comparisons keep local source values out of failed assertions.
        expect(row.startYear === (station.startDate?.year ?? null)).toBe(true);
        const anchor = station.stationId === pair.msiAnchor.stationId;
        expect(row.endYear === (anchor ? station.endDate?.year ?? null : null)).toBe(true);
        expect(item.alumniId === profile.id && row.alumniId === profile.id).toBe(true);
        if (item.degree) expect(item.degree.graduationYear).toBeNull();
        total++;
      }
    }
    expect(total).toBe(432);
  }, 30_000);
});
