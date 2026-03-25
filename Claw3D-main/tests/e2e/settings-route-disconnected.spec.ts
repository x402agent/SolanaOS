import { expect, test } from "@playwright/test";
import { stubStudioRoute } from "./helpers/studioRoute";

test.beforeEach(async ({ page }) => {
  await stubStudioRoute(page);
});

test("settings route redirects to office", async ({ page }) => {
  await page.goto("/agents/main/settings");

  await expect
    .poll(() => new URL(page.url()).pathname, {
      message: "Expected settings route to redirect to office.",
    })
    .toBe("/office");
  await expect(page.getByRole("button", { name: "Open headquarters sidebar" })).toBeVisible();
});
