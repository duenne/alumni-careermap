import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { manualParticipationEnabled } from "../../../../lib/donation/manual-access";
import { manualParticipationCookie, manualParticipationSessions } from "../../../../lib/donation/manual-routes";
import { surveyAccess, surveyConfiguration } from "../../../../lib/surveys/access";
import { surveyClient } from "../../../../lib/surveys/client";
import { readSurveyInvitation, isSurveyId } from "../../../../lib/surveys/service";
import ManualEntry from "../manual-entry";
import LinkedInEntry from "../linkedin-entry";
import { institutionLabel } from "../../../../lib/surveys/presentation";
import styles from "../../surveys.module.css";

// A client-side navigation retains the invitation document's no-referrer
// policy unless metadata updates it. The native OAuth POST needs its own origin.
export const metadata = { title: "Deinen Werdegang erfassen · Alumni CareerMap", referrer: "same-origin", robots: { index: false, follow: false } };
export default async function ManualParticipationPage({ params }: { params: Promise<{ surveyId: string }> }) {
  const { surveyId } = await params;
  if (!isSurveyId(surveyId) || !manualParticipationEnabled(surveyId) || surveyAccess(await headers(), false) !== 200) notFound();
  const survey = await readSurveyInvitation(await surveyClient(), surveyId, surveyConfiguration());
  if (!survey) notFound();
  if (survey.status !== "OPEN") return <main id="inhalt"><h1>Diese Befragung ist geschlossen</h1><p>Eine Teilnahme ist derzeit nicht möglich.</p></main>;
  const session = manualParticipationSessions.get((await cookies()).get(manualParticipationCookie)?.value, surveyId);
  if (!session) redirect(`/surveys/${surveyId}?session=missing`);
  const saved = session.pending ? await session.pending as { degrees: number; careerSteps: number; timelineItems: number } : undefined;
  return <main id="inhalt" tabIndex={-1} className={styles.stack}>
    <p className="eyebrow">Alumni CareerMap · {survey.referenceProgram.name}</p>
    <h1>Dein Weg nach dem Studium</h1>
    {session.source === "linkedin" && !saved ? <LinkedInEntry surveyId={surveyId} programName={survey.referenceProgram.name} institutionName={institutionLabel(survey.referenceProgram.institution)} />
      : <ManualEntry surveyId={surveyId} programName={survey.referenceProgram.name} institutionName={institutionLabel(survey.referenceProgram.institution)}
        receipt={saved ? { degrees: saved.degrees, careerSteps: saved.careerSteps, timelineItems: saved.timelineItems } : undefined} />}
  </main>;
}
