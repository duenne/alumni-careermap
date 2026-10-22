import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

export default defineConfig({
  ...base,
  testDir: "./tests/e2e-import",
  outputDir: "test-results-v1a",
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report-v1a" }]],
  use: { ...base.use, baseURL: "http://127.0.0.1:3103" },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3103",
    url: "http://127.0.0.1:3103/review",
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      NEXT_TELEMETRY_DISABLED: "1",
      CAREERMAP_DEV_IMPORT: "1",
      CAREERMAP_DEV_IMPORT_TEST: "1",
      // Never inherit a developer's real provider credentials into browser tests.
      LINKEDIN_CLIENT_ID: "",
      LINKEDIN_CLIENT_SECRET: "",
      LINKEDIN_REDIRECT_URI: "",
      LINKEDIN_PORTABILITY_MODE: "",
      LINKEDIN_PORTABILITY_SCOPE: "",
      DATABASE_URL: "postgresql://v1a:v1a@127.0.0.1:1/no_database?connect_timeout=1",
    },
  },
});
