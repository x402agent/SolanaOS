import { describe, expect, it } from "vitest";

import type { AgentState } from "@/features/agents/state/store";
import { buildOfficeDeskMonitor } from "@/lib/office/deskMonitor";

const createAgent = (overrides?: Partial<AgentState>): AgentState => ({
  agentId: "agent-1",
  name: "Agent One",
  sessionKey: "agent:agent-1:main",
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
  queuedMessages: [],
  sessionSettingsSynced: true,
  historyLoadedAt: null,
  historyFetchLimit: null,
  historyFetchedCount: null,
  historyMaybeTruncated: false,
  toolCallingEnabled: true,
  showThinkingTraces: true,
  transcriptEntries: [],
  transcriptRevision: 0,
  transcriptSequenceCounter: 0,
  sessionEpoch: 0,
  lastHistoryRequestRevision: null,
  lastAppliedHistoryRequestId: null,
  model: "openai/gpt-5",
  thinkingLevel: "medium",
  avatarSeed: null,
  avatarUrl: null,
  ...(overrides ?? {}),
});

describe("buildOfficeDeskMonitor", () => {
  it("builds a live coding monitor from runtime state", () => {
    const monitor = buildOfficeDeskMonitor(
      createAgent({
        status: "running",
        outputLines: ["> implement a desk monitor."],
        streamText: "Updating the office scene right now.",
        thinkingTrace: "Scanning camera controls.",
        latestPreview: "Updating the office scene.",
        lastActivityAt: 1_000,
      }),
    );

    expect(monitor.mode).toBe("coding");
    expect(monitor.live).toBe(true);
    expect(monitor.entries.some((entry) => entry.kind === "user")).toBe(true);
    expect(
      monitor.entries.some(
        (entry) =>
          entry.kind === "assistant" &&
          entry.text.includes("Updating the office scene"),
      ),
    ).toBe(true);
  });

  it("detects browser activity and extracts the current url", () => {
    const monitor = buildOfficeDeskMonitor(
      createAgent({
        status: "running",
        outputLines: [
          "[[tool]] browser.navigate\nurl: https://example.com/dashboard",
          "[[tool-result]] browser.navigate\nNavigation complete.",
        ],
        latestPreview: "Browsing example.com.",
        lastActivityAt: 2_000,
      }),
    );

    expect(monitor.mode).toBe("browser");
    expect(monitor.browserUrl).toBe("https://example.com/dashboard");
    expect(monitor.subtitle).toContain("example.com");
  });

  it("builds a fake editor document for coding mode", () => {
    const monitor = buildOfficeDeskMonitor(
      createAgent({
        status: "running",
        lastUserMessage: "Create a contact form page",
        outputLines: ["> Create a contact form page"],
        latestPreview: "Building the contact form page.",
      }),
    );

    expect(monitor.mode).toBe("coding");
    expect(monitor.editor?.fileName).toBe("ContactForm.tsx");
    expect(
      monitor.editor?.lines.some((line) => line.includes("Contact us")),
    ).toBe(true);
  });

  it("uses waiting mode when the agent needs user input", () => {
    const monitor = buildOfficeDeskMonitor(
      createAgent({
        awaitingUserInput: true,
        latestPreview: "Please choose the next step.",
      }),
    );

    expect(monitor.mode).toBe("waiting");
    expect(monitor.title).toBe("Waiting");
  });
});
