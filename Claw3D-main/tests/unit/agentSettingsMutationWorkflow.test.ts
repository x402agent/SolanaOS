import { describe, expect, it } from "vitest";

import {
  planAgentSettingsMutation,
  type AgentSettingsMutationContext,
} from "@/features/agents/operations/agentSettingsMutationWorkflow";

const createContext = (
  overrides?: Partial<AgentSettingsMutationContext>
): AgentSettingsMutationContext => ({
  status: "connected",
  hasCreateBlock: false,
  hasRenameBlock: false,
  hasDeleteBlock: false,
  cronCreateBusy: false,
  cronRunBusyJobId: null,
  cronDeleteBusyJobId: null,
  ...(overrides ?? {}),
});

describe("agentSettingsMutationWorkflow", () => {
  it("denies_guarded_actions_when_not_connected", () => {
    const renameResult = planAgentSettingsMutation(
      { kind: "rename-agent", agentId: "agent-1" },
      createContext({ status: "disconnected" })
    );
    const skillsResult = planAgentSettingsMutation(
      { kind: "use-all-skills", agentId: "agent-1" },
      createContext({ status: "disconnected" })
    );
    const installResult = planAgentSettingsMutation(
      { kind: "install-skill", agentId: "agent-1", skillKey: "browser" },
      createContext({ status: "disconnected" })
    );
    const allowlistResult = planAgentSettingsMutation(
      { kind: "set-skills-allowlist", agentId: "agent-1" },
      createContext({ status: "disconnected" })
    );
    const globalToggleResult = planAgentSettingsMutation(
      { kind: "set-skill-global-enabled", agentId: "agent-1", skillKey: "browser" },
      createContext({ status: "disconnected" })
    );
    const removeResult = planAgentSettingsMutation(
      { kind: "remove-skill", agentId: "agent-1", skillKey: "browser" },
      createContext({ status: "disconnected" })
    );

    expect(renameResult).toEqual({
      kind: "deny",
      reason: "start-guard-deny",
      message: null,
      guardReason: "not-connected",
    });
    expect(skillsResult).toEqual({
      kind: "deny",
      reason: "start-guard-deny",
      message: null,
      guardReason: "not-connected",
    });
    expect(installResult).toEqual({
      kind: "deny",
      reason: "start-guard-deny",
      message: null,
      guardReason: "not-connected",
    });
    expect(allowlistResult).toEqual({
      kind: "deny",
      reason: "start-guard-deny",
      message: null,
      guardReason: "not-connected",
    });
    expect(globalToggleResult).toEqual({
      kind: "deny",
      reason: "start-guard-deny",
      message: null,
      guardReason: "not-connected",
    });
    expect(removeResult).toEqual({
      kind: "deny",
      reason: "start-guard-deny",
      message: null,
      guardReason: "not-connected",
    });
  });

  it("denies_delete_for_reserved_main_agent_with_actionable_message", () => {
    const result = planAgentSettingsMutation(
      { kind: "delete-agent", agentId: " main " },
      createContext()
    );

    expect(result).toEqual({
      kind: "deny",
      reason: "reserved-main-delete",
      message: "The main agent cannot be deleted.",
    });
  });

  it("denies_guarded_actions_when_mutation_block_is_active", () => {
    const result = planAgentSettingsMutation(
      { kind: "update-agent-permissions", agentId: "agent-1" },
      createContext({ hasCreateBlock: true })
    );

    expect(result).toEqual({
      kind: "deny",
      reason: "start-guard-deny",
      message: null,
      guardReason: "create-block-active",
    });
  });

  it("denies_cron_run_delete_when_other_cron_action_is_busy", () => {
    const result = planAgentSettingsMutation(
      { kind: "run-cron-job", agentId: "agent-1", jobId: "job-1" },
      createContext({ cronDeleteBusyJobId: "job-2" })
    );

    expect(result).toEqual({
      kind: "deny",
      reason: "cron-action-busy",
      message: null,
    });
  });

  it("allows_with_normalized_agent_and_job_ids", () => {
    const runResult = planAgentSettingsMutation(
      { kind: "run-cron-job", agentId: " agent-1 ", jobId: " job-1 " },
      createContext()
    );
    const deleteResult = planAgentSettingsMutation(
      { kind: "delete-agent", agentId: " agent-2 " },
      createContext()
    );

    expect(runResult).toEqual({
      kind: "allow",
      normalizedAgentId: "agent-1",
      normalizedJobId: "job-1",
    });
    expect(deleteResult).toEqual({
      kind: "allow",
      normalizedAgentId: "agent-2",
    });
  });

  it("denies_skill_toggle_when_skill_name_is_missing", () => {
    const result = planAgentSettingsMutation(
      { kind: "set-skill-enabled", agentId: "agent-1", skillName: "  " },
      createContext()
    );

    expect(result).toEqual({
      kind: "deny",
      reason: "missing-skill-name",
      message: null,
    });
  });

  it("denies_skill_setup_when_skill_key_is_missing", () => {
    const installResult = planAgentSettingsMutation(
      { kind: "install-skill", agentId: "agent-1", skillKey: "  " },
      createContext()
    );
    const saveResult = planAgentSettingsMutation(
      { kind: "save-skill-api-key", agentId: "agent-1", skillKey: "  " },
      createContext()
    );
    const globalToggleResult = planAgentSettingsMutation(
      { kind: "set-skill-global-enabled", agentId: "agent-1", skillKey: "  " },
      createContext()
    );
    const removeResult = planAgentSettingsMutation(
      { kind: "remove-skill", agentId: "agent-1", skillKey: "  " },
      createContext()
    );

    expect(installResult).toEqual({
      kind: "deny",
      reason: "missing-skill-key",
      message: null,
    });
    expect(saveResult).toEqual({
      kind: "deny",
      reason: "missing-skill-key",
      message: null,
    });
    expect(globalToggleResult).toEqual({
      kind: "deny",
      reason: "missing-skill-key",
      message: null,
    });
    expect(removeResult).toEqual({
      kind: "deny",
      reason: "missing-skill-key",
      message: null,
    });
  });

  it("allows_setting_skills_allowlist_with_normalized_agent_id", () => {
    const result = planAgentSettingsMutation(
      { kind: "set-skills-allowlist", agentId: " agent-1 " },
      createContext()
    );

    expect(result).toEqual({
      kind: "allow",
      normalizedAgentId: "agent-1",
    });
  });
});
