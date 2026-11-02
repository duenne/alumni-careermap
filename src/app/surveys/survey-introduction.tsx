import type { EntryContent } from "../../lib/surveys/entry-content";
import { entryText } from "../../lib/surveys/entry-content";
import { institutionLabel } from "../../lib/surveys/presentation";
import styles from "./survey-introduction.module.css";

export function InstitutionBrand({ institution }: { institution: { id: string; name: string } }) {
  const name = institutionLabel(institution);
  return <div className={styles.brand}>
    {name === "Hochschule München" && <span className={styles.logo} aria-hidden="true" />}
    <div><strong>{name}</strong><span>Alumni CareerMap</span></div>
  </div>;
}

/** Shared by the real entry and the editor. Text is always rendered as text,
 * never HTML. Operational notices and participation actions stay outside it.
 */
export default function SurveyIntroduction({ content, program, preview = false }: {
  content: Partial<EntryContent>; program: { name: string; institution: { id: string; name: string } }; preview?: boolean;
}) {
  const Heading = preview ? "h3" : "h1";
  return <div className={styles.introduction}>
    <InstitutionBrand institution={program.institution} />
    <header className={styles.hero}>
      <p className={styles.program}>{program.name}</p>
      <Heading>{entryText(content, "entryHeading")}</Heading>
      <p className={styles.intro}>{entryText(content, "entryIntro")}</p>
    </header>
    <div className={styles.welcome}>{entryText(content, "entryWelcome")}</div>
    <div className={styles.purpose}><strong>Darum geht es</strong><p>{entryText(content, "entryPurpose")}</p></div>
    {entryText(content, "entryContact") && <div className={styles.contact}><strong>Dein Kontakt zur Befragung</strong><p>{entryText(content, "entryContact")}</p></div>}
  </div>;
}
