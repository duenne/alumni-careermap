import { expect, it } from "vitest";
import { classificationSuggestions } from "./classification";

it("suggests study fields separately from occupation and employer sector, with reasons", () => {
  const study = classificationSuggestions({ title: "Master Informatik", provider: "Synthetic Universität", degree: true });
  expect(study.field?.value).toBe("Informatik");
  expect(study.job).toBeUndefined(); expect(study.sector).toBeUndefined();
  const job = classificationSuggestions({ title: "Software Developer", provider: "Synthetic Krankenhaus", degree: false });
  expect(job.job?.value).toBe("Softwareentwicklung");
  expect(job.sector?.value).toBe("Gesundheitswesen");
  expect(job.job?.reason).toContain("Software Developer");
});
it("keeps unknown and conflicting evidence unknown, never infers a sector from a job", () => {
  expect(classificationSuggestions({ title: "Manager", provider: "Synthetic ACME", degree: false })).toEqual({});
  expect(classificationSuggestions({ title: "Software Developer", provider: "Synthetic ACME", degree: false }).sector).toBeUndefined();
  expect(classificationSuggestions({ title: "Master Informatik und Psychologie", provider: "", degree: true }).field).toBeUndefined();
});
