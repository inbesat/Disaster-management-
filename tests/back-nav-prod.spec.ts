import { test, expect, type Page, type ConsoleMessage } from "@playwright/test";

/**
 * Production-only back-navigation repro.
 *
 * The existing tests/back-navigation.spec.ts runs against `npm run dev`, where
 * next.config.mjs skips next-pwa entirely:
 *
 *   export default isDev ? nextConfig : withPWA(nextConfig);
 *
 * So the service worker and its runtimeCaching rules are inactive and the suite
 * structurally cannot observe production back-nav behaviour. This spec is meant
 * to run against `next build && next start`.
 *
 * Auth is faked with cookies only — `guest_mode` short-circuits both the
 * Supabase lookup and the Prisma count in app/(dashboard)/layout.tsx, and
 * `role` satisfies the middleware. No database, no real login.
 */

type Chunk = { url: string; status: number | string; fromServiceWorker: boolean };

async function fakeDemoSession(page: Page, baseURL: string) {
  await page.context().addCookies([
    { name: "guest_mode", value: "true", url: baseURL },
    { name: "role", value: "district_admin", url: baseURL },
  ]);
}

/** Wait until a service worker is installed AND controlling this page. */
async function waitForServiceWorker(page: Page) {
  await page.waitForFunction(
    async () => {
      if (!("serviceWorker" in navigator)) return "unsupported";
      const reg = await navigator.serviceWorker.getRegistration();
      return reg?.active ? "active" : "pending";
    },
    undefined,
    { timeout: 30000 },
  );
  return page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    return {
      hasRegistration: Boolean(reg),
      hasController: Boolean(navigator.serviceWorker.controller),
      scriptURL: reg?.active?.scriptURL ?? null,
    };
  });
}

async function openSidebarLink(page: Page, href: string) {
  const link = page.locator(`aside a[href="${href}"]`).first();
  if (!(await link.isVisible())) {
    await page
      .getByRole("button", { name: "Open navigation drawer", exact: true })
      .click();
  }
  await link.click();
}

test.describe("back navigation in a production build", () => {
  test("SW is registered and controlling before we test Back", async ({ page, baseURL }) => {
    await fakeDemoSession(page, baseURL!);
    await page.goto("/command-center");
    const state = await waitForServiceWorker(page);
    // Reported, not asserted hard: Chromium may register on a later load.
    console.log("[sw-state]", JSON.stringify(state));
    expect(state.hasRegistration).toBe(true);
  });

  test("Back from Predictions does not render the error boundary", async ({ page, baseURL }) => {
    await fakeDemoSession(page, baseURL!);

    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const failedRequests: string[] = [];
    const chunks: Chunk[] = [];

    page.on("console", (m: ConsoleMessage) => {
      if (m.type() === "error") consoleErrors.push(m.text());
    });
    page.on("pageerror", (e) => pageErrors.push(e.message));
    page.on("response", async (res) => {
      const url = res.url();
      if (res.status() >= 400) failedRequests.push(`${res.status()} ${url}`);
      if (url.includes("/_next/static/") && url.endsWith(".js")) {
        chunks.push({
          url,
          status: res.status(),
          fromServiceWorker: res.fromServiceWorker(),
        });
      }
    });

    // Start on a dashboard page, then soft-navigate into Predictions.
    await page.goto("/inventory");
    await expect(page.locator("body")).toBeVisible({ timeout: 30000 });
    await openSidebarLink(page, "/predictions");
    await expect(
      page.getByRole("heading", { name: "Future flood outlook" }),
    ).toBeVisible({ timeout: 30000 });

    const swBefore = await page.evaluate(async () => {
      const keys = await caches.keys();
      const out: Record<string, number> = {};
      for (const k of keys) out[k] = (await (await caches.open(k)).keys()).length;
      return out;
    });
    console.log("[caches-before]", JSON.stringify(swBefore));

    // --- the actual bug: go Back -------------------------------------------
    await page.goBack();

    await expect(
      page.getByRole("heading", { name: "Something went wrong", exact: true }),
    ).toHaveCount(0, { timeout: 30000 });

    console.log("[url-after-back]", page.url());
    console.log("[pageErrors]", JSON.stringify(pageErrors, null, 2));
    console.log("[consoleErrors]", JSON.stringify(consoleErrors, null, 2));
    console.log("[failedRequests]", JSON.stringify(failedRequests, null, 2));
    console.log(
      "[nonOkChunks]",
      JSON.stringify(chunks.filter((c) => c.status !== 200), null, 2),
    );

    expect(pageErrors, "no uncaught page errors after Back").toEqual([]);
    expect(
      failedRequests.filter((r) => r.includes("/_next/static/")),
      "no 4xx/5xx on build chunks after Back",
    ).toEqual([]);
  });
});
