// ── Tweet Generator ──────────────────────────────────────────────────────────

import type { ScanResult } from "./types.js";

function label(name: string, symbol: string, maxLen: number = 16): string {
  const sym = symbol.length <= 8 ? symbol : symbol.substring(0, 7) + "…";
  const raw = `${sym} (${name})`;
  return raw.length <= maxLen ? raw : raw.substring(0, maxLen - 1) + "…";
}

function ageShort(ageMinutes: number | null): string {
  if (ageMinutes === null) return "";
  if (ageMinutes < 1) return `${Math.round(ageMinutes * 60)}s`;
  return `${Math.round(ageMinutes)}m`;
}

function pctShort(pct: number): string {
  return pct >= 10 ? `${pct.toFixed(0)}%` : `${pct.toFixed(1)}%`;
}

export function generateTweet(scan: ScanResult): string {
  const timeStr = new Date(scan.timestamp).toISOString().substring(11, 16) + " UTC";
  const parts: string[] = [`🔍 pump.fun — ${timeStr}`, ""];

  // 2 fresh snipers
  const fresh = scan.tokens
    .filter((t) => t.ageMinutes !== null && t.ageMinutes <= 10)
    .sort((a, b) => (a.ageMinutes ?? 999) - (b.ageMinutes ?? 999))
    .slice(0, 2);

  const usedMints = new Set(fresh.map((t) => t.mint));

  if (fresh.length > 0) {
    parts.push("⚡ Fresh");
    for (const t of fresh) {
      const a = ageShort(t.ageMinutes);
      parts.push(`• ${label(t.name, t.symbol)} ${t.marketCap}${a ? " ·" + a : ""}`);
    }
    parts.push("");
  }

  // 2 top movers by bonding %
  const movers = scan.tokens
    .filter((t) => !usedMints.has(t.mint))
    .sort((a, b) => b.bondingPctNum - a.bondingPctNum)
    .slice(0, 2);
  for (const t of movers) usedMints.add(t.mint);

  if (movers.length > 0) {
    parts.push("🚀 Movers");
    for (const t of movers) {
      parts.push(`• ${label(t.name, t.symbol)} ${t.marketCap} +${pctShort(t.bondingPctNum)}`);
    }
    parts.push("");
  }

  // 1 top MC
  const topMc = scan.tokens
    .filter((t) => !usedMints.has(t.mint))
    .sort((a, b) => b.marketCapNum - a.marketCapNum)[0];

  if (topMc) {
    parts.push(`👑 ${label(topMc.name, topMc.symbol)} ${topMc.marketCap}`);
    parts.push("");
  }

  parts.push("not financial advice, -claude");

  let tweet = parts.join("\n").trimEnd();

  // Safety: trim to 280 chars
  while (tweet.length > 280) {
    const lines = tweet.split("\n");
    for (let i = lines.length - 2; i > 0; i--) {
      if (lines[i].startsWith("•")) {
        lines.splice(i, 1);
        break;
      }
    }
    tweet = lines.join("\n").trimEnd();
  }

  return tweet;
}
