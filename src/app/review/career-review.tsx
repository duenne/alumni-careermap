import Link from "next/link";
import type { NormalizationInput } from "../../lib/normalization/contract";
import { ObservedStations } from "../observed-stations";
import styles from "./review.module.css";

export default function CareerReview({ input }: { input: NormalizationInput }) {
  return (
    <main id="inhalt" tabIndex={-1}>
      <Link href="/" className={styles.back}>Zur Startseite</Link>
      <div className={styles.intro}>
        <p className="eyebrow">Karrierewege kennenlernen</p>
        <h1>Ein Beispiel-Karriereweg</h1>
        <p className="lead">Eine Demo mit fiktiven Daten. Die Angaben zeigen, was eine Quelle über Ausbildung, Tätigkeiten und Zeiträume enthält.</p>
        <p className={styles.notice}>Noch keine Angabe bestätigt</p>
        <dl className={styles.evidenceSummary}>
          <div><dt>Beobachtet</dt><dd>Bezeichnungen, Organisationen und Zeitangaben aus der Quelle.</dd></div>
          <div><dt>Noch offen</dt><dd>Art der Station, Abschluss, Beschäftigungsstatus und Reihenfolge.</dd></div>
        </dl>
      </div>

      <section aria-labelledby="stations-heading">
        <div className={styles.sectionHeading}>
          <h2 id="stations-heading">Angaben aus der Quelle</h2>
          <span>{input.stations.length} {input.stations.length === 1 ? "Angabe" : "Angaben"}</span>
        </div>
        <p className={styles.sourceNote}>Die Quellenreihenfolge ist keine bestätigte zeitliche Reihenfolge.</p>
        <ObservedStations input={input} />
      </section>
      <p className={styles.closing}>Quellangaben sind noch keine bestätigten Fakten. Ein fehlendes Enddatum lässt den aktuellen Status offen; ein genanntes Enddatum bestätigt keinen Abschluss.</p>
      <section className={styles.nextStep} aria-labelledby="next-heading">
        <h2 id="next-heading">Als Nächstes: Angaben selbst prüfen</h2>
        <p>Künftig können Sie jede Station prüfen, ihre Art und ihren Status ausdrücklich festlegen und die Reihenfolge bestätigen. In dieser Demo bleiben alle Angaben unverändert.</p>
      </section>
    </main>
  );
}
