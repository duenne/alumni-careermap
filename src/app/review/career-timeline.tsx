"use client";

import { useEffect, useRef, useState } from "react";
import type { NormalizationInput, SourceFact } from "../../lib/normalization/contract";
import { ObservedDate } from "../observed-stations";
import DegreeReview from "./degree-review";
import { applyDegreeReviewDraft, applyTimelineOrder, reviewDegreeDraft, type DegreeReviewApplication, type DegreeReviewDraft, type ReviewedDegreeSelection } from "./degree-review-draft";
import { hasStructuredStart, proposeDisplayOrder } from "./timeline-order";
import styles from "./career-timeline.module.css";

const blankDraft: DegreeReviewDraft = { classification: "", level: "", status: "" };
const observedText = (fact: SourceFact<string>, fallback: string) => fact.kind === "OBSERVED" ? fact.value : fallback;
type Props = { input: NormalizationInput; reviewSourceKey?: string };
type ReviewError = Extract<DegreeReviewApplication, { ok: false }>;

export default function CareerTimeline(props: Props) {
  // Local context guard only; keys establish no persistent identity or provenance.
  return <TimelineSession key={JSON.stringify(props)} {...props} />;
}
function TimelineSession({ input, reviewSourceKey }: Props) {
  const [original] = useState(() => structuredClone(input));
  const [order, setOrder] = useState(() => proposeDisplayOrder(original));
  const [confirmedOrder, setConfirmedOrder] = useState<string[] | null>(null);
  const [draft, setDraft] = useState<DegreeReviewDraft>(blankDraft);
  const [reviewed, setReviewed] = useState<ReviewedDegreeSelection | null>(null);
  const [applied, setApplied] = useState<Extract<DegreeReviewApplication, { ok: true }> | null>(null);
  const [error, setError] = useState<ReviewError | null>(null);
  const [announcement, setAnnouncement] = useState("Reihenfolge vorgeschlagen, noch nicht übernommen. Alle Angaben bleiben zu prüfen.");
  const [movement, setMovement] = useState<{ key: string; direction: "up" | "down" } | null>(null);
  const [placements, setPlacements] = useState<Record<string, string>>({});
  const [placementError, setPlacementError] = useState<string | null>(null);
  const [activeStationKey, setActiveStationKey] = useState<string | null>(null);
  const triggerRefs = useRef(new Map<string, HTMLButtonElement>());
  const detailRefs = useRef(new Map<string, HTMLHeadingElement>());
  const focusOnOpen = useRef(false);
  const unplaced = original.stations.filter(source => !order.includes(source.key));
  const moveRefs = useRef(new Map<string, HTMLButtonElement>());
  const stationRefs = useRef(new Map<string, HTMLHeadingElement>());
  const placementRefs = useRef(new Map<string, HTMLSelectElement>());
  const headingRef = useRef<HTMLHeadingElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (activeStationKey && focusOnOpen.current) detailRefs.current.get(activeStationKey)?.focus();
    focusOnOpen.current = false;
  }, [activeStationKey]);
  useEffect(() => {
    if (!movement) return;
    const preferred = moveRefs.current.get(`${movement.key}:${movement.direction}`);
    const fallback = moveRefs.current.get(`${movement.key}:${movement.direction === "up" ? "down" : "up"}`);
    if (preferred && !preferred.disabled) preferred.focus(); else if (fallback && !fallback.disabled) fallback.focus(); else stationRefs.current.get(movement.key)?.focus();
  }, [movement]);
  useEffect(() => {
    if (error?.field === "order") confirmRef.current?.focus();
  }, [error]);

  function close(key: string) {
    focusOnOpen.current = false; setActiveStationKey(null); triggerRefs.current.get(key)?.focus();
  }
  function toggle(key: string) {
    if (activeStationKey === key) { close(key); return; }
    focusOnOpen.current = true; setActiveStationKey(key);
  }
  function move(key: string, direction: "up" | "down") {
    const index = order.indexOf(key), target = index + (direction === "up" ? -1 : 1);
    if (index < 0 || target < 0 || target >= order.length) return;
    const next = [...order]; [next[index], next[target]] = [next[target], next[index]];
    setOrder(next); setConfirmedOrder(null); setApplied(null); setError(null); setMovement({ key, direction });
    const source = original.stations.find(station => station.key === key)!;
    setAnnouncement(`${observedText(source.title, "Station")} verschoben. Bitte übernehmen Sie die Reihenfolge erneut.`);
  }
  function confirm() {
    if (unplaced.length) return;
    if (reviewed && reviewSourceKey) {
      setActiveStationKey(reviewSourceKey);
      const application = applyDegreeReviewDraft(original, reviewSourceKey, { classification: "degree", ...reviewed }, order);
      if (!application.ok) { setError({ ...application, field: "order" }); setConfirmedOrder(null); setApplied(null); return; }
      setConfirmedOrder([...order]); setError(null); setApplied(application); announceApplication(application); return;
    }
    const application = applyTimelineOrder(original, order);
    if (!application.ok) { setError({ ...application, field: "order" }); setConfirmedOrder(null); setApplied(null); return; }
    setConfirmedOrder([...order]); setError(null);
    setAnnouncement("Reihenfolge für den Entwurf übernommen. Die Einordnung der Stationen bleibt zu prüfen.");
  }
  function change(field: keyof DegreeReviewDraft, value: string) {
    if (reviewed) setAnnouncement("Entwurf geändert. Bitte wenden Sie die Einordnung erneut ausdrücklich an.");
    setDraft(current => ({ ...current, [field]: value })); setReviewed(null); setApplied(null); setError(null);
  }
  function submit() {
    if (!reviewSourceKey) return;
    const review = reviewDegreeDraft(draft);
    if (!review.ok) { setError(review); setReviewed(null); setApplied(null); return; }
    setReviewed(review.selection); setError(null);
    if (confirmedOrder === null) {
      setApplied(null); setAnnouncement("Im Entwurf geprüft. Reihenfolge noch offen; noch kein normalisierter Abschluss."); return;
    }
    const application = applyDegreeReviewDraft(original, reviewSourceKey, draft, confirmedOrder);
    if (!application.ok) { setError(application); setApplied(null); return; }
    setApplied(application); announceApplication(application);
  }
  function announceApplication(application: Extract<DegreeReviewApplication, { ok: true }>) {
    const resolved = application.result.stations.find(station => station.sourceKey === reviewSourceKey)?.kind === "RESOLVED_DEGREE";
    const remaining = application.result.stations.filter(station => station.sourceKey !== reviewSourceKey && station.kind === "REVIEW_REQUIRED").length;
    setAnnouncement(`${resolved ? "Eine Angabe wurde normalisiert." : "Weitere Angaben nötig."} ${remaining} weitere Angaben bleiben ungeprüft.`);
  }
  function reset() {
    setActiveStationKey(null); focusOnOpen.current = false;
    setOrder(proposeDisplayOrder(original)); setConfirmedOrder(null); setDraft(blankDraft); setReviewed(null); setApplied(null); setError(null); setMovement(null); setPlacements({}); setPlacementError(null);
    setAnnouncement("Entwurf zurückgesetzt. Reihenfolge und alle Stationen bleiben zu prüfen."); headingRef.current?.focus();
  }
  function place(key: string) {
    const choice = placements[key] ?? "", match = /^(before|after):([0-9]+)$/.exec(choice);
    const anchor = match ? original.stations[Number(match[2])]?.key : undefined;
    const anchorIndex = anchor ? order.indexOf(anchor) : -1;
    const validPlacement = choice === "start" && order.length === 0 || match !== null && anchorIndex >= 0;
    if (!unplaced.some(source => source.key === key) || !validPlacement) {
      setPlacementError(key); setError(null); placementRefs.current.get(key)?.focus(); return;
    }
    const index = order.length === 0 ? 0 : anchorIndex + (match?.[1] === "after" ? 1 : 0);
    const next = [...order]; next.splice(index, 0, key);
    setOrder(next); setPlacements(current => ({ ...current, [key]: "" })); setPlacementError(null); setError(null); setConfirmedOrder(null); setApplied(null);
    setMovement({ key, direction: "up" });
    setAnnouncement("Station manuell im Entwurf platziert. Ihr Zeitpunkt bleibt unklar. Bitte prüfen Sie die Reihenfolge.");
  }
  function station(key: string, index: number, isUnplaced: boolean) {
    const sourceIndex = original.stations.findIndex(source => source.key === key);
    const source = original.stations[sourceIndex], title = observedText(source.title, "Bezeichnung nicht angegeben");
    const category = observedText(source.category, "");
    const outcome = applied?.result.stations.find(station => station.sourceKey === key);
    const resolved = outcome?.kind === "RESOLVED_DEGREE";
    const stateLabel = resolved ? (outcome.unresolved.length > 0 ? "Teilweise normalisiert" : "Normalisiert") : key === reviewSourceKey && outcome ? "Weitere Angaben nötig" : key === reviewSourceKey && reviewed ? "Im Entwurf geprüft" : "Zu prüfen";
    const active = activeStationKey === key;
    const action = key === reviewSourceKey ? "Prüfen" : isUnplaced ? "Zeitlich einordnen" : "Details anzeigen";
    return <li key={key}>
      <article className={styles.station} aria-labelledby={`station-${sourceIndex}-title`}>
        <div className={styles.top}><span>{category === "EDUCATION" ? "Ausbildungsangabe" : category === "POSITIONS" ? "Positionsangabe" : "Quellangabe"}</span><span className={resolved ? styles.reviewed : styles.pending}>{stateLabel}</span></div>
        <section aria-label="Beobachtete Quellangaben" className={styles.facts}>
          <p className={styles.period}><ObservedDate fact={source.start} label="Beginn" /> – <ObservedDate fact={source.end} label="Ende" /></p>
          <h3 id={`station-${sourceIndex}-title`} ref={element => { if (element) stationRefs.current.set(key, element); else stationRefs.current.delete(key); }} tabIndex={-1}>{title}</h3>
          <p>{observedText(source.providerLabel, "Organisation nicht angegeben")}</p>
        </section>
        {!hasStructuredStart(source) && <p className={styles.uncertainty}>Zeitliche Einordnung unbekannt.{!isUnplaced && " Manuell im Entwurf platziert; der Zeitpunkt bleibt unklar."}</p>}
        {!isUnplaced && confirmedOrder && <p className={styles.source}>{`Entwurfsplatz ${index + 1}`}</p>}
        <div className={styles.rowActions}>
          <button type="button" ref={element => { if (element) triggerRefs.current.set(key, element); else triggerRefs.current.delete(key); }} onClick={() => toggle(key)} aria-label={`${action}: ${title}`} aria-expanded={active} aria-controls={`station-${sourceIndex}-details`}>{action}</button>
          {!isUnplaced && <div className={styles.moves} role="group" aria-label={`${title}: Reihenfolge ändern`}>
            {(["up", "down"] as const).map(direction => <button key={direction} type="button" ref={element => { if (element) moveRefs.current.set(`${key}:${direction}`, element); else moveRefs.current.delete(`${key}:${direction}`); }} onClick={() => move(key, direction)} disabled={direction === "up" ? index === 0 : index === order.length - 1} aria-label={`${title} nach ${direction === "up" ? "oben" : "unten"} verschieben`} aria-describedby="move-hint" title={direction === "up" ? "Nach oben" : "Nach unten"}>{direction === "up" ? <>&uarr;</> : <>&darr;</>}</button>)}
          </div>}
        </div>
        <div id={`station-${sourceIndex}-details`} data-station-details hidden={!active} className={styles.details}>
        {active && <>
          <h4 ref={element => { if (element) detailRefs.current.set(key, element); else detailRefs.current.delete(key); }} tabIndex={-1}>Angaben zu dieser Station</h4>
          <dl className={styles.dateDetails}><div><dt>Beginn laut Quelle</dt><dd><ObservedDate fact={source.start} label="Beginn" /></dd></div><div><dt>Ende laut Quelle</dt><dd><ObservedDate fact={source.end} label="Ende" /></dd></div></dl>
          {isUnplaced && <div className={styles.placement}>
          <label htmlFor={`placement-${sourceIndex}`}>Platzierung für {title}</label>
          <p id={`placement-hint-${sourceIndex}`}>Wählen Sie einen Platz im Entwurf. Die Zeitangaben aus der Quelle bleiben unverändert.</p>
          <select id={`placement-${sourceIndex}`} ref={element => { if (element) placementRefs.current.set(key, element); else placementRefs.current.delete(key); }} value={placements[key] ?? ""} onChange={event => { setPlacements(current => ({ ...current, [key]: event.target.value })); setPlacementError(null); setError(null); }} aria-invalid={placementError === key || undefined} aria-describedby={`${placementError === key ? `placement-error-${sourceIndex}` : `placement-hint-${sourceIndex}`}${error?.field === "order" ? " order-error" : ""}`}>
            <option value="">Bitte Platzierung auswählen</option>
            {order.length === 0 && <option value="start">Als erste Station im Entwurf</option>}
            {order.flatMap(anchorKey => {
              const anchorIndex = original.stations.findIndex(source => source.key === anchorKey);
              const anchorTitle = observedText(original.stations[anchorIndex].title, "Bezeichnung nicht angegeben");
              return [<option key={`before:${anchorKey}`} value={`before:${anchorIndex}`}>Vor {anchorTitle}</option>, <option key={`after:${anchorKey}`} value={`after:${anchorIndex}`}>Nach {anchorTitle}</option>];
            })}
          </select>
          {placementError === key && <p role="alert" id={`placement-error-${sourceIndex}`} className={styles.error}>Bitte wählen Sie eine Platzierung im Entwurf.</p>}
          <button type="button" onClick={() => place(key)} aria-label={`${title} in den Entwurf einordnen`}>In den Entwurf einordnen</button>
          </div>}
        {key === reviewSourceKey ? <DegreeReview draft={draft} reviewed={reviewed} applied={applied} outcome={outcome} error={error} orderConfirmed={confirmedOrder !== null} onChange={change} onSubmit={submit} />
          : <p className={styles.later}>Diese Station bleibt zu prüfen. Ihre Einordnung folgt in einem späteren Schritt.</p>}
          <button type="button" onClick={() => close(key)} aria-label={`Schließen: ${title}`} className={styles.close}>Schließen</button>
        </>}
        </div>
      </article>
    </li>;
  }
  if (!original.stations.length) return <p>Keine Stationsangaben vorhanden.</p>;
  return (
    <div className={styles.timeline}>
      <section aria-labelledby="timeline-heading">
        <h2 id="timeline-heading" ref={headingRef} tabIndex={-1}>Zeitliche Übersicht</h2>
        <p id="order-hint">Der Vorschlag nutzt eindeutige Anfangsdaten aus der Quelle und ist keine bestätigte zeitliche Reihenfolge. Stationen können gleichzeitig stattfinden. Ohne eindeutigen Beginn bleibt eine Station zunächst separat.</p>
        <p className={styles.demo}>Nur Demo – nichts gespeichert</p>
        <p id="move-hint" className={styles.source}>Verschieben ordnet nur den Entwurf. Überschneidungen bleiben möglich.</p>
        {order.length === 0 && <p>Noch keine Station im Entwurf platziert.</p>}
        <ol className={styles.list} aria-label="Karriere-Stationen im Entwurf">{order.map((key, index) => station(key, index, false))}</ol>
      </section>
      {unplaced.length > 0 && <section className={styles.unplaced} aria-labelledby="unplaced-heading">
        <h2 id="unplaced-heading">Zeitlich noch einzuordnen</h2>
        <p>Diese Angaben stehen außerhalb der vorgeschlagenen Reihenfolge. Eine ungenaue oder fehlende Zeitangabe sagt nicht, dass die Station später stattfand.</p>
        <ul className={styles.list} aria-label="Zeitlich noch einzuordnen">{unplaced.map((source, index) => station(source.key, index, true))}</ul>
      </section>}
      <p id="placement-required">{unplaced.length ? "Ordnen Sie zuerst alle Stationen unter „Zeitlich noch einzuordnen“ ausdrücklich ein. Danach können Sie die Reihenfolge übernehmen." : "Alle Stationen sind im Entwurf platziert. Die Reihenfolge ordnet nur Ihren Entwurf, nicht die historische Abfolge."}</p>
      <div className={styles.actions}>
        <button type="button" ref={confirmRef} onClick={confirm} disabled={unplaced.length > 0 || confirmedOrder !== null} aria-describedby={error?.field === "order" ? "order-error placement-required" : "placement-required order-hint"}>Reihenfolge für den Entwurf übernehmen</button>
        <button type="button" onClick={reset}>Entwurf zurücksetzen</button>
      </div>
      {error?.field === "order" && <p id="order-error" role="alert" className={styles.error}>{error.message}</p>}
      <p role="status" aria-live="polite" className={styles.live}>{announcement}</p>
    </div>
  );
}
