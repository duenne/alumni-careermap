// @vitest-environment jsdom
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers({ host: "localhost:3110" })) }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); }, useRouter: () => ({ push: vi.fn() }) }));
vi.mock("../../../lib/surveys/client", () => ({ surveyClient: vi.fn(async () => ({})) }));
vi.mock("../../../lib/donation/manual-access", () => ({ manualParticipationEnabled: vi.fn(() => false), participationLinkedInEnabled: vi.fn(() => true) }));
vi.mock("../../../lib/surveys/service", async importOriginal => ({ ...await importOriginal<typeof import("../../../lib/surveys/service")>(), readSurveyInvitation: vi.fn() }));
import { headers } from "next/headers";
import { surveyClient } from "../../../lib/surveys/client";
import { readSurveyInvitation, type SurveyContext } from "../../../lib/surveys/service";
import SurveyEntryPage from "./page";
import SyntheticEntry from "./synthetic-entry";
import { manualParticipationEnabled } from "../../../lib/donation/manual-access";

const surveyId = "00000000-0000-4000-8000-000000000001";
const context: SurveyContext = {
  id: surveyId, name: "SYNTHETISCH / DEMO – Master Informatik", status: "OPEN",
  referenceProgram: { id: surveyId, name: "Master Informatik", faculty: "Synthetische Fakultät", institution: { id: surveyId, name: "Synthetische Hochschule" } },
};
let root: Root | undefined;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("CAREERMAP_DEV_SURVEYS", "1");
  vi.stubEnv("CAREERMAP_DEV_DONATION", "0"); vi.stubEnv("CAREERMAP_LOCAL_DEMO", undefined);
  vi.stubEnv("CAREERMAP_MAPPING_OPERATOR_ID", surveyId); vi.stubEnv("CAREERMAP_SURVEY_OPERATOR_KIND", "INSTITUTION");
  vi.mocked(headers).mockResolvedValue(new Headers({ host: "localhost:3110" }) as Awaited<ReturnType<typeof headers>>);
  vi.mocked(readSurveyInvitation).mockResolvedValue(structuredClone(context));
  vi.mocked(manualParticipationEnabled).mockReturnValue(false);
});
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = undefined; vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.clearAllMocks(); document.body.replaceChildren();
});
async function mount(element: ReactNode) {
  const host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root!.render(element));
  return host;
}
const page = (id = surveyId) => SurveyEntryPage({ params: Promise.resolve({ surveyId: id }) });

it("leads with the benefit and three planned steps, with actual survey details in a closed disclosure", async () => {
  const host = await mount(await page());
  expect(host.querySelector("h1")?.textContent).toBe("Dein Weg nach dem Studium");
  expect(host.querySelector("h2")?.textContent).toBe("Wo hat dich dein Studium hingeführt?");
  expect(host.textContent).toContain("Deine Erfahrungen könnten später helfen, diese Wege sichtbar zu machen.");
  expect(host.textContent).toContain("Dein eigener Abschluss im ausgewählten Studiengang ist der Ausgangspunkt für die Auswertung deines Karrierewegs.");
  const steps = [...host.querySelectorAll('ol[aria-label="Geplanter Ablauf"] li')];
  expect(steps).toHaveLength(3);
  ["Werdegang ansehen", "Studium auswählen", "Freigabe entscheiden"].forEach((name, index) => expect(steps[index].textContent).toContain(name));
  expect(host.textContent).toContain("Dies ist nur eine Vorschau. Hier werden keine persönlichen Daten abgefragt und keine Teilnahme oder Karriereprofile gespeichert.");
  expect(host.textContent).toMatch(/synthetisch/i);
  const details = host.querySelector("details")!;
  expect(details.querySelector("summary")?.textContent).toBe("Angaben zur Befragung");
  expect(details.open).toBe(false);
  expect([...details.querySelectorAll("dd")].map(dd => dd.textContent)).toEqual(["Synthetische Hochschule", "Synthetische Fakultät", "Master Informatik", context.name]);
  expect(host.textContent).not.toMatch(/Referenzabschluss|Beispielreferenz|Beispielauswahl prüfen|Bachelor · Master/);
  expect(host.querySelectorAll("input, select, textarea, form")).toHaveLength(0);
});

it.each(["Master Informatik", "Management Sozialer Innovationen"])("shows the supplied program %s without inventing a degree type, and toggles locally", async programName => {
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  const storage = vi.spyOn(Storage.prototype, "setItem");
  const host = await mount(createElement(SyntheticEntry, { programName }));
  const toggle = [...host.querySelectorAll("button")].find(button => button.textContent === "Fiktives Beispiel ansehen")!;
  expect(toggle).toBeDefined();
  expect(toggle.type).toBe("button");
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  const example = document.getElementById(toggle.getAttribute("aria-controls")!)!;
  expect(example.hidden).toBe(true);
  await act(async () => toggle.click());
  expect(example.hidden).toBe(false);
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  expect(example.querySelector("h3")?.textContent).toBe(programName);
  expect(example.textContent).toContain("Beispiel-Abschlussjahr: 2020");
  expect(example.textContent).toMatch(/fiktiv/i);
  expect(host.textContent).not.toMatch(/Bachelor ·|Referenzabschluss|bestätigen|wurde geprüft/);
  expect(host.querySelectorAll("input, form")).toHaveLength(0);
  await act(async () => toggle.click());
  expect(example.hidden).toBe(true);
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  expect(fetch).not.toHaveBeenCalled(); expect(storage).not.toHaveBeenCalled();
});

it.each(["0", "1"])("keeps closed surveys closed with no preview or participation actions (development participation %s)", async enabled => {
  vi.stubEnv("CAREERMAP_DEV_DONATION", enabled);
  vi.mocked(readSurveyInvitation).mockResolvedValue({ ...context, status: "CLOSED" });
  const host = await mount(await page());
  expect(host.textContent).toContain("Diese Befragung ist geschlossen");
  expect(host.textContent).toContain("Eine Teilnahme ist derzeit nicht möglich.");
  expect(host.querySelectorAll("button, input, form")).toHaveLength(0);
});

it("preserves the regular development participation entry and session warning", async () => {
  vi.stubEnv("CAREERMAP_DEV_DONATION", "1"); vi.stubEnv("CAREERMAP_SYNTHETIC_DONATION", "1");
  const host = await mount(await SurveyEntryPage({ params: Promise.resolve({ surveyId }), searchParams: Promise.resolve({ session: "missing" }) }));
  expect(host.querySelector("h1")?.textContent).toBe(context.name);
  expect(host.textContent).toContain("Deine Teilnahmesitzung ist hier nicht mehr verfügbar.");
  expect([...host.querySelectorAll("button")].map(button => button.textContent)).toEqual(["Mit LinkedIn-Datenspende beginnen", "Mit synthetischem Testprofil beginnen"]);
  expect(host.textContent).not.toContain("Fiktives Beispiel ansehen");
});

it("offers a clear actual start for an explicitly enabled open survey and removes false no-storage claims", async () => {
  vi.mocked(manualParticipationEnabled).mockReturnValue(true);
  const host = await mount(await page());
  expect([...host.querySelectorAll("button")].map(b => b.textContent)).toEqual(["Mit LinkedIn starten", "Selbst eintragen"]);
  expect(host.textContent).not.toMatch(/Dies ist nur eine Vorschau|keine Teilnahme oder Karriereprofile gespeichert|Fiktives Beispiel ansehen|spätere Teilnahme geplant/);
  vi.mocked(readSurveyInvitation).mockResolvedValue({ ...context, status: "CLOSED" });
  await act(async () => root!.render(await page()));
  expect(host.querySelectorAll("button")).toHaveLength(0);
});

it("keeps access and invalid/unknown survey guards ahead of rendering", async () => {
  vi.mocked(headers).mockResolvedValue(new Headers({ host: "foreign.invalid" }) as Awaited<ReturnType<typeof headers>>);
  await expect(page()).rejects.toThrow("NOT_FOUND");
  expect(surveyClient).not.toHaveBeenCalled();
  vi.mocked(headers).mockResolvedValue(new Headers({ host: "localhost:3110" }) as Awaited<ReturnType<typeof headers>>);
  await expect(page("invalid")).rejects.toThrow("NOT_FOUND");
  expect(surveyClient).not.toHaveBeenCalled();
  vi.mocked(readSurveyInvitation).mockResolvedValue(null);
  await expect(page()).rejects.toThrow("NOT_FOUND");
});
