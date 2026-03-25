"use client";

import { useCallback, useEffect, useState } from "react";
import type { StudioSettingsCoordinator } from "@/lib/studio/coordinator";
import {
  defaultStudioVoiceRepliesPreference,
  resolveVoiceRepliesPreference,
  type StudioVoiceRepliesPreference,
} from "@/lib/studio/settings";

type UseStudioVoiceRepliesPreferenceParams = {
  gatewayUrl: string;
  settingsCoordinator: StudioSettingsCoordinator;
};

export const useStudioVoiceRepliesPreference = ({
  gatewayUrl,
  settingsCoordinator,
}: UseStudioVoiceRepliesPreferenceParams) => {
  const [preference, setPreference] = useState<StudioVoiceRepliesPreference>(
    defaultStudioVoiceRepliesPreference()
  );
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const gatewayKey = gatewayUrl.trim();
    if (!gatewayKey) {
      setPreference(defaultStudioVoiceRepliesPreference());
      setLoaded(true);
      return;
    }
    setLoaded(false);
    const loadPreference = async () => {
      try {
        const settings = await settingsCoordinator.loadSettings({ maxAgeMs: 30_000 });
        if (cancelled) return;
        setPreference(
          settings
            ? resolveVoiceRepliesPreference(settings, gatewayKey)
            : defaultStudioVoiceRepliesPreference()
        );
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load voice replies preference.", error);
          setPreference(defaultStudioVoiceRepliesPreference());
        }
      } finally {
        if (!cancelled) {
          setLoaded(true);
        }
      }
    };
    void loadPreference();
    return () => {
      cancelled = true;
    };
  }, [gatewayUrl, settingsCoordinator]);

  const setEnabled = useCallback(
    (enabled: boolean) => {
      const gatewayKey = gatewayUrl.trim();
      setPreference((current) => ({ ...current, enabled }));
      if (!gatewayKey) return;
      settingsCoordinator.schedulePatch(
        {
          voiceReplies: {
            [gatewayKey]: {
              enabled,
            },
          },
        },
        0
      );
    },
    [gatewayUrl, settingsCoordinator]
  );

  const setVoiceId = useCallback(
    (voiceId: string | null) => {
      const gatewayKey = gatewayUrl.trim();
      setPreference((current) => ({ ...current, voiceId }));
      if (!gatewayKey) return;
      settingsCoordinator.schedulePatch(
        {
          voiceReplies: {
            [gatewayKey]: {
              voiceId,
            },
          },
        },
        0
      );
    },
    [gatewayUrl, settingsCoordinator]
  );

  const setSpeed = useCallback(
    (speed: number) => {
      const gatewayKey = gatewayUrl.trim();
      setPreference((current) => ({ ...current, speed }));
      if (!gatewayKey) return;
      settingsCoordinator.schedulePatch(
        {
          voiceReplies: {
            [gatewayKey]: {
              speed,
            },
          },
        },
        0
      );
    },
    [gatewayUrl, settingsCoordinator]
  );

  return {
    loaded,
    preference,
    enabled: preference.enabled,
    voiceId: preference.voiceId,
    speed: preference.speed,
    setEnabled,
    setVoiceId,
    setSpeed,
  };
};
