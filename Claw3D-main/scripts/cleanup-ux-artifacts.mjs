import { constants as fsConstants, promises as fs } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const uxAuditDir = path.join(repoRoot, "output", "playwright", "ux-audit");
const transientFiles = [
  path.join(repoRoot, ".agent", "ux-audit.md"),
  path.join(repoRoot, ".agent", "execplan-pending.md"),
];

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function clearDirContents(dir) {
  await ensureDir(dir);
  const entries = await fs.readdir(dir);
  await Promise.all(
    entries.map((entry) =>
      fs.rm(path.join(dir, entry), { recursive: true, force: true }),
    ),
  );
}

async function removeIfPresent(filePath) {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return;
    }
    throw error;
  }
}

function run(command, args) {
  return spawnSync(command, args, { encoding: "utf8" });
}

async function stopPlaywrightSessions() {
  const codeHome = process.env.CODEX_HOME ?? path.join(os.homedir(), ".codex");
  const pwcli = path.join(codeHome, "skills", "playwright", "scripts", "playwright_cli.sh");
  try {
    await fs.access(pwcli, fsConstants.X_OK);
  } catch {
    return;
  }
  const result = run(pwcli, ["session-stop-all"]);
  if (result.status === 0) return;
  if (result.error) {
    throw result.error;
  }
}

function killPattern(pattern) {
  const result = run("pkill", ["-f", pattern]);
  if (result.status === 0 || result.status === 1) return;
  if (result.error && result.error.code === "ENOENT") return;
  if (result.error) throw result.error;
}

function cleanupPlaywrightProcesses() {
  killPattern("ms-playwright/daemon");
  killPattern("playwright/cli.js run-mcp-server");
  killPattern("chrome-headless-shell");
  killPattern("Google Chrome --headless");
  killPattern("Chromium --headless");
}

async function main() {
  await stopPlaywrightSessions();
  cleanupPlaywrightProcesses();
  await clearDirContents(uxAuditDir);
  for (const transientFile of transientFiles) {
    await removeIfPresent(transientFile);
  }
  console.log("cleanup:ux-artifacts complete");
}

main().catch((error) => {
  console.error("cleanup:ux-artifacts failed");
  console.error(error);
  process.exit(1);
});
