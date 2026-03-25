import { NextResponse } from "next/server";

import { transcribeVoiceWithSolanaOS } from "@/lib/solanaos/voiceTranscription";

export const runtime = "nodejs";

const MAX_VOICE_UPLOAD_BYTES = 20 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const audio = formData.get("audio");
    if (!(audio instanceof File)) {
      return NextResponse.json({ error: "audio file is required." }, { status: 400 });
    }

    const arrayBuffer = await audio.arrayBuffer();
    const byteLength = arrayBuffer.byteLength;
    if (byteLength <= 0) {
      return NextResponse.json({ error: "Audio upload is empty." }, { status: 400 });
    }
    if (byteLength > MAX_VOICE_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: `Audio upload exceeds the ${MAX_VOICE_UPLOAD_BYTES} byte limit.` },
        { status: 400 },
      );
    }

    const result = await transcribeVoiceWithSolanaOS({
      buffer: Buffer.from(arrayBuffer),
      fileName: audio.name,
      mimeType: audio.type,
    });

    return NextResponse.json({
      transcript: result.transcript,
      provider: result.provider,
      model: result.model,
      decision: result.decision,
      ignored: result.ignored,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to transcribe audio.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
