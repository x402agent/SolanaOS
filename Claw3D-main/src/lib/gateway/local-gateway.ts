const parseHostname = (gatewayUrl: string): string | null => {
  const trimmed = gatewayUrl.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).hostname;
  } catch {
    return null;
  }
};

const LOCAL_HOST_SUFFIXES = [".local", ".home.arpa", ".lan", ".internal"] as const;

const isPrivateIpv4Address = (hostname: string) => {
  const match = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(hostname);
  if (!match) return false;
  const [first, second] = [Number.parseInt(match[1], 10), Number.parseInt(match[2], 10)];
  if (first === 10) return true;
  if (first === 172 && second >= 16 && second <= 31) return true;
  if (first === 192 && second === 168) return true;
  return false;
};

export const isLocalGatewayUrl = (gatewayUrl: string): boolean => {
  const hostname = parseHostname(gatewayUrl);
  if (!hostname) return false;
  const normalized = hostname.trim().toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized === "0.0.0.0"
  );
};

export const isLikelyLocalGatewayUrl = (gatewayUrl: string): boolean => {
  if (isLocalGatewayUrl(gatewayUrl)) return true;
  const hostname = parseHostname(gatewayUrl);
  if (!hostname) return false;
  const normalized = hostname.trim().toLowerCase();
  if (isPrivateIpv4Address(normalized)) return true;
  if (normalized.endsWith(".ts.net")) return true;
  return LOCAL_HOST_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
};

