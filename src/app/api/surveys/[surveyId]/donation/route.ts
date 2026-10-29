import type { NextRequest } from "next/server";
import { mappingClient } from "../../../../../lib/career-import/sandbox-db";
import { createDonationHandlers } from "../../../../../lib/donation/routes";
const handle=createDonationHandlers(mappingClient);
export async function GET(request:NextRequest,context:{params:Promise<{surveyId:string}>}){return handle(request,(await context.params).surveyId);}
export const POST=GET;
