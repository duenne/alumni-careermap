import { defineConfig, devices } from "@playwright/test";

// A dedicated local production server; never reuse a running app or remote URL.
const baseURL = "http://127.0.0.1:3102";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  timeout: 60_000,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    serviceWorkers: "block",
  },
  projects: [
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } },
    { name: "chromium-narrow", use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 } } },
  ],
  webServer: {
    command: "node scripts/start-e2e.mjs",
    url: `${baseURL}/review`,
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      NEXT_TELEMETRY_DISABLED: "1",
      HOSTNAME: "127.0.0.1",
      PORT: "3102",
      // Even an accidentally enabled flag must not expose the development import.
      CAREERMAP_DEV_IMPORT: "1",
      // No database is needed by this demo. Override any inherited real URL.
      DATABASE_URL: "postgresql://v0:v0@127.0.0.1:1/v0_no_database?connect_timeout=1",
    },
  },
});
