// @vitest-environment node

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("package manifest", () => {
  it("does not export local claw3d bin", () => {
    const packageJsonPath = path.join(process.cwd(), "package.json");
    const parsed = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as {
      bin?: Record<string, unknown>;
    };
    const hasSolanaosStudioBin = Object.prototype.hasOwnProperty.call(
      parsed.bin ?? {},
      "claw3d"
    );
    expect(hasSolanaosStudioBin).toBe(false);
  });
});
