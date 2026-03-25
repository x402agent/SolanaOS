import { expect, test } from "@playwright/test";
import { createDefaultAgentAvatarProfile } from "@/lib/avatars/profile";
import { stubStudioRoute } from "./helpers/studioRoute";

test.beforeEach(async ({ page }) => {
  await stubStudioRoute(page, {
    version: 1,
    gateway: null,
    focused: {},
    avatars: {
      "ws://localhost:18789": {
        "agent-1": createDefaultAgentAvatarProfile("seed-1"),
      },
    },
  });
});

test("structured avatar settings fixture does not break focused load", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("button", { name: "Open headquarters sidebar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "CHAT" })).toBeVisible();
});
