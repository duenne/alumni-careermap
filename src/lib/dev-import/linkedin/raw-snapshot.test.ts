import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createLinkedInProvider } from "./provider";
import type { LinkedInConfig } from "./config";

const config: LinkedInConfig = { mode: "third_party", scope: "r_dma_portability_3rd_party", clientId: "synthetic-client",
  clientSecret: "synthetic-secret", redirectUri: "http://localhost:3100/auth/linkedin/portability/callback" };
const page = (domain: string, start = 0) => Response.json({ elements: [{ snapshotDomain: domain,
  snapshotData: [{ unexpectedCareerField: "SYNTHETIC_RAW_VALUE" }] }], paging: { start, count: 10, links: [] } });

it("shows unconverted raw JSON and the second-page 404, then still reads POSITIONS", async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(page("EDUCATION"))
    .mockResolvedValueOnce(Response.json({ message: "No virtual resource found: synthetic-member", serviceErrorCode: 0, status: 404 }, { status: 404 }))
    .mockResolvedValueOnce(page("POSITIONS")).mockResolvedValueOnce(Response.json({ message: "Synthetic missing page" }, { status: 404 }));
  const result = await createLinkedInProvider(config, fetcher).rawSnapshot("synthetic-token");
  expect(result).toMatchObject({ kind: "linkedin-raw-preview", complete: false, domains: [
    { domain: "EDUCATION", stopped: "HTTP_ERROR", pages: [{ status: 200 }, { page: 1, status: 404,
      body: { message: "No virtual resource found: synthetic-member", serviceErrorCode: 0 } }] },
    { domain: "POSITIONS", pages: [{ status: 200 }, { status: 404 }] },
  ] });
  expect(JSON.stringify(result)).toContain("unexpectedCareerField");
  expect(fetcher).toHaveBeenCalledTimes(4);
  expect(fetcher.mock.calls.every(([url]) => ["EDUCATION", "POSITIONS"].includes(new URL(String(url)).searchParams.get("domain")!))).toBe(true);
});

it("removes credentials, header echoes and token substrings without removing ordinary source fields", async () => {
  const body = { arbitrarySourceField: "SYNTHETIC_RAW_VALUE", nested: { access_token: "another-synthetic-token", headers: { authorization: "Bearer secret" } },
    message: "synthetic-token and synthetic-secret", link: "https://example.invalid/?access_token=other-secret" };
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => Response.json(body));
  const result = await createLinkedInProvider(config, fetcher).rawSnapshot("synthetic-token");
  const text = JSON.stringify(result);
  expect(text).toContain("SYNTHETIC_RAW_VALUE");
  expect(text).toContain("[REDACTED]");
  expect(text).not.toMatch(/synthetic-token|synthetic-secret|other-secret|Bearer secret/);
  expect(body.nested.access_token).toBe("another-synthetic-token");
});

it("bounds the raw preview to two pages per domain and rejects unsafe next links", async () => {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async url => {
    const query = new URL(String(url)).searchParams;
    return page(query.get("domain")!, Number(query.get("start")));
  });
  const result = await createLinkedInProvider(config, fetcher).rawSnapshot("synthetic-token");
  expect(fetcher).toHaveBeenCalledTimes(4);
  expect(result.domains.map(domain => domain.stopped)).toEqual(["PREVIEW_LIMIT", "PREVIEW_LIMIT"]);
  const unsafe = vi.fn<typeof fetch>().mockImplementation(async () => Response.json({ paging: { start: 0,
    links: [{ rel: "next", href: "https://external.invalid/?access_token=secret" }] } }));
  const rejected = await createLinkedInProvider(config, unsafe).rawSnapshot("synthetic-token");
  expect(unsafe).toHaveBeenCalledTimes(2);
  expect(rejected.domains.every(domain => domain.diagnostic?.reason === "UNSAFE_PAGINATION")).toBe(true);
});

it("keeps size failures content-free while still collecting the other domain", async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response("x".repeat(500_001)))
    .mockResolvedValueOnce(Response.json({ unconverted: "SYNTHETIC_RAW_VALUE" }));
  const result = await createLinkedInProvider(config, fetcher).rawSnapshot("synthetic-token");
  expect(result.domains[0].diagnostic?.reason).toBe("BODY_SIZE");
  expect(result.domains[1].pages[0].body).toEqual({ unconverted: "SYNTHETIC_RAW_VALUE" });
});

it("still rejects expired/revoked authorization", async () => {
  for (const status of [401, 403]) {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ message: "not shown" }, { status }));
    await expect(createLinkedInProvider(config, fetcher).rawSnapshot("synthetic-token")).rejects.toMatchObject({
      code: status === 401 ? "SESSION_EXPIRED" : "ACCESS_DENIED",
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  }
});
