// Stub: types-shared (cron)
export interface CronJobBase {
  id: string;
  name: string;
  schedule: string;
  enabled: boolean;
  agentId?: string;
  prompt: string;
  channel?: string;
  model?: string;
  lastRunAt?: number;
  nextRunAt?: number;
}
