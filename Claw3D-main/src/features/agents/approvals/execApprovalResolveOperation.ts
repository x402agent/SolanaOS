import type { AgentState } from "@/features/agents/state/store";
import type { ExecApprovalDecision, PendingExecApproval } from "@/features/agents/approvals/types";
import {
  removePendingApprovalEverywhere,
  updatePendingApprovalById,
} from "@/features/agents/approvals/pendingStore";
import { shouldTreatExecApprovalResolveErrorAsUnknownId } from "@/features/agents/approvals/execApprovalLifecycleWorkflow";

type GatewayClientLike = {
  call: (method: string, params: unknown) => Promise<unknown>;
};

type SetState<T> = (next: T | ((current: T) => T)) => void;

export const resolveExecApprovalViaStudio = async (params: {
  client: GatewayClientLike;
  approvalId: string;
  decision: ExecApprovalDecision;
  getAgents: () => AgentState[];
  getLatestAgent: (agentId: string) => AgentState | null;
  getPendingState: () => {
    approvalsByAgentId: Record<string, PendingExecApproval[]>;
    unscopedApprovals: PendingExecApproval[];
  };
  setPendingExecApprovalsByAgentId: SetState<Record<string, PendingExecApproval[]>>;
  setUnscopedPendingExecApprovals: SetState<PendingExecApproval[]>;
  requestHistoryRefresh: (agentId: string) => Promise<void> | void;
  onAllowResolved?: (params: {
    approval: PendingExecApproval;
    targetAgentId: string;
  }) => Promise<void> | void;
  onAllowed?: (params: { approval: PendingExecApproval; targetAgentId: string }) => Promise<void> | void;
  isDisconnectLikeError: (error: unknown) => boolean;
  shouldTreatUnknownId?: (error: unknown) => boolean;
  logWarn?: (message: string, error: unknown) => void;
}): Promise<void> => {
  const id = params.approvalId.trim();
  if (!id) return;

  const resolvePendingApproval = (
    approvalId: string,
    state: {
      approvalsByAgentId: Record<string, PendingExecApproval[]>;
      unscopedApprovals: PendingExecApproval[];
    }
  ): PendingExecApproval | null => {
    for (const approvals of Object.values(state.approvalsByAgentId)) {
      const found = approvals.find((approval) => approval.id === approvalId);
      if (found) return found;
    }
    return state.unscopedApprovals.find((approval) => approval.id === approvalId) ?? null;
  };

  const resolveApprovalTargetAgentId = (approval: PendingExecApproval | null): string | null => {
    if (!approval) return null;
    const scopedAgentId = approval.agentId?.trim() ?? "";
    if (scopedAgentId) return scopedAgentId;
    const scopedSessionKey = approval.sessionKey?.trim() ?? "";
    if (!scopedSessionKey) return null;
    const matched = params
      .getAgents()
      .find((agent) => agent.sessionKey.trim() === scopedSessionKey);
    return matched?.agentId ?? null;
  };

  const snapshot = params.getPendingState();
  const approval = resolvePendingApproval(id, snapshot);

  const removeLocalApproval = (approvalId: string) => {
    params.setPendingExecApprovalsByAgentId((current) => {
      return removePendingApprovalEverywhere({
        approvalsByAgentId: current,
        unscopedApprovals: [],
        approvalId,
      }).approvalsByAgentId;
    });
    params.setUnscopedPendingExecApprovals((current) => {
      return removePendingApprovalEverywhere({
        approvalsByAgentId: {},
        unscopedApprovals: current,
        approvalId,
      }).unscopedApprovals;
    });
  };

  const setLocalApprovalState = (resolving: boolean, error: string | null) => {
    params.setPendingExecApprovalsByAgentId((current) => {
      let changed = false;
      const next: Record<string, PendingExecApproval[]> = {};
      for (const [agentId, approvals] of Object.entries(current)) {
        const updated = updatePendingApprovalById(approvals, id, (approval) => ({
          ...approval,
          resolving,
          error,
        }));
        if (updated !== approvals) {
          changed = true;
        }
        if (updated.length > 0) {
          next[agentId] = updated;
        }
      }
      return changed ? next : current;
    });
    params.setUnscopedPendingExecApprovals((current) =>
      updatePendingApprovalById(current, id, (approval) => ({
        ...approval,
        resolving,
        error,
      }))
    );
  };

  setLocalApprovalState(true, null);

  try {
    await params.client.call("exec.approval.resolve", { id, decision: params.decision });
    removeLocalApproval(id);

    if (params.decision !== "allow-once" && params.decision !== "allow-always") {
      return;
    }

    if (!approval) return;
    const targetAgentId = resolveApprovalTargetAgentId(approval);
    if (!targetAgentId) return;
    await params.onAllowResolved?.({ approval, targetAgentId });

    const latest = params.getLatestAgent(targetAgentId);
    const activeRunId = latest?.runId?.trim() ?? "";
    if (activeRunId) {
      try {
        await params.client.call("agent.wait", { runId: activeRunId, timeoutMs: 15_000 });
      } catch (waitError) {
        if (!params.isDisconnectLikeError(waitError)) {
          (params.logWarn ?? ((message, error) => console.warn(message, error)))(
            "Failed to wait for run after exec approval resolve.",
            waitError
          );
        }
      }
    }

    await params.requestHistoryRefresh(targetAgentId);
    await params.onAllowed?.({ approval, targetAgentId });
  } catch (err) {
    const shouldTreatUnknownId = params.shouldTreatUnknownId ?? shouldTreatExecApprovalResolveErrorAsUnknownId;
    if (shouldTreatUnknownId(err)) {
      removeLocalApproval(id);
      return;
    }
    const message = err instanceof Error ? err.message : "Failed to resolve exec approval.";
    setLocalApprovalState(false, message);
  }
};
