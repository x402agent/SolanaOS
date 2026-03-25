"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AgentState } from "@/features/agents/state/store";
import type {
  StudioAnalyticsBudgetSettings,
} from "@/lib/studio/settings";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";

type UsageMessageCounts = {
  total: number;
  user: number;
  assistant: number;
  toolCalls: number;
  toolResults: number;
  errors: number;
};

export type UsageTotals = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  totalCost: number;
  inputCost: number;
  outputCost: number;
  cacheReadCost: number;
  cacheWriteCost: number;
  durationMs: number;
};

type UsageToolRecord = {
  name: string;
  count: number;
};

type UsageModelRecord = {
  provider: string | null;
  model: string | null;
  count: number;
  totals: UsageTotals;
};

type UsageDailyBreakdown = {
  date: string;
  tokens: number;
  cost: number;
};

type UsageDailyMessageBreakdown = {
  date: string;
  total: number;
  toolCalls: number;
  errors: number;
};

type NormalizedSessionUsage = {
  totals: UsageTotals;
  messageCounts: UsageMessageCounts;
  toolUsage: {
    totalCalls: number;
    tools: UsageToolRecord[];
  };
  modelUsage: UsageModelRecord[];
  dailyBreakdown: UsageDailyBreakdown[];
  dailyMessageCounts: UsageDailyMessageBreakdown[];
};

export type UsageSessionRow = {
  key: string;
  label: string | null;
  agentId: string | null;
  agentName: string | null;
  channel: string | null;
  model: string | null;
  provider: string | null;
  updatedAt: number | null;
  usage: NormalizedSessionUsage;
};

export type CostDailyRow = {
  date: string;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  inputCost: number;
  outputCost: number;
  cacheReadCost: number;
  cacheWriteCost: number;
  totalCost: number;
};

export type UsageAgentAggregate = {
  agentId: string;
  agentName: string;
  totals: UsageTotals;
};

export type UsageDailyAggregate = {
  date: string;
  tokens: number;
  cost: number;
  messages: number;
  toolCalls: number;
  errors: number;
};

export type UsageBudgetAlert = {
  key: "daily" | "monthly" | "per-agent";
  severity: "warning" | "danger";
  label: string;
  currentUsd: number;
  limitUsd: number;
};

type UsageSessionsResult = {
  sessions?: unknown[];
  totals?: unknown;
  aggregates?: unknown;
};

type UsageCostResult = {
  daily?: unknown[];
};

const EMPTY_TOTALS: UsageTotals = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 0,
  totalCost: 0,
  inputCost: 0,
  outputCost: 0,
  cacheReadCost: 0,
  cacheWriteCost: 0,
  durationMs: 0,
};

const EMPTY_MESSAGE_COUNTS: UsageMessageCounts = {
  total: 0,
  user: 0,
  assistant: 0,
  toolCalls: 0,
  toolResults: 0,
  errors: 0,
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const asNumber = (value: unknown): number => {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
};

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const normalizeTotals = (value: unknown): UsageTotals => {
  const record = asRecord(value);
  if (!record) return { ...EMPTY_TOTALS };
  return {
    input: asNumber(record.input),
    output: asNumber(record.output),
    cacheRead: asNumber(record.cacheRead),
    cacheWrite: asNumber(record.cacheWrite),
    totalTokens: asNumber(record.totalTokens),
    totalCost: asNumber(record.totalCost),
    inputCost: asNumber(record.inputCost),
    outputCost: asNumber(record.outputCost),
    cacheReadCost: asNumber(record.cacheReadCost),
    cacheWriteCost: asNumber(record.cacheWriteCost),
    durationMs: asNumber(record.durationMs),
  };
};

const addTotals = (left: UsageTotals, right: UsageTotals): UsageTotals => {
  return {
    input: left.input + right.input,
    output: left.output + right.output,
    cacheRead: left.cacheRead + right.cacheRead,
    cacheWrite: left.cacheWrite + right.cacheWrite,
    totalTokens: left.totalTokens + right.totalTokens,
    totalCost: left.totalCost + right.totalCost,
    inputCost: left.inputCost + right.inputCost,
    outputCost: left.outputCost + right.outputCost,
    cacheReadCost: left.cacheReadCost + right.cacheReadCost,
    cacheWriteCost: left.cacheWriteCost + right.cacheWriteCost,
    durationMs: left.durationMs + right.durationMs,
  };
};

const normalizeMessageCounts = (value: unknown): UsageMessageCounts => {
  const record = asRecord(value);
  if (!record) return { ...EMPTY_MESSAGE_COUNTS };
  return {
    total: asNumber(record.total),
    user: asNumber(record.user),
    assistant: asNumber(record.assistant),
    toolCalls: asNumber(record.toolCalls),
    toolResults: asNumber(record.toolResults),
    errors: asNumber(record.errors),
  };
};

const normalizeToolUsage = (value: unknown) => {
  const record = asRecord(value);
  const tools = asArray(record?.tools).map((entry) => {
    const parsed = asRecord(entry);
    return {
      name: asString(parsed?.name) ?? "Unknown",
      count: asNumber(parsed?.count),
    };
  });
  return {
    totalCalls: asNumber(record?.totalCalls),
    tools: tools.filter((entry) => entry.count > 0),
  };
};

const normalizeModelUsage = (value: unknown): UsageModelRecord[] => {
  return asArray(value)
    .map((entry) => {
      const parsed = asRecord(entry);
      return {
        provider: asString(parsed?.provider),
        model: asString(parsed?.model),
        count: asNumber(parsed?.count),
        totals: normalizeTotals(parsed?.totals),
      };
    })
    .filter((entry) => entry.count > 0 || entry.totals.totalCost > 0 || entry.totals.totalTokens > 0);
};

const normalizeDailyBreakdown = (value: unknown): UsageDailyBreakdown[] => {
  return asArray(value)
    .map((entry) => {
      const parsed = asRecord(entry);
      return {
        date: asString(parsed?.date) ?? "",
        tokens: asNumber(parsed?.tokens),
        cost: asNumber(parsed?.cost),
      };
    })
    .filter((entry) => entry.date);
};

const normalizeDailyMessageCounts = (value: unknown): UsageDailyMessageBreakdown[] => {
  return asArray(value)
    .map((entry) => {
      const parsed = asRecord(entry);
      return {
        date: asString(parsed?.date) ?? "",
        total: asNumber(parsed?.total),
        toolCalls: asNumber(parsed?.toolCalls),
        errors: asNumber(parsed?.errors),
      };
    })
    .filter((entry) => entry.date);
};

const normalizeSessionUsage = (value: unknown): NormalizedSessionUsage => {
  const record = asRecord(value);
  return {
    totals: normalizeTotals(record),
    messageCounts: normalizeMessageCounts(record?.messageCounts),
    toolUsage: normalizeToolUsage(record?.toolUsage),
    modelUsage: normalizeModelUsage(record?.modelUsage),
    dailyBreakdown: normalizeDailyBreakdown(record?.dailyBreakdown),
    dailyMessageCounts: normalizeDailyMessageCounts(record?.dailyMessageCounts),
  };
};

const normalizeDateString = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
};

const normalizeCostDaily = (value: unknown): CostDailyRow[] => {
  return asArray(value)
    .map((entry) => {
      const parsed = asRecord(entry);
      return {
        date: normalizeDateString(asString(parsed?.date) ?? ""),
        input: asNumber(parsed?.input),
        output: asNumber(parsed?.output),
        cacheRead: asNumber(parsed?.cacheRead),
        cacheWrite: asNumber(parsed?.cacheWrite),
        totalTokens: asNumber(parsed?.totalTokens),
        inputCost: asNumber(parsed?.inputCost),
        outputCost: asNumber(parsed?.outputCost),
        cacheReadCost: asNumber(parsed?.cacheReadCost),
        cacheWriteCost: asNumber(parsed?.cacheWriteCost),
        totalCost: asNumber(parsed?.totalCost),
      };
    })
    .filter((entry) => entry.date);
};

const startOfToday = () => new Date().toISOString().slice(0, 10);

const startOfCurrentMonth = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const calculateBudgetAlerts = (params: {
  budgets: StudioAnalyticsBudgetSettings;
  costDaily: CostDailyRow[];
  byAgent: UsageAgentAggregate[];
}): UsageBudgetAlert[] => {
  const alerts: UsageBudgetAlert[] = [];
  const thresholdRatio = params.budgets.alertThresholdPct / 100;
  const today = startOfToday();
  const monthPrefix = startOfCurrentMonth();
  const todayCost = params.costDaily
    .filter((entry) => entry.date === today)
    .reduce((sum, entry) => sum + entry.totalCost, 0);
  const monthlyCost = params.costDaily
    .filter((entry) => entry.date.startsWith(monthPrefix))
    .reduce((sum, entry) => sum + entry.totalCost, 0);
  const maxAgentCost = params.byAgent[0]?.totals.totalCost ?? 0;

  const addAlert = (
    key: UsageBudgetAlert["key"],
    label: string,
    currentUsd: number,
    limitUsd: number | null
  ) => {
    if (limitUsd === null || limitUsd <= 0) return;
    if (currentUsd >= limitUsd) {
      alerts.push({ key, label, currentUsd, limitUsd, severity: "danger" });
      return;
    }
    if (currentUsd >= limitUsd * thresholdRatio) {
      alerts.push({ key, label, currentUsd, limitUsd, severity: "warning" });
    }
  };

  addAlert("daily", "Daily budget", todayCost, params.budgets.dailySpendLimitUsd);
  addAlert("monthly", "Monthly budget", monthlyCost, params.budgets.monthlySpendLimitUsd);
  addAlert(
    "per-agent",
    "Per-agent soft limit",
    maxAgentCost,
    params.budgets.perAgentSoftLimitUsd
  );

  return alerts;
};

export const useUsageAnalytics = ({
  client,
  status,
  agents,
  startDate,
  endDate,
  budgets,
}: {
  client: GatewayClient;
  status: GatewayStatus;
  agents: AgentState[];
  startDate: string;
  endDate: string;
  budgets: StudioAnalyticsBudgetSettings;
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<UsageSessionRow[]>([]);
  const [costDaily, setCostDaily] = useState<CostDailyRow[]>([]);
  const [serverTotals, setServerTotals] = useState<UsageTotals | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(null);
  const agentsRef = useRef(agents);

  useEffect(() => {
    agentsRef.current = agents;
  }, [agents]);

  const refresh = useCallback(async () => {
    if (status !== "connected") {
      setSessions([]);
      setCostDaily([]);
      setServerTotals(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [usageResult, costResult] = await Promise.all([
        client.call<UsageSessionsResult>("sessions.usage", {
          startDate,
          endDate,
          limit: 1000,
          includeContextWeight: true,
        }),
        client.call<UsageCostResult>("usage.cost", {
          startDate,
          endDate,
        }),
      ]);
      const agentNameById = new Map(
        agentsRef.current.map((agent) => [agent.agentId, agent.name || agent.agentId])
      );
      const normalizedSessions = asArray(usageResult.sessions).map((entry) => {
        const parsed = asRecord(entry);
        const agentId = asString(parsed?.agentId);
        const provider =
          asString(parsed?.modelProvider) ??
          asString(parsed?.providerOverride) ??
          asString(asRecord(parsed?.origin)?.provider);
        const model = asString(parsed?.model) ?? asString(parsed?.modelOverride);
        return {
          key: asString(parsed?.key) ?? "unknown",
          label: asString(parsed?.label),
          agentId,
          agentName: agentId ? agentNameById.get(agentId) ?? agentId : null,
          channel: asString(parsed?.channel),
          model,
          provider,
          updatedAt: asNumber(parsed?.updatedAt) || null,
          usage: normalizeSessionUsage(parsed?.usage),
        } satisfies UsageSessionRow;
      });
      setSessions(normalizedSessions);
      setCostDaily(normalizeCostDaily(costResult.daily));
      setServerTotals(asRecord(usageResult.totals) ? normalizeTotals(usageResult.totals) : null);
      setLastRefreshedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load usage analytics.");
      setSessions([]);
      setCostDaily([]);
      setServerTotals(null);
    } finally {
      setLoading(false);
    }
  }, [client, endDate, startDate, status]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const aggregates = useMemo(() => {
    const messages: UsageMessageCounts = { ...EMPTY_MESSAGE_COUNTS };
    const tools = new Map<string, number>();
    const models = new Map<string, UsageModelRecord>();
    const byAgent = new Map<string, UsageAgentAggregate>();
    const daily = new Map<string, UsageDailyAggregate>();
    let totals: UsageTotals = { ...EMPTY_TOTALS };

    for (const session of sessions) {
      totals = addTotals(totals, session.usage.totals);
      messages.total += session.usage.messageCounts.total;
      messages.user += session.usage.messageCounts.user;
      messages.assistant += session.usage.messageCounts.assistant;
      messages.toolCalls += session.usage.messageCounts.toolCalls;
      messages.toolResults += session.usage.messageCounts.toolResults;
      messages.errors += session.usage.messageCounts.errors;

      for (const tool of session.usage.toolUsage.tools) {
        tools.set(tool.name, (tools.get(tool.name) ?? 0) + tool.count);
      }

      for (const model of session.usage.modelUsage) {
        const key = `${model.provider ?? "unknown"}::${model.model ?? "unknown"}`;
        const existing = models.get(key) ?? {
          provider: model.provider,
          model: model.model,
          count: 0,
          totals: { ...EMPTY_TOTALS },
        };
        existing.count += model.count;
        existing.totals = addTotals(existing.totals, model.totals);
        models.set(key, existing);
      }

      if (session.agentId) {
        const existing = byAgent.get(session.agentId) ?? {
          agentId: session.agentId,
          agentName: session.agentName ?? session.agentId,
          totals: { ...EMPTY_TOTALS },
        };
        existing.totals = addTotals(existing.totals, session.usage.totals);
        byAgent.set(session.agentId, existing);
      }

      for (const entry of session.usage.dailyBreakdown) {
        const existing = daily.get(entry.date) ?? {
          date: entry.date,
          tokens: 0,
          cost: 0,
          messages: 0,
          toolCalls: 0,
          errors: 0,
        };
        existing.tokens += entry.tokens;
        existing.cost += entry.cost;
        daily.set(entry.date, existing);
      }

      for (const entry of session.usage.dailyMessageCounts) {
        const existing = daily.get(entry.date) ?? {
          date: entry.date,
          tokens: 0,
          cost: 0,
          messages: 0,
          toolCalls: 0,
          errors: 0,
        };
        existing.messages += entry.total;
        existing.toolCalls += entry.toolCalls;
        existing.errors += entry.errors;
        daily.set(entry.date, existing);
      }
    }

    if (serverTotals) {
      totals = {
        ...totals,
        ...serverTotals,
      };
    } else if (costDaily.length > 0) {
      totals = {
        ...totals,
        totalCost: costDaily.reduce((sum, entry) => sum + entry.totalCost, 0),
        totalTokens: costDaily.reduce((sum, entry) => sum + entry.totalTokens, 0),
        inputCost: costDaily.reduce((sum, entry) => sum + entry.inputCost, 0),
        outputCost: costDaily.reduce((sum, entry) => sum + entry.outputCost, 0),
        cacheReadCost: costDaily.reduce((sum, entry) => sum + entry.cacheReadCost, 0),
        cacheWriteCost: costDaily.reduce((sum, entry) => sum + entry.cacheWriteCost, 0),
      };
    }

    const byAgentRows = Array.from(byAgent.values()).sort(
      (left, right) => right.totals.totalCost - left.totals.totalCost
    );

    return {
      totals,
      messages,
      tools: {
        totalCalls: Array.from(tools.values()).reduce((sum, value) => sum + value, 0),
        uniqueTools: tools.size,
        tools: Array.from(tools.entries())
          .map(([name, count]) => ({ name, count }))
          .sort((left, right) => right.count - left.count),
      },
      byModel: Array.from(models.values()).sort(
        (left, right) => right.totals.totalCost - left.totals.totalCost
      ),
      byAgent: byAgentRows,
      daily: Array.from(daily.values()).sort((left, right) => left.date.localeCompare(right.date)),
    };
  }, [costDaily, serverTotals, sessions]);

  const budgetAlerts = useMemo(() => {
    return calculateBudgetAlerts({
      budgets,
      costDaily,
      byAgent: aggregates.byAgent,
    });
  }, [aggregates.byAgent, budgets, costDaily]);

  return {
    loading,
    error,
    refresh,
    sessions,
    costDaily,
    lastRefreshedAt,
    totals: aggregates.totals,
    aggregates,
    budgetAlerts,
  };
};
