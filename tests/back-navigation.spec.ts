import { randomUUID } from "node:crypto";
import { test, expect, type Page } from "@playwright/test";

test.beforeEach(async ({ context, baseURL, page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
  await context.addCookies([
    { name: "role", value: "district_admin", url: baseURL! },
    { name: "demo_mode", value: "true", url: baseURL! },
    { name: "demo_session_id", value: randomUUID(), url: baseURL! },
  ]);
  await page.route("**/api/predictions/outlook?*", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: "Forecast temporarily unavailable for this navigation test.",
      }),
    }),
  );
});

async function openSidebarLink(page: Page, href: string) {
  const link = page.locator(`aside a[href="${href}"]`).first();
  if (!(await link.isVisible())) {
    await page
      .getByRole("button", { name: "Open navigation drawer", exact: true })
      .click();
  }
  await link.click();
  await expect(page).toHaveURL(new RegExp(`${href}$`), { timeout: 60000 });
}

async function profileReady(page: Page) {
  const name = page.getByLabel("Full name", { exact: true });
  await expect(name).toBeVisible({ timeout: 30000 });
  await name.fill(`Navigation check ${Date.now()}`);
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(
    page.getByText("Profile saved on this device.", { exact: true }),
  ).toBeVisible();
}

async function predictionsReady(page: Page) {
  await expect(page.getByRole("heading", { name: "Future flood outlook" })).toBeVisible({
    timeout: 30000,
  });
  // The error panel means the page's effects have mounted; no real forecast is needed.
  await expect(
    page.getByText("Forecast temporarily unavailable for this navigation test."),
  ).toBeVisible();
}

test("site Back from Predictions restores the exact previous URL as a fresh page", async ({
  page,
}) => {
  await page.goto("/settings/profile?from=prediction-check#contacts");
  await profileReady(page);
  await openSidebarLink(page, "/predictions");
  await predictionsReady(page);

  await page.getByRole("button", { name: "Go back", exact: true }).first().click();

  // Assert the OUTCOME, not the mechanism. The step before this was a soft
  // <Link> navigation, so Back is served by the client router via popstate —
  // there is no document navigation request to wait for. The previous revision
  // of this test waited on one and always timed out before it ever reached the
  // error-boundary assertion, so it could not have caught the real regression.
  await expect(page).toHaveURL(/\/settings\/profile\?from=prediction-check#contacts$/, {
    timeout: 30000,
  });
  await expect(page.getByLabel("Full name", { exact: true })).toBeVisible({
    timeout: 30000,
  });
  await expect(
    page.getByRole("heading", { name: "Something went wrong", exact: true }),
  ).toHaveCount(0);
});

test("browser Back and Forward keep the history order without adding a loop", async ({
  page,
}) => {
  await page.goto("/settings/profile");
  await profileReady(page);
  await openSidebarLink(page, "/predictions");
  await predictionsReady(page);
  await openSidebarLink(page, "/inventory");
  await expect(page.locator(".recharts-pie-sector")).toHaveCount(9, { timeout: 30000 });
  await page.goBack();
  await predictionsReady(page);
  await page.goBack();
  await expect(page.getByLabel("Full name", { exact: true })).toBeVisible({
    timeout: 30000,
  });
  await expect(page).toHaveURL(/\/settings\/profile$/);
  await page.goForward();
  await predictionsReady(page);
  await expect(page).toHaveURL(/\/predictions$/);
  await expect(
    page.getByRole("heading", { name: "Something went wrong", exact: true }),
  ).toHaveCount(0);
});

test("anchor-only Back preserves the current document", async ({ page }) => {
  await page.goto("/settings/profile");
  await expect(page.getByLabel("Full name", { exact: true })).toBeVisible({
    timeout: 30000,
  });
  await page.evaluate(() => {
    document.documentElement.dataset.previousDocument = "profile";
    window.location.hash = "contacts";
  });
  await expect(page).toHaveURL(/#contacts$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/settings\/profile$/);
  await expect(page.locator("html")).toHaveAttribute("data-previous-document", "profile");
});
