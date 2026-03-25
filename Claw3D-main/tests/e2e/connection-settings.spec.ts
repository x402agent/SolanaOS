import { expect, test } from "@playwright/test";
import { stubStudioRoute } from "./helpers/studioRoute";

test("voice reply settings persist to the studio settings API", async ({ page }) => {
  await stubStudioRoute(page);

  await page.goto("/");
  await page.getByTitle("Voice reply settings").click();
  await expect(page.getByRole("switch", { name: "Voice replies" })).toBeVisible();
  await page.waitForFunction(() => {
    const element = document.querySelector('[aria-label="Voice replies"]');
    return element instanceof HTMLButtonElement && !element.disabled;
  });

  const requestPromise = page.waitForRequest((req) => {
    if (!req.url().includes("/api/studio") || req.method() !== "PUT") {
      return false;
    }
    const payload = JSON.parse(req.postData() ?? "{}") as Record<string, unknown>;
    const voiceReplies = (payload.voiceReplies ?? {}) as Record<string, { enabled?: boolean }>;
    return Object.values(voiceReplies).some((entry) => entry.enabled === true);
  });
  await page.getByRole("switch", { name: "Voice replies" }).click();
  const request = await requestPromise;

  const payload = JSON.parse(request.postData() ?? "{}") as Record<string, unknown>;
  const voiceReplies = (payload.voiceReplies ?? {}) as Record<string, { enabled?: boolean }>;
  expect(Object.keys(voiceReplies).length).toBeGreaterThan(0);
  expect(Object.values(voiceReplies).some((entry) => entry.enabled === true)).toBe(true);
});
