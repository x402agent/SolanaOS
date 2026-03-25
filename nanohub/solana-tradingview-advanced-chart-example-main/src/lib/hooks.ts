"use client";

import { useSyncExternalStore, useCallback } from "react";

// ─── Theme (useSyncExternalStore – zero useEffect) ───────────────────────

function subscribeTheme(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

function getThemeSnapshot() {
  return document.documentElement.classList.contains("dark");
}

function getServerSnapshot() {
  return true; // default to dark on server
}

export function useIsDark() {
  return useSyncExternalStore(subscribeTheme, getThemeSnapshot, getServerSnapshot);
}
