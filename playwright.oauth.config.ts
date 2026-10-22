import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// Separate server with exclusively synthetic app credentials. Never reuse the
// live development server or inherit its LinkedIn configuration.
const baseURL = "http://127.0.0.1:3104";
export default defineConfig({
  ...base,
  testDir: "./tests/e2e-oauth",
  outputDir: "test-results-oauth",
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report-oauth" }]],
  use: { ...base.use, baseURL },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3104",
    url: `${baseURL}/review`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      NEXT_TELEMETRY_DISABLED: "1",
      CAREERMAP_DEV_IMPORT: "1",
      CAREERMAP_DEV_IMPORT_TEST: "1",
      NODE_OPTIONS: "--import ./tests/support/linkedin-token-mock.mjs",
      LINKEDIN_CLIENT_ID: "synthetic-client",
      LINKEDIN_CLIENT_SECRET: "synthetic-secret",
      LINKEDIN_REDIRECT_URI: `${baseURL}/auth/linkedin/portability/callback`,
      LINKEDIN_PORTABILITY_MODE: "third_party",
      LINKEDIN_PORTABILITY_SCOPE: "r_dma_portability_3rd_party",
      DATABASE_URL: "postgresql://oauth:oauth@127.0.0.1:1/no_database?connect_timeout=1",
    },
  },
});
