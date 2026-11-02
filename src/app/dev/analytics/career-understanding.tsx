import type { AnalyticsProfile } from "../../../lib/analytics/records";
import { orderedStations, stationPeriod, stationType, type CareerGroup, type understandCareers } from "../../../lib/analytics/understanding";
import styles from "./analytics.module.css";

type Understanding = ReturnType<typeof understandCareers>;
export function CareerInsights({ data }: { data: Understanding }) {
  const { facts, groups } = data;
  const categories = [
    { title: facts.sectors.length ? "Branchen in den Wegen" : "Organisationen in den Wegen", rows: facts.sectors.length ? facts.sectors : facts.organisations },
    { title: facts.fields.length ? "Master-Fachrichtungen" : "Erfasste Masterstudiengänge", rows: facts.fields.length ? facts.fields : facts.masterTitles },
    { title: facts.jobs.length ? "Berufliche Aufgaben" : "Erfasste berufliche Rollen", rows: facts.jobs.length ? facts.jobs : facts.roles },
  ];
  return <section aria-label="Was die Karrierewege zeigen" className={styles.insights}>
    <h2>Was die {facts.profiles} Karrierewege zeigen</h2>
    <p>{facts.stations} erfasste Stationen bilden {groups.length} unterschiedliche Stationsfolgen.</p>
    <div className={styles.insightGrid}>
      <p><strong>{facts.master} von {facts.profiles}</strong> Profilen enthalten ein Masterstudium; {facts.multipleMasters} enthalten mehrere. Das schließt laufende und ohne Abschluss beendete Studienphasen ein.</p>
      <p><strong>{facts.work} von {facts.profiles}</strong> Profilen enthalten Beschäftigung, Selbstständigkeit oder Praktikum. Alle erfassten beruflichen Stationen zählen, auch während des Studiums.</p>
      {categories.map(({ title, rows }) => <div key={title}><h3>{title}</h3><ul>{rows.slice(0, 3).map(row => <li key={row.label}>{row.label} <strong>{row.count} Profile</strong></li>)}</ul>{rows.length > 3 && <details><summary>Alle {rows.length} Bezeichnungen anzeigen</summary><ul>{rows.slice(3).map(row => <li key={row.label}>{row.label} <strong>{row.count} Profile</strong></li>)}</ul></details>}{!rows.length && <p>Keine entsprechenden Kategorien erfasst.</p>}</div>)}
    </div>
    {!facts.sectors.length && !facts.jobs.length && facts.work > 0 && <p className={styles.help}>Branchen und Jobkategorien sind nicht hinterlegt. Deshalb zeigen wir die gespeicherten Organisations- und Tätigkeitsbezeichnungen.</p>}
    <p className={styles.help}>Je Kategorie wird jedes Profil einmal gezählt; ein Weg kann mehrere Kategorien enthalten. Nicht erfasst bedeutet keine Aussage über das tatsächliche Fehlen. Bei {facts.missingDates} Profilen fehlen Zeitangaben; bekannte Stationen bleiben sichtbar.</p>
  </section>;
}

export function CareerGroups({ groups, profiles, selectedGroup, onGroup, onSelect }: { groups: CareerGroup[]; profiles: AnalyticsProfile[]; selectedGroup: CareerGroup | undefined; onGroup: (id: string | null) => void; onSelect: (id: string) => void }) {
  const groupButton = (group: CareerGroup) => <li key={group.id}><button type="button" data-career-group={group.id} aria-pressed={selectedGroup?.id === group.id} onClick={() => onGroup(selectedGroup?.id === group.id ? null : group.id)}><strong>{group.alumniIds.length} {group.alumniIds.length === 1 ? "Profil" : "Profile"}</strong><span>{group.label}</span></button></li>;
  return <section aria-label="Wiederkehrende Stationsfolgen" className={styles.careerGroups}>
    <h2>Welche Wege stecken dahinter?</h2><p>Gleiche Folgen von Stationstypen sind gebündelt. Wähle eine Folge, um ihre Wege im Diagramm zu vergleichen. Wiederholte Beschäftigungen sind jeweils eigene Stationen.</p>
    <ol>{groups.slice(0, 6).map(groupButton)}</ol>
    {groups.length > 6 && <details className={styles.disclosure}><summary>Alle {groups.length} Stationsfolgen anzeigen</summary><ol>{groups.slice(6).map(groupButton)}</ol></details>}
    {selectedGroup && <section aria-label="Wege im gewählten Verlauf" className={styles.groupDetail}><h3>{selectedGroup.alumniIds.length} Wege mit dieser Stationsfolge</h3><p>{selectedGroup.label}</p><div className={styles.controls}>{selectedGroup.alumniIds.map(id => <button key={id} data-open-career={id} type="button" onClick={() => onSelect(id)}>Profil {profiles.findIndex(p => p.id === id) + 1} ansehen</button>)}<button type="button" onClick={() => onGroup(null)}>Alle Stationsfolgen zeigen</button></div></section>}
  </section>;
}

export function SelectedCareer({ profile, number }: { profile: AnalyticsProfile; number: number }) {
  return <section className={styles.selectedCareer} aria-label="Stationen des ausgewählten Karrierewegs"><h3>Profil {number} · der konkrete Karriereweg</h3>
    <p>Alle {profile.stations.length} Stationen in gespeicherter Reihenfolge. Zeiträume können sich überlappen; die Reihenfolge behauptet keine lückenlose zeitliche Abfolge.</p>
    <ol>{orderedStations(profile).map(s => <li key={s.id} data-reference-station={s.id === profile.referenceDegreeId || s.demoAnchor}>
      <span className={styles.period}>{stationPeriod(s)}</span><strong>{s.title ?? stationType(s)}</strong>
      <span>{s.id === profile.referenceDegreeId || s.demoAnchor ? "MSI · Referenzstudium" : stationType(s)}</span>
      {s.provider && <span>{s.provider}</span>}
      {[s.field, s.sector, s.job].filter(Boolean).length > 0 && <span>{[s.field, s.sector, s.job].filter(Boolean).join(" · ")}</span>}
      {s.kind === "DEGREE" && <span>{({ COMPLETED: "Abgeschlossen", IN_PROGRESS: "Im Studium", ENDED_WITHOUT_DEGREE: "Ohne Abschluss beendet", UNKNOWN: "Abschlussstatus offen" } as Record<string, string>)[s.status] ?? s.status}</span>}
    </li>)}</ol>
  </section>;
}
