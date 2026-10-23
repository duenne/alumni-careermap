"use client";
import { useEffect, useRef, useState } from "react";
import { classificationChoices, degreeStatuses, careerStatuses } from "../../../lib/career-review/preview";
import { mapCareerImport, readCareerSnapshot, sourceRows, suggestReviews, suggestedReviewFields, type ImportReview } from "../../../lib/career-import/mapping";
import type { SnapshotProjection } from "../../../lib/dev-import/json-preview";
import type { ImportReceipt } from "../../../lib/career-import/service";
import type { SavedCareer, SavedCareerSummary } from "../../../lib/career-import/saved-career";
import { useLinkedInImport } from "./use-linkedin-import";
import SavedTimeline from "./saved-timeline";
import styles from "./mapping.module.css";

type CatalogRow = { id: string; name: string };
type Survey = CatalogRow & { referenceProgramId: string; referenceProgram: CatalogRow & { institution: CatalogRow } };
type Context = { surveys: Survey[]; institutions: CatalogRow[]; programs: (CatalogRow & { institution: { name: string } })[]; organisations: CatalogRow[]; fixtures: { id: string; label: string }[]; savedProfiles: SavedCareerSummary[]; storage: "PERSISTENT" | "TEMPORARY" };
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

export default function MappingEditor({ workflow = false }: { workflow?: boolean }) {
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
  const [savedProfile, setSavedProfile] = useState<SavedCareer | null>(null);
  const [selectedSaved, setSelectedSaved] = useState("");
  const [origin, setOrigin] = useState<"empty" | "linkedin" | "synthetic" | "custom">("empty");
  const linkedin = useLinkedInImport();
  const sequence = useRef(0);
  const manualChoices = useRef(new Set<string>());
  useEffect(() => {
    let active = true;
    void fetch(endpoint, { cache: "no-store" }).then(async response => {
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (active) { setContext(data); setSurveyId(data.surveys[0]?.id ?? ""); }
    }).catch(() => { if (active) setError(workflow ? "Die lokale Testdatenbank ist nicht erreichbar. Starte npm run db:workflow und anschließend npm run dev:workflow." : "Die separate Testdatenbank ist nicht verfügbar. Starte npm run dev:mapping und öffne http://localhost:3104/dev/mapping."); });
    return () => { active = false; };
  }, [workflow]);
  function invalidate() { setReferenceConfirmed(false); setContributionConfirmed(false); setSubmissionId(null); setReceipt(null); setSavedProfile(null); setSelectedSaved(""); setError(null); }
  function resetSource() { invalidate(); manualChoices.current.clear(); setSnapshot(null); setReviews([]); setCandidate(null); setReference(""); }
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
    const requestId = ++sequence.current; linkedin.cancel();
    resetSource(); setText(""); setOrigin("empty"); setBusy(true);
    try {
      if (workflow) await linkedin.disconnect();
      const response = await fetch(`${endpoint}?fixture=${encodeURIComponent(fixtureId)}`, { cache: "no-store" });
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (requestId === sequence.current) { load(data.snapshot, data.reviews, data.candidateSourceKey); setOrigin("synthetic"); }
    } catch { setError("Die gewählte lokale Fixture konnte nicht geladen werden."); }
    finally { setBusy(false); }
  }
  async function readLinkedIn() {
    const requestId = ++sequence.current;
    resetSource(); setText(""); setOrigin("empty"); setBusy(true);
    try {
      const data = await linkedin.read();
      if (requestId === sequence.current) { setText(JSON.stringify(data, null, 2)); setOrigin("linkedin"); }
    } catch { if (requestId === sequence.current) setError("LinkedIn-Daten konnten nicht geladen werden. Prüfe die Verbindungsanzeige."); }
    finally { if (requestId === sequence.current) setBusy(false); }
  }
  function editSource(sourceKey: string, field: string, value: string) {
    if (!snapshot) return;
    invalidate();
    const [, elementIndex, rowIndex] = sourceKey.split(":");
    const next = structuredClone(snapshot);
    next.elements[Number(elementIndex)].snapshotData[Number(rowIndex)][field] = value;
    const source = sourceRows(next).find(row => row.sourceKey === sourceKey)!;
    const previous = sourceRows(snapshot).find(row => row.sourceKey === sourceKey)!;
    setReviews(current => current.map(review => {
      if (review.sourceKey !== sourceKey) return review;
      const defaults = suggestedReviewFields(source, review.classification);
      const status = source.end !== previous.end && !manualChoices.current.has(`${sourceKey}:status`) ? defaults.status : review.status;
      const catalog = source.provider !== previous.provider && !manualChoices.current.has(`${sourceKey}:catalog`) ? defaults.catalog : review.catalog;
      return { ...review, status, catalog };
    }));
    setSnapshot(next); setText(JSON.stringify(next, null, 2));
  }
  async function showSaved(responseId: string) {
    setSelectedSaved(responseId); setSavedProfile(null); setError(null);
    if (!responseId) return;
    setBusy(true);
    try {
      const response = await fetch(`${endpoint}?saved=${encodeURIComponent(responseId)}`, { cache: "no-store" });
      if (!response.ok) throw new Error();
      setSavedProfile((await response.json()).profile);
    } catch { setError("Der gespeicherte Datensatz konnte nicht aus PostgreSQL geladen werden."); }
    finally { setBusy(false); }
  }
  function change(index: number, changes: Partial<ImportReview>, defaults = false) {
    invalidate();
    const review = reviews[index];
    for (const field of ["status", "catalog"] as const) {
      if (defaults) manualChoices.current.delete(`${review.sourceKey}:${field}`);
      else if (field in changes) manualChoices.current.add(`${review.sourceKey}:${field}`);
    }
    if (review.sourceKey === reference && ["classification", "status", "catalog"].some(field => field in changes && changes[field as keyof ImportReview] !== review[field as keyof ImportReview])) setReference("");
    setReviews(current => current.map((review, i) => i === index ? { ...review, ...changes } : review));
  }
  const rows = snapshot ? sourceRows(snapshot) : [];
  const survey = context?.surveys.find(survey => survey.id === surveyId);
  let preview: ReturnType<typeof mapCareerImport> | null = null, previewError: string | null = null;
  if (snapshot) {
    try { preview = mapCareerImport(readCareerSnapshot(snapshot), reviews); }
    catch (failure) { previewError = message(failure instanceof Error ? failure.message : "INVALID_REVIEW"); }
  }
  // A different unresolved station must not hide an otherwise eligible Degree.
  // Choosing it is the explicit association with this Survey's Program.
  const candidates = reviews.filter(review => review.classification.startsWith("DEGREE:") && review.status === "COMPLETED");
  const selectedReference = candidates.find(review => review.sourceKey === reference);
  const blockers: { message: string; target: string }[] = [];
  if (!survey) blockers.push({ message: "Wähle eine geöffnete Testbefragung.", target: "mapping-survey" });
  const missingTypes = reviews.flatMap((review, index) => !classificationChoices.some(choice => choice.value === review.classification)
    ? [{ message: `Wähle den Zieltyp für „${rows.find(row => row.sourceKey === review.sourceKey)?.title || "Station ohne Titel"}“.`, target: `kind-${index}` }] : []);
  blockers.push(...missingTypes);
  if (previewError && !missingTypes.length) blockers.push({ message: previewError, target: "mapping-heading" });
  if (!selectedReference) blockers.push({ message: candidates.length ? "Wähle deinen konkreten Referenzabschluss aus." : "Prüfe einen akademischen Abschluss und setze dessen Status auf „Abgeschlossen“.", target: "mapping-reference" });
  else if (selectedReference.catalog !== `PROGRAM:${survey?.referenceProgramId}`) blockers.push({ message: "Ordne den Referenzabschluss durch erneute Auswahl dem Referenzstudiengang zu.", target: "mapping-reference" });
  if (!referenceConfirmed) blockers.push({ message: "Bestätige den Referenzabschluss und seine Zuordnung zum Studiengang.", target: "mapping-reference-confirmed" });
  if (!contributionConfirmed) blockers.push({ message: "Bestätige die geprüften Angaben und das Speichern des Beitrags.", target: "mapping-contribution-confirmed" });
  async function save() {
    if (receipt) return;
    if (blockers.length) {
      setError("Bitte vervollständige die Punkte unter „Noch zu prüfen“.");
      const target = document.getElementById(blockers[0].target);
      target?.focus(); target?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    if (!snapshot || !preview || !referenceConfirmed || !contributionConfirmed) return;
    const id = submissionId ?? crypto.randomUUID(); setSubmissionId(id); setBusy(true); setError(null);
    try {
      const response = await fetch(endpoint, { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        submissionId: id, input: { snapshot, reviews, surveyId, referenceSourceKey: reference, referenceConfirmed, contributionConfirmed },
      }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.code);
      setReceipt(data.receipt); setSavedProfile(data.profile); setSelectedSaved(data.receipt.responseId);
      setContext(current => current ? { ...current, savedProfiles: [
        { responseId: data.profile.responseId, confirmedAt: data.profile.confirmedAt, stationCount: data.profile.stations.length },
        ...current.savedProfiles.filter(row => row.responseId !== data.profile.responseId),
      ] } : current);
    } catch (failure) { setError(message(failure instanceof Error ? failure.message : "SAVE_FAILED")); }
    finally { setBusy(false); }
  }
  return <main id="inhalt" tabIndex={-1} className={styles.root}>
    {!workflow && <a href="http://localhost:3100/dev/import">Zum vollständigen LinkedIn-Workflow</a>}
    <p className="eyebrow">Lokaler vertikaler Zwischentest</p>
    <h1>{workflow ? "Karriereweg importieren und speichern" : "JSON auf das Datenbankschema abbilden"}</h1>
    <p>JSON → geprüfte Zuordnung → Degree und CareerStep → Timeline → bestätigte Befragungsteilnahme.</p>
    <p>{context?.storage === "PERSISTENT" ? "PostgreSQL 17 ist verbunden. Gespeicherte Testprofile bleiben auch nach einem Serverneustart erhalten." : "Gespeichert wird ausschließlich in der separaten PostgreSQL-17-Testdatenbank. Strg+C am Mapping-Server entfernt diese Testdaten."} Rohprofile, Tokens und Kontaktdaten werden nicht gespeichert.</p>
    {error && <p role="alert">{error}</p>}
    <fieldset disabled={busy} className={styles.form}>
      <legend className={styles.srOnly}>Mapping-Test</legend>
      <section aria-labelledby="source-heading">
        <h2 id="source-heading">1. Quelldaten laden und ersetzen</h2>
        {workflow && <div className={styles.connection}>
          <h3>LinkedIn verbinden</h3>
          <p>{linkedin.connected ? "Mit LinkedIn verbunden." : linkedin.configured ? "LinkedIn ist konfiguriert. Du kannst dein Konto verbinden." : "Die LinkedIn-Konfiguration passt noch nicht zu dieser Browseradresse."}</p>
          <form method="post" action="/api/dev/import/linkedin/start" onSubmit={() => { ++sequence.current; linkedin.cancel(); resetSource(); setText(""); setOrigin("empty"); }}>
            <button type="submit" disabled={!linkedin.configured}>Mit LinkedIn verbinden</button>
          </form>
          <button type="button" onClick={readLinkedIn} disabled={!linkedin.connected}>Karrieredaten als JSON laden</button>
          <p>Abgerufen werden EDUCATION und POSITIONS. Die Portability-Freigabe ist umfassender. Zugangsdaten bleiben auf dem Server; der JSON-Entwurf bleibt bis zum Speichern im Browser.</p>
          {linkedin.error && <p role="alert">{linkedin.error}</p>}
        </div>}
        <label htmlFor="mapping-fixture">Beispieldatensatz</label>
        <select id="mapping-fixture" value={fixtureId} onChange={event => setFixtureId(event.target.value)}>
          {(context?.fixtures ?? [{ id: "fictional-member", label: "Repository-Beispiel" }]).map(fixture => <option key={fixture.id} value={fixture.id}>{fixture.label}</option>)}
        </select>
        <button type="button" disabled={!context} onClick={fixture}>{workflow ? "Durch synthetischen Datensatz ersetzen" : "Beispiel laden"}</button>
        <p>Phase-D-Dateien bleiben lokal. Ihre Zuordnungen sind bearbeitbare Vorschläge; Abschlussstatus und Referenz werden nicht daraus bestätigt.</p>
        <label htmlFor="mapping-json">Snapshot-JSON oder rohe LinkedIn-Vorschau</label>
        <textarea id="mapping-json" rows={10} maxLength={2_100_001} value={text} spellCheck={false} autoComplete="off" onChange={event => { ++sequence.current; linkedin.cancel(); resetSource(); setText(event.target.value); setOrigin(current => current === "linkedin" ? "linkedin" : "custom"); }} />
        <p role="status">{origin === "linkedin" ? "LinkedIn-Daten · noch nicht gespeichert" : origin === "synthetic" ? "Synthetischer Datensatz · bisherige LinkedIn-Daten vollständig ersetzt" : origin === "custom" ? "Bearbeitete JSON-Eingabe · noch nicht gespeichert" : "Noch keine Quelldaten geladen."}</p>
        <p>Die JSON-Prüfung entfernt PROFILE, Kennungen und nicht benötigte Beschreibungen. Änderungen am JSON verwerfen sämtliche Zuordnungen und Bestätigungen.</p>
        <button type="button" disabled={!text} onClick={parse}>JSON zuordnen</button>{" "}
        <button type="button" onClick={() => { ++sequence.current; linkedin.cancel(); resetSource(); setText(""); setOrigin("empty"); }}>Entwurf leeren</button>
      </section>
      {snapshot && <>
        <section aria-labelledby="mapping-heading">
          <h2 id="mapping-heading" tabIndex={-1}>2. Zuordnungen prüfen</h2>
          <p>{rows.length} Quellstationen. Status und Anbieter sind als Vorschläge vorbelegt: mit Enddatum „Abgeschlossen“ beim Studium beziehungsweise „Beendet“ bei Tätigkeiten. Prüfe diese Angaben vor dem Speichern; ein Studienende allein beweist keinen Abschluss.</p>
          {reviews.map((review, index) => {
            const source = rows.find(row => row.sourceKey === review.sourceKey)!;
            const degree = review.classification.startsWith("DEGREE:");
            return <fieldset key={review.sourceKey} className={styles.station}>
              <legend>{source.title || "Station ohne Titel"}</legend>
              <p>{source.provider || "Anbieter unbekannt"} · {source.start || "Beginn unbekannt"} – {source.end || "Ende unbekannt"}{source.location ? ` · ${source.location}` : ""}</p>
              {candidate === review.sourceKey && <p>Referenzhinweis aus der Fixture. Bitte selbst prüfen und auswählen.</p>}
              <details><summary>Quelldaten bearbeiten</summary>
                {[
                  [source.domain === "EDUCATION" ? "Degree Name" : "Title", "Bezeichnung"],
                  [source.domain === "EDUCATION" ? "School Name" : "Company Name", "Anbieter / Organisation"],
                  [source.domain === "EDUCATION" ? "Start Date" : "Started On", "Beginn"],
                  [source.domain === "EDUCATION" ? "End Date" : "Finished On", "Ende"],
                  ...(source.domain === "POSITIONS" ? [["Location", "Ort"]] : []),
                ].map(([field, label]) => {
                  const [, e, r] = source.sourceKey.split(":");
                  return <label key={field}>{label}<input value={snapshot.elements[Number(e)].snapshotData[Number(r)][field] ?? ""} maxLength={10_000} onChange={event => editSource(source.sourceKey, field, event.target.value)} /></label>;
                })}
              </details>
              <label htmlFor={`kind-${index}`}>Zieltyp</label>
              <select id={`kind-${index}`} value={review.classification} onChange={event => change(index, { classification: event.target.value, ...suggestedReviewFields(source, event.target.value) }, true)}>
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
          <p>Wähle den eigenen abgeschlossenen Degree, der zu diesem Referenzstudiengang gehört. Mit deiner Auswahl wird dieser Degree dem Studiengang zugeordnet. Prüfe und bestätige diese fachliche Passung ausdrücklich.</p>
          <label htmlFor="mapping-reference">Konkreter Referenzabschluss</label>
          <select id="mapping-reference" value={selectedReference ? reference : ""} onChange={event => {
            invalidate(); const sourceKey = event.target.value; setReference(sourceKey);
            if (sourceKey && survey) {
              manualChoices.current.add(`${sourceKey}:catalog`);
              setReviews(current => current.map(review => review.sourceKey === sourceKey ? { ...review, catalog: `PROGRAM:${survey.referenceProgramId}` } : review));
            }
          }}>
            <option value="">Noch nicht ausgewählt</option>{candidates.map(station => <option key={station.sourceKey} value={station.sourceKey}>{rows.find(row => row.sourceKey === station.sourceKey)?.title}</option>)}
          </select>
          <label className={styles.check}><input id="mapping-reference-confirmed" type="checkbox" checked={referenceConfirmed && !!selectedReference} disabled={!selectedReference} onChange={event => { setError(null); setReferenceConfirmed(event.target.checked); }} /> Diesen eigenen abgeschlossenen Degree bestätige ich als Bezug meiner Teilnahme und als passend zum Referenzstudiengang.</label>
          <label className={styles.check}><input id="mapping-contribution-confirmed" type="checkbox" checked={contributionConfirmed} onChange={event => { setError(null); setContributionConfirmed(event.target.checked); }} /> Ich habe Typen, Status, Katalogzuordnungen und Reihenfolge geprüft und möchte diesen Beitrag in der Testdatenbank speichern.</label>
          <div id="save-readiness" role="status" className={styles.readiness}>
            {receipt ? <p>Dieser Beitrag ist bereits gespeichert.</p> : blockers.length ? <><h3>Noch zu prüfen</h3><ul>{blockers.map((blocker, index) => <li key={`${blocker.target}-${index}`}><a href={`#${blocker.target}`}>{blocker.message}</a></li>)}</ul></> : <p>Alle Voraussetzungen erfüllt. Du kannst den Beitrag jetzt speichern.</p>}
          </div>
          <button type="button" disabled={!!receipt || !context} aria-describedby="save-readiness" onClick={save}>In Testdatenbank speichern</button>
        </section>
      </>}
    </fieldset>
    {busy && <p role="status">Aktion wird ausgeführt.</p>}
    {receipt && <section aria-label="Speicherergebnis" role="status"><h2>In PostgreSQL gespeichert</h2><p>{receipt.degrees} Degrees · {receipt.careerSteps} CareerSteps · {receipt.timelineItems} Timeline-Einträge · 1 bestätigte SurveyResponse.</p><p>Profil-ID: <code>{receipt.alumniId}</code>. Kein AlumniContact angelegt.</p><p>Die Bestätigung erfolgt nach dem Commit. Die folgende Timeline wurde aus der Datenbank zurückgelesen.</p></section>}
    {!!context?.savedProfiles.length && <section aria-labelledby="saved-selection-heading" className={styles.savedSelection}>
      <h2 id="saved-selection-heading">4. Gespeicherten Datensatz ansehen</h2>
      <label htmlFor="saved-profile">Gespeicherte Testprofile ({context.savedProfiles.length})</label>
      <select id="saved-profile" disabled={busy} value={selectedSaved} onChange={event => { void showSaved(event.target.value); }}>
        <option value="">Datensatz auswählen</option>{context.savedProfiles.map(row => <option key={row.responseId} value={row.responseId}>{new Date(row.confirmedAt).toLocaleString("de-DE")} · {row.stationCount} Stationen · {row.responseId.slice(0,8)}</option>)}
      </select>
    </section>}
    {savedProfile && <SavedTimeline profile={savedProfile} />}
  </main>;
}
