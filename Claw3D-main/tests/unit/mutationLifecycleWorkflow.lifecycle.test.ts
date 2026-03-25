import { describe, expect, it, vi } from "vitest";

import { runAgentConfigMutationLifecycle } from "@/features/agents/operations/mutationLifecycleWorkflow";

describe("mutationLifecycleWorkflow lifecycle runner", () => {
  it("runs completed rename lifecycle commands in order", async () => {
    const order: string[] = [];
    const enqueueConfigMutation = vi.fn(async ({ run }: { run: () => Promise<void> }) => {
      order.push("enqueue");
      await run();
    });
    const setQueuedBlock = vi.fn(() => {
      order.push("queued");
    });
    const setMutatingBlock = vi.fn(() => {
      order.push("mutating");
    });
    const executeMutation = vi.fn(async () => {
      order.push("execute");
    });
    const shouldAwaitRemoteRestart = vi.fn(async () => {
      order.push("await-check");
      return false;
    });
    const reloadAgents = vi.fn(async () => {
      order.push("reload");
    });
    const clearBlock = vi.fn(() => {
      order.push("clear");
    });
    const setMobilePaneChat = vi.fn(() => {
      order.push("pane");
    });
    const patchBlockAwaitingRestart = vi.fn(() => {
      order.push("patch");
    });
    const onError = vi.fn();

    const result = await runAgentConfigMutationLifecycle({
      kind: "rename-agent",
      label: "Rename Agent One",
      isLocalGateway: false,
      deps: {
        enqueueConfigMutation,
        setQueuedBlock,
        setMutatingBlock,
        patchBlockAwaitingRestart,
        clearBlock,
        executeMutation,
        shouldAwaitRemoteRestart,
        reloadAgents,
        setMobilePaneChat,
        onError,
      },
    });

    expect(result).toBe(true);
    expect(order).toEqual([
      "queued",
      "enqueue",
      "mutating",
      "execute",
      "await-check",
      "reload",
      "clear",
      "pane",
    ]);
    expect(patchBlockAwaitingRestart).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(enqueueConfigMutation).toHaveBeenCalledWith({
      kind: "rename-agent",
      label: "Rename Agent One",
      run: expect.any(Function),
    });
  });

  it("applies awaiting-restart patch for remote delete", async () => {
    const clearBlock = vi.fn();
    const patchBlockAwaitingRestart = vi.fn();

    const result = await runAgentConfigMutationLifecycle({
      kind: "delete-agent",
      label: "Delete Agent One",
      isLocalGateway: false,
      deps: {
        enqueueConfigMutation: async ({ run }) => {
          await run();
        },
        setQueuedBlock: () => undefined,
        setMutatingBlock: () => undefined,
        patchBlockAwaitingRestart,
        clearBlock,
        executeMutation: async () => undefined,
        shouldAwaitRemoteRestart: async () => true,
        reloadAgents: async () => undefined,
        setMobilePaneChat: () => undefined,
        onError: () => undefined,
      },
    });

    expect(result).toBe(true);
    expect(patchBlockAwaitingRestart).toHaveBeenCalledWith({
      phase: "awaiting-restart",
      sawDisconnect: false,
    });
    expect(clearBlock).not.toHaveBeenCalled();
  });

  it("does not call restart-check on local gateway", async () => {
    const shouldAwaitRemoteRestart = vi.fn(async () => true);

    const result = await runAgentConfigMutationLifecycle({
      kind: "rename-agent",
      label: "Rename Agent One",
      isLocalGateway: true,
      deps: {
        enqueueConfigMutation: async ({ run }) => {
          await run();
        },
        setQueuedBlock: () => undefined,
        setMutatingBlock: () => undefined,
        patchBlockAwaitingRestart: () => undefined,
        clearBlock: () => undefined,
        executeMutation: async () => undefined,
        shouldAwaitRemoteRestart,
        reloadAgents: async () => undefined,
        setMobilePaneChat: () => undefined,
        onError: () => undefined,
      },
    });

    expect(result).toBe(true);
    expect(shouldAwaitRemoteRestart).not.toHaveBeenCalled();
  });

  it("clears block and reports mapped error on mutation failure", async () => {
    const clearBlock = vi.fn();
    const onError = vi.fn();

    const result = await runAgentConfigMutationLifecycle({
      kind: "rename-agent",
      label: "Rename Agent One",
      isLocalGateway: false,
      deps: {
        enqueueConfigMutation: async ({ run }) => {
          await run();
        },
        setQueuedBlock: () => undefined,
        setMutatingBlock: () => undefined,
        patchBlockAwaitingRestart: () => undefined,
        clearBlock,
        executeMutation: async () => {
          throw new Error("rename exploded");
        },
        shouldAwaitRemoteRestart: async () => false,
        reloadAgents: async () => undefined,
        setMobilePaneChat: () => undefined,
        onError,
      },
    });

    expect(result).toBe(false);
    expect(clearBlock).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith("rename exploded");
  });
});
