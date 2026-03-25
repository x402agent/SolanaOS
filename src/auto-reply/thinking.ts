const THINKING_TAGS = ["thinking", "analysis", "reasoning"];

export function extractThinkingContent(text: string): { thinking: string | null; visible: string } {
  const source = String(text);
  const matches = THINKING_TAGS.flatMap((tag) =>
    [...source.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "gi"))],
  );
  const thinking = matches.map((match) => match[1]?.trim()).filter(Boolean).join("\n\n");
  return {
    thinking: thinking || null,
    visible: stripThinkingTags(source).trim(),
  };
}
export function stripThinkingTags(text: string): string {
  let output = String(text);
  for (const tag of THINKING_TAGS) {
    output = output.replace(new RegExp(`<${tag}>[\\s\\S]*?<\\/${tag}>`, "gi"), "");
  }
  return output;
}
export const THINKING_LEVELS = ["off", "low", "medium", "high"] as const;
export type ThinkingLevel = (typeof THINKING_LEVELS)[number];

export function formatThinkingLevels(): string {
  return THINKING_LEVELS.join(", ");
}
export function normalizeThinkLevel(raw: string): ThinkingLevel {
  const lower = raw.toLowerCase().trim();
  if (THINKING_LEVELS.includes(lower as ThinkingLevel)) return lower as ThinkingLevel;
  if (lower === "none") return "off";
  return "off";
}
export function normalizeVerboseLevel(raw: string): "on" | "off" {
  return raw.toLowerCase() === "on" ? "on" : "off";
}
export function resolveThinkingDefaultForModel(model: string): ThinkingLevel {
  const normalized = model.trim().toLowerCase();
  if (!normalized) return "off";
  if (normalized.includes("minimax") || normalized.includes("claude") || normalized.includes("grok")) {
    return "medium";
  }
  return "off";
}
