// Stub: format-relative
export function formatRelativeTimestamp(iso: string | number): string {
  const now = Date.now();
  const ts = typeof iso === "number" ? iso : new Date(iso).getTime();
  const diff = now - ts;
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}
