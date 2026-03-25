import type { CronJobSummary } from "@/lib/cron/types";
import {
  buildLatestUpdatePatch,
  resolveLatestUpdateIntent,
} from "@/features/agents/operations/latestUpdateWorkflow";
import type { AgentState } from "@/features/agents/state/store";
import { extractText, isHeartbeatPrompt, stripUiMetadata } from "@/lib/text/message-extract";

type ChatHistoryMessage = Record<string, unknown>;

type ChatHistoryResult = {
  messages?: ChatHistoryMessage[];
};

type SessionsListEntry = {
  key?: string;
  updatedAt?: number | null;
  origin?: { label?: string | null } | null;
};

type SessionsListResult = {
  sessions?: SessionsListEntry[];
};

const findLatestHeartbeatResponse = (messages: ChatHistoryMessage[]) => {
  let awaitingHeartbeatReply = false;
  let latestResponse: string | null = null;
  for (const message of messages) {
    const role = typeof message.role === "string" ? message.role : "";
    if (role === "user") {
      const text = stripUiMetadata(extractText(message) ?? "").trim();
      awaitingHeartbeatReply = isHeartbeatPrompt(text);
      continue;
    }
    if (role === "assistant" && awaitingHeartbeatReply) {
      const text = stripUiMetadata(extractText(message) ?? "").trim();
      if (text) {
        latestResponse = text;
      }
    }
  }
  return latestResponse;
};

export type SpecialLatestUpdateDeps = {
  callGateway: (method: string, params: unknown) => Promise<unknown>;
  listCronJobs: () => Promise<{ jobs: CronJobSummary[] }>;
  resolveCronJobForAgent: (jobs: CronJobSummary[], agentId: string) => CronJobSummary | null;
  formatCronJobDisplay: (job: CronJobSummary) => string;
  dispatchUpdateAgent: (
    agentId: string,
    patch: { latestOverride: string | null; latestOverrideKind: "heartbeat" | "cron" | null }
  ) => void;
  isDisconnectLikeError: (err: unknown) => boolean;
  logError: (message: string) => void;
};

export type SpecialLatestUpdateOperation = {
  update: (agentId: string, agent: AgentState, message: string) => Promise<void>;
  refreshHeartbeat: (agents: AgentState[]) => void;
  clearInFlight: (agentId: string) => void;
};

export function createSpecialLatestUpdateOperation(
  deps: SpecialLatestUpdateDeps
): SpecialLatestUpdateOperation {
  const inFlight = new Set<string>();

  const update: SpecialLatestUpdateOperation["update"] = async (agentId, agent, message) => {
    const intent = resolveLatestUpdateIntent({
      message,
      agentId: agent.agentId,
      sessionKey: agent.sessionKey,
      hasExistingOverride: Boolean(agent.latestOverride || agent.latestOverrideKind),
    });
    if (intent.kind === "noop") return;
    if (intent.kind === "reset") {
      deps.dispatchUpdateAgent(agent.agentId, buildLatestUpdatePatch(""));
      return;
    }

    const key = agentId;
    if (inFlight.has(key)) return;
    inFlight.add(key);

    try {
      if (intent.kind === "fetch-heartbeat") {
        const result = (await deps.callGateway("sessions.list", {
          agentId: intent.agentId,
          includeGlobal: false,
          includeUnknown: false,
          limit: intent.sessionLimit,
        })) as SessionsListResult;

        const entries = Array.isArray(result.sessions) ? result.sessions : [];
        const heartbeatSessions = entries.filter((entry) => {
          const label = entry.origin?.label;
          return typeof label === "string" && label.toLowerCase() === "heartbeat";
        });
        const candidates = heartbeatSessions.length > 0 ? heartbeatSessions : entries;
        const sorted = [...candidates].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
        const sessionKey = sorted[0]?.key;
        if (!sessionKey) {
          deps.dispatchUpdateAgent(agent.agentId, buildLatestUpdatePatch(""));
          return;
        }

        const history = (await deps.callGateway("chat.history", {
          sessionKey,
          limit: intent.historyLimit,
        })) as ChatHistoryResult;
        const messages = Array.isArray(history.messages) ? history.messages : [];
        const content = findLatestHeartbeatResponse(messages) ?? "";
        deps.dispatchUpdateAgent(agent.agentId, buildLatestUpdatePatch(content, "heartbeat"));
        return;
      }

      if (intent.kind === "fetch-cron") {
        const cronResult = await deps.listCronJobs();
        const job = deps.resolveCronJobForAgent(cronResult.jobs, intent.agentId);
        const content = job ? deps.formatCronJobDisplay(job) : "";
        deps.dispatchUpdateAgent(agent.agentId, buildLatestUpdatePatch(content, "cron"));
      }
    } catch (err) {
      if (!deps.isDisconnectLikeError(err)) {
        const message =
          err instanceof Error ? err.message : "Failed to load latest cron/heartbeat update.";
        deps.logError(message);
      }
    } finally {
      inFlight.delete(key);
    }
  };

  const refreshHeartbeat: SpecialLatestUpdateOperation["refreshHeartbeat"] = (agents) => {
    for (const agent of agents) {
      void update(agent.agentId, agent, "heartbeat");
    }
  };

  const clearInFlight: SpecialLatestUpdateOperation["clearInFlight"] = (agentId) => {
    inFlight.delete(agentId);
  };

  return { update, refreshHeartbeat, clearInFlight };
}

