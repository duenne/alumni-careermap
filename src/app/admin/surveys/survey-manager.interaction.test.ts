// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { SurveyAdministration } from "../../../lib/surveys/service";
import SurveyManager from "./survey-manager";

const demoInstitution = {
  id: "c9875615-69f3-42d5-96fb-7e920ebadce8",
  name: "SYNTHETISCH / DEMO – V5 04fb49b1-4e3b-4fb0-807f-66837beae2f5",
};
function administration(): SurveyAdministration {
  const programs = [
    { id: "00000000-0000-4000-8000-000000000011", name: "Management Sozialer Innovationen", faculty: null },
    { id: "00000000-0000-4000-8000-000000000012", name: "Master Informatik", faculty: "Informatik" },
  ];
  return {
    institutions: [{ ...demoInstitution, programs }], facultyScope: null,
    surveys: programs.map((program, index) => ({
      id: `00000000-0000-4000-8000-00000000002${index}`,
      name: `SYNTHETISCH / DEMO – ${index ? "Master Informatik" : "Alumni MSI"}`,
      status: index ? "DRAFT" : "CLOSED",
      referenceProgram: { ...program, institution: { ...demoInstitution } },
      // Deliberately differ from documented demo counts: the API is authoritative.
      _count: { responses: index ? 3 : 27 },
    })),
  };
}
let root: Root | undefined;
beforeEach(() => vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true));
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = undefined; vi.unstubAllGlobals(); document.body.replaceChildren();
});
async function mount(data = administration()) {
  const fetch = vi.fn(async (_url: string, options?: RequestInit) => options?.method === "POST"
    ? new Response(null, { status: 201 }) : Response.json(data));
  vi.stubGlobal("fetch", fetch);
  const host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root!.render(createElement(SurveyManager)));
  return { host, fetch };
}
const button = (host: HTMLElement, name: string) => [...host.querySelectorAll("button")].find(b => b.textContent === name)!;
async function change(host: HTMLElement, selector: string, value: string) {
  const field = host.querySelector<HTMLInputElement | HTMLSelectElement>(selector)!;
  await act(async () => {
    if (field instanceof HTMLInputElement) {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, value);
      field.dispatchEvent(new Event("input", { bubbles: true }));
    } else { field.value = value; field.dispatchEvent(new Event("change", { bubbles: true })); }
  });
}

it("shows all API surveys first with their current counts, statuses and existing links", async () => {
  const { host } = await mount();
  expect(host.querySelector("section")?.getAttribute("aria-labelledby")).toBe("existing-surveys");
  const cards = host.querySelectorAll("article");
  expect(cards).toHaveLength(2);
  expect(cards[0].textContent).toContain("Management Sozialer Innovationen");
  expect(cards[0].textContent).toContain("Status: Geschlossen (CLOSED)");
  expect(cards[0].textContent).toContain("Antworten: 27");
  expect(cards[1].textContent).toContain("Master Informatik");
  expect(cards[1].textContent).toContain("Status: Entwurf (DRAFT)");
  expect(cards[1].textContent).toContain("Antworten: 3");
  expect(cards[0].querySelector("a")?.getAttribute("href")).toBe("/admin/surveys/00000000-0000-4000-8000-000000000020/analytics");
  expect(cards[0].querySelector("input")?.value).toBe(`${window.location.origin}/surveys/00000000-0000-4000-8000-000000000020`);
  expect(cards[0].querySelector('a[target="_blank"]')?.getAttribute("href")).toBe("/surveys/00000000-0000-4000-8000-000000000020");
  expect(button(host, "Wieder öffnen")).toBeDefined();
  expect(button(host, "Befragung öffnen")).toBeDefined();
});

it("toggles both creation forms accessibly and preserves unfinished input", async () => {
  const { host } = await mount();
  const toggle = button(host, "Neu anlegen");
  expect(toggle).toBeDefined();
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  const panel = document.getElementById(toggle.getAttribute("aria-controls")!)!;
  expect(panel.hidden).toBe(true);
  await act(async () => toggle.click());
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  expect(panel.hidden).toBe(false);
  expect([...panel.querySelectorAll("h2")].map(h => h.textContent)).toEqual(["Fakultät und Studiengang ergänzen", "Neue Befragung"]);
  expect(host.querySelector("#existing-surveys")!.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  await change(host, 'input[required]', "Synthetischer Studiengang");
  await act(async () => toggle.click());
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  expect(panel.hidden).toBe(true);
  await act(async () => toggle.click());
  expect(panel.querySelector<HTMLInputElement>('input[required]')!.value).toBe("Synthetischer Studiengang");
});

it("uses the readable name only for the exact known demo institution, preserving option IDs", async () => {
  const data = administration();
  const others = [
    { id: "00000000-0000-4000-8000-000000000031", name: demoInstitution.name },
    { id: "00000000-0000-4000-8000-000000000032", name: "SYNTHETISCH / DEMO – V5 11111111-1111-4111-8111-111111111111" },
  ];
  data.institutions.push(...others.map(institution => ({ ...institution, programs: [] })));
  data.surveys.push(...others.map((institution, index) => ({ ...data.surveys[0], id: `foreign-${index}`, name: `Andere Befragung ${index}`, referenceProgram: { ...data.surveys[0].referenceProgram, institution } })));
  const { host } = await mount(data);
  const cards = host.querySelectorAll("article");
  expect(cards[0].textContent).toContain("Hochschule München");
  expect(cards[1].textContent).toContain("Hochschule München");
  others.forEach((institution, index) => expect(cards[index + 2].textContent).toContain(institution.name));
  await act(async () => button(host, "Neu anlegen").click());
  const options = host.querySelectorAll<HTMLOptionElement>("#survey-institution option");
  expect(options[1].textContent).toBe("Hochschule München");
  expect(options[1].value).toBe(demoInstitution.id);
  others.forEach((institution, index) => expect(options[index + 2].textContent).toBe(institution.name));
  expect(host.querySelector("#catalog-heading")!.parentElement!.textContent).toContain("Hochschule: Hochschule München");
});

it("preserves a changed name even when the institution ID matches the known demo", async () => {
  const data = administration();
  data.institutions[0].name = "Andere Hochschule";
  data.surveys.forEach(survey => { survey.referenceProgram.institution.name = "Andere Hochschule"; });
  const { host } = await mount(data);
  expect(host.textContent).not.toContain("Hochschule München");
  expect(host.querySelector("#survey-institution option[value='" + demoInstitution.id + "']")!.textContent).toBe("Andere Hochschule");
});

it("keeps creation requests and status/link actions working after expanding the forms", async () => {
  const data = administration();
  const { host, fetch } = await mount(data);
  await act(async () => button(host, "Neu anlegen").click());
  await change(host, 'input[list="catalog-faculties"]', "Synthetische Fakultät");
  await change(host, 'input[required]', "Synthetischer Studiengang");
  expect(button(host, "Studiengang hinzufügen").disabled).toBe(false);
  await act(async () => host.querySelectorAll("form")[0].dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  expect(JSON.parse(fetch.mock.calls.find(([, options]) => options?.method === "POST")![1]!.body as string)).toEqual({ action: "program-create", institutionId: demoInstitution.id, name: "Synthetischer Studiengang", faculty: "Synthetische Fakultät" });
  await change(host, "#survey-institution", demoInstitution.id);
  await change(host, "#survey-program", data.institutions[0].programs[1].id);
  await change(host, '#create-survey + form input', "Synthetische neue Befragung");
  expect(button(host, "Als Entwurf anlegen").disabled).toBe(false);
  await act(async () => host.querySelectorAll("form")[1].dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  expect(JSON.parse(fetch.mock.calls.filter(([, options]) => options?.method === "POST")[1][1]!.body as string)).toEqual({ action: "create", name: "Synthetische neue Befragung", referenceProgramId: data.institutions[0].programs[1].id });
  data.surveys[0].status = "OPEN";
  await act(async () => button(host, "Wieder öffnen").click());
  expect(JSON.parse(fetch.mock.calls.filter(([, options]) => options?.method === "POST")[2][1]!.body as string)).toEqual({ action: "status", surveyId: data.surveys[0].id, status: "OPEN" });
  expect(button(host, "Befragung schließen")).toBeDefined();
  const writeText = vi.fn(async () => {});
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  await act(async () => button(host, "Einladungslink kopieren").click());
  expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/surveys/${data.surveys[0].id}`);
  await act(async () => button(host, "Befragung schließen").click());
  expect(JSON.parse(fetch.mock.calls.filter(([, options]) => options?.method === "POST")[3][1]!.body as string)).toEqual({ action: "status", surveyId: data.surveys[0].id, status: "CLOSED" });
});

it("shows an empty API result without inventing demo surveys", async () => {
  const { host } = await mount({ institutions: [], surveys: [], facultyScope: null });
  expect(host.querySelectorAll("article")).toHaveLength(0);
  expect(host.textContent).toContain("Noch keine Befragungen vorhanden.");
});
