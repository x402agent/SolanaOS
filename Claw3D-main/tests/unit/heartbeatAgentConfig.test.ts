import { describe, expect, it } from "vitest";

import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import {
  listHeartbeatsForAgent,
  readConfigAgentList,
  resolveHeartbeatSettings,
  upsertConfigAgentEntry,
  writeConfigAgentList,
  type ConfigAgentEntry,
} from "@/lib/gateway/agentConfig";

const makeFakeClient = (responses: {
  config: Record<string, unknown>;
  status: Record<string, unknown>;
}) => {
  return {
    call: async (method: string) => {
      if (method === "config.get") {
        return { config: responses.config, hash: "hash", exists: true };
      }
      if (method === "status") {
        return responses.status;
      }
      if (method === "wake") {
        return { ok: true };
      }
      throw new Error(`Unexpected method: ${method}`);
    },
  } as unknown as GatewayClient;
};

describe("heartbeat gateway helpers", () => {
  it("resolveHeartbeatSettings merges defaults and per-agent overrides", () => {
    const config: Record<string, unknown> = {
      agents: {
        defaults: {
          heartbeat: {
            every: "30m",
            target: "last",
            includeReasoning: false,
            ackMaxChars: 111,
            activeHours: { start: "09:00", end: "17:00" },
          },
        },
        list: [
          {
            id: "alpha",
            heartbeat: {
              every: "5m",
              target: "last",
              includeReasoning: true,
            },
          },
        ],
      },
    };

    const resolved = resolveHeartbeatSettings(config, "alpha");
    expect(resolved.hasOverride).toBe(true);
    expect(resolved.heartbeat.every).toBe("5m");
    expect(resolved.heartbeat.includeReasoning).toBe(true);
    expect(resolved.heartbeat.ackMaxChars).toBe(111);
    expect(resolved.heartbeat.activeHours).toEqual({ start: "09:00", end: "17:00" });

    const fallback = resolveHeartbeatSettings(config, "beta");
    expect(fallback.hasOverride).toBe(false);
    expect(fallback.heartbeat.every).toBe("30m");
    expect(fallback.heartbeat.includeReasoning).toBe(false);
    expect(fallback.heartbeat.ackMaxChars).toBe(111);
    expect(fallback.heartbeat.activeHours).toEqual({ start: "09:00", end: "17:00" });
  });

  it("listHeartbeatsForAgent returns [] when disabled and no override exists", async () => {
    const config: Record<string, unknown> = {
      agents: {
        defaults: {
          heartbeat: { every: "30m", target: "last", includeReasoning: false },
        },
        list: [],
      },
    };
    const status: Record<string, unknown> = {
      heartbeat: { agents: [{ agentId: "alpha", enabled: false }] },
    };
    const client = makeFakeClient({ config, status });

    const result = await listHeartbeatsForAgent(client, "alpha");
    expect(result.heartbeats).toEqual([]);
  });

  it('listHeartbeatsForAgent returns one entry with source "default" when enabled and no override exists', async () => {
    const config: Record<string, unknown> = {
      agents: {
        defaults: {
          heartbeat: { every: "30m", target: "last", includeReasoning: false },
        },
        list: [],
      },
    };
    const status: Record<string, unknown> = {
      heartbeat: { agents: [{ agentId: "alpha", enabled: true }] },
    };
    const client = makeFakeClient({ config, status });

    const result = await listHeartbeatsForAgent(client, "alpha");
    expect(result.heartbeats).toHaveLength(1);
    expect(result.heartbeats[0]?.source).toBe("default");
    expect(result.heartbeats[0]?.enabled).toBe(true);
    expect(result.heartbeats[0]?.heartbeat.every).toBe("30m");
  });

  it('listHeartbeatsForAgent returns one entry with source "override" when an override exists', async () => {
    const config: Record<string, unknown> = {
      agents: {
        defaults: {
          heartbeat: { every: "30m", target: "last", includeReasoning: false },
        },
        list: [
          {
            id: "alpha",
            heartbeat: { every: "5m", target: "last", includeReasoning: true },
          },
        ],
      },
    };
    const status: Record<string, unknown> = {
      heartbeat: { agents: [{ agentId: "alpha", enabled: false }] },
    };
    const client = makeFakeClient({ config, status });

    const result = await listHeartbeatsForAgent(client, "alpha");
    expect(result.heartbeats).toHaveLength(1);
    expect(result.heartbeats[0]?.source).toBe("override");
    expect(result.heartbeats[0]?.enabled).toBe(false);
  });

  it("listHeartbeatsForAgent prefers status every over config-derived every", async () => {
    const config: Record<string, unknown> = {
      agents: {
        defaults: {
          heartbeat: { every: "30m", target: "last", includeReasoning: false },
        },
        list: [],
      },
    };
    const status: Record<string, unknown> = {
      heartbeat: { agents: [{ agentId: "alpha", enabled: true, every: "7m" }] },
    };
    const client = makeFakeClient({ config, status });

    const result = await listHeartbeatsForAgent(client, "alpha");
    expect(result.heartbeats).toHaveLength(1);
    expect(result.heartbeats[0]?.heartbeat.every).toBe("7m");
  });
});

describe("gateway config list helpers", () => {
  it("reads an empty list when agents.list is missing", () => {
    expect(readConfigAgentList({})).toEqual([]);
  });

  it("filters invalid list entries and keeps id-based entries", () => {
    const config = {
      agents: {
        list: [
          null,
          { id: "agent-1", name: "One" },
          { id: "" },
          { name: "missing-id" },
          { id: "agent-2", heartbeat: { every: "30m" } },
        ],
      },
    };
    expect(readConfigAgentList(config)).toEqual([
      { id: "agent-1", name: "One" },
      { id: "agent-2", heartbeat: { every: "30m" } },
    ]);
  });

  it("writes agents.list immutably", () => {
    const initial: Record<string, unknown> = {
      agents: { defaults: { heartbeat: { every: "1h" } } },
      bindings: [{ agentId: "agent-1" }],
    };
    const list: ConfigAgentEntry[] = [{ id: "agent-1", name: "One" }];
    const next = writeConfigAgentList(initial, list);

    expect(next).not.toBe(initial);
    expect(next.agents).not.toBe(initial.agents);
    expect((next.agents as Record<string, unknown>).list).toEqual(list);
    expect((next.agents as Record<string, unknown>).defaults).toEqual({
      heartbeat: { every: "1h" },
    });
    expect(next.bindings).toEqual([{ agentId: "agent-1" }]);
  });

  it("upserts agent entries", () => {
    const list: ConfigAgentEntry[] = [
      { id: "agent-1", name: "One" },
      { id: "agent-2", name: "Two" },
    ];

    const updated = upsertConfigAgentEntry(list, "agent-2", (entry) => ({
      ...entry,
      name: "Two Updated",
    }));
    expect(updated.list).toEqual([
      { id: "agent-1", name: "One" },
      { id: "agent-2", name: "Two Updated" },
    ]);
    expect(updated.entry).toEqual({ id: "agent-2", name: "Two Updated" });

    const inserted = upsertConfigAgentEntry(updated.list, "agent-3", (entry) => ({
      ...entry,
      name: "Three",
    }));
    expect(inserted.list).toEqual([
      { id: "agent-1", name: "One" },
      { id: "agent-2", name: "Two Updated" },
      { id: "agent-3", name: "Three" },
    ]);
    expect(inserted.entry).toEqual({ id: "agent-3", name: "Three" });
  });
});
