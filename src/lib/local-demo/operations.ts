import { createHash, randomUUID } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, openSync, closeSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import pg from "pg";
import { parse as parseEnvironment } from "dotenv";
import type { PrismaClient } from "../../generated/prisma/client";
import { assertDemoWorkspace, demoBuildEnvironment, markDemoBuildComplete, prepareDemoBuild } from "./build-workspace";
import { localDemoInstitutionName, readLocalDemoConfiguration } from "./config";
import { assertLocalDemoDatabase } from "./connection-identity";
import { createInstallation, loadInstallation, saveInstallation, runtimeConfiguration, installationLabels, assertContainerIdentity, assertVolumeIdentity, assertClusterIdentity,
  InstallationError, type Installation, type InstallationSecrets } from "./installation";

type ClusterIdentity = { database: string; role: string; version: string; clusterId: string; databaseOid: number };
type ServerRecord = { pid: number; command: string; started: string; app: string };
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const fail = (code: string): never => { throw new InstallationError(code); };
const uuid = (v: string) => /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);

export async function assertPortFree(port: number): Promise<void> {
  await new Promise<void>((done, reject) => {
    const socket = createServer();
    socket.once("error", () => reject(new InstallationError("DEMO_PORT_ALREADY_IN_USE")));
    socket.listen({ host: "127.0.0.1", port, exclusive: true }, () => socket.close(() => done()));
  });
}

/** All paths/identities are installation-owned. No URL/Compose/host/volume
 * arguments come from HTTP, inherited DB env, or arbitrary command passthrough.
 * Normal operations never remove volumes and never implicitly seed or migrate.
 */
export class LocalDemoOperations {
  readonly root: string;
  readonly composeFile: string;
  constructor(readonly source: string) { this.source = resolve(source); this.root = join(this.source, ".local-demo", "v5"); this.composeFile = join(this.source, "compose.v5-demo.yaml"); }
  private env(): NodeJS.ProcessEnv { const env = demoBuildEnvironment(process.env) as NodeJS.ProcessEnv; delete env.CAREERMAP_LOCAL_DEMO; return env; }
  private run(command: string, args: string[], options: { env?: NodeJS.ProcessEnv; cwd?: string; inherit?: boolean } = {}) {
    const result = spawnSync(command, args, { env: options.env ?? this.env(), cwd: options.cwd ?? this.root, encoding: "utf8", ...(options.inherit ? { stdio: "inherit" as const } : {}) });
    if (result.error || result.status !== 0) fail("DEMO_COMMAND_FAILED");
    return result.stdout?.trim() ?? "";
  }
  private docker(i: Installation, args: string[]) { return this.run("docker", ["--host", i.dockerEndpoint, ...args]); }
  private context() {
    const c = loadInstallation(this.root);
    if (hash(readFileSync(this.composeFile)) !== c.installation.composeSha256) fail("DEMO_COMPOSE_CHANGED");
    return c;
  }
  private compose(i: Installation, args: string[]) {
    const empty = join(this.root, "compose.env");
    if (!existsSync(empty)) writeFileSync(empty, "", { flag: "wx", mode: 0o600 });
    if (readFileSync(empty, "utf8") !== "") fail("UNEXPECTED_COMPOSE_ENV");
    const env = { ...this.env(), CAREERMAP_V5_IMAGE: i.image, CAREERMAP_V5_DB_PORT: String(i.dbPort), CAREERMAP_V5_VOLUME: i.volumeName,
      CAREERMAP_V5_INSTALLATION_ID: i.installationId, CAREERMAP_V5_ADMIN_PASSWORD_FILE: join(this.root, "admin-password") };
    return this.run("docker", ["--host", i.dockerEndpoint, "compose", "--env-file", empty, "--project-directory", this.root, "--project-name", i.projectName, "-f", this.composeFile, ...args], { env });
  }
  private volume(i: Installation) {
    const names = this.docker(i, ["volume", "ls", "--format", "{{.Name}}", "--filter", `name=^${i.volumeName}$`]).split("\n").filter(Boolean);
    if (!names.includes(i.volumeName)) fail("FOREIGN_OR_MISSING_DEMO_VOLUME");
    const [actual] = JSON.parse(this.docker(i, ["volume", "inspect", i.volumeName])); assertVolumeIdentity(actual, i);
  }
  private container(i: Installation, required = true): string | undefined {
    const ids = this.docker(i, ["ps", "-a", "--filter", `label=com.docker.compose.project=${i.projectName}`, "--format", "{{.ID}}"] ).split("\n").filter(Boolean);
    if (ids.length > 1 || required && ids.length !== 1) fail("MISSING_OR_AMBIGUOUS_DEMO_CONTAINER");
    if (!ids.length) return;
    const [actual] = JSON.parse(this.docker(i, ["inspect", ids[0]])); assertContainerIdentity(actual, i); return ids[0];
  }
  private adminUrl(i: Installation, s: InstallationSecrets) { return `postgresql://careermap_v5_admin:${s.adminDatabasePassword}@127.0.0.1:${i.dbPort}/careermap_v5_demo`; }
  private async admin<T>(work: (client: pg.Client, i: Installation, s: InstallationSecrets) => Promise<T>): Promise<T> {
    const { installation: i, secrets: s } = this.context(); this.volume(i); this.container(i);
    const client = new pg.Client({ connectionString: this.adminUrl(i, s), connectionTimeoutMillis: 3000, query_timeout: 10000 });
    try {
      await client.connect();
      const { rows } = await client.query<ClusterIdentity>(`SELECT current_database() AS database, current_user AS role,
        current_setting('server_version_num') AS version, c.system_identifier::text AS "clusterId", d.oid::integer AS "databaseOid"
        FROM pg_control_system() c JOIN pg_database d ON d.datname = current_database()`);
      assertClusterIdentity(rows[0], i);
      if (!i.clusterId) { i.clusterId = rows[0].clusterId; i.databaseOid = rows[0].databaseOid; saveInstallation(this.root, i); }
      return await work(client, i, s);
    } finally { await client.end(); }
  }
  private async runtime<T>(work: (client: PrismaClient, i: Installation) => Promise<T>): Promise<T> {
    await this.admin(async () => {});
    const { installation: i, secrets: s } = this.context(), config = readLocalDemoConfiguration(runtimeConfiguration(i, s));
    const { PrismaClient } = await import("../../generated/prisma/client");
    const { PrismaPg } = await import("@prisma/adapter-pg");
    const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: config.databaseUrl, connectionTimeoutMillis: 3000 }) });
    try { await assertLocalDemoDatabase(client, config); return await work(client, i); }
    finally { await client.$disconnect(); }
  }
  async init() {
    if (existsSync(this.root)) {
      const { installation: i } = this.context();
      if (i.volumeReady) this.volume(i); else this.createVolume(i);
      return { outcome: "UNCHANGED", installationId: i.installationId, origin: `http://127.0.0.1:${i.appPort}` };
    }
    const endpoint = JSON.parse(this.run("docker", ["context", "inspect", "--format", "{{json .Endpoints.docker.Host}}"], { cwd: this.source }));
    if (typeof endpoint !== "string" || !endpoint.startsWith("unix:///")) fail("LOCAL_DOCKER_REQUIRED");
    const docker = (args: string[]) => this.run("docker", ["--host", endpoint, ...args], { cwd: this.source });
    if (Number(docker(["version", "--format", "{{.Server.Version}}"] ).split(".")[0]) < 28) fail("DOCKER_28_OR_LATER_REQUIRED");
    const [image] = JSON.parse(docker(["image", "inspect", "postgres:17-bookworm"]));
    const digest = (image.RepoDigests as string[]).find(v => /^postgres@sha256:/.test(v));
    if (!digest) return fail("PINNED_POSTGRES17_IMAGE_REQUIRED");
    await assertPortFree(3114); await assertPortFree(5435);
    const parent = join(this.source, ".local-demo");
    if (!existsSync(parent)) mkdirSync(parent, { mode: 0o700 });
    if (lstatSync(parent).isSymbolicLink() || (lstatSync(parent).mode & 0o077) !== 0) fail("UNSAFE_DEMO_CONFIGURATION_FILE");
    const { installation: i } = createInstallation(this.root, { image: digest, imageId: image.Id, dockerEndpoint: endpoint, composeSha256: hash(readFileSync(this.composeFile)) });
    this.createVolume(i);
    return { outcome: "CREATED", installationId: i.installationId, origin: `http://127.0.0.1:${i.appPort}` };
  }
  private createVolume(i: Installation) {
    const names = this.docker(i, ["volume", "ls", "--format", "{{.Name}}", "--filter", `name=^${i.volumeName}$`]).split("\n");
    if (i.volumeReady) { this.volume(i); return; }
    if (!names.includes(i.volumeName)) this.docker(i, ["volume", "create", ...Object.entries(installationLabels(i)).flatMap(([k, v]) => ["--label", `${k}=${v}`]), i.volumeName]);
    this.volume(i); i.volumeReady = true; saveInstallation(this.root, i);
  }
  async dbUp() {
    const { installation: i } = this.context(); this.volume(i);
    const existing = this.container(i, false); if (!existing) await assertPortFree(i.dbPort);
    const rendered = JSON.parse(this.compose(i, ["config", "--format", "json"]));
    const ports = rendered.services?.db?.ports;
    if (Object.keys(rendered.services ?? {}).join() !== "db" || rendered.services.db.image !== i.image || !Array.isArray(ports) || ports.length !== 1
      || ports[0].host_ip !== "127.0.0.1" || String(ports[0].published) !== String(i.dbPort) || Number(ports[0].target) !== 5432
      || rendered.volumes?.v5_data?.external !== true || rendered.volumes.v5_data.name !== i.volumeName) fail("UNSAFE_DEMO_COMPOSE");
    this.compose(i, ["up", "--detach", "--wait", "db"]); this.container(i);
    await this.admin(async () => {}); return { database: "careermap_v5_demo", persistent: true };
  }
  async dbStop() { const { installation: i } = this.context(); this.volume(i); this.container(i); this.compose(i, ["stop", "--timeout", "30", "db"]); return { stopped: "database", volumeRetained: true }; }
  async dbRestart(recreate = false) {
    await this.admin(async () => {}); const { installation: i } = this.context();
    if (recreate) { this.compose(i, ["stop", "--timeout", "30", "db"]); this.compose(i, ["rm", "--force", "db"]); return this.dbUp(); }
    this.compose(i, ["restart", "--timeout", "30", "db"]);
    for (let n = 0; n < 60; n++) { try { await this.admin(async () => {}); return { restarted: "database", volumeRetained: true }; } catch { await delay(500); } }
    return fail("DEMO_DATABASE_RESTART_FAILED");
  }
  async migrate() {
    await this.admin(async () => {}); const { installation: i, secrets: s } = this.context();
    const file = join(this.root, "migrate.config.ts");
    const text = `import { defineConfig } from "prisma/config";\nexport default defineConfig({schema:${JSON.stringify(join(this.source, "prisma/schema.prisma"))},migrations:{path:${JSON.stringify(join(this.source, "prisma/migrations"))}},datasource:{url:process.env.DATABASE_URL ?? ""}});\n`;
    if (!existsSync(file)) writeFileSync(file, text, { flag: "wx", mode: 0o600 });
    if (readFileSync(file, "utf8") !== text) fail("DEMO_MIGRATION_CONFIG_CHANGED");
    const env = { ...this.env(), DATABASE_URL: this.adminUrl(i, s) };
    for (const args of [["migrate", "deploy"], ["generate"]]) this.run(process.execPath, [join(this.source, "node_modules/prisma/build/index.js"), ...args, "--config", file], { env, inherit: true });
    await this.admin(async (client, _installation, secrets) => {
      const { rows } = await client.query("SELECT rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls FROM pg_roles WHERE rolname='careermap_v5_demo'");
      if (!rows.length) {
        const statement = await client.query("SELECT format('CREATE ROLE careermap_v5_demo LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L', $1::text) AS sql", [secrets.databasePassword]);
        await client.query(statement.rows[0].sql);
      } else if (Object.values(rows[0]).some(Boolean)) fail("UNSAFE_EXISTING_DEMO_ROLE");
      await client.query("REVOKE CREATE ON SCHEMA public FROM PUBLIC");
      await client.query("GRANT CONNECT ON DATABASE careermap_v5_demo TO careermap_v5_demo");
      await client.query("GRANT USAGE ON SCHEMA public TO careermap_v5_demo");
      await client.query('GRANT SELECT, INSERT, UPDATE, DELETE ON "Institution", "Program", "Survey", "Alumni", "Degree", "CareerStep", "Organisation", "AlumniTimelineItem", "SurveyResponse", "AlumniContact" TO careermap_v5_demo');
    });
    return { migrations: "deployed", role: "restricted" };
  }
  async catalogInit() {
    return this.admin(async (client, i) => {
      await client.query("BEGIN");
      try {
        await client.query("SELECT pg_advisory_xact_lock(171205, 2)");
        const inst = await client.query('SELECT name FROM "Institution" WHERE id=$1', [i.operatorId]);
        const name = localDemoInstitutionName(i.installationId);
        if (!inst.rows.length) await client.query('INSERT INTO "Institution" (id,name) VALUES ($1,$2)', [i.operatorId, name]);
        else if (inst.rows[0].name !== name) fail("DEMO_CATALOG_MISMATCH");
        const program = await client.query('SELECT name,"institutionId",faculty FROM "Program" WHERE id=$1', [i.pilotProgramId]);
        if (!program.rows.length) await client.query('INSERT INTO "Program" (id,name,"institutionId") VALUES ($1,$2,$3)', [i.pilotProgramId, "Management Sozialer Innovationen", i.operatorId]);
        else if (program.rows[0].name !== "Management Sozialer Innovationen" || program.rows[0].institutionId !== i.operatorId || program.rows[0].faculty !== null) fail("DEMO_CATALOG_MISMATCH");
        await client.query("COMMIT"); return { catalog: "ready", operatorId: i.operatorId, pilotProgramId: i.pilotProgramId };
      } catch (error) { await client.query("ROLLBACK"); throw error; }
    });
  }
  private fixture(i: Installation) {
    const sourceText = readFileSync(join(this.source, ".local-fixtures/phase-d/all_linkedin_snapshots.json"), "utf8");
    const expectedText = readFileSync(join(this.source, ".local-fixtures/phase-d/all_expected_normalized.json"), "utf8");
    return { sourceText, expectedText, policy: "v5-demo-phase-d-100-v1", referenceProgramId: i.pilotProgramId };
  }
  async seed(confirmed: boolean) {
    if (this.context().installation.participationSurveyId) fail("PARTICIPATION_MODE_BLOCKS_SEED");
    if (!confirmed) fail("SYNTHETIC_REFERENCE_CONFIRMATION_REQUIRED");
    await this.runtime(async (client, i) => { if (i.surveyAId && !await client.survey.findUnique({ where: { id: i.surveyAId } })) fail("SEEDED_DEMO_SURVEY_MISSING"); });
    const { installation: i, secrets: s } = this.context();
    const { verifyDemoSource } = await import("../demo-seed/source-policy");
    const input = this.fixture(i), verified = verifyDemoSource(input.policy, input.sourceText, input.expectedText);
    const expected = verified.expected as { syntheticId: string; msiAnchor: { stationId: string } }[];
    const selections = expected.map(p => ({ syntheticId: p.syntheticId, stationId: p.msiAnchor.stationId, programId: i.pilotProgramId, confirmation: "SYNTHETIC_TEST_ONLY" }));
    const { persistV5DemoSeed } = await import("../demo-seed/persist");
    const result = await persistV5DemoSeed({ ...input, selections }, { databaseUrl: runtimeConfiguration(i, s).CAREERMAP_LOCAL_DEMO_DATABASE_URL!,
      pilotProgramId: i.pilotProgramId, operatorScope: { kind: "INSTITUTION", institutionId: i.operatorId }, purpose: "SYNTHETIC_DEMO_ONLY", catalogPolicy: "SEPARATE_LABELS_NO_CATEGORIES" });
    if (i.surveyAId && i.surveyAId !== result.surveyId) fail("DEMO_SEED_ID_CHANGED");
    saveInstallation(this.root, { ...i, surveyAId: result.surveyId }); return result;
  }
  private process(pid: number) {
    if (!Number.isSafeInteger(pid) || pid <= 1) fail("INVALID_DEMO_SERVER_PID");
    const query = (field: string) => spawnSync("ps", ["-ww", "-p", String(pid), "-o", `${field}=`], { encoding: "utf8" });
    const command = query("command"); if (command.status !== 0) return null;
    const started = query("lstart"); if (started.status !== 0) return null;
    return { command: command.stdout.trim(), started: started.stdout.trim() };
  }
  private server(): ServerRecord | undefined {
    const path = join(this.root, "server.json"); if (!existsSync(path)) return;
    const s = JSON.parse(readFileSync(path, "utf8")) as ServerRecord;
    const actual = this.process(s.pid);
    if (!actual) return;
    if (actual.command !== s.command || actual.started !== s.started || !s.command.includes(join(this.source, "scripts/local-demo-start.mjs")) || !s.command.includes(s.app)
      || !s.app.startsWith(join(this.root, "builds") + "/")) fail("FOREIGN_OR_REUSED_DEMO_PID");
    return s;
  }
  async build() {
    const { installation: i } = this.context(); if (this.server()) fail("STOP_DEMO_BEFORE_BUILD");
    const relativePath = `builds/${randomUUID()}/app`, app = join(this.root, relativePath);
    mkdirSync(join(app, ".."), { recursive: true, mode: 0o700 });
    prepareDemoBuild(this.source, app);
    const env = { ...this.env(), CAREERMAP_LOCAL_DEMO: "v5-synthetic", NPM_CONFIG_USERCONFIG: join(app, ".npmrc") };
    for (const args of [["ci", "--include=dev", "--no-audit", "--no-fund"], ["run", "build"]]) this.run("npm", args, { cwd: app, env, inherit: true });
    markDemoBuildComplete(app); saveInstallation(this.root, { ...i, buildPath: relativePath });
    return { build: "ready", app };
  }
  private async healthy(i: Installation) {
    for (let n = 0; n < 80; n++) {
      try { const response = await fetch(`http://127.0.0.1:${i.appPort}/api/health`, { signal: AbortSignal.timeout(1000), redirect: "error" }); if (response.status === 200 && (await response.json()).status === "ok") return; }
      catch { /* Startup/reconnect may need time; never treat 503 as success. */ }
      await delay(250);
    }
    fail("DEMO_SERVER_NOT_READY");
  }
  async start() {
    await this.runtime(async () => {}); const { installation: i } = this.context();
    if (this.server()) { await this.healthy(i); return { server: "already-running", origin: `http://127.0.0.1:${i.appPort}` }; }
    await assertPortFree(i.appPort);
    if (!i.buildPath) return fail("DEMO_BUILD_REQUIRED"); const app = join(this.root, i.buildPath); assertDemoWorkspace(app, true);
    const state = join(this.root, "server.json"); if (existsSync(state)) unlinkSync(state);
    const log = openSync(join(this.root, "server.log"), "a", 0o600);
    const child = spawn(process.execPath, ["--import", "tsx", join(this.source, "scripts/local-demo-start.mjs"), "--app-dir", app, "--config", join(this.root, "runtime.json")],
      { cwd: this.source, env: demoBuildEnvironment(process.env) as NodeJS.ProcessEnv, detached: true, stdio: ["ignore", log, log] });
    closeSync(log); child.unref(); if (!child.pid) return fail("DEMO_SERVER_SPAWN_FAILED");
    await delay(150); const actual = this.process(child.pid); if (!actual) fail("DEMO_SERVER_EXITED");
    writeFileSync(state, JSON.stringify({ pid: child.pid, ...actual, app }), { flag: "wx", mode: 0o600 });
    try { await this.healthy(i); } catch (error) { await this.stop(); throw error; }
    return { server: "running", origin: `http://127.0.0.1:${i.appPort}`, pid: child.pid };
  }
  async stop() {
    const { installation: i } = this.context(), path = join(this.root, "server.json"), server = this.server();
    if (!server) { await assertPortFree(i.appPort); if (existsSync(path)) unlinkSync(path); return { server: "already-stopped" }; }
    process.kill(server.pid, "SIGTERM");
    for (let n = 0; n < 80; n++) { if (!this.process(server.pid)) { await assertPortFree(i.appPort); unlinkSync(path); return { server: "stopped" }; } await delay(150); }
    return fail("DEMO_SERVER_STOP_TIMEOUT");
  }
  async recordB(surveyId: string) {
    if (!uuid(surveyId)) return fail("INVALID_DEMO_SURVEY_B");
    return this.runtime(async (client, i) => {
      const b = await client.survey.findUnique({ where: { id: surveyId }, include: { referenceProgram: true, _count: { select: { responses: true } } } });
      if (!b || surveyId === i.surveyAId || b.status !== "DRAFT" || b._count.responses !== 0 || b.referenceProgram.name !== "Master Informatik" || b.referenceProgram.institutionId !== i.operatorId || b.referenceProgramId === i.pilotProgramId) return fail("INVALID_DEMO_SURVEY_B");
      saveInstallation(this.root, { ...i, surveyBId: b.id }); return { surveyB: b.id, status: "DRAFT", responses: 0 };
    });
  }
  async enableParticipation(surveyId: string) {
    const { installation } = this.context();
    if (this.server()) fail("STOP_DEMO_BEFORE_PARTICIPATION_CHANGE");
    if (!uuid(surveyId) || surveyId !== installation.surveyBId || surveyId === installation.surveyAId) fail("INVALID_PARTICIPATION_SURVEY");
    return this.runtime(async (client, i) => {
      const survey = await client.survey.findUnique({ where: { id: surveyId }, select: { status: true, referenceProgram: { select: { institutionId: true } } } });
      if (!survey || survey.status !== "OPEN" || survey.referenceProgram.institutionId !== i.operatorId) fail("PARTICIPATION_SURVEY_NOT_OPEN");
      saveInstallation(this.root, { ...i, participationSurveyId: surveyId });
      return { participation: "enabled", surveyId, origin: `http://127.0.0.1:${i.appPort}`, input: "manual", storage: "persistent" };
    });
  }
  async enableLinkedIn() {
    const { installation: i, secrets } = this.context();
    if (this.server()) fail("STOP_DEMO_BEFORE_PARTICIPATION_CHANGE");
    if (!i.participationSurveyId) fail("PARTICIPATION_REQUIRED_FOR_LINKEDIN");
    // Explicitly copy only the already configured third-party app. Never
    // inherit .env.local, NODE_OPTIONS or development DB/tool switches at start.
    const existing = parseEnvironment(readFileSync(join(this.source, ".env.local")));
    if (existing.LINKEDIN_PORTABILITY_MODE !== "third_party" || existing.LINKEDIN_PORTABILITY_SCOPE !== "r_dma_portability_3rd_party") fail("THIRD_PARTY_LINKEDIN_CONFIGURATION_REQUIRED");
    const linkedIn = { clientId: existing.LINKEDIN_CLIENT_ID, clientSecret: existing.LINKEDIN_CLIENT_SECRET, redirectUri: existing.LINKEDIN_REDIRECT_URI };
    if (Object.values(linkedIn).some(value => !value?.trim())) fail("LINKEDIN_CONFIGURATION_REQUIRED");
    readLocalDemoConfiguration({ ...runtimeConfiguration(i, secrets), CAREERMAP_LOCAL_LINKEDIN_CLIENT_ID: linkedIn.clientId, CAREERMAP_LOCAL_LINKEDIN_CLIENT_SECRET: linkedIn.clientSecret, CAREERMAP_LOCAL_LINKEDIN_REDIRECT_URI: linkedIn.redirectUri });
    const file = join(this.root, "linkedin.json");
    if (existsSync(file)) {
      const stat = lstatSync(file);
      if (stat.isSymbolicLink() || (stat.mode & 0o077) !== 0 || JSON.stringify(JSON.parse(readFileSync(file, "utf8"))) !== JSON.stringify(linkedIn)) fail("EXISTING_LINKEDIN_CONFIGURATION_MISMATCH");
    } else writeFileSync(file, JSON.stringify(linkedIn), { mode: 0o600, flag: "wx" });
    saveInstallation(this.root, { ...i, linkedInEnabled: true });
    return { linkedIn: "enabled", surveyId: i.participationSurveyId, callback: linkedIn.redirectUri, storage: "temporary-server-token-only" };
  }
  async verify() {
    return this.runtime(async (client, i) => {
      if (!i.surveyAId || !i.surveyBId) fail("DEMO_ACCEPTANCE_SURVEYS_REQUIRED");
      if (i.participationSurveyId) {
        const surveys = await client.survey.findMany({ where: { id: { in: [i.surveyAId!, i.participationSurveyId] } }, select: { id: true, status: true, referenceProgram: { select: { institutionId: true } }, _count: { select: { responses: true } } } });
        if (surveys.length !== 2 || surveys.some(s => s.referenceProgram.institutionId !== i.operatorId) || surveys.find(s => s.id === i.surveyAId)?.status !== "CLOSED") fail("PARTICIPATION_INSTALLATION_MISMATCH");
        return { mode: "v5-participation", origin: `http://127.0.0.1:${i.appPort}`, surveys: surveys.map(s => ({ id: s.id, status: s.status, responses: s._count.responses })), volume: i.volumeName };
      }
      const { verifyDemoSource } = await import("../demo-seed/source-policy");
      const { planV5DemoSeed } = await import("../demo-seed/plan");
      const { assertPersistedDemoMatches } = await import("../demo-seed/reconcile");
      const input = this.fixture(i), verified = verifyDemoSource(input.policy, input.sourceText, input.expectedText);
      const declarations = verified.expected as { syntheticId: string; msiAnchor: { stationId: string } }[];
      const plan = planV5DemoSeed({ ...input, selections: declarations.map(p => ({ syntheticId: p.syntheticId, stationId: p.msiAnchor.stationId, programId: i.pilotProgramId, confirmation: "SYNTHETIC_TEST_ONLY" })) });
      await client.$transaction(tx => assertPersistedDemoMatches(tx, i.surveyAId!, plan), { isolationLevel: "RepeatableRead", timeout: 15000 });
      const b = await client.survey.findUnique({ where: { id: i.surveyBId }, include: { referenceProgram: true, _count: { select: { responses: true } } } });
      if (!b || b.status !== "DRAFT" || b._count.responses !== 0 || b.referenceProgram.name !== "Master Informatik" || b.referenceProgram.institutionId !== i.operatorId) return fail("DEMO_SURVEY_B_CHANGED");
      const snapshot = await client.$transaction(async tx => {
        const orderBy = { id: "asc" as const };
        if (await tx.alumniContact.count()) fail("CONTACTS_NOT_ALLOWED_IN_DEMO_ACCEPTANCE");
        return { institutions: await tx.institution.findMany({ orderBy }), programs: await tx.program.findMany({ orderBy }), surveys: await tx.survey.findMany({ orderBy }),
          organisations: await tx.organisation.findMany({ orderBy }), alumni: await tx.alumni.findMany({ orderBy }), degrees: await tx.degree.findMany({ orderBy }), careerSteps: await tx.careerStep.findMany({ orderBy }),
          timeline: await tx.alumniTimelineItem.findMany({ orderBy }), responses: await tx.surveyResponse.findMany({ orderBy }) };
      }, { isolationLevel: "RepeatableRead" });
      if (snapshot.surveys.length !== 2 || snapshot.alumni.length !== 100 || snapshot.degrees.length !== 172 || snapshot.careerSteps.length !== 260 || snapshot.timeline.length !== 432 || snapshot.responses.length !== 100) fail("DEMO_ACCEPTANCE_COUNTS_MISMATCH");
      return { installationId: i.installationId, origin: `http://127.0.0.1:${i.appPort}`, surveyA: { id: i.surveyAId, status: "CLOSED", responses: 100 },
        surveyB: { id: i.surveyBId, status: "DRAFT", responses: 0 }, profiles: 100, degrees: 172, careerSteps: 260, stations: 432, dataSha256: hash(JSON.stringify(snapshot)),
        clusterId: i.clusterId, databaseOid: i.databaseOid, volume: i.volumeName };
    });
  }
}
