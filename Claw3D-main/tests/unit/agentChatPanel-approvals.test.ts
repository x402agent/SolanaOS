import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { AgentState } from "@/features/agents/state/store";
import { AgentChatPanel } from "@/features/agents/components/AgentChatPanel";
import type { PendingExecApproval } from "@/features/agents/approvals/types";

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
  model: "openai/gpt-5",
  thinkingLevel: "medium",
  avatarSeed: "seed-1",
  avatarUrl: null,
});

const createApproval = (overrides?: Partial<PendingExecApproval>): PendingExecApproval => ({
  id: "approval-1",
  agentId: "agent-1",
  sessionKey: "agent:agent-1:main",
  command: "npm run test",
  cwd: "/repo",
  host: "gateway",
  security: "allowlist",
  ask: "always",
  resolvedPath: "/bin/npm",
  createdAtMs: 1,
  expiresAtMs: 1_700_000_000_000,
  resolving: false,
  error: null,
  ...overrides,
});

describe("AgentChatPanel exec approvals", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders pending approval card with metadata", () => {
    render(
      createElement(AgentChatPanel, {
        agent: createAgent(),
        isSelected: true,
        canSend: true,
        models: [],
        stopBusy: false,
        onLoadMoreHistory: vi.fn(),
        onOpenSettings: vi.fn(),
        onModelChange: vi.fn(),
        onThinkingChange: vi.fn(),
        onDraftChange: vi.fn(),
        onSend: vi.fn(),
        onStopRun: vi.fn(),
        onAvatarShuffle: vi.fn(),
        pendingExecApprovals: [createApproval()],
      })
    );

    expect(screen.getByTestId("exec-approval-card-approval-1")).toBeInTheDocument();
    expect(screen.getByText("Exec approval required")).toBeInTheDocument();
    expect(screen.getByText("npm run test")).toBeInTheDocument();
    expect(screen.getByText("Host: gateway")).toBeInTheDocument();
    expect(screen.getByText("CWD: /repo")).toBeInTheDocument();
  });

  it("renders pending approvals after transcript content", () => {
    render(
      createElement(AgentChatPanel, {
        agent: {
          ...createAgent(),
          outputLines: ["> inspect approvals", "assistant says hello"],
        },
        isSelected: true,
        canSend: true,
        models: [],
        stopBusy: false,
        onLoadMoreHistory: vi.fn(),
        onOpenSettings: vi.fn(),
        onModelChange: vi.fn(),
        onThinkingChange: vi.fn(),
        onDraftChange: vi.fn(),
        onSend: vi.fn(),
        onStopRun: vi.fn(),
        onAvatarShuffle: vi.fn(),
        pendingExecApprovals: [createApproval()],
      })
    );

    const transcriptText = screen.getByText("assistant says hello");
    const approvalCard = screen.getByTestId("exec-approval-card-approval-1");
    expect(transcriptText.compareDocumentPosition(approvalCard) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("invokes resolve callback for all approval decisions", () => {
    const onResolveExecApproval = vi.fn();
    render(
      createElement(AgentChatPanel, {
        agent: createAgent(),
        isSelected: true,
        canSend: true,
        models: [],
        stopBusy: false,
        onLoadMoreHistory: vi.fn(),
        onOpenSettings: vi.fn(),
        onModelChange: vi.fn(),
        onThinkingChange: vi.fn(),
        onDraftChange: vi.fn(),
        onSend: vi.fn(),
        onStopRun: vi.fn(),
        onAvatarShuffle: vi.fn(),
        pendingExecApprovals: [createApproval()],
        onResolveExecApproval,
      })
    );

    fireEvent.click(screen.getByRole("button", { name: "Allow once for exec approval approval-1" }));
    fireEvent.click(screen.getByRole("button", { name: "Always allow for exec approval approval-1" }));
    fireEvent.click(screen.getByRole("button", { name: "Deny exec approval approval-1" }));

    expect(onResolveExecApproval).toHaveBeenNthCalledWith(1, "approval-1", "allow-once");
    expect(onResolveExecApproval).toHaveBeenNthCalledWith(2, "approval-1", "allow-always");
    expect(onResolveExecApproval).toHaveBeenNthCalledWith(3, "approval-1", "deny");
  });

  it("disables actions while approval is resolving", () => {
    render(
      createElement(AgentChatPanel, {
        agent: createAgent(),
        isSelected: true,
        canSend: true,
        models: [],
        stopBusy: false,
        onLoadMoreHistory: vi.fn(),
        onOpenSettings: vi.fn(),
        onModelChange: vi.fn(),
        onThinkingChange: vi.fn(),
        onDraftChange: vi.fn(),
        onSend: vi.fn(),
        onStopRun: vi.fn(),
        onAvatarShuffle: vi.fn(),
        pendingExecApprovals: [createApproval({ resolving: true })],
        onResolveExecApproval: vi.fn(),
      })
    );

    expect(screen.getByRole("button", { name: "Allow once for exec approval approval-1" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Always allow for exec approval approval-1" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Deny exec approval approval-1" })).toBeDisabled();
  });
});
