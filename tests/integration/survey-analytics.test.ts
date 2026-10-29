import { PrismaPg } from "@prisma/adapter-pg";
import { beforeAll, afterAll, expect, it } from "vitest";
import { PrismaClient } from "../../src/generated/prisma/client";
import { readSurveyAnalytics } from "../../src/lib/surveys/analytics";
import { aggregateOverview } from "../../src/lib/analytics/overview";
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
let institutionId: string, programId: string, a: string, b: string;
const alumni: string[] = [];
beforeAll(async () => {
 institutionId = (await db.institution.create({data:{name:"Synthetic V3 institute"}})).id;
 programId = (await db.program.create({data:{name:"Synthetic MSI",institutionId}})).id;
 a = (await db.survey.create({data:{name:"Synthetic A",referenceProgramId:programId,status:"OPEN"}})).id;
 b = (await db.survey.create({data:{name:"Synthetic B",referenceProgramId:programId,status:"OPEN"}})).id;
 for (const surveyId of [a,a,b]) {
  const p = await db.alumni.create({data:{}}); alumni.push(p.id);
  const d = await db.degree.create({data:{alumniId:p.id,level:"BACHELOR",status:"COMPLETED",programId,startYear:2017,endYear:2020}});
  await db.alumniTimelineItem.create({data:{alumniId:p.id,degreeId:d.id,type:"DEGREE",position:1}});
  await db.surveyResponse.create({data:{surveyId,alumniId:p.id,referenceDegreeId:d.id,confirmedAt:new Date()}});
 }
});
afterAll(async()=>{await db.surveyResponse.deleteMany({where:{surveyId:{in:[a,b]}}});await db.alumni.deleteMany({where:{id:{in:alumni}}});await db.survey.deleteMany({where:{id:{in:[a,b]}}});await db.program.delete({where:{id:programId}});await db.institution.delete({where:{id:institutionId}});await db.$disconnect();});
it("isolates confirmed cohorts with explicit reference IDs and no fabricated absence or contacts",async()=>{
 const config={operatorScope:{kind:"INSTITUTION",institutionId}} as const;
 const result=await readSurveyAnalytics(db,a,config,programId);
 expect(result.profiles).toHaveLength(2); expect(result.responses).toBe(2);
 expect((await readSurveyAnalytics(db,b,config,programId)).profiles).toHaveLength(1);
 expect(result.profiles.every(p=> !p.completeTestCase && p.referenceDegreeId && p.stations.every(s=>!s.demoAnchor))).toBe(true);
 expect(aggregateOverview(result.profiles).included).toBe(2);
 expect(aggregateOverview(result.profiles).decisions.every(d=>d.master.presence==="UNKNOWN")).toBe(true);
 expect(JSON.stringify(result)).not.toMatch(/email|displayName|alumniContact|access_token/);
 await expect(readSurveyAnalytics(db,a,{operatorScope:{kind:"FACULTY",institutionId,faculty:"Other"}},programId)).rejects.toThrow();
 const degree = await db.degree.findFirstOrThrow({where:{alumniId:alumni[0]}});
 await db.degree.update({where:{id:degree.id},data:{status:"IN_PROGRESS",endYear:null}});
 const inconsistent=await readSurveyAnalytics(db,a,config,programId);
 expect(inconsistent.profiles).toHaveLength(1); expect(inconsistent.excluded).toContainEqual({reason:"INVALID_REFERENCE"});
 expect((await readSurveyAnalytics(db,a,config,"other-program")).supported).toBe(false);
});
