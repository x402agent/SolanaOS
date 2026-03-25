import { describe, expect, it } from "vitest";

import type { AgentState, AgentStoreSeed } from "@/features/agents/state/store";
import { buildSessionEpochSnapshot, resolveResetAgentIds } from "@/lib/office/janitorReset";

const makeAgent = (
  overrides: Partial<AgentState> & Pick<AgentStoreSeed, "agentId" | "name" | "sessionKey">,
): AgentState => ({
  agentId: overrides.agentId,
  name: overrides.name,
  sessionKey: overrides.sessionKey,
  avatarSeed: overrides.avatarSeed ?? overrides.agentId,
  avatarUrl: overrides.avatarUrl ?? null,
  model: overrides.model ?? null,
  thinkingLevel: overrides.thinkingLevel ?? "high",
  sessionExecHost: overrides.sessionExecHost,
  sessionExecSecurity: overrides.sessionExecSecurity,
  sessionExecAsk: overrides.sessionExecAsk,
  status: overrides.status ?? "idle",
  sessionCreated: overrides.sessionCreated ?? false,
  awaitingUserInput: overrides.awaitingUserInput ?? false,
  hasUnseenActivity: overrides.hasUnseenActivity ?? false,
  outputLines: overrides.outputLines ?? [],
  lastResult: overrides.lastResult ?? null,
  lastDiff: overrides.lastDiff ?? null,
  runId: overrides.runId ?? null,
  runStartedAt: overrides.runStartedAt ?? null,
  streamText: overrides.streamText ?? null,
  thinkingTrace: overrides.thinkingTrace ?? null,
  latestOverride: overrides.latestOverride ?? null,
  latestOverrideKind: overrides.latestOverrideKind ?? null,
  lastAssistantMessageAt: overrides.lastAssistantMessageAt ?? null,
  lastActivityAt: overrides.lastActivityAt ?? null,
  latestPreview: overrides.latestPreview ?? null,
  lastUserMessage: overrides.lastUserMessage ?? null,
  draft: overrides.draft ?? "",
  queuedMessages: overrides.queuedMessages ?? [],
  sessionSettingsSynced: overrides.sessionSettingsSynced ?? false,
  historyLoadedAt: overrides.historyLoadedAt ?? null,
  historyFetchLimit: overrides.historyFetchLimit ?? null,
  historyFetchedCount: overrides.historyFetchedCount ?? null,
  historyMaybeTruncated: overrides.historyMaybeTruncated ?? false,
  toolCallingEnabled: overrides.toolCallingEnabled ?? false,
  showThinkingTraces: overrides.showThinkingTraces ?? true,
  transcriptEntries: overrides.transcriptEntries ?? [],
  transcriptRevision: overrides.transcriptRevision ?? 0,
  transcriptSequenceCounter: overrides.transcriptSequenceCounter ?? 0,
  sessionEpoch: overrides.sessionEpoch ?? 0,
  lastHistoryRequestRevision: overrides.lastHistoryRequestRevision ?? null,
  lastAppliedHistoryRequestId: overrides.lastAppliedHistoryRequestId ?? null,
});

describe("janitor reset signal", () => {
  it("triggers janitors when sessionEpoch increases", () => {
    const previous = [
      makeAgent({ agentId: "a1", name: "A1", sessionKey: "key", sessionEpoch: 2 }),
    ];
    const current = [
      makeAgent({ agentId: "a1", name: "A1", sessionKey: "key", sessionEpoch: 3 }),
    ];

    const triggered = resolveResetAgentIds({
      previous: buildSessionEpochSnapshot(previous),
      agents: current,
    });

    expect(triggered).toEqual(["a1"]);
  });

  it("triggers janitors when session key changes and epoch increases", () => {
    const previous = [
      makeAgent({ agentId: "a1", name: "A1", sessionKey: "old", sessionEpoch: 2 }),
    ];
    const current = [
      makeAgent({ agentId: "a1", name: "A1", sessionKey: "new", sessionEpoch: 3 }),
    ];

    const triggered = resolveResetAgentIds({
      previous: buildSessionEpochSnapshot(previous),
      agents: current,
    });

    expect(triggered).toEqual(["a1"]);
  });

  it("does not trigger when sessionEpoch stays the same", () => {
    const previous = [
      makeAgent({ agentId: "a1", name: "A1", sessionKey: "key", sessionEpoch: 2 }),
    ];
    const current = [
      makeAgent({ agentId: "a1", name: "A1", sessionKey: "key", sessionEpoch: 2 }),
    ];

    const triggered = resolveResetAgentIds({
      previous: buildSessionEpochSnapshot(previous),
      agents: current,
    });

    expect(triggered).toEqual([]);
  });

  it("ignores first hydration without prior snapshot", () => {
    const current = [
      makeAgent({ agentId: "a1", name: "A1", sessionKey: "key", sessionEpoch: 1 }),
    ];

    const triggered = resolveResetAgentIds({
      previous: {},
      agents: current,
    });

    expect(triggered).toEqual([]);
  });

  it("triggers for multiple agents independently", () => {
    const previous = [
      makeAgent({ agentId: "a1", name: "A1", sessionKey: "k1", sessionEpoch: 1 }),
      makeAgent({ agentId: "a2", name: "A2", sessionKey: "k2", sessionEpoch: 3 }),
    ];
    const current = [
      makeAgent({ agentId: "a1", name: "A1", sessionKey: "k1", sessionEpoch: 2 }),
      makeAgent({ agentId: "a2", name: "A2", sessionKey: "k2", sessionEpoch: 3 }),
    ];

    const triggered = resolveResetAgentIds({
      previous: buildSessionEpochSnapshot(previous),
      agents: current,
    });

    expect(triggered).toEqual(["a1"]);
  });
});
