// ── Platform Blocklist ───────────────────────────────────────────────────────
// Tokens deployed via these platforms are auto-filtered from ALL outputs.

const BLOCKED_DOMAINS: string[] = [
  "rapidlaunch.io",
  "7tracker.io",
  "j7tracker.io",
];

export function isTokenBlocked(text: string): boolean {
  const lower = text.toLowerCase();
  return BLOCKED_DOMAINS.some((d) => lower.includes(d));
}

export function filterBlockedTokens<T extends { name: string; symbol: string }>(
  tokens: T[]
): { clean: T[]; blockedCount: number } {
  let blockedCount = 0;
  const clean = tokens.filter((t) => {
    const searchable = `${t.name} ${t.symbol}`.toLowerCase();
    if (BLOCKED_DOMAINS.some((d) => searchable.includes(d))) {
      blockedCount++;
      return false;
    }
    return true;
  });
  return { clean, blockedCount };
}
