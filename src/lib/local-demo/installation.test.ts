import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, statSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createInstallation, loadInstallation, saveInstallation, runtimeConfiguration, assertVolumeIdentity, assertContainerIdentity, assertClusterIdentity } from "./installation";
import { readLocalDemoConfiguration } from "./config";
it("activates manual participation only for the recorded independent survey and persists matching runtime configuration", () => {
  const root = location(), { installation } = createInstallation(root, bootstrap);
  const a = "44444444-4444-4444-8444-444444444444", b = "55555555-5555-4555-8555-555555555555";
  saveInstallation(root, { ...installation, surveyAId: a, surveyBId: b });
  expect(() => saveInstallation(root, { ...loadInstallation(root).installation, participationSurveyId: a })).toThrow();
  saveInstallation(root, { ...loadInstallation(root).installation, participationSurveyId: b });
  const loaded = loadInstallation(root);
  expect(readLocalDemoConfiguration(runtimeConfiguration(loaded.installation, loaded.secrets))).toMatchObject({ mode: "v5-participation", participationSurveyId: b });
});
const bootstrap = { image: `postgres@sha256:${"a".repeat(64)}`, imageId: `sha256:${"b".repeat(64)}`, dockerEndpoint: "unix:///synthetic/docker.sock", composeSha256: "c".repeat(64) };
const location = () => join(mkdtempSync(join(tmpdir(), "careermap-install-test-")), "v5");
it("binds synthetic detail access to the recorded seed survey, upgrading older private runtime metadata on save", () => {
  const root = location(), { installation } = createInstallation(root, bootstrap);
  const a = "44444444-4444-4444-8444-444444444444";
  saveInstallation(root, { ...installation, surveyAId: a });
  expect(readLocalDemoConfiguration(JSON.parse(readFileSync(join(root, "runtime.json"), "utf8")))).toMatchObject({ syntheticSurveyId: a });
  const legacy = JSON.parse(readFileSync(join(root, "runtime.json"), "utf8"));
  delete legacy.CAREERMAP_LOCAL_DEMO_SYNTHETIC_SURVEY_ID;
  writeFileSync(join(root, "runtime.json"), JSON.stringify(legacy));
  const loaded = loadInstallation(root);
  expect(readLocalDemoConfiguration(legacy)).not.toHaveProperty("syntheticSurveyId");
  saveInstallation(root, loaded.installation);
  expect(readLocalDemoConfiguration(JSON.parse(readFileSync(join(root, "runtime.json"), "utf8")))).toMatchObject({ syntheticSurveyId: a });
  const forged = JSON.parse(readFileSync(join(root, "runtime.json"), "utf8"));
  forged.CAREERMAP_LOCAL_DEMO_SYNTHETIC_SURVEY_ID = "55555555-5555-4555-8555-555555555555";
  writeFileSync(join(root, "runtime.json"), JSON.stringify(forged));
  expect(() => loadInstallation(root)).toThrow();
});
it("loads optional LinkedIn credentials only from a private file after explicit participation activation", () => {
  const root = location(), { installation: i } = createInstallation(root, bootstrap);
  const surveyBId = "55555555-5555-4555-8555-555555555555";
  saveInstallation(root, { ...i, surveyBId, participationSurveyId: surveyBId });
  expect(() => saveInstallation(root, { ...loadInstallation(root).installation, linkedInEnabled: true })).toThrow();
  writeFileSync(join(root, "linkedin.json"), JSON.stringify({ clientId: "synthetic-client", clientSecret: "synthetic-secret", redirectUri: "http://localhost:3100/auth/linkedin/portability/callback" }), { mode: 0o600 });
  saveInstallation(root, { ...loadInstallation(root).installation, linkedInEnabled: true });
  const loaded = loadInstallation(root);
  expect(readLocalDemoConfiguration(runtimeConfiguration(loaded.installation, loaded.secrets)).linkedIn?.redirectUri).toBe("http://localhost:3100/auth/linkedin/portability/callback");
  expect(JSON.stringify(loaded.installation)).not.toMatch(/synthetic-secret|synthetic-client/);
  chmodSync(join(root, "linkedin.json"), 0o644); expect(() => loadInstallation(root)).toThrow();
});
describe("D1.4c installation ownership and persistence metadata", () => {
  it("creates stable private synthetic identities and separate credentials without normal DB env", () => {
    const root = location(), first = createInstallation(root, bootstrap), loaded = loadInstallation(root);
    expect(loaded.installation).toEqual(first.installation);
    const config = runtimeConfiguration(loaded.installation, loaded.secrets);
    expect(readLocalDemoConfiguration(config)).toMatchObject({ mode: "v5-synthetic", origin: "http://127.0.0.1:3114" });
    expect(loaded.secrets.administratorPassword).not.toBe(loaded.secrets.databasePassword);
    expect(loaded.secrets.adminDatabasePassword).not.toBe(loaded.secrets.databasePassword);
    expect(statSync(join(root, "secrets.json")).mode & 0o777).toBe(0o600);
    expect(statSync(root).mode & 0o777).toBe(0o700);
    expect(config.DATABASE_URL).toBeUndefined();
  });
  it("reuses its own installation byte-for-byte, never rekeys on repeated init", () => {
    const root = location(); createInstallation(root, bootstrap);
    const before = readFileSync(join(root, "secrets.json"));
    const initial = readFileSync(join(root, "installation.json"));
    createInstallation(root, bootstrap);
    expect(readFileSync(join(root, "secrets.json"))).toEqual(before);
    expect(readFileSync(join(root, "installation.json"))).toEqual(initial);
  });
  it("refuses pre-existing user files, corrupt metadata and insecure secret permissions", () => {
    const root = location(); mkdirSync(root); writeFileSync(join(root, "user.txt"), "preserve");
    expect(() => createInstallation(root, bootstrap)).toThrow();
    expect(readFileSync(join(root, "user.txt"), "utf8")).toBe("preserve");
    const own = location(); createInstallation(own, bootstrap);
    writeFileSync(join(own, "installation.json"), "{}");
    expect(() => loadInstallation(own)).toThrow();
  });
  it("refuses remote Docker endpoints and non-PG17 pinned image identities", () => {
    expect(() => createInstallation(location(), { ...bootstrap, dockerEndpoint: "tcp://example.com:2375" })).toThrow();
    expect(() => createInstallation(location(), { ...bootstrap, image: "postgres:latest" })).toThrow();
  });
  it("rejects exposed or inconsistent password files before using Docker", () => {
    const root = location(); createInstallation(root, bootstrap);
    chmodSync(join(root, "secrets.json"), 0o644);
    expect(() => loadInstallation(root)).toThrow("UNSAFE_DEMO_CONFIGURATION_FILE");
    chmodSync(join(root, "secrets.json"), 0o600);
    writeFileSync(join(root, "admin-password"), "foreign-password");
    expect(() => loadInstallation(root)).toThrow("INVALID_DEMO_INSTALLATION");
  });
  it("cannot reset established volume/cluster bindings to silently reinitialize lost data", () => {
    const root = location(), { installation: i } = createInstallation(root, bootstrap);
    const bound = { ...i, volumeReady: true, clusterId: "123456789", databaseOid: 16384 };
    saveInstallation(root, bound);
    expect(() => saveInstallation(root, i)).toThrow();
    expect(() => saveInstallation(root, { ...bound, clusterId: "987654321" })).toThrow();
    expect(loadInstallation(root).installation).toEqual(bound);
    expect(() => assertVolumeIdentity(undefined, bound)).toThrow("FOREIGN_OR_MISSING_DEMO_VOLUME");
  });
  it("accepts only its explicitly labelled volume and exact local container", () => {
    const { installation: i } = createInstallation(location(), bootstrap);
    const labels = { "de.careermap.v5.installation": i.installationId, "de.careermap.v5.purpose": "SYNTHETIC_DEMO_ONLY" };
    const volume = { Name: i.volumeName, Labels: labels };
    expect(() => assertVolumeIdentity(volume, i)).not.toThrow();
    expect(() => assertVolumeIdentity({ ...volume, Labels: {} }, i)).toThrow();
    const container = { Image: i.imageId, Config: { Labels: { ...labels, "com.docker.compose.project": i.projectName, "com.docker.compose.service": "db" } },
      Mounts: [{ Type: "volume", Name: i.volumeName, Destination: "/var/lib/postgresql/data" }],
      HostConfig: { PortBindings: { "5432/tcp": [{ HostIp: "127.0.0.1", HostPort: String(i.dbPort) }] } } };
    expect(() => assertContainerIdentity(container, i)).not.toThrow();
    for (const wrong of ["0.0.0.0", "::", "192.0.2.5"]) {
      const changed = structuredClone(container); changed.HostConfig.PortBindings["5432/tcp"][0].HostIp = wrong;
      expect(() => assertContainerIdentity(changed, i)).toThrow();
    }
    expect(() => assertContainerIdentity({ ...container, Image: "foreign-image" }, i)).toThrow();
  });
  it("detects cluster/database replacement and never treats a new empty DB as a retry", () => {
    const { installation: i } = createInstallation(location(), bootstrap);
    const actual = { database: "careermap_v5_demo", role: "careermap_v5_admin", version: "170006", clusterId: "synthetic-cluster", databaseOid: 16384 };
    expect(() => assertClusterIdentity(actual, i)).not.toThrow();
    const bound = { ...i, clusterId: actual.clusterId, databaseOid: actual.databaseOid };
    expect(() => assertClusterIdentity({ ...actual, clusterId: "foreign" }, bound)).toThrow();
    expect(() => assertClusterIdentity({ ...actual, databaseOid: 9999 }, bound)).toThrow();
    expect(() => assertClusterIdentity({ ...actual, version: "160010" }, bound)).toThrow();
  });
});
