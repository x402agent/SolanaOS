import { describe, expect, it, vi } from "vitest";

import { applySessionSettingMutation } from "@/features/agents/state/sessionSettingsMutations";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { GatewayResponseError } from "@/lib/gateway/errors";

const createWebchatBlockedPatchError = () =>
  new GatewayResponseError({
    code: "INVALID_REQUEST",
    message: "webchat clients cannot patch sessions; use chat.send for session-scoped updates",
  });

describe("session settings mutations helper", () => {
  it("applies optimistic update before remote sync", async () => {
    const dispatch = vi.fn();
    const client = {
      call: vi.fn(async () => ({ ok: true })),
    } as unknown as GatewayClient;

    await applySessionSettingMutation({
      agents: [{ agentId: "agent-1", sessionCreated: true }],
      dispatch,
      client,
      agentId: "agent-1",
      sessionKey: "agent:1:studio:abc",
      field: "model",
      value: "openai/gpt-5",
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "updateAgent",
      agentId: "agent-1",
      patch: { model: "openai/gpt-5", sessionSettingsSynced: false },
    });
  });

  it("syncs even when session has not been created", async () => {
    const dispatch = vi.fn();
    const client = {
      call: vi.fn(async () => ({ ok: true })),
    } as unknown as GatewayClient;

    await applySessionSettingMutation({
      agents: [{ agentId: "agent-1", sessionCreated: false }],
      dispatch,
      client,
      agentId: "agent-1",
      sessionKey: "agent:1:studio:abc",
      field: "model",
      value: "openai/gpt-5",
    });

    expect(client.call).toHaveBeenCalledWith("sessions.patch", {
      key: "agent:1:studio:abc",
      model: "openai/gpt-5",
    });
  });

  it("marks session settings synced after successful remote sync", async () => {
    const dispatch = vi.fn();
    const client = {
      call: vi.fn(async () => ({ ok: true })),
    } as unknown as GatewayClient;

    await applySessionSettingMutation({
      agents: [{ agentId: "agent-1", sessionCreated: true }],
      dispatch,
      client,
      agentId: "agent-1",
      sessionKey: "agent:1:studio:abc",
      field: "thinkingLevel",
      value: "medium",
    });

    expect(client.call).toHaveBeenCalledWith("sessions.patch", {
      key: "agent:1:studio:abc",
      thinkingLevel: "medium",
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "updateAgent",
      agentId: "agent-1",
      patch: { sessionSettingsSynced: true, sessionCreated: true },
    });
  });

  it("reconciles model to the resolved gateway model when clearing override", async () => {
    const dispatch = vi.fn();
    const client = {
      call: vi.fn(async () => ({
        ok: true,
        key: "agent:1:studio:abc",
        resolved: { modelProvider: "openai", model: "gpt-5-mini" },
      })),
    } as unknown as GatewayClient;

    await applySessionSettingMutation({
      agents: [{ agentId: "agent-1", sessionCreated: true }],
      dispatch,
      client,
      agentId: "agent-1",
      sessionKey: "agent:1:studio:abc",
      field: "model",
      value: null,
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "updateAgent",
      agentId: "agent-1",
      patch: { model: "openai/gpt-5-mini", sessionSettingsSynced: true, sessionCreated: true },
    });
  });

  it("appends actionable error output when sync fails", async () => {
    const dispatch = vi.fn();
    const client = {
      call: vi.fn(async () => {
        throw new Error("network timeout");
      }),
    } as unknown as GatewayClient;

    await applySessionSettingMutation({
      agents: [{ agentId: "agent-1", sessionCreated: true }],
      dispatch,
      client,
      agentId: "agent-1",
      sessionKey: "agent:1:studio:abc",
      field: "model",
      value: "openai/gpt-5",
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "appendOutput",
      agentId: "agent-1",
      line: "Model update failed: network timeout",
    });
  });

  it("restores sync state and appends capability notice when webchat patch is blocked", async () => {
    const dispatch = vi.fn();
    const client = {
      call: vi.fn(async () => {
        throw createWebchatBlockedPatchError();
      }),
    } as unknown as GatewayClient;

    await applySessionSettingMutation({
      agents: [{ agentId: "agent-1", sessionCreated: true, model: "openai/gpt-5-mini" }],
      dispatch,
      client,
      agentId: "agent-1",
      sessionKey: "agent:1:studio:abc",
      field: "model",
      value: "openai/gpt-5",
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "updateAgent",
      agentId: "agent-1",
      patch: {
        model: "openai/gpt-5-mini",
        sessionSettingsSynced: true,
        sessionCreated: true,
      },
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "appendOutput",
      agentId: "agent-1",
      line:
        "Model update not applied: this gateway blocks sessions.patch for WebChat clients; message sending still works.",
    });

    const failureLines = dispatch.mock.calls
      .map((entry) => entry[0])
      .filter(
        (
          action
        ): action is {
          type: "appendOutput";
          line: string;
        } =>
          action &&
          typeof action === "object" &&
          "type" in action &&
          action.type === "appendOutput" &&
          "line" in action &&
          typeof action.line === "string" &&
          action.line.startsWith("Model update failed:")
      );
    expect(failureLines).toHaveLength(0);
  });
});
