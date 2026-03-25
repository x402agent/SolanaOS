import { describe, expect, it } from "vitest";

import {
  buildJanitorActorsForCue,
  JANITOR_SWEEP_DURATION_MS,
  pruneExpiredJanitorActors,
} from "@/features/retro-office/core/janitors";

describe("janitor actors", () => {
  it("builds temporary janitor actors with routes and expiry", () => {
    const cue = {
      id: "cue-1",
      agentId: "agent-1",
      agentName: "Agent One",
      ts: 1_700_000_000_000,
    };
    const actors = buildJanitorActorsForCue(cue, [
      { x: 100, y: 100, facing: 0 },
      { x: 200, y: 200, facing: Math.PI / 2 },
      { x: 300, y: 300, facing: Math.PI },
    ]);

    expect(actors).toHaveLength(3);
    expect(actors.every((actor) => actor.role === "janitor")).toBe(true);
    expect(actors.every((actor) => actor.janitorRoute.length >= 6)).toBe(true);
    expect(
      actors.every(
        (actor) => actor.janitorDespawnAt === cue.ts + JANITOR_SWEEP_DURATION_MS,
      ),
    ).toBe(true);
  });

  it("prunes janitors after their sweep duration ends", () => {
    const cue = {
      id: "cue-2",
      agentId: "agent-2",
      agentName: "Agent Two",
      ts: 10_000,
    };
    const actors = buildJanitorActorsForCue(cue, [
      { x: 140, y: 160, facing: 0 },
      { x: 260, y: 260, facing: Math.PI / 2 },
    ]);

    expect(pruneExpiredJanitorActors(actors, cue.ts + JANITOR_SWEEP_DURATION_MS - 1)).toHaveLength(
      actors.length,
    );
    expect(pruneExpiredJanitorActors(actors, cue.ts + JANITOR_SWEEP_DURATION_MS)).toEqual([]);
  });
});
