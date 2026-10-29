import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { surveyAccess } from "../lib/surveys/access";

export function JourneyHomeContent() {
  return <main id="inhalt" tabIndex={-1} className="entry">
    <p className="eyebrow">Studiengangsbezogene Alumni-Befragungen</p>
    <h1>Alumni CareerMap</h1>
    <p className="lead">Von der Einladung bis zum gemeinsamen Einblick: Alumni prüfen ihren Karriereweg und bestätigen ihren Beitrag. Der Betreiber wertet die bestätigten Antworten für genau diese Befragung aus.</p>
    <section aria-labelledby="operator-start">
      <h2 id="operator-start">Befragung einrichten</h2>
      <p>Als Betreiber wählst du einen bestehenden Studiengang, öffnest die Befragung und teilst ihren Einladungslink. Verwaltung und Auswertung sind zugangsgeschützt.</p>
      <Link href="/admin/surveys" className="primaryLink">Befragungen verwalten</Link>
    </section>
    <section className="plannedProcess" aria-labelledby="journey-steps">
      <h2 id="journey-steps">Eine gemeinsame Journey</h2>
      <ol className="processSteps" aria-label="Ablauf der Alumni-Befragung">
        <li><h3>Einladung öffnen</h3><p>Der Link legt Hochschule, Studiengang und Befragung fest. Die Teilnahme ist freiwillig.</p></li>
        <li><h3>Karriereweg prüfen</h3><p>Autorisierte LinkedIn-Daten oder ein separat gewähltes synthetisches Testprofil führen in dieselbe Prüfung.</p></li>
        <li><h3>Datenspende bestätigen</h3><p>Den eigenen Referenzabschluss und den Beitrag ausdrücklich bestätigen. Erst dann wird gespeichert.</p></li>
        <li><h3>Ergebnisse auswerten</h3><p>Im geschützten Betreiberbereich erscheinen ausschließlich bestätigte Antworten der gewählten Befragung im Sankey.</p></li>
      </ol>
    </section>
    <section className="plannedProcess" aria-labelledby="alumni-start">
      <h2 id="alumni-start">Du möchtest teilnehmen?</h2>
      <p>Öffne den Einladungslink deiner Befragung. Er führt direkt zu den Informationen und zum Beginn deiner Datenspende.</p>
    </section>
    <p className="demoNote">Lokaler Entwicklungsprototyp. Der synthetische Testweg benötigt keinen LinkedIn-Zugriff. Es gibt keine öffentliche Freigabe individueller Karriereprofile oder Ergebnisse.</p>
  </main>;
}

export default async function JourneyHome() {
  if (surveyAccess(await headers(), false) !== 200) notFound();
  return <JourneyHomeContent />;
}
