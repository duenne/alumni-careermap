import { surveyClient } from "../../../../lib/surveys/client";
import { createSurveyHandlers } from "../../../../lib/surveys/routes";

const handlers = createSurveyHandlers({ client: surveyClient });
export const GET = handlers.GET;
export const POST = handlers.POST;
