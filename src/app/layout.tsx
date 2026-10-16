import type { Metadata } from "next";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Alumni CareerMap",
  description: "Karrierewege nach dem Studium verstehen. Eine Vorschau mit fiktiven Ausbildungs- und Berufsangaben.",
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
          <span className="demoLabel">Fiktives Beispiel</span>
        </header>
        {children}
        <footer className="siteFooter">Alumni CareerMap · Karrierewege verstehen</footer>
      </body>
    </html>
  );
}
