import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";

test.beforeEach(async ({ context, baseURL, page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
  await context.addCookies([
    { name: "role", value: "district_admin", url: baseURL! },
    { name: "demo_mode", value: "true", url: baseURL! },
    { name: "demo_session_id", value: randomUUID(), url: baseURL! },
  ]);
});

test("inventory charts, edits, import/export and movement history", async ({ page }) => {
  await page.goto("/inventory");
  await expect(page.locator(".recharts-pie-sector")).toHaveCount(9);
  await page.getByRole("button", { name: "+ Add Resource", exact: true }).click();
  await page.locator("#resource-name").fill("Audit response vehicle");
  await page.locator("#resource-category").selectOption("vehicle");
  await page.locator("#resource-quantity").fill("7");
  await page.locator("#resource-lat").fill("0");
  await page.locator("#resource-lng").fill("0");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add Resource", exact: true })
    .click();
  const row = page.getByRole("row").filter({ hasText: "Audit response vehicle" });
  await expect(row).toContainText("0.0000, 0.0000");
  await row.getByRole("button", { name: "Edit", exact: true }).click();
  await page.locator("#resource-status").selectOption("deployed");
  await page.locator("#resource-quantity").fill("9");
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await page.reload();
  await expect(row).toContainText("deployed");
  await expect(row).toContainText("9");

  await page.getByRole("button", { name: "Import CSV", exact: true }).click();
  const upload = page.getByRole("dialog").locator("input[type=file]");
  await upload.setInputFiles({
    name: "invalid.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("name,category,quantity,lat,lng\nInvalid,vehicle,-2,0,0"),
  });
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("Row 2");
  await upload.setInputFiles({
    name: "stock.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "name,category,quantity,lat,lng,status,unit,depotName\nAudit kits,medical,22,0,0,retired,kits,Audit depot",
    ),
  });
  await page.getByRole("button", { name: "Confirm Import (1)", exact: true }).click();
  await expect(page.getByRole("row").filter({ hasText: "Audit kits" })).toContainText(
    "retired",
  );
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV", exact: true }).click();
  const stream = await (await downloading).createReadStream();
  let csv = "";
  for await (const chunk of stream!) csv += String(chunk);
  expect(csv).toContain("Audit kits,medical,22,kits,0,0,retired,Audit depot");

  await page.getByRole("button", { name: "+ Record Movement", exact: true }).click();
  const form = page
    .locator("form")
    .filter({ has: page.getByPlaceholder("e.g. NDRF Rescue Boats") });
  await form.getByLabel("Resource", { exact: true }).fill("Audit water movement");
  await form.getByLabel("To (destination)", { exact: true }).fill("Relief camp");
  await form.getByLabel("Qty", { exact: true }).fill("4");
  await form.getByLabel("Lat", { exact: true }).fill("0");
  await form.getByLabel("Lng", { exact: true }).fill("0");
  await form.getByRole("button", { name: "Record Movement", exact: true }).click();
  await expect(
    page.getByText("Audit water movement", { exact: false }).first(),
  ).toBeVisible();
  await row.getByRole("button", { name: "Edit", exact: true }).click();
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(row).toHaveCount(0);
  await page.getByRole("button", { name: "+ Add Resource", exact: true }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
  ).toBe(true);
  await page.goto("/gov/resources");
  await expect(page).toHaveURL(/\/inventory$/);
});

test("profile, contacts, location and operational preferences persist", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 25.61, longitude: 85.14 });
  await page.goto("/settings/profile");
  await page.getByLabel("Full name", { exact: true }).fill("Audit Coordinator");
  await page.getByRole("button", { name: "+ Add Member", exact: true }).click();
  await page.getByLabel("Member name", { exact: true }).fill("Audit contact");
  await page.getByLabel("Relationship", { exact: true }).fill("Sibling");
  await page.getByLabel("Contact phone", { exact: true }).fill("0000000000");
  await page.getByRole("button", { name: "Add contact", exact: true }).click();
  await page.getByRole("button", { name: "Use GPS", exact: true }).click();
  await expect(page.getByLabel("Home location", { exact: true })).toHaveValue(
    "25.61000, 85.14000",
  );
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await page.reload();
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
    "Audit Coordinator",
  );
  await expect(page.getByText("Audit contact", { exact: true })).toBeVisible();
  await page.getByLabel("Full name", { exact: true }).fill("Discard this");
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
    "Audit Coordinator",
  );
  await page.getByRole("button", { name: "Remove Audit contact", exact: true }).click();
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await page.reload();
  await expect(page.getByText("Audit contact", { exact: true })).toHaveCount(0);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
  ).toBe(true);
  await page.goto("/settings/organization");
  const threshold = page.getByRole("slider", {
    name: "Low-stock threshold",
    exact: true,
  });
  await threshold.focus();
  await threshold.press("Home");
  for (let step = 0; step < 6; step++) await threshold.press("ArrowRight");
  await page.getByRole("button", { name: "Save Parameters", exact: true }).click();
  await page.reload();
  await expect(page.getByLabel("Low-stock threshold", { exact: true })).toHaveValue("35");
  await page.goto("/inventory");
  await expect(page.getByRole("row").filter({ hasText: "Field radios" })).toContainText(
    "Low stock",
  );
});

test("AI settings reach chat requests and attachments are read", async ({ page }) => {
  await page.goto("/settings/ai");
  await page
    .getByRole("combobox", { name: "Preferred provider", exact: true })
    .selectOption("groq-llama3");
  await page
    .getByRole("combobox", { name: "Response detail", exact: true })
    .selectOption("concise");
  await page.getByRole("button", { name: "urgent", exact: true }).click();
  await page.getByRole("button", { name: "Save AI preferences", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("combobox", { name: "Preferred provider", exact: true }),
  ).toHaveValue("groq-llama3");
  const requests: Record<string, unknown>[] = [];
  await page.route("**/api/chat", async (route) => {
    requests.push(route.request().postDataJSON() as Record<string, unknown>);
    const events = [
      { type: "start", messageId: "audit" },
      { type: "text-start", id: "text" },
      { type: "text-delta", id: "text", delta: "Audit response received." },
      { type: "text-end", id: "text" },
      { type: "finish" },
    ];
    await route.fulfill({
      headers: {
        "content-type": "text/event-stream",
        "x-vercel-ai-ui-message-stream": "v1",
      },
      body:
        events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("") +
        "data: [DONE]\n\n",
    });
  });
  await page.addInitScript(() => {
    Object.defineProperty(window, "SpeechRecognition", {
      value: undefined,
      configurable: true,
    });
    Object.defineProperty(window, "webkitSpeechRecognition", {
      value: undefined,
      configurable: true,
    });
  });
  await page.goto("/ai-advisor");
  await expect(page).toHaveURL(/\/ai-planner$/, { timeout: 30000 });
  await page.getByRole("button", { name: "Voice input", exact: true }).click();
  await expect(
    page.getByText("Voice input is not supported here", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("textarea")).toHaveValue("");
  const selecting = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Attach text file", exact: true }).click();
  await (
    await selecting
  ).setFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Audit briefing: review available shelter capacity."),
  });
  const composer = page.locator("textarea");
  await expect(composer).toHaveValue(/Audit briefing/);
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByText("Audit response received.", { exact: true })).toBeVisible();
  expect(requests[0]).toMatchObject({
    provider: "groq-llama3",
    responseVerbosity: "concise",
    personality: "urgent",
  });
  expect(JSON.stringify(requests[0])).toContain("Audit briefing");
  expect(requests[0]).not.toHaveProperty("apiKey");
  await page.reload();
  await expect(page.getByText("Audit response received.", { exact: true })).toBeVisible();
});

test("SOS report opens printable sample history", async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: "role", value: "public", url: baseURL! }]);
  await page.goto("/public/settings/sos-history");
  const opening = page.waitForEvent("popup");
  await page.getByRole("button", { name: /Print \/ Save PDF Report/ }).click();
  const popup = await opening;
  await expect(
    popup.getByRole("heading", { name: "SafeSphere · Sample SOS history" }),
  ).toBeVisible();
  await popup.evaluate(() => {
    window.print = () => {
      document.body.dataset.printed = "yes";
    };
  });
  await popup.getByRole("button", { name: "Print / Save as PDF" }).click();
  await expect(popup.locator("body")).toHaveAttribute("data-printed", "yes");
});
