import JourneyProgress from "./journey-progress";

export default function DonationSteps({ step }: { step: number }) {
  const steps = ["Daten übernehmen", "Karriereweg prüfen", "Datenspende bestätigen", "Abgeschlossen"];
  return <JourneyProgress step={step} steps={steps} label="Schritte der Datenspende" />;
}
