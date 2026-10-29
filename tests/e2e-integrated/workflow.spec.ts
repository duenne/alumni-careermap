import { expect, test } from "@playwright/test";
test("operator adds a faculty/program and participants explicitly accept local classification suggestions", async ({ browser, baseURL }, info) => {
 const admin = await browser.newContext({ baseURL, httpCredentials: { username: "operator", password: "synthetic-integration-password-at-least-32-characters" } });
 const user = await browser.newContext({ baseURL });
 try {
  const p = await admin.newPage(); await p.goto("/admin/surveys");
  await p.getByLabel("Fakultät (optional)", { exact: true }).fill("Synthetic Added Faculty");
  const name = `Synthetic Added Program ${info.project.name}`;
  await p.getByLabel("Name des neuen Studiengangs", { exact: true }).fill(name);
  await p.getByRole("button", { name: "Studiengang hinzufügen", exact: true }).click();
  await expect(p.getByRole("status")).toContainText("Studiengang mit Fakultätsangabe angelegt");
  await p.getByLabel("Hochschule", { exact: true }).selectOption({ label: "Synthetic Mapping Institute" });
  await expect(p.getByLabel("Studiengang", { exact: true }).getByRole("option", { name: `${name} · Synthetic Added Faculty`, exact: true })).toHaveCount(1);
  const catalog = await (await admin.request.get("/api/admin/surveys")).json();
  const seed = catalog.surveys.find((s: { name: string }) => s.name === "Lokaler vertikaler Mapping-Test");
  const created = await admin.request.post("/api/admin/surveys", { headers: { origin: baseURL! }, data: { action: "create", name: `Synthetic Classification ${info.project.name}`, referenceProgramId: seed.referenceProgram.id } });
  expect(created.status()).toBe(201);
  const { id } = await created.json();
  expect((await admin.request.post("/api/admin/surveys", { headers: { origin: baseURL! }, data: { action: "status", surveyId: id, status: "OPEN" } })).status()).toBe(200);
  const page = await user.newPage(); await page.goto(`/surveys/${id}`);
  await page.getByRole("button", { name: "Mit synthetischem Testprofil beginnen" }).click();
  await page.getByRole("button", { name: "Synthetisches Testprofil laden" }).click();
  const master = page.getByRole("group", { name: "Synthetic Master Sustainability", exact: true });
  await master.getByText("Angaben bearbeiten", { exact: true }).click();
  await master.getByLabel("Bezeichnung", { exact: true }).fill("Master Informatik");
  const changed = page.getByRole("group", { name: "Master Informatik", exact: true });
  const field = changed.getByLabel("Fachrichtung / Funktionsbereich", { exact: true });
  await field.fill("");
  await expect(field).toHaveValue("");
  await changed.getByRole("button", { name: "Fachrichtung-Vorschlag übernehmen", exact: true }).click();
  await expect(field).toHaveValue("Informatik");
  await field.fill("Eigene geprüfte Fachrichtung");
  await expect(changed.getByRole("button", { name: "Fachrichtung-Vorschlag übernehmen", exact: true })).toHaveCount(0);
  const job = page.getByRole("group", { name: "Synthetic Analyst", exact: true });
  await job.getByText("Angaben bearbeiten", { exact: true }).click();
  await job.getByLabel("Anbieter / Organisation", { exact: true }).fill("Synthetic Krankenhaus");
  await job.getByLabel("Bezeichnung", { exact: true }).fill("Software Developer");
  const changedJob = page.getByRole("group", { name: "Software Developer", exact: true });
  await changedJob.getByLabel("Jobkategorie", { exact: true }).fill("");
  await changedJob.getByLabel("Branche der neuen Organisation", { exact: true }).fill("");
  await changedJob.getByRole("button", { name: "Jobkategorie-Vorschlag übernehmen", exact: true }).click();
  await changedJob.getByRole("button", { name: "Branche-Vorschlag übernehmen", exact: true }).click();
  await expect(changedJob.getByLabel("Jobkategorie", { exact: true })).toHaveValue("Softwareentwicklung");
  await expect(changedJob.getByLabel("Branche der neuen Organisation", { exact: true })).toHaveValue("Gesundheitswesen");
  await expect(page.getByRole("checkbox", { name: /Diesen eigenen abgeschlossenen Degree/ })).not.toBeChecked();
  await expect(page.getByRole("checkbox", { name: /Ich habe Typen, Status/ })).not.toBeChecked();
  expect((await user.request.post("/api/admin/surveys", { data: { action: "program-create", institutionId: catalog.institutions[0].id, name: "Forbidden", faculty: null } })).status()).toBe(401);
  await page.getByLabel("Konkreter Referenzabschluss", { exact: true }).selectOption({ label: "Synthetic Bachelor MSI" });
  await page.getByRole("checkbox", { name: /Diesen eigenen abgeschlossenen Degree/ }).check();
  await page.getByRole("checkbox", { name: /Ich habe Typen, Status/ }).check();
  await page.getByRole("button", { name: "Datenspende verbindlich speichern", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Vielen Dank für deine Datenspende" })).toBeVisible();
  const analytics = await (await admin.request.get(`/api/admin/surveys/${id}/analytics`)).json();
  expect(analytics.responses).toBe(1); expect(analytics.profiles).toHaveLength(1);
  expect(analytics.profiles.some((profile: { stations: { field: string; job: string; sector: string }[] }) =>
    profile.stations.some(s => s.field === "Eigene geprüfte Fachrichtung") &&
    profile.stations.some(s => s.job === "Softwareentwicklung" && s.sector === "Gesundheitswesen")
  )).toBe(true);
 } finally { await admin.close(); await user.close(); }
});
test("survey invitation -> reviewed synthetic careers -> one confirmed response each -> isolated interactive Sankey",async({browser,baseURL},info)=>{
 const admin=await browser.newContext({baseURL,httpCredentials:{username:"operator",password:"synthetic-integration-password-at-least-32-characters"},viewport:info.project.use.viewport});
 try{
  const p=await admin.newPage();await p.goto("/");await expect(p.getByRole("heading",{name:"Eine gemeinsame Journey"})).toBeVisible();await p.getByRole("link",{name:"Befragungen verwalten",exact:true}).click();
  const ids:string[]=[];let dashboardPath="";
  for(const suffix of ["A","B"]){
   await p.getByLabel("Hochschule",{exact:true}).selectOption({label:"Synthetic Mapping Institute"});
   await p.getByLabel("Studiengang",{exact:true}).selectOption({label:"Management Sozialer Innovationen · Synthetic Survey Faculty"});
   const name=`Synthetic integrated ${info.project.name} ${suffix}`;
   await p.getByLabel("Name der Befragung").fill(name);await p.getByRole("button",{name:"Als Entwurf anlegen"}).click();
   const card=p.getByRole("article",{name,exact:true});await card.getByRole("button",{name:"Befragung öffnen",exact:true}).click();
   await expect(card.getByLabel("Einladungslink",{exact:true})).toBeVisible();
   ids.push((await card.getByLabel("Einladungslink",{exact:true}).inputValue()).split("/").pop()!);
  }
  for(const id of [ids[0],ids[0],ids[1]]){
   const user=await browser.newContext({baseURL,viewport:info.project.use.viewport});
   try{
    const page=await user.newPage();await page.goto(`/surveys/${id}`);await page.getByRole("button",{name:"Mit synthetischem Testprofil beginnen"}).click();
    await expect(page.getByRole("heading",{name:"Karriereweg prüfen und spenden"})).toBeVisible();
    await expect(page.getByText("Entwicklungsprototyp",{exact:true})).toBeVisible();
    await page.getByRole("button",{name:"Synthetisches Testprofil laden"}).click();
    await expect(page.getByRole("group",{name:"Synthetic Bachelor MSI",exact:true})).toBeVisible();
    await page.getByRole("button",{name:"Studium ergänzen"}).click();
    await page.getByRole("group",{name:"Neue akademische Station",exact:true}).getByRole("button",{name:"Station entfernen"}).click();
    await expect(page.getByRole("group",{name:"Neue akademische Station",exact:true})).toHaveCount(0);
    await expect(page.getByLabel("Konkreter Referenzabschluss",{exact:true})).toHaveValue("");
    await page.getByLabel("Konkreter Referenzabschluss",{exact:true}).selectOption({label:"Synthetic Bachelor MSI"});
    await page.getByRole("button",{name:"Datenspende verbindlich speichern"}).click();
    await expect(page.getByRole("heading",{name:"Vielen Dank für deine Datenspende"})).toHaveCount(0);
    await page.getByRole("checkbox",{name:/Diesen eigenen abgeschlossenen Degree/}).check();
    await page.getByRole("button",{name:"Datenspende verbindlich speichern"}).click();
    await expect(page.getByRole("heading",{name:"Vielen Dank für deine Datenspende"})).toHaveCount(0);
    await page.getByRole("checkbox",{name:/Ich habe Typen, Status/}).check();
    await page.getByRole("button",{name:"Datenspende verbindlich speichern"}).click();
    await expect(page.getByRole("heading",{name:"Vielen Dank für deine Datenspende"})).toBeVisible();
    await page.reload();await expect(page.getByRole("heading",{name:"Vielen Dank für deine Datenspende"})).toBeVisible();
    const path=await page.getByRole("link",{name:"Geschützte Auswertung öffnen"}).getAttribute("href");expect(path).toBe(`/admin/surveys/${id}/analytics`);if(!dashboardPath)dashboardPath=path!;
    expect((await user.request.get(`/api/admin/surveys/${id}/analytics`)).status()).toBe(401);
   }finally{await user.close();}
  }
  const data=await (await admin.request.get(`/api/admin/surveys/${ids[0]}/analytics`)).json();
  expect(data.responses).toBe(2);expect(data.profiles).toHaveLength(2);
  expect((await(await admin.request.get(`/api/admin/surveys/${ids[1]}/analytics`)).json()).responses).toBe(1);
  await p.goto(dashboardPath);
  await expect(p.getByText(/2 Profile im Diagramm.*6 Übergangsbeiträge/)).toBeVisible();
  await expect(p.getByRole("group",{name:/MSI-Karrierepfade/})).toBeVisible();
  const node=p.locator('svg g[role="button"]').first();await node.focus();await node.press("Enter");await expect(node).toHaveAttribute("aria-pressed","true");await node.press("Escape");await expect(node).toHaveAttribute("aria-pressed","false");
  await p.getByLabel("Masterstudium",{exact:true}).selectOption("with");
  await expect(p.getByText(/2 Profile im Diagramm.*6 Übergangsbeiträge/)).toBeVisible();
  await p.getByLabel("Analyse-Schwerpunkt",{exact:true}).selectOption("jobs");
  await p.getByLabel("Knotensortierung",{exact:true}).selectOption("alphabetical");
  await p.getByRole("button",{name:"Gesamte Karrierehistorie"}).click();
  await expect(p.getByText(/2 Profile im Diagramm.*12 Übergangsbeiträge/)).toBeVisible();
  await p.getByLabel("Masterstudium",{exact:true}).selectOption("without");
  await expect(p.getByText(/0 Profile im Diagramm/)).toBeVisible();
  await p.getByRole("button",{name:"Alle Filter zurücksetzen"}).click();
  await p.getByRole("button",{name:"Typische Karrierepfade"}).click();
  await p.screenshot({path:`artifacts/v3-integrated/${info.project.name}-dashboard.png`,fullPage:true});
 }finally{await admin.close();}
});

test("survey-bound authorized OAuth returns to review; cancellation never fabricates snapshots",async({browser,baseURL})=>{
 const admin=await browser.newContext({baseURL,httpCredentials:{username:"operator",password:"synthetic-integration-password-at-least-32-characters"}});
 const user=await browser.newContext({baseURL});
 try{
  const catalog=await(await admin.request.get("/api/admin/surveys")).json();const id=catalog.surveys.find((s:{name:string})=>s.name==="Lokaler vertikaler Mapping-Test").id;
  const p=await user.newPage();await p.goto(`/surveys/${id}/participate`);await expect(p.getByText("Deine Teilnahmesitzung ist hier nicht mehr verfügbar. Bitte starte über diese Befragungsinformation erneut.")).toBeVisible();await p.getByRole("button",{name:"Mit LinkedIn-Datenspende beginnen"}).click();
  await expect(p.getByRole("button",{name:"Mit LinkedIn verbinden",exact:true})).toBeEnabled();
  let cancel=true;
  await user.route("**/api/donation/linkedin/start",async route=>{
   const response=await route.fetch({maxRedirects:0});expect(response.status()).toBe(303);
   const url=new URL(response.headers().location);expect(url.searchParams.get("scope")).toBe("r_dma_portability_3rd_party");
   const callback=new URL("/auth/linkedin/portability/callback",baseURL);callback.searchParams.set("state",url.searchParams.get("state")!);
   if(cancel)callback.searchParams.set("error","access_denied");else callback.searchParams.set("code","synthetic-code");
   const headers=response.headers();delete headers.location;delete headers["content-length"];headers["content-type"]="text/html; charset=utf-8";
   await route.fulfill({status:200,headers,body:`<a href="${callback.href.replaceAll("&","&amp;")}">Synthetisch autorisieren</a>`});
  });
  await p.getByRole("button",{name:"Mit LinkedIn verbinden",exact:true}).click();await p.getByRole("link",{name:"Synthetisch autorisieren"}).click();
  await expect(p.getByRole("alert").filter({hasText:"Die LinkedIn-Freigabe wurde abgebrochen."})).toBeVisible();
  await expect(p.getByRole("button",{name:"Karrieredaten abrufen"})).toBeDisabled();
  cancel=false;
  await p.getByRole("button",{name:"Mit LinkedIn verbinden",exact:true}).click();await p.getByRole("link",{name:"Synthetisch autorisieren"}).click();
  await expect(p.getByRole("button",{name:"Karrieredaten abrufen"})).toBeEnabled();
  await p.getByRole("button",{name:"Karrieredaten abrufen"}).click();
  await expect(p.getByRole("group",{name:"Synthetic Provider Snapshot Role",exact:true})).toBeVisible();
  await expect(p.getByRole("button",{name:"Synthetisches Testprofil laden"})).toHaveCount(0);
  await expect(p.getByLabel("Konkreter Referenzabschluss",{exact:true})).toHaveValue("");
  const before=(await(await admin.request.get(`/api/admin/surveys/${id}/analytics`)).json()).responses;
  const degree=p.getByRole("group",{name:"Synthetic M.Sc.",exact:true});
  await degree.getByLabel("Zieltyp",{exact:true}).selectOption("DEGREE:BACHELOR");
  await degree.getByLabel("Status",{exact:true}).selectOption("COMPLETED");
  await degree.getByLabel("Timeline-Position").fill("2");
  const internship=p.getByRole("group",{name:"Synthetic Internship",exact:true});
  await internship.getByLabel("Status",{exact:true}).selectOption("ENDED");await internship.getByLabel("Timeline-Position").fill("1");
  const course=p.getByRole("group",{name:"Synthetic Short Course",exact:true});
  await course.getByLabel("Zieltyp",{exact:true}).selectOption("CAREER_STEP:EDUCATION");await course.getByLabel("Status",{exact:true}).selectOption("ENDED");await course.getByLabel("Timeline-Position").fill("3");
  const job=p.getByRole("group",{name:"Synthetic Provider Snapshot Role",exact:true});
  await job.getByLabel("Status",{exact:true}).selectOption("ONGOING");await job.getByLabel("Timeline-Position").fill("4");
  await p.getByLabel("Konkreter Referenzabschluss",{exact:true}).selectOption({label:"Synthetic M.Sc."});
  await p.getByRole("checkbox",{name:/Diesen eigenen abgeschlossenen Degree/}).check();await p.getByRole("checkbox",{name:/Ich habe Typen, Status/}).check();
  await p.getByRole("button",{name:"Datenspende verbindlich speichern"}).click();await expect(p.getByRole("heading",{name:"Vielen Dank für deine Datenspende"})).toBeVisible();
  const after=await(await admin.request.get(`/api/admin/surveys/${id}/analytics`)).json();expect(after.responses).toBe(before+1);expect(after.profiles.at(-1).stations.length).toBe(4);
 }finally{await admin.close();await user.close();}
});

test("old demo entry points rejoin the unified journey while the dashboard stays protected", async ({ page, request, baseURL }) => {
 for(const path of ["/dev/import","/dev/mapping","/review"]){
  const response=await request.get(path,{maxRedirects:0});expect(response.status()).toBe(307);expect(new URL(response.headers().location,baseURL).href).toBe(`${baseURL}/`);
 }
 await page.goto("/dev/import");
 await expect(page.getByRole("heading",{name:"Eine gemeinsame Journey"})).toBeVisible();
 await expect(page.getByRole("link",{name:"Beispiel-Karriereweg ansehen"})).toHaveCount(0);
 expect((await request.get("/dev/analytics")).status()).toBe(401);
});
