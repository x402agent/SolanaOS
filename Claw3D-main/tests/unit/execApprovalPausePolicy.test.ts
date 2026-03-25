import { describe, expect, it } from "vitest";

import { shouldPauseRunForPendingExecApproval } from "@/features/agents/approvals/execApprovalPausePolicy";
import type { PendingExecApproval } from "@/features/agents/approvals/types";
import type { AgentState } from "@/features/agents/state/store";

const createAgent = (overrides?: Partial<AgentState>): AgentState => ({
  agentId: "agent-1",
  name: "Agent One",
  sessionKey: "agent:agent-1:main",
  status: "running",
  sessionCreated: true,
  awaitingUserInput: false,
  hasUnseenActivity: false,
  outputLines: [],
  lastResult: null,
  lastDiff: null,
  runId: "run-1",
  runStartedAt: 1,
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
  thinkingLevel: "high",
  avatarSeed: "seed",
  avatarUrl: null,
  sessionExecAsk: "always",
  ...overrides,
});

const createApproval = (overrides?: Partial<PendingExecApproval>): PendingExecApproval => ({
  id: "approval-1",
  agentId: "agent-1",
  sessionKey: "agent:agent-1:main",
  command: "ls -la",
  cwd: "/repo",
  host: "gateway",
  security: "allowlist",
  ask: "always",
  resolvedPath: null,
  createdAtMs: 1,
  expiresAtMs: 2,
  resolving: false,
  error: null,
  ...overrides,
});

describe("execApprovalPausePolicy", () => {
  it("pauses run when approval ask is always", () => {
    expect(
      shouldPauseRunForPendingExecApproval({
        agent: createAgent(),
        approval: createApproval({ ask: "always" }),
        pausedRunId: null,
      })
    ).toBe(true);
  });

  it("does not pause when approval ask is not always", () => {
    expect(
      shouldPauseRunForPendingExecApproval({
        agent: createAgent({ sessionExecAsk: "always" }),
        approval: createApproval({ ask: "on-miss" }),
        pausedRunId: null,
      })
    ).toBe(false);
  });

  it("falls back to agent ask when approval ask is missing", () => {
    expect(
      shouldPauseRunForPendingExecApproval({
        agent: createAgent({ sessionExecAsk: "always" }),
        approval: createApproval({ ask: null }),
        pausedRunId: null,
      })
    ).toBe(true);
    expect(
      shouldPauseRunForPendingExecApproval({
        agent: createAgent({ sessionExecAsk: "on-miss" }),
        approval: createApproval({ ask: null }),
        pausedRunId: null,
      })
    ).toBe(false);
  });

  it("does not pause when run is already paused for the same run id", () => {
    expect(
      shouldPauseRunForPendingExecApproval({
        agent: createAgent({ runId: "run-1" }),
        approval: createApproval({ ask: "always" }),
        pausedRunId: "run-1",
      })
    ).toBe(false);
  });

  it("does not pause without active running state", () => {
    expect(
      shouldPauseRunForPendingExecApproval({
        agent: createAgent({ status: "idle" }),
        approval: createApproval({ ask: "always" }),
        pausedRunId: null,
      })
    ).toBe(false);
    expect(
      shouldPauseRunForPendingExecApproval({
        agent: createAgent({ runId: null }),
        approval: createApproval({ ask: "always" }),
        pausedRunId: null,
      })
    ).toBe(false);
  });
});
