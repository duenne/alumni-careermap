export const ANALYTICS_DATABASE = "careermap_analytics_demo";
export const ANALYTICS_ROLE = "careermap_analytics";
export const DEMO_PROGRAM = "Management Sozialer Innovationen · SYNTHETIC DEMO phase-d-v1";
export const DEMO_INSTITUTION = "Hochschule München · SYNTHETIC DEMO";

export function validateAnalyticsDatabaseUrl(value: string | undefined): string {
  try {
    const url = new URL(value ?? "");
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !["localhost", "127.0.0.1"].includes(url.hostname)
      || url.pathname !== `/${ANALYTICS_DATABASE}` || url.username !== ANALYTICS_ROLE || !url.password || url.search || url.hash) throw new Error();
    return value!;
  } catch { throw new Error("UNSAFE_ANALYTICS_DATABASE"); }
}
