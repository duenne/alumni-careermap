import "server-only";
import { type NextRequest } from "next/server";
import { readLinkedInConfig } from "../dev-import/linkedin/config";
import { createLinkedInHandlers } from "../dev-import/linkedin/routes";
import { createLinkedInProvider } from "../dev-import/linkedin/provider";
import { localLinkedInSessions } from "../dev-import/linkedin/sessions";
import { donationCookie, donationSessions } from "./sessions";
import { donationAllowed } from "./routes";
import { mappingClient } from "../career-import/sandbox-db";
import { readSurveyInvitation } from "../surveys/service";
import { surveyConfiguration, surveyHeaders } from "../surveys/access";
const session=(r:NextRequest)=>donationSessions.get(r.cookies.get(donationCookie)?.value);
const handlers=createLinkedInHandlers({
 config:()=>{const c=readLinkedInConfig({...process.env,CAREERMAP_DEV_IMPORT:"1"});return c?.mode==="third_party"?c:null;},provider:createLinkedInProvider,store:localLinkedInSessions()
},{apiPath:"/api/donation/linkedin",cookieName:"careermap_linkedin_survey",allowed:r=>donationAllowed(r)&&session(r)?.source==="linkedin",returnPath:r=>`/surveys/${session(r)?.surveyId}/participate`});
export async function donationOAuth(request:NextRequest){
 if(!donationAllowed(request))return new Response("Nicht verfügbar.",{status:404,headers:surveyHeaders});
 const s=session(request);if(!s || s.source!=="linkedin" || s.pending)return new Response("Teilnahmesitzung abgelaufen.",{status:401,headers:surveyHeaders});
 try{const survey=await readSurveyInvitation(await mappingClient(),s.surveyId,surveyConfiguration());if(survey?.status!=="OPEN")throw new Error();}
 catch{return new Response("Befragung nicht geöffnet.",{status:409,headers:surveyHeaders});}
 if(new URL(request.url).pathname.endsWith("raw-snapshot"))return new Response("Nicht verfügbar.",{status:404,headers:surveyHeaders});
 return request.method==="GET"?handlers.GET(request):handlers.POST(request);
}
