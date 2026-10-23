import { createMappingHandlers } from "../../../../../lib/career-import/routes";
import { mappingClient } from "../../../../../lib/career-import/sandbox-db";

const handlers = createMappingHandlers({ client: mappingClient });
export const GET = handlers.GET;
export const POST = handlers.POST;
