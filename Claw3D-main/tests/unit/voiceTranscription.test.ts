import { describe, expect, it } from "vitest";

import {
  buildVoiceTranscriptionErrorMessage,
  inferVoiceFileExtension,
  normalizeVoiceMimeType,
  sanitizeVoiceFileName,
  shouldIgnoreVoiceTranscription,
} from "@/lib/solanaos/voiceTranscription";

describe("voiceTranscription", () => {
  it("normalizes supported audio mime types", () => {
    expect(normalizeVoiceMimeType("audio/webm;codecs=opus")).toBe("audio/webm");
    expect(normalizeVoiceMimeType("audio/mp4")).toBe("audio/mp4");
    expect(normalizeVoiceMimeType("text/plain")).toBe("audio/webm");
  });

  it("infers a file extension from the file name or mime type", () => {
    expect(inferVoiceFileExtension("note.m4a", "audio/webm")).toBe(".m4a");
    expect(inferVoiceFileExtension("note", "audio/ogg")).toBe(".ogg");
    expect(inferVoiceFileExtension("", undefined)).toBe(".webm");
  });

  it("sanitizes uploaded voice file names", () => {
    expect(sanitizeVoiceFileName(" My Voice Note!!.webm ", "audio/webm")).toBe("my-voice-note.webm");
    expect(sanitizeVoiceFileName("../voice memo", "audio/mp4")).toBe("voice-memo.m4a");
  });

  it("builds helpful fallback transcription errors", () => {
    expect(
      buildVoiceTranscriptionErrorMessage({
        outcome: "skipped",
        attachments: [{ attempts: [{ reason: "No audio model succeeded." }] }],
      }),
    ).toContain("No audio model succeeded.");
    expect(buildVoiceTranscriptionErrorMessage({ outcome: "disabled" })).toContain("disabled");
  });

  it("ignores silent transcription results that return no text", () => {
    expect(
      shouldIgnoreVoiceTranscription({
        transcript: "",
        decision: {
          outcome: "skipped",
          attachments: [{ attempts: [{ reason: "Audio transcription response missing text" }] }],
        },
      }),
    ).toBe(true);
    expect(
      shouldIgnoreVoiceTranscription({
        transcript: "hello there",
        decision: {
          outcome: "skipped",
          attachments: [{ attempts: [{ reason: "Audio transcription response missing text" }] }],
        },
      }),
    ).toBe(false);
  });
});
