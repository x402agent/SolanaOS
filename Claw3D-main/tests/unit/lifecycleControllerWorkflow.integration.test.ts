import { describe, expect, it } from "vitest";

import type { PendingExecApproval } from "@/features/agents/approvals/types";
import { resolveExecApprovalFollowUpIntent } from "@/features/agents/approvals/execApprovalLifecycleWorkflow";
import type { AgentState } from "@/features/agents/state/store";

const createAgent = (agentId: string, sessionKey: string): AgentState => ({
  agentId,
  name: agentId,
  sessionKey,
  status: "idle",
  sessionCreated: true,
  awaitingUserInput: false,
  hasUnseenActivity: false,
  outputLines: [],
  lastResult: null,
  lastDiff: null,
  runId: null,
  runStartedAt: null,
  streamText: null,
  thinkingTrace: null,
  latestOverride: null,
  latestOverrideKind: null,
  lastAssistantMessageAt: null,
  lastActivityAt: null,
  latestPreview: null,
  lastUserMessage: null,
  draft: "",
  sessionSettingsSynced: true,
  historyLoadedAt: null,
  historyFetchLimit: null,
  historyFetchedCount: null,
  historyMaybeTruncated: false,
  toolCallingEnabled: true,
  showThinkingTraces: true,
  model: "openai/gpt-5",
  thinkingLevel: "medium",
  avatarSeed: agentId,
  avatarUrl: null,
});

const createApproval = (): PendingExecApproval => ({
  id: "approval-1",
  agentId: null,
  sessionKey: "agent:agent-1:main",
  command: "npm run test",
  cwd: "/repo",
  host: "gateway",
  security: "allowlist",
  ask: "always",
  resolvedPath: "/usr/bin/npm",
  createdAtMs: 1,
  expiresAtMs: 2,
  resolving: false,
  error: null,
});

describe("lifecycleControllerWorkflow integration", () => {
  it("allow-once and allow-always still trigger follow-up message send once", () => {
    const approval = createApproval();
    const agents = [createAgent("agent-1", "agent:agent-1:main")];
    let sendCount = 0;

    for (const decision of ["allow-once", "allow-always"] as const) {
      const intent = resolveExecApprovalFollowUpIntent({
        decision,
        approval,
        agents,
        followUpMessage: "An exec approval was granted.",
      });
      if (intent.shouldSend) {
        sendCount += 1;
      }
    }

    expect(sendCount).toBe(2);
  });

  it("deny decision does not trigger follow-up message send", () => {
    const intent = resolveExecApprovalFollowUpIntent({
      decision: "deny",
      approval: createApproval(),
      agents: [createAgent("agent-1", "agent:agent-1:main")],
      followUpMessage: "An exec approval was granted.",
    });

    expect(intent).toEqual({
      shouldSend: false,
      agentId: null,
      sessionKey: null,
      message: null,
    });
  });
});
