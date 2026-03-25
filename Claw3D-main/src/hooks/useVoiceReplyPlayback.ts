"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { VoiceReplyProvider } from "@/lib/voiceReply/provider";

export type VoiceReplyPlaybackRequest = {
  text: string;
  provider?: VoiceReplyProvider;
  voiceId?: string | null;
  speed?: number;
};

const normalizeVoiceReplyText = (value: string): string => {
  return value.replace(/\s+/g, " ").trim();
};

export const useVoiceReplyPlayback = (params: {
  enabled: boolean;
  provider?: VoiceReplyProvider;
  voiceId?: string | null;
  speed?: number;
}) => {
  const { enabled, provider = "elevenlabs", voiceId = null, speed = 1 } = params;
  const queueRef = useRef<VoiceReplyPlaybackRequest[]>([]);
  const processingRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const generationRef = useRef(0);
  const [playing, setPlaying] = useState(false);

  const releaseAudio = useCallback(() => {
    const source = sourceRef.current;
    if (source) {
      source.onended = null;
      try {
        source.stop();
      } catch {
        /* ignore */
      }
      source.disconnect();
      sourceRef.current = null;
    }
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.src = "";
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  }, []);

  const getAudioContext = useCallback(() => {
    if (typeof window === "undefined") return null;
    if (audioContextRef.current) return audioContextRef.current;
    const AudioContextCtor =
      window.AudioContext ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((window as any).webkitAudioContext as typeof AudioContext | undefined);
    if (!AudioContextCtor) return null;
    audioContextRef.current = new AudioContextCtor();
    return audioContextRef.current;
  }, []);

  const stop = useCallback(() => {
    generationRef.current += 1;
    queueRef.current = [];
    abortRef.current?.abort();
    abortRef.current = null;
    releaseAudio();
    setPlaying(false);
  }, [releaseAudio]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const unlockAudio = () => {
      const context = getAudioContext();
      if (!context || context.state !== "suspended") return;
      void context.resume().catch(() => {
        /* ignore */
      });
    };
    window.addEventListener("pointerdown", unlockAudio, true);
    window.addEventListener("keydown", unlockAudio, true);
    return () => {
      window.removeEventListener("pointerdown", unlockAudio, true);
      window.removeEventListener("keydown", unlockAudio, true);
    };
  }, [getAudioContext]);

  const playBlob = useCallback(
    async (blob: Blob, generation: number) => {
      if (generation !== generationRef.current) return;
      releaseAudio();
      const audioContext = getAudioContext();
      if (audioContext) {
        try {
          if (audioContext.state === "suspended") {
            await audioContext.resume();
          }
          const buffer = await blob.arrayBuffer();
          const decoded = await audioContext.decodeAudioData(buffer.slice(0));
          if (generation !== generationRef.current) return;
          const source = audioContext.createBufferSource();
          source.buffer = decoded;
          source.connect(audioContext.destination);
          sourceRef.current = source;
          setPlaying(true);
          await new Promise<void>((resolve, reject) => {
            source.onended = () => {
              resolve();
            };
            try {
              source.start();
            } catch (error) {
              reject(error);
            }
          }).finally(() => {
            if (sourceRef.current === source) {
              source.disconnect();
              sourceRef.current = null;
            }
            setPlaying(false);
          });
          return;
        } catch (error) {
          console.warn("AudioContext playback fallback engaged.", error);
          releaseAudio();
        }
      }
      const nextUrl = URL.createObjectURL(blob);
      audioUrlRef.current = nextUrl;
      const audio = new Audio(nextUrl);
      audioRef.current = audio;
      setPlaying(true);
      await new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          audio.removeEventListener("ended", handleDone);
          audio.removeEventListener("pause", handleDone);
          audio.removeEventListener("error", handleError);
        };
        const handleDone = () => {
          cleanup();
          resolve();
        };
        const handleError = () => {
          cleanup();
          reject(new Error("Voice reply playback failed."));
        };
        audio.addEventListener("ended", handleDone);
        audio.addEventListener("pause", handleDone);
        audio.addEventListener("error", handleError);
        audio.play().catch((error) => {
          cleanup();
          reject(error);
        });
      }).finally(() => {
        if (audioRef.current === audio) {
          audioRef.current = null;
        }
        setPlaying(false);
        if (audioUrlRef.current === nextUrl) {
          URL.revokeObjectURL(nextUrl);
          audioUrlRef.current = null;
        }
      });
    },
    [getAudioContext, releaseAudio]
  );

  const requestAudio = useCallback(
    async (request: VoiceReplyPlaybackRequest, signal: AbortSignal) => {
      const response = await fetch("/api/office/voice/reply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: request.text,
          provider: request.provider ?? provider,
          voiceId: request.voiceId ?? voiceId,
          speed: request.speed ?? speed,
        }),
        signal,
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error?.trim() || "Voice reply request failed.");
      }
      return response.blob();
    },
    [provider, speed, voiceId]
  );

  const drainQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    try {
      while (queueRef.current.length > 0) {
        if (!enabled) {
          queueRef.current = [];
          break;
        }
        const nextRequest = queueRef.current.shift();
        if (!nextRequest) continue;
        const generation = generationRef.current;
        const controller = new AbortController();
        abortRef.current = controller;
        try {
          const blob = await requestAudio(nextRequest, controller.signal);
          abortRef.current = null;
          await playBlob(blob, generation);
        } catch (error) {
          abortRef.current = null;
          if (
            error instanceof DOMException &&
            (error.name === "AbortError" || error.name === "NotAllowedError")
          ) {
            continue;
          }
          console.error("Failed to play voice reply.", error);
        }
      }
    } finally {
      processingRef.current = false;
      setPlaying(false);
    }
  }, [enabled, playBlob, requestAudio]);

  const enqueue = useCallback(
    (request: VoiceReplyPlaybackRequest) => {
      const text = normalizeVoiceReplyText(request.text);
      if (!text || !enabled) return;
      queueRef.current.push({
        text,
        provider: request.provider ?? provider,
        voiceId: request.voiceId ?? voiceId,
        speed: request.speed ?? speed,
      });
      void drainQueue();
    },
    [drainQueue, enabled, provider, speed, voiceId]
  );

  const preview = useCallback(
    async (request: VoiceReplyPlaybackRequest) => {
      const text = normalizeVoiceReplyText(request.text);
      if (!text) return;
      stop();
      const generation = generationRef.current;
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const blob = await requestAudio(
          {
            text,
            provider: request.provider ?? provider,
            voiceId: request.voiceId ?? voiceId,
            speed: request.speed ?? speed,
          },
          controller.signal
        );
        abortRef.current = null;
        await playBlob(blob, generation);
      } catch (error) {
        abortRef.current = null;
        if (
          error instanceof DOMException &&
          (error.name === "AbortError" || error.name === "NotAllowedError")
        ) {
          return;
        }
        console.error("Failed to preview voice reply.", error);
      }
    },
    [playBlob, provider, requestAudio, speed, stop, voiceId]
  );

  useEffect(() => {
    if (enabled) return;
    stop();
  }, [enabled, stop]);

  useEffect(() => {
    return () => {
      stop();
      const audioContext = audioContextRef.current;
      audioContextRef.current = null;
      if (audioContext && audioContext.state !== "closed") {
        void audioContext.close().catch(() => {
          /* ignore */
        });
      }
    };
  }, [stop]);

  return {
    enqueue,
    preview,
    stop,
    playing,
  };
};
