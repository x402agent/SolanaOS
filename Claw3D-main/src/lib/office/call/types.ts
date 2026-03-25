export type MockPhoneCallPhase = "needs_message" | "ready_to_call";

export type MockPhoneCallScenario = {
  phase: MockPhoneCallPhase;
  callee: string;
  dialNumber: string;
  promptText: string | null;
  spokenText: string | null;
  recipientReply: string | null;
  statusLine: string;
  voiceAvailable: boolean;
};
