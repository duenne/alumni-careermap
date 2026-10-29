import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { mappingClient } from "../../../lib/career-import/sandbox-db";
import { surveyAccess, surveyConfiguration } from "../../../lib/surveys/access";
import { isSurveyId, readSurveyInvitation } from "../../../lib/surveys/service";
import DonationStart from "./donation-start";
import SyntheticEntry from "./synthetic-entry";
import styles from "../surveys.module.css";

export const metadata = { title: "Alumni-Befragung · Alumni CareerMap", robots: { index: false, follow: false } };
export default async function SurveyEntryPage({ params, searchParams }: { params: Promise<{ surveyId: string }>; searchParams?: Promise<{ session?: string }> }) {
  if (surveyAccess(await headers(), false) !== 200) notFound();
  const { surveyId } = await params;
  if (!isSurveyId(surveyId)) notFound();
  let context;
  try { context = await readSurveyInvitation(await mappingClient(), surveyId, surveyConfiguration()); }
  catch { return <main id="inhalt" tabIndex={-1}><h1>Befragung derzeit nicht verfügbar</h1><p>Bitte versuchen Sie es später erneut.</p></main>; }
  if (!context) notFound();
  const sessionMissing = (await searchParams)?.session === "missing";
  const program = context.referenceProgram;
  return <main id="inhalt" tabIndex={-1} className={styles.stack}>
    <p className="eyebrow">Alumni-Befragung · {process.env.CAREERMAP_DEV_DONATION === "1" ? "Entwicklungsprototyp" : "Synthetischer Test"}</p>
    <h1>{context.name}</h1>
    {sessionMissing && <p role="status">Deine Teilnahmesitzung ist hier nicht mehr verfügbar. Bitte starte über diese Befragungsinformation erneut.</p>}
    {sessionMissing && <p>Falls du bereits eine Speicherbestätigung erhalten hast, ist dein Beitrag vorhanden. Bitte lege dann keine weitere Datenspende an.</p>}
    <dl className={styles.context} aria-label="Befragungskontext">
      <dt>Hochschule</dt><dd>{program.institution.name}</dd>
      <dt>Fakultät</dt><dd>{program.faculty ?? "Nicht hinterlegt"}</dd>
      <dt>Studiengang</dt><dd>{program.name}</dd>
      <dt>Befragung</dt><dd>{context.name}</dd>
    </dl>
    {context.status === "CLOSED" ? <section className={styles.card}><h2>Diese Befragung ist geschlossen</h2><p>Eine Teilnahme ist derzeit nicht möglich.</p></section> : <>
      <section className={styles.card} aria-labelledby="participation-info">
        <h2 id="participation-info">Karrierewege nach dem Studium verstehen</h2>
        <p>Die geplante Befragung soll Bildungs- und Berufswege ehemaliger Studierender sichtbar machen. Individuelle Karriereprofile werden nicht öffentlich zugänglich gemacht.</p>
        <p>Der Link legt nur die Befragung fest. Ein persönlicher Referenzabschluss muss später ausdrücklich ausgewählt und bestätigt werden.</p>
        <p>{process.env.CAREERMAP_DEV_DONATION === "1" ? "Status: Geöffnet. Die Teilnahme beginnt im folgenden Schritt; gespeicherte Testbeiträge bleiben im geschützten Betreiberbereich." : "Dieser lokale Test verwendet ausschließlich synthetische Angaben. Es werden keine Teilnahme und keine Karriereprofile gespeichert. Sie können die Vorschau jederzeit verlassen."}</p>
      </section>
      {process.env.CAREERMAP_DEV_DONATION === "1" ? <DonationStart surveyId={surveyId} synthetic={process.env.CAREERMAP_SYNTHETIC_DONATION === "1"} /> : <SyntheticEntry programName={program.name} />}
    </>}
  </main>;
}
