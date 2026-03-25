import { describe, expect, it } from "vitest";

import { mergePendingLivePatch } from "@/features/agents/state/livePatchQueue";

describe("mergePendingLivePatch", () => {
  it("replaces pending patch when incoming runId differs", () => {
    const merged = mergePendingLivePatch(
      {
        runId: "run-old",
        streamText: "old text",
        thinkingTrace: "old trace",
        status: "running",
      },
      {
        runId: "run-new",
        thinkingTrace: "new trace",
        status: "running",
      }
    );

    expect(merged).toEqual({
      runId: "run-new",
      thinkingTrace: "new trace",
      status: "running",
    });
  });

  it("drops stale live text when incoming patch introduces runId", () => {
    const merged = mergePendingLivePatch(
      {
        streamText: "old text",
        thinkingTrace: "old trace",
        runStartedAt: 100,
      },
      {
        runId: "run-2",
        thinkingTrace: "new trace",
        status: "running",
      }
    );

    expect(merged).toEqual({
      runStartedAt: 100,
      runId: "run-2",
      thinkingTrace: "new trace",
      status: "running",
    });
  });

  it("merges same-run patches normally", () => {
    const merged = mergePendingLivePatch(
      {
        runId: "run-1",
        thinkingTrace: "thinking",
      },
      {
        runId: "run-1",
        streamText: "answer",
      }
    );

    expect(merged).toEqual({
      runId: "run-1",
      thinkingTrace: "thinking",
      streamText: "answer",
    });
  });
});
