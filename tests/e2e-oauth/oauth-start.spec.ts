import { expect, test } from "@playwright/test";

test("V1b: tatsächlicher Formular-Klick startet OAuth ohne Origin-Verlust oder externe Anfrage", async ({ page, context, baseURL }) => {
  // Inspect the real local 303, then substitute a local HTML response.
  // Playwright routing does not intercept every hop of a redirect chain.
  // Never let the browser follow even a synthetic authorization URL to LinkedIn.
  let authorization: URL | undefined;
  let serverStatus: number | undefined;
  let redirectPolicy: string | undefined;
  const external: string[] = [];
  await context.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.origin !== baseURL) {
      external.push(url.origin);
      return route.abort("blockedbyclient");
    }
    if (url.pathname === "/api/dev/import/linkedin/start") {
      const response = await route.fetch({ maxRedirects: 0 });
      serverStatus = response.status();
      const headers = response.headers();
      if (serverStatus === 303) {
        authorization = new URL(headers.location);
        redirectPolicy = headers["referrer-policy"];
        delete headers.location;
        delete headers["content-length"];
        headers["content-type"] = "text/html; charset=utf-8";
        return route.fulfill({ status: 200, headers, body: "<h1>Synthetic OAuth destination</h1>" });
      }
      return route.fulfill({ response, headers });
    }
    return route.continue();
  });
  await page.goto("/dev/import");
  const button = page.getByRole("button", { name: "Mit LinkedIn verbinden", exact: true });
  await expect(button).toBeEnabled();
  const pendingStart = page.waitForResponse(response => response.url() === `${baseURL}/api/dev/import/linkedin/start`
    && response.request().method() === "POST");
  await button.click();
  const start = await pendingStart;
  const sentHeaders = await start.request().allHeaders();
  expect(sentHeaders.origin).toBe(baseURL);
  expect(serverStatus).toBe(303);
  // The browser sees only our substitute; serverStatus is the real API result.
  expect(start.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Synthetic OAuth destination", exact: true })).toBeVisible();
  expect(external).toEqual([]);
  expect(authorization).toBeDefined();
  const url = authorization!;
  expect(url.origin + url.pathname).toBe("https://www.linkedin.com/oauth/v2/authorization");
  expect(url.searchParams.get("client_id")).toBe("synthetic-client");
  expect(url.searchParams.get("scope")).toBe("r_dma_portability_3rd_party");
  expect(url.searchParams.get("redirect_uri")).toBe(`${baseURL}/auth/linkedin/portability/callback`);
  expect(url.searchParams.get("state")).toMatch(/^[A-Za-z0-9_-]{40,}$/);
  expect(url.href).not.toMatch(/synthetic-secret|access_token|client_secret/);
  expect(redirectPolicy).toBe("no-referrer");
  const session = (await context.cookies(baseURL!)).find(cookie => cookie.name === "careermap_linkedin_dev");
  expect(session).toMatchObject({ httpOnly: true, sameSite: "Lax", path: "/" });
});

test("V1b: fremde und opake Origins bleiben am OAuth-Start gesperrt", async ({ request }) => {
  for (const origin of ["https://external.invalid", "null", ""]) {
    const response = await request.post("/api/dev/import/linkedin/start", { headers: { origin }, maxRedirects: 0 });
    expect(response.status()).toBe(404);
    expect(response.headers()["location"]).toBeUndefined();
    expect(response.headers()["set-cookie"]).toBeUndefined();
  }
});

for (const validState of [true, false]) {
  test(`V1b: vollständige externe Callback-Rückleitung (${validState ? "verbunden" : "ungültiger State"})`, async ({ page, context, baseURL }) => {
    const providerOrigin = "http://localhost:3105";
    let authorization: URL | undefined;
    const external: string[] = [];
    await context.route("**/*", async route => {
      const url = new URL(route.request().url());
      if (url.origin === providerOrigin) {
        const callback = new URL("/auth/linkedin/portability/callback", baseURL);
        callback.searchParams.set("code", "synthetic-code");
        callback.searchParams.set("state", validState ? authorization!.searchParams.get("state")! : "synthetic-invalid-state");
        return route.fulfill({ contentType: "text/html", body: `<a href="${callback.href.replaceAll("&", "&amp;")}">Return to CareerMap</a>` });
      }
      if (url.origin !== baseURL) {
        external.push(url.origin);
        return route.abort("blockedbyclient");
      }
      if (url.pathname === "/api/dev/import/linkedin/start") {
        const response = await route.fetch({ maxRedirects: 0 });
        expect(response.status()).toBe(303);
        const headers = response.headers();
        authorization = new URL(headers.location);
        delete headers.location;
        delete headers["content-length"];
        headers["content-type"] = "text/html";
        return route.fulfill({ status: 200, headers, body: "<p>Synthetic authorization started</p>" });
      }
      return route.continue();
    });
    await page.goto("/dev/import");
    await page.getByRole("button", { name: "Mit LinkedIn verbinden", exact: true }).click();
    await expect(page.getByText("Synthetic authorization started", { exact: true })).toBeVisible();
    const before = (await context.cookies(baseURL!)).find(cookie => cookie.name === "careermap_linkedin_dev");
    expect(before).toBeDefined();
    await page.goto(providerOrigin);
    const callbackResponse = page.waitForResponse(response => new URL(response.url()).pathname === "/auth/linkedin/portability/callback");
    const returnResponse = page.waitForResponse(response => new URL(response.url()).pathname === "/dev/import");
    await page.getByRole("link", { name: "Return to CareerMap", exact: true }).click();
    const callback = await callbackResponse;
    // Chromium omits late-added Fetch Metadata from the intercepted first hop.
    // The un-intercepted redirected request below exposes its real metadata.
    expect(callback.status()).toBe(303);
    expect(callback.headers().location).toBe(`${baseURL}/dev/import?linkedin=${validState ? "connected" : "INVALID_STATE"}`);
    const returned = await returnResponse;
    expect((await returned.request().allHeaders())["sec-fetch-site"]).toBe("cross-site");
    expect(returned.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: "LinkedIn-Testimport", exact: true })).toBeVisible();
    await expect(page).toHaveURL(`${baseURL}/dev/import`);
    await expect(page.getByLabel("Temporäres Karriere-JSON", { exact: true })).toHaveValue("");
    if (validState) {
      await expect(page.getByText("Mit LinkedIn verbunden · nur temporär auf diesem Entwicklungsserver.", { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Karrieredaten abrufen", exact: true })).toBeEnabled();
      const after = (await context.cookies(baseURL!)).find(cookie => cookie.name === "careermap_linkedin_dev");
      expect(after?.value).not.toBe(before?.value);
      await page.reload();
      await expect(page.getByRole("button", { name: "Karrieredaten abrufen", exact: true })).toBeEnabled();
      const rawResponse = page.waitForResponse(response => new URL(response.url()).pathname === "/api/dev/import/linkedin/raw-snapshot");
      await page.getByRole("button", { name: "Rohe API-Antworten abrufen", exact: true }).click();
      expect((await rawResponse).status()).toBe(200);
      const rawEditor = page.getByLabel("Temporäres Karriere-JSON", { exact: true });
      await expect(rawEditor).toHaveValue(/synthetic-member/);
      const raw = JSON.parse(await rawEditor.inputValue());
      expect(raw.complete).toBe(false);
      expect(raw.domains.map((domain: { pages: { status: number }[] }) => domain.pages.map(page => page.status))).toEqual([[200, 404], [200, 404]]);
      await expect(rawEditor).toHaveAttribute("readonly", "");
      await expect(page.getByRole("button", { name: "In Karriereansicht übernehmen", exact: true })).toBeDisabled();
      const snapshotResponse = page.waitForResponse(response => new URL(response.url()).pathname === "/api/dev/import/linkedin/snapshot");
      await page.getByRole("button", { name: "Karrieredaten abrufen", exact: true }).click();
      expect((await snapshotResponse).status()).toBe(200);
      const editor = page.getByLabel("Temporäres Karriere-JSON", { exact: true });
      await expect(editor).toHaveValue(/Synthetic Provider Snapshot Role/);
      await expect(editor).not.toHaveValue(/FICTIONAL_|fictional-private|First Name|Description|Notes/);
      const snapshot = JSON.parse(await editor.inputValue());
      expect(snapshot.elements.map((element: { snapshotDomain: string }) => element.snapshotDomain)).toEqual(["PROFILE", "POSITIONS", "EDUCATION"]);
      expect(snapshot.elements[0].snapshotData).toEqual([{}]);
      await expect(page.getByRole("button", { name: "In Karriereansicht übernehmen", exact: true })).toBeDisabled();
      await page.getByRole("button", { name: "Synthetische Testdaten verwenden", exact: true }).click();
      await expect(editor).not.toHaveValue(/Synthetic Provider Snapshot Role/);
      await expect(page.getByText("Synthetische Testdaten", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Vorschau leeren", exact: true }).click();
      await expect(page.getByRole("button", { name: "Karrieredaten abrufen", exact: true })).toBeDisabled();
    } else {
      await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
      await expect(page.getByRole("button", { name: "Karrieredaten abrufen", exact: true })).toBeDisabled();
    }
    expect(external).toEqual([]);
    await expect(page.locator("body")).not.toContainText("synthetic-token");
  });
}
