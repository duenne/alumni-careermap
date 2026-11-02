"use client";
import { useEffect, useRef, useState } from "react";
import { classificationChoices, degreeStatuses, careerStatuses } from "../../../lib/career-review/preview";
import { parseManualParticipation, ManualParticipationError, type ManualStation, type ManualDegree, type ManualCareerStep } from "../../../lib/donation/manual";
import styles from "../surveys.module.css";
import JourneyProgress from "../journey-progress";

type Receipt = { degrees: number; careerSteps: number; timelineItems: number };
const degree = (first = false): ManualDegree => ({ key: crypto.randomUUID(), kind: "DEGREE", title: "", level: "", status: "", program: first ? "SURVEY" : "OTHER", institutionName: "", fieldOfStudy: "", startYear: null, endYear: null, graduationYear: null });
const career = (): ManualCareerStep => ({ key: crypto.randomUUID(), kind: "CAREER_STEP", title: "", type: "", status: "", organisationName: "", location: "", startYear: null, endYear: null });

export default function ManualEntry({ surveyId, programName, institutionName, receipt: initialReceipt, initialStations }: { surveyId: string; programName: string; institutionName: string; receipt?: Receipt; initialStations?: ManualStation[] }) {
  const [stations, setStations] = useState<ManualStation[]>(() => initialStations ? structuredClone(initialStations) : [degree(true)]);
  const [referenceKey, setReferenceKey] = useState("");
  const [referenceConfirmed, setReferenceConfirmed] = useState(false);
  const [contributionConfirmed, setContributionConfirmed] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState(initialReceipt);
  const sectionHeading = useRef<HTMLHeadingElement>(null);
  const errorNotice = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (reviewing || receipt) sectionHeading.current?.focus(); }, [reviewing, receipt]);
  useEffect(() => { if (error) errorNotice.current?.focus(); }, [error]);
  const input = { stations, referenceKey, referenceConfirmed, contributionConfirmed };
  const candidates = stations.filter(s => s.kind === "DEGREE" && s.program === "SURVEY" && s.status === "COMPLETED");
  function update(key: string, changes: Partial<ManualStation>) {
    setStations(items => items.map(item => item.key === key ? { ...item, ...changes } as ManualStation : item));
    setReferenceConfirmed(false); setContributionConfirmed(false); setError("");
  }
  function move(index: number, direction: number) {
    setStations(items => { const next = [...items]; [next[index], next[index + direction]] = [next[index + direction], next[index]]; return next; });
  }
  function review() {
    setError("");
    try { parseManualParticipation(input, false); setReviewing(true); }
    catch (error) { setError(error instanceof ManualParticipationError ? error.message : "Bitte prüfe deine Angaben."); }
  }
  async function save() {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/surveys/${surveyId}/participation`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ input: parseManualParticipation(input) }) });
      const result = await response.json();
      if (!response.ok || !result.saved) {
        if (result.code === "INVALID_INPUT") { setError(result.message); setUncertain(false); }
        else if (result.code === "SURVEY_NOT_OPEN") setError("Diese Befragung ist nicht mehr geöffnet. Eine Abgabe ist nicht möglich.");
        else { setUncertain(true); setError("Keine Speicherbestätigung erhalten. Bitte sende denselben Beitrag erneut oder lade die Seite neu, um die Bestätigung zu prüfen. Beginne keine neue Teilnahme."); }
        return;
      }
      setReceipt(result.receipt); setStations([]); setUncertain(false);
    } catch {
      setUncertain(true); setError("Keine Speicherbestätigung erhalten. Bitte sende denselben Beitrag erneut oder lade die Seite neu, um die Bestätigung zu prüfen. Beginne keine neue Teilnahme.");
    } finally { setBusy(false); }
  }
  const yearField = (station: ManualStation, name: "startYear" | "endYear" | "graduationYear", label: string, disabled = false) => <label>{label}<input type="number" min={1} max={9999} value={(name in station ? station[name as keyof typeof station] : null) as number | null ?? ""} disabled={disabled} onChange={event => update(station.key, { [name]: event.target.value === "" ? null : Number(event.target.value) })} /></label>;
  if (receipt) return <div className={styles.stack}><JourneyProgress step={3} /><section className={`${styles.card} ${styles.successCard}`} aria-labelledby="participation-complete">
    <span className={styles.successIcon} aria-hidden="true">✓</span>
    <p className="eyebrow">Teilnahme abgeschlossen</p>
    <h2 id="participation-complete" ref={sectionHeading} tabIndex={-1}>Dein Karriereweg wurde gespeichert</h2>
    <p role="status">Vielen Dank! Dein Beitrag zur Befragung „{programName}“ ist angekommen. Du brauchst ihn nicht erneut abzusenden.</p>
    <p>{receipt.degrees} Studienabschlüsse, {receipt.careerSteps} berufliche oder weitere Stationen. Deine Angaben sind nur im geschützten Betreiberbereich zugänglich.</p>
    <p className={styles.completionNote}>Du kannst diese Seite jetzt schließen. Beim erneuten Aufrufen wird dir diese Bestätigung wieder angezeigt, solange deine Teilnahmesitzung verfügbar ist.</p>
  </section></div>;
  return <div className={styles.stack}>
    <JourneyProgress step={reviewing ? 2 : 1} />
    <div className={styles.journeyLayout}><div className={styles.stack}>
    {error && <p role="alert" ref={errorNotice} tabIndex={-1}>{error}</p>}
    {!reviewing ? <>
      <div className={styles.sectionIntro}><h2>Deinen Werdegang erfassen</h2><p>{initialStations ? "Prüfe und ergänze die übernommenen Stationen." : "Trage deinen eigenen Studien- und Berufsweg ein."} Unbekannte Jahreszahlen kannst du freilassen. Name und E-Mail werden hier nicht abgefragt. Dein Beitrag wird erst nach der Prüfung und deiner Bestätigung gespeichert.</p></div>
      {stations.map((station, index) => <fieldset key={station.key} className={`${styles.card} ${styles.stack} ${styles.stationCard}`}>
        <legend>{index + 1}. {station.kind === "DEGREE" ? "Studium" : "Berufliche oder weitere Station"}</legend>
        <label>Studium oder andere Station?<select aria-label="Studium oder andere Station?" value={station.kind} onChange={event => {
          const common = { key: station.key, title: station.title, startYear: station.startYear, endYear: station.endYear, status: "" };
          const replacement: ManualStation = event.target.value === "DEGREE"
            ? { ...degree(), ...common, institutionName: station.kind === "CAREER_STEP" ? station.organisationName : station.institutionName }
            : { ...career(), ...common, organisationName: station.kind === "DEGREE" ? station.institutionName : station.organisationName };
          setStations(items => items.map(s => s.key === station.key ? replacement : s)); if (referenceKey === station.key) setReferenceKey("");
        }}><option value="DEGREE">Studium mit eigenem akademischem Abschluss</option><option value="CAREER_STEP">Berufliche oder weitere Station</option></select></label>
        <label>{station.kind === "DEGREE" ? "Bezeichnung des Studiums" : "Tätigkeit / Bezeichnung"}<input required maxLength={200} value={station.title} onChange={event => update(station.key, { title: event.target.value })} /></label>
        {station.kind === "DEGREE" ? <>
          <div className={styles.manualFields}>
            <label>Abschlussart<select aria-label="Abschlussart" required value={station.level} onChange={event => update(station.key, { level: event.target.value })}><option value="">Bitte auswählen</option>{classificationChoices.filter(c => c.classification.type === "DEGREE").map(c => <option key={c.value} value={c.value.split(":")[1]}>{c.label}</option>)}</select></label>
            <label>Studienstatus<select aria-label="Studienstatus" required value={station.status} onChange={event => update(station.key, { status: event.target.value, ...(event.target.value !== "COMPLETED" ? { graduationYear: null } : {}), ...(["IN_PROGRESS", "UNKNOWN"].includes(event.target.value) ? { endYear: null } : {}) })}><option value="">Bitte auswählen</option>{degreeStatuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label>
          </div>
          <label>Studiengang zuordnen<select aria-label="Studiengang zuordnen" value={station.program} onChange={event => update(station.key, { program: event.target.value as ManualDegree["program"] })}><option value="SURVEY">{programName} · {institutionName}</option><option value="OTHER">Ein anderer Studiengang</option></select></label>
          {station.program === "OTHER" && <label>Hochschule (optional)<input maxLength={200} value={station.institutionName} onChange={event => update(station.key, { institutionName: event.target.value })} /></label>}
          <label>Fachrichtung (optional)<input maxLength={200} value={station.fieldOfStudy} onChange={event => update(station.key, { fieldOfStudy: event.target.value })} /></label>
        </> : <>
          <div className={styles.manualFields}>
            <label>Art der Station<select aria-label="Art der Station" required value={station.type} onChange={event => update(station.key, { type: event.target.value })}><option value="">Bitte auswählen</option>{classificationChoices.filter(c => c.classification.type === "CAREER_STEP").map(c => <option key={c.value} value={c.value.split(":")[1]}>{c.label}</option>)}</select></label>
            <label>Status der Tätigkeit<select aria-label="Status der Tätigkeit" required value={station.status} onChange={event => update(station.key, { status: event.target.value, ...(event.target.value !== "ENDED" ? { endYear: null } : {}) })}><option value="">Bitte auswählen</option>{careerStatuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label>
          </div>
          <label>Arbeitgeber / Organisation (optional)<input maxLength={200} value={station.organisationName} onChange={event => update(station.key, { organisationName: event.target.value })} /></label>
          <label>Ort (optional)<input maxLength={200} value={station.location} onChange={event => update(station.key, { location: event.target.value })} /></label>
        </>}
        <div className={styles.manualFields}>
          {yearField(station, "startYear", "Beginn (Jahr, optional)")}
          {yearField(station, "endYear", "Ende (Jahr, optional)", station.kind === "DEGREE" ? !["COMPLETED", "ENDED_WITHOUT_DEGREE"].includes(station.status) : station.status !== "ENDED")}
          {station.kind === "DEGREE" && yearField(station, "graduationYear", "Abschlussjahr (optional)", station.status !== "COMPLETED")}
        </div>
        <div className={`${styles.actions} ${styles.stationActions}`}>
          <button type="button" className={styles.secondary} disabled={index === 0} onClick={() => move(index, -1)} aria-label={`${station.title || "Station"} nach oben`}>Nach oben</button>
          <button type="button" className={styles.secondary} disabled={index === stations.length - 1} onClick={() => move(index, 1)} aria-label={`${station.title || "Station"} nach unten`}>Nach unten</button>
          <button type="button" className={styles.quiet} onClick={() => { setStations(items => items.filter(s => s.key !== station.key)); if (referenceKey === station.key) setReferenceKey(""); }}>Station entfernen</button>
        </div>
      </fieldset>)}
      <div className={styles.actions}>
        <button type="button" className={styles.secondary} disabled={stations.length >= 50} onClick={() => setStations(items => [...items, degree()])}>Studium ergänzen</button>
        <button type="button" className={styles.secondary} disabled={stations.length >= 50} onClick={() => setStations(items => [...items, career()])}>Berufliche oder weitere Station ergänzen</button>
      </div>
      <section className={`${styles.card} ${styles.stack} ${styles.referenceCard}`} aria-labelledby="own-degree-heading">
        <h2 id="own-degree-heading">Dein Abschluss als Ausgangspunkt</h2>
        <p>Wähle selbst deinen abgeschlossenen Studienabschluss im Studiengang {programName}. Auch bei nur einem passenden Abschluss ist deine Auswahl erforderlich.</p>
        <label>Welcher eigene Abschluss gehört zu dieser Befragung?<select aria-label="Welcher eigene Abschluss gehört zu dieser Befragung?" required name="own-degree" value={referenceKey} onChange={event => setReferenceKey(event.target.value)}><option value="">Bitte selbst auswählen</option>{candidates.map(s => <option key={s.key} value={s.key}>{s.title}{s.kind === "DEGREE" && s.graduationYear ? ` · ${s.graduationYear}` : ""}</option>)}</select></label>
        {!candidates.length && <p>Ergänze oben einen abgeschlossenen Studienabschluss und ordne ihn diesem Studiengang zu.</p>}
      </section>
      <div className={styles.journeyActions}><p>Im nächsten Schritt kannst du alles noch einmal prüfen.</p><button type="button" onClick={review}>Angaben prüfen</button></div>
    </> : <section className={`${styles.card} ${styles.stack}`} aria-labelledby="manual-review-heading">
      <h2 id="manual-review-heading" ref={sectionHeading} tabIndex={-1}>Deine Angaben prüfen</h2>
      <ol className={styles.manualReview}>{stations.map(station => <li key={station.key} data-reference={station.key === referenceKey || undefined}>
        <h3>{station.title}{station.key === referenceKey ? " · Dein gewählter Abschluss" : ""}</h3>
        <p>{station.kind === "DEGREE" ? `${classificationChoices.find(c => c.value === `DEGREE:${station.level}`)?.label} · ${degreeStatuses.find(s => s.value === station.status)?.label}` : `${classificationChoices.find(c => c.value === `CAREER_STEP:${station.type}`)?.label} · ${careerStatuses.find(s => s.value === station.status)?.label}`}</p>
        <p>{station.kind === "DEGREE" ? station.program === "SURVEY" ? `${programName} · ${institutionName}` : station.institutionName || "Hochschule nicht angegeben" : station.organisationName || "Organisation nicht angegeben"}</p>
        <p>Beginn: {station.startYear ?? "nicht angegeben"} · Ende: {station.endYear ?? "nicht angegeben"}{station.kind === "DEGREE" ? ` · Abschlussjahr: ${station.graduationYear ?? "nicht angegeben"}` : ""}</p>
        {station.kind === "DEGREE" && station.fieldOfStudy && <p>Fachrichtung: {station.fieldOfStudy}</p>}
        {station.kind === "CAREER_STEP" && station.location && <p>Ort: {station.location}</p>}
      </li>)}</ol>
      <p>Mit dem Absenden werden dein Karriereweg und deine Teilnahme an dieser Befragung gespeichert. Einzelne Karriereprofile sind nur für den berechtigten Betreiber zugänglich.</p>
      <label className={styles.choice}><input type="checkbox" checked={referenceConfirmed} disabled={busy || uncertain} onChange={event => setReferenceConfirmed(event.target.checked)} />Ich bestätige, dass der ausgewählte Abschluss mein eigener abgeschlossener Studienabschluss im Studiengang {programName} ist.</label>
      <label className={styles.choice}><input type="checkbox" checked={contributionConfirmed} disabled={busy || uncertain} onChange={event => setContributionConfirmed(event.target.checked)} />Ich habe meine Angaben geprüft und möchte diesen Karriereweg für diese Befragung abgeben.</label>
      <div className={styles.actions}>
        <button type="button" className={styles.secondary} disabled={busy || uncertain} onClick={() => { setReviewing(false); setReferenceConfirmed(false); setContributionConfirmed(false); setError(""); }}>Angaben bearbeiten</button>
        <button type="button" disabled={busy || !referenceConfirmed || !contributionConfirmed} onClick={() => void save()}>{busy ? "Wird gespeichert …" : "Verbindlich absenden"}</button>
      </div>
    </section>}
    </div><aside className={`${styles.card} ${styles.journeyAside}`} aria-label="Hinweise zu deiner Teilnahme">
      <p className="eyebrow">Deine Teilnahme</p><h2>{programName}</h2><p>{institutionName}</p>
      <dl><dt>Stationen im Entwurf</dt><dd>{stations.length}</dd></dl>
      <div className={styles.asideNote}><strong>Du behältst die Kontrolle</strong><p>Du kannst deine Angaben vor der Abgabe bearbeiten. Gespeichert wird erst nach deiner ausdrücklichen Bestätigung.</p></div>
      <p className="demoNote">Name und E-Mail sind für deinen Beitrag nicht erforderlich.</p>
    </aside></div>
  </div>;
}
