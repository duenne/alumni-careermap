import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { surveyAccess } from "../../../lib/surveys/access";
import SurveyManager from "./survey-manager";

export const metadata = { title: "Befragungen verwalten · Alumni CareerMap", robots: { index: false, follow: false } };
export default async function SurveyAdministrationPage() {
  if (surveyAccess(await headers(), true) !== 200) notFound();
  return <main id="inhalt" tabIndex={-1}>
    <p><Link href="/">Zur Startseite</Link></p>
    <p className="eyebrow">Betreiberbereich · Lokaler Test</p>
    <h1>Befragungen verwalten</h1>
    <p>Eine Befragung bezieht sich dauerhaft auf einen Studiengang. Für einen anderen Studiengang legen Sie eine neue Befragung an.</p>
    <p className="demoNote">Nur synthetische Testdaten verwenden. Kein Produktivbetrieb.</p>
    <SurveyManager />
  </main>;
}
