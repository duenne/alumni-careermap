import { expect, it } from "vitest";
import { safeSnapshotDiagnostic, snapshotDiagnosticLabel } from "./errors";

it("formats only fixed, bounded diagnostic metadata and never source values", () => {
  const input = { domain: "EDUCATION", page: 1, reason: "PAGING_START", raw: "PRIVATE_SYNTHETIC_MARKER" };
  expect(safeSnapshotDiagnostic(input)).toEqual({ domain: "EDUCATION", page: 1, reason: "PAGING_START" });
  expect(snapshotDiagnosticLabel(input)).toBe("Diagnose: EDUCATION · Seite 2 · PAGING_START");
  for (const value of [null, { reason: "PRIVATE_SYNTHETIC_MARKER" }, { reason: "PAGING_START", domain: "PRIVATE_SYNTHETIC_MARKER" },
    { reason: "PAGING_START", page: -1 }, { reason: "PAGING_START", page: 100 }, { reason: "HTTP_STATUS", httpStatus: "PRIVATE_SYNTHETIC_MARKER" }]) {
    expect(safeSnapshotDiagnostic(value)).toBeUndefined();
    expect(snapshotDiagnosticLabel(value)).toBeNull();
  }
});
