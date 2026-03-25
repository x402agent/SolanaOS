const OPEN_ENVELOPE = /<assistant-visible>/gi;
const CLOSE_ENVELOPE = /<\/assistant-visible>/gi;

export function stripEnvelope(text: string): string {
  return String(text)
    .replace(OPEN_ENVELOPE, "")
    .replace(CLOSE_ENVELOPE, "")
    .trim();
}
export function wrapEnvelope(text: string): string {
  const visible = stripEnvelope(text);
  return visible ? `<assistant-visible>${visible}</assistant-visible>` : "";
}
