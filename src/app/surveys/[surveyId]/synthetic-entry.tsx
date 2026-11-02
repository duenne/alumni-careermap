"use client";
import { useId, useState, useSyncExternalStore } from "react";
import styles from "../surveys.module.css";
const subscribe = () => () => {};

export default function SyntheticEntry({ programName }: { programName: string }) {
  // Server markup must not offer a button before its handler is hydrated.
  const ready = useSyncExternalStore(subscribe, () => true, () => false);
  const [expanded, setExpanded] = useState(false);
  const exampleId = useId();
  return <div className={styles.stack}>
    <button type="button" disabled={!ready} aria-expanded={expanded} aria-controls={exampleId} onClick={() => setExpanded(value => !value)}>Fiktives Beispiel ansehen</button>
    <article id={exampleId} hidden={!expanded} className={styles.previewExample}>
      <p className="eyebrow">Fiktives Beispiel</p>
      <h3>{programName}</h3>
      <p>Beispiel-Abschlussjahr: 2020</p>
      <p className="demoNote">Das Abschlussjahr ist frei erfunden. Dieses Beispiel stammt aus keinem gespeicherten Karriereprofil.</p>
    </article>
  </div>;
}
