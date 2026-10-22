import fixture from "../../src/test-fixtures/linkedin-snapshots/fictional-member.json" with { type: "json" };

// Loaded only by the isolated OAuth browser-test server, never by the app.
if (process.env.CAREERMAP_DEV_IMPORT_TEST !== "1"
  || process.env.LINKEDIN_CLIENT_ID !== "synthetic-client"
  || process.env.LINKEDIN_CLIENT_SECRET !== "synthetic-secret"
  || process.env.LINKEDIN_REDIRECT_URI !== "http://127.0.0.1:3104/auth/linkedin/portability/callback") {
  throw new Error("The OAuth network mock requires the isolated synthetic configuration.");
}

const fetchLocal = globalThis.fetch;
globalThis.fetch = async (input, options) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.origin === "http://127.0.0.1:3104" || url.origin === "http://localhost:3104") {
    return fetchLocal(input, options);
  }
  if (url.href === "https://www.linkedin.com/oauth/v2/accessToken" && options?.method === "POST") {
    const body = new URLSearchParams(options.body);
    if (body.get("code") !== "synthetic-code" || body.get("client_id") !== "synthetic-client"
      || body.get("client_secret") !== "synthetic-secret"
      || body.get("redirect_uri") !== process.env.LINKEDIN_REDIRECT_URI) {
      return Response.json({ error: "synthetic_invalid_request" }, { status: 400 });
    }
    return Response.json({ access_token: "synthetic-token", expires_in: 3600, scope: "r_dma_portability_3rd_party" });
  }
  if (url.origin === "https://api.linkedin.com" && url.pathname === "/rest/memberSnapshotData"
    && new Headers(options?.headers).get("authorization") === "Bearer synthetic-token") {
    const domain = url.searchParams.get("domain");
    if (url.searchParams.get("q") !== "criteria" || !["EDUCATION", "POSITIONS"].includes(domain)) {
      throw new Error("Unexpected snapshot domain in the isolated provider mock.");
    }
    if (url.searchParams.get("start") === "1") return Response.json({ message: "No data found for this memberId" }, { status: 404 });
    if (url.searchParams.get("start") !== "0") throw new Error("Unexpected snapshot page in the isolated provider mock.");
    const element = structuredClone(fixture.elements.find(element => element.snapshotDomain === domain));
    if (domain === "POSITIONS") element.snapshotData[0].Title = "Synthetic Provider Snapshot Role";
    return Response.json({ elements: [element], paging: { start: 0, count: 10, total: 1, links: [] } });
  }
  // No provider request (or any other external fetch) may escape this test.
  throw new Error("External fetch blocked by the OAuth browser-test mock.");
};
