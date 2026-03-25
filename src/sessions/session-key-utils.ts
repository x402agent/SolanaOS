export function parseAgentSessionKey(key: string): {
  agentId: string | null;
  sessionKey: string;
} {
  const trimmed = key.trim();
  if (!trimmed) return { agentId: null, sessionKey: "main" };
  const separatorIndex = trimmed.indexOf(":");
  if (separatorIndex <= 0) return { agentId: null, sessionKey: trimmed };
  return {
    agentId: trimmed.slice(0, separatorIndex),
    sessionKey: trimmed.slice(separatorIndex + 1) || "main",
  };
}

export function buildAgentSessionKey(agentId: string, sessionKey: string): string {
  const normalizedSessionKey = normalizeSessionKey(sessionKey);
  return agentId.trim() ? `${agentId.trim()}:${normalizedSessionKey}` : normalizedSessionKey;
}

export function normalizeSessionKey(key: string): string {
  const trimmed = key.trim();
  return trimmed || "main";
}

export function isMainSessionKey(key: string): boolean {
  return normalizeSessionKey(parseAgentSessionKey(key).sessionKey) === "main";
}
