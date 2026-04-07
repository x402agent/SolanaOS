// ── Convex Push ──────────────────────────────────────────────────────────────

import type { ScanResult, Env } from "./types.js";

export async function pushToConvex(
  scan: ScanResult,
  env: Env
): Promise<{ ok: boolean; message: string }> {
  const url = env.CONVEX_SITE_URL;
  if (!url) {
    return { ok: false, message: "CONVEX_SITE_URL not configured" };
  }

  // Build pipe-delimited rows matching pump.md format
  const rows = scan.tokens.map((t) =>
    `${t.rank}|${t.name}|${t.symbol}|${t.mint}|${t.marketCap}|${t.age}|${t.bondingPct}`
  );

  const payload = JSON.stringify({
    source: "cloudflare-worker",
    timestamp: scan.timestamp,
    tokenCount: scan.tokenCount,
    rows: rows.join("\n"),
  });

  try {
    const endpoint = `${url.replace(/\/$/, "")}/solanaos/tracker/pump-ingest`;
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
    });

    if (resp.ok) {
      return { ok: true, message: `Pushed ${scan.tokenCount} tokens to Convex` };
    }
    return {
      ok: false,
      message: `Convex push failed: HTTP ${resp.status} ${resp.statusText}`,
    };
  } catch (err) {
    return {
      ok: false,
      message: `Convex push error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
