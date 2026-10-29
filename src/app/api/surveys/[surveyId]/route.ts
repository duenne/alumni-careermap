import { mappingClient } from "../../../../lib/career-import/sandbox-db";
import { createSurveyHandlers } from "../../../../lib/surveys/routes";

const handlers = createSurveyHandlers({ client: mappingClient });
export async function GET(request: Request, context: { params: Promise<{ surveyId: string }> }) {
  return handlers.invitation(request, (await context.params).surveyId);
}
