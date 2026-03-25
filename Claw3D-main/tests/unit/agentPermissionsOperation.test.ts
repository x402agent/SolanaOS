import { describe, expect, it } from "vitest";

import {
  isPermissionsCustom,
  resolveAgentPermissionsDraft,
  resolveCommandModeFromRole,
  resolvePresetDefaultsForRole,
  resolveRoleForCommandMode,
  resolveToolGroupOverrides,
  resolveToolGroupStateFromConfigEntry,
} from "@/features/agents/operations/agentPermissionsOperation";

describe("agentPermissionsOperation", () => {
  it("maps command mode and preset role in both directions", () => {
    expect(resolveRoleForCommandMode("off")).toBe("conservative");
    expect(resolveRoleForCommandMode("ask")).toBe("collaborative");
    expect(resolveRoleForCommandMode("auto")).toBe("autonomous");

    expect(resolveCommandModeFromRole("conservative")).toBe("off");
    expect(resolveCommandModeFromRole("collaborative")).toBe("ask");
    expect(resolveCommandModeFromRole("autonomous")).toBe("auto");
  });

  it("resolves autonomous preset defaults to permissive capabilities", () => {
    expect(resolvePresetDefaultsForRole("autonomous")).toEqual({
      commandMode: "auto",
      webAccess: true,
      fileTools: true,
    });
  });

  it("derives tool-group state from allow and deny with deny precedence", () => {
    const state = resolveToolGroupStateFromConfigEntry({
      allow: ["group:web", "group:runtime"],
      deny: ["group:web"],
    });

    expect(state.usesAllow).toBe(true);
    expect(state.runtime).toBe(true);
    expect(state.web).toBe(false);
    expect(state.fs).toBeNull();
  });

  it("merges group toggles while preserving allow mode", () => {
    const overrides = resolveToolGroupOverrides({
      existingTools: {
        allow: ["group:web", "custom:tool"],
        deny: ["group:runtime", "group:fs"],
      },
      runtimeEnabled: true,
      webEnabled: false,
      fsEnabled: true,
    });

    expect(overrides.tools.allow).toEqual(
      expect.arrayContaining(["custom:tool", "group:runtime", "group:fs"])
    );
    expect(overrides.tools.allow).not.toEqual(expect.arrayContaining(["group:web"]));
    expect(overrides.tools.deny).toEqual(expect.arrayContaining(["group:web"]));
    expect(overrides.tools.deny).not.toEqual(
      expect.arrayContaining(["group:runtime", "group:fs"])
    );
  });

  it("merges group toggles while preserving alsoAllow mode", () => {
    const overrides = resolveToolGroupOverrides({
      existingTools: {
        alsoAllow: ["group:web"],
        deny: [],
      },
      runtimeEnabled: true,
      webEnabled: true,
      fsEnabled: false,
    });

    expect(overrides.tools).not.toHaveProperty("allow");
    expect(overrides.tools.alsoAllow).toEqual(
      expect.arrayContaining(["group:web", "group:runtime"])
    );
    expect(overrides.tools.deny).toEqual(expect.arrayContaining(["group:fs"]));
  });

  it("resolves draft from session role and config group overrides", () => {
    const draft = resolveAgentPermissionsDraft({
      agent: {
        sessionExecSecurity: "allowlist",
        sessionExecAsk: "always",
      },
      existingTools: {
        allow: ["group:web"],
        deny: ["group:fs"],
      },
    });

    expect(draft).toEqual({
      commandMode: "ask",
      webAccess: true,
      fileTools: false,
    });
  });

  it("flags custom draft when advanced values diverge from preset baseline", () => {
    expect(
      isPermissionsCustom({
        role: "autonomous",
        draft: {
          commandMode: "auto",
          webAccess: false,
          fileTools: true,
        },
      })
    ).toBe(true);
  });
});
