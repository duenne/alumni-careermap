import { expect, test } from "@playwright/test";

test("V1a: Entwicklungsimport bleibt im Produktionsserver gesperrt", async ({ request }) => {
  const page = await request.get("/dev/import");
  expect(page.status()).toBe(404);
  expect(await page.text()).not.toContain("Temporäres Karriere-JSON");
  const response = await request.get("/api/dev/import/fixture?id=fictional-member");
  expect(response.status()).toBe(404);
  expect(await response.text()).not.toContain("Synthetic M.Sc.");
  for (const path of ["/api/dev/import/linkedin/status", "/auth/linkedin/portability/callback?state=synthetic-state&code=synthetic-code"]) {
    const denied = await request.get(path);
    expect(denied.status()).toBe(404);
    expect(await denied.text()).not.toContain("synthetic-code");
  }
  expect((await request.post("/api/dev/import/linkedin/raw-snapshot")).status()).toBe(404);
  expect((await request.get("/dev/mapping")).status()).toBe(404);
  expect((await request.get("/api/dev/import/mapping")).status()).toBe(404);
  expect((await request.post("/api/dev/import/mapping", { data: {} })).status()).toBe(404);
});
