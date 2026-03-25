import { describe, expect, it } from "vitest";
import type { PendingExecApproval } from "@/features/agents/approvals/types";
import {
  mergePendingApprovalsForFocusedAgent,
  removePendingApprovalEverywhere,
  nextPendingApprovalPruneDelayMs,
  pruneExpiredPendingApprovals,
  pruneExpiredPendingApprovalsMap,
  removePendingApprovalById,
  removePendingApprovalByIdMap,
  upsertPendingApproval,
  updatePendingApprovalById,
} from "@/features/agents/approvals/pendingStore";

const createApproval = (id: string, expiresAtMs: number): PendingExecApproval => ({
  id,
  agentId: "agent-1",
  sessionKey: "agent:agent-1:main",
  command: "pwd",
  cwd: "/repo",
  host: "gateway",
  security: "allowlist",
  ask: "always",
  resolvedPath: "/bin/pwd",
  createdAtMs: expiresAtMs - 1000,
  expiresAtMs,
  resolving: false,
  error: null,
});

describe("pending approval store", () => {
  it("removes an approval id from scoped and unscoped collections", () => {
    const approvalA = createApproval("a", 10_000);
    const approvalB = createApproval("b", 20_000);
    const approvalC = createApproval("c", 30_000);
    const scoped = {
      "agent-1": [approvalA, approvalB],
      "agent-2": [approvalC],
    };
    const unscoped = [approvalB, approvalC];

    const removed = removePendingApprovalEverywhere({
      approvalsByAgentId: scoped,
      unscopedApprovals: unscoped,
      approvalId: "b",
    });

    expect(removed.approvalsByAgentId).toEqual({
      "agent-1": [approvalA],
      "agent-2": [approvalC],
    });
    expect(removed.unscopedApprovals).toEqual([approvalC]);
  });

  it("is idempotent when approval id is missing", () => {
    const scoped = {
      "agent-1": [createApproval("a", 10_000)],
    };
    const unscoped = [createApproval("b", 20_000)];

    const removed = removePendingApprovalEverywhere({
      approvalsByAgentId: scoped,
      unscopedApprovals: unscoped,
      approvalId: "missing",
    });

    expect(removed.approvalsByAgentId).toBe(scoped);
    expect(removed.unscopedApprovals).toBe(unscoped);
  });

  it("drops empty scoped buckets after removal", () => {
    const scoped = {
      "agent-1": [createApproval("a", 10_000)],
      "agent-2": [createApproval("b", 20_000)],
    };

    const removed = removePendingApprovalEverywhere({
      approvalsByAgentId: scoped,
      unscopedApprovals: [],
      approvalId: "a",
    });

    expect(removed.approvalsByAgentId).toEqual({
      "agent-2": [createApproval("b", 20_000)],
    });
  });

  it("upserts approvals and keeps most recent at the top", () => {
    const a = createApproval("a", 10_000);
    const b = createApproval("b", 20_000);
    const updatedA = { ...a, command: "ls" };

    const added = upsertPendingApproval([], a);
    expect(added).toEqual([a]);

    const withB = upsertPendingApproval(added, b);
    expect(withB).toEqual([b, a]);

    const upsertedA = upsertPendingApproval(withB, updatedA);
    expect(upsertedA).toEqual([b, updatedA]);
  });

  it("updates and removes approvals by id", () => {
    const approvals = [createApproval("a", 10_000), createApproval("b", 20_000)];
    const updated = updatePendingApprovalById(approvals, "a", (approval) => ({
      ...approval,
      resolving: true,
    }));
    expect(updated[0]?.resolving).toBe(true);

    const removed = removePendingApprovalById(updated, "a");
    expect(removed).toHaveLength(1);
    expect(removed[0]?.id).toBe("b");
  });

  it("removes approvals by id across agent map and drops empty keys", () => {
    const map = {
      "agent-1": [createApproval("a", 10_000)],
      "agent-2": [createApproval("b", 20_000)],
    };
    const removed = removePendingApprovalByIdMap(map, "a");
    expect(removed).toEqual({
      "agent-2": [createApproval("b", 20_000)],
    });
  });

  it("prunes expired approvals with grace window", () => {
    const nowMs = 10_000;
    const graceMs = 500;
    const expired = createApproval("a", nowMs - 600);
    const graceBoundary = createApproval("b", nowMs - 500);
    const active = createApproval("c", nowMs + 200);

    const pruned = pruneExpiredPendingApprovals([expired, graceBoundary, active], {
      nowMs,
      graceMs,
    });

    expect(pruned.map((entry) => entry.id)).toEqual(["b", "c"]);

    const mapPruned = pruneExpiredPendingApprovalsMap(
      {
        "agent-1": [expired, active],
        "agent-2": [graceBoundary],
      },
      { nowMs, graceMs }
    );

    expect(mapPruned).toEqual({
      "agent-1": [active],
      "agent-2": [graceBoundary],
    });
  });

  it("computes next prune delay from the earliest expiry", () => {
    const nowMs = 5_000;
    const delay = nextPendingApprovalPruneDelayMs({
      approvalsByAgentId: {
        "agent-1": [createApproval("a", 9_000)],
        "agent-2": [createApproval("b", 6_000)],
      },
      unscopedApprovals: [createApproval("c", 7_000)],
      nowMs,
      graceMs: 500,
    });
    expect(delay).toBe(1_500);

    const none = nextPendingApprovalPruneDelayMs({
      approvalsByAgentId: {},
      unscopedApprovals: [],
      nowMs,
      graceMs: 500,
    });
    expect(none).toBeNull();
  });

  it("merges focused approvals without rendering duplicate ids", () => {
    const unscopedA = createApproval("same", 10_000);
    const unscopedB = createApproval("unscoped-only", 11_000);
    const scopedSame = { ...createApproval("same", 12_000), agentId: "agent-2" };
    const scopedC = { ...createApproval("scoped-only", 13_000), agentId: "agent-2" };

    const merged = mergePendingApprovalsForFocusedAgent({
      scopedApprovals: [scopedSame, scopedC],
      unscopedApprovals: [unscopedA, unscopedB],
    });

    expect(merged.map((entry) => entry.id)).toEqual(["same", "unscoped-only", "scoped-only"]);
    expect(merged[0]).toEqual(scopedSame);
  });
});
