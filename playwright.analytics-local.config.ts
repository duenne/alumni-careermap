import { defineConfig, devices } from "@playwright/test";
/** Optional acceptance against an already running local 100-profile demo. */
export default defineConfig({
  testDir: "./tests/e2e-analytics-local", workers: 1, timeout: 120_000,
  outputDir: "test-results-analytics/local", reporter: [["list"]],
  use: { baseURL: "http://127.0.0.1:3106", trace: "retain-on-failure", screenshot: "only-on-failure", ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } },
});
