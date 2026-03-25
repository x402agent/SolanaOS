/**
 * pump-scanner-cron — Cloudflare Worker with cron trigger
 *
 * Runs every 30 minutes:
 *   1. Fetch tokens from GeckoTerminal (free, no key)
 *   2. Enrich with Solana Tracker (trending + token data)
 *   3. Classify signals (TRADE.md decision table)
 *   4. Push to Convex (site updates instantly)
 *   5. Ingest into Honcho memory (epistemological learning)
 *   6. Send Telegram digest
 */

export interface Env {
  CONVEX_SITE_URL: string;
  SOLANA_TRACKER_API_KEY: string;
  HONCHO_API_KEY: string;
  HONCHO_WORKSPACE: string;
  GECKO_PAGES: string;
  SOURCE_TAG: string;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_ID: string;
}

interface Token {
  rank: number;
  name: string;
  symbol: string;
  mint: string;
  marketCap: number | null;
  volume24h: number | null;
  priceChange24h: number | null;
  liquidity: number | null;
  ageMinutes: number | null;
  bondingPct: number | null;
  tier: string;
  action: string;
  trending?: boolean;
}

// ═══════════════════════════════════════════════════════════
// STEP 1: FETCH FROM GECKOTERMINAL
// ═══════════════════════════════════════════════════════════

async function fetchGeckoTerminal(pages: number): Promise<Token[]> {
  const tokens: Token[] = [];
  const seen = new Set<string>();

  for (let page = 1; page <= pages; page++) {
    try {
      const resp = await fetch(
        `https://api.geckoterminal.com/api/v2/networks/solana/dexes/pumpswap/pools?sort=h24_tx_count_desc&page=${page}&include=base_token`,
        { headers: { "User-Agent": "NanoSolana-Scanner/5.0", Accept: "application/json" } }
      );
      if (!resp.ok) break;
      const json: any = await resp.json();

      const tokenMap: Record<string, { name: string; symbol: string }> = {};
      for (const inc of json.included ?? []) {
        if (inc.type === "token") {
          const addr = inc.id?.replace("solana_", "") ?? "";
          tokenMap[addr] = { name: inc.attributes?.name ?? "", symbol: inc.attributes?.symbol ?? "" };
        }
      }

      for (const pool of json.data ?? []) {
        const attrs = pool.attributes ?? {};
        const baseId = pool.relationships?.base_token?.data?.id ?? "";
        const mint = baseId.replace("solana_", "");
        if (!mint || seen.has(mint)) continue;
        seen.add(mint);

        const mc = attrs.market_cap_usd ? parseFloat(attrs.market_cap_usd) : attrs.fdv_usd ? parseFloat(attrs.fdv_usd) : null;
        const vol = attrs.volume_usd?.h24 ? parseFloat(attrs.volume_usd.h24) : null;
        const change = attrs.price_change_percentage?.h24 ? parseFloat(attrs.price_change_percentage.h24) : null;
        const liq = attrs.reserve_in_usd ? parseFloat(attrs.reserve_in_usd) : null;
        const created = attrs.pool_created_at ?? null;
        let ageMin: number | null = null;
        if (created) {
          const ts = new Date(created).getTime();
          if (!isNaN(ts)) ageMin = Math.round((Date.now() - ts) / 60000);
        }

        const info = tokenMap[mint] ?? { name: "", symbol: "" };
        tokens.push({
          rank: tokens.length + 1,
          name: info.name, symbol: info.symbol, mint,
          marketCap: mc, volume24h: vol, priceChange24h: change, liquidity: liq,
          ageMinutes: ageMin, bondingPct: null, tier: "", action: "",
        });
      }

      if (page < pages) await new Promise(r => setTimeout(r, 2200));
    } catch (e) {
      console.log(`GeckoTerminal page ${page} error:`, e);
      break;
    }
  }
  return tokens;
}

// ═══════════════════════════════════════════════════════════
// STEP 2: ENRICH WITH SOLANA TRACKER
// ═══════════════════════════════════════════════════════════

async function enrichSolanaTracker(tokens: Token[], apiKey: string): Promise<void> {
  if (!apiKey) return;
  const headers = { "x-api-key": apiKey, "User-Agent": "NanoSolana-Scanner/5.0" };

  // Trending
  try {
    const resp = await fetch("https://data.solanatracker.io/tokens/trending", { headers });
    if (resp.ok) {
      const data: any = await resp.json();
      const trending = new Set<string>();
      for (const t of data ?? []) {
        const m = t.token?.mint ?? t.mint ?? "";
        if (m) trending.add(m);
      }
      for (const t of tokens) if (trending.has(t.mint)) t.trending = true;
      console.log(`Solana Tracker: ${trending.size} trending`);
    }
  } catch (e) { console.log("ST trending error:", e); }

  // Enrich top 20
  let enriched = 0;
  for (const t of tokens.slice(0, 20)) {
    try {
      const resp = await fetch(`https://data.solanatracker.io/tokens/${t.mint}`, { headers });
      if (resp.ok) {
        const d: any = await resp.json();
        const pool = d?.pools?.[0] ?? {};
        if (pool.volume?.h24 && !t.volume24h) t.volume24h = parseFloat(pool.volume.h24);
        if (pool.priceChange?.h24 != null && t.priceChange24h === null) t.priceChange24h = parseFloat(pool.priceChange.h24);
        if (pool.liquidity?.usd && !t.liquidity) t.liquidity = parseFloat(pool.liquidity.usd);
        enriched++;
      }
    } catch { /* non-fatal */ }
  }
  console.log(`Solana Tracker: enriched ${enriched} tokens`);
}

// ═══════════════════════════════════════════════════════════
// STEP 3: CLASSIFY (TRADE.md decision table)
// ═══════════════════════════════════════════════════════════

function classifyTokens(tokens: Token[]): void {
  for (const t of tokens) {
    const mc = t.marketCap ?? 0;
    const age = t.ageMinutes ?? 9999;
    const bond = t.bondingPct ?? 0;

    if (bond >= 90) { t.tier = "near-graduation"; t.action = "AVOID"; }
    else if (age <= 5 && mc < 5000) { t.tier = "fresh-sniper"; t.action = "SNIPE"; }
    else if (age <= 15 && bond >= 50) { t.tier = "fresh-sniper"; t.action = "BUY"; }
    else if (mc > 500000 && age < 120) { t.tier = "large-cap"; t.action = "SCALP"; }
    else if (mc > 1000000) { t.tier = "large-cap"; t.action = "SKIP"; }
    else if (mc > 100000) { t.tier = "large-cap"; t.action = "HOLD"; }
    else if (mc > 10000) { t.tier = "mid-cap"; t.action = "WATCH"; }
    else if (age <= 15) { t.tier = "fresh-sniper"; t.action = "SNIPE"; }
    else { t.tier = "micro-cap"; t.action = "SPECULATIVE"; }
  }
}

// ═══════════════════════════════════════════════════════════
// STEP 4: PUSH TO CONVEX
// ═══════════════════════════════════════════════════════════

async function pushToConvex(tokens: Token[], convexUrl: string, source: string): Promise<boolean> {
  const rows = tokens.slice(0, 100).map(t => {
    const mc = t.marketCap ?? 0;
    const mcStr = mc >= 1e6 ? `$${(mc / 1e6).toFixed(1)}M` : mc >= 1e3 ? `$${(mc / 1e3).toFixed(1)}K` : `$${mc.toFixed(0)}`;
    const age = t.ageMinutes;
    const ageStr = age === null ? "" : age < 60 ? `${age}m ago` : age < 1440 ? `${Math.floor(age / 60)}h ago` : `${Math.floor(age / 1440)}d ago`;
    const bond = t.bondingPct ?? 0;
    return `${t.rank}|${t.name}|${t.symbol}|${t.mint}|${mcStr}|${ageStr}|${bond.toFixed(2)}%`;
  });

  try {
    const resp = await fetch(`${convexUrl}/nanosolana/tracker/pump-ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source, raw: rows.join("\n"), scannedAt: Date.now() }),
    });
    if (!resp.ok) { console.log(`Convex error: ${resp.status}`); return false; }
    const result: any = await resp.json();
    console.log(`Convex: ${result.tokenCount} tokens | tiers:`, result.tiers);
    return true;
  } catch (e) { console.log("Convex push failed:", e); return false; }
}

// ═══════════════════════════════════════════════════════════
// STEP 5: HONCHO MEMORY INGEST
// ═══════════════════════════════════════════════════════════

async function ingestHoncho(tokens: Token[], apiKey: string, workspace: string): Promise<boolean> {
  if (!apiKey) return false;
  const baseUrl = "https://api.honcho.dev/v3";
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` };

  const now = new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";
  const sessionId = `cron-${Date.now()}`;
  const snipes = tokens.filter(t => t.action === "SNIPE" || t.action === "BUY");
  const graduating = tokens.filter(t => (t.bondingPct ?? 0) >= 90);

  const overview = [
    `AUTOMATED SCAN ${now} (source: cloudflare-cron)`,
    `Tokens: ${tokens.length} | Snipe targets: ${snipes.length} | Graduating: ${graduating.length}`,
    `Top by MC: ${tokens[0]?.name} (${tokens[0]?.symbol}) $${(tokens[0]?.marketCap ?? 0).toLocaleString()}`,
  ].join("\n");

  const signals = snipes.slice(0, 8).map(t =>
    `  ${t.action} ${t.symbol} | MC $${(t.marketCap ?? 0).toLocaleString()} | Age ${t.ageMinutes ?? "?"}m`
  ).join("\n");

  const compressed = tokens.map(t => `${t.rank}|${t.symbol}|$${(t.marketCap ?? 0).toLocaleString()}|${t.action}`).join("\n");

  // Use Honcho v3 REST API directly (no SDK needed in Workers)
  try {
    // Create session with messages via batch
    const messages = [
      { peer_id: "scanner", content: overview },
      ...(signals ? [{ peer_id: "scanner", content: `ACTIVE SIGNALS:\n${signals}` }] : []),
      { peer_id: "scanner", content: `FULL DATA:\n${compressed}` },
      { peer_id: "analyst", content: `Scan ingested: ${tokens.length} tokens, ${snipes.length} actionable. Updating model.` },
    ];

    // Ensure peers exist
    await fetch(`${baseUrl}/workspaces/${workspace}/peers`, {
      method: "POST", headers,
      body: JSON.stringify({ peer_id: "scanner" }),
    });
    await fetch(`${baseUrl}/workspaces/${workspace}/peers`, {
      method: "POST", headers,
      body: JSON.stringify({ peer_id: "analyst" }),
    });

    // Create session
    await fetch(`${baseUrl}/workspaces/${workspace}/sessions`, {
      method: "POST", headers,
      body: JSON.stringify({ session_id: sessionId, peer_ids: ["scanner", "analyst"] }),
    });

    // Add messages
    for (const msg of messages) {
      await fetch(`${baseUrl}/workspaces/${workspace}/sessions/${sessionId}/messages`, {
        method: "POST", headers,
        body: JSON.stringify({ peer_id: msg.peer_id, content: msg.content }),
      });
    }

    console.log(`Honcho: ${messages.length} messages → session '${sessionId}'`);
    return true;
  } catch (e) { console.log("Honcho error:", e); return false; }
}

// ═══════════════════════════════════════════════════════════
// STEP 6: TELEGRAM DIGEST
// ═══════════════════════════════════════════════════════════

async function sendTelegram(tokens: Token[], botToken: string, chatId: string): Promise<boolean> {
  if (!botToken || !chatId) return false;

  const now = new Date().toISOString().replace("T", " ").slice(11, 16) + " UTC";
  const snipes = tokens.filter(t => t.action === "SNIPE" || t.action === "BUY");
  const scalps = tokens.filter(t => t.action === "SCALP");
  const top3 = [...tokens].sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0)).slice(0, 3);

  const fmtMc = (mc: number) => mc >= 1e6 ? `$${(mc / 1e6).toFixed(1)}M` : `$${(mc / 1e3).toFixed(1)}K`;

  let text = `🔫 *Pump Scanner* — ${now}\nTokens: ${tokens.length} | Signals: ${snipes.length} snipe, ${scalps.length} scalp\n`;
  if (snipes.length) {
    text += "\n*Snipe/Buy:*\n";
    for (const t of snipes.slice(0, 5)) text += `  \`${t.symbol}\` ${fmtMc(t.marketCap ?? 0)} — ${t.action}\n`;
  }
  text += "\n*Top 3:*\n";
  for (const t of top3) text += `  \`${t.symbol}\` ${fmtMc(t.marketCap ?? 0)}\n`;

  try {
    const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
    });
    console.log(`Telegram: ${resp.ok ? "sent" : resp.status}`);
    return resp.ok;
  } catch (e) { console.log("Telegram error:", e); return false; }
}

// ═══════════════════════════════════════════════════════════
// WORKER ENTRY
// ═══════════════════════════════════════════════════════════

export default {
  // Cron trigger — runs every 30 minutes
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const start = Date.now();
    console.log(`═══ PUMP SCANNER CRON ═══ ${new Date().toISOString()}`);

    const pages = parseInt(env.GECKO_PAGES ?? "3");
    const tokens = await fetchGeckoTerminal(pages);
    if (!tokens.length) { console.log("No tokens — aborting"); return; }
    console.log(`Fetched: ${tokens.length} tokens`);

    await enrichSolanaTracker(tokens, env.SOLANA_TRACKER_API_KEY);
    classifyTokens(tokens);

    const convex = await pushToConvex(tokens, env.CONVEX_SITE_URL, env.SOURCE_TAG);
    const honcho = await ingestHoncho(tokens, env.HONCHO_API_KEY, env.HONCHO_WORKSPACE);
    const telegram = await sendTelegram(tokens, env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID);

    console.log(`═══ DONE ═══ ${tokens.length} tokens | Convex:${convex} Honcho:${honcho} TG:${telegram} | ${((Date.now() - start) / 1000).toFixed(1)}s`);
  },

  // HTTP trigger — manual run via GET request
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/run") {
      // Fire and forget the scan
      ctx.waitUntil((async () => {
        await this.scheduled({} as ScheduledEvent, env, ctx);
      })());
      return new Response(JSON.stringify({ status: "triggered", time: new Date().toISOString() }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      service: "pump-scanner-cron",
      version: "5.0",
      cron: "*/30 * * * *",
      endpoints: { "/run": "trigger scan manually", "/": "status" },
    }), { headers: { "Content-Type": "application/json" } });
  },
};
