// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("../../dev/mapping/use-linkedin-import", () => ({ useLinkedInImport: vi.fn() }));
import { useLinkedInImport } from "../../dev/mapping/use-linkedin-import";
import LinkedInEntry from "./linkedin-entry";
let root: Root;
afterEach(async () => { if (root) await act(async () => root.unmount()); vi.unstubAllGlobals(); vi.clearAllMocks(); document.body.replaceChildren(); });
async function mount(connected = true, error: string | null = null) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const read = vi.fn(async () => ({ elements: [
    { snapshotDomain: "EDUCATION", snapshotData: [{ "Degree Name": "Synthetischer Master", "School Name": "Synthetische Hochschule", "Start Date": "2018", "End Date": "2020" }] },
    { snapshotDomain: "POSITIONS", snapshotData: [] },
  ] })), disconnect = vi.fn(async () => {});
  vi.mocked(useLinkedInImport).mockReturnValue({ configured: true, connected, checked: true, configurationIssue: null, error, read, disconnect, cancel: vi.fn() });
  const host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(createElement(LinkedInEntry, { surveyId: "synthetic-survey", programName: "Master Informatik", institutionName: "Synthetische Hochschule" })));
  return { host, read, disconnect };
}
it("imports only on request, releases the token and opens the same editable form with no automatic program/reference confirmation", async () => {
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  const { host, read, disconnect } = await mount();
  expect(read).not.toHaveBeenCalled();
  await act(async () => [...host.querySelectorAll("button")].find(b => b.textContent === "Studien- und Berufsstationen übernehmen")!.click());
  expect(read).toHaveBeenCalledOnce(); expect(disconnect).toHaveBeenCalledOnce();
  expect(host.querySelector<HTMLSelectElement>('select[aria-label="Abschlussart"]')!.value).toBe("MASTER");
  expect(host.querySelector<HTMLSelectElement>('select[aria-label="Studiengang zuordnen"]')!.value).toBe("OTHER");
  expect(host.querySelector<HTMLSelectElement>('select[name="own-degree"]')!.value).toBe("");
  expect(host.querySelector<HTMLInputElement>('input[type="number"]')!.value).toBe("2018");
  expect(host.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
  expect(fetch).not.toHaveBeenCalled();
});
it("keeps the manual alternative usable after cancelled or failed LinkedIn authorization", async () => {
  const { host, disconnect } = await mount(false, "Die LinkedIn-Freigabe wurde abgebrochen.");
  expect(host.textContent).toContain("abgebrochen");
  await act(async () => [...host.querySelectorAll("button")].find(b => b.textContent === "Ohne LinkedIn fortfahren")!.click());
  expect(disconnect).toHaveBeenCalledOnce();
  expect(host.textContent).toContain("Deinen Werdegang erfassen");
  expect(host.querySelector<HTMLSelectElement>('select[aria-label="Abschlussart"]')!.value).toBe("");
});
it("does not trap the participant in LinkedIn when disconnect/configuration is temporarily unavailable", async () => {
  const { host, disconnect } = await mount(false, "LinkedIn ist gerade nicht verfügbar.");
  disconnect.mockRejectedValueOnce(new Error("offline"));
  await act(async () => [...host.querySelectorAll("button")].find(b => b.textContent === "Ohne LinkedIn fortfahren")!.click());
  expect(host.textContent).toContain("Deinen Werdegang erfassen");
});
