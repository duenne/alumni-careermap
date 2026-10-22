"use client";

import { useEffect, useRef, type FormEvent } from "react";
import type { DecisionField, StationOutcome, UnresolvedDecision } from "../../lib/normalization/contract";
import { degreeLevels, degreeStatuses, type DegreeReviewApplication, type DegreeReviewDraft, type ReviewedDegreeSelection } from "./degree-review-draft";
import styles from "./degree-review.module.css";

const fieldLabels: Record<DecisionField, string> = {
  classification: "Art der Station", level: "Abschlussart", status: "Abschlussstatus", temporalStatus: "Beschäftigungsstatus",
  catalogAssociation: "Katalogzuordnung", startYear: "Beginn", endYear: "Endjahr", graduationYear: "Abschlussjahr",
  position: "Reihenfolge", title: "Bezeichnung", fieldOfStudy: "Studienrichtung", roleTitle: "Tätigkeit",
  roleCategory: "Tätigkeitsbereich", functionArea: "Aufgabenbereich", location: "Ort",
};
const reasonLabels: Record<UnresolvedDecision["reason"], string> = {
  MISSING: "nicht angegeben", UNKNOWN: "unbekannt", IMPRECISE_DATE: "nur ungenau bekannt",
  CLASSIFICATION_UNCERTAIN: "Einordnung noch offen", CATALOG_UNCONFIRMED: "noch nicht bestätigt",
  STATUS_UNCERTAIN: "wegen unklarem Status offen", CONFLICTING_FACTS: "Angaben widersprechen sich",
};
const levelLabel = (value: string) => degreeLevels.find(option => option.value === value)?.label;
const statusLabel = (value: string) => degreeStatuses.find(option => option.value === value)?.label;
type AppliedReview = Extract<DegreeReviewApplication, { ok: true }>;
type ReviewError = Extract<DegreeReviewApplication, { ok: false }>;
type Props = {
  draft: DegreeReviewDraft;
  reviewed: ReviewedDegreeSelection | null;
  applied: AppliedReview | null;
  outcome: StationOutcome | undefined;
  error: ReviewError | null;
  orderConfirmed: boolean;
  onChange: (field: keyof DegreeReviewDraft, value: string) => void;
  onSubmit: () => void;
};

export default function DegreeReview({ draft, reviewed, applied, outcome, error, orderConfirmed, onChange, onSubmit }: Props) {
  const classificationRef = useRef<HTMLSelectElement>(null);
  const levelRef = useRef<HTMLSelectElement>(null);
  const statusRef = useRef<HTMLSelectElement>(null);
  const resultRef = useRef<HTMLHeadingElement>(null);
  const assertionsRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!error || error.field === "order") return;
    const focus = { classification: classificationRef, level: levelRef, status: statusRef, form: classificationRef };
    focus[error.field].current?.focus();
  }, [error]);
  useEffect(() => { if (reviewed && !error) assertionsRef.current?.focus(); }, [reviewed, error]);
  useEffect(() => { if (applied && !error) resultRef.current?.focus(); }, [applied, error]);
  const accessibility = (field: keyof DegreeReviewDraft) => ({
    "aria-invalid": error?.field === field || undefined,
    "aria-describedby": error?.field === field ? "degree-review-error" : "degree-review-hint",
  });
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); onSubmit(); }

  return (
    <section className={styles.review} aria-labelledby="degree-review-heading">
      <h4 id="degree-review-heading">Diese Ausbildungsangabe prüfen</h4>
      <p>Bezeichnung und Enddatum allein legen weder Abschlussart noch Abschlussstatus fest.</p>
      <form noValidate onSubmit={submit} aria-labelledby="degree-review-heading" aria-describedby="degree-review-hint">
        <p id="degree-review-hint">{orderConfirmed
          ? "Reihenfolge übernommen. Wählen Sie die drei Angaben unabhängig voneinander."
          : "Sie können diese drei Angaben schon jetzt prüfen. Die Reihenfolge legen Sie unabhängig davon später fest."}</p>
        <div className={styles.fields}>
          <div><label htmlFor="degree-classification">Art der Station</label>
            <select id="degree-classification" ref={classificationRef} value={draft.classification} onChange={event => onChange("classification", event.target.value)} {...accessibility("classification")} required>
              <option value="">Bitte auswählen</option><option value="degree">Akademischer Abschluss</option>
            </select>
          </div>
          <div><label htmlFor="degree-level">Abschlussart</label>
            <select id="degree-level" ref={levelRef} value={draft.level} onChange={event => onChange("level", event.target.value)} {...accessibility("level")} required>
              <option value="">Bitte auswählen</option>{degreeLevels.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
          <div><label htmlFor="degree-status">Abschlussstatus</label>
            <select id="degree-status" ref={statusRef} value={draft.status} onChange={event => onChange("status", event.target.value)} {...accessibility("status")} required>
              <option value="">Bitte auswählen</option>{degreeStatuses.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
        </div>
        {error && error.field !== "order" && <p role="alert" id="degree-review-error" className={styles.error}>{error.message}</p>}
        <div className={styles.actions}><button type="submit">Auswahl im Entwurf anwenden</button></div>
      </form>
      {reviewed && <div className={styles.results}>
        <section aria-labelledby="assertions-heading">
          <h4 id="assertions-heading" ref={assertionsRef} tabIndex={-1}>Ihre ausdrücklich gewählten Angaben</h4>
          <dl><div><dt>Art der Station</dt><dd>Akademischer Abschluss</dd></div><div><dt>Abschlussart</dt><dd>{levelLabel(reviewed.level)}</dd></div>
            <div><dt>Abschlussstatus</dt><dd>{statusLabel(reviewed.status)}</dd></div>{applied && <div><dt>Reihenfolge im Entwurf</dt><dd>{applied.selection.position}</dd></div>}</dl>
          {!applied && <p>{orderConfirmed ? "Im Entwurf geprüft. Die Normalisierung ist noch offen." : "Reihenfolge noch offen. Ihre Auswahl gilt bisher nur im lokalen Entwurf, nicht als normalisierter Abschluss."}</p>}
        </section>
        {applied && outcome && <>
        <section aria-labelledby="normalization-heading">
          <h4 id="normalization-heading" ref={resultRef} tabIndex={-1}>Normalisiertes Ergebnis</h4>
          {outcome.kind === "RESOLVED_DEGREE" ? <dl>
            <div><dt>Bezeichnung</dt><dd>{outcome.canonical.title ?? "Nicht angegeben"}</dd></div>
            <div><dt>Einordnung</dt><dd>Akademischer Abschluss · {levelLabel(outcome.canonical.level)}</dd></div>
            <div><dt>Abschlussstatus</dt><dd>{statusLabel(outcome.canonical.status)}</dd></div>
            <div><dt>Beginn</dt><dd>{outcome.canonical.startYear ?? "Nicht angegeben"}</dd></div>
            <div><dt>Endjahr der Ausbildungsphase</dt><dd>{outcome.canonical.endYear ?? "Nicht angegeben"}</dd></div>
            <div><dt>Abschlussjahr</dt><dd>{outcome.canonical.graduationYear ?? "Nicht angegeben"}</dd></div>
            <div><dt>Reihenfolge im Entwurf</dt><dd>{outcome.position}</dd></div>
          </dl> : <p>Keine sichere Einordnung möglich. Die offenen Entscheidungen bleiben erhalten.</p>}
        </section>
        <section aria-labelledby="unresolved-heading">
          <h4 id="unresolved-heading">Noch offene Angaben</h4>
          <ul aria-label="Noch offene Entscheidungen">{outcome.unresolved.map((decision, index) => <li key={index}>{fieldLabels[decision.field]}: {reasonLabels[decision.reason]}.</li>)}</ul>
        </section>
        </>}
      </div>}
    </section>
  );
}
