import type { PrismaClient } from "../../generated/prisma/client";
import type { SurveyResponseServiceConfiguration } from "../operator-scope";
import { validateSurveyAffiliation } from "../survey-response-service";
import { SurveyNotFoundError } from "../survey-service";
import type { AnalyticsProfile, AnalyticsStation } from "../analytics/records";
import { localDemoRequested, readLocalDemoConfiguration } from "../local-demo/config";
import { assertLocalDemoDatabase } from "../local-demo/connection-identity";
import { institutionLabel } from "./presentation";

const degreeDetails = { title: true, program: { select: { name: true, institution: { select: { id: true, name: true } } } }, institution: { select: { id: true, name: true } } } as const;

/** This exception is installation-owned, never an HTTP/client option or a
 * survey-name heuristic. The starter binds syntheticSurveyId to its recorded
 * seed result; real participation is restricted to a different Survey ID.
 */
async function allowSyntheticDetails(client: PrismaClient, surveyId: string, configuration: SurveyResponseServiceConfiguration, pilotProgramId: string | undefined) {
  if (!localDemoRequested()) return false;
  try {
    const demo = readLocalDemoConfiguration();
    const scope = configuration.operatorScope;
    if (demo.syntheticSurveyId !== surveyId || surveyId === demo.participationSurveyId || pilotProgramId !== demo.pilotProgramId
      || scope.institutionId !== demo.operatorScope.institutionId || scope.kind !== demo.operatorScope.kind
      || scope.faculty !== demo.operatorScope.faculty) return false;
    await assertLocalDemoDatabase(client, demo);
    return true;
  } catch { return false; }
}

/** Repeatable, allowlisted survey cohort. No source/contact/identity data.
 * Descriptive canonical fields remain redacted outside the guarded demo.
 * The explicit configured pilot Program ID gates the MSI-specific projection.
 */
export async function readSurveyAnalytics(client: PrismaClient, surveyId: string, configuration: SurveyResponseServiceConfiguration, pilotProgramId: string | undefined) {
 const syntheticDetails = await allowSyntheticDetails(client, surveyId, configuration, pilotProgramId);
 return client.$transaction(async tx => {
  const survey = await tx.survey.findUnique({where:{id:surveyId},select:{id:true,name:true,referenceProgramId:true,status:true,referenceProgram:{select:{name:true}}}});
  if (!survey) throw new SurveyNotFoundError(surveyId);
  await validateSurveyAffiliation(tx,survey,configuration);
  const supported=survey.referenceProgramId===pilotProgramId;
  const details = syntheticDetails && supported && survey.status === "CLOSED";
  const rows=await tx.surveyResponse.findMany({where:{surveyId},orderBy:{id:"asc"},select:{id:true,alumniId:true,referenceDegreeId:true,
   referenceDegree:{select:{alumniId:true,programId:true,status:true,level:true}},
   alumni:{select:{_count:{select:{degrees:true,careerSteps:true}},timelineItems:{orderBy:{position:"asc"},select:{position:true,
    degree:{select:{id:true,level:true,status:true,fieldOfStudy:true,startYear:true,endYear:true,graduationYear:true}},
    careerStep:{select:{id:true,type:true,temporalStatus:true,functionArea:true,roleCategory:true,startYear:true,endYear:true,organisation:{select:{sector:true}}}}
   }}}}
  }});
  const descriptions = new Map<string, Pick<AnalyticsStation, "title" | "provider" | "location">>();
  if (details && rows.length) {
   // Fetch only canonical stations belonging to this allowlisted cohort, in the
   // same snapshot. Regular analytics never even select these detail fields.
   const items = await tx.alumniTimelineItem.findMany({where:{alumniId:{in:rows.map(r=>r.alumniId)}},select:{
    degree:{select:{id:true,...degreeDetails}},
    careerStep:{select:{id:true,roleTitle:true,location:true,organisation:{select:{name:true}}}}
   }});
   for (const item of items) {
    if (item.degree) {
     const s = item.degree;
     const institution = s.program?.institution ?? s.institution;
     descriptions.set(s.id, {title:s.title??s.program?.name??null,provider:[s.program?.name,institution ? institutionLabel(institution) : null].filter(Boolean).join(" · ")||null,location:null});
    } else if (item.careerStep) {
     const s = item.careerStep;
     descriptions.set(s.id, {title:s.roleTitle,provider:s.organisation?.name??null,location:s.location});
    }
   }
  }
  const excluded: {reason:string}[]=[]; const profiles:AnalyticsProfile[]=[];
  for(const row of rows){
   const d=row.referenceDegree;
   if(d.alumniId!==row.alumniId || d.programId!==survey.referenceProgramId || d.status!=="COMPLETED") {excluded.push({reason:"INVALID_REFERENCE"});continue;}
   if(!supported || d.level!=="BACHELOR") {excluded.push({reason:"UNSUPPORTED_PROJECTION"});continue;}
   if(row.alumni.timelineItems.length!==row.alumni._count.degrees+row.alumni._count.careerSteps || !row.alumni.timelineItems.some(i=>i.degree?.id===row.referenceDegreeId)){excluded.push({reason:"INCOMPLETE_TIMELINE"});continue;}
   const stations:AnalyticsStation[]=row.alumni.timelineItems.map(i=>{
    const base={position:i.position,title:null,provider:null,location:null,demoAnchor:false};
    if(i.degree){const s=i.degree;return {...base,id:s.id,kind:"DEGREE",type:s.level,status:s.status,startYear:s.startYear,endYear:s.endYear,graduationYear:s.graduationYear,field:s.fieldOfStudy,sector:null,job:null,
      ...descriptions.get(s.id)};}
    const s=i.careerStep!;return {...base,id:s.id,kind:"CAREER_STEP",type:s.type,status:s.temporalStatus,startYear:s.startYear,endYear:s.endYear,graduationYear:null,field:s.functionArea,sector:s.organisation?.sector??null,job:s.roleCategory,
      ...descriptions.get(s.id)};
   });
   profiles.push({id:row.id,referenceDegreeId:row.referenceDegreeId,completeTestCase:false,stations});
  }
  return {survey:{id:survey.id,name:survey.name,program:survey.referenceProgram.name,status:survey.status},supported,responses:rows.length,profiles,excluded};
 },{isolationLevel:"RepeatableRead"});
}
