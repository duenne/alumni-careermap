import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { allowAnalytics } from "../../../lib/analytics/access";
import { analyticsClient } from "../../../lib/analytics/client";
import { readAnalytics } from "../../../lib/analytics/read";
import Dashboard from "./dashboard";
export const metadata: Metadata = { title: "Synthetische MSI-Karrierepfade", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default async function AnalyticsPage() {
  if (!allowAnalytics(await headers())) notFound();
  let data: Awaited<ReturnType<typeof readAnalytics>> | null = null;
  try {
    const { client, url } = analyticsClient();
    data = await readAnalytics(client, url);
  } catch { /* Do not expose driver errors or configuration to the browser. */ }
  if (!data) return <main id="main-content"><h1>Synthetische Karriereanalyse</h1><p role="alert">Analytics-Demo nicht verfügbar. Lokale Datenbank und Einrichtung prüfen.</p></main>;
  return <Dashboard profiles={data.profiles} />;
}
