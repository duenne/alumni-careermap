import { expect, test } from "@playwright/test";

test("survey administration and invitations stay disabled in production despite opt-in", async ({ request }) => {
  for (const path of ["/admin/surveys", "/api/admin/surveys", "/api/donation/linkedin/status", "/api/surveys/00000000-0000-4000-8000-000000000001/donation", "/surveys/00000000-0000-4000-8000-000000000001/participate", "/admin/surveys/00000000-0000-4000-8000-000000000001/analytics", "/surveys/00000000-0000-4000-8000-000000000001", "/api/surveys/00000000-0000-4000-8000-000000000001"]) {
    const response = await request.get(path, { headers: { authorization: `Basic ${Buffer.from("operator:synthetic-production-denial-password-32-characters").toString("base64")}` } });
    expect(response.status()).toBe(404);
    expect(response.headers()["cache-control"]).toBe("no-store");
    expect(await response.text()).not.toContain("Synthetic Teststudium");
  }
});
