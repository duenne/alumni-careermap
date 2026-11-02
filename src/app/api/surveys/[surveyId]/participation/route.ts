import type { NextRequest } from "next/server";
import { surveyClient } from "../../../../../lib/surveys/client";
import { createManualParticipationHandlers } from "../../../../../lib/donation/manual-routes";
const handle = createManualParticipationHandlers(surveyClient);
export async function GET(request: NextRequest, context: { params: Promise<{ surveyId: string }> }) {
  return handle(request, (await context.params).surveyId);
}
export const POST = GET;
