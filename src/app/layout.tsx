import type { Metadata } from "next";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import "./globals.css";
import EnvironmentLabel from "./environment-label";
import { integratedJourneyEnabled } from "../lib/donation/entry-config";

export const metadata: Metadata = {
  title: "Alumni CareerMap",
  description: integratedJourneyEnabled() ? "Studiengangsbezogene Alumni-Befragungen: Karrierewege prüfen, Beiträge bestätigen und geschützt auswerten." : "Karrierewege nach dem Studium verstehen. Eine Vorschau mit fiktiven Ausbildungs- und Berufsangaben.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <body>
        <a href="#inhalt" className="skipLink">Zum Inhalt</a>
        <header className="siteHeader">
          <Link href="/" className="brand">
            <Image src="/careermap-mark.svg" alt="" width={32} height={32} />
            Alumni CareerMap
          </Link>
          <EnvironmentLabel integrated={integratedJourneyEnabled()} />
        </header>
        {children}
        <footer className="siteFooter">Alumni CareerMap · Karrierewege verstehen</footer>
      </body>
    </html>
  );
}
