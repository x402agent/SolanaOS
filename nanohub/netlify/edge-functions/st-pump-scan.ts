/**
 * st-pump-scan — Serves the latest pump.fun scanner results.
 *
 * Data flow (priority order):
 *   1. Try Convex — reads the latest scan pushed by the local/CLI scanner
 *   2. Fallback to GeckoTerminal — fetches PumpSwap pools live (free, no key)
 *   3. Enrich with Solana Tracker trending data (keyed, optional)
 *
 * The Convex path is fast (~50ms) since the scanner already pre-classified
 * tokens and stored them. GeckoTerminal is the fallback when Convex has no
 * recent scan (>30 min old) or is unreachable.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

interface Token {
  rank: number;
  name: string;
  symbol: string;
  mint: string;
  marketCap: number | null;
  fdv: number | null;
  volume24h: number | null;
  priceChange24h: number | null;
  liquidity: number | null;
  poolCreated?: string | null;
  ageMinutes: number | null;
  tier: string;
  action: string;
  trending?: boolean;
  bondingPct?: number | null;
  ageRaw?: string;
}

function classifyToken(t: {
  marketCap: number | null;
  ageMinutes: number | null;
  bondingPct: number | null;
}): { tier: string; action: string } {
  const mc = t.marketCap ?? 0;
  const age = t.ageMinutes ?? 9999;
  const bonding = t.bondingPct ?? 0;

  if (bonding >= 90) return { tier: "near-graduation", action: "AVOID" };
  if (age <= 5 && mc < 5000) return { tier: "fresh-sniper", action: "SNIPE" };
  if (age <= 15 && bonding >= 50) return { tier: "fresh-sniper", action: "BUY" };
  if (mc > 1_000_000) return { tier: "large-cap", action: "SKIP" };
  if (mc > 500_000 && age < 120) return { tier: "large-cap", action: "SCALP" };
  if (mc > 100_000) return { tier: "large-cap", action: "HOLD" };
  if (mc > 10_000) return { tier: "mid-cap", action: "WATCH" };
  return { tier: "micro-cap", action: "SPECULATIVE" };
}

function ageInMinutes(createdAt: string | null): number | null {
  if (!createdAt) return null;
  const created = new Date(createdAt).getTime();
  if (isNaN(created)) return null;
  return Math.round((Date.now() - created) / 60000);
}

// ── Convex source ───────────────────────────────────────────────────

async function fetchFromConvex(maxAgeMs: number): Promise<any | null> {
  const convexSiteUrl = Deno.env.get("CONVEX_SITE_URL") || Deno.env.get("VITE_CONVEX_SITE_URL");
  if (!convexSiteUrl) return null;

  try {
    const resp = await fetch(
      `${convexSiteUrl}/nanosolana/tracker/pump-scan?maxAge=${maxAgeMs}`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!resp.ok) return null;
    const data = await resp.json();
    if (data.stale || !data.tokens?.length) return null;
    // Add 'Convex' to sources so frontend knows which path was taken
    data.sources = [...(data.sources ?? []), "Convex"];
    return data;
  } catch {
    return null;
  }
}

// ── GeckoTerminal fallback ──────────────────────────────────────────

async function fetchFromGeckoTerminal(pages: number, apiKey?: string): Promise<any> {
  const tokens: Token[] = [];
  const seen = new Set<string>();

  try {
    for (let page = 1; page <= Math.min(pages, 5); page++) {
      const resp = await fetch(
        `https://api.geckoterminal.com/api/v2/networks/solana/dexes/pumpswap/pools?sort=h24_tx_count_desc&page=${page}&include=base_token`
      );
      if (!resp.ok) break;
      const json = await resp.json();

      const tokenMap: Record<string, { name: string; symbol: string }> = {};
      for (const inc of json.included ?? []) {
        if (inc.type === "token") {
          const addr = inc.id?.replace("solana_", "") ?? "";
          tokenMap[addr] = {
            name: inc.attributes?.name ?? "",
            symbol: inc.attributes?.symbol ?? "",
          };
        }
      }

      for (const pool of json.data ?? []) {
        const attrs = pool.attributes ?? {};
        const baseTokenId = pool.relationships?.base_token?.data?.id ?? "";
        const mint = baseTokenId.replace("solana_", "");
        if (!mint || seen.has(mint)) continue;
        seen.add(mint);

        const mc = attrs.market_cap_usd ? parseFloat(attrs.market_cap_usd) : null;
        const fdv = attrs.fdv_usd ? parseFloat(attrs.fdv_usd) : null;
        const vol = attrs.volume_usd?.h24 ? parseFloat(attrs.volume_usd.h24) : null;
        const change = attrs.price_change_percentage?.h24 ? parseFloat(attrs.price_change_percentage.h24) : null;
        const liq = attrs.reserve_in_usd ? parseFloat(attrs.reserve_in_usd) : null;
        const created = attrs.pool_created_at ?? null;
        const age = ageInMinutes(created);

        const { tier, action } = classifyToken({ marketCap: mc ?? fdv, ageMinutes: age, bondingPct: null });
        const info = tokenMap[mint] ?? { name: "", symbol: "" };

        tokens.push({
          rank: tokens.length + 1,
          name: info.name,
          symbol: info.symbol,
          mint,
          marketCap: mc ?? fdv,
          fdv,
          volume24h: vol,
          priceChange24h: change,
          liquidity: liq,
          poolCreated: created,
          ageMinutes: age,
          tier,
          action,
        });
      }

      if (page < pages) await new Promise((r) => setTimeout(r, 2100));
    }
  } catch (err) {
    console.error("[st-pump-scan] GeckoTerminal error:", err);
  }

  // Enrich with Solana Tracker trending + token data
  const trendingMints: Set<string> = new Set();
  const stTokenData: Record<string, { volume24h?: number; priceChange24h?: number; liquidity?: number }> = {};
  if (apiKey) {
    // Fetch trending tokens
    try {
      const resp = await fetch("https://data.solanatracker.io/tokens/trending", {
        headers: { "x-api-key": apiKey },
        signal: AbortSignal.timeout(5000),
      });
      if (resp.ok) {
        const data = await resp.json();
        for (const t of data ?? []) {
          const mint = t.token?.mint ?? t.mint ?? "";
          if (mint) trendingMints.add(mint);
        }
      }
    } catch {
      // Non-fatal
    }

    // Batch-enrich top tokens with volume/price data from Solana Tracker
    const topMints = tokens.slice(0, 30).map(t => t.mint).filter(Boolean);
    const batchSize = 10;
    for (let i = 0; i < topMints.length; i += batchSize) {
      const batch = topMints.slice(i, i + batchSize);
      await Promise.allSettled(batch.map(async (mint) => {
        try {
          const resp = await fetch(`https://data.solanatracker.io/tokens/${mint}`, {
            headers: { "x-api-key": apiKey },
            signal: AbortSignal.timeout(4000),
          });
          if (resp.ok) {
            const d = await resp.json();
            const pool = d?.pools?.[0] ?? {};
            stTokenData[mint] = {
              volume24h: pool?.volume?.h24 ? parseFloat(pool.volume.h24) : undefined,
              priceChange24h: pool?.priceChange?.h24 ? parseFloat(pool.priceChange.h24) : undefined,
              liquidity: pool?.liquidity?.usd ? parseFloat(pool.liquidity.usd) : undefined,
            };
          }
        } catch {
          // Non-fatal per token
        }
      }));
    }
  }

  for (const t of tokens) {
    if (trendingMints.has(t.mint)) {
      t.trending = true;
    }
    // Merge Solana Tracker enrichment
    const st = stTokenData[t.mint];
    if (st) {
      if (st.volume24h && !t.volume24h) t.volume24h = st.volume24h;
      if (st.priceChange24h !== undefined && t.priceChange24h === null) t.priceChange24h = st.priceChange24h;
      if (st.liquidity && !t.liquidity) t.liquidity = st.liquidity;
    }
  }

  const scannerAgent = Deno.env.get("SCANNER_AGENT_ASSET") ?? undefined;

  return {
    tokens: tokens.slice(0, 100),
    total: tokens.length,
    timestamp: new Date().toISOString(),
    sources: ["GeckoTerminal", ...(apiKey ? ["SolanaTracker"] : [])],
    scannerAgent,
    tiers: {
      freshSniper: tokens.filter((t) => t.tier === "fresh-sniper").length,
      nearGraduation: tokens.filter((t) => t.tier === "near-graduation").length,
      microCap: tokens.filter((t) => t.tier === "micro-cap").length,
      midCap: tokens.filter((t) => t.tier === "mid-cap").length,
      largeCap: tokens.filter((t) => t.tier === "large-cap").length,
    },
  };
}

// ── Main handler ────────────────────────────────────────────────────

export default async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const url = new URL(request.url);
  const pages = parseInt(url.searchParams.get("pages") ?? "3");
  const forceGecko = url.searchParams.get("source") === "gecko";
  const maxConvexAge = parseInt(url.searchParams.get("maxAge") ?? "") || 30 * 60 * 1000;

  let result: any = null;

  // Priority 1: Try Convex (fast, pre-classified data from local scanner)
  if (!forceGecko) {
    result = await fetchFromConvex(maxConvexAge);
    if (result) {
      console.log(`[st-pump-scan] Serving ${result.total} tokens from Convex`);
    }
  }

  // Priority 2: Fall back to GeckoTerminal (live, but slower)
  if (!result) {
    const apiKey = Deno.env.get("SOLANA_TRACKER_API_KEY");
    result = await fetchFromGeckoTerminal(pages, apiKey);
    console.log(`[st-pump-scan] Serving ${result.total} tokens from GeckoTerminal (fallback)`);
  }

  return new Response(JSON.stringify(result), {
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300", // Cache 5 min
    },
  });
};

export const config = { path: "/st/pump-scan" };
