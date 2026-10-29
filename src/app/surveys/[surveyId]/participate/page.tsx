import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import MappingEditor from "../../../dev/mapping/mapping-editor";
import { donationCookie, donationSessions } from "../../../../lib/donation/sessions";
import { surveyAccess, surveyConfiguration } from "../../../../lib/surveys/access";
import { mappingClient } from "../../../../lib/career-import/sandbox-db";
import { isSurveyId, readSurveyInvitation } from "../../../../lib/surveys/service";
export const metadata={title:"Karriereweg prüfen · Alumni CareerMap",robots:{index:false,follow:false}};
export default async function Participate({params}:{params:Promise<{surveyId:string}>}){
 if(process.env.CAREERMAP_DEV_DONATION!=="1"||surveyAccess(await headers(),false)!==200)notFound();
 const {surveyId}=await params;if(!isSurveyId(surveyId))notFound();
 const s=donationSessions.get((await cookies()).get(donationCookie)?.value,surveyId);if(!s)redirect(`/surveys/${surveyId}?session=missing`);
 const survey=await readSurveyInvitation(await mappingClient(),surveyId,surveyConfiguration());
 if(survey?.status!=="OPEN")return <main id="inhalt"><h1>Diese Befragung ist geschlossen</h1><p>Es können keine neuen Antworten gespeichert werden.</p></main>;
 return <><div style={{maxWidth:"64rem",margin:"1rem auto",padding:"1rem"}}><strong>{survey.name} · {survey.referenceProgram.name} · {survey.referenceProgram.institution.name}</strong></div><MappingEditor workflow participant={{surveyId,source:s.source}} /></>;
}
