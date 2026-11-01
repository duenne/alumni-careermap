import { validateOperatorScope, type OperatorScope } from "../operator-scope";
import { validateDemoDatabaseUrl } from "../demo-seed/safety";

export type DemoEnvironment = Record<string, string | undefined>;
export type LocalDemoConfiguration = {
  mode: "v5-synthetic"; installationId: string; origin: string; databaseUrl: string;
  pilotProgramId: string; operatorScope: OperatorScope; administratorPassword: string;
};
export const localDemoRequested = (env: DemoEnvironment = process.env) => env.CAREERMAP_LOCAL_DEMO !== undefined;
export const localDemoInstitutionName = (id: string) => `SYNTHETISCH / DEMO – V5 ${id}`;
export const demoRuntimeKeys = ["NODE_ENV", "CAREERMAP_LOCAL_DEMO", "CAREERMAP_LOCAL_DEMO_PURPOSE", "CAREERMAP_LOCAL_DEMO_INSTALLATION_ID",
  "CAREERMAP_LOCAL_DEMO_ORIGIN", "CAREERMAP_LOCAL_DEMO_DATABASE_URL", "CAREERMAP_LOCAL_DEMO_OPERATOR_ID", "CAREERMAP_LOCAL_DEMO_MSI_PROGRAM_ID",
  "CAREERMAP_LOCAL_DEMO_OPERATOR_KIND", "CAREERMAP_LOCAL_DEMO_OPERATOR_FACULTY", "CAREERMAP_SURVEY_ADMIN_TOKEN"] as const;
const uuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export class LocalDemoConfigurationError extends Error {
  constructor() { super("INVALID_LOCAL_DEMO_CONFIGURATION"); this.name = "LocalDemoConfigurationError"; }
}

export function assertLocalDemoStartArguments(args: string[], config: LocalDemoConfiguration): void {
  const host = args.indexOf("--hostname"), port = args.indexOf("--port");
  if (host < 0 || port < 0 || args[host + 1] !== "127.0.0.1" || args[port + 1] !== new URL(config.origin).port
    || args.filter(v => v === "--hostname").length !== 1 || args.filter(v => v === "--port").length !== 1
    || args.some(v => v === "-H" || v === "-p" || v.startsWith("--hostname=") || v.startsWith("--port="))) throw new LocalDemoConfigurationError();
}

/** Pure server configuration validation. No dotenv, I/O or ambient DB fallback.
 * Installation identity is bound to an explicit existing catalog root name/ID;
 * this is operational metadata using existing fields, not a new domain entity.
 */
export function readLocalDemoConfiguration(env: DemoEnvironment = process.env): LocalDemoConfiguration {
  try {
    if (env.NODE_ENV !== "production" || env.CAREERMAP_LOCAL_DEMO !== "v5-synthetic" || env.CAREERMAP_LOCAL_DEMO_PURPOSE !== "SYNTHETIC_DEMO_ONLY") throw new Error();
    for (const [key, value] of Object.entries(env)) {
      if (!value || value === "0") continue;
      if (key.startsWith("CAREERMAP_DEV_") || /^CAREERMAP_.*_E2E(?:_|$)/.test(key) || key.startsWith("LINKEDIN_")
        || ["DATABASE_URL", "CAREERMAP_MAPPING_DATABASE_URL", "CAREERMAP_ANALYTICS_DATABASE_URL", "CAREERMAP_SYNTHETIC_DONATION",
          "CAREERMAP_MAPPING_OPERATOR_ID", "CAREERMAP_MSI_PROGRAM_ID", "CAREERMAP_SURVEY_OPERATOR_KIND", "CAREERMAP_SURVEY_OPERATOR_FACULTY"].includes(key)) throw new Error();
    }
    const installationId = env.CAREERMAP_LOCAL_DEMO_INSTALLATION_ID;
    const pilotProgramId = env.CAREERMAP_LOCAL_DEMO_MSI_PROGRAM_ID;
    if (!uuid(installationId) || !uuid(pilotProgramId)) throw new Error();
    const origin = env.CAREERMAP_LOCAL_DEMO_ORIGIN;
    const url = new URL(origin ?? "");
    if (url.origin !== origin || url.protocol !== "http:" || url.hostname !== "127.0.0.1" || !url.port
      || Number(url.port) < 1024 || Number(url.port) > 65535 || url.username || url.password) throw new Error();
    const databaseUrl = validateDemoDatabaseUrl(env.CAREERMAP_LOCAL_DEMO_DATABASE_URL);
    const database = new URL(databaseUrl);
    if (database.pathname !== "/careermap_v5_demo" || database.port === url.port) throw new Error();
    const administratorPassword = env.CAREERMAP_SURVEY_ADMIN_TOKEN;
    if (!administratorPassword || administratorPassword.length < 32 || /\s/u.test(administratorPassword)
      || administratorPassword === decodeURIComponent(database.password)) throw new Error();
    const kind = env.CAREERMAP_LOCAL_DEMO_OPERATOR_KIND;
    if (kind !== "FACULTY" && env.CAREERMAP_LOCAL_DEMO_OPERATOR_FACULTY !== undefined) throw new Error();
    const operatorScope = validateOperatorScope({ kind, institutionId: env.CAREERMAP_LOCAL_DEMO_OPERATOR_ID,
      ...(kind === "FACULTY" ? { faculty: env.CAREERMAP_LOCAL_DEMO_OPERATOR_FACULTY } : {}) });
    return { mode: "v5-synthetic", installationId: installationId.toLowerCase(), pilotProgramId: pilotProgramId.toLowerCase(), origin,
      databaseUrl, administratorPassword, operatorScope };
  } catch { throw new LocalDemoConfigurationError(); }
}
