const TEMP_SKILL_AGENT_RE = /^Skill (Installer|Remover) (\d{13})$/;

const STALE_TEMP_SKILL_AGENT_MS = 15 * 60 * 1000;

export const isTemporarySkillAgentName = (value: string | null | undefined): boolean => {
  const trimmed = value?.trim() ?? "";
  return TEMP_SKILL_AGENT_RE.test(trimmed);
};

export const resolveTemporarySkillAgentCreatedAt = (
  value: string | null | undefined
): number | null => {
  const trimmed = value?.trim() ?? "";
  const match = TEMP_SKILL_AGENT_RE.exec(trimmed);
  if (!match) return null;
  const timestamp = Number.parseInt(match[2], 10);
  return Number.isFinite(timestamp) ? timestamp : null;
};

export const isStaleTemporarySkillAgentName = (
  value: string | null | undefined,
  nowMs: number = Date.now()
): boolean => {
  const createdAt = resolveTemporarySkillAgentCreatedAt(value);
  if (createdAt === null) return false;
  return nowMs - createdAt >= STALE_TEMP_SKILL_AGENT_MS;
};
