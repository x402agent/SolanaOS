import type { PendingExecApproval } from "@/features/agents/approvals/types";

export const upsertPendingApproval = (
  approvals: PendingExecApproval[],
  nextApproval: PendingExecApproval
): PendingExecApproval[] => {
  const index = approvals.findIndex((entry) => entry.id === nextApproval.id);
  if (index < 0) {
    return [nextApproval, ...approvals];
  }
  const next = [...approvals];
  next[index] = nextApproval;
  return next;
};

export const mergePendingApprovalsForFocusedAgent = (params: {
  scopedApprovals: PendingExecApproval[];
  unscopedApprovals: PendingExecApproval[];
}): PendingExecApproval[] => {
  if (params.scopedApprovals.length === 0) return params.unscopedApprovals;
  if (params.unscopedApprovals.length === 0) return params.scopedApprovals;
  const merged = [...params.unscopedApprovals];
  const seen = new Map<string, number>();
  for (let index = 0; index < merged.length; index += 1) {
    seen.set(merged[index]!.id, index);
  }
  for (const approval of params.scopedApprovals) {
    const existingIndex = seen.get(approval.id);
    if (existingIndex === undefined) {
      seen.set(approval.id, merged.length);
      merged.push(approval);
      continue;
    }
    merged[existingIndex] = approval;
  }
  return merged;
};

export const updatePendingApprovalById = (
  approvals: PendingExecApproval[],
  approvalId: string,
  updater: (approval: PendingExecApproval) => PendingExecApproval
): PendingExecApproval[] => {
  let changed = false;
  const next = approvals.map((approval) => {
    if (approval.id !== approvalId) return approval;
    changed = true;
    return updater(approval);
  });
  return changed ? next : approvals;
};

export const removePendingApprovalById = (
  approvals: PendingExecApproval[],
  approvalId: string
): PendingExecApproval[] => approvals.filter((approval) => approval.id !== approvalId);

export const removePendingApprovalEverywhere = (params: {
  approvalsByAgentId: Record<string, PendingExecApproval[]>;
  unscopedApprovals: PendingExecApproval[];
  approvalId: string;
}): {
  approvalsByAgentId: Record<string, PendingExecApproval[]>;
  unscopedApprovals: PendingExecApproval[];
} => {
  const hasScoped = Object.values(params.approvalsByAgentId).some((approvals) =>
    approvals.some((approval) => approval.id === params.approvalId)
  );
  const hasUnscoped = params.unscopedApprovals.some(
    (approval) => approval.id === params.approvalId
  );
  if (!hasScoped && !hasUnscoped) {
    return {
      approvalsByAgentId: params.approvalsByAgentId,
      unscopedApprovals: params.unscopedApprovals,
    };
  }
  return {
    approvalsByAgentId: hasScoped
      ? removePendingApprovalByIdMap(params.approvalsByAgentId, params.approvalId)
      : params.approvalsByAgentId,
    unscopedApprovals: hasUnscoped
      ? removePendingApprovalById(params.unscopedApprovals, params.approvalId)
      : params.unscopedApprovals,
  };
};

export const removePendingApprovalByIdMap = (
  approvalsByAgentId: Record<string, PendingExecApproval[]>,
  approvalId: string
): Record<string, PendingExecApproval[]> => {
  let changed = false;
  const next: Record<string, PendingExecApproval[]> = {};
  for (const [agentId, approvals] of Object.entries(approvalsByAgentId)) {
    const filtered = removePendingApprovalById(approvals, approvalId);
    if (filtered.length !== approvals.length) {
      changed = true;
    }
    if (filtered.length > 0) {
      next[agentId] = filtered;
    }
  }
  return changed ? next : approvalsByAgentId;
};

export const pruneExpiredPendingApprovals = (
  approvals: PendingExecApproval[],
  params: { nowMs: number; graceMs: number }
): PendingExecApproval[] => {
  const cutoff = params.nowMs - params.graceMs;
  return approvals.filter((approval) => approval.expiresAtMs >= cutoff);
};

export const pruneExpiredPendingApprovalsMap = (
  approvalsByAgentId: Record<string, PendingExecApproval[]>,
  params: { nowMs: number; graceMs: number }
): Record<string, PendingExecApproval[]> => {
  let changed = false;
  const next: Record<string, PendingExecApproval[]> = {};
  for (const [agentId, approvals] of Object.entries(approvalsByAgentId)) {
    const filtered = pruneExpiredPendingApprovals(approvals, params);
    if (filtered.length !== approvals.length) {
      changed = true;
    }
    if (filtered.length > 0) {
      next[agentId] = filtered;
    }
  }
  return changed ? next : approvalsByAgentId;
};

export const nextPendingApprovalPruneDelayMs = (params: {
  approvalsByAgentId: Record<string, PendingExecApproval[]>;
  unscopedApprovals: PendingExecApproval[];
  nowMs: number;
  graceMs: number;
}): number | null => {
  let earliestExpiresMs = Number.POSITIVE_INFINITY;
  for (const approvals of Object.values(params.approvalsByAgentId)) {
    for (const approval of approvals) {
      if (approval.expiresAtMs < earliestExpiresMs) {
        earliestExpiresMs = approval.expiresAtMs;
      }
    }
  }
  for (const approval of params.unscopedApprovals) {
    if (approval.expiresAtMs < earliestExpiresMs) {
      earliestExpiresMs = approval.expiresAtMs;
    }
  }
  if (!Number.isFinite(earliestExpiresMs)) {
    return null;
  }
  return Math.max(0, earliestExpiresMs + params.graceMs - params.nowMs);
};
