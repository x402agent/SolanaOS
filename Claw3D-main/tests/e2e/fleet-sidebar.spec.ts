import { expect, test } from "@playwright/test";
import { stubStudioRoute } from "./helpers/studioRoute";

test.beforeEach(async ({ page }) => {
  await stubStudioRoute(page);
});

test("shows_office_shell_from_root_redirect", async ({ page }) => {
  await page.goto("/");

  await expect
    .poll(() => new URL(page.url()).pathname)
    .toBe("/office");
  await expect(page.getByRole("button", { name: "Open headquarters sidebar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "CHAT" })).toBeVisible();
});

test("persists_gateway_fields_to_studio_settings", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Upstream URL").fill("ws://gateway.example:18789");
  await page.getByLabel("Upstream token").fill("token-123");

  const request = await page.waitForRequest((req) => {
    if (!req.url().includes("/api/studio") || req.method() !== "PUT") {
      return false;
    }
    const payload = JSON.parse(req.postData() ?? "{}") as Record<string, unknown>;
    const gateway = (payload.gateway ?? {}) as { url?: string; token?: string };
    return gateway.url === "ws://gateway.example:18789" && gateway.token === "token-123";
  });
  const payload = JSON.parse(request.postData() ?? "{}") as Record<string, unknown>;
  const gateway = (payload.gateway ?? {}) as { url?: string; token?: string };
  expect(gateway.url).toBe("ws://gateway.example:18789");
  expect(gateway.token).toBe("token-123");
});

test("focused_preferences_persist_across_reload", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("button", { name: "Open headquarters sidebar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "CHAT" })).toBeVisible();

  await page.reload();

  await expect
    .poll(() => new URL(page.url()).pathname)
    .toBe("/office");
  await expect(page.getByRole("button", { name: "Open headquarters sidebar" })).toBeVisible();
});

test("shows_chat_entrypoint_in_office_shell", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("button", { name: "CHAT" })).toBeVisible();
  await expect(page.getByTitle("Voice reply settings")).toBeVisible();
});
