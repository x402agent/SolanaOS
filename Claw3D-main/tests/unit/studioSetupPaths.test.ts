// @vitest-environment node

import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("studio setup paths", () => {
  it("resolves settings path under SOLANAOS_STATE_DIR when set", async () => {
    const { resolveStudioSettingsPath } = await import("../../server/studio-settings");
    const settingsPath = resolveStudioSettingsPath({
      SOLANAOS_STATE_DIR: "/tmp/solanaos-state",
    } as unknown as NodeJS.ProcessEnv);
    expect(settingsPath).toBe("/tmp/solanaos-state/claw3d/settings.json");
  });

  it("resolves settings path under ~/.solanaos by default", async () => {
    const { resolveStudioSettingsPath } = await import("../../server/studio-settings");
    const settingsPath = resolveStudioSettingsPath({} as NodeJS.ProcessEnv);
    expect(settingsPath).toBe(
      path.join(os.homedir(), ".solanaos", "claw3d", "settings.json")
    );
  });
});
