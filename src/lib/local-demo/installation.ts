import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readLocalDemoConfiguration } from "./config";

export type Bootstrap = { image: string; imageId: string; dockerEndpoint: string; composeSha256: string; appPort?: number; dbPort?: number };
export type Installation = {
  version: 1; purpose: "SYNTHETIC_DEMO_ONLY"; installationId: string; operatorId: string; pilotProgramId: string;
  projectName: string; volumeName: string; image: string; imageId: string; dockerEndpoint: string; composeSha256: string;
  appPort: number; dbPort: number; volumeReady: boolean; clusterId?: string; databaseOid?: number;
  buildPath?: string; surveyAId?: string; surveyBId?: string; participationSurveyId?: string; linkedInEnabled?: true;
};
export type LocalLinkedInCredentials = { clientId: string; clientSecret: string; redirectUri: string };
export type InstallationSecrets = { adminDatabasePassword: string; databasePassword: string; administratorPassword: string; linkedIn?: LocalLinkedInCredentials };
export class InstallationError extends Error { constructor(readonly code = "INVALID_DEMO_INSTALLATION") { super(code); this.name = "InstallationError"; } }
const fail = (code?: string): never => { throw new InstallationError(code); };
const uuid = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
const port = (v: unknown): v is number => Number.isInteger(v) && Number(v) >= 1024 && Number(v) <= 65535;
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
export const installationLabels = (i: Installation) => ({ "de.careermap.v5.installation": i.installationId, "de.careermap.v5.purpose": "SYNTHETIC_DEMO_ONLY" });

function privatePath(path: string, directory = false) {
  const stat = lstatSync(path);
  if (stat.isSymbolicLink() || (directory ? !stat.isDirectory() : !stat.isFile()) || (stat.mode & 0o077) !== 0
    || process.getuid && stat.uid !== process.getuid()) fail("UNSAFE_DEMO_CONFIGURATION_FILE");
}
function validInstallation(v: unknown): v is Installation {
  if (!record(v)) return false;
  const allowed = ["version", "purpose", "installationId", "operatorId", "pilotProgramId", "projectName", "volumeName", "image", "imageId", "dockerEndpoint", "composeSha256", "appPort", "dbPort", "volumeReady", "clusterId", "databaseOid", "buildPath", "surveyAId", "surveyBId", "participationSurveyId", "linkedInEnabled"];
  return Object.keys(v).every(k => allowed.includes(k)) && v.version === 1 && v.purpose === "SYNTHETIC_DEMO_ONLY"
    && uuid(v.installationId) && uuid(v.operatorId) && uuid(v.pilotProgramId)
    && v.projectName === `careermap-v5-${v.installationId}` && v.volumeName === `careermap_v5_${v.installationId.replaceAll("-", "")}_pg17`
    && typeof v.image === "string" && /^postgres@sha256:[a-f0-9]{64}$/.test(v.image)
    && typeof v.imageId === "string" && /^sha256:[a-f0-9]{64}$/.test(v.imageId)
    && typeof v.dockerEndpoint === "string" && /^unix:\/\/\/.+/.test(v.dockerEndpoint)
    && typeof v.composeSha256 === "string" && /^[a-f0-9]{64}$/.test(v.composeSha256)
    && port(v.appPort) && port(v.dbPort) && v.appPort !== v.dbPort && typeof v.volumeReady === "boolean"
    && (v.clusterId === undefined || typeof v.clusterId === "string" && /^\d+$/.test(v.clusterId))
    && (v.databaseOid === undefined || Number.isSafeInteger(v.databaseOid) && Number(v.databaseOid) > 0)
    && (v.buildPath === undefined || typeof v.buildPath === "string" && /^builds\/[a-f0-9-]{36}\/app$/.test(v.buildPath))
    && (v.surveyAId === undefined || uuid(v.surveyAId)) && (v.surveyBId === undefined || uuid(v.surveyBId))
    && (v.participationSurveyId === undefined || uuid(v.participationSurveyId) && v.participationSurveyId === v.surveyBId && v.participationSurveyId !== v.surveyAId)
    && (v.linkedInEnabled === undefined || v.linkedInEnabled === true && uuid(v.participationSurveyId));
}
function readPrivateLinkedIn(root: string): LocalLinkedInCredentials {
  const path = join(root, "linkedin.json"); privatePath(path);
  const value: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!record(value) || Object.keys(value).sort().join() !== "clientId,clientSecret,redirectUri" || Object.values(value).some(v => typeof v !== "string" || !v.trim())) return fail("INVALID_LINKEDIN_CONFIGURATION");
  return value as LocalLinkedInCredentials;
}
export function runtimeConfiguration(i: Installation, s: InstallationSecrets): Record<string, string> {
  if (i.linkedInEnabled && !s.linkedIn) fail("LINKEDIN_CONFIGURATION_REQUIRED");
  return { NODE_ENV: "production", CAREERMAP_LOCAL_DEMO: i.participationSurveyId ? "v5-participation" : "v5-synthetic", CAREERMAP_LOCAL_DEMO_PURPOSE: i.participationSurveyId ? "LOCAL_PARTICIPATION" : "SYNTHETIC_DEMO_ONLY",
    ...(i.participationSurveyId ? { CAREERMAP_LOCAL_PARTICIPATION_SURVEY_ID: i.participationSurveyId } : {}),
    ...(i.linkedInEnabled ? { CAREERMAP_LOCAL_LINKEDIN_CLIENT_ID: s.linkedIn!.clientId, CAREERMAP_LOCAL_LINKEDIN_CLIENT_SECRET: s.linkedIn!.clientSecret, CAREERMAP_LOCAL_LINKEDIN_REDIRECT_URI: s.linkedIn!.redirectUri } : {}),
    CAREERMAP_LOCAL_DEMO_INSTALLATION_ID: i.installationId, CAREERMAP_LOCAL_DEMO_OPERATOR_ID: i.operatorId,
    ...(i.surveyAId ? { CAREERMAP_LOCAL_DEMO_SYNTHETIC_SURVEY_ID: i.surveyAId } : {}),
    CAREERMAP_LOCAL_DEMO_MSI_PROGRAM_ID: i.pilotProgramId, CAREERMAP_LOCAL_DEMO_OPERATOR_KIND: "INSTITUTION",
    CAREERMAP_LOCAL_DEMO_ORIGIN: `http://127.0.0.1:${i.appPort}`,
    CAREERMAP_LOCAL_DEMO_DATABASE_URL: `postgresql://careermap_v5_demo:${s.databasePassword}@127.0.0.1:${i.dbPort}/careermap_v5_demo`,
    CAREERMAP_SURVEY_ADMIN_TOKEN: s.administratorPassword };
}
export function loadInstallation(root: string): { installation: Installation; secrets: InstallationSecrets } {
  try {
    privatePath(root, true); privatePath(join(root, "installation.json")); privatePath(join(root, "secrets.json")); privatePath(join(root, "runtime.json")); privatePath(join(root, "admin-password"));
    const installation: unknown = JSON.parse(readFileSync(join(root, "installation.json"), "utf8"));
    const secrets: unknown = JSON.parse(readFileSync(join(root, "secrets.json"), "utf8"));
    if (!validInstallation(installation) || !record(secrets) || Object.keys(secrets).sort().join() !== "adminDatabasePassword,administratorPassword,databasePassword"
      || Object.values(secrets).some(v => typeof v !== "string" || !/^[a-f0-9]{64}$/.test(v)) || new Set(Object.values(secrets)).size !== 3) return fail();
    const typed = secrets as InstallationSecrets;
    if (installation.linkedInEnabled) typed.linkedIn = readPrivateLinkedIn(root);
    const expected = runtimeConfiguration(installation, typed);
    if (readFileSync(join(root, "admin-password"), "utf8") !== typed.adminDatabasePassword) return fail();
    const runtime = JSON.parse(readFileSync(join(root, "runtime.json"), "utf8"));
    // Older installations did not expose their recorded seed Survey ID to the
    // app. Absence keeps details redacted until the next normal save/build.
    // A present but different ID is never accepted or silently overwritten.
    if (!Object.hasOwn(runtime, "CAREERMAP_LOCAL_DEMO_SYNTHETIC_SURVEY_ID")) delete expected.CAREERMAP_LOCAL_DEMO_SYNTHETIC_SURVEY_ID;
    if (JSON.stringify(runtime) !== JSON.stringify(expected)) return fail();
    readLocalDemoConfiguration(expected);
    return { installation, secrets: typed };
  } catch (error) { if (error instanceof InstallationError) throw error; return fail(); }
}
export function createInstallation(root: string, bootstrap: Bootstrap) {
  if (existsSync(root)) {
    const current = loadInstallation(root);
    if (["image", "imageId", "dockerEndpoint", "composeSha256"].some(key => current.installation[key as keyof Installation] !== bootstrap[key as keyof Bootstrap])) fail();
    return current;
  }
  const id = randomUUID();
  const installation: Installation = { version: 1, purpose: "SYNTHETIC_DEMO_ONLY", installationId: id, operatorId: randomUUID(), pilotProgramId: randomUUID(),
    projectName: `careermap-v5-${id}`, volumeName: `careermap_v5_${id.replaceAll("-", "")}_pg17`, ...bootstrap, appPort: bootstrap.appPort ?? 3114, dbPort: bootstrap.dbPort ?? 5435, volumeReady: false };
  if (!validInstallation(installation)) return fail();
  const secrets = { adminDatabasePassword: randomBytes(32).toString("hex"), databasePassword: randomBytes(32).toString("hex"), administratorPassword: randomBytes(32).toString("hex") };
  mkdirSync(root, { mode: 0o700 });
  for (const [name, value] of [["installation.json", JSON.stringify(installation)], ["secrets.json", JSON.stringify(secrets)], ["runtime.json", JSON.stringify(runtimeConfiguration(installation, secrets))], ["admin-password", secrets.adminDatabasePassword]]) {
    writeFileSync(join(root, name), value, { flag: "wx", mode: 0o600 });
  }
  return loadInstallation(root);
}
export function saveInstallation(root: string, next: Installation) {
  const { installation: old, secrets } = loadInstallation(root);
  if (!validInstallation(next) || ["installationId", "operatorId", "pilotProgramId", "projectName", "volumeName", "image", "imageId", "dockerEndpoint", "composeSha256", "appPort", "dbPort"].some(k => old[k as keyof Installation] !== next[k as keyof Installation])
    || old.volumeReady && !next.volumeReady || old.clusterId && old.clusterId !== next.clusterId || old.databaseOid && old.databaseOid !== next.databaseOid
    || old.surveyAId && old.surveyAId !== next.surveyAId || old.surveyBId && old.surveyBId !== next.surveyBId) fail();
  if (next.linkedInEnabled) secrets.linkedIn = readPrivateLinkedIn(root);
  const nextRuntime = runtimeConfiguration(next, secrets);
  readLocalDemoConfiguration(nextRuntime);
  const temporary = join(root, `.installation-${randomUUID()}.tmp`);
  writeFileSync(temporary, JSON.stringify(next), { flag: "wx", mode: 0o600 }); renameSync(temporary, join(root, "installation.json"));
  // The legacy purpose/volume labels identify the original bootstrap. The
  // explicit runtime mode determines whether the independent survey accepts data.
  const runtime = join(root, `.runtime-${randomUUID()}.tmp`);
  writeFileSync(runtime, JSON.stringify(nextRuntime), { flag: "wx", mode: 0o600 }); renameSync(runtime, join(root, "runtime.json"));
}

export function assertVolumeIdentity(actual: unknown, i: Installation): void {
  if (!record(actual) || actual.Name !== i.volumeName || !record(actual.Labels)
    || Object.entries(installationLabels(i)).some(([k, v]) => (actual.Labels as Record<string, unknown>)[k] !== v)) fail("FOREIGN_OR_MISSING_DEMO_VOLUME");
}
export function assertContainerIdentity(actual: unknown, i: Installation): void {
  if (!record(actual) || actual.Image !== i.imageId || !record(actual.Config) || !record(actual.Config.Labels)
    || !Array.isArray(actual.Mounts) || !record(actual.HostConfig) || !record(actual.HostConfig.PortBindings)) return fail("FOREIGN_DEMO_CONTAINER");
  const config = actual.Config as Record<string, unknown>, labels = config.Labels as Record<string, unknown>;
  if (Object.entries({ ...installationLabels(i), "com.docker.compose.project": i.projectName, "com.docker.compose.service": "db" }).some(([k, v]) => labels[k] !== v)) fail("FOREIGN_DEMO_CONTAINER");
  const mounts = actual.Mounts as Record<string, unknown>[];
  if (mounts.filter(m => m.Type === "volume").length !== 1 || !mounts.some(m => m.Type === "volume" && m.Name === i.volumeName && m.Destination === "/var/lib/postgresql/data")) fail("FOREIGN_DEMO_CONTAINER");
  const bindings = (actual.HostConfig as Record<string, unknown>).PortBindings as Record<string, unknown>;
  const ports = bindings["5432/tcp"];
  if (Object.keys(bindings).length !== 1 || !Array.isArray(ports) || ports.length !== 1 || ports[0].HostIp !== "127.0.0.1" || ports[0].HostPort !== String(i.dbPort)) fail("NONLOCAL_DEMO_BINDING");
}
export function assertClusterIdentity(actual: unknown, i: Installation): void {
  if (!record(actual) || actual.database !== "careermap_v5_demo" || actual.role !== "careermap_v5_admin" || Math.floor(Number(actual.version) / 10000) !== 17
    || typeof actual.clusterId !== "string" || !actual.clusterId || !Number.isSafeInteger(actual.databaseOid)
    || i.clusterId !== undefined && i.clusterId !== actual.clusterId || i.databaseOid !== undefined && i.databaseOid !== actual.databaseOid) fail("DEMO_CLUSTER_IDENTITY_MISMATCH");
}
