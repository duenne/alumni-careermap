"use client";
import { useMemo, useState } from "react";
import { sankey, sankeyLinkHorizontal } from "d3-sankey";
import type { CareerFlow, FlowNode } from "../../../lib/analytics/aggregate";
import { stages } from "../../../lib/analytics/aggregate";
import type { AnalyticsProfile } from "../../../lib/analytics/records";
import styles from "./analytics.module.css";
const colors = ["#f4c69c", "#b5d6ef", "#c4dfb5", "#d4c1ed", "#f4c69c", "#b5d6ef", "#c4dfb5"];
const color = (n: FlowNode) => n.state === "absent" ? "#d5d5d5" : n.state === "unknown" ? "#f1d981" : colors[n.stage];
type LinkExtra = { alumniIds: string[]; stage: number };
export default function Sankey({ flow, profiles, selectedId, onSelect }: { flow: CareerFlow; profiles: AnalyticsProfile[]; selectedId: string | null; onSelect: (id: string | null) => void }) {
  const [hover, setHover] = useState<{ ids: string[]; text: string } | null>(null);
  const [pinned, setPinned] = useState<string[] | null>(null);
  const [zoom, setZoom] = useState(1);
  const graph = useMemo(() => {
    if (!flow.nodes.length) return null;
    const height = Math.max(560, Math.max(...stages.map((_, stage) => flow.nodes.filter(n => n.stage === stage).length)) * 58 + 110);
    return { height, layout: sankey<FlowNode, LinkExtra>().nodeId(n => n.id).nodeAlign(n => n.stage).nodeWidth(16).nodePadding(30)
      .nodeSort((a, b) => a.label.localeCompare(b.label, "de")).extent([[10, 100], [2200, height - 20]])({ nodes: flow.nodes.map(n => ({ ...n })), links: flow.links.map(l => ({ ...l })) }) };
  }, [flow]);
  const active = hover?.ids ?? (selectedId ? [selectedId] : pinned);
  const nodeIds = (id: string) => flow.paths.filter(p => p.nodes.includes(id)).map(p => p.alumniId);
  const matches = (ids: string[]) => active === null || ids.some(id => active.includes(id));
  const note = hover?.text ?? (selectedId ? `Karrierepfad von Profil ${profiles.findIndex(p => p.id === selectedId) + 1} hervorgehoben.` : pinned ? `${pinned.length} Profile im ausgewählten Fluss hervorgehoben.` : "Kategorie oder Verbindung berühren oder fokussieren. Klicken hält die Auswahl fest.");
  return <section aria-label="MSI-Sankey"><h2>Sieben Stufen · ein Fluss pro Person</h2>
    <p>{flow.included} Profile im Diagramm · {flow.partial} davon mit unbekannten / ungeklärten Stufen · {flow.excluded.length} ausgeschlossen. Jede Spaltengrenze zählt {flow.included} Personen; insgesamt {flow.included * 6} Übergangsbeiträge.</p>
    <p>Eine Hervorhebung zeigt die zugehörigen Verbindungen. Die Bandbreiten und Fallzahlen beziehen sich weiterhin auf den Gesamtbestand.</p>
    <ul className={styles.legend} aria-label="Farblegende">{[["Fachrichtungen", colors[0]], ["Branchen", colors[1]], ["Jobkategorien", colors[2]], ["BA MSI", colors[3]], ["Nicht vorhanden", "#d5d5d5"], ["Unbekannt / ungeklärt", "#f1d981"]].map(([label, fill]) => <li key={label}><span className={styles.swatch} style={{ background: fill }} />{label}</li>)}</ul>
    <div className={styles.controls}><label htmlFor="analytics-path">Karrierepfad hervorheben</label><select id="analytics-path" value={selectedId ?? ""} onChange={e => { onSelect(e.target.value || null); setPinned(null); }}>{<option value="">Alle Profile</option>}{profiles.map((p, i) => <option key={p.id} value={p.id}>Profil {i + 1}</option>)}</select>
      <button type="button" onClick={() => { onSelect(null); setPinned(null); setHover(null); }}>Auswahl aufheben</button>
      <button type="button" onClick={() => setZoom(z => Math.min(1.5, z + .25))}>Vergrößern</button><button type="button" onClick={() => setZoom(z => Math.max(.75, z - .25))}>Verkleinern</button>
    </div>
    <p className={styles.chartNote} role="status">{note}</p>
    {!graph ? <p>Keine ausreichend deklarierten Karrierepfade für das Diagramm vorhanden.</p> : <div className={styles.chartWrap} tabIndex={0} aria-label="Horizontal und vertikal scrollbar: sieben Sankey-Stufen">
      <svg width={2460 * zoom} height={graph.height * zoom} viewBox={`0 0 2460 ${graph.height}`} role="img" aria-label={`MSI-Karrierepfade von ${flow.included} synthetischen Profilen`}>
        <title>Synthetische MSI-Karrierepfade</title><desc>Sieben Stufen, jeweils eine Zähleinheit je Person. Kategorienkombinationen fassen mehrere Stationen derselben Person zusammen.</desc>
        {stages.map((label, i) => <g key={label}><rect x={i * 364} width={350} height={graph.height} fill={i % 2 ? "#f6f8fa" : "#fff"} /><text x={i * 364 + 10} y={28} fontSize={15} fontWeight="bold"><tspan x={i * 364 + 10}>{i + 1}. {label.split(" · ")[0]}</tspan><tspan x={i * 364 + 10} dy={22}>{label.split(" · ")[1]}</tspan></text></g>)}
        <g fill="none">{graph.layout.links.map((link, i) => {
          const source = link.source as typeof graph.layout.nodes[number], target = link.target as typeof graph.layout.nodes[number];
          const text = `${source.label} → ${target.label}: ${link.value} Personen`;
          return <path key={i} d={sankeyLinkHorizontal<FlowNode, LinkExtra>()(link) ?? ""} stroke={color(source)} strokeWidth={Math.max(1, link.width ?? 1)} opacity={matches(link.alumniIds) ? active ? .8 : .38 : .06}
            tabIndex={0} role="button" aria-label={text} onMouseEnter={() => setHover({ ids: link.alumniIds, text })} onMouseLeave={() => setHover(null)} onFocus={() => setHover({ ids: link.alumniIds, text })} onBlur={() => setHover(null)} onClick={() => { onSelect(null); setPinned(link.alumniIds); }} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(null); setPinned(link.alumniIds); } }}><title>{text}</title></path>;
        })}</g>
        {graph.layout.nodes.map(node => {
          const ids = nodeIds(node.id), text = `${stages[node.stage]}: ${node.label} · ${node.value} Personen`;
          return <g key={node.id} opacity={matches(ids) ? 1 : .2} tabIndex={0} role="button" aria-label={text} onMouseEnter={() => setHover({ ids, text })} onMouseLeave={() => setHover(null)} onFocus={() => setHover({ ids, text })} onBlur={() => setHover(null)} onClick={() => { onSelect(null); setPinned(ids); }} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(null); setPinned(ids); } }}>
            <title>{text}</title><rect x={node.x0} y={node.y0} width={16} height={Math.max(2, node.y1! - node.y0!)} fill={color(node)} stroke="#555" />
            <text x={node.x1! + 7} y={(node.y0! + node.y1!) / 2} fontSize={12} fontWeight={node.stage === 3 ? "bold" : "normal"} paintOrder="stroke" stroke="white" strokeWidth={4} strokeLinejoin="round"><tspan>{node.label.length > 43 ? `${node.label.slice(0, 40)}…` : node.label}</tspan><tspan x={node.x1! + 7} dy={16}>{node.value} {node.value === 1 ? "Person" : "Personen"}</tspan></text>
          </g>;
        })}
      </svg>
    </div>}
    <details><summary>Auswertungsregel, Unklarheiten und Ausschlüsse</summary>
      <p>Die Flüsse zählen Personen mit gemeinsamen Merkmalen. Mehrere Stationen ergeben eine ausdrücklich bezeichnete Kategorienkombination. Es werden keine Übergänge zwischen einzelnen Stationen behauptet.</p>
      <p>Vor MSI: Ende strikt vor Studienbeginn und Timeline-Position vor dem Anker. Nach MSI: Beginn strikt nach Studienende und Position nach dem Anker. Gleiche Jahreszahlen, Überlappungen, fehlende Zeitangaben und widersprüchliche Positionen bleiben zeitlich ungeklärt. Eindeutig während MSI liegende Stationen erscheinen weiterhin in der vollständigen Timeline.</p>
      <p>„Kein Master“ setzt einen ausdrücklich vollständigen synthetischen Testfall voraus. Ein laufender oder im Status unbekannter Master bleibt eine vorhandene Studienphase. Berufsbildung und Austausch haben im unveränderten Modell kein Fachrichtungsfeld und erscheinen dort als unbekannt.</p>
      <ul>{flow.excluded.map((e, i) => <li key={i}>Profil {profiles.findIndex(p => p.id === e.alumniId) + 1}: {e.reason}</li>)}</ul>
      <p>{flow.paths.reduce((n, p) => n + p.unclearStations, 0)} Stationen mit ungeklärter Ankerrelation; {flow.paths.reduce((n, p) => n + p.duringStations, 0)} eindeutig innerhalb des MSI-Studiums liegende Stationen.</p>
    </details>
  </section>;
}
