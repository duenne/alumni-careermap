import styles from "./review.module.css";

// Presentation example only: not a stored Survey, catalog identity or authority.
const demo = {
  institution: "Hochschule München",
  program: "Management Sozialer Innovationen",
  survey: "Alumni-Karrierewege MSI",
} as const;

export default function SurveyContext() {
  return (
    <section className={styles.survey} aria-labelledby="survey-context-heading">
      <p className="eyebrow">Fiktive Befragung · Demo</p>
      <h2 id="survey-context-heading">{demo.survey}</h2>
      <dl className={styles.contextDetails}>
        <div><dt>Hochschule</dt><dd>{demo.institution}</dd></div>
        <div><dt>Studiengang</dt><dd>{demo.program}</dd></div>
      </dl>
      <p>Der Studiengang ist durch die fiktive Befragung festgelegt; Sie müssen ihn nicht auswählen.</p>
      <section className={styles.reference} aria-labelledby="reference-heading">
        <h3 id="reference-heading">Referenzabschluss für die Befragung</h3>
        <p><strong>Noch nicht ausgewählt.</strong> Später bestätigen Sie ausdrücklich, welcher Ihrer abgeschlossenen Studienabschlüsse zu diesem Studiengang gehört.</p>
        <p>Fehlende Abschlüsse können Sie später ergänzen oder berichtigen. Die Auswahl bleibt von Einordnung und Reihenfolge getrennt.</p>
      </section>
    </section>
  );
}
