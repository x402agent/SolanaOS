// ── Types ────────────────────────────────────────────────────────────────────

export interface Token {
  rank: number;
  name: string;
  symbol: string;
  mint: string;
  marketCap: string;
  marketCapNum: number;
  fdvUsd?: number;
  priceUsd?: number;
  liquidityUsd?: number;
  volume24hUsd?: number;
  priceChange24hPct?: number;
  holders?: number;
  trendRank?: number | null;
  age: string;
  ageMinutes: number | null;
  bondingPct: string;
  bondingPctNum: number;
  source: string;
  graduated: boolean;
}

export interface ScanResult {
  timestamp: string;
  timestampShort: string;
  source: string;
  tokenCount: number;
  tokens: Token[];
  summary: ScanSummary;
}

export interface ScanSummary {
  totalTokens: number;
  highestMcToken: { name: string; symbol: string; mc: string } | null;
  nearGraduation: number;
  freshTokens: number;
  top5ByMc: Array<{ name: string; symbol: string; mc: string }>;
}

export interface Env {
  SCANS: KVNamespace;
  SOLANA_TRACKER_API_KEY: string;
  BIRDEYE_API_KEY: string;
  BIRDEYE_WSS_URL: string;
  HELIUS_API_KEY: string;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_ID: string;
  CONVEX_SITE_URL: string;
  ENVIRONMENT: string;
}
