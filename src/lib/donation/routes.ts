import "server-only";
import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import type { PrismaClient } from "../../generated/prisma/client";
import { surveyAccess, surveyConfiguration, surveyHeaders } from "../surveys/access";
import { readSurveyInvitation, isSurveyId } from "../surveys/service";
import { donationCookie, donationSessions } from "./sessions";
import { saveCareerImport } from "../career-import/service";
import { CareerImportError } from "../career-import/mapping";
import { localLinkedInSessions } from "../dev-import/linkedin/sessions";
import { syntheticDonation } from "./synthetic";
export const donationAllowed = (request: Request) => process.env.CAREERMAP_DEV_DONATION === "1" && surveyAccess(request.headers,false)===200;
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:surveyHeaders});
export async function readBoundedBody(request:Request){
 if(!request.body || request.headers.get("content-type")?.split(";")[0]!=="application/json") throw new Error("INVALID_REQUEST");
 const reader=request.body.getReader();const chunks:Uint8Array[]=[];let size=0;
 try{for(;;){const c=await reader.read();if(c.done)break;size+=c.value.length;if(size>300000){await reader.cancel();throw new Error("SOURCE_TOO_LARGE");}chunks.push(c.value);}}finally{reader.releaseLock();}
 return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
export function createDonationHandlers(client:()=>Promise<PrismaClient>){
 return async function handle(request:NextRequest,surveyId:string){
  if(!donationAllowed(request)||!isSurveyId(surveyId))return json({code:"UNAVAILABLE"},404);
  const mutation=request.method==="POST";
  if(mutation && request.headers.get("origin")!==`${new URL(request.url).protocol}//${request.headers.get("host")}`)return json({code:"UNAVAILABLE"},404);
  try{
   const db=await client(); const config=surveyConfiguration();
   const survey=await readSurveyInvitation(db,surveyId,config);
   if(!survey || survey.status!=="OPEN")return json({code:"SURVEY_NOT_OPEN"},409);
   const body=mutation?await readBoundedBody(request):null;
   const existing=donationSessions.get(request.cookies.get(donationCookie)?.value,surveyId);
   if(body && Object.keys(body).length===1 && ["synthetic","linkedin"].includes(body.begin)){
    if(existing?.pending)return json({code:"ALREADY_SUBMITTED"},409);
    if(body.begin==="synthetic" && process.env.CAREERMAP_SYNTHETIC_DONATION!=="1")return json({code:"UNAVAILABLE"},404);
    localLinkedInSessions().remove(request.cookies.get("careermap_linkedin_survey")?.value);
    const session=donationSessions.create(surveyId,body.begin);
    const response=json({started:true});
    response.cookies.set("careermap_linkedin_survey","",{httpOnly:true,sameSite:"lax",path:"/",maxAge:0});
    response.cookies.set(donationCookie,session.id,{httpOnly:true,sameSite:"lax",secure:new URL(request.url).protocol==="https:",path:"/",maxAge:1800});return response;
   }
   if(!existing)return json({code:"SESSION_REQUIRED"},401);
   if(!mutation){
    if(new URL(request.url).searchParams.has("fixture"))return existing.source==="synthetic"?json(syntheticDonation(survey.referenceProgram.id)):json({code:"UNAVAILABLE"},404);
    // Only the active survey and catalog are sent, no saved profile lists.
    const saved = existing.pending ? await existing.pending as {degrees:number;careerSteps:number;timelineItems:number} : null;
    return json({...(saved?{receipt:{degrees:saved.degrees,careerSteps:saved.careerSteps,timelineItems:saved.timelineItems}}:{}),surveys:[{...survey,referenceProgramId:survey.referenceProgram.id}],institutions:[survey.referenceProgram.institution],programs:[survey.referenceProgram],organisations:[],fixtures:existing.source==="synthetic"?[{id:"synthetic-donation",label:"Synthetischer MSI-Karriereweg"}]:[],savedProfiles:[],storage:"TEMPORARY",source:existing.source});
   }
   if(!body || Object.keys(body).sort().join()!=="input,submissionId" || body.input?.surveyId!==surveyId)return json({code:"INVALID_REQUEST"},400);
   const digest=createHash("sha256").update(JSON.stringify(body.input)).digest("hex");
   const receipt=await donationSessions.save(existing,digest,()=>saveCareerImport(db,body.input,config));
   // No personal-profile read capability or identifiers returned to participant.
   localLinkedInSessions().remove(request.cookies.get("careermap_linkedin_survey")?.value);
   const result=json({receipt:{degrees:receipt.degrees,careerSteps:receipt.careerSteps,timelineItems:receipt.timelineItems},saved:true});
   result.cookies.set("careermap_linkedin_survey","",{httpOnly:true,sameSite:"lax",path:"/",maxAge:0});return result;
  }catch(error){return json({code:error instanceof CareerImportError?error.code:error instanceof Error&&error.message==="SUBMISSION_CHANGED"?"SUBMISSION_CHANGED":"SAVE_FAILED"},400);}
 };
}
