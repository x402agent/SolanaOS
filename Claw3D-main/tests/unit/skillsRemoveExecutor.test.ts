import { beforeEach, describe, expect, it, vi } from "vitest";

import { runSshJson } from "@/lib/ssh/gateway-host";
import { removeSkillOverSsh } from "@/lib/ssh/skills-remove";

vi.mock("@/lib/ssh/gateway-host", () => ({
  runSshJson: vi.fn(),
}));

describe("skills remove ssh executor", () => {
  const mockedRunSshJson = vi.mocked(runSshJson);

  beforeEach(() => {
    mockedRunSshJson.mockReset();
  });

  it("removes skill files via ssh", () => {
    mockedRunSshJson.mockReturnValueOnce({
      removed: true,
      removedPath: "/home/ubuntu/.solanaos/skills/github",
      source: "solanaos-managed",
    });

    const result = removeSkillOverSsh({
      sshTarget: "me@host",
      request: {
        skillKey: "github",
        source: "solanaos-managed",
        baseDir: "/home/ubuntu/.solanaos/skills/github",
        workspaceDir: "/home/ubuntu/.solanaos/workspace-main",
        managedSkillsDir: "/home/ubuntu/.solanaos/skills",
      },
    });

    expect(result).toEqual({
      removed: true,
      removedPath: "/home/ubuntu/.solanaos/skills/github",
      source: "solanaos-managed",
    });
    expect(runSshJson).toHaveBeenCalledWith(
      expect.objectContaining({
        sshTarget: "me@host",
        argv: [
          "bash",
          "-s",
          "--",
          "github",
          "solanaos-managed",
          "/home/ubuntu/.solanaos/skills/github",
          "/home/ubuntu/.solanaos/workspace-main",
          "/home/ubuntu/.solanaos/skills",
        ],
        label: "remove skill (github)",
        input: expect.stringContaining('python3 - "$1" "$2" "$3" "$4" "$5"'),
      })
    );
  });
});
