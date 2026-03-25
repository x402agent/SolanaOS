"use client";

import { useEffect, useRef, useState } from "react";

type BrowserPreviewState = {
  mediaUrl: string | null;
  browserUrl: string | null;
  loading: boolean;
  error: string | null;
};

export function useBrowserPreview(url: string | null, enabled: boolean) {
  const [state, setState] = useState<BrowserPreviewState>({
    mediaUrl: null,
    browserUrl: url,
    loading: false,
    error: null,
  });
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!enabled || !url) {
      requestIdRef.current += 1;
      setState({
        mediaUrl: null,
        browserUrl: url,
        loading: false,
        error: null,
      });
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setState((current) => ({
      ...current,
      browserUrl: url,
      loading: true,
      error: null,
    }));

    void (async () => {
      try {
        const params = new URLSearchParams({
          url,
          ts: String(Date.now()),
        });
        const response = await fetch(
          `/api/office/browser-preview?${params.toString()}`,
          {
            cache: "no-store",
          },
        );
        const payload = (await response.json()) as {
          error?: string;
          mediaUrl?: string;
          browserUrl?: string;
        };
        if (!response.ok) {
          throw new Error(
            payload.error?.trim() || "Unable to capture GitHub browser preview.",
          );
        }
        if (requestIdRef.current !== requestId) return;
        setState({
          mediaUrl: payload.mediaUrl?.trim() || null,
          browserUrl: payload.browserUrl?.trim() || url,
          loading: false,
          error: null,
        });
      } catch (error) {
        if (requestIdRef.current !== requestId) return;
        setState({
          mediaUrl: null,
          browserUrl: url,
          loading: false,
          error:
            error instanceof Error
              ? error.message
              : "Unable to capture GitHub browser preview.",
        });
      }
    })();
  }, [enabled, url]);

  return state;
}
