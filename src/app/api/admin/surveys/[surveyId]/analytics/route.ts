import { surveyAccess,surveyAccessResponse,surveyConfiguration,surveyHeaders } from "../../../../../../lib/surveys/access";
import { isSurveyId } from "../../../../../../lib/surveys/service";
import { readSurveyAnalytics } from "../../../../../../lib/surveys/analytics";
import { mappingClient } from "../../../../../../lib/career-import/sandbox-db";
export async function GET(request:Request,ctx:{params:Promise<{surveyId:string}>}){
 const access=surveyAccess(request.headers,true);if(access!==200)return surveyAccessResponse(access);
 const {surveyId}=await ctx.params;if(!isSurveyId(surveyId))return new Response(null,{status:404,headers:surveyHeaders});
 try{return Response.json(await readSurveyAnalytics(await mappingClient(),surveyId,surveyConfiguration(),process.env.CAREERMAP_MSI_PROGRAM_ID),{headers:surveyHeaders});}catch{return new Response(null,{status:404,headers:surveyHeaders});}
}
