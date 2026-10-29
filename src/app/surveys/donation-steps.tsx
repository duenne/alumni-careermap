import styles from "./surveys.module.css";

export default function DonationSteps({ step }: { step: number }) {
  const steps = ["Daten übernehmen", "Karriereweg prüfen", "Datenspende bestätigen", "Abgeschlossen"];
  return <nav aria-label="Schritte der Datenspende"><ol className={styles.journeySteps}>
    {steps.map((label, index) => <li key={label} aria-current={index === step ? "step" : undefined} data-complete={index < step || undefined}>
      <span className={styles.stepNumber}>{index + 1}</span>{label}
    </li>)}
  </ol></nav>;
}
