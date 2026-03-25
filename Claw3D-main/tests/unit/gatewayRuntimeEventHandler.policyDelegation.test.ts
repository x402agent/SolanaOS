import { afterEach, describe, expect, it, vi } from "vitest";

import type { AgentState } from "@/features/agents/state/store";
import type { EventFrame } from "@/lib/gateway/GatewayClient";

const policyMocks = vi.hoisted(() => ({
  decideRuntimeChatEvent: vi.fn(),
  decideRuntimeAgentEvent: vi.fn(),
  decideSummaryRefreshEvent: vi.fn(),
}));

vi.mock("@/features/agents/state/runtimeEventPolicy", () => policyMocks);

import { createGatewayRuntimeEventHandler } from "@/features/agents/state/gatewayRuntimeEventHandler";

const createAgent = (overrides?: Partial<AgentState>): AgentState => ({
  agentId: "agent-1",
  name: "Agent One",
  sessionKey: "agent:agent-1:studio:test-session",
  status: "running",
  sessionCreated: true,
  awaitingUserInput: false,
  hasUnseenActivity: false,
  outputLines: [],
  lastResult: null,
  lastDiff: null,
  runId: "run-1",
  runStartedAt: 900,
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
  avatarSeed: "seed-1",
  avatarUrl: null,
  ...(overrides ?? {}),
});

describe("gateway runtime event handler policy delegation", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("uses chat policy intents to drive delta live patching", () => {
    policyMocks.decideRuntimeChatEvent.mockReturnValue([
      {
        kind: "queueLivePatch",
        agentId: "agent-1",
        patch: { streamText: "from-policy", status: "running" },
      },
    ]);
    const queueLivePatch = vi.fn();
    const handler = createGatewayRuntimeEventHandler({
      getStatus: () => "connected",
      getAgents: () => [createAgent()],
      dispatch: vi.fn(),
      queueLivePatch,
      clearPendingLivePatch: vi.fn(),
      now: () => 1000,
      loadSummarySnapshot: vi.fn(async () => {}),
      requestHistoryRefresh: vi.fn(async () => {}),
      refreshHeartbeatLatestUpdate: vi.fn(),
      bumpHeartbeatTick: vi.fn(),
      setTimeout: (fn, ms) => setTimeout(fn, ms) as unknown as number,
      clearTimeout: (id) => clearTimeout(id as unknown as NodeJS.Timeout),
      isDisconnectLikeError: () => false,
      logWarn: vi.fn(),
      updateSpecialLatestUpdate: vi.fn(),
    });

    const event: EventFrame = {
      type: "event",
      event: "chat",
      payload: {
        runId: "run-1",
        sessionKey: "agent:agent-1:studio:test-session",
        state: "delta",
        message: { role: "assistant", content: "raw" },
      },
    };
    handler.handleEvent(event);

    expect(policyMocks.decideRuntimeChatEvent).toHaveBeenCalledTimes(1);
    expect(queueLivePatch).toHaveBeenCalledWith("agent-1", {
      streamText: "from-policy",
      status: "running",
    });
  });

  it("uses agent policy intents to short-circuit processing", () => {
    policyMocks.decideRuntimeAgentEvent.mockReturnValue([{ kind: "ignore", reason: "forced" }]);
    const queueLivePatch = vi.fn();
    const handler = createGatewayRuntimeEventHandler({
      getStatus: () => "connected",
      getAgents: () => [createAgent()],
      dispatch: vi.fn(),
      queueLivePatch,
      clearPendingLivePatch: vi.fn(),
      now: () => 1000,
      loadSummarySnapshot: vi.fn(async () => {}),
      requestHistoryRefresh: vi.fn(async () => {}),
      refreshHeartbeatLatestUpdate: vi.fn(),
      bumpHeartbeatTick: vi.fn(),
      setTimeout: (fn, ms) => setTimeout(fn, ms) as unknown as number,
      clearTimeout: (id) => clearTimeout(id as unknown as NodeJS.Timeout),
      isDisconnectLikeError: () => false,
      logWarn: vi.fn(),
      updateSpecialLatestUpdate: vi.fn(),
    });

    handler.handleEvent({
      type: "event",
      event: "agent",
      payload: {
        runId: "run-1",
        sessionKey: "agent:agent-1:studio:test-session",
        stream: "assistant",
        data: { delta: "raw" },
      },
    } as EventFrame);

    expect(policyMocks.decideRuntimeAgentEvent).toHaveBeenCalledTimes(1);
    expect(queueLivePatch).not.toHaveBeenCalled();
  });

  it("uses summary policy intents for heartbeat refresh behavior", async () => {
    vi.useFakeTimers();
    policyMocks.decideSummaryRefreshEvent.mockReturnValue([
      {
        kind: "scheduleSummaryRefresh",
        delayMs: 10,
        includeHeartbeatRefresh: true,
      },
    ]);
    const loadSummarySnapshot = vi.fn(async () => {});
    const bumpHeartbeatTick = vi.fn();
    const refreshHeartbeatLatestUpdate = vi.fn();
    const handler = createGatewayRuntimeEventHandler({
      getStatus: () => "connected",
      getAgents: () => [createAgent()],
      dispatch: vi.fn(),
      queueLivePatch: vi.fn(),
      clearPendingLivePatch: vi.fn(),
      now: () => 1000,
      loadSummarySnapshot,
      requestHistoryRefresh: vi.fn(async () => {}),
      refreshHeartbeatLatestUpdate,
      bumpHeartbeatTick,
      setTimeout: (fn, ms) => setTimeout(fn, ms) as unknown as number,
      clearTimeout: (id) => clearTimeout(id as unknown as NodeJS.Timeout),
      isDisconnectLikeError: () => false,
      logWarn: vi.fn(),
      updateSpecialLatestUpdate: vi.fn(),
    });

    handler.handleEvent({ type: "event", event: "presence", payload: {} });
    await vi.advanceTimersByTimeAsync(10);

    expect(policyMocks.decideSummaryRefreshEvent).toHaveBeenCalledTimes(1);
    expect(bumpHeartbeatTick).toHaveBeenCalledTimes(1);
    expect(refreshHeartbeatLatestUpdate).toHaveBeenCalledTimes(1);
    expect(loadSummarySnapshot).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
