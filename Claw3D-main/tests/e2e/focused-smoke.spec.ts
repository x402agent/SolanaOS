import { expect, test } from "@playwright/test";
import { stubStudioRoute } from "./helpers/studioRoute";

test("loads office shell from root", async ({ page }) => {
  await stubStudioRoute(page);
  await page.goto("/");

  await expect
    .poll(() => new URL(page.url()).pathname)
    .toBe("/office");
  await expect(page.getByRole("button", { name: "Open headquarters sidebar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "CHAT" })).toBeVisible();
});
