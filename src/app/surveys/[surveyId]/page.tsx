import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { surveyClient } from "../../../lib/surveys/client";
import { surveyAccess, surveyConfiguration } from "../../../lib/surveys/access";
import { isSurveyId, readSurveyInvitation } from "../../../lib/surveys/service";
import DonationStart from "./donation-start";
import SyntheticEntry from "./synthetic-entry";
import ManualStart from "./manual-start";
import { manualParticipationEnabled, participationLinkedInEnabled } from "../../../lib/donation/manual-access";
import styles from "../surveys.module.css";

export const metadata = { title: "Alumni-Befragung · Alumni CareerMap", robots: { index: false, follow: false } };
export default async function SurveyEntryPage({ params, searchParams }: { params: Promise<{ surveyId: string }>; searchParams?: Promise<{ session?: string }> }) {
  if (surveyAccess(await headers(), false) !== 200) notFound();
  const { surveyId } = await params;
  if (!isSurveyId(surveyId)) notFound();
  let context;
  try { context = await readSurveyInvitation(await surveyClient(), surveyId, surveyConfiguration()); }
  catch { return <main id="inhalt" tabIndex={-1}><h1>Befragung derzeit nicht verfügbar</h1><p>Bitte versuchen Sie es später erneut.</p></main>; }
  if (!context) notFound();
  const sessionMissing = (await searchParams)?.session === "missing";
  const program = context.referenceProgram;
  const manualParticipation = manualParticipationEnabled(surveyId);
  const surveyDetails = <dl className={styles.context} aria-label="Befragungskontext">
    <dt>Hochschule</dt><dd>{program.institution.name}</dd>
    <dt>Fakultät</dt><dd>{program.faculty ?? "Nicht hinterlegt"}</dd>
    <dt>Studiengang</dt><dd>{program.name}</dd>
    <dt>Befragung</dt><dd>{context.name}</dd>
  </dl>;
  if (process.env.CAREERMAP_DEV_DONATION !== "1") return <main id="inhalt" tabIndex={-1} className={`${styles.stack} ${styles.previewEntry}`}>
    <header className={styles.previewHeading}>
      <p className="eyebrow">Alumni CareerMap · {manualParticipation ? "Alumni-Befragung" : "Synthetische Vorschau"}</p>
      <h1>Dein Weg nach dem Studium</h1>
    </header>
    <section className={`${styles.card} ${styles.previewIntro}`} aria-labelledby="preview-purpose">
      <p className={styles.previewProgram}>{program.name}</p>
      <h2 id="preview-purpose">Wo hat dich dein Studium hingeführt?</h2>
      <p>Mit Alumni CareerMap möchten wir zeigen, welche beruflichen und akademischen Wege nach dem Studium möglich sind. Deine Erfahrungen könnten später helfen, diese Wege sichtbar zu machen.</p>
    </section>
    <p className={styles.previewNotice}>{manualParticipation ? "Hier kannst du deinen eigenen Karriereweg abgeben. Deine Angaben werden erst nach deiner Prüfung und ausdrücklichen Bestätigung gespeichert. Name und E-Mail sind dafür nicht erforderlich." : "Dies ist nur eine Vorschau. Hier werden keine persönlichen Daten abgefragt und keine Teilnahme oder Karriereprofile gespeichert."}</p>
    {manualParticipation && sessionMissing && <p role="status">Deine Teilnahmesitzung ist nicht mehr verfügbar. Falls du bereits abgesendet hast, starte bitte keine neue Teilnahme, sondern prüfe die vorhandene Speicherbestätigung oder kontaktiere den Betreiber.</p>}
    {context.status === "CLOSED" ? <section className={styles.card}><h2>Diese Befragung ist geschlossen</h2><p>Eine Teilnahme ist derzeit nicht möglich.</p></section> : <>
      {manualParticipation && <ManualStart surveyId={surveyId} linkedInAvailable={participationLinkedInEnabled(surveyId)} />}
      <section aria-labelledby="preview-process">
        <h2 id="preview-process">{manualParticipation ? "So funktioniert deine Teilnahme" : "So ist eine spätere Teilnahme geplant"}</h2>
        <ol className={`${styles.journeySteps} ${styles.previewSteps}`} aria-label="Geplanter Ablauf">
          <li><span className={styles.stepNumber} aria-hidden="true">1</span><div><h3>Werdegang ansehen</h3><p>Studien- und Berufsstationen prüfen.</p></div></li>
          <li><span className={styles.stepNumber} aria-hidden="true">2</span><div><h3>Studium auswählen</h3><p>Den passenden eigenen Abschluss bestimmen.</p></div></li>
          <li><span className={styles.stepNumber} aria-hidden="true">3</span><div><h3>Freigabe entscheiden</h3><p>Erst danach über eine Teilnahme entscheiden.</p></div></li>
        </ol>
      </section>
      <section className={`${styles.card} ${styles.stack} ${styles.previewStudy}`} aria-labelledby="preview-study">
        <h2 id="preview-study">Dein Studium als Ausgangspunkt</h2>
        <p>Dein eigener Abschluss im ausgewählten Studiengang ist der Ausgangspunkt für die Auswertung deines Karrierewegs. Wenn du mehrere Abschlüsse hast, sollst du selbst entscheiden können, welcher zu dieser Befragung gehört.</p>
        {!manualParticipation && <SyntheticEntry programName={program.name} />}
      </section>
    </>}
    <details className={`${styles.card} ${styles.previewDetails}`}>
      <summary>Angaben zur Befragung</summary>
      {surveyDetails}
    </details>
  </main>;
  return <main id="inhalt" tabIndex={-1} className={styles.stack}>
    <p className="eyebrow">Alumni-Befragung · Entwicklungsprototyp</p>
    <h1>{context.name}</h1>
    {sessionMissing && <p role="status">Deine Teilnahmesitzung ist hier nicht mehr verfügbar. Bitte starte über diese Befragungsinformation erneut.</p>}
    {sessionMissing && <p>Falls du bereits eine Speicherbestätigung erhalten hast, ist dein Beitrag vorhanden. Bitte lege dann keine weitere Datenspende an.</p>}
    {surveyDetails}
    {context.status === "CLOSED" ? <section className={styles.card}><h2>Diese Befragung ist geschlossen</h2><p>Eine Teilnahme ist derzeit nicht möglich.</p></section> : <>
      <section className={styles.card} aria-labelledby="participation-info">
        <h2 id="participation-info">Karrierewege nach dem Studium verstehen</h2>
        <p>Die geplante Befragung soll Bildungs- und Berufswege ehemaliger Studierender sichtbar machen. Individuelle Karriereprofile werden nicht öffentlich zugänglich gemacht.</p>
        <p>Der Link legt nur die Befragung fest. Ein persönlicher Referenzabschluss muss später ausdrücklich ausgewählt und bestätigt werden.</p>
        <p>Status: Geöffnet. Die Teilnahme beginnt im folgenden Schritt; gespeicherte Testbeiträge bleiben im geschützten Betreiberbereich.</p>
      </section>
      <DonationStart surveyId={surveyId} synthetic={process.env.CAREERMAP_SYNTHETIC_DONATION === "1"} />
    </>}
  </main>;
}
