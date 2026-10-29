"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { sankeyLinkHorizontal } from "d3-sankey";
import type { CareerFlow, FlowNode } from "../../../lib/analytics/aggregate";
import { aggregateCareers, stages } from "../../../lib/analytics/aggregate";
import { aggregateOverview, overviewStages } from "../../../lib/analytics/overview";
import { createSankeyLayout, formatShare, wrapLabel, type LinkData, type NodeData, type NodeSort } from "../../../lib/analytics/sankey-layout";
import type { AnalyticsProfile } from "../../../lib/analytics/records";
import styles from "./analytics.module.css";
import { filterMasterProfiles, focusStages, type AnalysisFocus, type MasterFilter } from "../../../lib/analytics/filters";

const colors = ["#f4c69c", "#b5d6ef", "#c4dfb5", "#d4c1ed", "#f4c69c", "#b5d6ef", "#c4dfb5"];
const people = (n: number) => `${n} ${n === 1 ? "Person" : "Personen"}`;
type Selection = { key: string; ids: string[]; text: string };
type Props = { flow: CareerFlow; profiles: AnalyticsProfile[]; selectedId: string | null; onSelect: (id: string | null) => void };

export default function Sankey({ flow: history, profiles, selectedId, onSelect }: Props) {
  const [view, setView] = useState<"overview" | "history">("overview");
  const [master, setMaster] = useState<MasterFilter>("all");
  const [focus, setFocus] = useState<AnalysisFocus>("all");
  const filtered = useMemo(() => filterMasterProfiles(profiles, master), [profiles, master]);
  const overview = useMemo(() => aggregateOverview(filtered.profiles), [filtered]);
  const fullHistory = useMemo(() => master === "all" ? history : aggregateCareers(filtered.profiles), [master, history, filtered]);
  const flow = view === "overview" ? overview : fullHistory;
  return <section aria-label="MSI-Sankey">
    <div className={styles.viewSwitch} role="group" aria-label="Sankey-Ansicht">
      <button type="button" aria-pressed={view === "overview"} onClick={() => setView("overview")}>Typische Karrierepfade</button>
      <button type="button" aria-pressed={view === "history"} onClick={() => setView("history")}>Gesamte Karrierehistorie</button>
    </div>
    <div className={styles.controls}>
      <label htmlFor="analytics-master">Masterstudium<select aria-label="Masterstudium" id="analytics-master" value={master} onChange={e => setMaster(e.target.value as MasterFilter)}><option value="all">Alle Profile</option><option value="with">Mit Masterstudium nach MSI</option><option value="without">Ohne Masterstudium nach MSI</option></select></label>
      <label htmlFor="analytics-focus">Analyse-Schwerpunkt<select aria-label="Analyse-Schwerpunkt" id="analytics-focus" value={focus} onChange={e => setFocus(e.target.value as AnalysisFocus)}><option value="all">Alle Kategorien</option><option value="sectors">Branchen</option><option value="jobs">Jobkategorien</option><option value="fields">Fachrichtungen</option></select></label>
      <button type="button" onClick={() => { setMaster("all"); setFocus("all"); }}>Alle Filter zurücksetzen</button>
    </div>
    <p>{filtered.removed.length} Profile durch Masterfilter ausgeblendet{master !== "all" ? `, darunter ${filtered.unknown} mit ungeklärtem Masterstatus` : ""}. Der Analyse-Schwerpunkt verändert die Darstellung, nicht die Grundgesamtheit.</p>
    <h2>{view === "overview" ? "Typische Karrierepfade – erste Tätigkeit nach MSI" : "Gesamte Karrierehistorie – Kategorienkombinationen"}</h2>
    <p>{view === "overview" ? "Branche und Jobkategorie gehören zur selben ersten eindeutig nach MSI begonnenen beruflichen Station. Master- und Tätigkeitsstufe beschreiben gemeinsame Profilmerkmale; ein Master muss nicht vor dieser Tätigkeit abgeschlossen worden sein." : "Mehrere Stationen werden zu Kategorienkombinationen zusammengefasst. Eine Verbindung bezeichnet gemeinsame Personenmerkmale und keinen einzelnen tatsächlichen Stationsübergang."}</p>
    <FlowChart key={`${view}:${master}`} flow={flow} profiles={profiles} selectedId={selectedId} onSelect={onSelect} stageNames={view === "overview" ? overviewStages : stages} compact={view === "overview"} focusedStages={focusStages(focus, view)} filteredIds={filtered.removed.map(p => p.alumniId)} />
    <details><summary>Auswertungsregeln und Ausschlüsse</summary>
      <p>{profiles.some(p=>p.referenceDegreeId) ? "Ein ausdrücklich bestätigter MSI-Bachelor mit bekannten Studienjahren ist für diese Projektion erforderlich." : "Ein eigener, abgeschlossener synthetischer Bachelor-Demoanker mit bekannten Studienjahren ist erforderlich."} Beginn nach MSI heißt: Startjahr strikt nach dem Endjahr des Ankers und Timeline-Position dahinter. Es werden keine Referenzen oder Kategorien ergänzt.</p>
      <p>Für die Übersicht sind Beschäftigung, Selbstständigkeit und Praktikum relevant. Der früheste zulässige Beginn entscheidet; gleiche früheste Jahre heißen „Mehrere mögliche erste Tätigkeiten“. Ein möglicherweise früherer undatierter oder im MSI-Endjahr begonnener Fall bleibt zeitlich ungeklärt. Vor MSI begonnene Tätigkeiten werden nicht zu neu begonnenen Stellen umgedeutet.</p>
      <p>Mehrere Masterphasen heißen „Mehrere Masterstudien“; Fachrichtungen und Abschlussstatus sind in der Timeline einzeln sichtbar. Laufende und ohne Abschluss beendete Masterphasen sind keine bestätigten Abschlüsse. „Kein Master“ oder fehlende Tätigkeit setzen ausdrücklich vollständige synthetische Testfälle voraus.</p>
      <p>Die Gesamthistorie bleibt unverändert: Alle Vor-/Nach-MSI-Kategorien einer Person werden kombiniert. Berufsbildung und Austausch haben kein eigenes kanonisches Fachrichtungsfeld und bleiben dort unbekannt.</p>
      <ul>{flow.excluded.map((e, i) => <li key={i}>Profil {profiles.findIndex(p => p.id === e.alumniId) + 1}: {e.reason}</li>)}</ul>
    </details>
  </section>;
}

function FlowChart({ flow, profiles, selectedId, onSelect, stageNames, compact, focusedStages, filteredIds }: Props & { stageNames: string[]; compact: boolean; focusedStages: number[]; filteredIds: string[] }) {
  const container = useRef<HTMLDivElement>(null);
  const refs = useRef(new Map<string, SVGGElement>());
  const [width, setWidth] = useState(1200);
  const [sort, setSort] = useState<NodeSort>("frequency");
  const [hover, setHover] = useState<Selection | null>(null);
  const [pin, setPin] = useState<(Selection & { selectedAtPin: string | null }) | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  useEffect(() => {
    if (!container.current || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(entries => { if (entries[0].contentRect.width > 0) setWidth(entries[0].contentRect.width); });
    observer.observe(container.current); return () => observer.disconnect();
  }, []);
  const graph = useMemo(() => createSankeyLayout(flow, stageNames, width - 2, sort), [flow, stageNames, width, sort]);
  const nodes = graph.layout?.nodes.toSorted((a, b) => a.stage - b.stage || a.y0! - b.y0!) ?? [];
  const nodeIds = (id: string) => flow.paths.filter(p => p.nodes.includes(id)).map(p => p.alumniId);
  const nodeText = (n: FlowNode) => `${stageNames[n.stage]}: ${n.label} · ${people(nodeIds(n.id).length)} · ${formatShare(nodeIds(n.id).length, flow.included)}`;
  const nodeSelection = (n: FlowNode): Selection => ({ key: `node:${n.id}`, ids: nodeIds(n.id), text: nodeText(n) });
  const pinned = pin?.selectedAtPin === selectedId ? pin : null;
  const selectedPath = flow.paths.find(p => p.alumniId === selectedId);
  const active = pinned?.ids ?? hover?.ids ?? (selectedPath ? [selectedId!] : null);
  const matches = (ids: string[]) => active !== null && ids.some(id => active.includes(id));
  const toggle = (selection: Selection) => { setPin(pinned?.key === selection.key ? null : { ...selection, selectedAtPin: selectedId }); };
  const clear = () => { setPin(null); setHover(null); onSelect(null); };
  const selectedNumber = profiles.findIndex(p => p.id === selectedId) + 1;
  const uncertainty = selectedPath?.nodes.map(id => flow.nodes.find(n => n.id === id)).filter(n => n?.state === "unknown").map(n => n!.label);
  const note = pinned ? `${pinned.ids.length} Profile im ausgewählten Fluss fixiert. ${pinned.text}` : hover?.text ?? (selectedId
    ? selectedPath ? `Karrierepfad von Profil ${selectedNumber} hervorgehoben.${selectedPath.partial ? ` Ungeklärte Zuordnung: ${[...new Set(uncertainty)].join("; ")}.` : ""}` : filteredIds.includes(selectedId) ? `Profil ${selectedNumber} wird durch den Masterfilter ausgeblendet; die vollständige Timeline bleibt sichtbar.` : `Profil ${selectedNumber} ist in dieser Ansicht nicht enthalten. Siehe Ausschlussgrund; die vollständige Timeline bleibt sichtbar.`
    : "Kategorie oder Verbindung berühren. Die Auswahl durch Klicken oder Eingabe festhalten; erneut klicken oder Escape hebt die Fixierung auf.");
  const fill = (n: FlowNode) => n.state === "absent" ? "#eeeeee" : n.state === "unknown" ? "#f1d981" : colors[compact ? [3, 4, 5, 6][n.stage] : n.stage];
  const links = graph.layout?.links.map(link => {
    const source = link.source as typeof nodes[number], target = link.target as typeof nodes[number];
    return { link, source, target, selection: { key: `link:${source.id}:${target.id}`, ids: link.alumniIds, text: `${stageNames[source.stage]}: ${source.label} → ${stageNames[target.stage]}: ${target.label} · ${people(link.value)} · ${formatShare(link.value, flow.included)}` } };
  }) ?? [];
  return <>
    <p className={styles.flowSummary}>{flow.included} Profile im Diagramm · {flow.partial} davon mit unbekannten / ungeklärten Stufen · {flow.excluded.length} ausgeschlossen. Jede Spaltengrenze zählt {flow.included} Personen; insgesamt {flow.included * (stageNames.length - 1)} Übergangsbeiträge.</p>
    <p>Bandbreiten, Fallzahlen und Anteile beziehen sich auf alle aktuell berücksichtigten Profile. Eine Hervorhebung verändert diese Werte nicht.</p>
    <ul className={styles.legend} aria-label="Farblegende">{[["Fachrichtungen", colors[0]], ["Branchen", colors[1]], ["Jobkategorien", colors[2]], ["BA MSI", colors[3]], ["Nicht vorhanden", "#eeeeee"], ["Unbekannt / ungeklärt", "#f1d981"]].map(([label, color]) => <li key={label}><span className={styles.swatch} style={{ background: color }} />{label}</li>)}</ul>
    <div className={styles.controls}>
      <label htmlFor="analytics-path">Karrierepfad hervorheben<select aria-label="Karrierepfad hervorheben" id="analytics-path" value={selectedId ?? ""} onChange={e => { setPin(null); setHover(null); onSelect(e.target.value || null); }}><option value="">Alle Profile</option>{profiles.map((p, i) => <option key={p.id} value={p.id}>Profil {i + 1}</option>)}</select></label>
      <label htmlFor="analytics-sort">Knotensortierung<select id="analytics-sort" aria-label="Knotensortierung" value={sort} onChange={e => setSort(e.target.value as NodeSort)}><option value="frequency">Häufigkeit</option><option value="alphabetical">Alphabetisch</option></select></label>
      <button type="button" onClick={clear}>Auswahl aufheben</button>
    </div>
    <div className={styles.controls}>
      <label htmlFor="analytics-node">Kategorie hervorheben<select aria-label="Kategorie hervorheben" id="analytics-node" value={pinned?.key.startsWith("node:") ? pinned.key : ""} onChange={e => { const n = nodes.find(n => `node:${n.id}` === e.target.value); setHover(null); setPin(n ? { ...nodeSelection(n), selectedAtPin: selectedId } : null); }}><option value="">Keine fixierte Kategorie</option>{stageNames.map((stage, i) => <optgroup label={stage} key={stage}>{nodes.filter(n => n.stage === i).map(n => <option key={n.id} value={`node:${n.id}`}>{n.label} · {people(n.value ?? 0)} · {formatShare(n.value ?? 0, flow.included)}</option>)}</optgroup>)}</select></label>
      <label htmlFor="analytics-link">Verbindung hervorheben<select aria-label="Verbindung hervorheben" id="analytics-link" value={pinned?.key.startsWith("link:") ? pinned.key : ""} onChange={e => { const selection = links.find(l => l.selection.key === e.target.value)?.selection; setHover(null); setPin(selection ? { ...selection, selectedAtPin: selectedId } : null); }}><option value="">Keine fixierte Verbindung</option>{links.map(({ selection }) => <option key={selection.key} value={selection.key}>{selection.text}</option>)}</select></label>
    </div>
    <p id="sankey-keyboard" className={styles.help}>Tastatur: Ein Tabstopp für die Diagrammknoten, Pfeiltasten wechseln Kategorien, Pos1/Ende springen. Eingabe oder Leertaste fixiert, Escape löst. Kategorien und Verbindungen sind alternativ über die Auswahlfelder erreichbar.</p>
    <p className={styles.chartNote} role="status" aria-live="polite">{note}</p>
    <div ref={container} className={styles.chartMeasure}>
      {!graph.layout ? <p>Keine ausreichend deklarierten Karrierepfade für das Diagramm vorhanden.</p> : <div className={styles.chartWrap} tabIndex={0} aria-label={compact ? "Vier Sankey-Stufen; auf schmalen Bildschirmen scrollbar" : "Horizontal und vertikal scrollbar: sieben Sankey-Stufen"}>
        <svg width="100%" style={{ minWidth: graph.width }} viewBox={`0 0 ${graph.width} ${graph.height}`} role="group" aria-label={`MSI-Karrierepfade von ${flow.included} ${profiles.some(p=>p.referenceDegreeId) ? "bestätigten" : "synthetischen"} Profilen`} aria-describedby="sankey-keyboard" onKeyDown={e => { if (e.key === "Escape") { setPin(null); setHover(null); } }}>
          <title>Synthetische MSI-Karrierepfade</title>
          {stageNames.map((label, i) => <g key={label}><rect x={i * graph.columnWidth} width={graph.columnWidth} height={graph.height} fill={i % 2 ? "#f6f8fa" : "#fff"} /><text data-stage-heading={i} data-focus-stage={focusedStages.includes(i)} opacity={focusedStages.includes(i) ? 1 : .45} x={i * graph.columnWidth + 12} y={24} fontSize={13} fontWeight="bold">{wrapLabel(`${i + 1}. ${label}`, Math.floor((graph.columnWidth - 24) / 7)).map((line, j) => <tspan x={i * graph.columnWidth + 12} dy={j ? 17 : 0} key={j}>{line}</tspan>)}</text></g>)}
          <g fill="none">{links.map(({ link, source, target, selection }) => {
            const isAbsent = source.state === "absent" || target.state === "absent";
            const highlighted = matches(link.alumniIds);
            return <path key={selection.key} d={sankeyLinkHorizontal<NodeData, LinkData>()(link) ?? ""} stroke={isAbsent ? "#999999" : fill(source)} strokeWidth={link.width ?? 0}
              opacity={(active ? highlighted ? isAbsent ? .4 : .85 : .035 : isAbsent ? .12 : .5) * (active || focusedStages.includes(source.stage) || focusedStages.includes(target.stage) ? 1 : .45)} data-highlighted={highlighted} data-flow-value={link.value}
              tabIndex={-1} role="button" aria-label={selection.text} onMouseEnter={() => setHover(selection)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(selection)} onBlur={() => setHover(null)} onClick={() => toggle(selection)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(selection); } }}><title>{selection.text}</title></path>;
          })}</g>
          {nodes.map((node, index) => {
            const selection = nodeSelection(node), highlighted = matches(selection.ids);
            const labelY = (node.y0! + node.y1!) / 2 - (node.labelLines.length * 14) / 2 + 4;
            return <g key={node.id} ref={el => { if (el) refs.current.set(node.id, el); else refs.current.delete(node.id); }}
              data-node-label={node.label} data-node-state={node.state} data-node-count={node.value} opacity={active ? highlighted ? 1 : .25 : focusedStages.includes(node.stage) ? 1 : .4}
              tabIndex={node.id === (focused ?? nodes[0]?.id) ? 0 : -1} role="button" aria-label={selection.text} aria-pressed={pinned?.key === selection.key}
              onMouseEnter={() => setHover(selection)} onMouseLeave={() => setHover(null)} onFocus={() => { setFocused(node.id); setHover(selection); }} onBlur={() => setHover(null)} onClick={() => toggle(selection)}
              onKeyDown={e => {
                if (["Enter", " "].includes(e.key)) { e.preventDefault(); toggle(selection); }
                const offset = ["ArrowDown", "ArrowRight"].includes(e.key) ? 1 : ["ArrowUp", "ArrowLeft"].includes(e.key) ? -1 : 0;
                const next = e.key === "Home" ? 0 : e.key === "End" ? nodes.length - 1 : offset ? (index + offset + nodes.length) % nodes.length : -1;
                if (next >= 0) { e.preventDefault(); refs.current.get(nodes[next].id)?.focus(); }
              }}>
              <title>{selection.text}</title><rect x={node.x0} y={node.y0} width={14} height={node.y1! - node.y0!} fill={fill(node)} stroke="#737373" />
              <rect x={node.x1! + 2} y={labelY - 12} width={graph.columnWidth - 34} height={(node.labelLines.length + 1) * 14} fill="transparent" />
              <text x={node.x1! + 6} y={labelY} fontSize={12} fontWeight={node.stage === (compact ? 0 : 3) ? "bold" : "normal"} paintOrder="stroke" stroke="white" strokeWidth={3} strokeLinejoin="round">{node.labelLines.map((line, i) => <tspan x={node.x1! + 6} dy={i ? 14 : 0} key={i}>{line}</tspan>)}<tspan x={node.x1! + 6} dy={14}>{people(node.value ?? 0)}</tspan></text>
            </g>;
          })}
        </svg>
      </div>}
    </div>
    <details><summary>Kategoriehäufigkeiten als Tabelle – vollständige Textalternative</summary><div className={styles.tableWrap}><table><thead><tr><th>Analysestufe</th><th>Kategorie</th><th>Personen</th><th>Anteil</th></tr></thead><tbody>{nodes.map(n => <tr key={n.id}><td>{stageNames[n.stage]}</td><th scope="row">{n.label}</th><td>{n.value}</td><td>{formatShare(n.value ?? 0, flow.included)}</td></tr>)}</tbody></table></div></details>
  </>;
}
