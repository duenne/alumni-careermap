import type { Metadata } from "next";
import Link from "next/link";
import fictionalSnapshot from "../../test-fixtures/linkedin-snapshots/fictional-member.json";
import { adaptLinkedInSnapshot } from "../../lib/normalization/adapt-linkedin-snapshot";
import type { NormalizationInput } from "../../lib/normalization/contract";
import CareerReview from "./career-review";

export const metadata: Metadata = { title: "Beispiel-Karriereweg · Alumni CareerMap" };

export default function ReviewPage() {
  let input: NormalizationInput | undefined;
  try {
    // Only the adapter's career observations reach the server-rendered view.
    input = adaptLinkedInSnapshot(fictionalSnapshot);
  } catch {
    // Keep source data and exception messages out of the fallback.
  }
  if (!input) {
    return (
      <main id="inhalt" tabIndex={-1}>
        <h1>Beispiel derzeit nicht verfügbar</h1>
        <p>Die Beispielangaben konnten nicht geladen werden. Bitte versuchen Sie es später erneut.</p>
        <Link href="/">Zur Startseite</Link>
      </main>
    );
  }
  return <CareerReview input={input} />;
}
