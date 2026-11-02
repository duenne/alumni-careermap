import { expect, it } from "vitest";
import { parseSurveyEdit } from "./service";

export const editInput = {
  surveyId: "00000000-0000-4000-8000-000000000001",
  expectedUpdatedAt: "2026-11-02T10:00:00.000Z",
  name: " Synthetic Survey ",
  entryHeading: " Synthetic Cafe\u0301 ", entryIntro: "Synthetic introduction",
  entryWelcome: "", entryPurpose: "Synthetic purpose", entryContact: " ",
};
it("normalizes editorial fields and clears optional text without touching the reference", () => {
  expect(parseSurveyEdit(editInput)).toMatchObject({ name: "Synthetic Survey", entryHeading: "Synthetic Café", entryWelcome: null, entryContact: null });
});
it("rejects injected status/reference/privacy fields, blank names and oversized or malformed text", () => {
  for (const patch of [{ status: "OPEN" }, { referenceProgramId: editInput.surveyId }, { consent: "custom" }, { name: " " }, { entryHeading: "x".repeat(161) }, { entryWelcome: 7 }, { expectedUpdatedAt: "yesterday" }]) {
    expect(() => parseSurveyEdit({ ...editInput, ...patch })).toThrow();
  }
});
