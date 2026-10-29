type Environment = Record<string, string | undefined>;
const callbackPath = "/auth/linkedin/portability/callback";

/** Only an explicitly configured fixed loopback callback defines a UI origin. */
export function callbackOrigin(value: string | undefined): string | undefined {
  try {
    const url = new URL(value ?? "");
    if (!["http:", "https:"].includes(url.protocol) || !["localhost", "127.0.0.1"].includes(url.hostname)
      || url.username || url.password || url.pathname !== callbackPath || url.search || url.hash) return;
    return url.origin;
  } catch { return; }
}

export function integratedJourneyEnabled(env: Environment = process.env): boolean {
  return env.NODE_ENV === "development" && env.CAREERMAP_DEV_SURVEYS === "1" && env.CAREERMAP_DEV_DONATION === "1";
}

export function journeyOrigin(env: Environment = process.env): string | undefined {
  return integratedJourneyEnabled(env) ? callbackOrigin(env.LINKEDIN_REDIRECT_URI) : undefined;
}

/** A normal startup uses the registered local address. Explicit test/CLI ports
 * remain possible; Next's development server here serves HTTP, not TLS.
 */
export function resolveIntegratedAddress(args: string[], env: Environment) {
  const origin = callbackOrigin(env.LINKEDIN_REDIRECT_URI);
  const url = origin?.startsWith("http:") ? new URL(origin) : undefined;
  function option(name: string, fallback: string) {
    const index = args.indexOf(name);
    if (index < 0) return fallback;
    const value = args[index + 1];
    if (!value || value.startsWith("--")) throw new Error("Local integrated host and port required");
    return value;
  }
  const hostname = option("--host", url?.hostname ?? "localhost");
  const port = option("--port", url ? url.port || "80" : "3100");
  if (!["127.0.0.1", "localhost"].includes(hostname) || !/^[0-9]+$/.test(port) || Number(port) < 1024 || Number(port) > 65535) throw new Error("Local integrated host and port required");
  return { hostname, port };
}
