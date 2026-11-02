"use client";
import { useState } from "react";
import { useLinkedInImport } from "../../dev/mapping/use-linkedin-import";
import { linkedInDraft } from "../../../lib/donation/linkedin-draft";
import type { ManualStation } from "../../../lib/donation/manual";
import ManualEntry from "./manual-entry";
import styles from "../surveys.module.css";
import JourneyProgress from "../journey-progress";

export default function LinkedInEntry({ surveyId, programName, institutionName }: { surveyId: string; programName: string; institutionName: string }) {
  const linkedIn = useLinkedInImport({ endpoint: "/api/participation/linkedin" });
  const [imported, setImported] = useState<ManualStation[] | null>(null);
  const [manual, setManual] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function read() {
    setBusy(true); setError("");
    try {
      const draft = linkedInDraft(await linkedIn.read());
      await linkedIn.disconnect(); setImported(draft);
    } catch { setError("Die Angaben konnten nicht vollständig übernommen werden. Du kannst es erneut versuchen oder ohne LinkedIn fortfahren."); }
    finally { setBusy(false); }
  }
  async function withoutLinkedIn() {
    setBusy(true); setError("");
    linkedIn.cancel();
    try { await linkedIn.disconnect(); }
    catch { /* A failed provider/configuration request must not block manual entry. */ }
    finally { setManual(true); setBusy(false); }
  }
  if (imported || manual) return <>
    {imported && <p className={styles.previewNotice}>Deine LinkedIn-Stationen wurden als bearbeitbarer Entwurf übernommen. Die LinkedIn-Verbindung ist getrennt. Prüfe die Angaben und ordne deinen eigenen Abschluss dem Studiengang {programName} zu. Noch wurde kein Beitrag gespeichert.</p>}
    <ManualEntry surveyId={surveyId} programName={programName} institutionName={institutionName} initialStations={imported ?? undefined} />
  </>;
  return <div className={styles.stack}><JourneyProgress step={1} /><section className={`${styles.card} ${styles.stack} ${styles.linkedInCard}`} aria-labelledby="linkedin-participation-heading">
    <p className="eyebrow">1. Angaben aus LinkedIn übernehmen</p>
    <h2 id="linkedin-participation-heading">Deine Stationen als Ausgangspunkt</h2>
    <p>Verbinde dich mit LinkedIn, um deine Studien- und Berufsstationen einmalig zu übernehmen. Danach kannst du alles prüfen, ändern und ergänzen.</p>
    <p>LinkedIn bittet um eine Freigabe zur Datenübertragbarkeit, die weiter reicht als diese beiden Bereiche. Alumni CareerMap ruft ausschließlich Studien- und Berufsstationen ab. Ein Karriereprofil wird erst gespeichert, wenn du es später ausdrücklich absendest.</p>
    {!linkedIn.connected ? <form action="/api/participation/linkedin/start" method="POST">
      <button type="submit" disabled={busy || !linkedIn.checked || !linkedIn.configured}>Mit LinkedIn verbinden</button>
    </form> : <>
      <p role="status">LinkedIn ist verbunden. Du entscheidest, wann deine Stationen übernommen werden.</p>
      <button type="button" disabled={busy} onClick={() => void read()}>{busy ? "Stationen werden übernommen …" : "Studien- und Berufsstationen übernehmen"}</button>
    </>}
    {linkedIn.checked && !linkedIn.configured && <p>LinkedIn steht gerade nicht zur Verfügung. Du kannst deine Angaben selbst eintragen.</p>}
    {(linkedIn.error || error) && <p role="alert">{linkedIn.error || error}</p>}
    <button type="button" className={styles.secondary} disabled={busy} onClick={() => void withoutLinkedIn()}>Ohne LinkedIn fortfahren</button>
  </section></div>;
}
