import type { PrismaClient } from "../../generated/prisma/client";
import type { SurveyResponseServiceConfiguration } from "../operator-scope";
import { validateSurveyAffiliation } from "../survey-response-service";
import { SurveyNotFoundError } from "../survey-service";
import type { AnalyticsProfile, AnalyticsStation } from "../analytics/records";

/** Repeatable, allowlisted survey cohort. No source/contact/free-text identity data.
 * The explicit configured pilot Program ID gates the MSI-specific projection.
 */
export async function readSurveyAnalytics(client: PrismaClient, surveyId: string, configuration: SurveyResponseServiceConfiguration, pilotProgramId: string | undefined) {
 return client.$transaction(async tx => {
  const survey = await tx.survey.findUnique({where:{id:surveyId},select:{id:true,name:true,referenceProgramId:true,status:true,referenceProgram:{select:{name:true}}}});
  if (!survey) throw new SurveyNotFoundError(surveyId);
  await validateSurveyAffiliation(tx,survey,configuration);
  const supported=survey.referenceProgramId===pilotProgramId;
  const rows=await tx.surveyResponse.findMany({where:{surveyId},orderBy:{id:"asc"},select:{id:true,alumniId:true,referenceDegreeId:true,
   referenceDegree:{select:{alumniId:true,programId:true,status:true,level:true}},
   alumni:{select:{_count:{select:{degrees:true,careerSteps:true}},timelineItems:{orderBy:{position:"asc"},select:{position:true,
    degree:{select:{id:true,level:true,status:true,fieldOfStudy:true,startYear:true,endYear:true,graduationYear:true}},
    careerStep:{select:{id:true,type:true,temporalStatus:true,functionArea:true,roleCategory:true,startYear:true,endYear:true,organisation:{select:{sector:true}}}}
   }}}}
  }});
  const excluded: {reason:string}[]=[]; const profiles:AnalyticsProfile[]=[];
  for(const row of rows){
   const d=row.referenceDegree;
   if(d.alumniId!==row.alumniId || d.programId!==survey.referenceProgramId || d.status!=="COMPLETED") {excluded.push({reason:"INVALID_REFERENCE"});continue;}
   if(!supported || d.level!=="BACHELOR") {excluded.push({reason:"UNSUPPORTED_PROJECTION"});continue;}
   if(row.alumni.timelineItems.length!==row.alumni._count.degrees+row.alumni._count.careerSteps || !row.alumni.timelineItems.some(i=>i.degree?.id===row.referenceDegreeId)){excluded.push({reason:"INCOMPLETE_TIMELINE"});continue;}
   const stations:AnalyticsStation[]=row.alumni.timelineItems.map(i=>{
    const base={position:i.position,title:null,provider:null,location:null,demoAnchor:false};
    if(i.degree){const s=i.degree;return {...base,id:s.id,kind:"DEGREE",type:s.level,status:s.status,startYear:s.startYear,endYear:s.endYear,graduationYear:s.graduationYear,field:s.fieldOfStudy,sector:null,job:null};}
    const s=i.careerStep!;return {...base,id:s.id,kind:"CAREER_STEP",type:s.type,status:s.temporalStatus,startYear:s.startYear,endYear:s.endYear,graduationYear:null,field:s.functionArea,sector:s.organisation?.sector??null,job:s.roleCategory};
   });
   profiles.push({id:row.id,referenceDegreeId:row.referenceDegreeId,completeTestCase:false,stations});
  }
  return {survey:{id:survey.id,name:survey.name,program:survey.referenceProgram.name,status:survey.status},supported,responses:rows.length,profiles,excluded};
 },{isolationLevel:"RepeatableRead"});
}
