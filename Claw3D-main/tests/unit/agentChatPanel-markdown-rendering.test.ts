import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { AgentState } from "@/features/agents/state/store";
import { AgentChatPanel } from "@/features/agents/components/AgentChatPanel";
import type { GatewayModelChoice } from "@/lib/gateway/models";
import { formatThinkingMarkdown, formatToolCallMarkdown } from "@/lib/text/message-extract";

const createAgent = (): AgentState => ({
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
  model: null,
  thinkingLevel: null,
  avatarSeed: "seed-1",
  avatarUrl: null,
});

describe("AgentChatPanel markdown rendering", () => {
  const models: GatewayModelChoice[] = [{ provider: "openai", id: "gpt-5", name: "gpt-5" }];

  afterEach(() => {
    cleanup();
  });

  it("renders assistant markdown separately from tool detail cards", () => {
    render(
      createElement(AgentChatPanel, {
        agent: {
          ...createAgent(),
          outputLines: [
            "> summarize rendering changes",
            "Here is the output:\n- keep assistant markdown\n- keep tool boundaries\n\n```ts\nconst answer = 42;\n```",
            "[[tool-result]] shell (call-2)\nok\n```text\ndone\n```",
          ],
        },
        isSelected: true,
        canSend: true,
        models,
        stopBusy: false,
        onLoadMoreHistory: vi.fn(),
        onOpenSettings: vi.fn(),
        onModelChange: vi.fn(),
        onThinkingChange: vi.fn(),
        onDraftChange: vi.fn(),
        onSend: vi.fn(),
        onStopRun: vi.fn(),
        onAvatarShuffle: vi.fn(),
      })
    );

    const assistantListItem = screen.getByText("keep assistant markdown");
    expect(assistantListItem).toBeInTheDocument();
    expect(screen.getByText("keep tool boundaries")).toBeInTheDocument();
    expect(screen.getByText("const answer = 42;")).toBeInTheDocument();
    expect(assistantListItem.closest("details")).toBeNull();

    expect(screen.queryByText(/^Output$/)).not.toBeInTheDocument();
    expect(screen.queryByText("Extract output")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Thinking (internal)"));
    const toolSummary = screen.getByText("SHELL · ok");
    const toolDetails = toolSummary.closest("details");
    expect(toolDetails).toBeTruthy();
    fireEvent.click(toolSummary);
    expect(within(toolDetails as HTMLElement).getByText("done")).toBeInTheDocument();
  });

  it("nests tool calls inside the associated thinking details block", () => {
    const firstToolCall = formatToolCallMarkdown({
      id: "call_1",
      name: "memory_search",
      arguments: { query: "priority ledger" },
    });
    const secondToolCall = formatToolCallMarkdown({
      id: "call_2",
      name: "memory_search",
      arguments: { query: "youtube channel tasks" },
    });

    render(
      createElement(AgentChatPanel, {
        agent: {
          ...createAgent(),
          outputLines: [
            "> how are you prioritizing this?",
            firstToolCall,
            secondToolCall,
            formatThinkingMarkdown("Proposing multi-lane tracking system"),
            "Short answer: a pinned priority ledger keeps the loop aligned.",
          ],
        },
        isSelected: true,
        canSend: true,
        models,
        stopBusy: false,
        onLoadMoreHistory: vi.fn(),
        onOpenSettings: vi.fn(),
        onModelChange: vi.fn(),
        onThinkingChange: vi.fn(),
        onDraftChange: vi.fn(),
        onSend: vi.fn(),
        onStopRun: vi.fn(),
        onAvatarShuffle: vi.fn(),
      })
    );

    const thinkingDetails = screen.getByText("Thinking (internal)").closest("details");
    expect(thinkingDetails).toBeTruthy();
    fireEvent.click(screen.getByText("Thinking (internal)"));
    expect(within(thinkingDetails as HTMLElement).getByText(/proposing multi-lane tracking system/i)).toBeInTheDocument();

    const memorySearchSummaries = screen.getAllByText(/MEMORY_SEARCH/);
    expect(memorySearchSummaries.length).toBe(2);
    for (const summary of memorySearchSummaries) {
      expect(thinkingDetails).toContainElement(summary);
    }
  });

  it("renders read tool calls as inline path labels instead of collapsible JSON blocks", () => {
    const readToolCall = formatToolCallMarkdown({
      id: "call_read_1",
      name: "read",
      arguments: { file_path: "/tmp/README.md" },
    });

    render(
      createElement(AgentChatPanel, {
        agent: {
          ...createAgent(),
          outputLines: [formatThinkingMarkdown("Reviewing docs"), readToolCall],
        },
        isSelected: true,
        canSend: true,
        models,
        stopBusy: false,
        onLoadMoreHistory: vi.fn(),
        onOpenSettings: vi.fn(),
        onModelChange: vi.fn(),
        onThinkingChange: vi.fn(),
        onDraftChange: vi.fn(),
        onSend: vi.fn(),
        onStopRun: vi.fn(),
        onAvatarShuffle: vi.fn(),
      })
    );

    fireEvent.click(screen.getByText("Thinking (internal)"));
    expect(screen.getByText("read /tmp/README.md")).toBeInTheDocument();
    expect(screen.queryByText("read /tmp/README.md", { selector: "summary" })).toBeNull();
    expect(screen.queryByText(/"file_path"/)).toBeNull();
  });
});
