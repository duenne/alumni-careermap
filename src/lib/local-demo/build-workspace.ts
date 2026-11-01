import { createHash, randomUUID } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, delimiter } from "node:path";
import { demoRuntimeKeys, readLocalDemoConfiguration, type DemoEnvironment } from "./config";
import { loadInstallation } from "./installation";

const marker = ".careermap-v5-build.json";
const rootFiles = ["package.json", "package-lock.json", "next.config.ts", "tsconfig.json", "prisma.config.ts", "next-env.d.ts"];
const entryFiles = ["scripts/start-next.mjs", "scripts/check-local-demo-start.mjs"];
const roots = ["src", "public", "prisma"];
type Manifest = { mode: "v5-synthetic"; buildId: string; files: Record<string, string>; completedBuildId?: string };
const fail = (): never => { throw new Error("INVALID_LOCAL_DEMO_WORKSPACE"); };
const digest = (value: Buffer) => createHash("sha256").update(value).digest("hex");
const excluded = (path: string) => path.split(/[\\/]/).some(p => p.startsWith(".env") || [".local-fixtures", ".local-demo", "node_modules"].includes(p))
  || path.startsWith("src/generated") || /(?:\.test|\.type-test)\.[cm]?[jt]sx?$/.test(path);

/** Copy a source allowlist into a NEW directory. No git archive of HEAD: the
 * working tree includes the authorized uncommitted D1 files. No symlinks, env
 * files, source corpus, generated client, tests or arbitrary repository files.
 */
export function prepareDemoBuild(source: string, target: string): void {
  const from = resolve(source), to = resolve(target);
  if (existsSync(to) || to === from) fail();
  if (!relative(from, to).startsWith("..")) {
    const path = relative(from, to).replaceAll("\\", "/");
    if (!/^\.local-demo\/v5\/builds\/[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\/app$/.test(path)) fail();
    loadInstallation(join(from, ".local-demo", "v5"));
    let parent = dirname(to);
    while (parent !== from) { if (lstatSync(parent).isSymbolicLink()) fail(); parent = dirname(parent); }
  }
  mkdirSync(to, { mode: 0o700 });
  const files: Record<string, string> = {};
  function copy(path: string) {
    if (excluded(path)) return;
    const input = join(from, path), output = join(to, path), stat = lstatSync(input);
    if (stat.isSymbolicLink()) fail();
    if (stat.isDirectory()) {
      mkdirSync(output, { recursive: true });
      for (const name of readdirSync(input).sort()) copy(join(path, name));
    } else if (stat.isFile()) {
      const data = readFileSync(input); mkdirSync(dirname(output), { recursive: true });
      writeFileSync(output, data, { flag: "wx" }); files[path] = digest(data);
    } else fail();
  }
  rootFiles.forEach(copy); entryFiles.forEach(copy); roots.forEach(copy);
  writeFileSync(join(to, ".npmrc"), "", { flag: "wx", mode: 0o600 });
  writeFileSync(join(to, marker), JSON.stringify({ mode: "v5-synthetic", buildId: randomUUID(), files } satisfies Manifest), { flag: "wx", mode: 0o600 });
}

/** Only OS essentials enter a child. In particular no NODE_OPTIONS, injected
 * public vars, inherited DB URLs, OAuth config or npm user configuration.
 */
function childBase(env: DemoEnvironment): Record<string, string> {
  const result: Record<string, string> = { PATH: `${dirname(process.execPath)}${delimiter}${env.PATH ?? ""}`, NEXT_TELEMETRY_DISABLED: "1" };
  for (const key of ["HOME", "TMPDIR", "TEMP", "TMP", "SystemRoot", "WINDIR"]) if (env[key]) result[key] = env[key]!;
  return result;
}
export function demoBuildEnvironment(env: DemoEnvironment): Record<string, string> {
  return { ...childBase(env), NODE_ENV: "production", CAREERMAP_LOCAL_DEMO: "v5-synthetic" };
}
export function demoStartEnvironment(value: unknown, env: DemoEnvironment): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || Object.entries(value).some(([key, v]) => !demoRuntimeKeys.some(k => k === key) || typeof v !== "string")) fail();
  const configuration = value as Record<string, string>;
  readLocalDemoConfiguration(configuration);
  return { ...childBase(env), ...configuration };
}

export function assertDemoWorkspace(root: string, complete = false): Manifest {
  try {
    if (lstatSync(root).isSymbolicLink() || readdirSync(root).some(name => name.startsWith(".env")) || readFileSync(join(root, ".npmrc"), "utf8") !== "") fail();
    const raw = JSON.parse(readFileSync(join(root, marker), "utf8")) as Manifest;
    if (raw.mode !== "v5-synthetic" || typeof raw.buildId !== "string" || !raw.files || typeof raw.files !== "object") fail();
    for (const [path, hash] of Object.entries(raw.files)) {
      if (!path || path.startsWith("/") || path.split(/[\\/]/).includes("..") || excluded(path)
        || lstatSync(join(root, path)).isSymbolicLink() || digest(readFileSync(join(root, path))) !== hash) fail();
    }
    if (complete && (!raw.completedBuildId || readFileSync(join(root, ".next", "BUILD_ID"), "utf8").trim() !== raw.completedBuildId)) fail();
    return raw;
  } catch { return fail(); }
}

export function markDemoBuildComplete(root: string): void {
  // Next updates next-env.d.ts/tsconfig during a successful build. Refresh only
  // the previously allowlisted file hashes, never add credentials or raw files.
  const raw = JSON.parse(readFileSync(join(root, marker), "utf8")) as Manifest;
  for (const path of Object.keys(raw.files)) raw.files[path] = digest(readFileSync(join(root, path)));
  raw.completedBuildId = readFileSync(join(root, ".next", "BUILD_ID"), "utf8").trim();
  writeFileSync(join(root, marker), JSON.stringify(raw), { mode: 0o600 });
  assertDemoWorkspace(root, true);
}
