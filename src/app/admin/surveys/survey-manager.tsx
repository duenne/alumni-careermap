"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { SurveyAdministration, SurveyContext } from "../../../lib/surveys/service";
import styles from "../../surveys/surveys.module.css";
import adminStyles from "./survey-manager.module.css";
import { institutionLabel } from "../../../lib/surveys/presentation";
import { InstitutionBrand } from "../../surveys/survey-introduction";
import SurveyEditor from "./survey-editor";

const statusLabels = { DRAFT: "Entwurf", OPEN: "Geöffnet", CLOSED: "Geschlossen" };
async function loadAdministration(): Promise<SurveyAdministration> {
  const response = await fetch("/api/admin/surveys", { cache: "no-store" });
  if (!response.ok) throw new Error();
  return response.json();
}
export default function SurveyManager() {
  const [showCreation, setShowCreation] = useState(false);
  const [data, setData] = useState<SurveyAdministration>();
  const [institutionId, setInstitutionId] = useState("");
  const [programId, setProgramId] = useState("");
  const [name, setName] = useState("");
  const [catalogName, setCatalogName] = useState("");
  const [catalogFaculty, setCatalogFaculty] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [origin, setOrigin] = useState("");
  const [editing, setEditing] = useState<string>();
  const overviewHeading = "existing-surveys";

  useEffect(() => {
    let active = true;
    void loadAdministration().then(data => {
      if (active) { setData(data); setOrigin(window.location.origin); }
    }).catch(() => { if (active) setError("Die Befragungen konnten nicht geladen werden. Bitte Zugang und lokale Konfiguration prüfen und die Seite neu laden."); });
    return () => { active = false; };
  }, []);

  async function mutate(body: unknown, success: string) {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/surveys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!response.ok) { setError(response.status === 409 ? "Dieser Studiengang mit derselben Fakultät ist bereits vorhanden." : "Die Änderung wurde nicht bestätigt. Bitte die Seite neu laden und Befragung sowie Betreiberzuordnung prüfen."); return; }
      setMessage(success);
      if (response.status === 201) { setName(""); setCatalogName(""); }
      try { setData(await loadAdministration()); }
      catch { setError("Die Änderung wurde gespeichert. Die Liste konnte nicht aktualisiert werden. Bitte die Seite neu laden."); }
    } catch { setError("Keine Bestätigung erhalten. Bitte vor einem erneuten Versuch die Seite neu laden und den gespeicherten Stand prüfen."); }
    finally { setBusy(false); }
  }
  function create(event: FormEvent) {
    event.preventDefault();
    void mutate({ action: "create", name, referenceProgramId: programId }, "Befragung als Entwurf angelegt.");
  }
  async function copy(survey: SurveyContext) {
    setMessage(""); setError("");
    try { await navigator.clipboard.writeText(`${origin}/surveys/${survey.id}`); setMessage(`Einladungslink für „${survey.name}“ kopiert.`); }
    catch { setError("Kopieren nicht möglich. Bitte den Einladungslink im Textfeld markieren und kopieren."); }
  }
  const programs = data?.institutions.find(i => i.id === institutionId)?.programs ?? [];
  function toggleCreation() {
    setShowCreation(value => !value);
    if (!showCreation) requestAnimationFrame(() => document.getElementById("survey-creation")?.scrollIntoView?.({ behavior: "smooth", block: "start" }));
  }
  const selected = data?.surveys.find(survey => survey.id === editing);
  if (selected) return <div className={`${styles.stack} ${adminStyles.manager}`}><SurveyEditor key={selected.id} survey={selected} origin={origin}
    onSaved={saved => setData(current => current && ({ ...current, surveys: current.surveys.map(survey => survey.id === saved.id ? saved : survey) }))}
    onClose={() => { setEditing(undefined); requestAnimationFrame(() => document.getElementById(overviewHeading)?.focus()); }} /></div>;
  return <div className={`${styles.stack} ${adminStyles.manager}`}>
    <p role="status" aria-live="polite">{message}</p>
    {error && <p role="alert">{error}</p>}
    {!data && !error && <p>Befragungen werden geladen …</p>}
    {data && <>
      <div className={adminStyles.overviewTop}>
        {data.institutions[0] && <InstitutionBrand institution={data.institutions[0]} />}
        <button type="button" aria-expanded={showCreation} aria-controls="survey-creation" onClick={toggleCreation}>{showCreation ? "Anlegen schließen" : "Neue Befragung"}</button>
      </div>
      <dl className={adminStyles.summary} aria-label="Befragungsübersicht">
        <div><dt>Befragungen</dt><dd>{data.surveys.length}</dd></div>
        <div><dt>Geöffnet</dt><dd>{data.surveys.filter(survey => survey.status === "OPEN").length}</dd></div>
        <div><dt>Bestätigte Teilnahmen</dt><dd>{data.surveys.reduce((count, survey) => count + survey._count.responses, 0)}</dd></div>
      </dl>
      <section aria-labelledby="existing-surveys" className={styles.stack}>
        <h2 id="existing-surveys" tabIndex={-1}>Deine Befragungen</h2>
        {!data.surveys.length && <p>Noch keine Befragungen vorhanden.</p>}
        {data.surveys.map(survey => <article key={survey.id} className={`${styles.card} ${adminStyles.surveyCard}`} aria-label={survey.name}>
          <div className={adminStyles.cardHeading}>
            <h3>{survey.name}</h3>
            <p className={adminStyles.status} data-status={survey.status}><span className={adminStyles.statusDot} aria-hidden="true" />{statusLabels[survey.status]}</p>
          </div>
          <p>{institutionLabel(survey.referenceProgram.institution)} · {survey.referenceProgram.name}{survey.referenceProgram.faculty ? ` · ${survey.referenceProgram.faculty}` : ""}</p>
          <div className={adminStyles.cardMeta}>
            <p className={adminStyles.responseCount}><strong>{survey._count.responses}</strong> bestätigte Teilnahmen</p>
          </div>
          <div className={styles.actions}>
            <button type="button" disabled={busy} onClick={() => { setMessage(""); setError(""); setEditing(survey.id); }}>Bearbeiten</button>
            <a className={adminStyles.actionLink} href={`/admin/surveys/${survey.id}/analytics`}>Auswertung ansehen</a>
            {survey.status !== "OPEN" && <button className={adminStyles.secondary} disabled={busy} onClick={() => void mutate({ action: "status", surveyId: survey.id, status: "OPEN" }, `„${survey.name}“ geöffnet.`)}>{survey.status === "CLOSED" ? "Wieder öffnen" : "Befragung öffnen"}</button>}
            {survey.status === "OPEN" && <button className={adminStyles.secondary} disabled={busy} onClick={() => void mutate({ action: "status", surveyId: survey.id, status: "CLOSED" }, `„${survey.name}“ geschlossen.`)}>Befragung schließen</button>}
          </div>
          {survey.status === "DRAFT" ? <p>Der Einladungslink wird nach dem Öffnen bereitgestellt.</p> : <div className={adminStyles.invitation}>
            <label>Einladungslink<input readOnly value={`${origin}/surveys/${survey.id}`} onFocus={event => event.target.select()} /></label>
            <div className={styles.actions}>
              {survey.status === "OPEN" && <button className={adminStyles.secondary} disabled={busy} onClick={() => void copy(survey)}>Einladungslink kopieren</button>}
              <a href={`/surveys/${survey.id}`} target="_blank" rel="noreferrer">Alumni-Einstieg ansehen</a>
            </div>
            {survey.status === "CLOSED" && <p>Der Link zeigt jetzt den Hinweis auf die geschlossene Befragung.</p>}
          </div>}
        </article>)}
      </section>
      <div id="survey-creation" hidden={!showCreation} className={`${styles.stack} ${adminStyles.creationForms}`}>
        <section aria-labelledby="catalog-heading" className={styles.card}>
          <h2 id="catalog-heading">Fakultät und Studiengang ergänzen</h2>
          <p>Neue Studiengänge gehören zur Betreiberhochschule. Eine Fakultät wird zusammen mit ihrem Studiengang erfasst; vorhandene Angaben stehen zur Auswahl. Bestehende Befragungen behalten ihren Bezug.</p>
          <form className={styles.stack} onSubmit={event => {
            event.preventDefault();
            void mutate({ action: "program-create", institutionId: data.institutions[0]?.id, name: catalogName, faculty: data.facultyScope ?? (catalogFaculty.trim() || null) }, "Studiengang mit Fakultätsangabe angelegt und für neue Befragungen verfügbar.");
          }}>
            <p>Hochschule: {data.institutions[0] ? institutionLabel(data.institutions[0]) : "Nicht konfiguriert"}</p>
            <label>Fakultät (optional)<input maxLength={200} list="catalog-faculties" value={data.facultyScope ?? catalogFaculty} readOnly={!!data.facultyScope} onChange={event => setCatalogFaculty(event.target.value)} disabled={busy} /></label>
            <datalist id="catalog-faculties">{[...new Set(data.institutions.flatMap(i => i.programs.flatMap(p => p.faculty ? [p.faculty] : [])))].map(faculty => <option key={faculty} value={faculty} />)}</datalist>
            <label>Name des neuen Studiengangs<input required maxLength={200} value={catalogName} onChange={event => setCatalogName(event.target.value)} disabled={busy} /></label>
            <button disabled={busy || !catalogName.trim() || !data.institutions.length}>Studiengang hinzufügen</button>
          </form>
        </section>
        <section aria-labelledby="create-survey" className={styles.card}>
          <h2 id="create-survey">Neue Befragung</h2>
          <form onSubmit={create} className={styles.stack}>
            <div className={styles.field}>
              <label htmlFor="survey-institution">Hochschule</label>
              <select id="survey-institution" required value={institutionId} onChange={event => { setInstitutionId(event.target.value); setProgramId(""); }} disabled={busy}>
                <option value="">Bitte auswählen</option>
                {data.institutions.map(i => <option key={i.id} value={i.id}>{institutionLabel(i)}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label htmlFor="survey-program">Studiengang</label>
              <select id="survey-program" required value={programId} onChange={event => setProgramId(event.target.value)} disabled={busy || !institutionId}>
                <option value="">Bitte auswählen</option>
                {programs.map(p => <option key={p.id} value={p.id}>{p.name}{p.faculty ? ` · ${p.faculty}` : ""}</option>)}
              </select>
            </div>
            {institutionId && !programs.length && <p>Für diesen Betreiber sind keine Studiengänge verfügbar.</p>}
            {!data.institutions.length && <p>Keine konfigurierte Hochschule gefunden. Bitte die Betreiberkonfiguration prüfen.</p>}
            <label>Name der Befragung<input required maxLength={200} value={name} onChange={event => setName(event.target.value)} disabled={busy} /></label>
            <button type="submit" disabled={busy || !programId || !name.trim()}>Als Entwurf anlegen</button>
          </form>
        </section>
      </div>
    </>}
  </div>;
}
