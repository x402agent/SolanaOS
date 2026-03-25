import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { AgentState } from "@/features/agents/state/store";
import { AgentSettingsPanel } from "@/features/agents/components/AgentInspectPanels";

const createAgent = (): AgentState => ({
  agentId: "agent-1",
  name: "Web Researcher",
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
});

describe("AgentSettingsPanel header", () => {
  afterEach(() => {
    cleanup();
  });

  it("uses inspect header style with agent title", () => {
    render(
      createElement(AgentSettingsPanel, {
        agent: createAgent(),
        onClose: vi.fn(),
        onDelete: vi.fn(),
        onToolCallingToggle: vi.fn(),
        onThinkingTracesToggle: vi.fn(),
        cronJobs: [],
        cronLoading: false,
        cronError: null,
        cronRunBusyJobId: null,
        cronDeleteBusyJobId: null,
        onRunCronJob: vi.fn(),
        onDeleteCronJob: vi.fn(),
      })
    );

    expect(screen.queryByText("Capabilities")).not.toBeInTheDocument();
    expect(screen.getByText("Web Researcher")).toBeInTheDocument();
    expect(screen.getByLabelText("Close panel")).toBeInTheDocument();
  });
});
