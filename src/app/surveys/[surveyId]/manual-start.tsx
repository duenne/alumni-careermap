"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "../surveys.module.css";
export default function ParticipationStart({ surveyId, linkedInAvailable = false }: { surveyId: string; linkedInAvailable?: boolean }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const router = useRouter();
  async function begin(source: "manual" | "linkedin") {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/surveys/${surveyId}/participation`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ begin: source }) });
      const result = await response.json();
      if (!response.ok) { setSubmitted(result.code === "ALREADY_SUBMITTED"); setError(result.code === "ALREADY_SUBMITTED" ? "Dein Beitrag wurde bereits abgegeben. Öffne die Teilnahmeseite, um die Bestätigung zu sehen." : "Die Teilnahme konnte nicht gestartet werden. Bitte prüfe, ob die Befragung noch geöffnet ist."); setBusy(false); return; }
      router.push(`/surveys/${surveyId}/participation`);
    } catch { setError("Die Teilnahme konnte nicht gestartet werden. Bitte versuche es erneut."); setBusy(false); }
  }
  return <section className={`${styles.card} ${styles.stack}`} aria-labelledby="manual-start-heading">
    <h2 id="manual-start-heading">Wie möchtest du deinen Werdegang erfassen?</h2>
    <p>Wähle deinen Weg. Anschließend kannst du alle Stationen bearbeiten, deinen eigenen Abschluss auswählen und über die Abgabe entscheiden.</p>
    <div className={styles.manualFields}>
      <section className={`${styles.card} ${styles.stack} ${styles.previewStudy}`} aria-labelledby="linkedin-source-heading">
        <h3 id="linkedin-source-heading">Angaben aus LinkedIn übernehmen</h3>
        <p>Vorhandene Studien- und Berufsstationen einmalig übernehmen und anschließend selbst prüfen.</p>
        <button type="button" disabled={busy || !linkedInAvailable} onClick={() => void begin("linkedin")}>Mit LinkedIn starten</button>
        {!linkedInAvailable && <p className="demoNote">LinkedIn ist für diese Befragung derzeit nicht eingerichtet. Du kannst deinen Werdegang selbst eintragen.</p>}
      </section>
      <section className={`${styles.card} ${styles.stack} ${styles.previewStudy}`} aria-labelledby="manual-source-heading">
        <h3 id="manual-source-heading">Angaben selbst eintragen</h3>
        <p>Deinen Studien- und Berufsweg Schritt für Schritt erfassen. Ein LinkedIn-Konto ist dafür nicht nötig.</p>
        <button type="button" disabled={busy} onClick={() => void begin("manual")}>Selbst eintragen</button>
      </section>
    </div>
    {busy && <p role="status">Deine Teilnahme wird geöffnet …</p>}
    {error && <p role="alert">{error}</p>}
    {submitted && <Link href={`/surveys/${surveyId}/participation`}>Teilnahmeseite öffnen</Link>}
  </section>;
}
