import type { AgentState } from "@/features/agents/state/store";

export type SummarySnapshotSeed = Pick<AgentState, "sessionCreated" | "sessionKey">;

export type SummarySnapshotIntent =
  | { kind: "skip" }
  | {
      kind: "fetch";
      keys: string[];
      limit: number;
      maxChars: number;
    };

export type ReconcileEligibility = {
  shouldCheck: boolean;
  reason: "ok" | "not-running" | "missing-run-id" | "not-session-created";
};

const SUMMARY_PREVIEW_LIMIT = 8;
const SUMMARY_PREVIEW_MAX_CHARS = 240;

export const resolveSummarySnapshotKeys = (params: {
  agents: Array<{ sessionCreated: boolean; sessionKey: string }>;
  maxKeys: number;
}): string[] => {
  return Array.from(
    new Set(
      params.agents
        .filter((agent) => agent.sessionCreated)
        .map((agent) => agent.sessionKey)
        .filter((key): key is string => typeof key === "string" && key.trim().length > 0)
    )
  ).slice(0, params.maxKeys);
};

export const resolveSummarySnapshotIntent = (params: {
  agents: SummarySnapshotSeed[];
  maxKeys: number;
}): SummarySnapshotIntent => {
  const keys = resolveSummarySnapshotKeys({
    agents: params.agents,
    maxKeys: params.maxKeys,
  });
  if (keys.length === 0) {
    return { kind: "skip" };
  }
  return {
    kind: "fetch",
    keys,
    limit: SUMMARY_PREVIEW_LIMIT,
    maxChars: SUMMARY_PREVIEW_MAX_CHARS,
  };
};

export const resolveReconcileEligibility = (params: {
  status: "running" | "idle" | "error";
  sessionCreated: boolean;
  runId: string | null;
}): ReconcileEligibility => {
  if (params.status !== "running") {
    return { shouldCheck: false, reason: "not-running" };
  }
  if (!params.sessionCreated) {
    return { shouldCheck: false, reason: "not-session-created" };
  }
  const runId = params.runId?.trim() ?? "";
  if (!runId) {
    return { shouldCheck: false, reason: "missing-run-id" };
  }
  return { shouldCheck: true, reason: "ok" };
};

export const buildReconcileTerminalPatch = (params: {
  outcome: "ok" | "error";
}): {
  status: "idle" | "error";
  runId: null;
  runStartedAt: null;
  streamText: null;
  thinkingTrace: null;
} => {
  return {
    status: params.outcome === "error" ? "error" : "idle",
    runId: null,
    runStartedAt: null,
    streamText: null,
    thinkingTrace: null,
  };
};

export const resolveReconcileWaitOutcome = (status: unknown): "ok" | "error" | null => {
  if (status === "ok" || status === "error") {
    return status;
  }
  return null;
};
