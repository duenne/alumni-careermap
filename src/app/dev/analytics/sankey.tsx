"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { sankeyLinkHorizontal } from "d3-sankey";
import type { CareerFlow, FlowNode } from "../../../lib/analytics/aggregate";
import { aggregateCareers, stages } from "../../../lib/analytics/aggregate";
import { aggregateOverview, overviewStages } from "../../../lib/analytics/overview";
import { createSankeyLayout, formatShare, wrapLabel, type LinkData, type NodeData, type NodeSort } from "../../../lib/analytics/sankey-layout";
import type { AnalyticsProfile } from "../../../lib/analytics/records";
import styles from "./analytics.module.css";
import { filterMasterProfiles, focusStages, type AnalysisFocus, type MasterFilter } from "../../../lib/analytics/filters";

import { understandCareers, understandingStages } from "../../../lib/analytics/understanding";
import { CareerGroups, CareerInsights, SelectedCareer } from "./career-understanding";

const colors = ["#f4c69c", "#b5d6ef", "#c4dfb5", "#d4c1ed", "#f4c69c", "#b5d6ef", "#c4dfb5"];
const people = (n: number) => `${n} ${n === 1 ? "Person" : "Personen"}`;
type Selection = { key: string; ids: string[]; text: string };
type DisclosureKey = "options" | "methodology";
type SurveyDisclosures = { open: Record<DisclosureKey, boolean>; onToggle: (key: DisclosureKey, open: boolean) => void };
type Props = { flow: CareerFlow; profiles: AnalyticsProfile[]; selectedId: string | null; onSelect: (id: string | null) => void; surveyDetails?: ReactNode };

export default function Sankey({ flow: history, profiles, selectedId, onSelect, surveyDetails }: Props) {
  const [view, setView] = useState<"understanding" | "overview" | "history">("understanding");
  const [groupId, setGroupId] = useState<string | null>(null);
  const [master, setMaster] = useState<MasterFilter>("all");
  const [focus, setFocus] = useState<AnalysisFocus>("all");
  // The chart remounts when its view/filter changes. Keep disclosure state here
  // so using a filter does not close the options.
  const [disclosures, setDisclosures] = useState({ options: false, methodology: false });
  const restoreMasterFocus = useRef(false);
  useLayoutEffect(() => {
    if (restoreMasterFocus.current) document.getElementById("analytics-master")?.focus();
    restoreMasterFocus.current = false;
  }, [master]);
  const filtered = useMemo(() => filterMasterProfiles(profiles, master), [profiles, master]);
  const overview = useMemo(() => aggregateOverview(filtered.profiles), [filtered]);
  const fullHistory = useMemo(() => master === "all" ? history : aggregateCareers(filtered.profiles), [master, history, filtered]);
  const understanding = useMemo(() => understandCareers(profiles), [profiles]);
  const selectedGroup = understanding.groups.find(g => g.id === groupId && (!selectedId || g.alumniIds.includes(selectedId)));
  const groupFlow = useMemo(() => selectedGroup ? understandCareers(profiles.filter(p => selectedGroup.alumniIds.includes(p.id))).flow : understanding.flow, [profiles, selectedGroup, understanding]);
  const flow = view === "understanding" ? groupFlow : view === "overview" ? overview : fullHistory;
  const filters = <>
    <div className={styles.controls}>
      <label htmlFor="analytics-master">Masterstudium<select aria-label="Masterstudium" id="analytics-master" value={master} onChange={e => { restoreMasterFocus.current = !!surveyDetails && document.activeElement === e.currentTarget; setMaster(e.target.value as MasterFilter); }}><option value="all">Alle Profile</option><option value="with">Mit Masterstudium nach MSI</option><option value="without">Ohne Masterstudium nach MSI</option></select></label>
      <label htmlFor="analytics-focus">Analyse-Schwerpunkt<select aria-label="Analyse-Schwerpunkt" id="analytics-focus" value={focus} onChange={e => setFocus(e.target.value as AnalysisFocus)}><option value="all">Alle Kategorien</option><option value="sectors">Branchen</option><option value="jobs">Jobkategorien</option><option value="fields">Fachrichtungen</option></select></label>
      <button type="button" onClick={() => { setMaster("all"); setFocus("all"); }}>Alle Filter zurücksetzen</button>
    </div>
    <p>{filtered.removed.length} Profile durch Masterfilter ausgeblendet{master !== "all" ? `, darunter ${filtered.unknown} mit ungeklärtem Masterstatus` : ""}. Der Analyse-Schwerpunkt verändert die Darstellung, nicht die Grundgesamtheit.</p>
  </>;
  const explanation = <p>{view === "understanding" ? "Lies von links nach rechts: Was ist vor MSI erfasst, welche Station folgt in der gespeicherten Reihenfolge und wo endet der erfasste Weg? Die letzte Station ist nicht zwingend eine heutige Tätigkeit. Zwischenstationen findest du in den Stationsfolgen und im konkreten Karriereweg. Jahresgrenzen oder Überlappungen entfernen keine bekannten Inhalte." : view === "overview" ? "Branche und Jobkategorie gehören zur selben ersten eindeutig nach MSI begonnenen beruflichen Station. Master- und Tätigkeitsstufe beschreiben gemeinsame Profilmerkmale; ein Master muss nicht vor dieser Tätigkeit abgeschlossen worden sein." : "Mehrere Stationen werden zu Kategorienkombinationen zusammengefasst. Eine Verbindung bezeichnet gemeinsame Personenmerkmale und keinen einzelnen tatsächlichen Stationsübergang."}</p>;
  const rules = view === "understanding" ? <>
    <p>Die Übersicht verwendet den bestätigten Referenzabschluss beziehungsweise den deklarierten synthetischen Demoanker und die gespeicherte Stationsreihenfolge. Fehlende Jahresangaben sind kein Ausschlussgrund. „Davor“ und „danach“ bezeichnen hier ausschließlich die Reihenfolge, keine zeitliche Trennung.</p>
    <p>Die erste Spalte bündelt Stationstypen vor dem Referenzeintrag. Die dritte zeigt den nächsten Eintrag. Die letzte zeigt den letzten weiteren Eintrag mit Branche oder Fachrichtung, soweit erfasst. Bei nur einer weiteren Station beschreiben beide Spalten denselben Eintrag. Alle Zwischenstationen bleiben in den vollständigen Stationsfolgen und Einzelwegen erhalten.</p>
    <p>Die Stationsfolgen gruppieren ausschließlich Stationstypen; Fachrichtungen, Branchen, Arbeitgeber und Status können sich innerhalb einer Folge unterscheiden. Die weiteren Ansichten prüfen eine strikte zeitliche Vor-/Nach-MSI-Zuordnung separat.</p>
    <ul>{flow.excluded.map((e, i) => <li key={i}>Profil {profiles.findIndex(p => p.id === e.alumniId) + 1}: {e.reason}</li>)}</ul>
  </> : <>
      <p>{profiles.some(p=>p.referenceDegreeId) ? "Ein ausdrücklich bestätigter MSI-Bachelor mit bekannten Studienjahren ist für diese Projektion erforderlich." : "Ein eigener, abgeschlossener synthetischer Bachelor-Demoanker mit bekannten Studienjahren ist erforderlich."} Beginn nach MSI heißt: Startjahr strikt nach dem Endjahr des Ankers und Timeline-Position dahinter. Es werden keine Referenzen oder Kategorien ergänzt.</p>
      <p>Für die Übersicht sind Beschäftigung, Selbstständigkeit und Praktikum relevant. Der früheste zulässige Beginn entscheidet; gleiche früheste Jahre heißen „Mehrere mögliche erste Tätigkeiten“. Ein möglicherweise früherer undatierter oder im MSI-Endjahr begonnener Fall bleibt zeitlich ungeklärt. Vor MSI begonnene Tätigkeiten werden nicht zu neu begonnenen Stellen umgedeutet.</p>
      <p>Mehrere Masterphasen heißen „Mehrere Masterstudien“; Fachrichtungen und Abschlussstatus sind in der Timeline einzeln sichtbar. Laufende und ohne Abschluss beendete Masterphasen sind keine bestätigten Abschlüsse. „Kein Master“ oder fehlende Tätigkeit setzen ausdrücklich vollständige synthetische Testfälle voraus.</p>
      <p>Die Gesamthistorie bleibt unverändert: Alle Vor-/Nach-MSI-Kategorien einer Person werden kombiniert. Berufsbildung und Austausch haben kein eigenes kanonisches Fachrichtungsfeld und bleiben dort unbekannt.</p>
      <ul>{flow.excluded.map((e, i) => <li key={i}>Profil {profiles.findIndex(p => p.id === e.alumniId) + 1}: {e.reason}</li>)}</ul>
  </>;
  return <section aria-label="MSI-Sankey">
    <div className={styles.viewSwitch} role="group" aria-label="Sankey-Ansicht">
      <button type="button" aria-pressed={view === "understanding"} onClick={() => setView("understanding")}>Karrierewege verstehen</button>
      <button type="button" aria-pressed={view === "overview"} onClick={() => setView("overview")}>Typische Karrierepfade</button>
      <button type="button" aria-pressed={view === "history"} onClick={() => setView("history")}>Gesamte Karrierehistorie</button>
    </div>
    {view === "understanding" && <CareerInsights data={understanding} />}
    {!surveyDetails && view !== "understanding" && filters}
    <h2>{view === "understanding" ? selectedGroup ? `Karriereverläufe · ${flow.included} Profile in der gewählten Folge` : "Karriereverläufe im Überblick" : view === "overview" ? "Typische Karrierepfade – erste Tätigkeit nach MSI" : "Gesamte Karrierehistorie – Kategorienkombinationen"}</h2>
    {(view === "understanding" || !surveyDetails) && explanation}
    {view === "understanding" && selectedGroup && <button type="button" onClick={() => setGroupId(null)}>Alle Stationsfolgen zeigen</button>}
    <FlowChart key={`${view}:${view === "understanding" ? selectedGroup?.id ?? "all" : master}`} understanding={view === "understanding"} flow={flow} profiles={profiles} selectedId={selectedId} onSelect={id => { if (view === "understanding" && id && selectedGroup && !selectedGroup.alumniIds.includes(id)) setGroupId(null); onSelect(id); }} stageNames={view === "understanding" ? understandingStages : view === "overview" ? overviewStages : stages} compact={view !== "history"} focusedStages={view === "understanding" ? [0, 1, 2, 3] : focusStages(focus, view)} filteredIds={view === "understanding" ? profiles.filter(p => selectedGroup && !selectedGroup.alumniIds.includes(p.id)).map(p => p.id) : filtered.removed.map(p => p.alumniId)} analysisControls={surveyDetails && view !== "understanding" ? filters : undefined} surveyDetails={surveyDetails ? <>{surveyDetails}{explanation}{rules}</> : undefined} surveyDisclosures={{open: disclosures, onToggle: (key, open) => setDisclosures(previous => previous[key] === open ? previous : {...previous, [key]: open})}} />
    {view === "understanding" && <CareerGroups groups={understanding.groups} profiles={profiles} selectedGroup={selectedGroup} onGroup={id => { setGroupId(id); onSelect(null); }} onSelect={onSelect} />}
    {!surveyDetails && <details><summary>Auswertungsregeln und Ausschlüsse</summary>{rules}</details>}
  </section>;
}

function FlowChart({ flow, profiles, selectedId, onSelect, stageNames, compact, focusedStages, filteredIds, surveyDetails, analysisControls, surveyDisclosures, understanding = false }: Props & { stageNames: string[]; compact: boolean; focusedStages: number[]; filteredIds: string[]; analysisControls?: ReactNode; surveyDisclosures: SurveyDisclosures; understanding?: boolean }) {
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
    ? selectedPath ? `Karrierepfad von Profil ${selectedNumber} hervorgehoben.${selectedPath.partial ? ` Ungeklärte Zuordnung: ${[...new Set(uncertainty)].join("; ")}.` : ""}` : filteredIds.includes(selectedId) ? `Profil ${selectedNumber} wird durch ${understanding ? "die Stationsfolge" : "den Masterfilter"} ausgeblendet; die vollständige Timeline bleibt sichtbar.` : `Profil ${selectedNumber} ist in dieser Ansicht nicht enthalten. Siehe Ausschlussgrund; die vollständige Timeline bleibt sichtbar.`
    : "Kategorie oder Verbindung berühren. Die Auswahl durch Klicken oder Eingabe festhalten; erneut klicken oder Escape hebt die Fixierung auf.");
  const fill = (n: FlowNode) => n.state === "absent" ? "#eeeeee" : n.state === "unknown" ? "#f1d981" : colors[understanding ? [0, 3, 2, 1][n.stage] : compact ? [3, 4, 5, 6][n.stage] : n.stage];
  const links = graph.layout?.links.map(link => {
    const source = link.source as typeof nodes[number], target = link.target as typeof nodes[number];
    return { link, source, target, selection: { key: `link:${source.id}:${target.id}`, ids: link.alumniIds, text: `${stageNames[source.stage]}: ${source.label} → ${stageNames[target.stage]}: ${target.label} · ${people(link.value)} · ${formatShare(link.value, flow.included)}` } };
  }) ?? [];
  const methodology = <>
    <p className={styles.flowSummary}>{flow.included} Profile im Diagramm · {understanding ? "Übersicht nach gespeicherter Reihenfolge" : `${flow.partial} davon mit unbekannten / ungeklärten Stufen`} · {flow.excluded.length} ausgeschlossen. Jede Spaltengrenze zählt {flow.included} Personen; insgesamt {flow.included * (stageNames.length - 1)} Übergangsbeiträge.</p>
    <p>Bandbreiten, Fallzahlen und Anteile beziehen sich auf alle aktuell berücksichtigten Profile. Eine Hervorhebung verändert diese Werte nicht.</p>
  </>;
  const pathControl = <label htmlFor="analytics-path">Karrierepfad hervorheben<select aria-label="Karrierepfad hervorheben" id="analytics-path" value={selectedId ?? ""} onChange={e => { setPin(null); setHover(null); onSelect(e.target.value || null); }}><option value="">Alle Profile</option>{profiles.map((p, i) => <option key={p.id} value={p.id}>Profil {i + 1}{understanding && p.stations.toSorted((a, b) => a.position - b.position).at(-1)?.title ? ` · ${p.stations.toSorted((a, b) => a.position - b.position).at(-1)!.title}` : ""}</option>)}</select></label>;
  const controls = <>
    <div className={styles.controls}>
      {!understanding && pathControl}
      <label htmlFor="analytics-sort">Knotensortierung<select id="analytics-sort" aria-label="Knotensortierung" value={sort} onChange={e => setSort(e.target.value as NodeSort)}><option value="frequency">Häufigkeit</option><option value="alphabetical">Alphabetisch</option></select></label>
      <button type="button" onClick={clear}>Auswahl aufheben</button>
    </div>
    <div className={styles.controls}>
      <label htmlFor="analytics-node">Kategorie hervorheben<select aria-label="Kategorie hervorheben" id="analytics-node" value={pinned?.key.startsWith("node:") ? pinned.key : ""} onChange={e => { const n = nodes.find(n => `node:${n.id}` === e.target.value); setHover(null); setPin(n ? { ...nodeSelection(n), selectedAtPin: selectedId } : null); }}><option value="">Keine fixierte Kategorie</option>{stageNames.map((stage, i) => <optgroup label={stage} key={stage}>{nodes.filter(n => n.stage === i).map(n => <option key={n.id} value={`node:${n.id}`}>{n.label} · {people(n.value ?? 0)} · {formatShare(n.value ?? 0, flow.included)}</option>)}</optgroup>)}</select></label>
      <label htmlFor="analytics-link">Verbindung hervorheben<select aria-label="Verbindung hervorheben" id="analytics-link" value={pinned?.key.startsWith("link:") ? pinned.key : ""} onChange={e => { const selection = links.find(l => l.selection.key === e.target.value)?.selection; setHover(null); setPin(selection ? { ...selection, selectedAtPin: selectedId } : null); }}><option value="">Keine fixierte Verbindung</option>{links.map(({ selection }) => <option key={selection.key} value={selection.key}>{selection.text}</option>)}</select></label>
    </div>
  </>;
  const keyboardHelp = <p id={surveyDetails ? undefined : "sankey-keyboard"} className={styles.help}>Tastatur: Ein Tabstopp für die Diagrammknoten, Pfeiltasten wechseln Kategorien, Pos1/Ende springen. Eingabe oder Leertaste fixiert, Escape löst. Kategorien und Verbindungen sind alternativ über die Auswahlfelder erreichbar.</p>;
  const status = <p className={styles.chartNote} role="status" aria-live="polite">{note}</p>;
  return <>
    {!surveyDetails && methodology}
    <ul className={styles.legend} aria-label="Farblegende">{(understanding ? [["Davor erfasst", colors[0]], ["MSI", colors[3]], ["Nächste Station", colors[2]], ["Letzte Station", colors[1]], ["Keine Station erfasst", "#eeeeee"]] : [["Fachrichtungen", colors[0]], ["Branchen", colors[1]], ["Jobkategorien", colors[2]], ["BA MSI", colors[3]], ["Nicht vorhanden", "#eeeeee"], ["Unbekannt / ungeklärt", "#f1d981"]]).map(([label, color]) => <li key={label}><span className={styles.swatch} style={{ background: color }} />{label}</li>)}</ul>
    {surveyDetails ? <p id="sankey-keyboard" className={styles.help}>Breitere Bänder bedeuten mehr Profile. Anklicken hebt Wege hervor. Tastatur: Tab, Pfeiltasten, Eingabe; Escape löst die Auswahl.</p> : <>{controls}{keyboardHelp}{status}</>}
    {understanding && <p className={styles.help}>Die Bänder zählen Profile. Wähle eine Stationsfolge oder ein Profil, um zusammengehörige Wege zu erkennen. Fehlende Kategorien werden durch gespeicherte Bezeichnungen ersetzt, soweit vorhanden. Bei vielen Bezeichnungen bündelt „Weitere Stationen“ die übrigen; die enthaltenen Wege bleiben per Klick erreichbar.</p>}
    {understanding && <div className={styles.controls}>{pathControl}</div>}
    {understanding && profiles.find(p => p.id === selectedId) && <SelectedCareer profile={profiles.find(p => p.id === selectedId)!} number={selectedNumber} />}
    <div ref={container} className={styles.chartMeasure}>
      {!graph.layout ? <p>Keine ausreichend deklarierten Karrierepfade für das Diagramm vorhanden.</p> : <div className={styles.chartWrap} tabIndex={0} aria-label={compact ? "Vier Sankey-Stufen; auf schmalen Bildschirmen scrollbar" : "Horizontal und vertikal scrollbar: sieben Sankey-Stufen"}>
        <svg width="100%" style={{ minWidth: graph.width }} viewBox={`0 0 ${graph.width} ${graph.height}`} role="group" aria-label={`MSI-Karrierepfade von ${flow.included} ${profiles.some(p=>p.referenceDegreeId) ? "bestätigten" : "synthetischen"} Profilen`} aria-describedby="sankey-keyboard" onKeyDown={e => { if (e.key === "Escape") { setPin(null); setHover(null); } }}>
          <title>Synthetische MSI-Karrierepfade</title>
          {stageNames.map((label, i) => <g key={label}><rect x={i * graph.columnWidth} width={graph.columnWidth} height={graph.height} fill={i % 2 ? "#f6f8fa" : "#fff"} /><text data-stage-heading={i} data-focus-stage={focusedStages.includes(i)} opacity={focusedStages.includes(i) ? 1 : .45} x={i * graph.columnWidth + 12} y={24} fontSize={13} fontWeight="bold">{wrapLabel(`${i + 1}. ${label}`, Math.floor((graph.columnWidth - 24) / 7)).map((line, j) => <tspan x={i * graph.columnWidth + 12} dy={j ? 17 : 0} key={j}>{line}</tspan>)}</text></g>)}
          <g fill="none">{links.map(({ link, source, target, selection }) => {
            const isAbsent = source.state === "absent" || target.state === "absent";
            const highlighted = matches(link.alumniIds);
            return <path key={selection.key} d={sankeyLinkHorizontal<NodeData, LinkData>()(link) ?? ""} stroke={isAbsent ? "#999999" : fill(source)} strokeWidth={link.width ?? 0}
              opacity={(active ? highlighted ? understanding && selectedPath && !pinned && !hover ? .22 : isAbsent ? .4 : .85 : .035 : isAbsent ? .12 : .5) * (active || focusedStages.includes(source.stage) || focusedStages.includes(target.stage) ? 1 : .45)} data-highlighted={highlighted} data-flow-value={link.value} data-flow-stage={link.stage}
              tabIndex={-1} role="button" aria-label={selection.text} onMouseEnter={() => setHover(selection)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(selection)} onBlur={() => setHover(null)} onClick={() => toggle(selection)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(selection); } }}><title>{selection.text}</title></path>;
          })}</g>
          {understanding && selectedPath && <g fill="none" pointerEvents="none">{links.filter(({ link }) => link.alumniIds.includes(selectedId!)).map(({ link, selection }) => <path key={selection.key} data-selected-profile="true" d={sankeyLinkHorizontal<NodeData, LinkData>()(link) ?? ""} stroke="#633c91" strokeWidth={Math.max(2, (link.width ?? 0) / link.value)}><title>Ausgewähltes Profil · 1 Person</title></path>)}</g>}
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
              <text x={node.x1! + 6} y={labelY} fontSize={12} fontWeight={node.stage === (understanding ? 1 : compact ? 0 : 3) ? "bold" : "normal"} paintOrder="stroke" stroke="white" strokeWidth={3} strokeLinejoin="round">{node.labelLines.map((line, i) => <tspan x={node.x1! + 6} dy={i ? 14 : 0} key={i}>{line}</tspan>)}<tspan x={node.x1! + 6} dy={14}>{people(node.value ?? 0)}</tspan></text>
            </g>;
          })}
        </svg>
      </div>}
    </div>
    {understanding && pinned && <section aria-label="Karrierewege in der Auswahl" className={styles.groupDetail}>
      <h3>{pinned.ids.length} Wege in der Auswahl</h3><p>Wähle ein Profil, um seine konkreten Stationen zu sehen.</p>
      <div className={styles.controls}>{pinned.ids.slice(0, 6).map(id => <button type="button" key={id} onClick={() => { setPin(null); setHover(null); onSelect(id); }}>Profil {profiles.findIndex(p => p.id === id) + 1} ansehen<span className={styles.careerPreview}>{profiles.find(p => p.id === id)?.stations.toSorted((a, b) => a.position - b.position).at(-1)?.title}</span></button>)}</div>
      {pinned.ids.length > 6 && <label>Alle Wege dieser Auswahl<select aria-label="Alle Wege dieser Auswahl" value="" onChange={e => { if (e.target.value) { setPin(null); setHover(null); onSelect(e.target.value); } }}><option value="">Profil wählen</option>{pinned.ids.map(id => <option key={id} value={id}>Profil {profiles.findIndex(p => p.id === id) + 1} · {profiles.find(p => p.id === id)?.stations.toSorted((a, b) => a.position - b.position).at(-1)?.title}</option>)}</select></label>}
    </section>}
    {surveyDetails && <>
      {status}
      <details className={styles.disclosure} open={surveyDisclosures.open.options} onToggle={e => surveyDisclosures.onToggle("options", e.currentTarget.open)}><summary>Erweiterte Analyseoptionen</summary>{analysisControls}{controls}{keyboardHelp}</details>
      <details className={styles.disclosure} open={surveyDisclosures.open.methodology} onToggle={e => surveyDisclosures.onToggle("methodology", e.currentTarget.open)}><summary>Daten und Auswertungsmethodik</summary>{methodology}{surveyDetails}</details>
    </>}
    <details className={surveyDetails ? styles.disclosure : undefined}><summary>Kategoriehäufigkeiten als Tabelle – vollständige Textalternative</summary><div className={styles.tableWrap}><table><thead><tr><th>Analysestufe</th><th>Kategorie</th><th>Personen</th><th>Anteil</th></tr></thead><tbody>{nodes.map(n => <tr key={n.id}><td>{stageNames[n.stage]}</td><th scope="row">{n.label}</th><td>{n.value}</td><td>{formatShare(n.value ?? 0, flow.included)}</td></tr>)}</tbody></table></div></details>
  </>;
}
