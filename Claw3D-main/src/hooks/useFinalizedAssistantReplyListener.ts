"use client";

import { useEffect, useRef } from "react";
import type { TranscriptEntry } from "@/features/agents/state/transcript";

type AgentReplyListenerItem = {
  agentId: string;
  transcriptEntries?: TranscriptEntry[];
};

type LastAssistantEntry = {
  entryId: string;
  timestampMs: number | null;
  text: string;
};

const resolveLatestAssistantEntry = (
  entries: TranscriptEntry[] | undefined
): LastAssistantEntry | null => {
  if (!Array.isArray(entries) || entries.length === 0) return null;
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (!entry) continue;
    if (entry.role !== "assistant" || entry.kind !== "assistant") continue;
    if (!entry.confirmed || !entry.text.trim()) continue;
    return {
      entryId: entry.entryId,
      timestampMs: entry.timestampMs,
      text: entry.text,
    };
  }
  return null;
};

export const useFinalizedAssistantReplyListener = (
  agents: AgentReplyListenerItem[],
  onReply: (event: { agentId: string; entryId: string; text: string }) => void
) => {
  const latestByAgentIdRef = useRef<Record<string, LastAssistantEntry>>({});
  const primedRef = useRef(false);

  useEffect(() => {
    if (!primedRef.current) {
      const initialByAgentId: Record<string, LastAssistantEntry> = {};
      for (const agent of agents) {
        const latest = resolveLatestAssistantEntry(agent.transcriptEntries);
        if (!latest) continue;
        initialByAgentId[agent.agentId] = latest;
      }
      latestByAgentIdRef.current = initialByAgentId;
      primedRef.current = true;
      return;
    }

    const previousByAgentId = latestByAgentIdRef.current;
    const nextByAgentId: Record<string, LastAssistantEntry> = {};

    for (const agent of agents) {
      const latest = resolveLatestAssistantEntry(agent.transcriptEntries);
      if (!latest) continue;
      nextByAgentId[agent.agentId] = latest;
      const previous = previousByAgentId[agent.agentId];
      if (previous?.entryId === latest.entryId) continue;
      if (
        typeof previous?.timestampMs === "number" &&
        typeof latest.timestampMs === "number" &&
        latest.timestampMs < previous.timestampMs
      ) {
        continue;
      }
      onReply({
        agentId: agent.agentId,
        entryId: latest.entryId,
        text: latest.text,
      });
    }

    latestByAgentIdRef.current = nextByAgentId;
  }, [agents, onReply]);
};
