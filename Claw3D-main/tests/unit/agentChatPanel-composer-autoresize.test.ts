import { createElement, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AgentState } from "@/features/agents/state/store";
import { AgentChatPanel } from "@/features/agents/components/AgentChatPanel";
import type { GatewayModelChoice } from "@/lib/gateway/models";

const createAgent = (patch?: Partial<AgentState>): AgentState => {
  const base: AgentState = {
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
  };
  const merged = { ...base, ...(patch ?? {}) };

  return {
    ...merged,
    historyFetchLimit: merged.historyFetchLimit ?? null,
    historyFetchedCount: merged.historyFetchedCount ?? null,
    historyMaybeTruncated: merged.historyMaybeTruncated ?? false,
  };
};

describe("AgentChatPanel composer autoresize", () => {
  const models: GatewayModelChoice[] = [{ provider: "openai", id: "gpt-5", name: "gpt-5" }];
  let originalScrollHeightDescriptor: PropertyDescriptor | undefined;

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    if (originalScrollHeightDescriptor) {
      Object.defineProperty(HTMLTextAreaElement.prototype, "scrollHeight", originalScrollHeightDescriptor);
    } else {
      delete (HTMLTextAreaElement.prototype as unknown as { scrollHeight?: unknown }).scrollHeight;
    }
    originalScrollHeightDescriptor = undefined;
  });

  it("resets_textarea_height_after_send_when_draft_is_cleared", async () => {
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0);
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});

    originalScrollHeightDescriptor = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "scrollHeight"
    );
    Object.defineProperty(HTMLTextAreaElement.prototype, "scrollHeight", {
      configurable: true,
      get() {
        return this.value.trim().length > 0 ? 200 : 20;
      },
    });

    const Harness = () => {
      const [agent, setAgent] = useState(
        createAgent({
          draft: "line 1\nline 2\nline 3\nline 4\nline 5\nline 6\nline 7\nline 8",
        })
      );

      return createElement(AgentChatPanel, {
        agent,
        isSelected: true,
        canSend: true,
        models,
        stopBusy: false,
        onLoadMoreHistory: vi.fn(),
        onOpenSettings: vi.fn(),
        onModelChange: vi.fn(),
        onThinkingChange: vi.fn(),
        onDraftChange: (value: string) => {
          setAgent((prev) => ({ ...prev, draft: value }));
        },
        onSend: () => {
          setAgent((prev) => ({ ...prev, draft: "" }));
        },
        onStopRun: vi.fn(),
        onAvatarShuffle: vi.fn(),
      });
    };

    render(createElement(Harness));

    const textarea = screen.getByPlaceholderText("type a message") as HTMLTextAreaElement;

    await waitFor(() => {
      expect(textarea.style.height).toBe("200px");
    });

    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(textarea.value).toBe("");
    });

    expect(textarea.style.height).toBe("20px");
  });
});
