import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  timeout: 45000,
  expect: { timeout: 10000 },
  workers: 2,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:4174",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    serviceWorkers: "allow",
    // Older suites check that Preview and LIVE stay separate, so they run with
    // "Langsung ke Live" off; tests for that switch turn it on themselves.
    storageState: {
      cookies: [],
      origins: [
        {
          origin: "http://127.0.0.1:4174",
          localStorage: [{ name: "sagi:auto-live", value: "off" }],
        },
      ],
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run preview -- --port 4174 --strictPort",
    url: "http://127.0.0.1:4174",
    reuseExistingServer: false,
    timeout: 30000,
  },
});
