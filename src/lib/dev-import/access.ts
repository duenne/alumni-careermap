type Environment = { NODE_ENV?: string; CAREERMAP_DEV_IMPORT?: string };

/** Server-side opt-in. Forwarded headers never establish local authorization. */
export function allowDevImport(headers: Headers, env: Environment = process.env): boolean {
  if (env.NODE_ENV !== "development" || env.CAREERMAP_DEV_IMPORT !== "1") return false;
  const host = headers.get("host") ?? "";
  if (!/^(127\.0\.0\.1|localhost)(:[0-9]+)?$/.test(host)) return false;
  // Next itself adds these headers. Accept its local values, never a proxy host.
  const forwardedHost = headers.get("x-forwarded-host");
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedHost && forwardedHost !== host || headers.has("forwarded")) return false;
  if (forwardedFor && !["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(forwardedFor)) return false;
  const origin = headers.get("origin");
  if (origin && origin !== `http://${host}` && origin !== `https://${host}`) return false;
  const site = headers.get("sec-fetch-site");
  return site !== "cross-site" && site !== "same-site";
}

/** A redirect chain keeps its cross-site classification even after the callback.
 * Only an exact top-level document GET may enter; APIs keep the strict gate.
 */
function allowLocalDocumentNavigation(request: Request, pathname: string): boolean {
  if (request.method !== "GET" || new URL(request.url).pathname !== pathname) return false;
  if (!["cross-site", "same-site"].includes(request.headers.get("sec-fetch-site") ?? "")
    || request.headers.get("sec-fetch-mode") !== "navigate" || request.headers.get("sec-fetch-dest") !== "document") return false;
  const headers = new Headers(request.headers);
  headers.delete("sec-fetch-site");
  return allowDevImport(headers);
}

/** Read-only shell; query flags confer no connection or API authorization. */
export function allowDevImportPage(request: Request): boolean {
  return allowLocalDocumentNavigation(request, "/dev/import");
}

/** Cookie-bound state is still verified by the callback handler. */
export function allowLinkedInCallback(request: Request): boolean {
  if (request.method !== "GET" || new URL(request.url).pathname !== "/auth/linkedin/portability/callback") return false;
  return allowDevImport(request.headers) || allowLocalDocumentNavigation(request, "/auth/linkedin/portability/callback");
}
