import type { MockTextMessageScenario } from "@/lib/office/text/types";

const normalizeWhitespace = (value: string | null | undefined): string =>
  (value ?? "").replace(/\s+/g, " ").trim();

const titleCase = (value: string): string =>
  value.replace(/\b([a-z])([a-z']*)/g, (_, first: string, rest: string) => {
    return `${first.toUpperCase()}${rest}`;
  });

const formatRecipientLabel = (recipient: string): string => {
  const normalized = normalizeWhitespace(recipient).toLowerCase();
  if (!normalized) return "your contact";
  if (normalized === "my wife") return "your wife";
  if (normalized === "my husband") return "your husband";
  if (normalized === "my mom") return "your mom";
  if (normalized === "my dad") return "your dad";
  return titleCase(normalized);
};

const buildPromptText = (recipientLabel: string): string =>
  `What should I message ${recipientLabel}?`;

const buildConfirmationText = (message: string): string => {
  const normalized = normalizeWhitespace(message).toLowerCase();
  if (normalized.includes("late for the soccer game")) {
    return "No worries, thanks for the heads up.";
  }
  if (normalized.includes("running late")) {
    return "Thanks for letting me know.";
  }
  if (normalized.includes("on my way")) {
    return "Perfect, see you soon.";
  }
  if (normalized.includes("be there")) {
    return "Sounds good.";
  }
  return "Delivered.";
};

export const buildMockTextMessageScenario = (params: {
  recipient: string;
  message?: string | null;
}): MockTextMessageScenario => {
  const recipientLabel = formatRecipientLabel(params.recipient);
  const message = normalizeWhitespace(params.message);
  if (!message) {
    return {
      phase: "needs_message",
      recipient: recipientLabel,
      messageText: null,
      confirmationText: null,
      promptText: buildPromptText(recipientLabel),
      statusLine: `Waiting for your message to ${recipientLabel}.`,
    };
  }
  return {
    phase: "ready_to_send",
    recipient: recipientLabel,
    messageText: message,
    confirmationText: buildConfirmationText(message),
    promptText: null,
    statusLine: `Text queued for ${recipientLabel}.`,
  };
};
