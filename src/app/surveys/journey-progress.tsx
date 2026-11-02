import styles from "./surveys.module.css";

const participationSteps = ["Weg auswählen", "Werdegang erfassen", "Angaben prüfen", "Abgeschlossen"];
export default function JourneyProgress({ step, steps = participationSteps, label = "Deine Teilnahme" }: { step: number; steps?: readonly string[]; label?: string }) {
  return <nav aria-label={label}><ol className={styles.journeySteps}>
    {steps.map((text, index) => <li key={text} aria-current={index === step ? "step" : undefined} data-complete={index < step || undefined}>
      <span className={styles.stepNumber} aria-hidden="true">{index < step ? "✓" : index + 1}</span>
      <span>{text}{index < step && <span className={styles.srOnly}> · Abgeschlossen</span>}</span>
    </li>)}
  </ol></nav>;
}
