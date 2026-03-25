import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const LEGACY_STATE_DIRNAMES = [".clawdbot", ".moltbot"] as const;
const NEW_STATE_DIRNAME = ".solanaos";
const CONFIG_FILENAME = "solanaos.json";
const LEGACY_CONFIG_FILENAMES = ["clawdbot.json", "moltbot.json"] as const;

const resolveDefaultHomeDir = (homedir: () => string = os.homedir): string => {
  const home = homedir();
  if (home) {
    try {
      if (fs.existsSync(home)) {
        return home;
      }
    } catch {
      // ignore
    }
  }
  return os.tmpdir();
};

export const resolveUserPath = (
  input: string,
  homedir: () => string = os.homedir
): string => {
  const trimmed = input.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("~")) {
    const expanded = trimmed.replace(/^~(?=$|[\\/])/, homedir());
    return path.resolve(expanded);
  }
  return path.resolve(trimmed);
};

export const resolveStateDir = (
  env: NodeJS.ProcessEnv = process.env,
  homedir: () => string = os.homedir
): string => {
  const override =
    env.SOLANAOS_STATE_DIR?.trim() ||
    env.MOLTBOT_STATE_DIR?.trim() ||
    env.CLAWDBOT_STATE_DIR?.trim();
  if (override) return resolveUserPath(override, homedir);
  const defaultHome = resolveDefaultHomeDir(homedir);
  const newDir = path.join(defaultHome, NEW_STATE_DIRNAME);
  const legacyDirs = LEGACY_STATE_DIRNAMES.map((dir) => path.join(defaultHome, dir));
  const hasNew = fs.existsSync(newDir);
  if (hasNew) return newDir;
  const existingLegacy = legacyDirs.find((dir) => {
    try {
      return fs.existsSync(dir);
    } catch {
      return false;
    }
  });
  return existingLegacy ?? newDir;
};

export const resolveConfigPathCandidates = (
  env: NodeJS.ProcessEnv = process.env,
  homedir: () => string = os.homedir
): string[] => {
  const explicit =
    env.SOLANAOS_CONFIG_PATH?.trim() ||
    env.MOLTBOT_CONFIG_PATH?.trim() ||
    env.CLAWDBOT_CONFIG_PATH?.trim();
  if (explicit) return [resolveUserPath(explicit, homedir)];

  const defaultHome = resolveDefaultHomeDir(homedir);
  const candidates: string[] = [];
  const stateDir =
    env.SOLANAOS_STATE_DIR?.trim() ||
    env.MOLTBOT_STATE_DIR?.trim() ||
    env.CLAWDBOT_STATE_DIR?.trim();
  if (stateDir) {
    const resolved = resolveUserPath(stateDir, homedir);
    candidates.push(path.join(resolved, CONFIG_FILENAME));
    candidates.push(...LEGACY_CONFIG_FILENAMES.map((name) => path.join(resolved, name)));
  }

  const defaultDirs = [
    path.join(defaultHome, NEW_STATE_DIRNAME),
    ...LEGACY_STATE_DIRNAMES.map((dir) => path.join(defaultHome, dir)),
  ];
  for (const dir of defaultDirs) {
    candidates.push(path.join(dir, CONFIG_FILENAME));
    candidates.push(...LEGACY_CONFIG_FILENAMES.map((name) => path.join(dir, name)));
  }
  return candidates;
};
