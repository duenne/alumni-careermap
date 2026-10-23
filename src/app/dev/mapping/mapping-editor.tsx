"use client";
import { useEffect, useState } from "react";
import { classificationChoices, degreeStatuses, careerStatuses } from "../../../lib/career-review/preview";
import { mapCareerImport, readCareerSnapshot, sourceRows, suggestReviews, type ImportReview } from "../../../lib/career-import/mapping";
import type { SnapshotProjection } from "../../../lib/dev-import/json-preview";
import type { ImportReceipt } from "../../../lib/career-import/service";
import styles from "./mapping.module.css";

type CatalogRow = { id: string; name: string };
type Survey = CatalogRow & { referenceProgramId: string; referenceProgram: CatalogRow & { institution: CatalogRow } };
type Context = { surveys: Survey[]; institutions: CatalogRow[]; programs: (CatalogRow & { institution: { name: string } })[]; organisations: CatalogRow[]; fixtures: { id: string; label: string }[] };
const endpoint = "/api/dev/import/mapping";
const errors: Record<string, string> = {
  INCOMPLETE_SOURCE: "Die Rohvorschau ist unvollständig. Beide Domänen müssen ein nachgewiesenes Ende haben. Rufe sonst die Karrieredaten erneut ab.",
  INVALID_SOURCE: "Das JSON hat keine unterstützte Snapshot-Struktur. EDUCATION und POSITIONS sind erforderlich.",
  INVALID_REVIEW: "Prüfe Typ, Status und positive, eindeutige Reihenfolge für jede Station.",
  UNRESOLVED_STATION: "Mindestens eine Station enthält widersprüchliche Angaben. Prüfe insbesondere Zeitraum und Status.",
  INVALID_REFERENCE: "Wähle einen eigenen abgeschlossenen Degree mit dem Referenzstudiengang der Befragung.",
  INVALID_CATALOG: "Die Katalogauswahl ist ungültig. Ein neuer Eintrag benötigt einen Namen.",
  CONFIRMATION_REQUIRED: "Bestätige Referenzabschluss und Beitrag ausdrücklich.",
  SOURCE_TOO_LARGE: "Die geprüften Quelldaten und Zuordnungen sind zu groß (maximal 300.000 Bytes pro Speicheraufruf).",
};
const message = (code: string) => errors[code] ?? "Die Aktion konnte nicht abgeschlossen werden. Prüfe den lokalen Mapping-Server und versuche es erneut.";

export default function MappingEditor() {
  const [context, setContext] = useState<Context | null>(null);
  const [text, setText] = useState("");
  const [snapshot, setSnapshot] = useState<SnapshotProjection | null>(null);
  const [reviews, setReviews] = useState<ImportReview[]>([]);
  const [fixtureId, setFixtureId] = useState("fictional-member");
  const [candidate, setCandidate] = useState<string | null>(null);
  const [surveyId, setSurveyId] = useState("");
  const [reference, setReference] = useState("");
  const [referenceConfirmed, setReferenceConfirmed] = useState(false);
  const [contributionConfirmed, setContributionConfirmed] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ImportReceipt | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void fetch(endpoint, { cache: "no-store" }).then(async response => {
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (active) { setContext(data); setSurveyId(data.surveys[0]?.id ?? ""); }
    }).catch(() => { if (active) setError("Die separate Testdatenbank ist nicht verfügbar. Starte npm run dev:mapping und öffne http://localhost:3104/dev/mapping."); });
    return () => { active = false; };
  }, []);
  function invalidate() { setReferenceConfirmed(false); setContributionConfirmed(false); setSubmissionId(null); setReceipt(null); setError(null); }
  function resetSource() { invalidate(); setSnapshot(null); setReviews([]); setCandidate(null); setReference(""); }
  function load(value: unknown, hints?: ImportReview[], candidateSourceKey?: string | null) {
    resetSource();
    const next = readCareerSnapshot(value);
    setSnapshot(next); setText(JSON.stringify(next, null, 2)); setReviews(hints ?? suggestReviews(next)); setCandidate(candidateSourceKey ?? null);
  }
  function parse() {
    resetSource();
    try { if (text.length > 2_100_000) throw new Error(); load(JSON.parse(text)); }
    catch (failure) { setError(message(failure instanceof Error ? failure.message : "INVALID_SOURCE")); }
  }
  async function fixture() {
    resetSource(); setText(""); setBusy(true);
    try {
      const response = await fetch(`${endpoint}?fixture=${encodeURIComponent(fixtureId)}`, { cache: "no-store" });
      if (!response.ok) throw new Error();
      const data = await response.json(); load(data.snapshot, data.reviews, data.candidateSourceKey);
    } catch { setError("Die gewählte lokale Fixture konnte nicht geladen werden."); }
    finally { setBusy(false); }
  }
  function change(index: number, changes: Partial<ImportReview>) {
    invalidate(); setReference("");
    setReviews(current => current.map((review, i) => i === index ? { ...review, ...changes } : review));
  }
  const rows = snapshot ? sourceRows(snapshot) : [];
  const survey = context?.surveys.find(survey => survey.id === surveyId);
  let preview: ReturnType<typeof mapCareerImport> | null = null, previewError: string | null = null;
  if (snapshot) {
    try { preview = mapCareerImport(snapshot, reviews); }
    catch (failure) { previewError = message(failure instanceof Error ? failure.message : "INVALID_REVIEW"); }
  }
  const candidates = preview?.stations.filter(station => station.kind === "RESOLVED_DEGREE" && station.canonical.status === "COMPLETED" && station.canonical.programId === survey?.referenceProgramId) ?? [];
  async function save() {
    if (!snapshot || !preview || !referenceConfirmed || !contributionConfirmed || receipt) return;
    const id = submissionId ?? crypto.randomUUID(); setSubmissionId(id); setBusy(true); setError(null);
    try {
      const response = await fetch(endpoint, { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        submissionId: id, input: { snapshot, reviews, surveyId, referenceSourceKey: reference, referenceConfirmed, contributionConfirmed },
      }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.code);
      setReceipt(data.receipt);
    } catch (failure) { setError(message(failure instanceof Error ? failure.message : "SAVE_FAILED")); }
    finally { setBusy(false); }
  }
  return <main id="inhalt" tabIndex={-1} className={styles.root}>
    <a href="http://localhost:3100/dev/import">Zur LinkedIn-Vorschau (Port 3100)</a>
    <p className="eyebrow">Lokaler vertikaler Zwischentest</p>
    <h1>JSON auf das Datenbankschema abbilden</h1>
    <p>JSON → geprüfte Zuordnung → Degree und CareerStep → Timeline → bestätigte Befragungsteilnahme.</p>
    <p>Gespeichert wird ausschließlich in der separaten PostgreSQL-17-Testdatenbank. Strg+C am Mapping-Server entfernt diese Testdaten. Rohprofile, Tokens und Kontaktdaten werden nicht gespeichert.</p>
    {error && <p role="alert">{error}</p>}
    <fieldset disabled={busy} className={styles.form}>
      <legend className={styles.srOnly}>Mapping-Test</legend>
      <section aria-labelledby="source-heading">
        <h2 id="source-heading">1. Quelldaten laden</h2>
        <label htmlFor="mapping-fixture">Beispieldatensatz</label>
        <select id="mapping-fixture" value={fixtureId} onChange={event => setFixtureId(event.target.value)}>
          {(context?.fixtures ?? [{ id: "fictional-member", label: "Repository-Beispiel" }]).map(fixture => <option key={fixture.id} value={fixture.id}>{fixture.label}</option>)}
        </select>
        <button type="button" disabled={!context} onClick={fixture}>Beispiel laden</button>
        <p>Phase-D-Dateien bleiben lokal. Ihre Zuordnungen sind bearbeitbare Vorschläge; Abschlussstatus und Referenz werden nicht daraus bestätigt.</p>
        <label htmlFor="mapping-json">Snapshot-JSON oder rohe LinkedIn-Vorschau</label>
        <textarea id="mapping-json" rows={10} maxLength={2_100_001} value={text} spellCheck={false} autoComplete="off" onChange={event => { resetSource(); setText(event.target.value); }} />
        <p>Die JSON-Prüfung entfernt PROFILE, Kennungen und nicht benötigte Beschreibungen. Änderungen am JSON verwerfen sämtliche Zuordnungen und Bestätigungen.</p>
        <button type="button" disabled={!text} onClick={parse}>JSON zuordnen</button>{" "}
        <button type="button" onClick={() => { resetSource(); setText(""); }}>Entwurf leeren</button>
      </section>
      {snapshot && <>
        <section aria-labelledby="mapping-heading">
          <h2 id="mapping-heading">2. Zuordnungen prüfen</h2>
          <p>{rows.length} Quellstationen. Titel liefern Typvorschläge. Fehlende Enddaten bedeuten keinen bestätigten laufenden Status; ein Studienende beweist keinen Abschluss.</p>
          {reviews.map((review, index) => {
            const source = rows.find(row => row.sourceKey === review.sourceKey)!;
            const degree = review.classification.startsWith("DEGREE:");
            return <fieldset key={review.sourceKey} className={styles.station}>
              <legend>{source.title || "Station ohne Titel"}</legend>
              <p>{source.provider || "Anbieter unbekannt"} · {source.start || "Beginn unbekannt"} – {source.end || "Ende unbekannt"}{source.location ? ` · ${source.location}` : ""}</p>
              {candidate === review.sourceKey && <p>Referenzhinweis aus der Fixture. Bitte selbst prüfen und auswählen.</p>}
              <label htmlFor={`kind-${index}`}>Zieltyp</label>
              <select id={`kind-${index}`} value={review.classification} onChange={event => change(index, { classification: event.target.value, status: "UNKNOWN", catalog: "UNKNOWN" })}>
                <option value="">Bitte einordnen</option>{classificationChoices.map(choice => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
              </select>
              <label htmlFor={`status-${index}`}>Status</label>
              <select id={`status-${index}`} value={review.status} onChange={event => change(index, { status: event.target.value })}>
                {(degree ? degreeStatuses : careerStatuses).map(status => <option key={status.value} value={status.value}>{status.label}</option>)}
              </select>
              <label htmlFor={`position-${index}`}>Timeline-Position</label>
              <input id={`position-${index}`} type="number" min={1} step={1} value={review.position || ""} onChange={event => change(index, { position: Number(event.target.value) })} />
              <label htmlFor={`catalog-${index}`}>{degree ? "Studiengang oder Bildungseinrichtung" : "Organisation"}</label>
              <select id={`catalog-${index}`} value={review.catalog} onChange={event => change(index, { catalog: event.target.value })}>
                <option value="UNKNOWN">Unbekannt · keine Katalogzuordnung</option>
                {source.provider && <option value="CREATE">„{source.provider}“ als neuen {degree ? "Institution" : "Organisation"}-Eintrag übernehmen</option>}
                {degree ? <>
                  {context?.programs.map(row => <option key={row.id} value={`PROGRAM:${row.id}`}>Studiengang: {row.name} · {row.institution.name}</option>)}
                  {context?.institutions.map(row => <option key={row.id} value={`INSTITUTION:${row.id}`}>Institution: {row.name}</option>)}
                </> : context?.organisations.map(row => <option key={row.id} value={`ORGANISATION:${row.id}`}>{row.name}</option>)}
              </select>
            </fieldset>;
          })}
          {previewError && <p role="status">{previewError}</p>}
          {preview && <details><summary>Kanonische Datenbankvorschau anzeigen</summary><p>Jahre werden übernommen, Monate entfallen. Das Abschlussjahr bleibt unbekannt. Bei Status „Unbekannt“ bleibt das Endjahr leer. Ausgewählte neue Katalogeinträge erhalten beim Speichern neue UUIDs.</p><pre>{JSON.stringify(preview, null, 2)}</pre></details>}
        </section>
        <section aria-labelledby="save-heading">
          <h2 id="save-heading">3. Referenz und Beitrag bestätigen</h2>
          <label htmlFor="mapping-survey">Testbefragung</label>
          <select id="mapping-survey" value={surveyId} onChange={event => { invalidate(); setReference(""); setSurveyId(event.target.value); }}>
            <option value="">Bitte auswählen</option>{context?.surveys.map(survey => <option key={survey.id} value={survey.id}>{survey.name} · {survey.referenceProgram.name} · {survey.referenceProgram.institution.name}</option>)}
          </select>
          {survey && <p>Referenzstudiengang: <strong>{survey.referenceProgram.name}</strong> · {survey.referenceProgram.institution.name}</p>}
          <p>Der Referenzstudiengang ist durch diese Befragung festgelegt. Wähle bei der passenden akademischen Station diesen Studiengang und „Abgeschlossen“. Ein Institutionsname allein reicht nicht.</p>
          <label htmlFor="mapping-reference">Konkreter Referenzabschluss</label>
          <select id="mapping-reference" value={reference} onChange={event => { invalidate(); setReference(event.target.value); }}>
            <option value="">Noch nicht ausgewählt</option>{candidates.map(station => <option key={station.sourceKey} value={station.sourceKey}>{rows.find(row => row.sourceKey === station.sourceKey)?.title}</option>)}
          </select>
          <label className={styles.check}><input type="checkbox" checked={referenceConfirmed} disabled={!reference} onChange={event => setReferenceConfirmed(event.target.checked)} /> Diesen eigenen abgeschlossenen Degree bestätige ich als Bezug meiner Teilnahme.</label>
          <label className={styles.check}><input type="checkbox" checked={contributionConfirmed} onChange={event => setContributionConfirmed(event.target.checked)} /> Ich habe Typen, Status, Katalogzuordnungen und Reihenfolge geprüft und möchte diesen Beitrag in der Testdatenbank speichern.</label>
          <button type="button" disabled={!preview || !reference || !referenceConfirmed || !contributionConfirmed || !!receipt || !context} onClick={save}>In Testdatenbank speichern</button>
        </section>
      </>}
    </fieldset>
    {busy && <p role="status">Aktion wird ausgeführt.</p>}
    {receipt && <section aria-label="Speicherergebnis" role="status"><h2>In PostgreSQL gespeichert</h2><p>{receipt.degrees} Degrees · {receipt.careerSteps} CareerSteps · {receipt.timelineItems} Timeline-Einträge · 1 bestätigte SurveyResponse.</p><p>Profil-ID: <code>{receipt.alumniId}</code>. Kein AlumniContact angelegt.</p><p>Die Bestätigung erfolgt nach dem Commit. Erneutes Laden verwirft den Browserentwurf; gespeicherte Testprofile bleiben bis zum Beenden des Mapping-Servers erhalten.</p></section>}
  </main>;
}
