import { describe, expect, it } from "vitest";

import {
  resolveExecApprovalsPolicyForRole,
  resolveRuntimeToolOverridesForRole,
  resolveSessionExecSettingsForRole,
} from "@/features/agents/operations/agentPermissionsOperation";

describe("permissions role helpers", () => {
  it("maps roles to exec approvals policy while preserving allowlist", () => {
    const allowlist = [{ pattern: "a" }, { pattern: "b" }];

    expect(resolveExecApprovalsPolicyForRole({ role: "conservative", allowlist })).toBeNull();

    const collaborative = resolveExecApprovalsPolicyForRole({
      role: "collaborative",
      allowlist,
    });
    expect(collaborative).toEqual({
      security: "allowlist",
      ask: "always",
      allowlist,
    });
    expect(collaborative?.allowlist).toBe(allowlist);

    const autonomous = resolveExecApprovalsPolicyForRole({
      role: "autonomous",
      allowlist,
    });
    expect(autonomous).toEqual({
      security: "full",
      ask: "off",
      allowlist,
    });
    expect(autonomous?.allowlist).toBe(allowlist);
  });

  it("updates tool overrides using allow when existing tools.allow is present", () => {
    const existingTools = { allow: ["group:web"], deny: ["group:runtime"] };

    const collaborative = resolveRuntimeToolOverridesForRole({
      role: "collaborative",
      existingTools,
    });
    expect(collaborative.tools.allow).toEqual(expect.arrayContaining(["group:web", "group:runtime"]));
    expect(collaborative.tools).not.toHaveProperty("alsoAllow");
    expect(collaborative.tools.deny).not.toEqual(expect.arrayContaining(["group:runtime"]));

    const autonomous = resolveRuntimeToolOverridesForRole({
      role: "autonomous",
      existingTools,
    });
    expect(autonomous.tools.allow).toEqual(expect.arrayContaining(["group:web", "group:runtime"]));
    expect(autonomous.tools).not.toHaveProperty("alsoAllow");
    expect(autonomous.tools.deny).not.toEqual(expect.arrayContaining(["group:runtime"]));

    const conservative = resolveRuntimeToolOverridesForRole({
      role: "conservative",
      existingTools,
    });
    expect(conservative.tools.allow).toEqual(expect.arrayContaining(["group:web"]));
    expect(conservative.tools.allow).not.toEqual(expect.arrayContaining(["group:runtime"]));
    expect(conservative.tools.deny).toEqual(expect.arrayContaining(["group:runtime"]));
  });

  it("updates tool overrides using alsoAllow when tools.allow is absent", () => {
    const existingTools = { alsoAllow: ["group:web"], deny: [] as string[] };

    const collaborative = resolveRuntimeToolOverridesForRole({
      role: "collaborative",
      existingTools,
    });
    expect(collaborative.tools.alsoAllow).toEqual(expect.arrayContaining(["group:web", "group:runtime"]));
    expect(collaborative.tools).not.toHaveProperty("allow");

    const conservative = resolveRuntimeToolOverridesForRole({
      role: "conservative",
      existingTools,
    });
    expect(conservative.tools.alsoAllow).toEqual(expect.arrayContaining(["group:web"]));
    expect(conservative.tools.alsoAllow).not.toEqual(expect.arrayContaining(["group:runtime"]));
    expect(conservative.tools.deny).toEqual(expect.arrayContaining(["group:runtime"]));
  });

  it("resolves session exec settings from role and sandbox mode", () => {
    expect(resolveSessionExecSettingsForRole({ role: "conservative", sandboxMode: "all" })).toEqual({
      execHost: null,
      execSecurity: "deny",
      execAsk: "off",
    });

    expect(resolveSessionExecSettingsForRole({ role: "collaborative", sandboxMode: "all" }).execHost).toBe(
      "sandbox"
    );
    expect(resolveSessionExecSettingsForRole({ role: "autonomous", sandboxMode: "all" }).execHost).toBe(
      "sandbox"
    );

    expect(resolveSessionExecSettingsForRole({ role: "collaborative", sandboxMode: "none" }).execHost).toBe(
      "gateway"
    );
    expect(resolveSessionExecSettingsForRole({ role: "autonomous", sandboxMode: "none" }).execHost).toBe(
      "gateway"
    );
  });

  it("treats missing tools config as empty lists and still enforces group:runtime semantics", () => {
    const collaborative = resolveRuntimeToolOverridesForRole({
      role: "collaborative",
      existingTools: null,
    });
    expect(collaborative.tools.alsoAllow).toEqual(expect.arrayContaining(["group:runtime"]));
    expect(collaborative.tools).not.toHaveProperty("allow");
  });
});
