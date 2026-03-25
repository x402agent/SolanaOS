import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { resolveUserPath } from "@/lib/clawdbot/paths";
import type { RemovableSkillSource, SkillRemoveRequest, SkillRemoveResult } from "@/lib/skills/types";

const resolveComparablePath = (input: string): string => {
  const resolved = path.resolve(input);
  if (!fs.existsSync(resolved)) {
    return resolved;
  }
  try {
    return fs.realpathSync(resolved);
  } catch {
    return resolved;
  }
};

const isPathInside = (root: string, candidate: string): boolean => {
  const resolvedRoot = resolveComparablePath(root);
  const resolvedCandidate = resolveComparablePath(candidate);
  if (resolvedCandidate === resolvedRoot) {
    return true;
  }
  const rootPrefix = resolvedRoot.endsWith(path.sep) ? resolvedRoot : `${resolvedRoot}${path.sep}`;
  return resolvedCandidate.startsWith(rootPrefix);
};

const normalizeRequiredPath = (value: string, field: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${field} is required.`);
  }
  return resolveUserPath(trimmed, os.homedir);
};

const resolveAllowedRoot = (params: {
  source: RemovableSkillSource;
  workspaceDir: string;
  managedSkillsDir: string;
}): string => {
  if (params.source === "solanaos-managed") {
    return params.managedSkillsDir;
  }
  return path.join(params.workspaceDir, "skills");
};

export const removeSkillLocally = (params: SkillRemoveRequest): SkillRemoveResult => {
  const skillKey = params.skillKey.trim();
  if (!skillKey) {
    throw new Error("skillKey is required.");
  }

  const source = params.source;
  const baseDir = normalizeRequiredPath(params.baseDir, "baseDir");
  const workspaceDir = normalizeRequiredPath(params.workspaceDir, "workspaceDir");
  const managedSkillsDir = normalizeRequiredPath(params.managedSkillsDir, "managedSkillsDir");

  const allowedRoot = resolveAllowedRoot({
    source,
    workspaceDir,
    managedSkillsDir,
  });

  if (!isPathInside(allowedRoot, baseDir)) {
    throw new Error(`Refusing to remove skill outside allowed root: ${baseDir}`);
  }
  if (resolveComparablePath(allowedRoot) === resolveComparablePath(baseDir)) {
    throw new Error(`Refusing to remove the skills root directory: ${baseDir}`);
  }

  const exists = fs.existsSync(baseDir);
  if (exists) {
    const stats = fs.statSync(baseDir);
    if (!stats.isDirectory()) {
      throw new Error(`Skill path is not a directory: ${baseDir}`);
    }
    const skillDocPath = path.join(baseDir, "SKILL.md");
    if (!fs.existsSync(skillDocPath) || !fs.statSync(skillDocPath).isFile()) {
      throw new Error(`Refusing to remove non-skill directory: ${baseDir}`);
    }
    fs.rmSync(baseDir, { recursive: true, force: false });
  }

  return {
    removed: exists,
    removedPath: baseDir,
    source,
  };
};
