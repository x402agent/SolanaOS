// ── Telegram Digest ──────────────────────────────────────────────────────────

import type { ScanResult, Env } from "./types.js";

function escapeMarkdownV2(text: string): string {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}

export function formatTelegramDigest(scan: ScanResult): string {
  const s = scan.summary;
  const timeStr = new Date(scan.timestamp)
    .toISOString()
    .substring(11, 16);
  
  const lines: string[] = [
    `🔍 *Pump\\.fun Scan* — ${timeStr} UTC`,
    "",
  ];

  // Top 5 by Market Cap
  if (s.top5ByMc.length > 0) {
    lines.push("📊 Top 5 by Market Cap");
    s.top5ByMc.forEach((t, i) => {
      lines.push(
        `${i + 1}\\. ${escapeMarkdownV2(t.name)} \\(${escapeMarkdownV2(t.symbol)}\\) — ${escapeMarkdownV2(t.mc)}`
      );
    });
    lines.push("");
  }

  // Near Graduation
  const nearGrad = scan.tokens.filter((t) => t.bondingPctNum >= 90 && t.bondingPctNum < 100);
  if (nearGrad.length > 0) {
    lines.push("⚡ Near Graduation \\(≥90% bonding\\)");
    nearGrad.slice(0, 5).forEach((t) => {
      lines.push(
        `• ${escapeMarkdownV2(t.name)} \\(${escapeMarkdownV2(t.symbol)}\\) — ${escapeMarkdownV2(t.bondingPct)}`
      );
    });
    lines.push("");
  }

  // Fresh Tokens
  const fresh = scan.tokens
    .filter((t) => t.ageMinutes !== null && t.ageMinutes <= 10)
    .sort((a, b) => (a.ageMinutes ?? 999) - (b.ageMinutes ?? 999));
  if (fresh.length > 0) {
    lines.push("🆕 Fresh Tokens \\(≤10m old\\)");
    fresh.slice(0, 5).forEach((t) => {
      lines.push(
        `• ${escapeMarkdownV2(t.name)} \\(${escapeMarkdownV2(t.symbol)}\\) — ${escapeMarkdownV2(t.marketCap)} · ${escapeMarkdownV2(t.age)}`
      );
    });
    lines.push("");
  }

  lines.push(`📁 ${s.totalTokens} tokens scanned → pump\\.md`);

  return lines.join("\n");
}

export async function sendTelegramDigest(
  scan: ScanResult,
  env: Env
): Promise<{ ok: boolean; message: string }> {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    return { ok: false, message: "Telegram credentials not configured" };
  }

  const text = formatTelegramDigest(scan);
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text,
        parse_mode: "MarkdownV2",
        disable_web_page_preview: true,
      }),
    });

    const data = (await resp.json()) as { ok: boolean; description?: string };
    if (data.ok) {
      return { ok: true, message: "Telegram digest sent" };
    }
    return { ok: false, message: `Telegram API error: ${data.description}` };
  } catch (err) {
    return {
      ok: false,
      message: `Telegram send failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
