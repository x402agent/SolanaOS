import type { AgentState } from "@/features/agents/state/store";

export type SessionEpochSnapshot = Record<string, number>;

export type OfficeCleaningCue = {
  id: string;
  agentId: string;
  agentName: string;
  ts: number;
};

export const buildSessionEpochSnapshot = (
  agents: AgentState[],
): SessionEpochSnapshot =>
  Object.fromEntries(
    agents.map((agent) => [agent.agentId, agent.sessionEpoch ?? 0]),
  );

export const resolveResetAgentIds = ({
  previous,
  agents,
}: {
  previous: SessionEpochSnapshot;
  agents: AgentState[];
}): string[] => {
  const triggered: string[] = [];
  for (const agent of agents) {
    const prevEpoch = previous[agent.agentId];
    if (prevEpoch === undefined) continue;
    const nextEpoch = agent.sessionEpoch ?? 0;
    if (nextEpoch > prevEpoch) {
      triggered.push(agent.agentId);
    }
  }
  return triggered;
};
