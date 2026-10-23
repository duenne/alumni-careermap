import { expect, test } from "@playwright/test";

test("LinkedIn -> JSON -> synthetic replacement -> edit -> PostgreSQL -> saved timeline and reload", async ({ page, context, baseURL }) => {
  let authorization: URL | undefined;
  const external: string[] = [];
  await context.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.origin === "http://localhost:3105") {
      const callback = new URL("/auth/linkedin/portability/callback", baseURL);
      callback.searchParams.set("code", "synthetic-code"); callback.searchParams.set("state", authorization!.searchParams.get("state")!);
      return route.fulfill({ contentType: "text/html", body: `<a href="${callback.href.replaceAll("&", "&amp;")}">Synthetisch freigeben</a>` });
    }
    if (url.origin !== baseURL) { external.push(url.origin); return route.abort("blockedbyclient"); }
    if (url.pathname === "/api/dev/import/linkedin/start") {
      const response = await route.fetch({ maxRedirects: 0 }); expect(response.status()).toBe(303);
      const headers = response.headers(); authorization = new URL(headers.location);
      delete headers.location; delete headers["content-length"]; headers["content-type"] = "text/html";
      return route.fulfill({ status: 200, headers, body: "<h1>Synthetic authorization started</h1>" });
    }
    return route.continue();
  });
  await page.goto("/dev/import");
  await expect(page.getByRole("heading", { name: "Karriereweg importieren und speichern" })).toBeVisible();
  await page.getByRole("button", { name: "Mit LinkedIn verbinden", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Synthetic authorization started" })).toBeVisible();
  await page.goto("http://localhost:3105/synthetic-provider");
  await page.getByRole("link", { name: "Synthetisch freigeben" }).click();
  await page.getByRole("button", { name: "Karrieredaten als JSON laden" }).click();
  const json = page.getByLabel("Snapshot-JSON oder rohe LinkedIn-Vorschau");
  await expect(json).toHaveValue(/Synthetic Provider Snapshot Role/);
  await page.getByRole("button", { name: "Durch synthetischen Datensatz ersetzen" }).click();
  await expect(json).not.toHaveValue(/Synthetic Provider Snapshot Role/);
  await expect(json).toHaveValue(/Synthetic Research Assistant/);
  await expect(page.getByRole("button", { name: "Karrieredaten als JSON laden" })).toBeDisabled();
  const role = page.getByRole("group", { name: "Synthetic Research Assistant", exact: true });
  await role.getByText("Quelldaten bearbeiten", { exact: true }).click();
  await role.getByLabel("Bezeichnung", { exact: true }).fill("Synthetic reviewed scientist");
  const editedRole = page.getByRole("group", { name: "Synthetic reviewed scientist", exact: true });
  await editedRole.getByLabel("Ort", { exact: true }).fill("Synthetic Teststadt");
  await editedRole.getByLabel("Status", { exact: true }).selectOption("ONGOING");
  await editedRole.getByLabel("Timeline-Position").fill("4");
  await editedRole.getByLabel("Organisation", { exact: true }).selectOption("CREATE");
  const internship = page.getByRole("group", { name: "Synthetic Internship", exact: true });
  await internship.getByLabel("Timeline-Position").fill("1");
  await internship.getByLabel("Status", { exact: true }).selectOption("ENDED");
  await internship.getByLabel("Organisation", { exact: true }).selectOption("CREATE");
  const degree = page.getByRole("group", { name: "Synthetic M.Sc.", exact: true });
  await degree.getByLabel("Status", { exact: true }).selectOption("COMPLETED");
  await degree.getByLabel("Studiengang oder Bildungseinrichtung").selectOption({ label: "Studiengang: Synthetic Teststudium · Synthetic Mapping Institute" });
  await degree.getByLabel("Timeline-Position").fill("2");
  const course = page.getByRole("group", { name: "Synthetic Short Course", exact: true });
  await course.getByLabel("Zieltyp").selectOption("CAREER_STEP:EDUCATION");
  await course.getByLabel("Timeline-Position").fill("3");
  await course.getByLabel("Status", { exact: true }).selectOption("ENDED");
  await course.getByLabel("Organisation", { exact: true }).selectOption("CREATE");
  await expect(page.getByLabel("Konkreter Referenzabschluss", { exact: true })).toHaveValue("");
  await page.getByLabel("Konkreter Referenzabschluss", { exact: true }).selectOption({ label: "Synthetic M.Sc." });
  await page.getByRole("checkbox", { name: /Diesen eigenen abgeschlossenen Degree/ }).check();
  await page.getByRole("checkbox", { name: /Ich habe Typen, Status/ }).check();
  await page.getByRole("button", { name: "In Testdatenbank speichern" }).click();
  const timeline = page.getByRole("region", { name: "Gespeicherter Karriereweg", exact: true });
  await expect(timeline.getByRole("heading", { name: "Synthetic reviewed scientist", exact: true })).toBeVisible();
  await expect(timeline.getByText("Referenzabschluss", { exact: true })).toBeVisible();
  const selected = await page.locator("#saved-profile").inputValue();
  expect(selected).toMatch(/^[0-9a-f-]{36}$/);
  await page.reload();
  await page.locator("#saved-profile").selectOption(selected);
  await expect(timeline.getByRole("heading", { name: "Synthetic reviewed scientist", exact: true })).toBeVisible();
  expect(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }))).toEqual({ local: 0, session: 0 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await timeline.screenshot({ path: `artifacts/v1d-workflow/${test.info().project.name}-saved-timeline.png` });
  expect(external).toEqual([]);
});
