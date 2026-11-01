import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { surveyAccess } from "../../../lib/surveys/access";
import SurveyManager from "./survey-manager";
import { localDemoRequested, readLocalDemoConfiguration } from "../../../lib/local-demo/config";

export const metadata = { title: "Befragungen verwalten · Alumni CareerMap", robots: { index: false, follow: false } };
export default async function SurveyAdministrationPage() {
  if (surveyAccess(await headers(), true) !== 200) notFound();
  const participation = localDemoRequested() && readLocalDemoConfiguration().mode === "v5-participation";
  return <main id="inhalt" tabIndex={-1}>
    <p><Link href="/">Zur Startseite</Link></p>
    <p className="eyebrow">Betreiberbereich · Lokaler Test</p>
    <h1>Befragungen verwalten</h1>
    <p>Eine Befragung bezieht sich dauerhaft auf einen Studiengang. Für einen anderen Studiengang legen Sie eine neue Befragung an.</p>
    <p className="demoNote">{participation ? "Die freigeschaltete Befragung nimmt echte Karriereangaben entgegen. Die MSI-Demobefragung enthält ausschließlich synthetische Daten. Zugriff nur auf diesem Rechner." : "Nur synthetische Testdaten verwenden. Kein Produktivbetrieb."}</p>
    <SurveyManager />
  </main>;
}
