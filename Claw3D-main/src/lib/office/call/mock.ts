import type { MockPhoneCallScenario } from "@/lib/office/call/types";

const normalizeWhitespace = (value: string | null | undefined): string =>
  (value ?? "").replace(/\s+/g, " ").trim();

const titleCase = (value: string): string =>
  value.replace(/\b([a-z])([a-z']*)/g, (_, first: string, rest: string) => {
    return `${first.toUpperCase()}${rest}`;
  });

const isPhoneNumberLike = (value: string): boolean => /[\d+]/.test(value);

const formatCalleeLabel = (callee: string): string => {
  const normalized = normalizeWhitespace(callee).toLowerCase();
  if (!normalized) return "your contact";
  if (normalized === "my wife") return "your wife";
  if (normalized === "my husband") return "your husband";
  if (normalized === "my mom") return "your mom";
  if (normalized === "my dad") return "your dad";
  if (isPhoneNumberLike(normalized)) return normalized;
  return titleCase(normalized);
};

const buildPromptText = (calleeLabel: string): string =>
  `What should I say to ${calleeLabel}?`;

const DEMO_DIAL_NUMBER = "973-619-4672";

const resolveDialNumber = (): string => DEMO_DIAL_NUMBER;

const buildSpokenText = (message: string): string =>
  `Hi, this is Luke assistant. He told me to tell you ${message}. Thank you.`;

const buildRecipientReply = (message: string): string => {
  const normalized = normalizeWhitespace(message).toLowerCase();
  if (normalized.includes("late for dinner")) {
    return "Okay, thanks for letting me know.";
  }
  if (normalized.includes("on my way")) return "Okay, see you soon.";
  if (normalized.includes("love you")) return "Love you too. Talk soon.";
  if (normalized.includes("be there")) return "Sounds good. I will be ready.";
  if (normalized.includes("running late")) return "Thanks for letting me know.";
  return "Got it. I will pass that along on this mock line.";
};

export const buildMockPhoneCallScenario = (params: {
  callee: string;
  message?: string | null;
  voiceAvailable: boolean;
}): MockPhoneCallScenario => {
  const calleeLabel = formatCalleeLabel(params.callee);
  const dialNumber = resolveDialNumber();
  const message = normalizeWhitespace(params.message);
  if (!message) {
    return {
      phase: "needs_message",
      callee: calleeLabel,
      dialNumber,
      promptText: buildPromptText(calleeLabel),
      spokenText: null,
      recipientReply: null,
      statusLine: `Waiting for your message to ${calleeLabel}.`,
      voiceAvailable: params.voiceAvailable,
    };
  }
  return {
    phase: "ready_to_call",
    callee: calleeLabel,
    dialNumber,
    promptText: null,
    spokenText: buildSpokenText(message),
    recipientReply: buildRecipientReply(message),
    statusLine: `Connected to ${calleeLabel}.`,
    voiceAvailable: params.voiceAvailable,
  };
};
