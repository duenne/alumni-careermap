import "server-only";
import fixture from "../../../../../test-fixtures/linkedin-snapshots/fictional-member.json";
import { projectSnapshot } from "../../../../../lib/dev-import/json-preview";
import { allowDevImport } from "../../../../../lib/dev-import/access";

const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" };

export async function GET(request: Request) {
  if (!allowDevImport(request.headers) || new URL(request.url).searchParams.get("id") !== "fictional-member") {
    return new Response("Nicht verfügbar.", { status: 404, headers });
  }
  // A server-owned ID resolves the repository fixture. No client JSON is accepted.
  // V1b must resolve this ID again; a returned ID is not a persistence capability.
  return Response.json({ fixtureId: "fictional-member", snapshot: projectSnapshot(fixture), reviewSourceKey: "snapshot:2:0" }, { headers });
}
