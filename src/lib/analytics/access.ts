import { allowDevImport } from "../dev-import/access";
export function allowAnalytics(headers: Headers, env: { NODE_ENV?: string; CAREERMAP_DEV_ANALYTICS?: string } = process.env) {
  return env.CAREERMAP_DEV_ANALYTICS === "1" && allowDevImport(headers, { NODE_ENV: env.NODE_ENV, CAREERMAP_DEV_IMPORT: "1" });
}
