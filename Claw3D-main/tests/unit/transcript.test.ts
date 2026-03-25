import { describe, expect, it } from "vitest";

import {
  buildOutputLinesFromTranscriptEntries,
  createTranscriptEntryFromLine,
  mergeTranscriptEntriesWithHistory,
  sortTranscriptEntries,
  type TranscriptEntry,
} from "@/features/agents/state/transcript";

const createEntry = (params: {
  line: string;
  sessionKey?: string;
  source: "local-send" | "runtime-chat" | "runtime-agent" | "history" | "legacy";
  sequence: number;
  timestampMs?: number;
  runId?: string | null;
  role?: "user" | "assistant" | "tool" | "system" | "other";
  kind?: "meta" | "user" | "assistant" | "thinking" | "tool";
  confirmed?: boolean;
  entryId?: string;
}): TranscriptEntry => {
  const entry = createTranscriptEntryFromLine({
    line: params.line,
    sessionKey: params.sessionKey ?? "agent:agent-1:studio:test-session",
    source: params.source,
    sequenceKey: params.sequence,
    timestampMs: params.timestampMs,
    runId: params.runId,
    role: params.role,
    kind: params.kind,
    confirmed: params.confirmed,
    entryId: params.entryId,
  });
  if (!entry) {
    throw new Error("Expected transcript entry");
  }
  return entry;
};

describe("transcript", () => {
  it("orders local user turns before assistant text at equal timestamps", () => {
    const entries = sortTranscriptEntries([
      createEntry({
        line: "assistant reply",
        source: "runtime-chat",
        sequence: 2,
        timestampMs: 1000,
        role: "assistant",
        kind: "assistant",
      }),
      createEntry({
        line: "> hello",
        source: "local-send",
        sequence: 1,
        timestampMs: 1000,
        role: "user",
        kind: "user",
      }),
    ]);

    expect(buildOutputLinesFromTranscriptEntries(entries)).toEqual(["> hello", "assistant reply"]);
  });

  it("keeps sequence order when only one entry has a timestamp", () => {
    const entries = sortTranscriptEntries([
      createEntry({
        line: "assistant reply",
        source: "runtime-chat",
        sequence: 1,
        role: "assistant",
        kind: "assistant",
      }),
      createEntry({
        line: "> hello",
        source: "local-send",
        sequence: 2,
        timestampMs: 1_000,
        role: "user",
        kind: "user",
      }),
    ]);

    expect(buildOutputLinesFromTranscriptEntries(entries)).toEqual([
      "assistant reply",
      "> hello",
    ]);
  });

  it("keeps sequence order when entries share the same timestamp", () => {
    const entries = sortTranscriptEntries([
      createEntry({
        line: "assistant reply",
        source: "runtime-chat",
        sequence: 1,
        timestampMs: 1_000,
        role: "assistant",
        kind: "assistant",
      }),
      createEntry({
        line: "> hello",
        source: "local-send",
        sequence: 2,
        timestampMs: 1_000,
        role: "user",
        kind: "user",
      }),
    ]);

    expect(buildOutputLinesFromTranscriptEntries(entries)).toEqual([
      "assistant reply",
      "> hello",
    ]);
  });

  it("keeps assistant thinking blocks together when timestamps tie", () => {
    const entries = sortTranscriptEntries([
      createEntry({
        line: "_plan_",
        source: "runtime-chat",
        sequence: 1,
        timestampMs: 2_000,
        role: "assistant",
        kind: "thinking",
      }),
      createEntry({
        line: "answer",
        source: "runtime-chat",
        sequence: 2,
        timestampMs: 2_000,
        role: "assistant",
        kind: "assistant",
      }),
      createEntry({
        line: "> next question",
        source: "local-send",
        sequence: 3,
        timestampMs: 2_000,
        role: "user",
        kind: "user",
      }),
    ]);

    expect(buildOutputLinesFromTranscriptEntries(entries)).toEqual([
      "_plan_",
      "answer",
      "> next question",
    ]);
  });

  it("merges history entries by confirming optimistic local entries", () => {
    const existing = [
      createEntry({
        line: "> hello",
        source: "local-send",
        sequence: 1,
        timestampMs: 1000,
        role: "user",
        kind: "user",
        confirmed: false,
      }),
      createEntry({
        line: "assistant reply",
        source: "runtime-chat",
        sequence: 2,
        timestampMs: 1500,
        role: "assistant",
        kind: "assistant",
        confirmed: false,
      }),
    ];

    const history = [
      createEntry({
        line: "> hello",
        source: "history",
        sequence: 10,
        timestampMs: 1000,
        role: "user",
        kind: "user",
        confirmed: true,
        entryId: "history:hello",
      }),
      createEntry({
        line: "assistant reply",
        source: "history",
        sequence: 11,
        timestampMs: 1500,
        role: "assistant",
        kind: "assistant",
        confirmed: true,
        entryId: "history:reply",
      }),
    ];

    const merged = mergeTranscriptEntriesWithHistory({
      existingEntries: existing,
      historyEntries: history,
    });

    expect(merged.entries).toHaveLength(2);
    expect(merged.confirmedCount).toBe(2);
    expect(merged.mergedCount).toBe(0);
    expect(merged.entries.every((entry) => entry.confirmed)).toBe(true);
  });

  it("reconciles history replay against an already confirmed runtime assistant entry", () => {
    const existing = [
      createEntry({
        line: "previous assistant answer",
        source: "runtime-chat",
        sequence: 20,
        timestampMs: 2_000,
        role: "assistant",
        kind: "assistant",
        runId: "run-previous",
        confirmed: true,
        entryId: "run:run-previous:assistant:final",
      }),
    ];

    const history = [
      createEntry({
        line: "previous assistant answer",
        source: "history",
        sequence: 50,
        timestampMs: 2_000,
        role: "assistant",
        kind: "assistant",
        confirmed: true,
        entryId: "history:assistant:previous",
      }),
    ];

    const merged = mergeTranscriptEntriesWithHistory({
      existingEntries: existing,
      historyEntries: history,
    });

    expect(buildOutputLinesFromTranscriptEntries(merged.entries)).toEqual([
      "previous assistant answer",
    ]);
    expect(merged.entries).toHaveLength(1);
    expect(merged.mergedCount).toBe(0);
    expect(merged.confirmedCount).toBe(1);
  });

  it("matches each existing assistant candidate at most once per merge pass", () => {
    const existing = [
      createEntry({
        line: "same assistant answer",
        source: "runtime-chat",
        sequence: 20,
        timestampMs: 2_000,
        role: "assistant",
        kind: "assistant",
        runId: "run-previous",
        confirmed: true,
        entryId: "run:run-previous:assistant:final",
      }),
    ];

    const history = [
      createEntry({
        line: "same assistant answer",
        source: "history",
        sequence: 50,
        timestampMs: 2_000,
        role: "assistant",
        kind: "assistant",
        confirmed: true,
        entryId: "history:assistant:1",
      }),
      createEntry({
        line: "same assistant answer",
        source: "history",
        sequence: 51,
        timestampMs: 2_000,
        role: "assistant",
        kind: "assistant",
        confirmed: true,
        entryId: "history:assistant:2",
      }),
    ];

    const merged = mergeTranscriptEntriesWithHistory({
      existingEntries: existing,
      historyEntries: history,
    });

    expect(buildOutputLinesFromTranscriptEntries(merged.entries)).toEqual([
      "same assistant answer",
      "same assistant answer",
    ]);
    expect(merged.entries).toHaveLength(2);
    expect(merged.confirmedCount).toBe(1);
    expect(merged.mergedCount).toBe(1);
  });

  it("keeps repeated identical messages as separate entries", () => {
    const existing = [
      createEntry({
        line: "> ping",
        source: "local-send",
        sequence: 1,
        timestampMs: 1000,
        role: "user",
        kind: "user",
        confirmed: false,
        entryId: "local:1",
      }),
      createEntry({
        line: "> ping",
        source: "local-send",
        sequence: 2,
        timestampMs: 3000,
        role: "user",
        kind: "user",
        confirmed: false,
        entryId: "local:2",
      }),
    ];

    const history = [
      createEntry({
        line: "> ping",
        source: "history",
        sequence: 10,
        timestampMs: 1000,
        role: "user",
        kind: "user",
        confirmed: true,
        entryId: "history:1",
      }),
      createEntry({
        line: "> ping",
        source: "history",
        sequence: 11,
        timestampMs: 3000,
        role: "user",
        kind: "user",
        confirmed: true,
        entryId: "history:2",
      }),
    ];

    const merged = mergeTranscriptEntriesWithHistory({
      existingEntries: existing,
      historyEntries: history,
    });

    expect(merged.entries).toHaveLength(2);
    expect(buildOutputLinesFromTranscriptEntries(merged.entries)).toEqual(["> ping", "> ping"]);
    expect(merged.entries[0]?.timestampMs).toBe(1000);
    expect(merged.entries[1]?.timestampMs).toBe(3000);
  });

  it("reports conflicts when multiple optimistic candidates are possible", () => {
    const existing = [
      createEntry({
        line: "> hello",
        source: "local-send",
        sequence: 1,
        timestampMs: 1000,
        role: "user",
        kind: "user",
        confirmed: false,
        entryId: "local:a",
      }),
      createEntry({
        line: "> hello",
        source: "local-send",
        sequence: 2,
        timestampMs: 1000,
        role: "user",
        kind: "user",
        confirmed: false,
        entryId: "local:b",
      }),
    ];

    const history = [
      createEntry({
        line: "> hello",
        source: "history",
        sequence: 10,
        timestampMs: 1000,
        role: "user",
        kind: "user",
        confirmed: true,
        entryId: "history:hello",
      }),
    ];

    const merged = mergeTranscriptEntriesWithHistory({
      existingEntries: existing,
      historyEntries: history,
    });

    expect(merged.conflictCount).toBe(1);
    expect(merged.entries).toHaveLength(2);
    const confirmed = merged.entries.filter((entry) => entry.confirmed);
    expect(confirmed).toHaveLength(1);
  });

  it("matches history entries even when local and gateway clocks are far apart", () => {
    const existing = [
      createEntry({
        line: "> hello",
        source: "local-send",
        sequence: 1,
        timestampMs: 1_000,
        role: "user",
        kind: "user",
        confirmed: false,
        entryId: "local:hello",
      }),
    ];

    const history = [
      createEntry({
        line: "> hello",
        source: "history",
        sequence: 10,
        timestampMs: 600_000,
        role: "user",
        kind: "user",
        confirmed: true,
        entryId: "history:hello",
      }),
    ];

    const merged = mergeTranscriptEntriesWithHistory({
      existingEntries: existing,
      historyEntries: history,
    });

    expect(merged.entries).toHaveLength(1);
    expect(merged.entries[0]?.confirmed).toBe(true);
    expect(merged.entries[0]?.timestampMs).toBe(600_000);
  });

  it("prefers canonical history timestamps to preserve final message order", () => {
    const existing = [
      createEntry({
        line: "> hello",
        source: "local-send",
        sequence: 1,
        timestampMs: 10_000,
        role: "user",
        kind: "user",
        confirmed: false,
        entryId: "local:user",
      }),
      createEntry({
        line: "assistant reply",
        source: "runtime-chat",
        sequence: 2,
        timestampMs: 5_000,
        role: "assistant",
        kind: "assistant",
        confirmed: false,
        entryId: "local:assistant",
      }),
    ];

    const history = [
      createEntry({
        line: "> hello",
        source: "history",
        sequence: 10,
        timestampMs: 1_000,
        role: "user",
        kind: "user",
        confirmed: true,
        entryId: "history:user",
      }),
      createEntry({
        line: "assistant reply",
        source: "history",
        sequence: 11,
        timestampMs: 2_000,
        role: "assistant",
        kind: "assistant",
        confirmed: true,
        entryId: "history:assistant",
      }),
    ];

    const merged = mergeTranscriptEntriesWithHistory({
      existingEntries: existing,
      historyEntries: history,
    });

    expect(buildOutputLinesFromTranscriptEntries(merged.entries)).toEqual([
      "> hello",
      "assistant reply",
    ]);
    expect(merged.entries[0]?.timestampMs).toBe(1_000);
    expect(merged.entries[1]?.timestampMs).toBe(2_000);
  });
});
