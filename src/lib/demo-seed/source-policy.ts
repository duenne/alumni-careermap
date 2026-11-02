import { createHash } from "node:crypto";
import { auditFixturePair } from "../fixture-audit";

// Closed allowlist. Callers cannot approve new sources by supplying a digest.
// Hashes establish byte identity, not provenance by themselves. See D1.1 report.
const policies = {
  "v5-demo-mini-v1": {
    sourceSha256: "d6273f0b72766aa72f9dcd8e6cbb429e1ecdc9672e623929907ca4b6185d328e",
    expectedSha256: "9c56ec99a9ff3180ae487ccb32bfab5f494ca6d14a1c1c016f7fdb53054281b7",
    profiles: 1, education: 3, positions: 1,
  },
  "v5-demo-phase-d-100-v1": {
    sourceSha256: "c218dd34ef364e9e76d4bc470c35c1ef7a6391ed5ef1895045b3950759df6aef",
    expectedSha256: "f5cb2d130a8755ae81ddbefa90b3bb65d7e04c35434303473779ad103d9293f0",
    profiles: 100, education: 195, positions: 237,
  },
} as const;

export class DemoSourceError extends Error {
  constructor(readonly code: "SOURCE_POLICY_NOT_APPROVED" | "FIXTURE_REQUIRED" | "CHECKSUM_MISMATCH" | "INVALID_FIXTURE_JSON" | "INCOMPLETE_FIXTURE") {
    super(code); this.name = "DemoSourceError";
  }
}

/** No paths, filesystem, environment, database, network or configurable trust
 * registry. Only the two reviewed synthetic sources are accepted, byte for byte.
 */
export function verifyDemoSource(policy: unknown, sourceText: unknown, expectedText: unknown) {
  if (typeof policy !== "string" || !Object.hasOwn(policies, policy)) throw new DemoSourceError("SOURCE_POLICY_NOT_APPROVED");
  const approved = policies[policy as keyof typeof policies];
  if (typeof sourceText !== "string" || typeof expectedText !== "string" || !sourceText.trim() || !expectedText.trim()
    || sourceText.length > 2_000_000 || expectedText.length > 2_000_000) throw new DemoSourceError("FIXTURE_REQUIRED");
  const hash = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");
  if (hash(sourceText) !== approved.sourceSha256 || hash(expectedText) !== approved.expectedSha256) throw new DemoSourceError("CHECKSUM_MISMATCH");
  let source: unknown, expected: unknown;
  try { source = JSON.parse(sourceText); expected = JSON.parse(expectedText); }
  catch { throw new DemoSourceError("INVALID_FIXTURE_JSON"); }
  const { ok, inventory: counts } = auditFixturePair(source, expected);
  if (!ok || counts.snapshotEntries !== approved.profiles || counts.expectedEntries !== approved.profiles
    || counts.sourceRecords.education !== approved.education || counts.sourceRecords.position !== approved.positions
    || counts.stations.education !== approved.education || counts.stations.position !== approved.positions) throw new DemoSourceError("INCOMPLETE_FIXTURE");
  return { source, expected, policy, sourceSha256: approved.sourceSha256, expectedSha256: approved.expectedSha256 };
}
