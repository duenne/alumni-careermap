import type { CanonicalCareerStep, CanonicalDegree, NormalizationInput, SourceStation } from "../../lib/normalization/contract";
import type { SyntheticInputProfile } from "./contract";

export type AcademicLevelEvidence = Readonly<Record<string, Readonly<Record<string, CanonicalDegree["level"]>>>>;

// Additional independently authored synthetic evidence for E.3b ONLY. These
// assertions are not recovered from provider data, titles or the D.2 oracle.
export const academicLevels: AcademicLevelEvidence = {
  "career-01": { "source-bachelor": "BACHELOR", "source-master": "MASTER" },
  "career-02": { "source-study": "BACHELOR" },
  "career-04": { "source-study": "BACHELOR" },
  "career-05": { "source-doctorate": "PHD" },
  "career-06": { "source-certificate": "CERTIFICATE" },
  "career-09": { "source-uncertain-study": "BACHELOR" },
  "career-11": { "source-first-award": "BACHELOR", "source-second-award": "BACHELOR" },
};

// Separate deterministic test catalog. No name matching or persistent writes.
export const testCatalogIds: Readonly<Record<"institution" | "program" | "organisation", Readonly<Record<string, string>>>> = {
  institution: {
    "institution-a": "00000000-0000-4000-8000-000000000101",
    "institution-a-distinct": "00000000-0000-4000-8000-000000000102",
    "institution-b": "00000000-0000-4000-8000-000000000103",
  },
  program: {
    "program-a": "00000000-0000-4000-8000-000000000111",
    "program-b": "00000000-0000-4000-8000-000000000112",
  },
  organisation: {
    "organisation-a": "00000000-0000-4000-8000-000000000121",
    "organisation-b": "00000000-0000-4000-8000-000000000122",
  },
};

const asserted = <T>(value: T) => ({ kind: "ASSERTED", value }) as const;
const observed = <T>(value: T) => ({ kind: "OBSERVED", value }) as const;
const missing = () => ({ kind: "MISSING" }) as const;
const activityTypes = {
  vocational: "VOCATIONAL_TRAINING", exchange: "EDUCATION", course: "EDUCATION",
  employment: "EMPLOYMENT", internship: "INTERNSHIP", "self-employment": "SELF_EMPLOYMENT", volunteering: "VOLUNTEERING",
} as const satisfies Record<Exclude<SyntheticInputProfile["stations"][number]["kind"], "academic" | "unclear">, CanonicalCareerStep["type"]>;

/** Test-only input adapter. Runtime imports deliberately exclude catalog.ts,
 * expected.ts and all normalizers. D.2 kind/outcome have declared synthetic
 * meanings; provider labels and academic titles are never interpreted.
 */
export function adaptSyntheticInput(input: SyntheticInputProfile, levels: AcademicLevelEvidence = academicLevels): NormalizationInput {
  return { stations: input.stations.map(source => {
    if (!Number.isSafeInteger(source.timelinePosition) || source.timelinePosition <= 0) throw new Error("Explicit synthetic timeline position required");
    let classification: SourceStation["classification"] = missing();
    let degreeStatus: SourceStation["degreeStatus"] = missing();
    let temporalStatus: SourceStation["temporalStatus"] = missing();
    if (source.kind === "academic") {
      const level = levels[input.caseId]?.[source.key];
      if (!level) throw new Error("Missing explicit synthetic academic-level evidence");
      classification = asserted({ type: "DEGREE", level });
      switch (source.outcome) {
        case "awarded": degreeStatus = asserted("COMPLETED"); break;
        case "studying": degreeStatus = asserted("IN_PROGRESS"); break;
        case "left-without-award": degreeStatus = asserted("ENDED_WITHOUT_DEGREE"); break;
        case "unspecified": break;
        default: throw new Error("Unsupported synthetic academic outcome");
      }
    } else if (source.kind !== "unclear") {
      classification = asserted({ type: "CAREER_STEP", careerStepType: activityTypes[source.kind] });
      switch (source.outcome) {
        case "ongoing": temporalStatus = asserted("ONGOING"); break;
        case "ended": temporalStatus = asserted("ENDED"); break;
        case "unspecified": break;
        default: throw new Error("Unsupported synthetic activity outcome");
      }
    } else if (source.outcome !== "unspecified") throw new Error("Unsupported unclassified synthetic outcome");
    const association = source.catalogAssociation;
    let catalog: SourceStation["catalog"] = { kind: "UNKNOWN" };
    if (association !== null) {
      const ids = testCatalogIds[association.kind];
      if (!Object.hasOwn(ids, association.key)) throw new Error("Unknown synthetic catalog key");
      const entity = { program: "PROGRAM", institution: "INSTITUTION", organisation: "ORGANISATION" } as const;
      catalog = { kind: "CONFIRMED", identity: { entity: entity[association.kind], id: ids[association.key] }, confirmation: "TRUSTED_INPUT" };
    }
    return {
      key: source.key, title: observed(source.label), category: observed(source.kind),
      providerLabel: source.providerLabel === null ? missing() : observed(source.providerLabel),
      start: source.start === null ? missing() : observed({ ...source.start }),
      end: source.end === null ? missing() : observed({ ...source.end }),
      graduation: source.graduation === null ? missing() : observed({ ...source.graduation }),
      classification, degreeStatus, temporalStatus, position: asserted(source.timelinePosition), catalog,
    };
  }) };
}
