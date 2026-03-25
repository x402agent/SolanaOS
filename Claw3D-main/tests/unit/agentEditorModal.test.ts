import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AgentEditorModal } from "@/features/agents/components/AgentEditorModal";
import { createDefaultAgentAvatarProfile } from "@/lib/avatars/profile";
import type { AgentState } from "@/features/agents/state/store";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";

vi.mock("@/features/agents/components/AgentAvatarPreview3D", () => ({
  AgentAvatarPreview3D: () => createElement("div", { "data-testid": "avatar-preview-3d" }, "preview"),
}));

vi.mock("@/features/agents/components/inspect/AgentBrainPanel", () => ({
  AgentBrainPanel: ({
    selectedAgentId,
    activeSection,
  }: {
    selectedAgentId: string | null;
    activeSection?: string;
  }) =>
    createElement(
      "div",
      { "data-testid": "brain-panel" },
      `brain:${selectedAgentId}:${activeSection ?? "all"}`,
    ),
}));

const buildAgent = (): AgentState =>
  ({
    agentId: "agent-1",
    name: "Agent One",
    avatarProfile: createDefaultAgentAvatarProfile("seed-a"),
    avatarSeed: "seed-a",
    avatarUrl: null,
    status: "idle",
    sessionCreated: false,
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
    queuedMessages: [],
    sessionSettingsSynced: false,
    historyLoadedAt: null,
    historyFetchLimit: null,
    historyFetchedCount: null,
    historyMaybeTruncated: false,
    toolCallingEnabled: true,
    showThinkingTraces: false,
    sessionKey: "session-1",
    model: undefined,
    thinkingLevel: undefined,
  }) as AgentState;

describe("AgentEditorModal", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it("saves avatar changes from the avatar section", async () => {
    const agent = buildAgent();
    const onAvatarSave = vi.fn(async () => {});
    const initialBackpack = agent.avatarProfile?.accessories.backpack;

    render(
      createElement(AgentEditorModal, {
        open: true,
        client: {} as GatewayClient,
        agents: [agent],
        agent,
        onClose: () => {},
        onAvatarSave,
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Backpack" }));
    fireEvent.click(screen.getByRole("button", { name: "Save avatar" }));

    expect(onAvatarSave).toHaveBeenCalledTimes(1);
    expect(onAvatarSave).toHaveBeenCalledWith(
      "agent-1",
      expect.objectContaining({
        seed: "seed-a",
        accessories: expect.objectContaining({ backpack: !initialBackpack }),
      }),
    );
  });

  it("switches to another file section", () => {
    const agent = buildAgent();

    render(
      createElement(AgentEditorModal, {
        open: true,
        client: {} as GatewayClient,
        agents: [agent],
        agent,
        onClose: () => {},
        onAvatarSave: () => {},
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: /Tools/i }));

    expect(screen.getByTestId("brain-panel")).toHaveTextContent("brain:agent-1:TOOLS.md");
  });

  it("honors the initial file section", () => {
    const agent = buildAgent();

    render(
      createElement(AgentEditorModal, {
        open: true,
        client: {} as GatewayClient,
        agents: [agent],
        agent,
        initialSection: "MEMORY.md",
        onClose: () => {},
        onAvatarSave: () => {},
      }),
    );

    expect(screen.getByTestId("brain-panel")).toHaveTextContent("brain:agent-1:MEMORY.md");
  });
});
