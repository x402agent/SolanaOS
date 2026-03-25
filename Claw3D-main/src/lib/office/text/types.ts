export type MockTextMessagePhase = "needs_message" | "ready_to_send";

export type MockTextMessageScenario = {
  phase: MockTextMessagePhase;
  recipient: string;
  messageText: string | null;
  confirmationText: string | null;
  promptText: string | null;
  statusLine: string;
};
