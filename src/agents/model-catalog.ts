export interface ModelCatalogEntry {
  id: string;
  name: string;
  provider: string;
  maxTokens?: number;
  contextWindow?: number;
  reasoning?: boolean;
  defaultThinking?: "off" | "low" | "medium" | "high";
  recommended?: boolean;
}

export const DEFAULT_MODEL_CATALOG: ModelCatalogEntry[] = [
  {
    id: "minimax/minimax-m2.7",
    name: "MiniMax M2.7",
    provider: "openrouter",
    contextWindow: 200_000,
    reasoning: true,
    defaultThinking: "medium",
    recommended: true,
  },
  {
    id: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    provider: "anthropic",
    reasoning: true,
    defaultThinking: "medium",
  },
  {
    id: "grok-4-1-fast",
    name: "Grok 4.1 Fast",
    provider: "xai",
    reasoning: true,
    defaultThinking: "medium",
  },
  {
    id: "openai/gpt-5.4-nano",
    name: "GPT-5.4 Nano",
    provider: "openrouter",
    reasoning: true,
    defaultThinking: "low",
  },
];

export function findModelCatalogEntry(
  modelId: string,
  catalog: ModelCatalogEntry[] = DEFAULT_MODEL_CATALOG,
): ModelCatalogEntry | null {
  const normalized = modelId.trim().toLowerCase();
  return catalog.find((entry) => entry.id.trim().toLowerCase() === normalized) ?? null;
}
