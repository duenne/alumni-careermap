import type { NormalizationInput, SourceDate, SourceFact } from "../lib/normalization/contract";
import styles from "./observed-stations.module.css";

function observedText(fact: SourceFact<string>, fallback: string): string {
  return fact.kind === "OBSERVED" ? fact.value : fallback;
}

const months = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

function ObservedDate({ fact, label }: { fact: SourceFact<SourceDate>; label: "Beginn" | "Ende" }) {
  if (fact.kind !== "OBSERVED") {
    return <>{label} {fact.kind === "UNKNOWN" ? "unbekannt" : "nicht angegeben"}</>;
  }
  const value = fact.value;
  if (value.precision === "IMPRECISE") {
    return <>{value.text} <span className={styles.imprecise}>(ungenaue Angabe)</span></>;
  }
  const year = String(value.year).padStart(4, "0");
  return value.precision === "YEAR"
    ? <time dateTime={year}>{value.year}</time>
    : <time dateTime={`${year}-${String(value.month).padStart(2, "0")}`}>{months[value.month - 1]} {value.year}</time>;
}

/** Presentation only: asserted facts and canonical targets are never projected. */
export function ObservedStations({ input, compact = false }: { input: NormalizationInput; compact?: boolean }) {
  if (input.stations.length === 0) return <p className={styles.empty}>Keine Stationsangaben vorhanden.</p>;
  return (
    <ul className={`${styles.stationList} ${compact ? styles.compact : ""}`} aria-label="Angaben in Quellenreihenfolge">
      {input.stations.map((source, index) => {
        const titleId = `observation-${index}-title`;
        const category = observedText(source.category, "");
        const categoryLabel = category === "EDUCATION"
          ? "Ausbildungsangabe"
          : category === "POSITIONS" ? "Positionsangabe" : "Quellangabe";
        return (
          <li key={index}>
            <article className={styles.station} aria-labelledby={titleId}>
              <div className={styles.stationTop}>
                <span className={styles.category}>{categoryLabel}</span>
                <span className={styles.pending}>Zu prüfen</span>
              </div>
              <h3 id={titleId}>{observedText(source.title, "Bezeichnung nicht angegeben")}</h3>
              <p className={styles.organisation}>{observedText(source.providerLabel, "Organisation nicht angegeben")}</p>
              <dl className={styles.dates}>
                <div><dt>Beginn laut Quelle</dt><dd><ObservedDate fact={source.start} label="Beginn" /></dd></div>
                <div><dt>Ende laut Quelle</dt><dd><ObservedDate fact={source.end} label="Ende" /></dd></div>
              </dl>
            </article>
          </li>
        );
      })}
    </ul>
  );
}
