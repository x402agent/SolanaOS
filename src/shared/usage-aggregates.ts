import type { UsageSummary } from "./usage-types";

export interface UsageAggregates {
  messages?: { total: number; byRole?: Record<string, number> };
  tokens?: { total: number; input?: number; output?: number };
  tools?: { total: number; byTool?: Record<string, number> };
  errors?: { total: number };
  cost?: { total: number };
  latency?: { averageMs: number; samples: number };
}

export function aggregateUsage(sessions: unknown[]): UsageAggregates {
  const byRole: Record<string, number> = {};
  const byTool: Record<string, number> = {};
  let messageTotal = 0;
  let tokenTotal = 0;
  let inputTotal = 0;
  let outputTotal = 0;
  let toolTotal = 0;
  let errorTotal = 0;
  let costTotal = 0;
  let latencySamples = 0;
  let latencyTotalMs = 0;

  for (const session of sessions) {
    if (!isRecord(session)) continue;
    const usage = readUsage(session.usage);
    const messageCount = finiteNumber(session.messageCount) ?? 0;
    const role = stringValue(session.role) ?? "unknown";
    const toolName = stringValue(session.toolName) ?? stringValue(session.tool);
    const latencyMs = finiteNumber(session.avgLatencyMs) ?? usage.avgLatencyMs ?? 0;

    messageTotal += messageCount;
    tokenTotal += usage.totalTokens;
    inputTotal += usage.inputTokens;
    outputTotal += usage.outputTokens;
    toolTotal += usage.toolCallCount ?? 0;
    errorTotal += usage.errorCount ?? 0;
    costTotal += usage.totalCost;

    byRole[role] = (byRole[role] ?? 0) + messageCount;
    if (toolName) {
      byTool[toolName] = (byTool[toolName] ?? 0) + (usage.toolCallCount ?? 1);
    }
    if (latencyMs > 0) {
      latencySamples += 1;
      latencyTotalMs += latencyMs;
    }
  }

  return {
    messages: { total: messageTotal, byRole },
    tokens: { total: tokenTotal, input: inputTotal, output: outputTotal },
    tools: { total: toolTotal, byTool },
    errors: { total: errorTotal },
    cost: { total: costTotal },
    latency: {
      averageMs: latencySamples > 0 ? latencyTotalMs / latencySamples : 0,
      samples: latencySamples,
    },
  };
}

export function mergeUsageLatency(...aggregates: unknown[]): { averageMs: number; samples: number } {
  let samples = 0;
  let weightedTotal = 0;
  for (const aggregate of aggregates) {
    if (!isRecord(aggregate) || !isRecord(aggregate.latency)) continue;
    const averageMs = finiteNumber(aggregate.latency.averageMs) ?? 0;
    const aggregateSamples = finiteNumber(aggregate.latency.samples) ?? 0;
    samples += aggregateSamples;
    weightedTotal += averageMs * aggregateSamples;
  }
  return {
    averageMs: samples > 0 ? weightedTotal / samples : 0,
    samples,
  };
}

export function mergeUsageDailyLatency(
  ...aggregates: Array<Record<string, { averageMs: number; samples: number }> | null | undefined>
): Record<string, { averageMs: number; samples: number }> {
  const merged: Record<string, { averageMs: number; samples: number }> = {};
  for (const aggregate of aggregates) {
    if (!aggregate) continue;
    for (const [day, latency] of Object.entries(aggregate)) {
      const previous = merged[day] ?? { averageMs: 0, samples: 0 };
      const nextSamples = previous.samples + latency.samples;
      const nextAverage =
        nextSamples > 0
          ? ((previous.averageMs * previous.samples) + (latency.averageMs * latency.samples)) /
            nextSamples
          : 0;
      merged[day] = { averageMs: nextAverage, samples: nextSamples };
    }
  }
  return merged;
}

export function buildUsageAggregateTail<T>(data: T[], window: number = 20): T[] {
  if (!Array.isArray(data) || window <= 0) return [];
  return data.slice(Math.max(0, data.length - window));
}

function readUsage(value: unknown): UsageSummary {
  const usage = isRecord(value) ? value : {};
  return {
    totalTokens: finiteNumber(usage.totalTokens) ?? finiteNumber(usage.tokenCount) ?? 0,
    totalCost: finiteNumber(usage.totalCost) ?? 0,
    inputTokens: finiteNumber(usage.inputTokens) ?? 0,
    outputTokens: finiteNumber(usage.outputTokens) ?? 0,
    requestCount: finiteNumber(usage.requestCount) ?? 0,
    toolCallCount: finiteNumber(usage.toolCallCount) ?? finiteNumber(usage.tools) ?? 0,
    errorCount: finiteNumber(usage.errorCount) ?? 0,
    avgLatencyMs: finiteNumber(usage.avgLatencyMs) ?? 0,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stringValue(value: unknown): string | undefined {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || undefined;
}
