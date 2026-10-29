// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import MappingEditor from "./mapping-editor";

beforeEach(() => vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true));
afterEach(() => { vi.unstubAllGlobals(); document.body.replaceChildren(); });

it.each([
  ["ORIGIN_MISMATCH", "Die LinkedIn-Verbindung ist für eine andere lokale Adresse eingerichtet."],
  ["NOT_CONFIGURED", "LinkedIn ist noch nicht lokal konfiguriert."],
] as const)("explains %s without confusing the survey URL with the fixed callback", async (configurationIssue, message) => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => Response.json(url.endsWith("/status")
    ? { configured: false, connected: false, configurationIssue }
    : { surveys: [], institutions: [], programs: [], organisations: [], fixtures: [], savedProfiles: [], storage: "TEMPORARY" })));
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(createElement(MappingEditor, { workflow: true, participant: { surveyId: "00000000-0000-4000-8000-000000000001", source: "linkedin" } })));
    expect(host.textContent).toContain(message);
    if (configurationIssue === "ORIGIN_MISMATCH") {
      expect(host.textContent).toContain("Die Befragungs-ID gehört nicht in den LinkedIn-Callback.");
    }
    const connect = [...host.querySelectorAll("button")].find(button => button.textContent === "Mit LinkedIn verbinden");
    expect(connect?.disabled).toBe(true);
  } finally { await act(async () => root.unmount()); }
});
