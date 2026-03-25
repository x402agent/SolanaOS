import { describe, expect, it } from "vitest";

import {
  defaultStudioSettings,
  mergeStudioSettings,
  normalizeStudioSettings,
  resolveDeskAssignments,
} from "@/lib/studio/settings";

describe("studio desk assignments", () => {
  it("normalizes and resolves desk assignments by gateway", () => {
    const settings = normalizeStudioSettings({
      gateway: { url: "http://localhost:3000", token: "" },
      deskAssignments: {
        "http://localhost:3000": {
          desk_a: "main",
          desk_b: "qa",
          empty: "",
        },
      },
    });

    expect(resolveDeskAssignments(settings, "http://localhost:3000")).toEqual({
      desk_a: "main",
      desk_b: "qa",
    });
  });

  it("merges desk assignment patches and removes cleared desks", () => {
    const current = mergeStudioSettings(defaultStudioSettings(), {
      deskAssignments: {
        "http://localhost:3000": {
          desk_a: "main",
          desk_b: "qa",
        },
      },
    });

    const next = mergeStudioSettings(current, {
      deskAssignments: {
        "http://localhost:3000": {
          desk_a: "ops",
          desk_b: null,
        },
      },
    });

    expect(resolveDeskAssignments(next, "http://localhost:3000")).toEqual({
      desk_a: "ops",
    });
  });
});
