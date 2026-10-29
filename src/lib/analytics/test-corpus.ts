import type { Oracle } from "./prepare";
/** Newly authored synthetic fixture. Never loads the optional local corpus. */
export function minimalCorpus() {
  const date = (year: number) => ({ precision: "YEAR", year, month: null });
  const education = (title: string, start: string, end: string) => ({ "Degree Name": title, "School Name": "Synthetic school", "Start Date": start, "End Date": end });
  const station = (stationId: string, titleRaw: string, chronologyIndex: number, degreeLevel: string, start: number, end: number) => ({
    stationId, stationType: "EDUCATION", titleRaw, organisationRaw: "Synthetic school", organisationCanonical: "Synthetic school", degreeLevel,
    chronologyIndex, isCurrent: false, startDate: date(start), endDate: date(end), fieldCategory: "Gesellschaft & Politik",
  });
  return {
    sources: [{ syntheticId: "PRIVATE_ID", snapshot: { elements: [
      { snapshotDomain: "PROFILE", snapshotData: [{ firstName: "PRIVATE_NAME", email: "PRIVATE_EMAIL", id: "PRIVATE_PROVIDER" }] },
      { snapshotDomain: "POSITIONS", snapshotData: [{ Title: "Synthetic role", "Company Name": "Synthetic organisation", "Started On": "Mar 2022", "Finished On": "", Location: "Synthetic town" }] },
      { snapshotDomain: "EDUCATION", snapshotData: [education("Synthetic BA MSI", "2015", "2019"), education("Synthetic training", "2010", "2013"), education("Auslandssemester Social Innovation", "2020", "2021")] },
    ] } }],
    expected: [{ syntheticId: "PRIVATE_ID", sourceFormat: "LINKEDIN_MEMBER_SNAPSHOT_SYNTHETIC_V1", profile: {}, msiAnchor: { stationId: "bachelor" }, stations: [
      { stationId: "job", stationType: "POSITION", titleRaw: "Synthetic role", organisationRaw: "Synthetic organisation", organisationCanonical: "Synthetic organisation", employmentForm: "EMPLOYED", chronologyIndex: 3, isCurrent: false, startDate: { precision: "MONTH", year: 2022, month: 3 }, endDate: null, branchCategory: "Dritter Sektor", positionCategory: "Forschung & Entwicklung" },
      station("bachelor", "Synthetic BA MSI", 2, "BACHELOR", 2015, 2019),
      station("training", "Synthetic training", 1, "VOCATIONAL", 2010, 2013),
      station("exchange", "Auslandssemester Social Innovation", 4, "OTHER", 2020, 2021),
    ] }],
  } as { sources: { syntheticId: string; snapshot: { elements: { snapshotDomain: string; snapshotData: Record<string, string>[] }[] } }[]; expected: Oracle[] };
}
