import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e-analytics", workers: 1, timeout: 60_000,
  outputDir: "test-results-analytics", reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report-analytics" }]],
  use: { baseURL: "http://127.0.0.1:3107", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }, { name: "tablet", use: { ...devices["Desktop Chrome"], viewport: { width: 834, height: 1112 } } }, { name: "narrow", use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 } } }],
  webServer: { command: "node --import tsx scripts/analytics-e2e.ts", url: "http://127.0.0.1:3107/dev/analytics", reuseExistingServer: false, timeout: 90_000, gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 } },
});
