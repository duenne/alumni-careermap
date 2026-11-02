"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { SurveyAdministration } from "../../../lib/surveys/service";
import { entryFields, entryKeys } from "../../../lib/surveys/entry-content";
import SurveyIntroduction from "../../surveys/survey-introduction";
import styles from "./survey-manager.module.css";

type Survey = SurveyAdministration["surveys"][number];
function editable(survey: Survey) {
  return { name: survey.name, ...Object.fromEntries(entryKeys.map(key => [key, survey[key] ?? ""])) } as { name: string } & Record<typeof entryKeys[number], string>;
}
export default function SurveyEditor({ survey, origin, onSaved, onClose }: { survey: Survey; origin: string; onSaved: (survey: Survey) => void; onClose: () => void }) {
  const [values, setValues] = useState(() => editable(survey));
  const [baseline, setBaseline] = useState(() => editable(survey));
  const [revision, setRevision] = useState(() => new Date(survey.updatedAt).toISOString());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [leaving, setLeaving] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [view, setView] = useState("edit");
  const [destination, setDestination] = useState<string>();
  const heading = useRef<HTMLHeadingElement>(null);
  const allowNavigation = useRef(false);
  const dirty = JSON.stringify(values) !== JSON.stringify(baseline);
  useEffect(() => { heading.current?.focus(); }, []);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { if (!allowNavigation.current) { event.preventDefault(); event.returnValue = ""; } };
    const navigate = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === "_blank" || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
      event.preventDefault(); event.stopPropagation();
      setDestination(anchor.href); setLeaving(true);
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", navigate, true);
    return () => { window.removeEventListener("beforeunload", warn); document.removeEventListener("click", navigate, true); };
  }, [dirty]);
  function change(key: keyof typeof values, value: string) { setValues(old => ({ ...old, [key]: value })); setMessage(""); }
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/surveys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "edit", surveyId: survey.id, expectedUpdatedAt: revision, ...values }) });
      if (!response.ok) {
        setError(response.status === 409
          ? "Diese Befragung wurde inzwischen geändert. Deine Eingaben bleiben hier erhalten. Bitte sichere sie und lade die Seite neu, um den aktuellen Stand zu prüfen."
          : "Die Änderung wurde nicht bestätigt. Deine Eingaben bleiben erhalten. Bitte Zugang und Feldlängen prüfen.");
        return;
      }
      const saved = await response.json() as Survey;
      const next = editable(saved);
      setValues(next); setBaseline(next); setRevision(new Date(saved.updatedAt).toISOString());
      onSaved({ ...survey, ...saved }); setLeaving(false); setMessage("Änderungen gespeichert.");
    } catch { setError("Keine Speicherbestätigung erhalten. Deine Eingaben bleiben erhalten. Bitte vor einem erneuten Versuch den gespeicherten Stand prüfen."); }
    finally { setBusy(false); }
  }
  return <section id="survey-editor" className={styles.editor} aria-labelledby="editor-heading">
    <div className={styles.editorTop}>
      <button type="button" className={styles.secondary} disabled={busy} onClick={() => { setDestination(undefined); if (dirty) setLeaving(true); else onClose(); }}>← Zur Übersicht</button>
      <span className={dirty ? styles.dirty : styles.saved}>{dirty ? "Ungespeicherte Änderungen" : "Gespeicherter Stand"}</span>
    </div>
    {leaving && <div role="alert" className={styles.notice}>
      <p>Deine Änderungen sind noch nicht gespeichert.</p>
      <div className={styles.actions}><button type="button" onClick={() => { if (destination) { allowNavigation.current = true; window.location.assign(destination); } else onClose(); }}>Änderungen verwerfen und zurück</button><button type="button" className={styles.secondary} onClick={() => setLeaving(false)}>Weiter bearbeiten</button></div>
    </div>}
    <div><p className={styles.kicker}>Befragung gestalten</p><h2 id="editor-heading" ref={heading} tabIndex={-1}>{survey.name}</h2><p className={styles.muted}>Eine persönliche Einladung für deine Alumni. Die Vorschau zeigt deine Texte direkt beim Bearbeiten.</p></div>
    <div className={styles.mobileSwitch} aria-label="Editoransicht">
      <button type="button" aria-pressed={view === "edit"} onClick={() => setView("edit")}>Bearbeitung</button>
      <button type="button" aria-pressed={view === "preview"} onClick={() => setView("preview")}>Vorschau</button>
    </div>
    <form onSubmit={save}>
      <div className={styles.editorGrid} data-view={view}>
        <div className={styles.editorFields}>
          <section className={styles.panel} aria-labelledby="general-heading">
            <h3 id="general-heading">Allgemein</h3>
            <label htmlFor="edit-name">Name der Befragung</label>
            <input id="edit-name" required maxLength={200} value={values.name} disabled={busy} onChange={event => change("name", event.target.value)} />
            <p className={styles.fieldHint}>Für die Übersicht und die Angaben zur Befragung.</p>
            <dl className={styles.reference}><dt>Studiengang</dt><dd>{survey.referenceProgram.name}</dd>{survey.referenceProgram.faculty && <><dt>Fakultät</dt><dd>{survey.referenceProgram.faculty}</dd></>}</dl>
            <p className={styles.fieldHint}>Der Studiengang ist seit Anlage festgelegt. Für einen anderen Studiengang lege eine neue Befragung an.</p>
          </section>
          <section className={styles.panel} aria-labelledby="entry-heading">
            <h3 id="entry-heading">Alumni-Einstieg</h3>
            <p className={styles.muted}>Leere Felder verwenden den angezeigten Standardtext. Der Kontakt ist freiwillig.</p>
            {entryKeys.map(key => <div className={styles.editorField} key={key}>
              <label htmlFor={`edit-${key}`}>{entryFields[key].label}</label>
              <textarea id={`edit-${key}`} rows={key === "entryWelcome" ? 7 : key === "entryHeading" ? 2 : 3} maxLength={entryFields[key].max} placeholder={entryFields[key].fallback} value={values[key]} disabled={busy} aria-describedby={`hint-${key}`} onChange={event => change(key, event.target.value)} />
              <div id={`hint-${key}`} className={styles.fieldHint}>{entryFields[key].hint} <span>{values[key].length} / {entryFields[key].max}</span></div>
            </div>)}
            <p className={styles.notice}>Hinweise zu Datenschutz, Freiwilligkeit und Speicherung werden von der Anwendung ergänzt und bleiben verbindlich.</p>
          </section>
          <section className={styles.panel} aria-labelledby="invitation-heading">
            <h3 id="invitation-heading">Einladung</h3>
            {survey.status === "DRAFT" ? <p className={styles.muted}>Der Einladungslink wird nach dem Öffnen bereitgestellt. Deine Texte kannst du schon jetzt in der Vorschau prüfen.</p> : <>
              <label htmlFor="editor-invitation">Einladungslink</label><input id="editor-invitation" readOnly value={`${origin}/surveys/${survey.id}`} onFocus={event => event.target.select()} />
              <p><a href={`/surveys/${survey.id}`} target="_blank" rel="noreferrer">Alumni-Einstieg öffnen ↗</a></p>
              {survey.status === "CLOSED" && <p className={styles.muted}>Die Befragung ist geschlossen. Der Einstieg zeigt den Schließhinweis.</p>}
            </>}
          </section>
        </div>
        <aside className={styles.previewColumn} aria-label="Vorschau des Alumni-Einstiegs">
          <div className={styles.previewToolbar}><strong>Textvorschau</strong><div className={styles.actions}><button type="button" className={styles.secondary} aria-pressed={!mobile} onClick={() => setMobile(false)}>Desktop</button><button type="button" className={styles.secondary} aria-pressed={mobile} onClick={() => setMobile(true)}>Mobil</button></div></div>
          <p className={styles.fieldHint}>Vorschau der bearbeitbaren Inhalte. Teilnahmeablauf und Systemhinweise siehst du im Alumni-Einstieg.</p>
          <div className={styles.previewFrame} data-mobile={mobile}><SurveyIntroduction content={values} program={survey.referenceProgram} preview /></div>
        </aside>
      </div>
      <div className={styles.saveBar}>
        <div><p role="status" aria-live="polite">{message || (dirty ? "Ungespeicherte Änderungen" : "Alle Änderungen gespeichert")}</p>{error && <p role="alert">{error}</p>}</div>
        <div className={styles.actions}><button type="button" className={styles.secondary} disabled={busy || !dirty} onClick={() => { setValues(baseline); setError(""); setMessage(""); setLeaving(false); }}>Verwerfen</button><button type="submit" disabled={busy || !dirty || !values.name.trim()}>{busy ? "Wird gespeichert …" : "Änderungen speichern"}</button></div>
      </div>
    </form>
  </section>;
}
