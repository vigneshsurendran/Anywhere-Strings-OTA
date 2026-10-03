import { defineConfig, devices } from "@playwright/test";
import { e2eEnv } from "./tests/e2e/env";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: e2eEnv.AUTH_URL,
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
    url: e2eEnv.AUTH_URL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { ...process.env, ...e2eEnv },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
