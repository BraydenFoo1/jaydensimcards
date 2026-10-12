import { defineConfig, devices } from "@playwright/test";
import { BASE_URL, loadTestEnvironment } from "./tests/e2e/support";

// Before the build, the web server or any test starts: the server inherits this
// environment, so refusing here keeps every part of the run off other databases.
loadTestEnvironment();

/**
 * Browser tests run against a production build on its own port, so they never
 * collide with a `npm run dev` on :3000. Requires the local database
 * (`npm run db:dev`) and MAIL_TRANSPORT=outbox in .env.local.
 */
const PORT = new URL(BASE_URL).port;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  workers: 2,
  retries: 0,
  reporter: [["list"]],
  globalTeardown: "./tests/e2e/global-teardown.ts",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      // Chromium with a phone viewport; tests tagged @responsive run here too.
      name: "mobile",
      grep: /@responsive/,
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: `${BASE_URL}/api/auth/ok`,
    reuseExistingServer: false,
    timeout: 240_000,
    // Email links and origin checks must use this port, not the dev server's.
    env: { BETTER_AUTH_URL: BASE_URL },
  },
});
