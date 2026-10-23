import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e-mapping", workers: 1, timeout: 60_000,
  outputDir: "test-results-mapping",
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report-mapping" }]],
  use: { baseURL: "http://localhost:3104", trace: "retain-on-failure", screenshot: "only-on-failure", serviceWorkers: "block" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } },
    { name: "narrow", use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 } } },
  ],
  webServer: { command: "npm run dev:mapping", url: "http://localhost:3104/dev/mapping", reuseExistingServer: false, timeout: 90_000, env: { CAREERMAP_MAPPING_E2E: "1" }, gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 } },
});
