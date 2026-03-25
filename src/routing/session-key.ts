import {
  buildAgentSessionKey,
  isMainSessionKey,
  normalizeSessionKey,
  parseAgentSessionKey as parseAgentSessionKeyBase,
} from "../sessions/session-key-utils";

export const DEFAULT_AGENT_ID = "default";
export const DEFAULT_MAIN_KEY = "main";

export function parseAgentSessionKey(key: string): {
  agentId: string | null;
  sessionKey: string;
} {
  return parseAgentSessionKeyBase(key);
}

export function parseSessionKey(key: string): { agentId?: string; kind: string; label: string } {
  const { agentId, sessionKey } = parseAgentSessionKey(key);
  const normalizedKey = normalizeSessionKey(sessionKey);
  if (normalizedKey === DEFAULT_MAIN_KEY) {
    return { agentId: agentId ?? undefined, kind: "main", label: DEFAULT_MAIN_KEY };
  }
  const slashIndex = normalizedKey.indexOf("/");
  if (slashIndex > 0) {
    return {
      agentId: agentId ?? undefined,
      kind: normalizedKey.slice(0, slashIndex),
      label: normalizedKey.slice(slashIndex + 1) || DEFAULT_MAIN_KEY,
    };
  }
  return { agentId: agentId ?? undefined, kind: "chat", label: normalizedKey };
}

export function buildSessionKey(parts: { agentId?: string; kind: string; label: string }): string {
  const label = normalizeSessionKey(parts.label);
  const kind = parts.kind.trim().toLowerCase();
  const baseKey =
    kind === "main"
      ? DEFAULT_MAIN_KEY
      : kind === "chat"
        ? label
        : `${kind}/${label}`;
  return buildAgentSessionKey(parts.agentId ?? "", baseKey);
}

export function buildAgentMainSessionKey(agentId: string): string {
  return buildAgentSessionKey(agentId, DEFAULT_MAIN_KEY);
}

export function formatSessionKey(key: string): string {
  const parsed = parseSessionKey(key);
  const label = parsed.kind === "main" ? "Main" : parsed.label;
  return parsed.agentId ? `${parsed.agentId} · ${label}` : label;
}

export function sessionKeyParts(key: string) {
  const parsed = parseSessionKey(key);
  return {
    agentId: parsed.agentId,
    kind: parsed.kind,
    label: parsed.label,
    isMain: isMainSessionKey(key),
  };
}

export function isSubagentSessionKey(key: string): boolean {
  const parsed = parseAgentSessionKey(key);
  return Boolean(parsed.agentId && parsed.agentId !== DEFAULT_AGENT_ID);
}
