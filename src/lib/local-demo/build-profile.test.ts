import { afterEach, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prepareDemoBuild } from "./build-workspace";
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.resetModules(); });
it("keeps standalone output for normal builds", async () => {
  vi.stubEnv("CAREERMAP_LOCAL_DEMO", undefined); vi.resetModules();
  expect((await import("../../../next.config")).default("phase-production-build").output).toBe("standalone");
});
it("selects regular next-start output only in an isolated production demo workspace", async () => {
  const root = mkdtempSync(join(tmpdir(), "careermap-profile-test-")), source = join(root, "source"), target = join(root, "app");
  mkdirSync(source); for (const dir of ["src", "public", "prisma", "scripts"]) mkdirSync(join(source, dir));
  for (const file of ["start-next.mjs", "check-local-demo-start.mjs"]) writeFileSync(join(source, "scripts", file), "export {};");
  for (const file of ["package.json", "package-lock.json", "next.config.ts", "tsconfig.json", "prisma.config.ts", "next-env.d.ts"]) writeFileSync(join(source, file), "{}");
  prepareDemoBuild(source, target);
  vi.spyOn(process, "cwd").mockReturnValue(target); vi.stubEnv("CAREERMAP_LOCAL_DEMO", "v5-synthetic"); vi.stubEnv("NODE_ENV", "production"); vi.resetModules();
  const configuration = (await import("../../../next.config")).default;
  expect(configuration("phase-production-build").output).toBeUndefined();
  expect(() => configuration("phase-production-server")).toThrow();
});
it("rejects attempts to enable the demo build in the user's repository or development mode", async () => {
  vi.stubEnv("CAREERMAP_LOCAL_DEMO", "v5-synthetic"); vi.stubEnv("NODE_ENV", "production"); vi.resetModules();
  await expect(import("../../../next.config")).rejects.toThrow();
  vi.stubEnv("NODE_ENV", "development"); vi.resetModules();
  await expect(import("../../../next.config")).rejects.toThrow();
});
