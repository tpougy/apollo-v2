import { defineConfig, devices } from "@playwright/test";

// Shared storageState path — specs import this rather than restating the string.
export const STORAGE_STATE = "e2e/.auth/user.json";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:5174",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "bun run dev -- --port 5174 --strictPort",
    url: "http://localhost:5174",
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "authed",
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: STORAGE_STATE,
      },
      testMatch: /.*\.spec\.ts/,
      testIgnore: /no-leakage\.spec\.ts|design-system\.spec\.ts|login-flow\.spec\.ts/,
    },
    {
      name: "anon",
      testMatch: /no-leakage\.spec\.ts|design-system\.spec\.ts|login-flow\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: { cookies: [], origins: [] },
      },
    },
  ],
});
