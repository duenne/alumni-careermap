import { InstitutionBrand } from "./survey-introduction";
import styles from "./surveys.module.css";

export default function JourneyHeading({ surveyId, name, program }: { surveyId: string; name: string; program: { name: string; institution: { id: string; name: string } } }) {
  return <header className={styles.journeyHeading}>
    <InstitutionBrand institution={program.institution} />
    <div className={styles.journeyContext}><p>{program.name}</p><a href={`/surveys/${surveyId}`} target="_blank" rel="noreferrer">Befragungsinformationen ↗</a></div>
    <p className="eyebrow">{name}</p>
    <h1>Dein Weg nach dem Studium</h1>
    <p className="lead">Deine Erfahrungen machen berufliche und akademische Wege sichtbar. Du entscheidest, was du teilen möchtest.</p>
  </header>;
}
