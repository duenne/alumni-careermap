import "server-only";

export const CALLBACK_PATH = "/auth/linkedin/portability/callback";
export type LinkedInConfig = {
  mode: "member" | "third_party";
  scope: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

/** No guessed entitlement, default scope, public redirect or client-side secret. */
export function readLinkedInConfig(env: Record<string, string | undefined> = process.env): LinkedInConfig | null {
  if (env.NODE_ENV !== "development" || env.CAREERMAP_DEV_IMPORT !== "1") return null;
  const mode = env.LINKEDIN_PORTABILITY_MODE;
  const scope = env.LINKEDIN_PORTABILITY_SCOPE ?? "";
  if (mode !== "member" && mode !== "third_party") return null;
  const scopes = mode === "member" ? ["r_dma_portability_self_serve", "r_dma_portability_member"] : ["r_dma_portability_3rd_party"];
  if (!scopes.includes(scope)) return null;
  const clientId = env.LINKEDIN_CLIENT_ID ?? "";
  const clientSecret = env.LINKEDIN_CLIENT_SECRET ?? "";
  const redirectUri = env.LINKEDIN_REDIRECT_URI ?? "";
  if (!clientId || !clientSecret || !redirectUri) return null;
  try {
    const url = new URL(redirectUri);
    if (!["http:", "https:"].includes(url.protocol) || !["localhost", "127.0.0.1"].includes(url.hostname)
      || url.username || url.password || url.pathname !== CALLBACK_PATH || url.search || url.hash) return null;
  } catch { return null; }
  return { mode, scope, clientId, clientSecret, redirectUri };
}
