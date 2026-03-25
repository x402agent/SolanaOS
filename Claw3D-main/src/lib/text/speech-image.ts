const BACKTICK_IMAGE_RE = /`([^`]+\.(?:png|jpe?g|gif|webp))`/i;

export type SpeechImageResult = {
  cleanText: string;
  imageUrl: string | null;
};

/**
 * Detects backtick-wrapped image file paths in agent speech text, returns a
 * cleaned version of the text (without the raw paths) and a media-API URL
 * for the first matched image.
 */
export function extractSpeechImage(
  text: string | null | undefined,
  agentId: string,
): SpeechImageResult {
  const raw = text?.trim() ?? "";
  if (!raw) return { cleanText: raw, imageUrl: null };

  const match = raw.match(BACKTICK_IMAGE_RE);
  if (!match?.[1]) return { cleanText: raw, imageUrl: null };

  const imagePath = match[1].trim();

  let fullPath: string;
  if (imagePath.startsWith("/") || imagePath.startsWith("~/")) {
    fullPath = imagePath;
  } else {
    fullPath = `~/.solanaos/workspace-${agentId}/${imagePath}`;
  }

  const imageUrl = `/api/gateway/media?path=${encodeURIComponent(fullPath)}`;

  // Strip all backtick-wrapped segments and tidy up leftover punctuation.
  const cleanText = raw
    .replace(/`[^`]+`/g, "")
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/:\s*\./g, ".")
    .replace(/\s+/g, " ")
    .trim();

  return { cleanText: cleanText || raw, imageUrl };
}
