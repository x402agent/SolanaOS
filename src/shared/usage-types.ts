export interface UsageSummary {
  totalTokens: number;
  totalCost: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  requestCount?: number;
  toolCallCount?: number;
  errorCount?: number;
  avgLatencyMs?: number;
}
export interface CostUsageSummary {
  total: number;
  byProvider: Record<string, number>;
  byModel: Record<string, number>;
  bySession?: Record<string, number>;
}

export function createEmptyUsageSummary(): UsageSummary {
  return {
    totalTokens: 0,
    totalCost: 0,
    inputTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    requestCount: 0,
    toolCallCount: 0,
    errorCount: 0,
    avgLatencyMs: 0,
  };
}
