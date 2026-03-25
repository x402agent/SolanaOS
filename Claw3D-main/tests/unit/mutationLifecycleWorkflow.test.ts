import { describe, expect, it, vi } from "vitest";
import {
  buildConfigMutationFailureMessage,
  buildMutationSideEffectCommands,
  buildMutatingMutationBlock,
  buildQueuedMutationBlock,
  resolveMutationPostRunIntent,
  resolveMutationStartGuard,
  resolveMutationTimeoutIntent,
  runConfigMutationWorkflow,
  type MutationWorkflowKind,
} from "@/features/agents/operations/mutationLifecycleWorkflow";

describe("mutationLifecycleWorkflow", () => {
  it("returns completed for local gateway mutations without restart wait", async () => {
    const executeMutation = vi.fn(async () => undefined);
    const shouldAwaitRemoteRestart = vi.fn(async () => true);

    const result = await runConfigMutationWorkflow(
      { kind: "delete-agent", isLocalGateway: true },
      { executeMutation, shouldAwaitRemoteRestart }
    );

    expect(result).toEqual({ disposition: "completed" });
    expect(executeMutation).toHaveBeenCalledTimes(1);
    expect(shouldAwaitRemoteRestart).not.toHaveBeenCalled();
  });

  it("returns completed for remote mutation when restart wait is not required", async () => {
    const executeMutation = vi.fn(async () => undefined);
    const shouldAwaitRemoteRestart = vi.fn(async () => false);

    const result = await runConfigMutationWorkflow(
      { kind: "rename-agent", isLocalGateway: false },
      { executeMutation, shouldAwaitRemoteRestart }
    );

    expect(result).toEqual({ disposition: "completed" });
    expect(executeMutation).toHaveBeenCalledTimes(1);
    expect(shouldAwaitRemoteRestart).toHaveBeenCalledTimes(1);
  });

  it("returns awaiting-restart for remote mutation when restart wait is required", async () => {
    const executeMutation = vi.fn(async () => undefined);
    const shouldAwaitRemoteRestart = vi.fn(async () => true);

    const result = await runConfigMutationWorkflow(
      { kind: "delete-agent", isLocalGateway: false },
      { executeMutation, shouldAwaitRemoteRestart }
    );

    expect(result).toEqual({ disposition: "awaiting-restart" });
    expect(executeMutation).toHaveBeenCalledTimes(1);
    expect(shouldAwaitRemoteRestart).toHaveBeenCalledTimes(1);
  });

  it("maps mutation failures to user-facing errors", () => {
    const fallbackByKind: Record<MutationWorkflowKind, string> = {
      "rename-agent": "Failed to rename agent.",
      "delete-agent": "Failed to delete agent.",
    };
    for (const [kind, fallback] of Object.entries(fallbackByKind) as Array<
      [MutationWorkflowKind, string]
    >) {
      expect(buildConfigMutationFailureMessage({ kind, error: new Error("boom") })).toBe("boom");
      expect(buildConfigMutationFailureMessage({ kind, error: 123 })).toBe(fallback);
    }
  });

  it("rejects invalid mutation input before side effects", async () => {
    const executeMutation = vi.fn(async () => undefined);
    const shouldAwaitRemoteRestart = vi.fn(async () => true);

    await expect(
      runConfigMutationWorkflow(
        // @ts-expect-error intentional invalid kind check
        { kind: "unknown-kind", isLocalGateway: false },
        { executeMutation, shouldAwaitRemoteRestart }
      )
    ).rejects.toThrow("Unknown config mutation kind: unknown-kind");

    expect(executeMutation).not.toHaveBeenCalled();
    expect(shouldAwaitRemoteRestart).not.toHaveBeenCalled();
  });

  it("blocks mutation starts when another mutation block is active", () => {
    expect(
      resolveMutationStartGuard({
        status: "disconnected",
        hasCreateBlock: false,
        hasRenameBlock: false,
        hasDeleteBlock: false,
      })
    ).toEqual({ kind: "deny", reason: "not-connected" });

    expect(
      resolveMutationStartGuard({
        status: "connected",
        hasCreateBlock: true,
        hasRenameBlock: false,
        hasDeleteBlock: false,
      })
    ).toEqual({ kind: "deny", reason: "create-block-active" });

    expect(
      resolveMutationStartGuard({
        status: "connected",
        hasCreateBlock: false,
        hasRenameBlock: true,
        hasDeleteBlock: false,
      })
    ).toEqual({ kind: "deny", reason: "rename-block-active" });

    expect(
      resolveMutationStartGuard({
        status: "connected",
        hasCreateBlock: false,
        hasRenameBlock: false,
        hasDeleteBlock: true,
      })
    ).toEqual({ kind: "deny", reason: "delete-block-active" });

    expect(
      resolveMutationStartGuard({
        status: "connected",
        hasCreateBlock: false,
        hasRenameBlock: false,
        hasDeleteBlock: false,
      })
    ).toEqual({ kind: "allow" });
  });

  it("builds deterministic queued and mutating block transitions", () => {
    const queued = buildQueuedMutationBlock({
      kind: "rename-agent",
      agentId: "agent-1",
      agentName: "Agent One",
      startedAt: 123,
    });

    expect(queued).toEqual({
      kind: "rename-agent",
      agentId: "agent-1",
      agentName: "Agent One",
      phase: "queued",
      startedAt: 123,
      sawDisconnect: false,
    });

    expect(buildMutatingMutationBlock(queued)).toEqual({
      ...queued,
      phase: "mutating",
    });
  });

  it("resolves post-mutation block outcomes for completed vs awaiting-restart", () => {
    expect(resolveMutationPostRunIntent({ disposition: "completed" })).toEqual({
      kind: "clear",
    });

    expect(resolveMutationPostRunIntent({ disposition: "awaiting-restart" })).toEqual({
      kind: "awaiting-restart",
      patch: {
        phase: "awaiting-restart",
        sawDisconnect: false,
      },
    });
  });

  it("builds typed side-effect commands for completed and awaiting-restart dispositions", () => {
    expect(buildMutationSideEffectCommands({ disposition: "completed" })).toEqual([
      { kind: "reload-agents" },
      { kind: "clear-mutation-block" },
      { kind: "set-mobile-pane", pane: "chat" },
    ]);

    expect(buildMutationSideEffectCommands({ disposition: "awaiting-restart" })).toEqual([
      {
        kind: "patch-mutation-block",
        patch: { phase: "awaiting-restart", sawDisconnect: false },
      },
    ]);
  });

  it("returns timeout intent when mutation block exceeds max wait", () => {
    expect(
      resolveMutationTimeoutIntent({
        block: null,
        nowMs: 10_000,
        maxWaitMs: 90_000,
      })
    ).toEqual({ kind: "none" });

    const createBlock = buildQueuedMutationBlock({
      kind: "create-agent",
      agentId: "agent-1",
      agentName: "A",
      startedAt: 1_000,
    });
    const renameBlock = buildQueuedMutationBlock({
      kind: "rename-agent",
      agentId: "agent-1",
      agentName: "A",
      startedAt: 1_000,
    });
    const deleteBlock = buildQueuedMutationBlock({
      kind: "delete-agent",
      agentId: "agent-1",
      agentName: "A",
      startedAt: 1_000,
    });

    expect(
      resolveMutationTimeoutIntent({
        block: createBlock,
        nowMs: 91_000,
        maxWaitMs: 90_000,
      })
    ).toEqual({ kind: "timeout", reason: "create-timeout" });

    expect(
      resolveMutationTimeoutIntent({
        block: renameBlock,
        nowMs: 91_000,
        maxWaitMs: 90_000,
      })
    ).toEqual({ kind: "timeout", reason: "rename-timeout" });

    expect(
      resolveMutationTimeoutIntent({
        block: deleteBlock,
        nowMs: 91_000,
        maxWaitMs: 90_000,
      })
    ).toEqual({ kind: "timeout", reason: "delete-timeout" });

    expect(
      resolveMutationTimeoutIntent({
        block: createBlock,
        nowMs: 50_000,
        maxWaitMs: 90_000,
      })
    ).toEqual({ kind: "none" });
  });
});
