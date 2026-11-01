import "server-only";
import { type NextRequest } from "next/server";
import { createLinkedInHandlers } from "../dev-import/linkedin/routes";
import { createLinkedInProvider, type CareerDataProvider } from "../dev-import/linkedin/provider";
import { localLinkedInSessions, type EphemeralLinkedInSessions } from "../dev-import/linkedin/sessions";
import type { LinkedInConfig } from "../dev-import/linkedin/config";
import { readLocalDemoConfiguration } from "../local-demo/config";
import { surveyAccess, surveyConfiguration, surveyHeaders } from "../surveys/access";
import { surveyClient } from "../surveys/client";
import { readSurveyInvitation } from "../surveys/service";
import { participationLinkedInEnabled } from "./manual-access";
import { participationCookie, participationLinkedInCookie, participationOAuthStatePrefix, participationSessions } from "./participation-session";

type Dependencies = { client?: typeof surveyClient; provider?: (config: LinkedInConfig) => CareerDataProvider; store?: EphemeralLinkedInSessions };
export function createParticipationLinkedInHandlers(dependencies: Dependencies = {}) {
  const session = (request: NextRequest) => participationSessions.get(request.cookies.get(participationCookie)?.value);
  const handlers = createLinkedInHandlers({
    config: () => { try { return readLocalDemoConfiguration().linkedIn ?? null; } catch { return null; } },
    provider: dependencies.provider ?? createLinkedInProvider, store: dependencies.store ?? localLinkedInSessions(),
  }, {
    apiPath: "/api/participation/linkedin", cookieName: participationLinkedInCookie, statePrefix: participationOAuthStatePrefix,
    allowed: request => {
      const bound = session(request);
      return !!bound && bound.source === "linkedin" && !bound.pending && participationLinkedInEnabled(bound.surveyId) && surveyAccess(request.headers, false) === 200;
    },
    // The registered localhost callback may relay back to the installation.
    // Neither the destination nor the redirect URI comes from request input.
    acceptRequestOrigin: (request, config) => {
      try {
        const installation = readLocalDemoConfiguration();
        return `${new URL(request.url).protocol}//${request.headers.get("host")}` === installation.origin && config.redirectUri === installation.linkedIn?.redirectUri;
      } catch { return false; }
    },
    returnPath: request => `/surveys/${session(request)!.surveyId}/participation`,
  });
  return async function handle(request: NextRequest) {
    const unavailable = (status: number) => new Response("LinkedIn ist für diese Teilnahme nicht verfügbar.", { status, headers: surveyHeaders });
    if (surveyAccess(request.headers, false) !== 200) return unavailable(404);
    const bound = session(request);
    if (!bound || bound.source !== "linkedin") return unavailable(401);
    if (!participationLinkedInEnabled(bound.surveyId)) return unavailable(404);
    if (bound.pending) return unavailable(409);
    if (new URL(request.url).pathname.endsWith("raw-snapshot")) return unavailable(404);
    try {
      const survey = await readSurveyInvitation(await (dependencies.client ?? surveyClient)(), bound.surveyId, surveyConfiguration());
      if (!survey || survey.status !== "OPEN") return unavailable(409);
    } catch { return unavailable(409); }
    return request.method === "GET" ? handlers.GET(request) : handlers.POST(request);
  };
}
export const participationOAuth = createParticipationLinkedInHandlers();
