import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { GET } from "../../app/api/dev/import/fixture/route";
import { allowDevImport } from "./access";

afterEach(() => vi.unstubAllEnvs());
describe("V1a server-owned synthetic fixture", () => {
  it("is opt-in, development-only and loopback-only", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("CAREERMAP_DEV_IMPORT", "1");
    expect(allowDevImport(new Headers({ host: "127.0.0.1:3103" }))).toBe(true);
    expect(allowDevImport(new Headers({ host: "127.0.0.1:3103", "x-forwarded-host": "127.0.0.1:3103", "x-forwarded-for": "127.0.0.1" }))).toBe(true);
    expect(allowDevImport(new Headers({ host: "127.0.0.1:3103", "x-forwarded-host": "external.invalid" }))).toBe(false);
    for (const host of ["example.org", "127.0.0.1.evil.invalid:3103", "localhost.evil.invalid", ""]) {
      expect(allowDevImport(new Headers({ host }))).toBe(false);
    }
    expect(allowDevImport(new Headers({ host: "127.0.0.1:3103", origin: "https://evil.invalid" }))).toBe(false);
    vi.stubEnv("NODE_ENV", "production");
    expect(allowDevImport(new Headers({ host: "127.0.0.1:3103" }))).toBe(false);
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("CAREERMAP_DEV_IMPORT", "0");
    expect(allowDevImport(new Headers({ host: "127.0.0.1:3103" }))).toBe(false);
  });
  it("resolves only an allowlisted fixture and never returns private source fields", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("CAREERMAP_DEV_IMPORT", "1");
    const response = await GET(new Request("http://127.0.0.1:3103/api/dev/import/fixture?id=fictional-member", { headers: { host: "127.0.0.1:3103" } }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    const body = await response.json();
    expect(body.fixtureId).toBe("fictional-member");
    expect(body.reviewSourceKey).toBe("snapshot:2:0");
    expect(JSON.stringify(body)).not.toMatch(/Fictional Profile|FICTIONAL_|fictional-private|Email|Token/);
    const denied = await GET(new Request("http://127.0.0.1:3103/api/dev/import/fixture?id=UNTRUSTED_MARKER", { headers: { host: "127.0.0.1:3103" } }));
    expect(denied.status).toBe(404);
    expect(await denied.text()).not.toContain("UNTRUSTED_MARKER");
  });
  it("does not expose the fixture endpoint in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CAREERMAP_DEV_IMPORT", "1");
    const response = await GET(new Request("http://127.0.0.1:3103/api/dev/import/fixture?id=fictional-member", { headers: { host: "127.0.0.1:3103" } }));
    expect(response.status).toBe(404);
  });
  const deniedHeaders: Record<string, string>[] = [
    { forwarded: "for=127.0.0.1;host=localhost" },
    { "x-forwarded-for": "203.0.113.1" },
    { "x-forwarded-for": "127.0.0.1, 203.0.113.1" },
    { "sec-fetch-site": "cross-site" },
    { "sec-fetch-site": "same-site" },
  ];
  it.each(deniedHeaders)("rejects external or proxied requests before resolving a fixture: %j", async extra => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("CAREERMAP_DEV_IMPORT", "1");
    const headers = new Headers({ host: "127.0.0.1:3103", ...extra });
    expect(allowDevImport(headers)).toBe(false);
    const response = await GET(new Request("http://127.0.0.1:3103/api/dev/import/fixture?id=fictional-member", { headers }));
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Nicht verfügbar.");
  });
});
