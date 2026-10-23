"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { parseEditor, type EditorPreview } from "../../../lib/dev-import/json-preview";
import { portabilityMessage, snapshotDiagnosticLabel } from "../../../lib/dev-import/linkedin/errors";
import CareerTimeline from "../../review/career-timeline";
import styles from "./import.module.css";

type ValidPreview = Extract<EditorPreview, { ok: true }>;
type Session = {
  json: string;
  origin: "empty" | "custom" | "synthetic" | "linkedin";
  validated: ValidPreview | null;
  showTimeline: boolean;
  error: string | null;
  reviewSourceKey?: string;
  raw?: boolean;
};
const emptySession = (): Session => ({ json: "", origin: "empty", validated: null, showTimeline: false, error: null });
type Connection = { configured: boolean; connected: boolean; configurationIssue: "NOT_CONFIGURED" | "ORIGIN_MISMATCH" | null };

export default function ImportEditor() {
  const [session, setSession] = useState<Session>(emptySession);
  const [loading, setLoading] = useState(false);
  const [fixtureId, setFixtureId] = useState("fictional-member");
  const [connection, setConnection] = useState<Connection>({ configured: false, connected: false, configurationIssue: null });
  const [connectionLoading, setConnectionLoading] = useState(true);
  const [reading, setReading] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [snapshotDiagnostic, setSnapshotDiagnostic] = useState<string | null>(null);
  const snapshotRequest = useRef<AbortController | null>(null);
  const callbackOutcome = useRef<string | null | undefined>(undefined);
  const sequence = useRef(0);
  const editor = useRef<HTMLTextAreaElement>(null);
  const previewHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let active = true;
    // Retain the safe result across React's development effect replay.
    if (callbackOutcome.current === undefined) callbackOutcome.current = new URLSearchParams(window.location.search).get("linkedin");
    const outcome = callbackOutcome.current;
    // Keep only a safe result label long enough to display its mapped message.
    if (outcome) window.history.replaceState(null, "", window.location.pathname);
    void (async () => {
      try {
        const response = await fetch("/api/dev/import/linkedin/status", { cache: "no-store" });
        if (!response.ok) throw new Error();
        const status = await response.json();
        if (active) {
          setConnection({ configured: status.configured === true, connected: status.connected === true,
            configurationIssue: status.configured === true ? null : status.configurationIssue === "ORIGIN_MISMATCH" ? "ORIGIN_MISMATCH" : "NOT_CONFIGURED" });
          if (outcome && outcome !== "connected") setConnectionError(portabilityMessage(outcome));
        }
      } catch {
        if (active) setConnectionError("Der lokale LinkedIn-Verbindungsstatus konnte nicht geladen werden.");
      } finally { if (active) setConnectionLoading(false); }
    })();
    return () => { active = false; snapshotRequest.current?.abort(); };
  }, []);

  async function disconnect() {
    if (!connection.connected) return;
    const response = await fetch("/api/dev/import/linkedin/disconnect", { method: "POST", cache: "no-store" });
    if (!response.ok) throw new Error();
    setConnection(current => ({ ...current, connected: false }));
  }
  async function fetchSnapshot(raw = false) {
    const requestId = ++sequence.current;
    snapshotRequest.current?.abort();
    const controller = new AbortController();
    snapshotRequest.current = controller;
    setSession(emptySession()); setConnectionError(null); setSnapshotDiagnostic(null); setReading(true);
    try {
      const response = await fetch(`/api/dev/import/linkedin/${raw ? "raw-snapshot" : "snapshot"}`, { method: "POST", cache: "no-store", signal: controller.signal });
      const data = await response.json();
      if (requestId !== sequence.current) return;
      if (!response.ok || response.status === 202) {
        setConnectionError(portabilityMessage(data.code));
        setSnapshotDiagnostic(snapshotDiagnosticLabel(data.diagnostic));
        if (response.status === 401 || response.status === 403) setConnection(current => ({ ...current, connected: false }));
        return;
      }
      if (raw) {
        if (data.source !== "linkedin-raw" || data.dump?.kind !== "linkedin-raw-preview" || data.dump.complete !== false) throw new Error();
        setSession({ ...emptySession(), json: JSON.stringify(data.dump, null, 2), origin: "linkedin", raw: true });
        return;
      }
      const result = parseEditor(JSON.stringify(data.snapshot));
      if (data.source !== "linkedin" || !result.ok) throw new Error();
      setSession({ json: result.json, origin: "linkedin", validated: result, showTimeline: false, error: null });
    } catch {
      if (requestId === sequence.current) setConnectionError(portabilityMessage("PROVIDER_UNAVAILABLE"));
    } finally { if (requestId === sequence.current) setReading(false); }
  }

  function edit(json: string) {
    sequence.current++;
    snapshotRequest.current?.abort(); setReading(false);
    setLoading(false);
    // Editing a live projection must never relabel it as synthetic input.
    setSession(current => ({ ...emptySession(), json, origin: current.origin === "linkedin" ? "linkedin" : "custom" }));
  }
  function validate() {
    if (session.raw) return;
    const result = parseEditor(session.json);
    if (!result.ok) {
      setSession(current => ({ ...current, validated: null, showTimeline: false, error: result.message }));
      editor.current?.focus();
      return;
    }
    setSession(current => ({ ...current, json: result.json, validated: result, showTimeline: false, error: null }));
  }
  async function replace() {
    const requestId = ++sequence.current;
    snapshotRequest.current?.abort(); setReading(false); setConnectionError(null); setSnapshotDiagnostic(null);
    // Clear the entire previous input/review before even waiting for the fixture.
    setSession(emptySession());
    setLoading(true);
    try {
      await disconnect();
      const response = await fetch(`/api/dev/import/fixture?id=${encodeURIComponent(fixtureId)}`, { cache: "no-store" });
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (data.fixtureId !== fixtureId) throw new Error();
      const result = parseEditor(JSON.stringify(data.snapshot));
      if (!result.ok) throw new Error();
      if (requestId === sequence.current) {
        const reviewSourceKey = typeof data.reviewSourceKey === "string" && result.input.stations.some(station => station.key === data.reviewSourceKey)
          ? data.reviewSourceKey : undefined;
        setSession({ json: result.json, origin: "synthetic", validated: result, showTimeline: false, error: null, reviewSourceKey });
      }
    } catch {
      if (requestId === sequence.current) setSession({ ...emptySession(), error: "Synthetische Testdaten konnten nicht geladen werden." });
    } finally {
      if (requestId === sequence.current) setLoading(false);
    }
  }

  async function clear() {
    sequence.current++; snapshotRequest.current?.abort(); setReading(false);
    setLoading(false); setSession(emptySession()); setSnapshotDiagnostic(null);
    try { await disconnect(); }
    catch { setConnectionError("Die Vorschau ist geleert. Die lokale Verbindung konnte nicht beendet werden; bitte den Entwicklungsserver neu starten."); }
  }

  return <main id="inhalt" tabIndex={-1}>
    <Link href="/">Zur Startseite</Link>
    <p className="eyebrow">Lokale Entwicklungsansicht · LinkedIn-Testimport</p>
    <h1>LinkedIn-Testimport</h1>
    <p>Temporäre Vorschau ohne Datenspende. Hier werden keine Profile gespeichert.</p>
    <p>Weiterer Entwicklungsschritt: <a href="http://localhost:3104/dev/mapping">JSON auf das Datenbankschema abbilden</a> (separater Server mit <code>npm run dev:mapping</code>).</p>
    <section aria-labelledby="source-heading" className={styles.section}>
      <h2 id="source-heading">LinkedIn-Datenquelle</h2>
      <p>{connectionLoading ? "Verbindungsstatus wird geprüft." : connection.connected ? "Mit LinkedIn verbunden · nur temporär auf diesem Entwicklungsserver." : connection.configured ? "HM CareerMap ist lokal konfiguriert. Noch nicht verbunden." : connection.configurationIssue === "ORIGIN_MISMATCH" ? "Diese Browseradresse passt nicht zur konfigurierten Callback-URL." : "LinkedIn-Konfiguration fehlt oder ist ungültig."}</p>
      {!connectionLoading && !connection.configured && <>
        <p>Für die registrierte HM-CareerMap-App öffnen Sie <a href="http://localhost:3100/dev/import">http://localhost:3100/dev/import</a>. Verwenden Sie denselben Host und Port wie in der Callback-URL.</p>
        {connection.configurationIssue !== "ORIGIN_MISMATCH" && <details>
          <summary>Lokale Einrichtung anzeigen</summary>
          <p>In der privaten <code>.env.local</code> im Repository-Verzeichnis müssen diese Einstellungen stehen:</p>
          <ul>
            <li><code>CAREERMAP_DEV_IMPORT=1</code></li>
            <li><code>LINKEDIN_PORTABILITY_MODE=third_party</code></li>
            <li><code>LINKEDIN_PORTABILITY_SCOPE=r_dma_portability_3rd_party</code></li>
            <li><code>LINKEDIN_REDIRECT_URI=http://localhost:3100/auth/linkedin/portability/callback</code></li>
          </ul>
          <p>Außerdem die eigenen App-Werte für <code>LINKEDIN_CLIENT_ID</code> und <code>LINKEDIN_CLIENT_SECRET</code> ausschließlich lokal eintragen. Keine Werte in Chat oder Screenshots übernehmen.</p>
          <p>Danach den Entwicklungsserver neu starten: <code>npm run dev:import</code>, anschließend die Seite neu laden.</p>
        </details>}
      </>}
      <p>Die Freigabe nutzt das Third-Party-Produkt. Abgerufen werden ausschließlich EDUCATION und POSITIONS; die angefragte Portability-Berechtigung ist umfassender. Echte Daten bleiben eine temporäre JSON-Vorschau.</p>
      <div className={styles.actions}>
        <form method="post" action="/api/dev/import/linkedin/start" onSubmit={() => { sequence.current++; snapshotRequest.current?.abort(); setSession(emptySession()); }}>
          <button type="submit" disabled={!connection.configured || connectionLoading || reading || loading}>Mit LinkedIn verbinden</button>
        </form>
        <button type="button" onClick={() => fetchSnapshot()} disabled={!connection.connected || reading || loading}>Karrieredaten abrufen</button>
        <button type="button" onClick={() => fetchSnapshot(true)} disabled={!connection.connected || reading || loading}>Rohe API-Antworten abrufen</button>
      </div>
      <p>Rohabruf: höchstens zwei Antworten je Domäne einschließlich HTTP-Fehlern, ohne Konvertierung. Die begrenzte Diagnosevorschau ist kein vollständiger Import. Nur vorübergehend ansehen; nicht exportieren oder in Screenshots, Logs oder Testdateien übernehmen.</p>
      {reading && <p role="status">EDUCATION und POSITIONS werden abgerufen.</p>}
      {connectionError && <p role="alert">{connectionError}</p>}
      {snapshotDiagnostic && <p>{snapshotDiagnostic}</p>}
    </section>
    <section aria-labelledby="json-heading" className={styles.section}>
      <h2 id="json-heading">JSON-Editor</h2>
      <p id="json-hint">Nur Arbeitsspeicher dieser Seite. Keine Übertragung der Eingabe an den Server, kein automatisches Speichern. Neu laden verwirft den Entwurf. {session.raw ? "Rohantworten enthalten persönliche Quellfelder und werden nur zur lokalen Diagnose angezeigt. Zugangsdaten und Header-Echos sind entfernt." : "PROFILE bleibt nach Prüfung leer; nicht benötigte Felder werden entfernt."}</p>
      <label htmlFor="career-json">Temporäres Karriere-JSON</label>
      <textarea id="career-json" ref={editor} value={session.json} onChange={event => edit(event.target.value)}
        rows={15} readOnly={!!session.raw} maxLength={session.raw ? undefined : 200_001} spellCheck={false} autoComplete="off" autoCorrect="off" autoCapitalize="off"
        aria-invalid={!!session.error} aria-describedby={session.error ? "json-hint json-error" : "json-hint"} />
      {session.error && <p id="json-error" role="alert">{session.error}</p>}
      <div className={styles.actions}>
        <button type="button" onClick={validate} disabled={loading || !session.json || session.raw}>JSON prüfen</button>
        <button type="button" onClick={clear}>Vorschau leeren</button>
      </div>
      <label htmlFor="synthetic-fixture">Synthetischer Datensatz</label>
      <select id="synthetic-fixture" value={fixtureId} disabled={loading} onChange={event => setFixtureId(event.target.value)}>
        <option value="fictional-member">Fiktiver LinkedIn-Snapshot · 2 Ausbildungs- und 2 Berufsangaben</option>
      </select>
      <p>„Synthetische Testdaten verwenden“ ersetzt den Editor und verwirft die bisherige Karriereansicht samt Entscheidungen.</p>
      <button type="button" onClick={replace} disabled={loading || connectionLoading}>Synthetische Testdaten verwenden</button>
      <p role="status">{loading ? "Synthetische Testdaten werden geladen." : session.origin === "synthetic"
        ? "Synthetische Testdaten" : session.origin === "linkedin" ? "LinkedIn-Daten – nur temporäre Vorschau" : session.origin === "custom" ? "Eigene JSON-Eingabe – nur temporäre Vorschau" : "Noch keine Daten geladen."}</p>
      {session.raw && <p>Rohantworten · unvollständige Diagnosevorschau · ohne Konvertierung</p>}
      {session.validated && <>
        <p>{session.validated.counts.education} Ausbildungsangaben · {session.validated.counts.positions} Berufsangaben</p>
        <p>{session.validated.result.stations.length} Quellangaben geprüft. Ihre fachliche Einordnung bleibt offen.</p>
      </>}
      {session.origin === "custom" && <p>Die Herkunft eigener oder bearbeiteter Eingaben ist ungeklärt. JSON-Prüfung ist möglich; für die Karriereansicht laden Sie die synthetische Fixture erneut.</p>}
      {session.origin === "linkedin" && <p>Auch bearbeitete LinkedIn-Daten bleiben für die Karriereansicht gesperrt. Ersetzen Sie sie zuerst vollständig durch die synthetische Fixture.</p>}
      <button type="button" onClick={() => { if (session.origin !== "synthetic") return; setSession(current => ({ ...current, showTimeline: true })); requestAnimationFrame(() => previewHeading.current?.focus()); }} disabled={!session.validated || loading || session.origin !== "synthetic"}>In Karriereansicht übernehmen</button>
    </section>
    {session.showTimeline && session.validated && <section aria-labelledby="preview-heading" className={styles.section}>
      <h2 id="preview-heading" ref={previewHeading} tabIndex={-1}>Temporäre Karriereansicht</h2>
      <p>Referenzabschluss: Noch nicht ausgewählt.</p>
      <p>Prüfen Sie die Quellangaben und die Reihenfolge. Referenzauswahl und Datenspende sind hier nicht verfügbar.</p>
      {session.origin === "custom" && <p>Die feste Degree-Prüfung des Beispiels wird für eigene Eingaben nicht automatisch zugeordnet. Die zeitliche Einordnung bleibt verfügbar.</p>}
      <CareerTimeline input={session.validated.input} reviewSourceKey={session.reviewSourceKey} />
    </section>}
  </main>;
}
