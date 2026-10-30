import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { closeDb, ensureSchema, getSql } from "../lib/db";

const shots = "/opt/cursor/artifacts/screenshots";

test.beforeAll(async () => {
  mkdirSync(shots, { recursive: true });
  await ensureSchema();
  await getSql()`TRUNCATE sessions CASCADE`;
});

test.afterAll(async () => {
  await closeDb();
});

test("create, add, lock, spin, reveal, and history", async ({ page, browser, request }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /watchin/i })).toBeVisible();
  await shot(page, "landing_desktop");

  await page.setViewportSize({ width: 390, height: 844 });
  await shot(page, "landing_mobile", true);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "Start a night" }).click();
  await page.waitForURL(/\/s\/[a-z0-9]{4}$/);
  const code = new URL(page.url()).pathname.split("/").pop() ?? "";

  await page.getByLabel("Your name").fill("Sam");
  await page.getByLabel("Add a show").fill("The Bear");
  await page.getByRole("button", { name: "Put it on the wheel" }).click();
  await expect(page.getByTestId("show-row").filter({ hasText: "The Bear" })).toBeVisible();

  await page.getByLabel("Add a show").fill("Hacks");
  await page.getByRole("button", { name: "Put it on the wheel" }).click();
  await expect(page.getByTestId("show-row").filter({ hasText: "Hacks" })).toBeVisible();

  for (const [name, title] of [
    ["Jordan", "Succession"],
    ["Alex", "Slow Horses"],
    ["Riley", "Shogun"],
    ["Mina", "The Pitt"],
  ] as const) {
    const response = await request.post(`/api/sessions/${code}/shows`, {
      headers: {
        "x-device-token": randomUUID(),
        "content-type": "application/json",
      },
      data: { name, title },
    });
    expect(response.ok()).toBeTruthy();
  }

  await expect(page.getByTestId("show-row").filter({ hasText: "The Pitt" })).toBeVisible({ timeout: 8_000 });
  await expect(page.getByText("added by")).toHaveCount(0);

  const other = await browser.newPage();
  await other.goto(`/s/${code}`);
  await expect(other.getByText("The Bear", { exact: true }).first()).toBeVisible({ timeout: 8_000 });
  await other.close();

  await shot(page, "adding_shows_desktop");
  await page.setViewportSize({ width: 390, height: 844 });
  await shot(page, "adding_shows_mobile", true);
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.getByRole("button", { name: "Lock it in" }).click();
  await expect(page.getByLabel("Add a show")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Give it a spin" })).toBeEnabled();

  await spinOnce(page);
  await expect(page.getByTestId("show-row")).toHaveCount(5);
  await shot(page, "wheel_mid_session_desktop");
  await page.setViewportSize({ width: 390, height: 844 });
  await shot(page, "wheel_mid_session_mobile", true);
  await page.setViewportSize({ width: 1440, height: 900 });

  for (let turn = 0; turn < 8; turn += 1) {
    if (await page.getByTestId("winner").isVisible()) break;
    await spinOnce(page);
  }

  await expect(page.getByTestId("winner")).toBeVisible();
  await expect(page.getByText(/put this on the list/)).toBeVisible();
  await expect(page.getByText("How we got here")).toBeVisible();
  await expect(page.getByText(/added by/).first()).toBeVisible();
  const winner = ((await page.getByTestId("winner-title").textContent()) ?? "").trim();

  await shot(page, "winner_reveal_desktop");
  await page.setViewportSize({ width: 390, height: 844 });
  await shot(page, "winner_reveal_mobile", true);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/history");
  await expect(page.getByRole("heading", { name: "Past nights" })).toBeVisible();
  const historyLink = page.getByRole("link", { name: new RegExp(escapeRegExp(winner)) });
  await expect(historyLink).toBeVisible();
  await shot(page, "history_desktop");
  await page.setViewportSize({ width: 390, height: 844 });
  await shot(page, "history_mobile", true);
  await historyLink.click();
  await expect(page.getByTestId("winner-title")).toHaveText(winner);
});

async function spinOnce(page: Page) {
  const before = await page.getByTestId("show-row").count();
  const button = page.getByRole("button", { name: "Give it a spin" });
  await expect(button).toBeEnabled({ timeout: 15_000 });
  await button.click();
  await expect
    .poll(
      async () => {
        if ((await page.getByTestId("winner").count()) > 0) return -1;
        return page.getByTestId("show-row").count();
      },
      { timeout: 15_000 },
    )
    .toBeLessThan(before);
}

async function shot(page: Page, name: string, fullPage = false) {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: `${shots}/${name}_v3.png`,
    animations: "disabled",
    fullPage,
  });
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
