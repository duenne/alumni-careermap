import { randomBytes } from "node:crypto";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import { beforeAll, afterAll, beforeEach, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { minimalCorpus } from "../../src/lib/analytics/test-corpus";
import { prepareAnalyticsImport } from "../../src/lib/analytics/prepare";
import { importAnalytics, resetAnalytics } from "../../src/lib/analytics/store";
import { readAnalytics } from "../../src/lib/analytics/read";

const admin = new pg.Client({ connectionString: process.env.DATABASE_URL });
let client: PrismaClient, url: string;
const plan = () => { const c = minimalCorpus(); return prepareAnalyticsImport(c.sources, c.expected, "phase-d-v1"); };
beforeAll(async () => {
  await admin.connect();
  const password = randomBytes(24).toString("hex");
  await admin.query(`CREATE ROLE careermap_analytics LOGIN PASSWORD '${password}'`);
  await admin.query("CREATE DATABASE careermap_analytics_demo OWNER careermap_analytics");
  const parsed = new URL(process.env.DATABASE_URL!); parsed.username = "careermap_analytics"; parsed.password = password; parsed.pathname = "/careermap_analytics_demo"; url = parsed.href;
  const migration = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], { env: { ...process.env, DATABASE_URL: url }, encoding: "utf8" });
  expect(migration.status).toBe(0);
  client = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}, 30_000);
beforeEach(async () => { await resetAnalytics(client, url, "careermap_analytics_demo"); });
afterAll(async () => { await client?.$disconnect(); await admin.query("DROP DATABASE IF EXISTS careermap_analytics_demo WITH (FORCE)"); await admin.query("DROP ROLE IF EXISTS careermap_analytics"); await admin.end(); });

it("imports atomically with random UUIDs, no contact/response/identity; repeat is a no-op", async () => {
  expect(await importAnalytics(client, url, plan())).toMatchObject({ imported: 1, skipped: 0 });
  const profile = await client.alumni.findFirstOrThrow({ include: { degrees: true, careerSteps: true, timelineItems: true, contact: true, responses: true } });
  expect(profile.id).toMatch(/^[0-9a-f-]{14}4[0-9a-f-]{21}$/);
  expect(profile.degrees).toHaveLength(1); expect(profile.careerSteps).toHaveLength(3); expect(profile.timelineItems).toHaveLength(4);
  expect(profile.contact).toBeNull(); expect(profile.responses).toEqual([]);
  expect(Object.keys(profile).sort()).toEqual(["id", "createdAt", "updatedAt", "degrees", "careerSteps", "timelineItems", "contact", "responses"].sort());
  expect(await importAnalytics(client, url, plan())).toMatchObject({ imported: 0, skipped: 1 });
  expect((await client.alumni.findFirstOrThrow()).id).toBe(profile.id);
});
it("rolls back writes and catalogs when a database constraint fails", async () => {
  const bad = plan(); bad.profiles[0].stations[3].position = bad.profiles[0].stations[0].position;
  await expect(importAnalytics(client, url, bad)).rejects.toThrow();
  expect(await client.alumni.count()).toBe(0); expect(await client.organisation.count()).toBe(0); expect(await client.program.count()).toBe(0);
});
it("dry-run has no writes; changed/nonempty batches and unsafe reset are rejected", async () => {
  await importAnalytics(client, url, plan(), true);
  expect(await client.alumni.count()).toBe(0);
  await importAnalytics(client, url, plan());
  const changed = plan(); changed.profiles[0].stations[0].provider = "Synthetic changed employer";
  await expect(importAnalytics(client, url, changed)).rejects.toThrow("NONEMPTY_DIFFERENT_DATASET");
  await expect(resetAnalytics(client, url, "wrong")).rejects.toThrow("RESET_CONFIRMATION_REQUIRED");
  await expect(importAnalytics(client, url.replace("careermap_analytics_demo", "careermap_test"), plan())).rejects.toThrow("UNSAFE_ANALYTICS_DATABASE");
  expect(await client.alumni.count()).toBe(1);
});
it("checks the connected database/role as well as the supplied URL", async () => {
  const other = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try { await expect(importAnalytics(other, url, plan())).rejects.toThrow("UNSAFE_ANALYTICS_DATABASE"); }
  finally { await other.$disconnect(); }
  expect(await client.alumni.count()).toBe(0);
});
it("V2.2 reads all canonical timeline data/counts in position order without personal joins", async () => {
  expect(await readAnalytics(client, url)).toMatchObject({ profiles: [], counts: { profiles: 0, degrees: 0, careerSteps: 0, timelineItems: 0 } });
  await importAnalytics(client, url, plan());
  const data = await readAnalytics(client, url);
  expect(data.counts).toMatchObject({ profiles: 1, degrees: 1, careerSteps: 3, timelineItems: 4, demoAnchors: 1, unknownDateStations: 1 });
  expect(data.profiles[0].stations.map(s => [s.position, s.type])).toEqual([[1, "VOCATIONAL_TRAINING"], [2, "BACHELOR"], [3, "EMPLOYMENT"], [4, "EDUCATION"]]);
  expect(data.profiles[0].stations[2]).toMatchObject({ title: "Synthetic role", provider: "Synthetic organisation", location: "Synthetic town", sector: "Dritter Sektor", job: "Forschung & Entwicklung" });
  expect(JSON.stringify(data)).not.toMatch(/PRIVATE_|email|contact|confirmedAt|syntheticId/);
});
