import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { closeDb, ensureSchema, getSql } from "../lib/db";

const shots = "/opt/cursor/artifacts";

test.beforeAll(async () => {
  mkdirSync(shots, { recursive: true });
  await ensureSchema();
  await getSql()`TRUNCATE sessions CASCADE`;
});

test.afterAll(async () => {
  await closeDb();
});

test("name a night, jump back to it, and separate live rooms from settled ones", async ({ page, request }) => {
  await page.addInitScript(() => localStorage.setItem("www-theme", "dark"));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByLabel("Night name (optional)")).toBeVisible();
  await expect(page.getByLabel("Room code")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Join" })).toHaveCount(0);
  await expect(page.getByTestId("return-bar")).toHaveCount(0);
  await expect(page.getByTestId("your-nights")).toHaveCount(0);
  await expect(page.getByTestId("open-nights")).toHaveCount(0);

  await page.getByLabel("Night name (optional)").fill("Friday night picks");
  await page.getByRole("button", { name: "Start a night" }).click();
  await page.waitForURL(/\/s\/[a-z0-9]{4}$/);
  const friday = new URL(page.url()).pathname.split("/").pop() ?? "";

  await expect(page.getByTestId("night-name")).toHaveText("Friday night picks");
  await expect(page.getByTestId("return-bar")).toHaveCount(0);
  await page.getByLabel("Your name").fill("Sam");
  await page.getByLabel("Add a show").fill("The Bear");
  await page.getByRole("button", { name: "Put it on the wheel" }).click();
  await expect(page.getByTestId("show-row").filter({ hasText: "The Bear" })).toBeVisible();
  await page.getByLabel("Add a show").fill("Hacks");
  await page.getByRole("button", { name: "Put it on the wheel" }).click();
  await expect(page.getByTestId("show-row")).toHaveCount(2);

  await page.evaluate(() => window.scrollTo(0, 0));
  await shoot(page, "named-room-dark-mobile");
  await setTheme(page, "light");
  await page.evaluate(() => window.scrollTo(0, 0));
  await shoot(page, "named-room-light-mobile");
  await setTheme(page, "dark");

  await page.getByRole("button", { name: "Rename" }).click();
  await page.getByLabel("Night name", { exact: true }).fill("Couch finals");
  await page.getByRole("button", { name: "Save name" }).click();
  await expect(page.getByTestId("night-name")).toHaveText("Couch finals");
  await page.getByRole("button", { name: "Rename" }).click();
  const renameInput = page.getByLabel("Night name", { exact: true });
  await renameInput.fill("");
  await page.getByRole("button", { name: "Save name" }).click();
  await expect(page.getByTestId("night-name")).toHaveText(`Night ${friday}`);
  await page.getByRole("button", { name: "Rename" }).click();
  await page.getByLabel("Night name", { exact: true }).fill("Friday night picks");
  await page.getByRole("button", { name: "Save name" }).click();
  await expect(page.getByTestId("night-name")).toHaveText("Friday night picks");

  await page.goto("/");
  await page.getByLabel("Night name (optional)").fill("Movie Monday");
  await page.getByRole("button", { name: "Start a night" }).click();
  await page.waitForURL(/\/s\/[a-z0-9]{4}$/);
  const monday = new URL(page.url()).pathname.split("/").pop() ?? "";
  await expect(page.getByTestId("night-name")).toHaveText("Movie Monday");
  await expect(page.getByTestId("return-bar")).toContainText("Friday night picks");
  await expect(page.getByTestId("return-bar")).toContainText("Adding shows");
  await expect(page.getByTestId("return-bar")).toContainText("2 live");

  await finishNight(request, monday, ["Alien", "Heat"]);
  await expect(page.getByTestId("winner")).toBeVisible({ timeout: 15_000 });

  const createdLate = await request.post("/api/sessions", { data: { name: "Late shift" } });
  expect(createdLate.ok()).toBeTruthy();
  const late = ((await createdLate.json()) as { code: string }).code;

  await page.goto("/");
  await page.evaluate(() => window.dispatchEvent(new Event("www-nights")));
  const openNights = page.getByTestId("open-nights");
  await expect(openNights).toContainText("Friday night picks");
  await expect(openNights).toContainText("Late shift");
  await expect(openNights).not.toContainText("Movie Monday");
  const yours = page.getByTestId("your-nights");
  await expect(yours).toContainText("Movie Monday");
  await expect(yours).toContainText("Done");
  await expect(yours).not.toContainText("Friday night picks");
  await expect(yours).not.toContainText("Late shift");
  await expect(page.getByTestId("return-bar")).toContainText("Friday night picks");
  await expect(page.getByTestId("return-bar")).toContainText("Adding shows");
  await expect(page.getByTestId("return-bar")).not.toContainText("live");

  await page.evaluate(() => window.scrollTo(0, 0));
  await shoot(page, "home-your-nights-dark-mobile", true);
  await setTheme(page, "light");
  await page.evaluate(() => window.scrollTo(0, 0));
  await shoot(page, "home-your-nights-light-mobile", true);
  await setTheme(page, "dark");

  await openNights.getByRole("link", { name: "Late shift" }).click();
  await page.waitForURL(new RegExp(`/s/${late}$`));
  await expect(page.getByTestId("night-name")).toHaveText("Late shift");
  await expect(page.getByTestId("return-bar")).toContainText("Friday night picks");
  await finishNight(request, late, ["Dune", "Heat"]);

  await page.goto("/history");
  await expect(page.getByRole("heading", { name: "Happening now" })).toBeVisible();
  const happening = page.getByTestId("happening-now");
  await expect(happening).toContainText("Friday night picks");
  await expect(happening).toContainText("Adding shows");
  await expect(happening).not.toContainText("Movie Monday");
  await expect(page.getByRole("link", { name: /Movie Monday/ })).toBeVisible();
  await expect(page.getByTestId("return-bar")).toContainText("Friday night picks");
  await page.evaluate(() => window.scrollTo(0, 0));
  await shoot(page, "happening-now-dark-mobile");
  await setTheme(page, "light");
  await page.evaluate(() => window.scrollTo(0, 0));
  await shoot(page, "happening-now-light-mobile");
  await setTheme(page, "dark");

  await page.getByTestId("return-bar").click();
  await page.waitForURL(new RegExp(`/s/${friday}$`));
  await expect(page.getByTestId("night-name")).toHaveText("Friday night picks");
  await expect(page.getByTestId("return-bar")).toHaveCount(0);

  await finishNight(request, friday);
  await page.goto("/history");
  await page.evaluate(() => window.dispatchEvent(new Event("www-nights")));
  await expect(page.getByTestId("happening-now")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Movie Monday/ })).toBeVisible();
  await expect(page.getByTestId("return-bar")).toHaveCount(0, { timeout: 10_000 });
});

async function finishNight(request: APIRequestContext, code: string, titles?: string[]) {
  if (titles) {
    for (const title of titles) {
      const added = await request.post(`/api/sessions/${code}/shows`, {
        headers: {
          "x-device-token": randomUUID(),
          "content-type": "application/json",
        },
        data: { name: "Sam", title },
      });
      expect(added.ok()).toBeTruthy();
    }
  }
  expect((await request.post(`/api/sessions/${code}/lock`)).ok()).toBeTruthy();
  expect((await request.post(`/api/sessions/${code}/spin`)).ok()).toBeTruthy();
  await new Promise((resolve) => setTimeout(resolve, 2_200));
  const finale = await request.post(`/api/sessions/${code}/spin`);
  expect(finale.ok()).toBeTruthy();
  const body = (await finale.json()) as { result?: string };
  expect(body.result).toBe("winner");
}

async function setTheme(page: Page, theme: "light" | "dark") {
  const current = await page.locator("html").getAttribute("data-theme");
  if (current !== theme) {
    await page.getByRole("button", { name: "Switch color theme" }).click();
  }
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
}

async function shoot(page: Page, name: string, fullPage = false) {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: `${shots}/${name}.png`,
    animations: "disabled",
    fullPage,
  });
}
