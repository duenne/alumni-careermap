// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
import ParticipationStart from "./manual-start";
let root: Root;
afterEach(async () => { if (root) await act(async () => root.unmount()); vi.unstubAllGlobals(); vi.clearAllMocks(); document.body.replaceChildren(); });
it.each(["manual", "linkedin"] as const)("offers both sources and starts %s through the same survey-bound participation endpoint", async source => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const fetch = vi.fn(async () => Response.json({ started: true })); vi.stubGlobal("fetch", fetch);
  const host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(createElement(ParticipationStart, { surveyId: "synthetic-survey", linkedInAvailable: true })));
  const buttons = [...host.querySelectorAll("button")];
  expect(buttons.map(b => b.textContent)).toEqual(["Mit LinkedIn starten", "Selbst eintragen"]);
  expect(fetch).not.toHaveBeenCalled();
  await act(async () => buttons[source === "linkedin" ? 0 : 1].click());
  expect(fetch).toHaveBeenCalledWith("/api/surveys/synthetic-survey/participation", expect.objectContaining({ method: "POST", body: JSON.stringify({ begin: source }) }));
  expect(push).toHaveBeenCalledWith("/surveys/synthetic-survey/participation");
});
