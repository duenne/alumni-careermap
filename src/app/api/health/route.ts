import { checkDatabase } from "@/lib/db";
import { checkHealth } from "@/lib/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const result = await checkHealth(checkDatabase);
  return Response.json(result.body, {
    status: result.statusCode,
    headers: { "Cache-Control": "no-store" },
  });
}
