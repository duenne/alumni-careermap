import { surveyClient } from "../../../../lib/surveys/client";
import { createSurveyHandlers } from "../../../../lib/surveys/routes";

const handlers = createSurveyHandlers({ client: surveyClient });
export async function GET(request: Request, context: { params: Promise<{ surveyId: string }> }) {
  return handlers.invitation(request, (await context.params).surveyId);
}
