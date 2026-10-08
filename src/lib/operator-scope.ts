export type OperatorScope =
  | Readonly<{ kind: "INSTITUTION"; institutionId: string; faculty?: never }>
  | Readonly<{ kind: "FACULTY"; institutionId: string; faculty: string }>;

/** Trusted installation configuration, supplied separately from response input. */
export type SurveyResponseServiceConfiguration = Readonly<{ operatorScope: OperatorScope }>;

type InvalidOperatorConfigurationReason =
  | "MISSING_SCOPE"
  | "INVALID_SCOPE"
  | "INVALID_INSTITUTION_ID"
  | "INVALID_FACULTY"
  | "INSTITUTION_NOT_FOUND";

export class InvalidOperatorConfigurationError extends Error {
  constructor(public readonly reason: InvalidOperatorConfigurationReason) {
    const explanation = {
      MISSING_SCOPE: "Operator scope is required",
      INVALID_SCOPE: "Operator scope must be explicitly INSTITUTION or FACULTY",
      INVALID_INSTITUTION_ID: "Operator Institution ID must be a UUID",
      INVALID_FACULTY: "FACULTY scope requires a nonblank faculty scalar",
      INSTITUTION_NOT_FOUND: "Operator Institution does not exist",
    }[reason];
    super(explanation);
    this.name = "InvalidOperatorConfigurationError";
  }
}

/** Validate configuration shape and return a snapshot. Institution existence
 * is checked by the response service inside its writing transaction.
 * Faculty is checked for blankness but kept verbatim for exact correspondence.
 */
export function validateOperatorScope(value: unknown): OperatorScope {
  if (value === undefined || value === null) throw new InvalidOperatorConfigurationError("MISSING_SCOPE");
  if (typeof value !== "object" || Array.isArray(value)) throw new InvalidOperatorConfigurationError("INVALID_SCOPE");
  const scope = value as Record<string, unknown>;
  if (scope.kind !== "INSTITUTION" && scope.kind !== "FACULTY") throw new InvalidOperatorConfigurationError("INVALID_SCOPE");
  if (typeof scope.institutionId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(scope.institutionId)) {
    throw new InvalidOperatorConfigurationError("INVALID_INSTITUTION_ID");
  }
  const institutionId = scope.institutionId.toLowerCase();
  if (scope.kind === "INSTITUTION") {
    if ("faculty" in scope) throw new InvalidOperatorConfigurationError("INVALID_SCOPE");
    return { kind: "INSTITUTION", institutionId };
  }
  if (typeof scope.faculty !== "string" || !/\S/u.test(scope.faculty)) throw new InvalidOperatorConfigurationError("INVALID_FACULTY");
  return { kind: "FACULTY", institutionId, faculty: scope.faculty };
}
