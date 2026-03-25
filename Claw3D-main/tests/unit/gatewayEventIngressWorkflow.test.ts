import { describe, expect, it } from "vitest";

import { resolveExecApprovalEventEffects } from "@/features/agents/approvals/execApprovalLifecycleWorkflow";
import { resolveGatewayEventIngressDecision } from "@/features/agents/state/gatewayEventIngressWorkflow";
import type { AgentState } from "@/features/agents/state/store";
import type { EventFrame } from "@/lib/gateway/GatewayClient";

const createAgent = (overrides?: Partial<AgentState>): AgentState => ({
  agentId: "agent-1",
  name: "Agent One",
  sessionKey: "agent:agent-1:studio:test-session",
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
  avatarSeed: "seed-1",
  avatarUrl: null,
  ...(overrides ?? {}),
});

describe("gatewayEventIngressWorkflow", () => {
  it("returns no cron decision for non-cron events", () => {
    const event: EventFrame = { type: "event", event: "heartbeat", payload: {} };

    const decision = resolveGatewayEventIngressDecision({
      event,
      agents: [createAgent()],
      seenCronDedupeKeys: new Set<string>(),
      nowMs: 1000,
    });

    expect(decision.cronDedupeKeyToRecord).toBeNull();
    expect(decision.cronTranscriptIntent).toBeNull();
    expect(decision.approvalEffects).toBeNull();
  });

  it("ignores malformed cron payload variants", () => {
    const malformedEvents: EventFrame[] = [
      { type: "event", event: "cron", payload: null },
      { type: "event", event: "cron", payload: "bad" },
      { type: "event", event: "cron", payload: { action: "started" } },
      { type: "event", event: "cron", payload: { action: "finished", sessionKey: "" } },
      {
        type: "event",
        event: "cron",
        payload: { action: "finished", sessionKey: "invalid", jobId: "job-1" },
      },
      {
        type: "event",
        event: "cron",
        payload: { action: "finished", sessionKey: "agent:agent-1:main", jobId: "" },
      },
    ];

    for (const event of malformedEvents) {
      const decision = resolveGatewayEventIngressDecision({
        event,
        agents: [createAgent()],
        seenCronDedupeKeys: new Set<string>(),
        nowMs: 1000,
      });
      expect(decision.cronDedupeKeyToRecord).toBeNull();
      expect(decision.cronTranscriptIntent).toBeNull();
    }
  });

  it("returns dedupe and transcript intent for valid finished cron event", () => {
    const event: EventFrame = {
      type: "event",
      event: "cron",
      payload: {
        action: "finished",
        sessionKey: "agent:agent-1:main",
        jobId: "job-1",
        sessionId: "session-1",
        runAtMs: 123,
        status: "ok",
        summary: "cron summary",
      },
    };

    const seen = new Set<string>();
    const decision = resolveGatewayEventIngressDecision({
      event,
      agents: [createAgent({ sessionKey: "agent:agent-1:studio:test-session" })],
      seenCronDedupeKeys: seen,
      nowMs: 999,
    });

    expect(seen.size).toBe(0);
    expect(decision.cronDedupeKeyToRecord).toBe("cron:job-1:session-1");
    expect(decision.cronTranscriptIntent).toEqual({
      agentId: "agent-1",
      sessionKey: "agent:agent-1:studio:test-session",
      dedupeKey: "cron:job-1:session-1",
      line: "Cron finished (ok): job-1\n\ncron summary",
      timestampMs: 123,
      activityAtMs: 123,
    });
  });

  it("returns dedupe-only decision for unknown-agent finished cron", () => {
    const event: EventFrame = {
      type: "event",
      event: "cron",
      payload: {
        action: "finished",
        sessionKey: "agent:missing:main",
        jobId: "job-2",
        runAtMs: 456,
      },
    };

    const decision = resolveGatewayEventIngressDecision({
      event,
      agents: [createAgent()],
      seenCronDedupeKeys: new Set<string>(),
      nowMs: 1000,
    });

    expect(decision.cronDedupeKeyToRecord).toBe("cron:job-2:456");
    expect(decision.cronTranscriptIntent).toBeNull();
  });

  it("suppresses cron decision for duplicate dedupe key", () => {
    const event: EventFrame = {
      type: "event",
      event: "cron",
      payload: {
        action: "finished",
        sessionKey: "agent:agent-1:main",
        jobId: "job-3",
        runAtMs: 777,
      },
    };

    const decision = resolveGatewayEventIngressDecision({
      event,
      agents: [createAgent()],
      seenCronDedupeKeys: new Set(["cron:job-3:777"]),
      nowMs: 1000,
    });

    expect(decision.cronDedupeKeyToRecord).toBeNull();
    expect(decision.cronTranscriptIntent).toBeNull();
  });

  it("falls back to nowMs and no-output body when runAtMs/summary/error are missing", () => {
    const event: EventFrame = {
      type: "event",
      event: "cron",
      payload: {
        action: "finished",
        sessionKey: "agent:agent-1:main",
        jobId: "job-4",
      },
    };

    const decision = resolveGatewayEventIngressDecision({
      event,
      agents: [createAgent()],
      seenCronDedupeKeys: new Set<string>(),
      nowMs: 4321,
    });

    expect(decision.cronDedupeKeyToRecord).toBe("cron:job-4:none");
    expect(decision.cronTranscriptIntent).toEqual({
      agentId: "agent-1",
      sessionKey: "agent:agent-1:studio:test-session",
      dedupeKey: "cron:job-4:none",
      line: "Cron finished (unknown): job-4\n\n(no output)",
      timestampMs: 4321,
      activityAtMs: null,
    });
  });

  it("delegates approval event effects unchanged", () => {
    const agents = [createAgent()];
    const requestedEvent: EventFrame = {
      type: "event",
      event: "exec.approval.requested",
      payload: {
        id: "approval-1",
        request: {
          command: "npm test",
          cwd: "/repo",
          host: "gateway",
          security: "allowlist",
          ask: "always",
          agentId: "agent-1",
          resolvedPath: "/usr/bin/npm",
          sessionKey: "agent:agent-1:main",
        },
        createdAtMs: 100,
        expiresAtMs: 200,
      },
    };

    const expectedRequested = resolveExecApprovalEventEffects({
      event: requestedEvent,
      agents,
    });
    const requestedDecision = resolveGatewayEventIngressDecision({
      event: requestedEvent,
      agents,
      seenCronDedupeKeys: new Set<string>(),
      nowMs: 1000,
    });

    expect(requestedDecision.approvalEffects).toEqual(expectedRequested);
    expect(requestedDecision.approvalEffects?.markActivityAgentIds).toEqual(["agent-1"]);

    const resolvedEvent: EventFrame = {
      type: "event",
      event: "exec.approval.resolved",
      payload: {
        id: "approval-1",
        decision: "allow-once",
        resolvedBy: "studio",
        ts: 999,
      },
    };

    const expectedResolved = resolveExecApprovalEventEffects({ event: resolvedEvent, agents });
    const resolvedDecision = resolveGatewayEventIngressDecision({
      event: resolvedEvent,
      agents,
      seenCronDedupeKeys: new Set<string>(),
      nowMs: 1000,
    });

    expect(resolvedDecision.approvalEffects).toEqual(expectedResolved);
    expect(resolvedDecision.approvalEffects?.removals).toEqual(["approval-1"]);
  });
});
