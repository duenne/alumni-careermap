export const portabilityMessages = {
  NOT_CONFIGURED: "LinkedIn ist noch nicht lokal konfiguriert. Produktfreigabe, Scope und Redirect-URL prüfen.",
  INVALID_STATE: "Die LinkedIn-Anmeldung ist abgelaufen oder ungültig. Bitte erneut verbinden.",
  ACCESS_DENIED: "LinkedIn hat keine Freigabe erteilt. Bitte Berechtigungen und App-Freigabe prüfen.",
  TOKEN_EXCHANGE_FAILED: "Die LinkedIn-Anmeldung konnte nicht abgeschlossen werden. Bitte erneut verbinden.",
  SESSION_EXPIRED: "Die lokale LinkedIn-Verbindung ist abgelaufen. Bitte erneut verbinden.",
  SNAPSHOT_PENDING: "LinkedIn stellt die Karrieredaten noch nicht bereit. Bitte später erneut abrufen. Fehlende Daten werden nicht ergänzt.",
  RATE_LIMITED: "LinkedIn begrenzt die Abrufe. Bitte warten und später erneut versuchen.",
  INVALID_RESPONSE: "Die LinkedIn-Antwort entspricht nicht dem erwarteten Snapshot-Format. Es wurden keine Teildaten übernommen.",
  RESPONSE_TOO_LARGE: "Die LinkedIn-Antwort überschreitet ein lokales Größenlimit. Es wurden keine Teildaten übernommen.",
  IMPORT_LIMIT_EXCEEDED: "Der LinkedIn-Abruf überschreitet die zulässige Anzahl Seiten oder Stationen. Es wurden keine Teildaten übernommen.",
  PROVIDER_UNAVAILABLE: "LinkedIn ist derzeit nicht erreichbar oder der Abruf wurde abgebrochen. Bitte später erneut versuchen.",
  BUSY: "Ein LinkedIn-Abruf läuft bereits. Bitte dessen Abschluss abwarten.",
  CANCELLED: "Die LinkedIn-Freigabe wurde abgebrochen.",
} as const;
export type PortabilityErrorCode = keyof typeof portabilityMessages;
const diagnosticReasons = ["BODY_MISSING", "BODY_SIZE", "BODY_READ_FAILED", "JSON_SYNTAX", "ENVELOPE", "DOMAIN_DATA",
  "ROW_FIELDS", "FIELD_TYPE", "FIELD_SIZE", "PAGING_START", "PAGING_LINKS", "UNSAFE_PAGINATION",
  "ROW_LIMIT", "PAGE_LIMIT", "PROJECTION_SIZE", "PROJECTION_FORMAT", "HTTP_STATUS", "REQUEST_FAILED", "NO_SNAPSHOT_DATA"] as const;
export type SnapshotDiagnostic = {
  reason: typeof diagnosticReasons[number];
  domain?: "EDUCATION" | "POSITIONS";
  page?: number;
  httpStatus?: number;
};

/** Copy only fixed, bounded metadata. Never forward an exception/body/field key. */
export function safeSnapshotDiagnostic(value: unknown): SnapshotDiagnostic | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  const input = value as Record<string, unknown>;
  if (!diagnosticReasons.includes(input.reason as SnapshotDiagnostic["reason"])) return;
  if (input.domain !== undefined && input.domain !== "EDUCATION" && input.domain !== "POSITIONS") return;
  if (input.page !== undefined && (typeof input.page !== "number" || !Number.isInteger(input.page) || input.page < 0 || input.page > 99)) return;
  if (input.httpStatus !== undefined && (typeof input.httpStatus !== "number" || !Number.isInteger(input.httpStatus) || input.httpStatus < 100 || input.httpStatus > 599)) return;
  return { reason: input.reason as SnapshotDiagnostic["reason"],
    ...(input.domain !== undefined ? { domain: input.domain } : {}),
    ...(input.page !== undefined ? { page: input.page as number } : {}),
    ...(input.httpStatus !== undefined ? { httpStatus: input.httpStatus as number } : {}),
  };
}
export function snapshotDiagnosticLabel(value: unknown): string | null {
  const diagnostic = safeSnapshotDiagnostic(value);
  return diagnostic ? `Diagnose: ${diagnostic.domain ?? "SNAPSHOT"}${diagnostic.page !== undefined ? ` · Seite ${diagnostic.page + 1}` : ""} · ${diagnostic.reason}${diagnostic.httpStatus !== undefined ? ` · HTTP ${diagnostic.httpStatus}` : ""}` : null;
}
export function portabilityMessage(code: unknown): string {
  return typeof code === "string" && Object.hasOwn(portabilityMessages, code)
    ? portabilityMessages[code as PortabilityErrorCode] : portabilityMessages.PROVIDER_UNAVAILABLE;
}
