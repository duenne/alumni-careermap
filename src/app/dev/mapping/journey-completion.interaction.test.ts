// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import MappingEditor from "./mapping-editor";

afterEach(() => { vi.unstubAllGlobals(); document.body.replaceChildren(); });
it("continues a committed contribution to the same protected survey dashboard without returning identifiers or another demo", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ surveys: [], savedProfiles: [], receipt: { degrees: 2, careerSteps: 1, timelineItems: 3 } })));
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  const id = "00000000-0000-4000-8000-000000000001";
  try {
    await act(async () => root.render(createElement(MappingEditor, { workflow: true, participant: { surveyId: id, source: "synthetic" } })));
    expect(host.textContent).toContain("Vielen Dank für deine Datenspende");
    expect(host.textContent).toContain("Nur für den Betreiber");
    expect(host.querySelector(`a[href="/admin/surveys/${id}/analytics"]`)?.textContent).toBe("Geschützte Auswertung öffnen");
    expect(host.querySelector('a[href="/"]')).not.toBeNull();
    expect(host.querySelector('a[href*="/dev/"]')).toBeNull();
    expect(host.textContent).not.toContain("Profil-ID");
  } finally { await act(async () => root.unmount()); }
});
