import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type VoiceSendPayload = {
  blob: Blob;
  mimeType: string;
  fileName: string;
};

export type VoiceRecorderState = "idle" | "requesting" | "recording" | "transcribing";

const PREFERRED_VOICE_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
] as const;

const resolveVoiceExtension = (mimeType: string): string => {
  const normalized = mimeType.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  switch (normalized) {
    case "audio/mp4":
      return ".m4a";
    case "audio/mpeg":
      return ".mp3";
    case "audio/ogg":
      return ".ogg";
    case "audio/wav":
    case "audio/x-wav":
      return ".wav";
    default:
      return ".webm";
  }
};

const resolvePreferredVoiceMimeType = (): string => {
  if (typeof MediaRecorder === "undefined") return "audio/webm";
  for (const candidate of PREFERRED_VOICE_MIME_TYPES) {
    if (typeof MediaRecorder.isTypeSupported === "function" && MediaRecorder.isTypeSupported(candidate)) {
      return candidate;
    }
  }
  return "audio/webm";
};

const stopVoiceStream = (stream: MediaStream | null) => {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    track.stop();
  }
};

const resolveVoiceErrorMessage = (error: unknown): string => {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
      return "Microphone access was denied.";
    }
    if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
      return "No microphone was found.";
    }
  }
  if (error instanceof Error) return error.message;
  return "Voice capture failed.";
};

export const useVoiceRecorder = (params: {
  enabled: boolean;
  onVoiceSend?: (payload: VoiceSendPayload) => Promise<void>;
}) => {
  const [state, setState] = useState<VoiceRecorderState>("idle");
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceStreamRef = useRef<MediaStream | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const stopRequestedRef = useRef(false);

  const supported = useMemo(() => {
    return (
      typeof window !== "undefined" &&
      typeof navigator !== "undefined" &&
      typeof MediaRecorder !== "undefined" &&
      Boolean(navigator.mediaDevices?.getUserMedia)
    );
  }, []);

  const clearCapture = useCallback(() => {
    mediaRecorderRef.current = null;
    stopVoiceStream(voiceStreamRef.current);
    voiceStreamRef.current = null;
    voiceChunksRef.current = [];
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const finalizeVoiceCapture = useCallback(
    async (mimeType: string) => {
      const chunks = voiceChunksRef.current;
      voiceChunksRef.current = [];
      clearCapture();
      stopRequestedRef.current = false;
      const resolvedMimeType = mimeType || resolvePreferredVoiceMimeType();
      const blob = new Blob(chunks, { type: resolvedMimeType });
      if (blob.size <= 0) {
        setState("idle");
        setError(null);
        return;
      }
      if (!params.onVoiceSend) {
        setState("idle");
        setError("Voice input is not available here.");
        return;
      }
      setState("transcribing");
      try {
        await params.onVoiceSend({
          blob,
          mimeType: resolvedMimeType,
          fileName: `voice-note${resolveVoiceExtension(resolvedMimeType)}`,
        });
        setError(null);
      } catch (voiceError) {
        setError(resolveVoiceErrorMessage(voiceError));
      } finally {
        setState("idle");
      }
    },
    [clearCapture, params],
  );

  const start = useCallback(async () => {
    if (state === "requesting" || state === "recording" || state === "transcribing") return;
    if (!params.enabled) {
      setError("Voice input is not available right now.");
      return;
    }
    if (!params.onVoiceSend) {
      setError("Voice input is not available here.");
      return;
    }
    if (!supported) {
      setError("This browser does not support microphone recording.");
      return;
    }
    try {
      setError(null);
      stopRequestedRef.current = false;
      setState("requesting");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voiceStreamRef.current = stream;
      const preferredMimeType = resolvePreferredVoiceMimeType();
      const recorder = preferredMimeType
        ? new MediaRecorder(stream, { mimeType: preferredMimeType })
        : new MediaRecorder(stream);
      voiceChunksRef.current = [];
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (captureEvent) => {
        if (captureEvent.data.size > 0) {
          voiceChunksRef.current = [...voiceChunksRef.current, captureEvent.data];
        }
      };
      recorder.onerror = () => {
        clearCapture();
        stopRequestedRef.current = false;
        setState("idle");
        setError("Voice capture failed.");
      };
      recorder.onstop = () => {
        void finalizeVoiceCapture(recorder.mimeType);
      };
      recorder.start();
      setState("recording");
      if (stopRequestedRef.current) {
        recorder.stop();
      }
    } catch (voiceError) {
      clearCapture();
      stopRequestedRef.current = false;
      setState("idle");
      setError(resolveVoiceErrorMessage(voiceError));
    }
  }, [clearCapture, finalizeVoiceCapture, params, state, supported]);

  const stop = useCallback(() => {
    if (state === "requesting") {
      stopRequestedRef.current = true;
      return;
    }
    if (state === "recording") {
      mediaRecorderRef.current?.stop();
    }
  }, [state]);

  const toggle = useCallback(async () => {
    if (state === "requesting" || state === "recording") {
      stop();
      return;
    }
    await start();
  }, [start, state, stop]);

  useEffect(() => {
    return () => {
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      }
      clearCapture();
      stopRequestedRef.current = false;
    };
  }, [clearCapture]);

  return {
    state,
    error,
    supported,
    start,
    stop,
    toggle,
    clearError,
  };
};
