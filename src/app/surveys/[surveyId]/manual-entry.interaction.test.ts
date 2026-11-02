// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import ManualEntry from "./manual-entry";
const id = "44444444-4444-4444-8444-444444444444";
const programName = "Master Informatik";
let root: Root | undefined;
beforeEach(() => vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true));
afterEach(async () => { if (root) await act(async () => root!.unmount()); root = undefined; vi.unstubAllGlobals(); document.body.replaceChildren(); });
async function mount(receipt?: { degrees: number; careerSteps: number; timelineItems: number }) {
  const host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root!.render(createElement(ManualEntry, { surveyId: id, programName, institutionName: "Synthetische Hochschule", receipt })));
  return host;
}
const button = (host: HTMLElement, name: string) => [...host.querySelectorAll("button")].find(b => b.textContent === name)!;
function field(host: HTMLElement, name: string) { return [...host.querySelectorAll("label")].find(label => label.childNodes[0]?.textContent === name)!.querySelector<HTMLInputElement | HTMLSelectElement>("input,select")!; }
async function fill(host: HTMLElement, label: string, value: string) {
  const control = field(host, label);
  await act(async () => {
    if (control instanceof HTMLInputElement) { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(control, value); control.dispatchEvent(new Event("input", { bubbles: true })); }
    else { control.value = value; control.dispatchEvent(new Event("change", { bubbles: true })); }
  });
}
async function review(host: HTMLElement) {
  await fill(host, "Bezeichnung des Studiums", "Synthetischer Master");
  await fill(host, "Abschlussart", "MASTER"); await fill(host, "Studienstatus", "COMPLETED");
  await fill(host, "Abschlussjahr (optional)", "2020");
  expect(field(host, "Welcher eigene Abschluss gehört zu dieser Befragung?").value).toBe("");
  await fill(host, "Welcher eigene Abschluss gehört zu dieser Befragung?", host.querySelector<HTMLOptionElement>('select[name="own-degree"] option:nth-child(2)')!.value);
  await act(async () => button(host, "Angaben prüfen").click());
}
it("offers manual entry with no invented degree type, requires an explicit own degree, and saves only after both confirmations", async () => {
  const fetch = vi.fn<(url: string, options?: RequestInit) => Promise<Response>>(async () => Response.json({ saved: true, receipt: { degrees: 1, careerSteps: 0, timelineItems: 1 } })); vi.stubGlobal("fetch", fetch);
  const host = await mount();
  expect(field(host, "Abschlussart").value).toBe("");
  await review(host);
  expect(host.textContent).toContain("Deine Angaben prüfen");
  const submit = button(host, "Verbindlich absenden"); expect(submit.disabled).toBe(true);
  await act(async () => host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')[0].click());
  expect(submit.disabled).toBe(true); expect(fetch).not.toHaveBeenCalled();
  await act(async () => host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')[1].click());
  expect(submit.disabled).toBe(false);
  await act(async () => submit.click());
  expect(fetch).toHaveBeenCalledOnce();
  expect(fetch.mock.calls[0][0]).toBe(`/api/surveys/${id}/participation`);
  expect(host.textContent).toContain("Dein Karriereweg wurde gespeichert");
  expect(host.querySelectorAll("input,form")).toHaveLength(0);
});
it("allows editing, clears confirmations on changes, retains data on failure and permits the same contribution to be retried", async () => {
  const fetch = vi.fn().mockRejectedValueOnce(new Error("connection lost")).mockResolvedValueOnce(Response.json({ saved: true, receipt: { degrees: 1, careerSteps: 0, timelineItems: 1 } })); vi.stubGlobal("fetch", fetch);
  const host = await mount(); await review(host);
  await act(async () => { host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')[0].click(); host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')[1].click(); });
  await act(async () => button(host, "Verbindlich absenden").click());
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("Keine Speicherbestätigung");
  expect(host.textContent).toContain("Synthetischer Master");
  await act(async () => button(host, "Verbindlich absenden").click());
  expect(fetch.mock.calls[0][1].body).toBe(fetch.mock.calls[1][1].body);
  expect(host.textContent).toContain("Dein Karriereweg wurde gespeichert");
});
it("shows a persisted receipt on reload without submitting again", async () => {
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  const host = await mount({ degrees: 1, careerSteps: 1, timelineItems: 2 });
  expect(host.textContent).toContain("Dein Karriereweg wurde gespeichert"); expect(fetch).not.toHaveBeenCalled();
});
