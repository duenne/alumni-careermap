import { localDemoRequested, readLocalDemoConfiguration } from "../local-demo/config";

/** Explicit installation opt-in, restricted to one survey. Status and operator
 * affiliation must still be checked on every read and inside the save lock. */
export function manualParticipationEnabled(surveyId: string): boolean {
  if (!localDemoRequested()) return false;
  try {
    const config = readLocalDemoConfiguration();
    return config.mode === "v5-participation" && config.participationSurveyId === surveyId;
  } catch { return false; }
}
export function participationLinkedInEnabled(surveyId: string): boolean {
  if (!manualParticipationEnabled(surveyId)) return false;
  try { return !!readLocalDemoConfiguration().linkedIn; } catch { return false; }
}
