import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { readLinkedInConfig } from "./config";
import { createLinkedInProvider, PortabilityError } from "./provider";

const env = {
  NODE_ENV: "development", CAREERMAP_DEV_IMPORT: "1", LINKEDIN_PORTABILITY_MODE: "third_party",
  LINKEDIN_PORTABILITY_SCOPE: "r_dma_portability_3rd_party", LINKEDIN_CLIENT_ID: "synthetic-client",
  LINKEDIN_CLIENT_SECRET: "synthetic-secret", LINKEDIN_REDIRECT_URI: "http://localhost:3100/auth/linkedin/portability/callback",
};
const config = () => {
  const result = readLinkedInConfig(env);
  if (!result) throw new Error("Expected synthetic test configuration");
  return result;
};
const page = (domain: string, start = 0, next?: string) => Response.json({
  elements: [{ snapshotDomain: domain, snapshotData: [domain === "EDUCATION"
    ? { "Degree Name": `Synthetic Degree ${start}`, "School Name": "Synthetic School", "Start Date": "around 2018", "End Date": "", Notes: "PRIVATE_SYNTHETIC_MARKER" }
    : { Title: `Synthetic Job ${start}`, "Company Name": "Synthetic Company", "Started On": "2022", "Finished On": "", Description: "PRIVATE_SYNTHETIC_MARKER" }] }],
  paging: { start, count: 10, total: 1, links: next ? [{ rel: "next", href: next }] : [] },
});
const end = () => Response.json({ message: "No data found for this memberId" }, { status: 404 });
const endMessages = [
  "No data found for this domain and memberId.",
  "No data found for this memberId",
  "No data found for memberId: synthetic-member",
  "  NO  DATA\nFOUND for this member id: synthetic-member  ",
];

describe("V1b official portability provider (synthetic HTTP responses only)", () => {
  it("distinguishes response size, JSON syntax and paging failures using content-free diagnostics", async () => {
    const cases = [
      { response: () => new Response("x".repeat(500_001)), code: "RESPONSE_TOO_LARGE", reason: "BODY_SIZE" },
      { response: () => new Response('{"PRIVATE_SYNTHETIC_MARKER":'), code: "INVALID_RESPONSE", reason: "JSON_SYNTAX" },
      { response: () => Response.json({ elements: [{ snapshotDomain: "EDUCATION", snapshotData: [] }], paging: { start: 7, links: [] } }), code: "INVALID_RESPONSE", reason: "PAGING_START" },
    ];
    for (const example of cases) {
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(example.response());
      await expect(createLinkedInProvider(config(), fetcher).snapshot("synthetic-token")).rejects.toMatchObject({
        code: example.code, diagnostic: { domain: "EDUCATION", page: 0, reason: example.reason },
      });
      expect(fetcher).toHaveBeenCalledTimes(1);
    }
  });
  it("keeps unsupported fields out of diagnostics and identifies the requested domain, page and HTTP status", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(page("EDUCATION")).mockResolvedValueOnce(end())
      .mockResolvedValueOnce(Response.json({ message: "PRIVATE_SYNTHETIC_MARKER" }, { status: 426 }));
    await expect(createLinkedInProvider(config(), fetcher).snapshot("synthetic-token")).rejects.toMatchObject({
      code: "PROVIDER_UNAVAILABLE", diagnostic: { domain: "POSITIONS", page: 0, reason: "HTTP_STATUS", httpStatus: 426 },
    });
  });
  it("requires explicit product/scope and local development configuration", () => {
    expect(readLinkedInConfig({})).toBeNull();
    for (const extra of [
      { NODE_ENV: "production" }, { CAREERMAP_DEV_IMPORT: "0" }, { LINKEDIN_CLIENT_SECRET: "" },
      { LINKEDIN_PORTABILITY_SCOPE: "openid profile email" },
      { LINKEDIN_PORTABILITY_SCOPE: "r_dma_portability_self_serve" },
      { LINKEDIN_REDIRECT_URI: "http://localhost:3100/api/dev/import/linkedin/callback" },
      { LINKEDIN_REDIRECT_URI: "https://external.invalid/api/dev/import/linkedin/callback" },
      { LINKEDIN_REDIRECT_URI: env.LINKEDIN_REDIRECT_URI + "?redirect=evil" },
    ]) expect(readLinkedInConfig({ ...env, ...extra })).toBeNull();
    expect(readLinkedInConfig({ ...env, LINKEDIN_PORTABILITY_MODE: "member", LINKEDIN_PORTABILITY_SCOPE: "r_dma_portability_member" })?.mode).toBe("member");
    expect(readLinkedInConfig({ ...env, LINKEDIN_PORTABILITY_MODE: "third_party", LINKEDIN_PORTABILITY_SCOPE: "r_dma_portability_3rd_party" })?.mode).toBe("third_party");
    expect(readLinkedInConfig({ ...env, LINKEDIN_REDIRECT_URI: env.LINKEDIN_REDIRECT_URI.replace("http:", "https:") })).not.toBeNull();
  });
  it("builds official OAuth and exchanges the code only server-side with the exact redirect", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ access_token: "synthetic-token", expires_in: 3600, scope: env.LINKEDIN_PORTABILITY_SCOPE, refresh_token: "ignored" }));
    const provider = createLinkedInProvider(config(), fetcher);
    const url = new URL(provider.authorizationUrl("unguessable-synthetic-state"));
    expect(url.origin + url.pathname).toBe("https://www.linkedin.com/oauth/v2/authorization");
    expect(url.searchParams.get("state")).toBe("unguessable-synthetic-state");
    expect(url.searchParams.get("scope")).toBe(env.LINKEDIN_PORTABILITY_SCOPE);
    expect(url.toString()).not.toContain("synthetic-secret");
    expect(await provider.exchange("synthetic-code")).toEqual({ accessToken: "synthetic-token", expiresIn: 3600 });
    const [endpoint, options] = fetcher.mock.calls[0];
    expect(endpoint).toBe("https://www.linkedin.com/oauth/v2/accessToken");
    expect(options).toMatchObject({ method: "POST", cache: "no-store", redirect: "error" });
    expect(new URLSearchParams(options?.body as URLSearchParams).get("client_secret")).toBe("synthetic-secret");
    expect(new URLSearchParams(options?.body as URLSearchParams).get("redirect_uri")).toBe(env.LINKEDIN_REDIRECT_URI);
  });
  it("retrieves both career domains, follows pages beyond inaccurate total, minimizes fields and reuses the adapter", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(page("EDUCATION", 0, "/rest/memberSnapshotData?q=criteria&domain=EDUCATION&start=1&count=10"))
      .mockResolvedValueOnce(page("EDUCATION", 1)).mockResolvedValueOnce(end())
      .mockResolvedValueOnce(page("POSITIONS")).mockResolvedValueOnce(end());
    const result = await createLinkedInProvider(config(), fetcher).snapshot("synthetic-token");
    expect(result.elements.map(e => [e.snapshotDomain, e.snapshotData.length])).toEqual([["PROFILE", 1], ["POSITIONS", 1], ["EDUCATION", 2]]);
    expect(result.elements[0].snapshotData).toEqual([{}]);
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE_SYNTHETIC_MARKER|Description|Notes|access_token/);
    expect(result.elements[2].snapshotData[0]["Start Date"]).toBe("around 2018");
    expect(result.elements[2].snapshotData[0]["End Date"]).toBe("");
    expect(fetcher).toHaveBeenCalledTimes(5);
    for (const [endpoint, options] of fetcher.mock.calls) {
      expect(String(endpoint)).not.toContain("domain=PROFILE");
      const headers = new Headers(options?.headers);
      expect(headers.get("LinkedIn-Version")).toBe("202312");
      expect(headers.get("Authorization")).toBe("Bearer synthetic-token");
    }
  });
  it.each([401, 403, 429, 500, 426])("returns safe typed errors for HTTP %s, never partial career data", async status => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(page("EDUCATION")).mockResolvedValueOnce(end())
      .mockResolvedValueOnce(Response.json({ message: "PRIVATE_SYNTHETIC_MARKER" }, { status }));
    await expect(createLinkedInProvider(config(), fetcher).snapshot("synthetic-token")).rejects.toBeInstanceOf(PortabilityError);
    try { await createLinkedInProvider(config(), vi.fn<typeof fetch>().mockResolvedValue(Response.json({ message: "PRIVATE_SYNTHETIC_MARKER" }, { status }))).snapshot("synthetic-token"); }
    catch (error) { expect(String(error)).not.toMatch(/PRIVATE_SYNTHETIC_MARKER|synthetic-token/); }
  });
  it.each(endMessages)("treats an initially missing snapshot as pending without exposing its no-data message: %#", async message => {
    await expect(createLinkedInProvider(config(), vi.fn<typeof fetch>().mockResolvedValue(Response.json({ message }, { status: 404 }))).snapshot("synthetic-token"))
      .rejects.toMatchObject({ code: "SNAPSHOT_PENDING" });
  });
  it.each(endMessages)("recognizes a no-data 404 after valid pages and continues with the other career domain: %#", async message => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(page("EDUCATION"))
      .mockResolvedValueOnce(Response.json({ message }, { status: 404 }))
      .mockResolvedValueOnce(page("POSITIONS"))
      .mockResolvedValueOnce(Response.json({ message }, { status: 404 }));
    const result = await createLinkedInProvider(config(), fetcher).snapshot("synthetic-token");
    expect(result.elements.map(element => [element.snapshotDomain, element.snapshotData.length])).toEqual([
      ["PROFILE", 1], ["POSITIONS", 1], ["EDUCATION", 1],
    ]);
    expect(JSON.stringify(result)).not.toContain("synthetic-member");
    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(fetcher.mock.calls.map(([url]) => new URL(String(url)).searchParams.get("domain"))).toEqual([
      "EDUCATION", "EDUCATION", "POSITIONS", "POSITIONS",
    ]);
  });
  it("does not turn an unrelated later 404 into a completed or pending snapshot", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(page("EDUCATION"))
      .mockResolvedValueOnce(Response.json({ message: "Resource not found" }, { status: 404 }));
    await expect(createLinkedInProvider(config(), fetcher).snapshot("synthetic-token"))
      .rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
  it.each([
    "https://evil.invalid/rest/memberSnapshotData?q=criteria&domain=EDUCATION&start=1",
    "/rest/anotherEndpoint?domain=EDUCATION&start=1",
    "/rest/memberSnapshotData?q=criteria&domain=PROFILE&start=1",
    "/rest/memberSnapshotData?q=criteria&domain=EDUCATION&start=0",
    "/rest/memberSnapshotData?q=criteria&domain=EDUCATION&start=1&access_token=leak",
  ])("rejects unsafe or looping pagination links before sending credentials: %s", async next => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(page("EDUCATION", 0, next));
    await expect(createLinkedInProvider(config(), fetcher).snapshot("synthetic-token")).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("does not mask malformed responses, network failures or wrong token scopes", async () => {
    for (const response of [Response.json({ access_token: "synthetic-token", expires_in: 3, scope: "openid" }), new Response("not JSON", { status: 400 })]) {
      await expect(createLinkedInProvider(config(), vi.fn<typeof fetch>().mockResolvedValue(response)).exchange("synthetic-code"))
        .rejects.toBeInstanceOf(PortabilityError);
    }
    await expect(createLinkedInProvider(config(), vi.fn<typeof fetch>().mockRejectedValue(new Error("PRIVATE_SYNTHETIC_MARKER"))).snapshot("synthetic-token"))
      .rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
    await expect(createLinkedInProvider(config(), vi.fn<typeof fetch>().mockResolvedValue(Response.json({ elements: [{ snapshotDomain: "EDUCATION", snapshotData: [{ unknown: "x" }] }] }))).snapshot("synthetic-token"))
      .rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
});
