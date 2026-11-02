import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { surveyAccess } from "../../../lib/surveys/access";
import SurveyManager from "./survey-manager";
import { localDemoRequested, readLocalDemoConfiguration } from "../../../lib/local-demo/config";
import styles from "./survey-manager.module.css";

export const metadata = { title: "Befragungen verwalten · Alumni CareerMap", robots: { index: false, follow: false } };
export default async function SurveyAdministrationPage() {
  if (surveyAccess(await headers(), true) !== 200) notFound();
  const participation = localDemoRequested() && readLocalDemoConfiguration().mode === "v5-participation";
  return <main id="inhalt" tabIndex={-1} className={styles.page}>
    <nav className={styles.breadcrumb} aria-label="Brotkrumennavigation"><Link href="/">Alumni CareerMap</Link><span aria-hidden="true">/</span><span>Befragungen</span></nav>
    <p className={styles.kicker}>Betreiberbereich</p>
    <h1>Befragungen verwalten</h1>
    <p className={styles.lead}>Gestalte den Einstieg für deine Alumni, teile Einladungen und behalte die Teilnahmen im Blick.</p>
    <p className={styles.environment}>{participation ? "Lokaler Betrieb · Die freigeschaltete Befragung nimmt echte Karriereangaben entgegen. Die MSI-Demobefragung enthält ausschließlich synthetische Daten. Zugriff nur auf diesem Rechner." : "Lokaler Test · Nur synthetische Testdaten verwenden. Kein Produktivbetrieb."}</p>
    <SurveyManager />
  </main>;
}
