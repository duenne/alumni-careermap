export const entryFields = {
  entryHeading: { label: "Überschrift", max: 160, hint: "Der Titel ganz oben auf der Einstiegsseite.", fallback: "Dein Weg nach dem Studium" },
  entryIntro: { label: "Kurze Einleitung", max: 600, hint: "Ein kurzer Satz, der zur Teilnahme einlädt.", fallback: "Wo hat dich dein Studium hingeführt?" },
  entryWelcome: { label: "Persönlicher Begrüßungstext", max: 3000, hint: "Sprich deine Alumni direkt an. Absätze bleiben erhalten.", fallback: "Mit Alumni CareerMap möchten wir zeigen, welche beruflichen und akademischen Wege nach dem Studium möglich sind. Deine Erfahrungen könnten später helfen, diese Wege sichtbar zu machen." },
  entryPurpose: { label: "Ziel der Befragung", max: 1600, hint: "Was möchtest du durch die Befragung herausfinden?", fallback: "Die Befragung soll Bildungs- und Berufswege ehemaliger Studierender sichtbar machen." },
  entryContact: { label: "Verantwortliche Person / Kontakt (optional)", max: 300, hint: "Zum Beispiel die Studiengangsleitung und eine Kontaktadresse für Rückfragen.", fallback: "" },
} as const;
export type EntryField = keyof typeof entryFields;
export type EntryContent = Record<EntryField, string | null>;
export const entryKeys = Object.keys(entryFields) as EntryField[];
export function entryText(content: Partial<EntryContent>, key: EntryField) {
  return content[key]?.trim() || entryFields[key].fallback;
}
