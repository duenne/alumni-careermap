import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { surveyAccess,surveyConfiguration, surveyPilotProgramId } from "../../../../../lib/surveys/access";
import { isSurveyId } from "../../../../../lib/surveys/service";
import { readSurveyAnalytics } from "../../../../../lib/surveys/analytics";
import { surveyClient } from "../../../../../lib/surveys/client";
import Dashboard from "../../../../dev/analytics/dashboard";
import { localDemoRequested, readLocalDemoConfiguration } from "../../../../../lib/local-demo/config";
export const metadata={title:"Befragung auswerten · Alumni CareerMap",robots:{index:false,follow:false}};
export default async function Analytics({params}:{params:Promise<{surveyId:string}>}){
 if(surveyAccess(await headers(),true)!==200)notFound();const {surveyId}=await params;if(!isSurveyId(surveyId))notFound();
 let data;try{data=await readSurveyAnalytics(await surveyClient(),surveyId,surveyConfiguration(),surveyPilotProgramId());}catch{notFound();}
 if(!data.supported)return <main id="inhalt"><h1>{data.survey.name} · Auswertung</h1><p>Die Vier-/Sieben-Stufen-Projektion ist ausschließlich für den explizit konfigurierten MSI-Bachelor-Piloten definiert. Für diesen Studiengang ist sie nicht freigegeben.</p></main>;
 const syntheticDemo = localDemoRequested() && data.survey.id !== readLocalDemoConfiguration().participationSurveyId;
 return <><p style={{padding:".5rem 1rem",margin:0}}><a href="/admin/surveys">Zur Befragungsverwaltung</a></p><Dashboard profiles={data.profiles} survey={{...data.survey,responses:data.responses}} diagnostics={data.excluded} syntheticDemo={syntheticDemo}/></>;
}
