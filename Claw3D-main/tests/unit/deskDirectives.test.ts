import { describe, expect, it } from "vitest";

import type { TranscriptEntry } from "@/features/agents/state/transcript";
import {
  reduceOfficeDeskHoldState,
  reduceOfficeQaHoldState,
  resolveOfficeIntentSnapshot,
  resolveOfficeDeskDirective,
  resolveOfficeQaDirective,
} from "@/lib/office/deskDirectives";

const createUserEntry = (
  text: string,
  sequenceKey: number,
): TranscriptEntry => ({
  entryId: `entry-${sequenceKey}`,
  role: "user",
  kind: "user",
  text,
  sessionKey: "agent:agent-1:studio:test",
  runId: null,
  source: "history",
  timestampMs: sequenceKey * 1_000,
  sequenceKey,
  confirmed: true,
  fingerprint: `fp-${sequenceKey}`,
});

describe("deskDirectives", () => {
  it("recognizes desk and release directives", () => {
    expect(resolveOfficeDeskDirective("Go to your desk.")).toBe("desk");
    expect(resolveOfficeDeskDirective("Please head to your desk now.")).toBe("desk");
    expect(resolveOfficeDeskDirective("Go back to the desk.")).toBe("desk");
    expect(resolveOfficeDeskDirective("> ok you can leave the desk")).toBe("release");
    expect(resolveOfficeDeskDirective("go on a walk")).toBe("release");
    expect(resolveOfficeDeskDirective("you can leave your desk now")).toBe("release");
    expect(resolveOfficeDeskDirective("go to walk")).toBe("release");
  });

  it("builds a unified office intent snapshot", () => {
    expect(resolveOfficeIntentSnapshot("Let's go to the gym.")).toMatchObject({
      gym: { directive: "gym", source: "manual" },
      desk: null,
      standup: null,
    });
    expect(resolveOfficeIntentSnapshot("lets have a scrum meeting")).toMatchObject({
      standup: "standup",
      gym: null,
      qa: null,
    });
  });

  it("keeps the desk hold through unrelated messages", () => {
    expect(
      reduceOfficeDeskHoldState({
        currentHeld: true,
        lastUserMessage: "Can you summarize that for me?",
        transcriptEntries: undefined,
      }),
    ).toBe(true);
  });

  it("rebuilds the desk hold from transcript history", () => {
    expect(
      reduceOfficeDeskHoldState({
        currentHeld: false,
        lastUserMessage: "What did you finish?",
        transcriptEntries: [
          createUserEntry("> Go to your desk.", 1),
          createUserEntry("> What did you finish?", 2),
        ],
      }),
    ).toBe(true);
  });

  it("clears the desk hold when a release directive arrives", () => {
    expect(
      reduceOfficeDeskHoldState({
        currentHeld: true,
        lastUserMessage: "ok you can leave the desk",
        transcriptEntries: [createUserEntry("> Go to your desk.", 1)],
      }),
    ).toBe(false);
  });

  it("recognizes QA lab directives and releases", () => {
    expect(resolveOfficeQaDirective("Please write tests for this flow.")).toBe("qa_lab");
    expect(resolveOfficeQaDirective("Can you run tests and verify it?")).toBe(
      "qa_lab",
    );
    expect(resolveOfficeQaDirective("Reproduce this bug in the QA room.")).toBe(
      "qa_lab",
    );
    expect(resolveOfficeQaDirective("done testing")).toBe("release");
    expect(resolveOfficeQaDirective("leave the QA lab")).toBe("release");
  });

  it("rebuilds the QA lab hold from transcript history", () => {
    expect(
      reduceOfficeQaHoldState({
        currentHeld: false,
        lastUserMessage: "What failed?",
        transcriptEntries: [
          createUserEntry("> Run tests in the QA lab.", 1),
          createUserEntry("> What failed?", 2),
        ],
      }),
    ).toBe(true);
  });

  it("clears the QA lab hold when a release directive arrives", () => {
    expect(
      reduceOfficeQaHoldState({
        currentHeld: true,
        lastUserMessage: "stop testing",
        transcriptEntries: [createUserEntry("> Run tests in the QA lab.", 1)],
      }),
    ).toBe(false);
  });
});
