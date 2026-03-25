export type StandupPhase = "scheduled" | "gathering" | "in_progress" | "complete";

export type StandupSourceKind = "github" | "jira" | "manual";

export type StandupTriggerKind = "manual" | "scheduled";

export type StandupAgentSnapshot = {
  agentId: string;
  name: string;
  latestPreview?: string | null;
  lastUserMessage?: string | null;
};

export type StandupManualEntry = {
  jiraAssignee: string | null;
  currentTask: string;
  blockers: string;
  note: string;
  updatedAt: string | null;
};

export type StandupTicketSummary = {
  id: string;
  key: string;
  title: string;
  status: string;
  url: string | null;
};

export type StandupCommitSummary = {
  id: string;
  title: string;
  subtitle: string | null;
  url: string | null;
};

export type StandupSourceState = {
  kind: StandupSourceKind;
  ready: boolean;
  stale: boolean;
  updatedAt: string | null;
  error: string | null;
};

export type StandupSummaryCard = {
  agentId: string;
  agentName: string;
  speech: string;
  currentTask: string;
  blockers: string[];
  recentCommits: StandupCommitSummary[];
  activeTickets: StandupTicketSummary[];
  manualNotes: string[];
  sourceStates: StandupSourceState[];
};

export type StandupMeeting = {
  id: string;
  trigger: StandupTriggerKind;
  phase: StandupPhase;
  scheduledFor: string | null;
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
  currentSpeakerAgentId: string | null;
  speakerStartedAt: string | null;
  speakerDurationMs: number;
  participantOrder: string[];
  arrivedAgentIds: string[];
  cards: StandupSummaryCard[];
};

export type StandupMeetingStore = {
  activeMeeting: StandupMeeting | null;
  lastMeeting: StandupMeeting | null;
};

export type StandupJiraConfig = {
  enabled: boolean;
  baseUrl: string;
  email: string;
  apiToken: string;
  projectKey: string;
  jql: string;
};

export type StandupScheduleConfig = {
  enabled: boolean;
  cronExpr: string;
  timezone: string;
  speakerSeconds: number;
  autoOpenBoard: boolean;
  lastAutoRunAt: string | null;
};

export type StandupConfig = {
  schedule: StandupScheduleConfig;
  jira: StandupJiraConfig;
  manualByAgentId: Record<string, StandupManualEntry>;
};

export type StandupConfigPayload = {
  gatewayUrl: string;
  config: StandupConfig;
};

export type StandupMeetingPayload = {
  meeting: StandupMeeting | null;
};
