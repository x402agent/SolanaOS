import type { PendingExecApproval } from "@/features/agents/approvals/types";
import type { AgentState } from "@/features/agents/state/store";

const normalizeExecAsk = (
  value: string | null | undefined
): "off" | "on-miss" | "always" | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "off" || normalized === "on-miss" || normalized === "always") {
    return normalized;
  }
  return null;
};

export const shouldPauseRunForPendingExecApproval = (params: {
  agent: AgentState | null;
  approval: PendingExecApproval;
  pausedRunId: string | null;
}): boolean => {
  const agent = params.agent;
  if (!agent) return false;
  if (agent.status !== "running") return false;

  const runId = agent.runId?.trim() ?? "";
  if (!runId) return false;
  if (params.pausedRunId === runId) return false;

  const approvalAsk = normalizeExecAsk(params.approval.ask);
  const agentAsk = normalizeExecAsk(agent.sessionExecAsk);
  const effectiveAsk = approvalAsk ?? agentAsk;
  return effectiveAsk === "always";
};
