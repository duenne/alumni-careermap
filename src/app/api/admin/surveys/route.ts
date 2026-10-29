import { mappingClient } from "../../../../lib/career-import/sandbox-db";
import { createSurveyHandlers } from "../../../../lib/surveys/routes";

const handlers = createSurveyHandlers({ client: mappingClient });
export const GET = handlers.GET;
export const POST = handlers.POST;
