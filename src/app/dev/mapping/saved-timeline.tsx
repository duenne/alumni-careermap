import type { SavedCareer } from "../../../lib/career-import/saved-career";
import styles from "./saved-timeline.module.css";

const labels: Record<string, string> = { BACHELOR: "Bachelor", MASTER: "Master", PHD: "Promotion", DIPLOMA: "Diplom", CERTIFICATE: "Akademisches Zertifikat", OTHER: "Weitere Station", EMPLOYMENT: "Beschäftigung", INTERNSHIP: "Praktikum", EDUCATION: "Weiterbildung / Austausch", VOCATIONAL_TRAINING: "Berufsausbildung", VOLUNTEERING: "Ehrenamt", SELF_EMPLOYMENT: "Selbstständigkeit", UNEMPLOYED: "Arbeitslosigkeit", COMPLETED: "Abgeschlossen", IN_PROGRESS: "Im Studium", ENDED_WITHOUT_DEGREE: "Ohne Abschluss beendet", ONGOING: "Laufend", ENDED: "Beendet", UNKNOWN: "Status unbekannt" };
function period(station: SavedCareer["stations"][number]) {
  if (station.status === "ONGOING" || station.status === "IN_PROGRESS") return station.startYear ? `Seit ${station.startYear}` : "Laufend · Beginn unbekannt";
  return `${station.startYear ?? "Beginn unbekannt"} – ${station.endYear ?? "Ende unbekannt"}`;
}
export default function SavedTimeline({ profile }: { profile: SavedCareer }) {
  return <section className={styles.timeline} aria-labelledby="saved-timeline-heading">
    <p className={styles.eyebrow}>Aus PostgreSQL zurückgelesen</p>
    <h2 id="saved-timeline-heading">Gespeicherter Karriereweg</h2>
    <p>{profile.surveyName} · Referenzstudiengang: <strong>{profile.programName}</strong></p>
    <ol className={styles.list}>
      {profile.stations.map(station => <li key={station.id} className={station.reference ? styles.reference : ""}>
        <div className={styles.period}>{period(station)}<span>Position {station.position}</span></div>
        <article className={styles.card} aria-label={station.title ?? labels[station.type]}>
          <div className={styles.tags}><span>{labels[station.type] ?? station.type}</span>{station.reference && <strong>Referenzabschluss</strong>}</div>
          <h3>{station.title ?? labels[station.type] ?? "Station ohne Titel"}</h3>
          <p>{station.provider ?? "Keine Katalogzuordnung"}</p>
          {station.program && <p>{station.program}</p>}
          {station.location && <p>{station.location}</p>}
          <p className={styles.status}>{labels[station.status] ?? station.status}</p>
        </article>
      </li>)}
    </ol>
    <p className={styles.note}>Die Reihenfolge entspricht den gespeicherten Timeline-Positionen. Überlappungen bleiben erhalten; unbekannte Zeitangaben werden ausgewiesen.</p>
  </section>;
}
