import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { resolveStateDir } from "@/lib/clawdbot/paths";

export type GatewayAgentStateMove = { from: string; to: string };

export type TrashAgentStateResult = {
  trashDir: string;
  moved: GatewayAgentStateMove[];
};

export type RestoreAgentStateResult = {
  restored: GatewayAgentStateMove[];
};

const isSafeAgentId = (value: string) => /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(value);

const utcStamp = (now: Date = new Date()) => {
  const iso = now.toISOString(); // 2026-02-11T00:24:00.123Z
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z"); // 20260211T002400Z
};

const moveIfExists = (src: string, dest: string, moves: GatewayAgentStateMove[]) => {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.renameSync(src, dest);
  moves.push({ from: src, to: dest });
};

export const trashAgentStateLocally = (params: { agentId: string }): TrashAgentStateResult => {
  const agentId = params.agentId.trim();
  if (!agentId) {
    throw new Error("agentId is required.");
  }
  if (!isSafeAgentId(agentId)) {
    throw new Error(`Invalid agentId: ${agentId}`);
  }

  const base = resolveStateDir();
  const trashRoot = path.join(base, "trash", "studio-delete-agent");
  const stamp = utcStamp();
  const trashDir = path.join(trashRoot, `${stamp}-${agentId}-${randomUUID()}`);
  fs.mkdirSync(path.join(trashDir, "agents"), { recursive: true });
  fs.mkdirSync(path.join(trashDir, "workspaces"), { recursive: true });

  const moves: GatewayAgentStateMove[] = [];
  moveIfExists(
    path.join(base, `workspace-${agentId}`),
    path.join(trashDir, "workspaces", `workspace-${agentId}`),
    moves
  );
  moveIfExists(path.join(base, "agents", agentId), path.join(trashDir, "agents", agentId), moves);

  return { trashDir, moved: moves };
};

const ensureUnderBase = (base: string, candidate: string) => {
  const resolvedBase = fs.existsSync(base) ? fs.realpathSync(base) : path.resolve(base);
  const resolvedCandidate = fs.realpathSync(candidate);
  const prefix = resolvedBase.endsWith(path.sep) ? resolvedBase : `${resolvedBase}${path.sep}`;
  if (resolvedCandidate !== resolvedBase && !resolvedCandidate.startsWith(prefix)) {
    throw new Error(`trashDir is not under ${base}: ${candidate}`);
  }
  return { resolvedBase, resolvedCandidate };
};

export const restoreAgentStateLocally = (params: {
  agentId: string;
  trashDir: string;
}): RestoreAgentStateResult => {
  const agentId = params.agentId.trim();
  const trashDirRaw = params.trashDir.trim();
  if (!agentId) {
    throw new Error("agentId is required.");
  }
  if (!isSafeAgentId(agentId)) {
    throw new Error(`Invalid agentId: ${agentId}`);
  }
  if (!trashDirRaw) {
    throw new Error("trashDir is required.");
  }

  const base = resolveStateDir();
  if (!fs.existsSync(trashDirRaw)) {
    throw new Error(`trashDir does not exist: ${trashDirRaw}`);
  }
  const { resolvedCandidate: resolvedTrashDir } = ensureUnderBase(base, trashDirRaw);

  const moves: GatewayAgentStateMove[] = [];
  const restoreIfExists = (src: string, dest: string) => {
    if (!fs.existsSync(src)) return;
    if (fs.existsSync(dest)) {
      throw new Error(`Refusing to restore over existing path: ${dest}`);
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.renameSync(src, dest);
    moves.push({ from: src, to: dest });
  };

  restoreIfExists(
    path.join(resolvedTrashDir, "workspaces", `workspace-${agentId}`),
    path.join(base, `workspace-${agentId}`)
  );
  restoreIfExists(
    path.join(resolvedTrashDir, "agents", agentId),
    path.join(base, "agents", agentId)
  );

  return { restored: moves };
};
