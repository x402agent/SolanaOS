import { runSshJson } from "@/lib/ssh/gateway-host";
import type { SkillRemoveRequest, SkillRemoveResult } from "@/lib/skills/types";

const REMOVE_SKILL_SCRIPT = `
set -euo pipefail

python3 - "$1" "$2" "$3" "$4" "$5" <<'PY'
import json
import pathlib
import shutil
import sys

skill_key = sys.argv[1].strip()
source = sys.argv[2].strip()
base_dir_raw = sys.argv[3].strip()
workspace_dir_raw = sys.argv[4].strip()
managed_skills_dir_raw = sys.argv[5].strip()

if not skill_key:
  raise SystemExit("skillKey is required.")
if not source:
  raise SystemExit("source is required.")
if not base_dir_raw:
  raise SystemExit("baseDir is required.")
if not workspace_dir_raw:
  raise SystemExit("workspaceDir is required.")
if not managed_skills_dir_raw:
  raise SystemExit("managedSkillsDir is required.")

allowed_sources = {
  "solanaos-managed",
  "solanaos-workspace",
}
if source not in allowed_sources:
  raise SystemExit(f"Unsupported skill source for removal: {source}")

base_dir = pathlib.Path(base_dir_raw).expanduser().resolve(strict=False)
workspace_dir = pathlib.Path(workspace_dir_raw).expanduser().resolve(strict=False)
managed_skills_dir = pathlib.Path(managed_skills_dir_raw).expanduser().resolve(strict=False)

if source == "solanaos-managed":
  allowed_root = managed_skills_dir
else:
  allowed_root = (workspace_dir / "skills").resolve(strict=False)

try:
  base_dir.relative_to(allowed_root)
except ValueError:
  raise SystemExit(f"Refusing to remove skill outside allowed root: {base_dir}")

if base_dir == allowed_root:
  raise SystemExit(f"Refusing to remove the skills root directory: {base_dir}")

removed = False
if base_dir.exists():
  if not base_dir.is_dir():
    raise SystemExit(f"Skill path is not a directory: {base_dir}")
  skill_doc = base_dir / "SKILL.md"
  if not skill_doc.exists() or not skill_doc.is_file():
    raise SystemExit(f"Refusing to remove non-skill directory: {base_dir}")
  shutil.rmtree(base_dir)
  removed = True

print(json.dumps({"removed": removed, "removedPath": str(base_dir), "source": source}))
PY
`;

export const removeSkillOverSsh = (params: {
  sshTarget: string;
  request: SkillRemoveRequest;
}): SkillRemoveResult => {
  const result = runSshJson({
    sshTarget: params.sshTarget,
    argv: [
      "bash",
      "-s",
      "--",
      params.request.skillKey,
      params.request.source,
      params.request.baseDir,
      params.request.workspaceDir,
      params.request.managedSkillsDir,
    ],
    input: REMOVE_SKILL_SCRIPT,
    label: `remove skill (${params.request.skillKey})`,
  });
  return result as SkillRemoveResult;
};
