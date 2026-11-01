import { checkDatabase } from "../../../lib/db";
import { checkHealth } from "../../../lib/health";
import { localDemoRequested } from "../../../lib/local-demo/config";
import { localDemoClient } from "../../../lib/local-demo/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const result = await checkHealth(localDemoRequested() ? async () => { await localDemoClient(); } : checkDatabase);
  return Response.json(result.body, {
    status: result.statusCode,
    headers: { "Cache-Control": "no-store" },
  });
}
