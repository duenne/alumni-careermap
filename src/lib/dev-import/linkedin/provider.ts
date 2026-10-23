import "server-only";
import type { LinkedInConfig } from "./config";
import { portabilityMessages, type PortabilityErrorCode, type SnapshotDiagnostic } from "./errors";
import { projectSnapshot, type SnapshotProjection } from "../json-preview";
import { isNoSnapshotData } from "./no-data";

export class PortabilityError extends Error {
  constructor(readonly code: PortabilityErrorCode, readonly diagnostic?: SnapshotDiagnostic) { super(portabilityMessages[code]); this.name = "PortabilityError"; }
}
export type ProviderToken = { accessToken: string; expiresIn: number };
export type RawSnapshotDump = {
  kind: "linkedin-raw-preview";
  complete: false;
  domains: {
    domain: "EDUCATION" | "POSITIONS";
    stopped: "HTTP_ERROR" | "NO_PAGING" | "PREVIEW_LIMIT" | "DIAGNOSTIC_ERROR";
    pages: { page: number; status: number; requestKind: "initial" | "next-link" | "probe"; body: unknown }[];
    diagnostic?: SnapshotDiagnostic;
  }[];
};
/** Review and normalization receive the same minimal snapshot for either product. */
export interface CareerDataProvider {
  authorizationUrl(state: string): string;
  exchange(code: string): Promise<ProviderToken>;
  snapshot(accessToken: string, signal?: AbortSignal): Promise<SnapshotProjection>;
  rawSnapshot(accessToken: string, signal?: AbortSignal): Promise<RawSnapshotDump>;
}
const endpoint = "https://api.linkedin.com/rest/memberSnapshotData";
const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const invalid = (reason: SnapshotDiagnostic["reason"] = "ENVELOPE"): never => { throw new PortabilityError("INVALID_RESPONSE", { reason }); };

/** Raw career values are explicitly previewed, credentials and header echoes are
 * not. This copy is response-local and is never retained by the session store.
 */
function redactRaw(value: unknown, secrets: string[], depth = 0): unknown {
  const text = (input: string) => {
    let result = input;
    for (const secret of secrets) if (secret) {
      result = result.split(secret).join("[REDACTED]").split(encodeURIComponent(secret)).join("[REDACTED]");
    }
    return result.replace(/\bBearer\s+[^\s"']+/gi, "Bearer [REDACTED]")
      .replace(/((?:access_token|refresh_token|client_secret|authorization)=)[^&\s"']+/gi, "$1[REDACTED]");
  };
  if (typeof value === "string") return text(value);
  if (!value || typeof value !== "object") return value;
  if (depth >= 64) return "[REDACTED_DEPTH_LIMIT]";
  if (Array.isArray(value)) return value.map(item => redactRaw(item, secrets, depth + 1));
  const credentials = ["accesstoken", "refreshtoken", "idtoken", "token", "clientsecret", "authorization", "cookie", "setcookie", "headers", "requestheaders", "responseheaders"];
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [text(key),
    credentials.includes(key.toLowerCase().replace(/[_\s-]/g, "")) ? "[REDACTED]" : redactRaw(item, secrets, depth + 1),
  ]));
}

function nextSnapshotPage(body: Record<string, unknown>, current: URL, domain: "EDUCATION" | "POSITIONS", page: number): URL | null {
  if (body.paging === undefined) return null;
  if (!isRecord(body.paging) || body.paging.start !== page) return invalid("PAGING_START");
  const links = body.paging.links;
  if (links !== undefined && !Array.isArray(links)) return invalid("PAGING_LINKS");
  const nextLinks = (links as unknown[] | undefined)?.filter(link => isRecord(link) && link.rel === "next") ?? [];
  if (nextLinks.length > 1) return invalid("PAGING_LINKS");
  const link = nextLinks[0];
  let next: URL;
  try {
    next = isRecord(link) && typeof link.href === "string" ? new URL(link.href, endpoint) : new URL(current);
  } catch { return invalid("UNSAFE_PAGINATION"); }
  if (!link) next.searchParams.set("start", String(page + 1));
  if (next.origin !== "https://api.linkedin.com" || next.pathname !== "/rest/memberSnapshotData"
    || next.username || next.password || next.hash || next.searchParams.get("q") !== "criteria"
    || next.searchParams.get("domain") !== domain || next.searchParams.get("start") !== String(page + 1)
    || [...next.searchParams.keys()].some(key => !["q", "domain", "start", "count"].includes(key))
    || ["q", "domain", "start", "count"].some(key => next.searchParams.getAll(key).length > 1)
    || next.searchParams.has("count") && next.searchParams.get("count") !== "10") return invalid("UNSAFE_PAGINATION");
  // LinkedIn documents start as page index. total is explicitly unreliable.
  return next;
}

async function json(response: Response, maxBytes = 500_000): Promise<unknown> {
  // Bound even chunked bodies; never log or include provider bodies in errors.
  if (!response.body) return invalid("BODY_MISSING");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > maxBytes) { await reader.cancel(); throw new PortabilityError("RESPONSE_TOO_LARGE", { reason: "BODY_SIZE" }); }
      chunks.push(value);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
    catch { return invalid("JSON_SYNTAX"); }
  } catch (failure) {
    if (failure instanceof PortabilityError) throw failure;
    throw new PortabilityError("PROVIDER_UNAVAILABLE", { reason: "BODY_READ_FAILED" });
  }
  finally { reader.releaseLock(); }
}

export function createLinkedInProvider(config: LinkedInConfig, fetcher: typeof fetch = fetch): CareerDataProvider {
  async function request(url: string | URL, options: RequestInit, signal?: AbortSignal) {
    try {
      return await fetcher(url, { ...options, cache: "no-store", redirect: "error",
        signal: AbortSignal.any([AbortSignal.timeout(10_000), ...(signal ? [signal] : [])]),
      });
    } catch { throw new PortabilityError("PROVIDER_UNAVAILABLE", { reason: "REQUEST_FAILED" }); }
  }
  async function domainData(domain: "EDUCATION" | "POSITIONS", token: string, signal: AbortSignal) {
    const rows: Record<string, string>[] = [];
    let current = new URL(endpoint);
    current.search = new URLSearchParams({ q: "criteria", domain, start: "0", count: "10" }).toString();
    let page = 0;
    try {
      for (; page < 100; page++) {
        const response = await request(current, { headers: {
          Authorization: `Bearer ${token}`, "LinkedIn-Version": "202312", "X-Restli-Protocol-Version": "2.0.0",
        } }, signal);
        if (!response.ok) {
          const diagnostic: SnapshotDiagnostic = { reason: "HTTP_STATUS", httpStatus: response.status };
          if (response.status === 401) throw new PortabilityError("SESSION_EXPIRED", diagnostic);
          if (response.status === 403) throw new PortabilityError("ACCESS_DENIED", diagnostic);
          if (response.status === 429) throw new PortabilityError("RATE_LIMITED", diagnostic);
          if (response.status === 404) {
            const body = await json(response);
            // Recognize the no-data meaning, allowing harmless wording/spacing
            // variants. Never infer completion from HTTP 404 alone.
            if (isNoSnapshotData(body)) {
              if (page > 0) return rows;
              throw new PortabilityError("SNAPSHOT_PENDING", { reason: "NO_SNAPSHOT_DATA", httpStatus: 404 });
            }
            throw new PortabilityError("INVALID_RESPONSE", diagnostic);
          }
          throw new PortabilityError("PROVIDER_UNAVAILABLE", diagnostic);
        }
        const body = await json(response);
        if (!isRecord(body) || !Array.isArray(body.elements) || body.elements.length !== 1) return invalid();
        const element = body.elements[0];
        if (!isRecord(element) || element.snapshotDomain !== domain || !Array.isArray(element.snapshotData)) return invalid("DOMAIN_DATA");
        const fields = domain === "EDUCATION" ? ["Degree Name", "School Name", "Start Date", "End Date"] : ["Title", "Company Name", "Started On", "Finished On"];
        for (const row of element.snapshotData) {
          if (!isRecord(row) || !fields.slice(0, 2).some(field => Object.hasOwn(row, field))) return invalid("ROW_FIELDS");
          const projected: Record<string, string> = {};
          for (const field of fields) {
            // Absent/null values remain missing observations, never invented dates.
            const value = row[field] ?? "";
            if (typeof value !== "string") return invalid("FIELD_TYPE");
            if (value.length > 10_000) throw new PortabilityError("RESPONSE_TOO_LARGE", { reason: "FIELD_SIZE" });
            projected[field] = value;
          }
          rows.push(projected);
          if (rows.length > 1_000) throw new PortabilityError("IMPORT_LIMIT_EXCEEDED", { reason: "ROW_LIMIT" });
        }
        const next = nextSnapshotPage(body, current, domain, page);
        if (!next) return rows;
        current = next;
      }
      throw new PortabilityError("IMPORT_LIMIT_EXCEEDED", { reason: "PAGE_LIMIT" });
    } catch (failure) {
      if (failure instanceof PortabilityError) throw new PortabilityError(failure.code, {
        ...failure.diagnostic, reason: failure.diagnostic?.reason ?? "REQUEST_FAILED", domain, page: Math.min(page, 99),
      });
      throw failure;
    }
  }
  return {
    async rawSnapshot(token, signal) {
      const deadline = AbortSignal.any([AbortSignal.timeout(45_000), ...(signal ? [signal] : [])]);
      const dump: RawSnapshotDump = { kind: "linkedin-raw-preview", complete: false, domains: [] };
      for (const domain of ["EDUCATION", "POSITIONS"] as const) {
        const capture: RawSnapshotDump["domains"][number] = { domain, stopped: "PREVIEW_LIMIT", pages: [] };
        dump.domains.push(capture);
        let current = new URL(endpoint);
        current.search = new URLSearchParams({ q: "criteria", domain, start: "0", count: "10" }).toString();
        let requestKind: "initial" | "next-link" | "probe" = "initial";
        let page = 0;
        try {
          // Deliberately bounded diagnostic capture, never a complete import.
          // At most four 500 kB responses; no schema adapter or projection.
          for (; page < 2; page++) {
            const response = await request(current, { headers: {
              Authorization: `Bearer ${token}`, "LinkedIn-Version": "202312", "X-Restli-Protocol-Version": "2.0.0",
            } }, deadline);
            if (response.status === 401 || response.status === 403) throw new PortabilityError(
              response.status === 401 ? "SESSION_EXPIRED" : "ACCESS_DENIED", { reason: "HTTP_STATUS", httpStatus: response.status });
            const body = await json(response);
            capture.pages.push({ page, status: response.status, requestKind, body: redactRaw(body, [token, config.clientSecret]) });
            if (!response.ok) { capture.stopped = "HTTP_ERROR"; break; }
            if (!isRecord(body) || body.paging === undefined) { capture.stopped = "NO_PAGING"; break; }
            const next = nextSnapshotPage(body, current, domain, page);
            if (!next) { capture.stopped = "NO_PAGING"; break; }
            requestKind = isRecord(body.paging) && Array.isArray(body.paging.links)
              && body.paging.links.some(link => isRecord(link) && link.rel === "next") ? "next-link" : "probe";
            current = next;
          }
        } catch (failure) {
          if (deadline.aborted || failure instanceof PortabilityError && ["SESSION_EXPIRED", "ACCESS_DENIED"].includes(failure.code)) throw failure;
          capture.stopped = "DIAGNOSTIC_ERROR";
          capture.diagnostic = { ...(failure instanceof PortabilityError ? failure.diagnostic : {}),
            reason: failure instanceof PortabilityError ? failure.diagnostic?.reason ?? "REQUEST_FAILED" : "REQUEST_FAILED", domain, page };
        }
      }
      return dump;
    },
    authorizationUrl(state) {
      const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
      url.search = new URLSearchParams({ response_type: "code", client_id: config.clientId, redirect_uri: config.redirectUri, scope: config.scope, state }).toString();
      return url.toString();
    },
    async exchange(code) {
      const response = await request("https://www.linkedin.com/oauth/v2/accessToken", { method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: config.redirectUri, client_id: config.clientId, client_secret: config.clientSecret }),
      });
      if (!response.ok) throw new PortabilityError("TOKEN_EXCHANGE_FAILED");
      const body = await json(response, 64_000);
      if (!isRecord(body) || typeof body.access_token !== "string" || !body.access_token || body.access_token.length > 16_000
        || typeof body.expires_in !== "number" || !Number.isSafeInteger(body.expires_in) || body.expires_in <= 0) throw new PortabilityError("TOKEN_EXCHANGE_FAILED");
      if (body.scope !== undefined && (typeof body.scope !== "string" || !body.scope.split(/\s+/).includes(config.scope))) throw new PortabilityError("ACCESS_DENIED");
      return { accessToken: body.access_token, expiresIn: body.expires_in };
    },
    async snapshot(token, signal) {
      const deadline = AbortSignal.any([AbortSignal.timeout(45_000), ...(signal ? [signal] : [])]);
      const education = await domainData("EDUCATION", token, deadline);
      const positions = await domainData("POSITIONS", token, deadline);
      let result: SnapshotProjection;
      try { result = projectSnapshot({ elements: [
        { snapshotDomain: "PROFILE", snapshotData: [{}] },
        { snapshotDomain: "POSITIONS", snapshotData: positions },
        { snapshotDomain: "EDUCATION", snapshotData: education },
      ] }); } catch { return invalid("PROJECTION_FORMAT"); }
      if (JSON.stringify(result).length > 200_000) throw new PortabilityError("RESPONSE_TOO_LARGE", { reason: "PROJECTION_SIZE" });
      return result;
    },
  };
}
