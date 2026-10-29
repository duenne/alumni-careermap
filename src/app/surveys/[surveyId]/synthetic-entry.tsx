"use client";
import { useState, useSyncExternalStore } from "react";
import styles from "../surveys.module.css";
const subscribe = () => () => {};

export default function SyntheticEntry({ programName }: { programName: string }) {
  // Server markup must not offer a button before its handler is hydrated.
  const ready = useSyncExternalStore(subscribe, () => true, () => false);
  const [started, setStarted] = useState(false);
  const [selected, setSelected] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  return <section className={`${styles.card} ${styles.stack}`} aria-labelledby="synthetic-entry">
    <h2 id="synthetic-entry">Alumni-Einstieg ausprobieren</h2>
    <p>Ein frei erfundener Bachelorabschluss zeigt die spätere Auswahl. Er stammt aus keinem gespeicherten Profil.</p>
    {!started ? <button disabled={!ready} onClick={() => setStarted(true)}>Synthetisches Beispiel prüfen</button> : <>
      <fieldset className={styles.stack}>
        <legend>Beispiel für einen konkreten Referenzabschluss</legend>
        <label className={styles.choice}><input type="radio" name="reference-degree" checked={selected} onChange={() => { setSelected(true); setReviewed(false); }} />Bachelor · {programName} · abgeschlossen 2020 (synthetisch)</label>
        <label className={styles.choice}><input type="checkbox" checked={confirmed} onChange={event => { setConfirmed(event.target.checked); setReviewed(false); }} />Diesen synthetischen Abschluss ausdrücklich als Beispielreferenz bestätigen</label>
      </fieldset>
      <button disabled={!selected || !confirmed} onClick={() => setReviewed(true)}>Beispielauswahl prüfen</button>
      {reviewed && <p role="status">Die ausdrückliche Beispielauswahl wurde geprüft. Es wurde keine Datenspende gespeichert.</p>}
    </>}
  </section>;
}
