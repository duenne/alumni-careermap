import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e-workflow", workers: 1, timeout: 60_000,
  outputDir: "test-results-workflow",
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report-workflow" }]],
  use: { baseURL: "http://127.0.0.1:3105", trace: "retain-on-failure", screenshot: "only-on-failure", serviceWorkers: "block" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } },
    { name: "narrow", use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 } } },
  ],
  webServer: { command: "node scripts/dev-mapping.mjs", url: "http://127.0.0.1:3105/dev/import", reuseExistingServer: false, timeout: 90_000, env: { CAREERMAP_WORKFLOW_E2E: "1" }, gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 } },
});
