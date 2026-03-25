import { expect, test } from "@playwright/test";
import { stubStudioRoute } from "./helpers/studioRoute";

test.beforeEach(async ({ page }) => {
  await stubStudioRoute(page);
});

test("office settings panel reflects current gateway state", async ({ page }) => {
  await page.goto("/");

  await page.getByTitle("Voice reply settings").click();
  await expect(page.getByRole("button", { name: "Disconnect gateway" })).toBeVisible();
  await expect(page.getByText("Current studio connection and endpoint details.")).toBeVisible();
});
