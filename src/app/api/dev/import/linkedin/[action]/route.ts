import "server-only";
import { readLinkedInConfig } from "../../../../../../lib/dev-import/linkedin/config";
import { createLinkedInProvider } from "../../../../../../lib/dev-import/linkedin/provider";
import { createLinkedInHandlers } from "../../../../../../lib/dev-import/linkedin/routes";
import { localLinkedInSessions } from "../../../../../../lib/dev-import/linkedin/sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const handlers = createLinkedInHandlers({ config: readLinkedInConfig, provider: createLinkedInProvider, store: localLinkedInSessions() });
export const GET = handlers.GET;
export const POST = handlers.POST;
