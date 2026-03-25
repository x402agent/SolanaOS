import { describe, expect, it, vi } from "vitest";

import type { AgentCreateModalSubmitPayload } from "@/features/agents/creation/types";
import type { CreateAgentMutationLifecycleDeps } from "@/features/agents/operations/mutationLifecycleWorkflow";
import {
  isCreateBlockTimedOut,
  runCreateAgentMutationLifecycle,
} from "@/features/agents/operations/mutationLifecycleWorkflow";

const createPayload = (
  overrides: Partial<AgentCreateModalSubmitPayload> = {}
): AgentCreateModalSubmitPayload => ({
  name: "Agent One",
  avatarSeed: "seed-1",
  ...overrides,
});

const createDeps = (
  overrides: Partial<CreateAgentMutationLifecycleDeps> = {}
): CreateAgentMutationLifecycleDeps => ({
  enqueueConfigMutation: async ({ run }) => {
    await run();
  },
  createAgent: async () => ({ id: "agent-1" }),
  setQueuedBlock: () => undefined,
  setCreatingBlock: () => undefined,
  onCompletion: async () => undefined,
  setCreateAgentModalError: () => undefined,
  setCreateAgentBusy: () => undefined,
  clearCreateBlock: () => undefined,
  onError: () => undefined,
  ...overrides,
});

describe("mutationLifecycleWorkflow create lifecycle", () => {
  it("blocks create and sets modal error when disconnected", async () => {
    const setCreateAgentModalError = vi.fn();
    const enqueueConfigMutation = vi.fn(async () => undefined);

    const result = await runCreateAgentMutationLifecycle(
      {
        payload: createPayload(),
        status: "disconnected",
        hasCreateBlock: false,
        hasRenameBlock: false,
        hasDeleteBlock: false,
        createAgentBusy: false,
      },
      createDeps({
        setCreateAgentModalError,
        enqueueConfigMutation,
      })
    );

    expect(result).toBe(false);
    expect(setCreateAgentModalError).toHaveBeenCalledWith("Connect to gateway before creating an agent.");
    expect(enqueueConfigMutation).not.toHaveBeenCalled();
  });

  it("fails fast when the submitted name is empty", async () => {
    const setCreateAgentModalError = vi.fn();
    const enqueueConfigMutation = vi.fn(async () => undefined);

    const result = await runCreateAgentMutationLifecycle(
      {
        payload: createPayload({ name: "   " }),
        status: "connected",
        hasCreateBlock: false,
        hasRenameBlock: false,
        hasDeleteBlock: false,
        createAgentBusy: false,
      },
      createDeps({
        setCreateAgentModalError,
        enqueueConfigMutation,
      })
    );

    expect(result).toBe(false);
    expect(setCreateAgentModalError).toHaveBeenCalledWith("Agent name is required.");
    expect(enqueueConfigMutation).not.toHaveBeenCalled();
  });

  it("runs create-only lifecycle and completion callback", async () => {
    const order: string[] = [];
    const onCompletion = vi.fn(async (completion: { agentId: string; agentName: string }) => {
      order.push(`completion:${completion.agentId}:${completion.agentName}`);
    });

    const result = await runCreateAgentMutationLifecycle(
      {
        payload: createPayload(),
        status: "connected",
        hasCreateBlock: false,
        hasRenameBlock: false,
        hasDeleteBlock: false,
        createAgentBusy: false,
      },
      createDeps({
        setCreateAgentBusy: (busy) => {
          order.push(`busy:${busy ? "on" : "off"}`);
        },
        setCreateAgentModalError: (message) => {
          order.push(`modalError:${message === null ? "clear" : "set"}`);
        },
        setQueuedBlock: () => {
          order.push("queued");
        },
        enqueueConfigMutation: async ({ run }) => {
          order.push("enqueue");
          await run();
        },
        setCreatingBlock: () => {
          order.push("creating");
        },
        createAgent: async () => {
          order.push("createAgent");
          return { id: "agent-1" };
        },
        onCompletion,
      })
    );

    expect(result).toBe(true);
    expect(order).toEqual([
      "busy:on",
      "modalError:clear",
      "queued",
      "enqueue",
      "creating",
      "createAgent",
      "completion:agent-1:Agent One",
      "busy:off",
    ]);
    expect(onCompletion).toHaveBeenCalledTimes(1);
  });

  it("surfaces create errors and clears create block", async () => {
    const clearCreateBlock = vi.fn();
    const setCreateAgentModalError = vi.fn();
    const onError = vi.fn();

    const result = await runCreateAgentMutationLifecycle(
      {
        payload: createPayload(),
        status: "connected",
        hasCreateBlock: false,
        hasRenameBlock: false,
        hasDeleteBlock: false,
        createAgentBusy: false,
      },
      createDeps({
        createAgent: async () => {
          throw new Error("create exploded");
        },
        clearCreateBlock,
        setCreateAgentModalError,
        onError,
      })
    );

    expect(result).toBe(false);
    expect(clearCreateBlock).toHaveBeenCalledTimes(1);
    expect(setCreateAgentModalError).toHaveBeenCalledWith("create exploded");
    expect(onError).toHaveBeenCalledWith("create exploded");
  });

  it("maps create block timeout through shared mutation timeout policy", () => {
    expect(
      isCreateBlockTimedOut({
        block: null,
        nowMs: 100_000,
        maxWaitMs: 90_000,
      })
    ).toBe(false);

    expect(
      isCreateBlockTimedOut({
        block: {
          agentName: "Agent One",
          phase: "queued",
          startedAt: 0,
        },
        nowMs: 100_000,
        maxWaitMs: 90_000,
      })
    ).toBe(false);

    expect(
      isCreateBlockTimedOut({
        block: {
          agentName: "Agent One",
          phase: "creating",
          startedAt: 0,
        },
        nowMs: 100_000,
        maxWaitMs: 90_000,
      })
    ).toBe(true);
  });
});
