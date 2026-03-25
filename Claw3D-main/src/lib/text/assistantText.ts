export const normalizeAssistantDisplayText = (value: string): string => {
  const lines = value.replace(/\r\n?/g, "\n").split("\n");
  const normalized: string[] = [];
  let lastWasBlank = false;
  for (const rawLine of lines) {
    const line = rawLine.replace(/[ \t]+$/g, "");
    if (line.trim().length === 0) {
      if (lastWasBlank) continue;
      normalized.push("");
      lastWasBlank = true;
      continue;
    }
    normalized.push(line);
    lastWasBlank = false;
  }
  return normalized.join("\n").trim();
};
