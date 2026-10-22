import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { LinkedInConfig } from "./config";
import type { ProviderToken } from "./provider";

const random = () => randomBytes(32).toString("base64url");
const hash = (text: string) => createHash("sha256").update(text).digest();
export const SESSION_SECONDS = 15 * 60;
export const configKey = (config: LinkedInConfig) => hash(JSON.stringify([config.mode, config.scope, config.clientId, config.redirectUri])).toString("hex");
export type LinkedInSession = {
  id: string; key: string; expires: number; stateHash?: Buffer; stateExpires?: number;
  token?: string; activeRead?: AbortController;
};

/** Process memory only, no profile/raw payload storage. Restart drops all sessions. */
export class EphemeralLinkedInSessions {
  private readonly sessions = new Map<string, LinkedInSession>();
  purge() {
    for (const [id, session] of this.sessions) if (session.expires <= Date.now()) this.remove(id);
  }
  create(key: string) {
    this.purge();
    if (this.sessions.size >= 32) return null;
    const id = random(); const state = random();
    this.sessions.set(id, { id, key, expires: Date.now() + SESSION_SECONDS * 1000, stateHash: hash(state), stateExpires: Date.now() + 5 * 60_000 });
    return { id, state };
  }
  get(id: string | undefined, key: string) {
    this.purge();
    const session = id ? this.sessions.get(id) : undefined;
    return session?.key === key ? session : null;
  }
  consumeState(id: string | undefined, key: string, state: string | null) {
    const session = this.get(id, key);
    if (!session) return null;
    const valid = state && state.length <= 256 && session.stateHash && (session.stateExpires ?? 0) > Date.now()
      && timingSafeEqual(session.stateHash, hash(state));
    if (!valid) { this.remove(session.id); return null; }
    delete session.stateHash; delete session.stateExpires;
    return session;
  }
  complete(session: LinkedInSession, token: ProviderToken) {
    if (this.get(session.id, session.key) !== session) return null;
    this.remove(session.id);
    const id = random();
    this.sessions.set(id, { id, key: session.key, token: token.accessToken,
      expires: Date.now() + Math.min(token.expiresIn, SESSION_SECONDS) * 1000 });
    return id;
  }
  remove(id: string | undefined) {
    if (!id) return;
    const session = this.sessions.get(id);
    session?.activeRead?.abort();
    if (session) { delete session.token; delete session.stateHash; }
    this.sessions.delete(id);
  }
}

const globalSessions = globalThis as typeof globalThis & { careerMapLinkedInSessions?: EphemeralLinkedInSessions };
export function localLinkedInSessions() {
  if (!globalSessions.careerMapLinkedInSessions) {
    const store = new EphemeralLinkedInSessions();
    // A bounded sweep also discards idle credentials without another request.
    setInterval(() => store.purge(), 30_000).unref();
    globalSessions.careerMapLinkedInSessions = store;
  }
  return globalSessions.careerMapLinkedInSessions;
}
