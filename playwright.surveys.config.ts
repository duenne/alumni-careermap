import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e-surveys", workers: 1, timeout: 60_000,
  outputDir: "test-results-surveys", reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report-surveys" }]],
  use: { baseURL: "http://127.0.0.1:3110", trace: "retain-on-failure", screenshot: "only-on-failure", serviceWorkers: "block" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } },
    { name: "narrow", use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 } } },
  ],
  webServer: {
    command: "node scripts/dev-mapping.mjs --surveys", url: "http://127.0.0.1:3110/",
    reuseExistingServer: false, timeout: 90_000,
    env: { CAREERMAP_SURVEYS_E2E: "1", CAREERMAP_SURVEY_ADMIN_TOKEN: "synthetic-survey-e2e-password-at-least-32-characters" },
    gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 },
  },
});
