import "server-only";
import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import type { PrismaClient } from "../../generated/prisma/client";
import { surveyAccess, surveyConfiguration, surveyHeaders } from "../surveys/access";
import { readSurveyInvitation, isSurveyId } from "../surveys/service";
import { SurveyNotOpenError } from "../survey-service";
import { manualParticipationEnabled, participationLinkedInEnabled } from "./manual-access";
import { participationCookie as manualParticipationCookie, participationSessions as manualParticipationSessions, participationLinkedInCookie } from "./participation-session";
import { localLinkedInSessions } from "../dev-import/linkedin/sessions";
import { readBoundedBody } from "./routes";
import { ManualParticipationError, parseManualParticipation } from "./manual";
import { saveManualParticipation } from "./manual-service";

export { manualParticipationCookie, manualParticipationSessions };
type Receipt = { degrees: number; careerSteps: number; timelineItems: number };
const json = (value: unknown, status = 200) => NextResponse.json(value, { status, headers: surveyHeaders });
const receipt = (saved: Receipt) => ({ degrees: saved.degrees, careerSteps: saved.careerSteps, timelineItems: saved.timelineItems });

export function createManualParticipationHandlers(client: () => Promise<PrismaClient>) {
  return async function handle(request: NextRequest, surveyId: string) {
    if (!isSurveyId(surveyId) || !manualParticipationEnabled(surveyId) || surveyAccess(request.headers, false) !== 200) return json({ code: "UNAVAILABLE" }, 404);
    const mutation = request.method === "POST";
    if (mutation && request.headers.get("origin") !== `${request.nextUrl.protocol}//${request.headers.get("host")}`) return json({ code: "UNAVAILABLE" }, 404);
    try {
      const db = await client(), configuration = surveyConfiguration();
      const survey = await readSurveyInvitation(db, surveyId, configuration);
      if (!survey || survey.status !== "OPEN") return json({ code: "SURVEY_NOT_OPEN" }, 409);
      const body = mutation ? await readBoundedBody(request) : null;
      const session = manualParticipationSessions.get(request.cookies.get(manualParticipationCookie)?.value, surveyId);
      if (body && Object.keys(body).length === 1 && ["manual", "linkedin"].includes(body.begin)) {
        if (session?.pending) return json({ code: "ALREADY_SUBMITTED" }, 409);
        if (body.begin === "linkedin" && !participationLinkedInEnabled(surveyId)) return json({ code: "LINKEDIN_UNAVAILABLE" }, 503);
        localLinkedInSessions().remove(request.cookies.get(participationLinkedInCookie)?.value);
        const created = manualParticipationSessions.create(surveyId, body.begin);
        const response = json({ started: true });
        response.cookies.set(participationLinkedInCookie, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
        response.cookies.set(manualParticipationCookie, created.id, { httpOnly: true, sameSite: "lax", secure: request.nextUrl.protocol === "https:", path: "/", maxAge: 1800 });
        return response;
      }
      if (body?.begin !== undefined) return json({ code: "INVALID_REQUEST" }, 400);
      if (!session) return json({ code: "SESSION_REQUIRED" }, 401);
      if (!mutation) return session.pending ? json({ saved: true, receipt: receipt(await session.pending as Receipt) }) : json({ saved: false });
      if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).join() !== "input") return json({ code: "INVALID_REQUEST" }, 400);
      const input = parseManualParticipation(body.input);
      const digest = createHash("sha256").update(JSON.stringify(input)).digest("hex");
      const saved = await manualParticipationSessions.save(session, digest, () => saveManualParticipation(db, surveyId, input, configuration));
      localLinkedInSessions().remove(request.cookies.get(participationLinkedInCookie)?.value);
      return json({ saved: true, receipt: receipt(saved) });
    } catch (error) {
      if (error instanceof SurveyNotOpenError) return json({ code: "SURVEY_NOT_OPEN" }, 409);
      if (error instanceof ManualParticipationError) return json({ code: "INVALID_INPUT", message: error.message }, 400);
      return json({ code: "SAVE_FAILED" }, 400);
    }
  };
}
