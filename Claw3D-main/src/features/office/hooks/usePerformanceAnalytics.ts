"use client";

import { useMemo } from "react";
import type { AgentState } from "@/features/agents/state/store";
import type { ApprovalAgentMetrics } from "@/features/office/hooks/useApprovalMetrics";
import type { RunRecord } from "@/features/office/hooks/useRunLog";

export type AgentPerformanceRow = {
  agentId: string;
  agentName: string;
  totalRuns: number;
  completedRuns: number;
  successRate: number | null;
  avgRuntimeMs: number | null;
  toolCalls: number;
  approvalRequestedCount: number;
  interventionRate: number | null;
};

const average = (values: number[]): number | null => {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

export const usePerformanceAnalytics = ({
  agents,
  runLog,
  approvalByAgent,
}: {
  agents: AgentState[];
  runLog: RunRecord[];
  approvalByAgent: ApprovalAgentMetrics[];
}) => {
  return useMemo(() => {
    const approvalsByAgentId = new Map(
      approvalByAgent.map((entry) => [entry.agentId, entry])
    );

    const rows: AgentPerformanceRow[] = agents.map((agent) => {
      const runs = runLog.filter((record) => record.agentId === agent.agentId);
      const completedRuns = runs.filter((record) => record.endedAt !== null);
      const successfulRuns = completedRuns.filter((record) => record.outcome === "ok");
      const runtimes = completedRuns
        .map((record) =>
          record.endedAt === null ? null : Math.max(0, record.endedAt - record.startedAt)
        )
        .filter((value): value is number => value !== null);
      const approvalMetrics = approvalsByAgentId.get(agent.agentId);
      const toolCalls =
        agent.transcriptEntries?.filter((entry) => entry.kind === "tool").length ?? 0;
      const successRate =
        completedRuns.length > 0 ? successfulRuns.length / completedRuns.length : null;
      const approvalRequestedCount = approvalMetrics?.requestedCount ?? 0;
      const interventionRate =
        runs.length > 0
          ? Math.min(1, approvalRequestedCount / Math.max(1, runs.length))
          : null;

      return {
        agentId: agent.agentId,
        agentName: agent.name || agent.agentId,
        totalRuns: runs.length,
        completedRuns: completedRuns.length,
        successRate,
        avgRuntimeMs: average(runtimes),
        toolCalls,
        approvalRequestedCount,
        interventionRate,
      };
    });

    const allCompletedRuns = runLog.filter((record) => record.endedAt !== null);
    const allSuccessfulRuns = allCompletedRuns.filter((record) => record.outcome === "ok");
    const allRuntimes = allCompletedRuns
      .map((record) =>
        record.endedAt === null ? null : Math.max(0, record.endedAt - record.startedAt)
      )
      .filter((value): value is number => value !== null);
    const totalApprovalsRequested = approvalByAgent.reduce(
      (sum, entry) => sum + entry.requestedCount,
      0
    );
    const totalToolCalls = rows.reduce((sum, row) => sum + row.toolCalls, 0);

    return {
      fleet: {
        totalRuns: runLog.length,
        completedRuns: allCompletedRuns.length,
        successRate:
          allCompletedRuns.length > 0
            ? allSuccessfulRuns.length / allCompletedRuns.length
            : null,
        avgRuntimeMs: average(allRuntimes),
        totalToolCalls,
        totalApprovalsRequested,
        interventionRate:
          runLog.length > 0
            ? Math.min(1, totalApprovalsRequested / Math.max(1, runLog.length))
            : null,
      },
      rows: rows.sort((left, right) => {
        const leftCost = left.totalRuns;
        const rightCost = right.totalRuns;
        if (rightCost !== leftCost) return rightCost - leftCost;
        return left.agentName.localeCompare(right.agentName);
      }),
      topToolUsers: [...rows]
        .filter((row) => row.toolCalls > 0)
        .sort((left, right) => right.toolCalls - left.toolCalls)
        .slice(0, 5),
    };
  }, [agents, approvalByAgent, runLog]);
};
