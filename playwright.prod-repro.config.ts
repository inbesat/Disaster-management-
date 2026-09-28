import { defineConfig, devices } from "@playwright/test";

/**
 * Production repro config — no webServer.
 *
 * Start the app yourself first:
 *   npm run build && npx next start -p 3100
 * then:
 *   E2E_BASE_URL=http://localhost:3100 npx playwright test -c playwright.prod-repro.config.ts
 *
 * Kept separate from playwright.config.ts because that file pins `npm run dev`,
 * which disables next-pwa and therefore cannot exercise the service worker.
 */
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3100";

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/back-nav-prod.spec.ts",
  timeout: 180_000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: { baseURL: BASE_URL, trace: "off" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
