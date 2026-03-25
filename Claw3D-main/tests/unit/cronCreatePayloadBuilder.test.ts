import { describe, expect, it } from "vitest";

import {
  buildCronJobCreateInput,
  type CronCreateDraft,
} from "@/lib/cron/createPayloadBuilder";

describe("cron create payload builder", () => {
  it("builds_agent_scoped_isolated_every_days_payload_with_anchor", () => {
    const nowMs = Date.UTC(2026, 1, 11, 6, 30, 0);
    const draft: CronCreateDraft = {
      templateId: "morning-brief",
      name: "Morning brief",
      taskText: "Summarize overnight updates and priorities.",
      scheduleKind: "every",
      everyAmount: 1,
      everyUnit: "days",
      everyAtTime: "07:00",
      everyTimeZone: "UTC",
    };

    const input = buildCronJobCreateInput("agent-1", draft, nowMs);

    expect(input).toEqual({
      name: "Morning brief",
      agentId: "agent-1",
      enabled: true,
      schedule: {
        kind: "every",
        everyMs: 86_400_000,
        anchorMs: Date.UTC(2026, 1, 11, 7, 0, 0),
      },
      sessionTarget: "isolated",
      wakeMode: "now",
      payload: {
        kind: "agentTurn",
        message: "Summarize overnight updates and priorities.",
      },
      delivery: { mode: "none" },
    });
  });

  it("builds_main_system_event_payload_when_advanced_mode_selected", () => {
    const draft: CronCreateDraft = {
      templateId: "reminder",
      name: "Standup reminder",
      taskText: "Reminder: standup starts in 10 minutes.",
      scheduleKind: "every",
      everyAmount: 30,
      everyUnit: "minutes",
      advancedSessionTarget: "main",
      advancedWakeMode: "next-heartbeat",
    };

    const input = buildCronJobCreateInput("agent-2", draft);

    expect(input).toEqual({
      name: "Standup reminder",
      agentId: "agent-2",
      enabled: true,
      schedule: { kind: "every", everyMs: 1_800_000 },
      sessionTarget: "main",
      wakeMode: "next-heartbeat",
      payload: {
        kind: "systemEvent",
        text: "Reminder: standup starts in 10 minutes.",
      },
    });
  });

  it("rejects_invalid_one_time_schedule_input", () => {
    const draft: CronCreateDraft = {
      templateId: "custom",
      name: "One time",
      taskText: "Run once later.",
      scheduleKind: "at",
      scheduleAt: "not-a-date",
    };

    expect(() => buildCronJobCreateInput("agent-1", draft)).toThrow("Invalid run time.");
  });

  it("rejects_invalid_interval_amount_for_every_schedule", () => {
    const draft: CronCreateDraft = {
      templateId: "custom",
      name: "Invalid interval",
      taskText: "Run repeatedly.",
      scheduleKind: "every",
      everyAmount: 0,
      everyUnit: "minutes",
    };

    expect(() => buildCronJobCreateInput("agent-1", draft)).toThrow("Invalid interval amount.");
  });

  it("rejects_every_days_without_time", () => {
    const draft: CronCreateDraft = {
      templateId: "custom",
      name: "Daily report",
      taskText: "Compile report.",
      scheduleKind: "every",
      everyAmount: 1,
      everyUnit: "days",
      everyTimeZone: "UTC",
    };

    expect(() => buildCronJobCreateInput("agent-1", draft)).toThrow(
      "Daily schedule time is required."
    );
  });

  it("rejects_invalid_timezone_for_every_days", () => {
    const draft: CronCreateDraft = {
      templateId: "custom",
      name: "Daily report",
      taskText: "Compile report.",
      scheduleKind: "every",
      everyAmount: 1,
      everyUnit: "days",
      everyAtTime: "07:00",
      everyTimeZone: "Mars/OlympusMons",
    };

    expect(() => buildCronJobCreateInput("agent-1", draft)).toThrow("Invalid timezone.");
  });
});
