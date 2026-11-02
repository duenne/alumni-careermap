import { useState, type ReactNode } from "react";
import type { AnalyticsProfile } from "../../../lib/analytics/records";
import type { QuestionCount } from "../../../lib/analytics/cohort-questions";
import { formatShare } from "../../../lib/analytics/sankey-layout";
import { orderedStations, stationPeriod, stationType, type CareerGroup, type understandCareers } from "../../../lib/analytics/understanding";
import styles from "./analytics.module.css";

type Understanding = ReturnType<typeof understandCareers>;
const typeLabel = (row: QuestionCount) => row.label === "NOT_RECORDED" ? "Keine weitere Station erfasst" : stationType({ type: row.label });
export function QuestionHelp({ label, children }: { label: string; children: ReactNode }) {
  return <details className={styles.contextHelp} data-counting-help><summary aria-label={label} title={label}>?</summary><div>{children}</div></details>;
}
function QuestionBars({ rows, total, caption, types = false }: { rows: QuestionCount[]; total: number; caption: string; types?: boolean }) {
  const items = (values: QuestionCount[]) => <ul className={styles.questionBars}>{values.map(row => <li key={row.label}>
    <div><span>{types ? typeLabel(row) : row.label}</span><strong>{row.count} · {formatShare(row.count, total)}</strong></div>
    <span className={styles.barTrack} aria-hidden="true"><span style={{ width: `${total ? row.count * 100 / total : 0}%` }} /></span>
  </li>)}</ul>;
  return <figure className={styles.questionFigure}><figcaption>{caption}</figcaption>{items(rows.slice(0, 5))}
    {rows.length > 5 && <details><summary>Alle {rows.length} Einträge anzeigen</summary>{items(rows.slice(5))}</details>}
    {!rows.length && <p>Keine entsprechenden Angaben erfasst.</p>}
  </figure>;
}
export function CareerInsights({ data }: { data: Understanding }) {
  const { facts, groups, questions: q } = data;
  const [question, setQuestion] = useState("before");
  const [perspective, setPerspective] = useState<"entry" | "latest">("entry");
  const work = q[perspective];
  const studies = q.study.fields.length ? q.study.fields : q.study.titles;
  const workLabels: Record<string, string> = { EMPLOYMENT: "Beschäftigungen", SELF_EMPLOYMENT: "selbstständige Tätigkeiten", INTERNSHIP: "Praktika" };
  const studyCoverage = q.study.fields.length ? q.study.fieldKnown : q.study.described;
  return <section id="career-questions" aria-label="Was die Karrierewege zeigen" className={styles.insights}>
    <h2>1. Die Karrierewege in vier Fragen</h2>
    <p>{facts.profiles} Profile · {facts.stations} erfasste Stationen bilden {groups.length} unterschiedliche Stationsfolgen.</p>
    <div className={styles.quickFacts}>
      <p><strong>{q.background.recorded} von {facts.profiles}</strong><span>mit früheren Stationen</span></p>
      <p><strong>{q.study.masters} von {facts.profiles}</strong><span>mit Master im weiteren Verlauf</span></p>
      <p><strong>{q.latest.selected} von {facts.profiles}</strong><span>mit beruflicher Station im weiteren Verlauf</span></p>
    </div>
    <div role="group" aria-label="Fragen an die Karrierewege" className={styles.questionNav}>
      {[["before", "Davor"], ["next", "Nächster Schritt"], ["study", "Weiterstudium"], ["work", "Berufliche Wege"]].map(([key, label], index) => <button key={key} type="button" aria-pressed={question === key} aria-controls="career-question-answer" onClick={() => setQuestion(key)}>{index + 1}. {label}</button>)}
    </div>
    <div id="career-question-answer" data-question-panel={question} className={styles.questionPanel}>
      {question === "before" && <>
        <h3>Welche Vorerfahrungen sind erfasst?</h3>
        <p><strong>{q.background.recorded} Profile</strong> enthalten Stationen vor dem MSI-Eintrag. Bei {q.background.unrecorded} fehlen frühere Einträge; daraus lässt sich keine fehlende Vorerfahrung ableiten.</p>
        <QuestionBars rows={q.background.types} total={facts.profiles} caption={`Vorerfahrungen · Anteil an allen ${facts.profiles} Profilen`} types /><p className={styles.help}>Ein Profil kann mehrere Vorerfahrungen enthalten.</p>
      </>}
      {question === "next" && <>
        <h3>Was steht direkt hinter MSI in der Timeline?</h3>
        <p>Jedes Profil zählt mit genau seinem nächsten Eintrag. Eine Station kann bereits während des MSI-Studiums begonnen haben.</p>
        <QuestionBars rows={q.next} total={facts.profiles} caption={`Nächster erfasster Schritt · ${facts.profiles} Profile`} types />
      </>}
      {question === "study" && <>
        <h3>Wie viele studieren weiter – und in welche Richtung?</h3>
        <p><strong>{q.study.masters} von {facts.profiles}</strong> Profilen enthalten im weiteren Verlauf ein Masterstudium; {q.study.multipleMasters} davon mehrere Masterphasen.</p>
        {studies[0] && <p>Die häufigste erfasste {q.study.fields.length ? "Fachrichtung" : "Masterbezeichnung"} ist <strong>{studies[0].label}</strong>: {studies[0].count} von {q.study.masters} Masterprofilen ({formatShare(studies[0].count, q.study.masters)}).</p>}
        <QuestionBars rows={studies} total={q.study.masters} caption={`${q.study.fields.length ? "Master-Fachrichtungen" : "Erfasste Masterstudiengänge"} · Anteil an ${q.study.masters} Masterprofilen`} />
        <p className={styles.help}>Für {studyCoverage} von {q.study.masters} Masterprofilen ist eine {q.study.fields.length ? "Fachrichtung" : "Bezeichnung"} erfasst. Studienphasen sind einschließlich laufender und ohne Abschluss beendeter Phasen gezählt.</p>
      </>}
      {question === "work" && <>
        <h3>Wie sehen Berufseinstieg und weiterer Berufsweg aus?</h3>
        <label className={styles.perspective}>Berufliche Perspektive<select aria-label="Berufliche Perspektive" value={perspective} onChange={e => setPerspective(e.target.value as "entry" | "latest")}><option value="entry">Erster sicher nach MSI begonnener Berufsschritt</option><option value="latest">Zuletzt erfasste berufliche Station</option></select></label>
        <p>{perspective === "entry" ? "Ein erster eindeutig nach MSI begonnener Berufsschritt ist" : "Eine berufliche Station im weiteren Verlauf ist"} für <strong>{work.selected} von {facts.profiles}</strong> Profilen ermittelbar. Bei {work.unresolved} {work.unresolved === 1 ? "Profil ist" : "Profilen ist"} {perspective === "entry" ? "dieser Beginn nicht eindeutig bestimmbar" : "keine solche Station erfasst"}.</p>
        <p>{work.types.map(row => `${row.count} ${row.count === 1 ? typeLabel(row) : workLabels[row.label] ?? typeLabel(row)}`).join(" · ")} · unter den {work.selected} ermittelten Stationen.</p>
        <div className={styles.workQuestions}>
          <div><h4>In welchen Branchen?</h4><p>Für {work.sectorKnown} von {work.selected} ermittelten Stationen ist eine Branche erfasst.</p>
            {work.sectorKnown ? <QuestionBars rows={work.sectors} total={work.selected} caption={`Branchen · Anteil an ${work.selected} ermittelten Stationen`} /> : <p className={styles.evidenceGap}>Branchen lassen sich damit nicht vergleichen. Eine dominierende Branche ist aus diesen Angaben nicht belegbar.</p>}
          </div>
          <div><h4>Welche Tätigkeiten?</h4><QuestionBars rows={work.roles} total={work.selected} caption={`Erfasste berufliche Rollen · Anteil an ${work.selected} ermittelten Stationen`} /></div>
        </div>
      </>}
      <QuestionHelp key={question} label="Wie werden diese Antworten gezählt?">
        <p>„Davor“, „nächster Schritt“ und „weiterer Verlauf“ beziehen sich auf die gespeicherte Reihenfolge. Sie beschreiben keine garantiert getrennten Zeiträume.</p>
        {question === "before" && <p>Jedes Profil zählt je Stationstyp höchstens einmal. Ein Profil kann mehrere Vorerfahrungen enthalten. Fehlende frühere Einträge belegen nicht, dass es davor keine Ausbildung oder Tätigkeit gab.</p>}
        {question === "next" && <p>Jedes Profil zählt mit genau dem ersten Eintrag hinter der Referenzstation. „Keine weitere Station erfasst“ bezeichnet fehlende Angaben im aufgezeichneten Weg. Ein Praktikum an dieser Position kann während des Studiums liegen und muss kein Berufseinstieg nach dem Abschluss sein.</p>}
        {question === "study" && <p>Ein Profil zählt je Fachrichtung oder Bezeichnung höchstens einmal. Mehrere Masterphasen sind möglich. Gleiche Bezeichnungen werden gebündelt; ähnlich klingende Studiengänge werden nicht automatisch gleichgesetzt. Ein erfasstes Masterstudium belegt keinen Masterabschluss.</p>}
        {question === "work" && <><p>Beim Berufseinstieg entscheidet die erste berufliche Station mit Beginn strikt nach dem MSI-Endjahr und einer Position hinter dem Referenzeintrag. Dazu zählen Beschäftigung, Selbstständigkeit und Praktikum. Jahresgrenzen, fehlende Daten oder gleich frühe Kandidaten können eine eindeutige Auswahl verhindern. Eine spätere erfasste Tätigkeit ist keine Aussage über die heutige Beschäftigung.</p><p>Branchen stammen ausschließlich aus erfassten Branchenangaben. Berufsbezeichnungen und Organisationsnamen ersetzen keine Branchenklassifikation.</p></>}
      </QuestionHelp>
    </div>
  </section>;
}

export function CareerGroups({ groups, profiles, selectedGroup, onGroup, onSelect }: { groups: CareerGroup[]; profiles: AnalyticsProfile[]; selectedGroup: CareerGroup | undefined; onGroup: (id: string | null) => void; onSelect: (id: string) => void }) {
  const groupButton = (group: CareerGroup) => <li key={group.id}><button type="button" data-career-group={group.id} aria-pressed={selectedGroup?.id === group.id} onClick={() => onGroup(selectedGroup?.id === group.id ? null : group.id)}><strong>{group.alumniIds.length} {group.alumniIds.length === 1 ? "Profil" : "Profile"}</strong><span>{group.label}</span></button></li>;
  return <section aria-label="Wiederkehrende Stationsfolgen" className={styles.careerGroups}>
    <h2>3. Einzelne Wege vergleichen</h2><p>Gleiche Folgen von Stationstypen sind gebündelt. Wähle eine Folge, um ihre Wege im Diagramm zu vergleichen. Wiederholte Beschäftigungen sind jeweils eigene Stationen.</p>
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
