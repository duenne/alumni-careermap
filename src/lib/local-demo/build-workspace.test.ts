import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { localDemoEnvironment } from "../../../tests/support/local-demo";
import { prepareDemoBuild, demoBuildEnvironment, demoStartEnvironment, assertDemoWorkspace, markDemoBuildComplete } from "./build-workspace";
import { createInstallation } from "./installation";
import { randomUUID } from "node:crypto";
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "careermap-build-test-")), source = join(root, "source"), target = join(root, "app");
  mkdirSync(source); for (const directory of ["src", "public", "prisma", "scripts"]) mkdirSync(join(source, directory));
  for (const file of ["start-next.mjs", "check-local-demo-start.mjs"]) writeFileSync(join(source, "scripts", file), "export {};");
  for (const file of ["package.json", "package-lock.json", "next.config.ts", "tsconfig.json", "prisma.config.ts", "next-env.d.ts"]) writeFileSync(join(source, file), file.endsWith(".json") ? "{}" : "export {};");
  writeFileSync(join(source, "src", "app.ts"), "export const value = 1;");
  writeFileSync(join(source, ".env.local"), "DATABASE_URL=DO_NOT_COPY_CANARY\nLINKEDIN_CLIENT_SECRET=DO_NOT_COPY_CANARY");
  mkdirSync(join(source, ".local-fixtures")); writeFileSync(join(source, ".local-fixtures", "private.json"), "DO_NOT_COPY_CANARY");
  return { source, target };
}
describe("D1.4b isolated production build/start", () => {
  it("allows only an owned persistent build slot inside the excluded local installation", () => {
    const f = fixture(), local = join(f.source, ".local-demo"), own = join(local, "v5");
    mkdirSync(local, { mode: 0o700 });
    createInstallation(own, { image: `postgres@sha256:${"a".repeat(64)}`, imageId: `sha256:${"b".repeat(64)}`, composeSha256: "c".repeat(64), dockerEndpoint: "unix:///synthetic/docker.sock" });
    const slot = join(own, "builds", randomUUID()); mkdirSync(slot, { recursive: true, mode: 0o700 });
    const app = join(slot, "app");
    expect(() => prepareDemoBuild(f.source, app)).not.toThrow();
    expect(existsSync(join(app, ".local-demo"))).toBe(false);
    expect(() => prepareDemoBuild(f.source, join(f.source, "user-app"))).toThrow();
  });
  it("copies only application inputs without reading/mutating private environment files", () => {
    const f = fixture(), before = readFileSync(join(f.source, ".env.local"), "utf8");
    prepareDemoBuild(f.source, f.target);
    expect(existsSync(join(f.target, "src", "app.ts"))).toBe(true);
    expect(existsSync(join(f.target, ".env.local"))).toBe(false);
    expect(existsSync(join(f.target, ".local-fixtures"))).toBe(false);
    expect(readFileSync(join(f.source, ".env.local"), "utf8")).toBe(before);
    expect(() => assertDemoWorkspace(f.target)).not.toThrow();
  });
  it("does not overwrite an existing destination or follow source symlinks", () => {
    const f = fixture(); mkdirSync(f.target); writeFileSync(join(f.target, "user.txt"), "preserve");
    expect(() => prepareDemoBuild(f.source, f.target)).toThrow();
    expect(readFileSync(join(f.target, "user.txt"), "utf8")).toBe("preserve");
    const other = fixture(); symlinkSync(join(other.source, ".env.local"), join(other.source, "src", "leak.ts"));
    expect(() => prepareDemoBuild(other.source, other.target)).toThrow();
  });
  it("never inherits DB credentials, public secrets, preload hooks or development flags", () => {
    const ambient = { PATH: process.env.PATH, HOME: process.env.HOME, DATABASE_URL: "DO_NOT_COPY_CANARY", NODE_OPTIONS: "--require private.js",
      LINKEDIN_CLIENT_SECRET: "DO_NOT_COPY_CANARY", NEXT_PUBLIC_SECRET: "DO_NOT_COPY_CANARY", CAREERMAP_DEV_SURVEYS: "1" };
    const build = demoBuildEnvironment(ambient);
    expect(build).toMatchObject({ NODE_ENV: "production", CAREERMAP_LOCAL_DEMO: "v5-synthetic" });
    expect(JSON.stringify(build)).not.toMatch(/DO_NOT_COPY|NODE_OPTIONS|NEXT_PUBLIC_SECRET|CAREERMAP_DEV_SURVEYS/);
    const start = demoStartEnvironment(localDemoEnvironment(), ambient);
    expect(start.CAREERMAP_LOCAL_DEMO_DATABASE_URL).toContain("careermap_v5_demo");
    expect(JSON.stringify(start)).not.toContain("DO_NOT_COPY_CANARY");
    expect(() => demoStartEnvironment({ ...localDemoEnvironment(), NODE_OPTIONS: "--require private.js" }, ambient)).toThrow();
  });
  it("requires a finished build and refuses changed sources or introduced env files", () => {
    const f = fixture(); prepareDemoBuild(f.source, f.target);
    expect(() => assertDemoWorkspace(f.target, true)).toThrow();
    mkdirSync(join(f.target, ".next")); writeFileSync(join(f.target, ".next", "BUILD_ID"), "synthetic-build-id");
    markDemoBuildComplete(f.target);
    expect(() => assertDemoWorkspace(f.target, true)).not.toThrow();
    writeFileSync(join(f.target, "src", "app.ts"), "export const value = 2;");
    expect(() => assertDemoWorkspace(f.target, true)).toThrow();
    const other = fixture(); prepareDemoBuild(other.source, other.target);
    writeFileSync(join(other.target, ".env.production"), "SECRET=DO_NOT_COPY_CANARY");
    expect(() => assertDemoWorkspace(other.target)).toThrow();
  });
});
