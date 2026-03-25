import { describe, expect, it, vi } from "vitest";

import { GatewayResponseError } from "@/lib/gateway/GatewayClient";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import {
  readGatewayAgentSkillsAllowlist,
  updateGatewayAgentSkillsAllowlist,
} from "@/lib/gateway/agentConfig";

describe("gateway agent skills allowlist", () => {
  it("reads and normalizes existing skills allowlist", async () => {
    const client = {
      call: vi.fn(async (method: string) => {
        if (method === "config.get") {
          return {
            exists: true,
            hash: "cfg-read-1",
            config: {
              agents: {
                list: [{ id: "agent-1", skills: [" github ", "slack", "github"] }],
              },
            },
          };
        }
        throw new Error(`unexpected method ${method}`);
      }),
    } as unknown as GatewayClient;

    await expect(
      readGatewayAgentSkillsAllowlist({
        client,
        agentId: "agent-1",
      })
    ).resolves.toEqual(["github", "slack"]);
  });

  it("writes mode all by removing the skills key", async () => {
    const client = {
      call: vi.fn(async (method: string, params?: unknown) => {
        if (method === "config.get") {
          return {
            exists: true,
            hash: "cfg-all-1",
            config: {
              agents: {
                list: [{ id: "agent-1", skills: ["github", "slack"] }],
              },
            },
          };
        }
        if (method === "config.set") {
          const payload = params as { raw?: string; baseHash?: string };
          const parsed = JSON.parse(payload.raw ?? "") as {
            agents?: { list?: Array<{ id?: string; skills?: string[] }> };
          };
          expect(payload.baseHash).toBe("cfg-all-1");
          const entry = parsed.agents?.list?.find((item) => item.id === "agent-1");
          expect(entry).toEqual({ id: "agent-1" });
          return { ok: true };
        }
        throw new Error(`unexpected method ${method}`);
      }),
    } as unknown as GatewayClient;

    await updateGatewayAgentSkillsAllowlist({
      client,
      agentId: "agent-1",
      mode: "all",
    });
  });

  it("writes mode none and mode allowlist with normalized names", async () => {
    const calls: Array<{ method: string; params?: unknown }> = [];
    const client = {
      call: vi.fn(async (method: string, params?: unknown) => {
        calls.push({ method, params });
        if (method === "config.get") {
          return {
            exists: true,
            hash: `cfg-${calls.length}`,
            config: {
              agents: {
                list: [{ id: "agent-1" }],
              },
            },
          };
        }
        if (method === "config.set") {
          return { ok: true };
        }
        throw new Error(`unexpected method ${method}`);
      }),
    } as unknown as GatewayClient;

    await updateGatewayAgentSkillsAllowlist({
      client,
      agentId: "agent-1",
      mode: "none",
    });
    await updateGatewayAgentSkillsAllowlist({
      client,
      agentId: "agent-1",
      mode: "allowlist",
      skillNames: [" slack ", "github", "slack"],
    });

    const nonePayload = calls.find(
      (entry) => entry.method === "config.set"
    )?.params as { raw?: string };
    const setCalls = calls.filter((entry) => entry.method === "config.set");
    const allowPayload = setCalls[1]?.params as { raw?: string };

    expect(
      (JSON.parse(nonePayload.raw ?? "") as { agents?: { list?: Array<{ id?: string; skills?: string[] }> } })
        .agents?.list?.find((entry) => entry.id === "agent-1")
    ).toEqual({ id: "agent-1", skills: [] });
    expect(
      (JSON.parse(allowPayload.raw ?? "") as {
        agents?: { list?: Array<{ id?: string; skills?: string[] }> };
      }).agents?.list?.find((entry) => entry.id === "agent-1")
    ).toEqual({ id: "agent-1", skills: ["github", "slack"] });
  });

  it("retries once after stale hash and preserves concurrent config changes", async () => {
    let getCount = 0;
    let setCount = 0;
    const client = {
      call: vi.fn(async (method: string, params?: unknown) => {
        if (method === "config.get") {
          getCount += 1;
          if (getCount === 1) {
            return {
              exists: true,
              hash: "cfg-retry-1",
              config: {
                gateway: { reload: { mode: "hybrid" } },
                agents: { list: [{ id: "agent-1" }] },
              },
            };
          }
          return {
            exists: true,
            hash: "cfg-retry-2",
            config: {
              gateway: { reload: { mode: "off" } },
              agents: { list: [{ id: "agent-1" }] },
            },
          };
        }
        if (method === "config.set") {
          setCount += 1;
          const payload = params as { raw?: string; baseHash?: string };
          const parsed = JSON.parse(payload.raw ?? "") as {
            gateway?: { reload?: { mode?: string } };
            agents?: { list?: Array<{ id?: string; skills?: string[] }> };
          };
          if (setCount === 1) {
            expect(payload.baseHash).toBe("cfg-retry-1");
            expect(parsed.gateway?.reload?.mode).toBe("hybrid");
            throw new GatewayResponseError({
              code: "INVALID_REQUEST",
              message: "config changed since last load; re-run config.get and retry",
            });
          }
          expect(payload.baseHash).toBe("cfg-retry-2");
          expect(parsed.gateway?.reload?.mode).toBe("off");
          expect(parsed.agents?.list?.find((entry) => entry.id === "agent-1")).toEqual({
            id: "agent-1",
            skills: ["github"],
          });
          return { ok: true };
        }
        throw new Error(`unexpected method ${method}`);
      }),
    } as unknown as GatewayClient;

    await updateGatewayAgentSkillsAllowlist({
      client,
      agentId: "agent-1",
      mode: "allowlist",
      skillNames: ["github"],
    });

    expect(getCount).toBe(2);
    expect(setCount).toBe(2);
  });

  it("fails fast when mode allowlist omits skill names", async () => {
    const client = {
      call: vi.fn(),
    } as unknown as GatewayClient;

    await expect(
      updateGatewayAgentSkillsAllowlist({
        client,
        agentId: "agent-1",
        mode: "allowlist",
      })
    ).rejects.toThrow("Skills allowlist is required when mode is allowlist.");
    expect(client.call).not.toHaveBeenCalled();
  });

  it("skips config.set when mode all is already implied", async () => {
    const client = {
      call: vi.fn(async (method: string) => {
        if (method === "config.get") {
          return {
            exists: true,
            hash: "cfg-skip-write",
            config: { agents: { list: [{ id: "other-agent" }] } },
          };
        }
        if (method === "config.set") {
          throw new Error("config.set should not be called for no-op mode all");
        }
        throw new Error(`unexpected method ${method}`);
      }),
    } as unknown as GatewayClient;

    await updateGatewayAgentSkillsAllowlist({
      client,
      agentId: "agent-1",
      mode: "all",
    });

    expect(client.call).toHaveBeenCalledTimes(1);
    expect(client.call).toHaveBeenCalledWith("config.get", {});
  });

  it("skips config.set when mode all has no explicit skills on existing agent entry", async () => {
    const client = {
      call: vi.fn(async (method: string) => {
        if (method === "config.get") {
          return {
            exists: true,
            hash: "cfg-skip-write-existing",
            config: { agents: { list: [{ id: "agent-1", name: "Agent One" }] } },
          };
        }
        if (method === "config.set") {
          throw new Error("config.set should not be called for no-op mode all");
        }
        throw new Error(`unexpected method ${method}`);
      }),
    } as unknown as GatewayClient;

    await updateGatewayAgentSkillsAllowlist({
      client,
      agentId: "agent-1",
      mode: "all",
    });

    expect(client.call).toHaveBeenCalledTimes(1);
    expect(client.call).toHaveBeenCalledWith("config.get", {});
  });

  it("skips config.set when allowlist is unchanged after normalization", async () => {
    const client = {
      call: vi.fn(async (method: string) => {
        if (method === "config.get") {
          return {
            exists: true,
            hash: "cfg-skip-write-allowlist",
            config: { agents: { list: [{ id: "agent-1", skills: [" github ", "slack"] }] } },
          };
        }
        if (method === "config.set") {
          throw new Error("config.set should not be called for unchanged allowlist");
        }
        throw new Error(`unexpected method ${method}`);
      }),
    } as unknown as GatewayClient;

    await updateGatewayAgentSkillsAllowlist({
      client,
      agentId: "agent-1",
      mode: "allowlist",
      skillNames: ["slack", "github", "github"],
    });

    expect(client.call).toHaveBeenCalledTimes(1);
    expect(client.call).toHaveBeenCalledWith("config.get", {});
  });
});
