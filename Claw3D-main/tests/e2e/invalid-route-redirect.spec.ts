import { expect, test } from "@playwright/test";
import { stubStudioRoute } from "./helpers/studioRoute";

test.beforeEach(async ({ page }) => {
  await stubStudioRoute(page);
});

test("redirects unknown app routes to office", async ({ page }) => {
  await page.goto("/not-a-real-route");
  await expect
    .poll(() => new URL(page.url()).pathname, {
      message: "Expected invalid route to redirect to office path.",
    })
    .toBe("/office");
  await expect(page.getByRole("button", { name: "Open headquarters sidebar" })).toBeVisible();
});
