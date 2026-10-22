import { describe, expect, it, vi } from "vitest";
import fixture from "../../test-fixtures/linkedin-snapshots/fictional-member.json";
import { adaptLinkedInSnapshot } from "../normalization/adapt-linkedin-snapshot";
import { parseEditor, projectSnapshot } from "./json-preview";

describe("V1a temporary career JSON", () => {
  it("uses the existing adapter while excluding profile and unused station fields", () => {
    const before = structuredClone(fixture);
    const projected = projectSnapshot(fixture);
    expect(adaptLinkedInSnapshot(projected)).toEqual(adaptLinkedInSnapshot(fixture));
    expect(projected.elements[0]).toEqual({ snapshotDomain: "PROFILE", snapshotData: [{}] });
    for (const marker of ["Fictional Profile", "fictional-private", "FICTIONAL_", "Email", "Location", "Description", "Notes"]) {
      expect(JSON.stringify(projected)).not.toContain(marker);
    }
    expect(fixture).toEqual(before);
  });
  it("reports source observations without inventing Degrees or confirmation", () => {
    const result = parseEditor(JSON.stringify(fixture));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected valid fixture");
    expect(result.counts).toEqual({ education: 2, positions: 2 });
    expect(result.input).toEqual(adaptLinkedInSnapshot(fixture));
    expect(result.input.stations.every(station => station.classification.kind === "MISSING")).toBe(true);
    expect(result.result.stations).toEqual(result.input.stations.map(station => ({
      sourceKey: station.key, kind: "REVIEW_REQUIRED",
      unresolved: [{ field: "classification", reason: "CLASSIFICATION_UNCERTAIN" }],
    })));
    expect(result.json).not.toContain("First Name");
  });
  it.each(["{", '{"private": "UNTRUSTED_MARKER",}', "null"])("redacts invalid JSON/contract errors", text => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = parseEditor(text);
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain("UNTRUSTED_MARKER");
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });
  it("distinguishes missing snapshot domains from valid empty career domains", () => {
    expect(parseEditor('{"elements":[]}')).toMatchObject({ ok: false });
    const empty = { elements: fixture.elements.map(element => ({ ...element, snapshotData: element.snapshotDomain === "PROFILE" ? [{}] : [] })) };
    expect(parseEditor(JSON.stringify(empty))).toMatchObject({ ok: true, counts: { education: 0, positions: 0 } });
  });
  it("limits editor input size without echoing content", () => {
    expect(parseEditor("x".repeat(200_001))).toMatchObject({ ok: false });
  });
});
