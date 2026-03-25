import fs from "node:fs";
import path from "node:path";

import { resolveStateDir } from "@/lib/clawdbot/paths";
import { readConfigAgentList } from "@/lib/gateway/agentConfig";
import type { OfficeAgentState } from "@/lib/office/schema";

export type OfficeAgentPresence = {
  agentId: string;
  name: string;
  state: OfficeAgentState;
  preferredDeskId?: string;
};

export type OfficePresenceSnapshot = {
  workspaceId: string;
  timestamp: string;
  agents: OfficeAgentPresence[];
};

const SOLANAOS_CONFIG_FILENAME = "solanaos.json";

const stableHash = (input: string): number => {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash;
};

const resolveStateFromSeed = (seed: number): OfficeAgentState => {
  const mod = seed % 20;
  if (mod <= 9) return "working";
  if (mod <= 14) return "idle";
  if (mod <= 17) return "meeting";
  return "error";
};

export const loadOfficePresenceSnapshot = (workspaceId: string): OfficePresenceSnapshot => {
  const configPath = path.join(resolveStateDir(), SOLANAOS_CONFIG_FILENAME);
  const timestamp = new Date().toISOString();
  if (!fs.existsSync(configPath)) {
    return {
      workspaceId,
      timestamp,
      agents: [],
    };
  }
  const raw = fs.readFileSync(configPath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  const config =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  const agentList = readConfigAgentList(config);
  const bucket = Math.floor(Date.now() / 2000);
  const agents: OfficeAgentPresence[] = agentList.map((entry) => {
    const id = entry.id.trim();
    const nameRaw = typeof entry.name === "string" ? entry.name : id;
    const seed = stableHash(`${id}:${bucket}`);
    return {
      agentId: id,
      name: nameRaw,
      state: resolveStateFromSeed(seed),
      preferredDeskId: `desk-${id}`,
    };
  });
  return {
    workspaceId,
    timestamp,
    agents,
  };
};
