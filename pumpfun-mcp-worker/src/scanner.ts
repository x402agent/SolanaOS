// ── Token Scanner — GeckoTerminal + Solana Tracker APIs ──────────────────────

import type { Token, ScanResult, ScanSummary, Env } from "./types.js";
import { filterBlockedTokens } from "./blocklist.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseMc(mc: string): number {
  const s = mc.replace("$", "").replace(/,/g, "");
  if (s.endsWith("B")) return parseFloat(s.slice(0, -1)) * 1e9;
  if (s.endsWith("M")) return parseFloat(s.slice(0, -1)) * 1e6;
  if (s.endsWith("K")) return parseFloat(s.slice(0, -1)) * 1e3;
  return parseFloat(s) || 0;
}

function formatMc(val: number): string {
  if (val >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
  if (val >= 1e3) return `$${(val / 1e3).toFixed(1)}K`;
  return `$${val.toFixed(0)}`;
}

function formatAge(seconds: number | null): string {
  if (seconds === null) return "N/A";
  if (seconds < 60) return `${Math.round(seconds)}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h ago`;
  return `${Math.round(seconds / 86400)}d ago`;
}

function ageToMinutes(ageStr: string): number | null {
  const m = ageStr.match(/^(\d+)(s|m|h|d) ago$/i);
  if (!m) return null;
  const val = parseInt(m[1]);
  switch (m[2].toLowerCase()) {
    case "s": return val / 60;
    case "m": return val;
    case "h": return val * 60;
    case "d": return val * 1440;
    default: return null;
  }
}

// ── Source 1: GeckoTerminal — PumpSwap graduated tokens ──────────────────────

interface GeckoPool {
  id: string;
  attributes: {
    name: string;
    base_token_price_usd: string;
    fdv_usd: string;
    pool_created_at: string;
    transactions: { h24: { buys: number; sells: number } };
  };
  relationships: {
    base_token: { data: { id: string } };
  };
}

async function fetchGeckoTerminal(pages: number = 5): Promise<Token[]> {
  const tokens: Map<string, Token> = new Map();
  
  for (let page = 1; page <= pages; page++) {
    try {
      const url = `https://api.geckoterminal.com/api/v2/networks/solana/dexes/pumpswap/pools?sort=h24_tx_count_desc&page=${page}`;
      const resp = await fetch(url, {
        headers: { Accept: "application/json" },
      });
      if (!resp.ok) continue;
      
      const data = (await resp.json()) as { data: GeckoPool[] };
      const pools = data.data || [];
      
      for (const pool of pools) {
        const attr = pool.attributes;
        const tokenId = pool.relationships?.base_token?.data?.id || "";
        const mint = tokenId.replace("solana_", "");
        if (!mint || tokens.has(mint)) continue;
        
        const nameParts = (attr.name || "").split("/");
        const rawName = nameParts[0]?.trim() || "Unknown";
        
        const fdv = parseFloat(attr.fdv_usd || "0");
        const createdAt = attr.pool_created_at
          ? (Date.now() - new Date(attr.pool_created_at).getTime()) / 1000
          : null;
        
        tokens.set(mint, {
          rank: 0,
          name: rawName,
          symbol: rawName.substring(0, 10),
          mint,
          marketCap: formatMc(fdv),
          marketCapNum: fdv,
          age: formatAge(createdAt),
          ageMinutes: createdAt !== null ? createdAt / 60 : null,
          bondingPct: "100%",
          bondingPctNum: 100,
          source: "geckoterminal",
          graduated: true,
        });
      }
    } catch {
      // Continue on error
    }
  }
  
  return Array.from(tokens.values());
}

// ── Source 2: Solana Tracker — trending bonding-curve tokens ──────────────────

interface STToken {
  token: {
    mint: string;
    name: string;
    symbol: string;
  };
  pools?: Array<{
    market?: string;
    graduated?: boolean;
    curvePercentage?: number;
    marketCap?: { usd?: number };
    createdAt?: number;
  }>;
}

async function fetchSolanaTracker(apiKey: string): Promise<Token[]> {
  if (!apiKey) return [];
  
  try {
    const resp = await fetch("https://data.solanatracker.io/tokens/trending", {
      headers: {
        "x-api-key": apiKey,
        Accept: "application/json",
      },
    });
    if (!resp.ok) return [];
    
    const data = (await resp.json()) as STToken[];
    const tokens: Token[] = [];
    
    for (const item of data) {
      const t = item.token;
      const pool = item.pools?.[0];
      if (!t?.mint) continue;
      
      const mc = pool?.marketCap?.usd || 0;
      const curve = pool?.curvePercentage || 0;
      const createdAt = pool?.createdAt
        ? (Date.now() / 1000 - pool.createdAt)
        : null;
      
      tokens.push({
        rank: 0,
        name: t.name || "Unknown",
        symbol: t.symbol || "???",
        mint: t.mint,
        marketCap: formatMc(mc),
        marketCapNum: mc,
        age: formatAge(createdAt),
        ageMinutes: createdAt !== null ? createdAt / 60 : null,
        bondingPct: `${curve.toFixed(2)}%`,
        bondingPctNum: curve,
        source: "solana-tracker",
        graduated: pool?.graduated || curve >= 100,
      });
    }
    
    return tokens;
  } catch {
    return [];
  }
}

// ── Merge + Deduplicate + Rank ───────────────────────────────────────────────

function mergeAndRank(sources: Token[][]): Token[] {
  const byMint = new Map<string, Token>();
  
  for (const source of sources) {
    for (const token of source) {
      const existing = byMint.get(token.mint);
      if (!existing || token.marketCapNum > existing.marketCapNum) {
        byMint.set(token.mint, token);
      }
    }
  }
  
  // Apply blocklist filter
  const all = Array.from(byMint.values());
  const { clean } = filterBlockedTokens(all);
  
  // Sort by market cap descending and take top 100
  clean.sort((a, b) => b.marketCapNum - a.marketCapNum);
  const top100 = clean.slice(0, 100);
  
  // Assign ranks
  top100.forEach((t, i) => (t.rank = i + 1));
  
  return top100;
}

// ── Build Summary ────────────────────────────────────────────────────────────

function buildSummary(tokens: Token[]): ScanSummary {
  const sorted = [...tokens].sort((a, b) => b.marketCapNum - a.marketCapNum);
  const top = sorted[0] || null;
  
  return {
    totalTokens: tokens.length,
    highestMcToken: top
      ? { name: top.name, symbol: top.symbol, mc: top.marketCap }
      : null,
    nearGraduation: tokens.filter((t) => t.bondingPctNum >= 90).length,
    freshTokens: tokens.filter(
      (t) => t.ageMinutes !== null && t.ageMinutes <= 10
    ).length,
    top5ByMc: sorted.slice(0, 5).map((t) => ({
      name: t.name,
      symbol: t.symbol,
      mc: t.marketCap,
    })),
  };
}

// ── Main Scanner Entry Point ─────────────────────────────────────────────────

export async function runScan(env: Env): Promise<ScanResult> {
  const now = new Date();
  
  // Fetch from both sources concurrently
  const [geckoTokens, stTokens] = await Promise.all([
    fetchGeckoTerminal(5),
    fetchSolanaTracker(env.SOLANA_TRACKER_API_KEY),
  ]);
  
  const tokens = mergeAndRank([geckoTokens, stTokens]);
  const summary = buildSummary(tokens);
  
  const result: ScanResult = {
    timestamp: now.toISOString(),
    timestampShort: now.toISOString().replace("T", " ").substring(0, 19) + " UTC",
    source: "cloudflare-worker",
    tokenCount: tokens.length,
    tokens,
    summary,
  };
  
  // Store in KV
  await env.SCANS.put("latest", JSON.stringify(result), {
    metadata: { timestamp: result.timestamp, count: tokens.length },
  });
  
  // Also store timestamped key for history (TTL 7 days)
  const historyKey = `scan:${now.toISOString().replace(/[:.]/g, "-")}`;
  await env.SCANS.put(historyKey, JSON.stringify(result), {
    expirationTtl: 7 * 24 * 3600,
  });
  
  return result;
}

// ── Generate pump.md content ─────────────────────────────────────────────────

export function generatePumpMd(scan: ScanResult): string {
  const lines: string[] = [
    "# Pump.fun Token Scanner",
    `> Last updated: ${scan.timestamp}`,
    "> Source: cloudflare-worker (GeckoTerminal + Solana Tracker)",
    `> Tokens found: ${scan.tokenCount}`,
    "",
    "## Token List",
    "",
    "| # | Name | Symbol | Mint Address | Market Cap | Age | Bonding % |",
    "|---|------|--------|-------------|------------|-----|-----------|",
  ];
  
  for (const t of scan.tokens) {
    lines.push(
      `| ${t.rank} | ${t.name} | ${t.symbol} | \`${t.mint}\` | ${t.marketCap} | ${t.age} | ${t.bondingPct} |`
    );
  }
  
  const s = scan.summary;
  lines.push("", "## Summary", "");
  lines.push(`- **Total tokens scanned:** ${s.totalTokens}`);
  lines.push(`- **Timestamp:** ${scan.timestamp}`);
  if (s.highestMcToken) {
    lines.push(
      `- **Highest market cap:** ${s.highestMcToken.name} (${s.highestMcToken.symbol}) at ${s.highestMcToken.mc}`
    );
  }
  lines.push(`- **Tokens near bonding completion (≥90%):** ${s.nearGraduation}`);
  lines.push(`- **Very new tokens (≤10m old):** ${s.freshTokens}`);
  lines.push(`- **Data source:** GeckoTerminal PumpSwap + Solana Tracker trending`);
  lines.push(`- **Top 5 by market cap:**`);
  for (const t of s.top5ByMc) {
    lines.push(`  - ${t.name} (${t.symbol}): ${t.mc}`);
  }
  
  return lines.join("\n") + "\n";
}
