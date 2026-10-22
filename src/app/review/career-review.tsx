import Link from "next/link";
import { isDeepStrictEqual } from "node:util";
import fictionalSnapshot from "../../test-fixtures/linkedin-snapshots/fictional-member.json";
import { adaptLinkedInSnapshot } from "../../lib/normalization/adapt-linkedin-snapshot";
import type { NormalizationInput } from "../../lib/normalization/contract";
import CareerTimeline from "./career-timeline";
import SurveyContext from "./survey-context";
import styles from "./review.module.css";

// Explicit demo-only nomination within this exact fixed snapshot, not a title,
// source category or array-position inference. Never a provenance/auth check.
const fixedDemoInput = adaptLinkedInSnapshot(fictionalSnapshot);
const demoReviewKey = "snapshot:2:0";

export default function CareerReview({ input }: { input: NormalizationInput }) {
  const reviewSourceKey = isDeepStrictEqual(input, fixedDemoInput) ? demoReviewKey : undefined;
  return (
    <main id="inhalt" tabIndex={-1}>
      <Link href="/" className={styles.back}>Zur Startseite</Link>
      <div className={styles.intro}>
        <p className="eyebrow">Karrierewege kennenlernen</p>
        <h1>Ein Beispiel-Karriereweg</h1>
        <p className="lead">Eine Demo mit fiktiven Daten aus Ausbildung und Beruf.</p>
        <p className={styles.notice}>Quellangaben bleiben unverändert</p>
        <dl className={styles.evidenceSummary}>
          <div><dt>Beobachtet</dt><dd>Bezeichnungen, Organisationen und Zeitangaben.</dd></div>
          <div><dt>Noch offen</dt><dd>Art, Abschluss, Beschäftigungsstatus und Reihenfolge erfordern Ihre ausdrückliche Prüfung.</dd></div>
        </dl>
      </div>

      <SurveyContext />
      <CareerTimeline input={input} reviewSourceKey={reviewSourceKey} />
      <p className={styles.closing}>Quellangaben sind noch keine bestätigten Fakten. Ein fehlendes Enddatum lässt den aktuellen Status offen; ein genanntes Enddatum bestätigt keinen Abschluss.</p>
    </main>
  );
}
