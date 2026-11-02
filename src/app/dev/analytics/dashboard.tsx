"use client";
import { useState } from "react";
import type { AnalyticsProfile } from "../../../lib/analytics/records";
import { unknownDate } from "../../../lib/analytics/records";
import styles from "./analytics.module.css";
import { aggregateCareers } from "../../../lib/analytics/aggregate";
import Sankey from "./sankey";
const labels: Record<string, string> = { BACHELOR: "Bachelor", MASTER: "Master", PHD: "Promotion", DIPLOMA: "Diplom", CERTIFICATE: "Akademisches Zertifikat", OTHER: "Weitere Station", EMPLOYMENT: "Beschäftigung", INTERNSHIP: "Praktikum", EDUCATION: "Weiterbildung / Austausch", VOCATIONAL_TRAINING: "Berufsausbildung", VOLUNTEERING: "Ehrenamt", SELF_EMPLOYMENT: "Selbstständigkeit", COMPLETED: "Abgeschlossen", IN_PROGRESS: "Im Studium", ONGOING: "Laufend", ENDED: "Beendet", UNKNOWN: "Status unbekannt" };
export default function Dashboard({ profiles, survey, diagnostics = [], syntheticDemo = false }: { profiles: AnalyticsProfile[]; survey?: {name:string;program:string;responses:number}; diagnostics?: {reason:string}[]; syntheticDemo?: boolean }) {
  const [selected, setSelected] = useState<string | null>(null);
  const profile = profiles.find(p => p.id === selected);
  const stations = profiles.flatMap(p => p.stations);
  const flow = aggregateCareers(profiles);
  const counts = [["Profile", profiles.length], ["Degrees", stations.filter(s => s.kind === "DEGREE").length], ["CareerSteps", stations.filter(s => s.kind === "CAREER_STEP").length], ["TimelineItems", stations.length], [survey ? "Bestätigte Referenzen" : "Synthetische Demoanker", profiles.filter(p => p.referenceDegreeId || p.stations.some(s => s.demoAnchor)).length], ["Gesamthistorien mit Unklarheiten", flow.partial + flow.excluded.length]];
  const statistics = <dl className={styles.stats}>{counts.map(([label, count]) => <div key={label}><dt>{label}</dt><dd>{count}</dd></div>)}</dl>;
  const surveyDetails = survey && <>
    <p>{survey.name} · {survey.program}</p>
    <p>{syntheticDemo ? "Gespeicherte synthetische Testprofile aus PostgreSQL. Die technischen Bestätigungen sind keine realen Einwilligungen oder veröffentlichten Befragungsergebnisse." : "Bestätigte Befragungsteilnahmen aus PostgreSQL."} Fehlende Master- oder Tätigkeitsangaben bleiben unbekannt. Es gibt keine öffentliche Ergebnisfreigabe.</p>
    {statistics}
    <p>{survey.responses} gespeicherte Antworten · {diagnostics.length} vor der Aggregation ausgeschlossen.</p>
    <ul>{diagnostics.map((d,i)=><li key={i}>{d.reason}</li>)}</ul>
  </>;
  const profileTable = <section aria-label="Importierte Alumni"><h2>Alumni-Liste</h2>
    {!profiles.length ? <p>Noch keine Profile importiert.</p> : <div className={styles.tableWrap}><table><thead><tr><th>Profil</th><th>Degrees</th><th>CareerSteps</th><th>Zeitlich ungeklärt</th><th>{survey?"Bestätigte Referenz":"Demo-Referenz"}</th><th>Karriereweg</th></tr></thead><tbody>
      {profiles.map((p, index) => <tr key={p.id} aria-selected={selected === p.id}><th scope="row">Profil {index + 1}</th><td>{p.stations.filter(s => s.kind === "DEGREE").length}</td><td>{p.stations.filter(s => s.kind === "CAREER_STEP").length}</td><td>{flow.paths.find(path => path.alumniId === p.id)?.temporalUnclearStations ?? p.stations.filter(unknownDate).length}</td><td>{p.referenceDegreeId ? "Ausdrücklich bestätigt" : p.stations.some(s => s.demoAnchor) ? "Synthetisch deklariert" : "Nicht deklariert"}</td><td><button type="button" onClick={() => setSelected(p.id)}>Karriereweg anzeigen</button></td></tr>)}
    </tbody></table></div>}
    <p>Zeitlich ungeklärt zählt Stationen mit fehlenden Zeitangaben oder ungeklärter Ankerrelation jeweils einmal. Bei fehlendem Demoanker wird nur die Vollständigkeit der Zeitangaben gezählt.</p>
  </section>;
  return <main id="main-content" className={`${styles.main} ${survey ? styles.survey : ""}`}>
    {survey ? <header className={styles.intro}>
      <p className="eyebrow">ALUMNI CAREERMAP · AUSWERTUNG</p>
      <h1>Karrierewege nach Management Sozialer Innovationen</h1>
      <p>Erkunde die Vorerfahrungen, Studienentscheidungen und beruflichen Stationen in den erfassten Karrierewegen.</p>
      {syntheticDemo && <p className={styles.demoNotice}>Synthetische Demodaten – keine echten Alumni-Befragungen</p>}
      <dl className={styles.stats} aria-label="Überblick">
        <div><dt>{syntheticDemo ? "Antworten in der Demo" : "Gespeicherte Antworten"}</dt><dd>{survey.responses}</dd></div>
        <div><dt>Auswertbare Karriereprofile</dt><dd>{profiles.length}</dd></div>
      </dl>
    </header> : <>
    <p className="eyebrow">ENTWICKLUNG · AUSSCHLIESSLICH SYNTHETISCH</p>
    <h1>MSI · Karrierepfade erkunden</h1>
    <p>Gespeicherte Testprofile aus PostgreSQL. Jahresgenaue Ansicht; Monatsangaben wurden auf Jahre reduziert. Demoanker sind synthetische Testdeklarationen, keine bestätigten Befragungsteilnahmen.</p>
    {statistics}
    </>}
    <Sankey flow={flow} profiles={profiles} selectedId={selected} onSelect={setSelected} surveyDetails={surveyDetails || undefined} />
    {survey ? <details className={styles.disclosure}><summary>Alle Karriereprofile anzeigen</summary>{profileTable}</details> : profileTable}
    {profile && <section aria-label="Vollständiger Karriereweg" className={styles.detail}><h2>Karriereweg · Profil {profiles.indexOf(profile) + 1}</h2>
      <p>Gespeicherte Timeline-Reihenfolge. Überlappungen bleiben bestehen; die Jahresangaben begründen keine exakte zeitliche Abfolge.</p>
      <ol className={styles.timeline}>{profile.stations.map(s => <li key={s.id} className={(s.demoAnchor || s.id === profile.referenceDegreeId) ? styles.anchor : ""}>
        <p className={styles.period}>{["ONGOING", "IN_PROGRESS"].includes(s.status) ? `Seit ${s.startYear ?? "Beginn unbekannt"}` : `${s.startYear ?? "Beginn unbekannt"} – ${s.endYear ?? "Ende unbekannt"}`} · Position {s.position}</p>
        <span>{labels[s.type] ?? s.type} · {labels[s.status] ?? s.status}</span>{s.id===profile.referenceDegreeId && <strong> · Bestätigter Referenzabschluss</strong>}{s.demoAnchor && <strong> · Synthetischer Demoanker</strong>}
        <h3>{s.title ?? "Bezeichnung unbekannt"}</h3><p>{s.provider ?? "Organisation / Einrichtung unbekannt"}{s.location ? ` · ${s.location}` : ""}</p>
        <p>{[s.field, s.sector, s.job].filter(Boolean).join(" · ") || "Kategorisierung unbekannt"}</p>
        {s.graduationYear !== null && <p>Abschlussjahr: {s.graduationYear}</p>}
      </li>)}</ol>
    </section>}
  </main>;
}
