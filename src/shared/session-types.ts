import type { UsageSummary } from "./usage-types";

export interface SessionSummary {
  key: string;
  displayName?: string;
  label?: string;
  kind?: string;
  agentId?: string;
  model?: string;
  channel?: string;
  provider?: string;
  createdAt?: string;
  updatedAt?: string;
  messageCount?: number;
  tokenCount?: number;
  totalCost?: number;
  status?: string;
  usage?: Partial<UsageSummary>;
  metadata?: Record<string, unknown>;
  lastMessageAt?: string;
}
export interface SessionListEntry extends SessionSummary {
  isGlobal?: boolean;
}
export type SessionsListResult = {
  sessions: SessionListEntry[];
  count: number;
};
