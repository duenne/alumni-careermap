import { verifyDemoSource } from "./source-policy";
import { inspectDemoProfiles } from "./profile-plan";
import { uuid } from "../career-import/mapping";
export { inspectDemoProfiles };

type DemoSeedInput = {
  policy: unknown; sourceText: unknown; expectedText: unknown;
  referenceProgramId: unknown; selections: unknown;
};

/** Deterministic, database-free plan. Logical keys are local to this plan, NOT
 * database UUIDs. The caller supplies the existing MSI pilot Program UUID from
 * trusted configuration; existence/affiliation must be rechecked in D1.2.
 * CLOSED is the requested END state. Responses may only be written while OPEN.
 * No confirmedAt, human consent, database credentials or persistence capability.
 */
export function planV5DemoSeed(input: DemoSeedInput) {
  const source = verifyDemoSource(input.policy, input.sourceText, input.expectedText);
  const inspection = inspectDemoProfiles({ source: source.source, expected: source.expected,
    referenceProgramId: input.referenceProgramId, selections: input.selections });
  return {
    valid: inspection.validationErrors.length === 0,
    survey: { name: "SYNTHETISCH / DEMO – Alumni MSI", referenceProgramId: uuid(input.referenceProgramId) ? input.referenceProgramId.toLowerCase() : null,
      targetStatus: "CLOSED", requiredWriteLifecycle: ["DRAFT", "OPEN", "CLOSED"] } as const,
    source: { policy: source.policy, sourceSha256: source.sourceSha256, expectedSha256: source.expectedSha256 },
    ...inspection,
  };
}
