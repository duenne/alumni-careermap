import type { LocalDemoConfiguration } from "./config";

/** Headers are defense in depth. The supported starter must additionally bind
 * the actual socket to 127.0.0.1; headers alone cannot prove local transport.
 */
export function allowLocalDemoRequest(headers: Headers, configuration: LocalDemoConfiguration): boolean {
  const host = new URL(configuration.origin).host;
  if (headers.get("host") !== host || headers.has("forwarded")) return false;
  const forwardedHost = headers.get("x-forwarded-host"), forwardedFor = headers.get("x-forwarded-for");
  if (forwardedHost && forwardedHost !== host || forwardedFor && !["127.0.0.1", "::ffff:127.0.0.1"].includes(forwardedFor)) return false;
  if (headers.has("origin") && headers.get("origin") !== configuration.origin) return false;
  return !["cross-site", "same-site"].includes(headers.get("sec-fetch-site") ?? "");
}
