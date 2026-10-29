import { expect, test } from "@playwright/test";

const password = "synthetic-survey-e2e-password-at-least-32-characters";
test("operator creates a draft, opens, copies context link, closes and reopens with immutable program", async ({ browser, baseURL }, info) => {
  const admin = await browser.newContext({ baseURL, httpCredentials: { username: "operator", password }, viewport: info.project.use.viewport });
  const participant = await browser.newContext({ baseURL, viewport: info.project.use.viewport });
  try {
    const page = await admin.newPage();
    await page.goto("/admin/surveys");
    await expect(page.getByRole("heading", { name: "Befragungen verwalten" })).toBeVisible();
    await page.getByLabel("Hochschule", { exact: true }).selectOption({ label: "Synthetic Mapping Institute" });
    await page.getByLabel("Studiengang", { exact: true }).selectOption({ label: "Synthetic Teststudium · Synthetic Survey Faculty" });
    const programId = await page.getByLabel("Studiengang", { exact: true }).inputValue();
    const name = `Synthetic V3a ${info.project.name}`;
    await page.getByLabel("Name der Befragung").fill(name);
    await page.getByRole("button", { name: "Als Entwurf anlegen" }).click();
    const survey = page.getByRole("article", { name, exact: true });
    await expect(survey.getByText("Status: Entwurf (DRAFT)", { exact: true })).toBeVisible();
    const catalog = await (await admin.request.get("/api/admin/surveys")).json();
    const id = catalog.surveys.find((s: { name: string }) => s.name === name).id;
    expect((await participant.request.get(`/surveys/${id}`)).status()).toBe(404);
    expect((await participant.request.get(`/api/surveys/${id}`)).status()).toBe(404);
    await survey.getByRole("button", { name: "Befragung öffnen", exact: true }).click();
    await expect(survey.getByText("Status: Geöffnet (OPEN)", { exact: true })).toBeVisible();
    const invitation = await survey.getByLabel("Einladungslink", { exact: true }).inputValue();
    expect(invitation).toBe(`${baseURL}/surveys/${id}`);
    await admin.grantPermissions(["clipboard-read", "clipboard-write"], { origin: baseURL! });
    await survey.getByRole("button", { name: "Einladungslink kopieren", exact: true }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(invitation);
    await expect(page.getByRole("status")).toHaveText(`Einladungslink für „${name}“ kopiert.`);
    const entry = await participant.newPage();
    // Synthetic external invitation page: fulfilled locally, no network call.
    await participant.route("https://synthetic-invitation.example.invalid/**", route => route.fulfill({ contentType: "text/html; charset=utf-8", body: `<a href="${invitation}">Synthetische Einladung öffnen</a>` }));
    await entry.goto("https://synthetic-invitation.example.invalid/invitation");
    await entry.getByRole("link", { name: "Synthetische Einladung öffnen" }).click();
    await expect(entry.getByRole("heading", { name, exact: true })).toBeVisible();
    const context = entry.getByRole("definition");
    await expect(context).toHaveText(["Synthetic Mapping Institute", "Synthetic Survey Faculty", "Synthetic Teststudium", name]);
    await entry.getByRole("button", { name: "Synthetisches Beispiel prüfen" }).click();
    await expect(entry.getByRole("radio")).not.toBeChecked();
    await expect(entry.getByRole("checkbox")).not.toBeChecked();
    await expect(entry.getByRole("button", { name: "Beispielauswahl prüfen" })).toBeDisabled();
    await entry.getByRole("radio").check();
    await expect(entry.getByRole("button", { name: "Beispielauswahl prüfen" })).toBeDisabled();
    await entry.getByRole("checkbox").check();
    await entry.getByRole("button", { name: "Beispielauswahl prüfen" }).click();
    await expect(entry.getByRole("status")).toContainText("keine Datenspende gespeichert");
    expect(await entry.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await entry.screenshot({ path: `artifacts/v3a-surveys/${info.project.name}-invitation.png`, fullPage: true });
    await entry.reload();
    await entry.getByRole("button", { name: "Synthetisches Beispiel prüfen" }).click();
    await expect(entry.getByRole("radio")).not.toBeChecked();
    expect((await admin.request.post("/api/admin/surveys", { headers: { origin: baseURL! }, data: { action: "status", surveyId: id, status: "CLOSED", referenceProgramId: programId } })).status()).toBe(400);
    await survey.getByRole("button", { name: "Befragung schließen", exact: true }).click();
    await expect(survey.getByText("Status: Geschlossen (CLOSED)", { exact: true })).toBeVisible();
    await entry.reload();
    await expect(entry.getByRole("heading", { name: "Diese Befragung ist geschlossen" })).toBeVisible();
    await expect(entry.getByRole("button", { name: "Synthetisches Beispiel prüfen" })).toHaveCount(0);
    await page.reload();
    await expect(survey.getByText("Status: Geschlossen (CLOSED)", { exact: true })).toBeVisible();
    const saved = await (await admin.request.get("/api/admin/surveys")).json();
    expect(saved.surveys.find((s: { id: string }) => s.id === id).referenceProgram.id).toBe(programId);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `artifacts/v3a-surveys/${info.project.name}-administration.png`, fullPage: true });
    await survey.getByRole("button", { name: "Wieder öffnen" }).click();
    await expect(survey.getByText("Status: Geöffnet (OPEN)", { exact: true })).toBeVisible();
    await entry.reload();
    await expect(entry.getByRole("button", { name: "Synthetisches Beispiel prüfen" })).toBeVisible();
  } finally { await admin.close(); await participant.close(); }
});

test("anonymous access, foreign origins, unknown surveys and profile reads remain unavailable", async ({ request, baseURL }) => {
  for (const path of ["/admin/surveys", "/api/admin/surveys"]) {
    const response = await request.get(path);
    expect(response.status()).toBe(401);
    expect(response.headers()["cache-control"]).toBe("no-store");
  }
  const authorization = `Basic ${Buffer.from(`operator:${password}`).toString("base64")}`;
  expect((await request.post("/api/admin/surveys", { headers: { authorization, origin: "https://foreign.invalid" }, data: {} })).status()).toBe(404);
  expect((await request.post("/api/admin/surveys", { headers: { authorization }, data: {} })).status()).toBe(404);
  expect((await request.get("/api/admin/surveys", { headers: { authorization: "Basic invalid" } })).status()).toBe(401);
  expect((await request.get("/api/surveys/not-a-uuid")).status()).toBe(404);
  expect((await request.get("/surveys/00000000-0000-4000-8000-000000000099")).status()).toBe(404);
  expect((await request.get("/api/dev/import/mapping?saved=00000000-0000-4000-8000-000000000099")).status()).toBe(404);
  expect((await request.get("/api/surveys/00000000-0000-4000-8000-000000000099", { headers: { origin: baseURL!, "x-forwarded-host": "foreign.invalid" } })).status()).toBe(404);
});
