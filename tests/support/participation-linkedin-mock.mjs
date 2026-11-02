// Explicitly preloaded ONLY by the disposable production browser-test runner.
// It is outside the isolated app/build and refuses actual application credentials.
const origin = process.env.CAREERMAP_LOCAL_DEMO_ORIGIN;
if (process.env.CAREERMAP_LOCAL_DEMO !== "v5-participation"
  || process.env.CAREERMAP_LOCAL_LINKEDIN_CLIENT_ID !== "synthetic-client"
  || process.env.CAREERMAP_LOCAL_LINKEDIN_CLIENT_SECRET !== "synthetic-secret"
  || !origin?.startsWith("http://127.0.0.1:")) throw new Error("SYNTHETIC_PARTICIPATION_PROVIDER_REQUIRED");
const localFetch = globalThis.fetch;
globalThis.fetch = async (input, options) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.origin === origin) return localFetch(input, options);
  if (url.href === "https://www.linkedin.com/oauth/v2/accessToken" && options?.method === "POST") {
    const body = new URLSearchParams(options.body);
    if (body.get("code") !== "synthetic-code" || body.get("client_id") !== "synthetic-client" || body.get("client_secret") !== "synthetic-secret"
      || body.get("redirect_uri") !== process.env.CAREERMAP_LOCAL_LINKEDIN_REDIRECT_URI) return Response.json({ error: "synthetic-invalid-request" }, { status: 400 });
    return Response.json({ access_token: "synthetic-token", expires_in: 3600, scope: "r_dma_portability_3rd_party" });
  }
  if (url.origin === "https://api.linkedin.com" && url.pathname === "/rest/memberSnapshotData" && new Headers(options?.headers).get("authorization") === "Bearer synthetic-token") {
    const domain = url.searchParams.get("domain");
    if (!["EDUCATION", "POSITIONS"].includes(domain) || url.searchParams.get("start") !== "0") throw new Error("UNEXPECTED_SYNTHETIC_SNAPSHOT_REQUEST");
    return Response.json({ elements: [{ snapshotDomain: domain, snapshotData: domain === "EDUCATION"
      ? [{ "Degree Name": "Synthetic Imported Master", "School Name": "Synthetic import university", "Start Date": "2018", "End Date": "2020" }]
      : [{ Title: "Synthetic Imported Developer", "Company Name": "Synthetic import employer", "Started On": "2021", "Finished On": "" }] }] });
  }
  throw new Error("EXTERNAL_TEST_FETCH_BLOCKED");
};
