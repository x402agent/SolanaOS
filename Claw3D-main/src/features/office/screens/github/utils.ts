"use client";

export const GITHUB_RECORDING_PRIVACY_MASK_ACTIVE = false;

export const maskGitHubRecordingText = (
  value: string | null | undefined,
): string => {
  return value ?? "";
};

export const formatRelativeTime = (value: string | null): string => {
  if (!value) return "Unknown update";
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return value;
  const deltaMinutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000));
  if (deltaMinutes < 1) return "Updated just now";
  if (deltaMinutes < 60) return `Updated ${deltaMinutes}m ago`;
  const deltaHours = Math.round(deltaMinutes / 60);
  if (deltaHours < 24) return `Updated ${deltaHours}h ago`;
  const deltaDays = Math.round(deltaHours / 24);
  return `Updated ${deltaDays}d ago`;
};

export const summarizeChecksTone = (summary: string | null): string => {
  if (!summary) return "text-white/45";
  if (summary.includes("failing")) return "text-rose-300";
  if (summary.includes("pending")) return "text-amber-200";
  return "text-[#14F195]";
};
