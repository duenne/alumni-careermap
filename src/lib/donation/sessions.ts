import { randomBytes } from "node:crypto";
export type DonationSession = { id: string; surveyId: string; source: "synthetic" | "linkedin"; expires: number; digest?: string; active?: boolean; pending?: Promise<unknown> };
/** Technical capabilities only: no source payloads, credentials or canonical profiles. */
export class DonationSessions {
  private sessions = new Map<string, DonationSession>();
  create(surveyId: string, source: DonationSession["source"]) {
    this.purge(); if (this.sessions.size >= 200) throw new Error("BUSY");
    const session: DonationSession = { id: randomBytes(32).toString("base64url"), surveyId, source, expires: Date.now() + 30 * 60_000 };
    this.sessions.set(session.id, session); return session;
  }
  get(id: string | undefined, surveyId?: string) {
    this.purge(); const s = id ? this.sessions.get(id) : undefined;
    return s && s.expires > Date.now() && (!surveyId || s.surveyId === surveyId) ? s : null;
  }
  private purge() { for (const [id,s] of this.sessions) if (s.expires <= Date.now() && !s.active) this.sessions.delete(id); }
  async save<T>(s: DonationSession, digest: string, operation: () => Promise<T>): Promise<T> {
    if (s.digest && s.digest !== digest) throw new Error("SUBMISSION_CHANGED");
    if (!s.pending) {
      s.digest = digest; s.active=true;
      s.pending = operation().catch(error => { delete s.pending; delete s.digest; throw error; }).finally(()=>{s.active=false;});
    }
    return s.pending as Promise<T>;
  }
}
const state = globalThis as typeof globalThis & { donationSessions?: DonationSessions };
export const donationSessions = state.donationSessions ??= new DonationSessions();
export const donationCookie = "careermap_donation";
