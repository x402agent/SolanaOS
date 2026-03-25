import { describe, expect, it, vi } from "vitest";

import type { AgentState } from "@/features/agents/state/store";
import type { PendingExecApproval } from "@/features/agents/approvals/types";
import { GatewayResponseError } from "@/lib/gateway/errors";
import { resolveExecApprovalViaStudio } from "@/features/agents/approvals/execApprovalResolveOperation";

type SetState<T> = (next: T | ((current: T) => T)) => void;

const createState = <T,>(initial: T): { get: () => T; set: SetState<T> } => {
  let value = initial;
  return {
    get: () => value,
    set: (next) => {
      value = typeof next === "function" ? (next as (current: T) => T)(value) : next;
    },
  };
};

describe("execApprovalResolveOperation", () => {
  it("removes approval and refreshes history after allow-once", async () => {
    const call = vi.fn(async (method: string) => {
      if (method === "exec.approval.resolve") {
        return { ok: true };
      }
      if (method === "agent.wait") {
        return { status: "ok" };
      }
      throw new Error(`unexpected method ${method}`);
    });

    const approval: PendingExecApproval = {
      id: "appr-1",
      agentId: "a1",
      sessionKey: "sess-1",
      command: "echo hi",
      cwd: null,
      host: null,
      security: null,
      ask: null,
      resolvedPath: null,
      createdAtMs: Date.now(),
      expiresAtMs: Date.now() + 60_000,
      resolving: false,
      error: null,
    };

    const agent = {
      agentId: "a1",
      sessionKey: "sess-1",
      sessionCreated: true,
      status: "running",
      runId: "run-1",
    } as unknown as AgentState;

    const approvalsByAgentId = createState<Record<string, PendingExecApproval[]>>({
      a1: [approval],
    });
    const unscopedApprovals = createState<PendingExecApproval[]>([]);
    const requestHistoryRefresh = vi.fn();
    const onAllowResolved = vi.fn();
    const onAllowed = vi.fn();

    await resolveExecApprovalViaStudio({
      client: { call },
      approvalId: "appr-1",
      decision: "allow-once",
      getAgents: () => [agent],
      getLatestAgent: () => agent,
      getPendingState: () => ({
        approvalsByAgentId: approvalsByAgentId.get(),
        unscopedApprovals: unscopedApprovals.get(),
      }),
      setPendingExecApprovalsByAgentId: approvalsByAgentId.set,
      setUnscopedPendingExecApprovals: unscopedApprovals.set,
      requestHistoryRefresh,
      onAllowResolved,
      onAllowed,
      isDisconnectLikeError: () => false,
    });

    expect(call).toHaveBeenCalledWith("exec.approval.resolve", { id: "appr-1", decision: "allow-once" });
    expect(call).toHaveBeenCalledWith("agent.wait", { runId: "run-1", timeoutMs: 15_000 });

    expect(approvalsByAgentId.get()).toEqual({});
    expect(unscopedApprovals.get()).toEqual([]);
    expect(onAllowResolved).toHaveBeenCalledWith({ approval, targetAgentId: "a1" });
    expect(requestHistoryRefresh).toHaveBeenCalledWith("a1");
    expect(onAllowed).toHaveBeenCalledWith({ approval, targetAgentId: "a1" });
    expect(onAllowResolved.mock.invocationCallOrder[0]).toBeLessThan(
      requestHistoryRefresh.mock.invocationCallOrder[0]
    );
  });

  it("treats unknown approval id as already removed", async () => {
    const call = vi.fn(async (method: string) => {
      if (method === "exec.approval.resolve") {
        throw new GatewayResponseError({
          code: "NOT_FOUND",
          message: "unknown approval id appr-1",
        });
      }
      throw new Error(`unexpected method ${method}`);
    });

    const approval: PendingExecApproval = {
      id: "appr-1",
      agentId: "a1",
      sessionKey: "sess-1",
      command: "echo hi",
      cwd: null,
      host: null,
      security: null,
      ask: null,
      resolvedPath: null,
      createdAtMs: Date.now(),
      expiresAtMs: Date.now() + 60_000,
      resolving: false,
      error: null,
    };

    const agent = {
      agentId: "a1",
      sessionKey: "sess-1",
      sessionCreated: true,
      status: "running",
      runId: "run-1",
    } as unknown as AgentState;

    const approvalsByAgentId = createState<Record<string, PendingExecApproval[]>>({
      a1: [approval],
    });
    const unscopedApprovals = createState<PendingExecApproval[]>([]);
    const onAllowed = vi.fn();

    await resolveExecApprovalViaStudio({
      client: { call },
      approvalId: "appr-1",
      decision: "allow-once",
      getAgents: () => [agent],
      getLatestAgent: () => agent,
      getPendingState: () => ({
        approvalsByAgentId: approvalsByAgentId.get(),
        unscopedApprovals: unscopedApprovals.get(),
      }),
      setPendingExecApprovalsByAgentId: approvalsByAgentId.set,
      setUnscopedPendingExecApprovals: unscopedApprovals.set,
      requestHistoryRefresh: vi.fn(),
      onAllowed,
      isDisconnectLikeError: () => false,
    });

    expect(approvalsByAgentId.get()).toEqual({});
    expect(unscopedApprovals.get()).toEqual([]);
    expect(onAllowed).not.toHaveBeenCalled();
  });

  it("does not trigger onAllowed for deny decisions", async () => {
    const call = vi.fn(async (method: string) => {
      if (method === "exec.approval.resolve") {
        return { ok: true };
      }
      throw new Error(`unexpected method ${method}`);
    });

    const approval: PendingExecApproval = {
      id: "appr-1",
      agentId: "a1",
      sessionKey: "sess-1",
      command: "echo hi",
      cwd: null,
      host: null,
      security: null,
      ask: null,
      resolvedPath: null,
      createdAtMs: Date.now(),
      expiresAtMs: Date.now() + 60_000,
      resolving: false,
      error: null,
    };

    const agent = {
      agentId: "a1",
      sessionKey: "sess-1",
      sessionCreated: true,
      status: "running",
      runId: "run-1",
    } as unknown as AgentState;

    const approvalsByAgentId = createState<Record<string, PendingExecApproval[]>>({
      a1: [approval],
    });
    const unscopedApprovals = createState<PendingExecApproval[]>([]);
    const onAllowed = vi.fn();

    await resolveExecApprovalViaStudio({
      client: { call },
      approvalId: "appr-1",
      decision: "deny",
      getAgents: () => [agent],
      getLatestAgent: () => agent,
      getPendingState: () => ({
        approvalsByAgentId: approvalsByAgentId.get(),
        unscopedApprovals: unscopedApprovals.get(),
      }),
      setPendingExecApprovalsByAgentId: approvalsByAgentId.set,
      setUnscopedPendingExecApprovals: unscopedApprovals.set,
      requestHistoryRefresh: vi.fn(),
      onAllowed,
      isDisconnectLikeError: () => false,
    });

    expect(onAllowed).not.toHaveBeenCalled();
  });
});
