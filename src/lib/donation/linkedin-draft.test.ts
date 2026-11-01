import { expect, it } from "vitest";
import { linkedInDraft } from "./linkedin-draft";

const snapshot = (): { elements: { snapshotDomain: string; snapshotData: Record<string, string>[] }[] } => ({ elements: [
  { snapshotDomain: "PROFILE", snapshotData: [{ firstName: "PRIVATE_SYNTHETIC_NAME", email: "synthetic@example.invalid" }] },
  { snapshotDomain: "EDUCATION", snapshotData: [
    { "Degree Name": "Synthetischer Master Informatik", "School Name": "Synthetische Hochschule", "Start Date": "Oct 2018", "End Date": "2020" },
    { "Degree Name": "Synthetischer Austausch", "School Name": "Andere synthetische Hochschule", "Start Date": "around 2017", "End Date": "" },
  ] },
  { snapshotDomain: "POSITIONS", snapshotData: [{ Title: "Synthetic Software Developer", "Company Name": "Synthetic employer", "Started On": "2021", "Finished On": "" }] },
] });
it("reuses the existing snapshot adapter and review suggestions without assigning a survey, reference or invented graduation year", () => {
  const input = snapshot(), result = linkedInDraft(input);
  expect(result).toHaveLength(3);
  const degree = result.find(s => s.title === "Synthetischer Master Informatik");
  expect(degree).toMatchObject({ kind: "DEGREE", level: "MASTER", status: "COMPLETED", program: "OTHER", startYear: 2018, endYear: 2020, graduationYear: null, institutionName: "Synthetische Hochschule" });
  expect(result.find(s => s.title === "Synthetischer Austausch")).toMatchObject({ startYear: null, endYear: null, status: "UNKNOWN" });
  expect(result.find(s => s.title === "Synthetic Software Developer")).toMatchObject({ kind: "CAREER_STEP", status: "UNKNOWN", startYear: 2021, endYear: null });
  expect(JSON.stringify(result)).not.toMatch(/PRIVATE_SYNTHETIC_NAME|synthetic@example|PROFILE|snapshotData/);
  expect(input).toEqual(snapshot());
});
it("does not silently drop rows or truncate imported values beyond the editable form's limits", () => {
  const input = snapshot(); input.elements[1].snapshotData[0]["Degree Name"] = "x".repeat(201);
  expect(() => linkedInDraft(input)).toThrow();
  expect(() => linkedInDraft({ elements: [] })).toThrow();
});
it("requires a status choice for unclassified education instead of assigning a career-step status to a degree", () => {
  const input = snapshot(); input.elements[1].snapshotData[1]["End Date"] = "2017";
  expect(linkedInDraft(input).find(s => s.title === "Synthetischer Austausch")).toMatchObject({ level: "", status: "", endYear: 2017 });
});
