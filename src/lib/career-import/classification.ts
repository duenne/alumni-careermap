/** Deliberately small local prototype vocabulary, not a trained model or an
 * official taxonomy. A proposal never changes a reviewed canonical value.
 */
export type ClassificationSuggestion = { value: string; reason: string };
type Rule = readonly [string, RegExp];
const fields: Rule[] = [
  ["Informatik", /\b(informatik|computer science)\b/iu],
  ["Psychologie", /\b(psychologie|psychology)\b/iu],
  ["Soziale Arbeit", /\b(soziale arbeit|social work)\b/iu],
  ["Nachhaltigkeitsmanagement", /\b(nachhaltigkeitsmanagement|sustainability management)\b/iu],
  ["Wirtschaftswissenschaften", /\b(betriebswirtschaft|bwl|business administration|economics)\b/iu],
];
const jobs: Rule[] = [
  ["Softwareentwicklung", /\b(software developer|software engineer|softwareentwickl\p{L}*)\b/iu],
  ["Projektmanagement", /\b(projektmanag\p{L}*|project manager)\b/iu],
  ["Personalwesen", /\b(human resources|personalreferent\p{L}*|recruiter)\b/iu],
  ["Nachhaltigkeitsmanagement", /\b(nachhaltigkeitsmanag\p{L}*|sustainability manager)\b/iu],
];
const sectors: Rule[] = [
  ["Gesundheitswesen", /\b(krankenhaus|klinikum|hospital)\b/iu],
  ["Hochschulen und Forschung", /\b(universität|university|hochschule)\b/iu],
  ["Finanzdienstleistungen", /\b(bank|sparkasse)\b/iu],
];
function match(text: string, rules: Rule[]): ClassificationSuggestion | undefined {
  const matches = rules.filter(([, pattern]) => pattern.test(text.normalize("NFC")));
  if (matches.length !== 1) return;
  const [value, pattern] = matches[0];
  return { value, reason: `Lokale Wortregel: „${text.match(pattern)?.[0]}“ → ${value}. Bitte prüfen.` };
}
export function classificationSuggestions(input: { title: string; provider: string; degree: boolean }) {
  const result: { field?: ClassificationSuggestion; job?: ClassificationSuggestion; sector?: ClassificationSuggestion } = {};
  if (input.degree) {
    const field = match(input.title, fields); if (field) result.field = field;
  } else {
    const job = match(input.title, jobs); if (job) result.job = job;
    // Employer sector is independent of occupation; no inference from job title.
    const sector = match(input.provider, sectors); if (sector) result.sector = sector;
  }
  return result;
}
