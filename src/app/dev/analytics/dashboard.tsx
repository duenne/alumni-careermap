"use client";
import { useState } from "react";
import type { AnalyticsProfile } from "../../../lib/analytics/records";
import { unknownDate } from "../../../lib/analytics/records";
import styles from "./analytics.module.css";
import { aggregateCareers } from "../../../lib/analytics/aggregate";
import Sankey from "./sankey";
const labels: Record<string, string> = { BACHELOR: "Bachelor", MASTER: "Master", PHD: "Promotion", DIPLOMA: "Diplom", CERTIFICATE: "Akademisches Zertifikat", OTHER: "Weitere Station", EMPLOYMENT: "Beschäftigung", INTERNSHIP: "Praktikum", EDUCATION: "Weiterbildung / Austausch", VOCATIONAL_TRAINING: "Berufsausbildung", VOLUNTEERING: "Ehrenamt", SELF_EMPLOYMENT: "Selbstständigkeit", COMPLETED: "Abgeschlossen", IN_PROGRESS: "Im Studium", ONGOING: "Laufend", ENDED: "Beendet", UNKNOWN: "Status unbekannt" };
export default function Dashboard({ profiles }: { profiles: AnalyticsProfile[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const profile = profiles.find(p => p.id === selected);
  const stations = profiles.flatMap(p => p.stations);
  const flow = aggregateCareers(profiles);
  const counts = [["Profile", profiles.length], ["Degrees", stations.filter(s => s.kind === "DEGREE").length], ["CareerSteps", stations.filter(s => s.kind === "CAREER_STEP").length], ["TimelineItems", stations.length], ["Synthetische Demoanker", profiles.filter(p => p.stations.some(s => s.demoAnchor)).length], ["Gesamthistorien mit Unklarheiten", flow.partial + flow.excluded.length]];
  return <main id="main-content" className={styles.main}>
    <p className="eyebrow">ENTWICKLUNG · AUSSCHLIESSLICH SYNTHETISCH</p>
    <h1>MSI · Karrierepfade erkunden</h1>
    <p>Gespeicherte Testprofile aus PostgreSQL. Jahresgenaue Ansicht; Monatsangaben wurden auf Jahre reduziert. Demoanker sind synthetische Testdeklarationen, keine bestätigten Befragungsteilnahmen.</p>
    <dl className={styles.stats}>{counts.map(([label, count]) => <div key={label}><dt>{label}</dt><dd>{count}</dd></div>)}</dl>
    <Sankey flow={flow} profiles={profiles} selectedId={selected} onSelect={setSelected} />
    <section aria-label="Importierte Alumni"><h2>Alumni-Liste</h2>
      {!profiles.length ? <p>Noch keine Profile importiert.</p> : <div className={styles.tableWrap}><table><thead><tr><th>Profil</th><th>Degrees</th><th>CareerSteps</th><th>Zeitlich ungeklärt</th><th>Demo-Referenz</th><th>Karriereweg</th></tr></thead><tbody>
        {profiles.map((p, index) => <tr key={p.id} aria-selected={selected === p.id}><th scope="row">Profil {index + 1}</th><td>{p.stations.filter(s => s.kind === "DEGREE").length}</td><td>{p.stations.filter(s => s.kind === "CAREER_STEP").length}</td><td>{flow.paths.find(path => path.alumniId === p.id)?.temporalUnclearStations ?? p.stations.filter(unknownDate).length}</td><td>{p.stations.some(s => s.demoAnchor) ? "Synthetisch deklariert" : "Nicht deklariert"}</td><td><button type="button" onClick={() => setSelected(p.id)}>Karriereweg anzeigen</button></td></tr>)}
      </tbody></table></div>}
      <p>Zeitlich ungeklärt zählt Stationen mit fehlenden Zeitangaben oder ungeklärter Ankerrelation jeweils einmal. Bei fehlendem Demoanker wird nur die Vollständigkeit der Zeitangaben gezählt.</p>
    </section>
    {profile && <section aria-label="Vollständiger Karriereweg" className={styles.detail}><h2>Karriereweg · Profil {profiles.indexOf(profile) + 1}</h2>
      <p>Gespeicherte Timeline-Reihenfolge. Überlappungen bleiben bestehen; die Jahresangaben begründen keine exakte zeitliche Abfolge.</p>
      <ol className={styles.timeline}>{profile.stations.map(s => <li key={s.id} className={s.demoAnchor ? styles.anchor : ""}>
        <p className={styles.period}>{["ONGOING", "IN_PROGRESS"].includes(s.status) ? `Seit ${s.startYear ?? "Beginn unbekannt"}` : `${s.startYear ?? "Beginn unbekannt"} – ${s.endYear ?? "Ende unbekannt"}`} · Position {s.position}</p>
        <span>{labels[s.type] ?? s.type} · {labels[s.status] ?? s.status}</span>{s.demoAnchor && <strong> · Synthetischer Demoanker</strong>}
        <h3>{s.title ?? "Bezeichnung unbekannt"}</h3><p>{s.provider ?? "Organisation / Einrichtung unbekannt"}{s.location ? ` · ${s.location}` : ""}</p>
        <p>{[s.field, s.sector, s.job].filter(Boolean).join(" · ") || "Kategorisierung unbekannt"}</p>
        {s.graduationYear !== null && <p>Abschlussjahr: {s.graduationYear}</p>}
      </li>)}</ol>
    </section>}
  </main>;
}
