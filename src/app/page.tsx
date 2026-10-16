import Link from "next/link";
import snapshot from "../test-fixtures/linkedin-snapshots/fictional-member.json";
import { adaptLinkedInSnapshot } from "../lib/normalization/adapt-linkedin-snapshot";
import type { NormalizationInput } from "../lib/normalization/contract";
import { ObservedStations } from "./observed-stations";

export default function Home() {
  let input: NormalizationInput | undefined;
  try {
    input = adaptLinkedInSnapshot(snapshot);
  } catch {
    // Keep the entry available without exposing source data or adapter errors.
  }
  return (
    <main id="inhalt" tabIndex={-1} className="entry">
      <p className="eyebrow">Wege nach dem Studium</p>
      <h1>Alumni CareerMap</h1>
      <p className="lead">
        Karrierewege von Alumni zeigen,
        welche Wege nach dem Studium möglich sind. Sie geben Studierenden
        Orientierung und machen unterschiedliche Perspektiven sichtbar.
      </p>
      <Link href="/review" className="primaryLink">Beispiel-Karriereweg ansehen</Link>
      <p className="demoNote">Eine Vorschau mit fiktiven Daten. Es findet keine Datenspende statt.</p>

      <section className="examplePreview" aria-labelledby="example-heading">
        <h2 id="example-heading">So kann ein Karriereweg aussehen</h2>
        <p>Vier fiktive Angaben aus einer Quelle. Ihre Art und ihr Status sind noch unbestätigt; eine Ausbildungsangabe allein belegt keinen Abschluss.</p>
        <p className="sourceNote">Die Quellenreihenfolge ist keine bestätigte zeitliche Reihenfolge.</p>
        {input ? <ObservedStations input={input} compact /> : <p>Beispiel derzeit nicht verfügbar.</p>}
      </section>

      <section className="plannedProcess" aria-labelledby="process-heading">
        <h2 id="process-heading">Vom einzelnen Eintrag zum gemeinsamen Einblick</h2>
        <p>So ist der Ablauf geplant:</p>
        <ol className="processSteps" aria-label="Geplanter Ablauf">
          <li><h3>Angaben übernehmen</h3><p>Ausbildungs- und Berufsangaben aus einer Quelle zusammenstellen. Hier sehen Sie ein fiktives Beispiel.</p></li>
          <li><h3>Stationen prüfen</h3><p>Bezeichnungen, Zeiträume und Einordnung selbst kontrollieren. Unklares bleibt offen.</p></li>
          <li><h3>Karrierewege sichtbar machen</h3><span className="futureLabel">Zukünftig</span><p>Geprüfte Karrierewege gemeinsam auswerten und berufliche Perspektiven sichtbar machen.</p></li>
        </ol>
      </section>
    </main>
  );
}
