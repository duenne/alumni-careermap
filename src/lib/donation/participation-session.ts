import { DonationSessions } from "./sessions";
export const participationCookie = "careermap_manual_participation";
export const participationLinkedInCookie = "careermap_linkedin_participation";
export const participationOAuthStatePrefix = "participation_v1_";
const state = globalThis as typeof globalThis & { manualParticipationSessions?: DonationSessions<"manual" | "linkedin"> };
export const participationSessions = state.manualParticipationSessions ??= new DonationSessions<"manual" | "linkedin">();
