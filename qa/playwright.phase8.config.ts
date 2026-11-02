import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "../e2e",
  testMatch: /phase[2-8]\.spec\.ts/,
  timeout: 60000,
  expect: { timeout: 12000 },
  workers: 2,
  retries: 0,
  outputDir: "../test-results/phase8-chrome",
  reporter: [
    ["list"],
    [
      "html",
      { outputFolder: "../playwright-report/phase8-chrome", open: "never" },
    ],
  ],
  use: {
    baseURL: "http://127.0.0.1:4174",
    serviceWorkers: "allow",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chrome-macos",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
  ],
  webServer: {
    command: "npm run preview -- --port 4174 --strictPort",
    url: "http://127.0.0.1:4174",
    reuseExistingServer: false,
    timeout: 30000,
  },
});
