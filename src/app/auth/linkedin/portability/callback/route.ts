import { GET as callback } from "../../../../api/dev/import/linkedin/[action]/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: import("next/server").NextRequest) {
  if(request.cookies.has("careermap_linkedin_survey")) return (await import("../../../../../lib/donation/linkedin")).donationOAuth(request);
  return callback(request);
}
