import { describe, expect, it, vi } from "vitest";

import { GatewayResponseError } from "@/lib/gateway/GatewayClient";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { updateGatewayAgentOverrides } from "@/lib/gateway/agentConfig";

describe("updateGatewayAgentOverrides", () => {
  it("writes additive alsoAllow entries for per-agent tools", async () => {
    const client = {
      call: vi.fn(async (method: string, params?: unknown) => {
        if (method === "config.get") {
          return {
            exists: true,
            hash: "cfg-additive-1",
            config: {
              agents: {
                list: [{ id: "agent-1", tools: { profile: "coding" } }],
              },
            },
          };
        }
        if (method === "config.set") {
          const raw = (params as { raw?: string }).raw ?? "";
          const parsed = JSON.parse(raw) as {
            agents?: { list?: Array<{ id?: string; tools?: { profile?: string; alsoAllow?: string[]; deny?: string[] } }> };
          };
          const entry = parsed.agents?.list?.find((item) => item.id === "agent-1");
          expect(entry?.tools).toEqual({
            profile: "coding",
            alsoAllow: ["group:web", "group:runtime"],
            deny: ["group:fs"],
          });
          return { ok: true };
        }
        throw new Error(`unexpected method ${method}`);
      }),
    } as unknown as GatewayClient;

    await updateGatewayAgentOverrides({
      client,
      agentId: "agent-1",
      overrides: {
        tools: {
          profile: "coding",
          alsoAllow: ["group:web", "group:web", " group:runtime "],
          deny: ["group:fs", "group:fs"],
        },
      },
    });
  });

  it("drops legacy allow when writing additive alsoAllow", async () => {
    const client = {
      call: vi.fn(async (method: string, params?: unknown) => {
        if (method === "config.get") {
          return {
            exists: true,
            hash: "cfg-additive-2",
            config: {
              agents: {
                list: [{ id: "agent-1", tools: { profile: "coding", allow: ["group:web"] } }],
              },
            },
          };
        }
        if (method === "config.set") {
          const raw = (params as { raw?: string }).raw ?? "";
          const parsed = JSON.parse(raw) as {
            agents?: {
              list?: Array<{
                id?: string;
                tools?: {
                  profile?: string;
                  allow?: string[];
                  alsoAllow?: string[];
                  deny?: string[];
                };
              }>;
            };
          };
          const entry = parsed.agents?.list?.find((item) => item.id === "agent-1");
          expect(entry?.tools).toEqual({
            profile: "coding",
            alsoAllow: ["group:runtime"],
            deny: ["group:fs"],
          });
          return { ok: true };
        }
        throw new Error(`unexpected method ${method}`);
      }),
    } as unknown as GatewayClient;

    await updateGatewayAgentOverrides({
      client,
      agentId: "agent-1",
      overrides: {
        tools: {
          alsoAllow: ["group:runtime"],
          deny: ["group:fs"],
        },
      },
    });
  });

  it("preserves redacted non-agent fields when writing full config", async () => {
    const client = {
      call: vi.fn(async (method: string, params?: unknown) => {
        if (method === "config.get") {
          return {
            exists: true,
            hash: "cfg-redacted-1",
            config: {
              models: {
                providers: {
                  xai: {
                    models: [{ id: "grok", maxTokens: "__SOLANAOS_REDACTED__" }],
                  },
                },
              },
              agents: {
                list: [{ id: "agent-1" }],
              },
            },
          };
        }
        if (method === "config.set") {
          const raw = (params as { raw?: string }).raw ?? "";
          const parsed = JSON.parse(raw) as Record<string, unknown>;
          expect(parsed.models).toEqual({
            providers: {
              xai: {
                models: [{ id: "grok", maxTokens: "__SOLANAOS_REDACTED__" }],
              },
            },
          });
          expect(parsed.agents).toEqual({
            list: [
              {
                id: "agent-1",
                tools: {
                  profile: "coding",
                  alsoAllow: ["group:runtime"],
                },
              },
            ],
          });
          return { ok: true };
        }
        throw new Error(`unexpected method ${method}`);
      }),
    } as unknown as GatewayClient;

    await updateGatewayAgentOverrides({
      client,
      agentId: "agent-1",
      overrides: {
        tools: {
          profile: "coding",
          alsoAllow: ["group:runtime"],
        },
      },
    });
  });

  it("preserves concurrent config changes when config.set retries after stale hash", async () => {
    let configGetCount = 0;
    let configSetCount = 0;
    const callOrder: string[] = [];
    const client = {
      call: vi.fn(async (method: string, params?: unknown) => {
        callOrder.push(method);
        if (method === "config.get") {
          configGetCount += 1;
          if (configGetCount === 1) {
            return {
              exists: true,
              hash: "cfg-retry-1",
              config: {
                gateway: {
                  reload: {
                    mode: "hybrid",
                  },
                },
                agents: {
                  list: [{ id: "agent-1" }],
                },
              },
            };
          }
          return {
            exists: true,
            hash: "cfg-retry-2",
            config: {
              gateway: {
                reload: {
                  mode: "off",
                },
              },
              agents: {
                list: [{ id: "agent-1" }],
              },
            },
          };
        }
        if (method === "config.set") {
          configSetCount += 1;
          const payload = params as { raw?: string; baseHash?: string };
          const parsed = JSON.parse(payload.raw ?? "") as {
            gateway?: { reload?: { mode?: string } };
            agents?: {
              list?: Array<{
                id?: string;
                tools?: {
                  profile?: string;
                  alsoAllow?: string[];
                };
              }>;
            };
          };
          if (configSetCount === 1) {
            expect(payload.baseHash).toBe("cfg-retry-1");
            expect(parsed.gateway?.reload?.mode).toBe("hybrid");
            throw new GatewayResponseError({
              code: "INVALID_REQUEST",
              message: "config changed since last load; re-run config.get and retry",
            });
          }
          expect(payload.baseHash).toBe("cfg-retry-2");
          expect(parsed.gateway?.reload?.mode).toBe("off");
          expect(parsed.agents?.list?.find((entry) => entry.id === "agent-1")?.tools).toEqual({
            profile: "coding",
            alsoAllow: ["group:web"],
          });
          return { ok: true };
        }
        throw new Error(`unexpected method ${method}`);
      }),
    } as unknown as GatewayClient;

    await updateGatewayAgentOverrides({
      client,
      agentId: "agent-1",
      overrides: {
        tools: {
          profile: "coding",
          alsoAllow: ["group:web"],
        },
      },
    });

    expect(configGetCount).toBe(2);
    expect(configSetCount).toBe(2);
    expect(callOrder).toEqual(["config.get", "config.set", "config.get", "config.set"]);
  });

  it("omits baseHash when config does not exist yet", async () => {
    let configSetCount = 0;
    const client = {
      call: vi.fn(async (method: string, params?: unknown) => {
        if (method === "config.get") {
          return {
            exists: false,
            config: {
              agents: {
                list: [],
              },
            },
          };
        }
        if (method === "config.set") {
          configSetCount += 1;
          const payload = params as { raw?: string; baseHash?: string };
          const parsed = JSON.parse(payload.raw ?? "") as {
            agents?: {
              list?: Array<{
                id?: string;
                tools?: {
                  alsoAllow?: string[];
                  deny?: string[];
                };
              }>;
            };
          };
          expect(payload.baseHash).toBeUndefined();
          expect(parsed.agents?.list?.find((entry) => entry.id === "agent-1")?.tools).toEqual({
            alsoAllow: ["group:runtime"],
            deny: ["group:fs"],
          });
          return { ok: true };
        }
        throw new Error(`unexpected method ${method}`);
      }),
    } as unknown as GatewayClient;

    await updateGatewayAgentOverrides({
      client,
      agentId: "agent-1",
      overrides: {
        tools: {
          alsoAllow: ["group:runtime"],
          deny: ["group:fs"],
        },
      },
    });

    expect(configSetCount).toBe(1);
  });

  it("fails after a single stale-hash retry attempt", async () => {
    let configGetCount = 0;
    let configSetCount = 0;
    const client = {
      call: vi.fn(async (method: string) => {
        if (method === "config.get") {
          configGetCount += 1;
          return {
            exists: true,
            hash: `cfg-stale-${configGetCount}`,
            config: {
              agents: {
                list: [{ id: "agent-1" }],
              },
            },
          };
        }
        if (method === "config.set") {
          configSetCount += 1;
          throw new GatewayResponseError({
            code: "INVALID_REQUEST",
            message: "config changed since last load; re-run config.get and retry",
          });
        }
        throw new Error(`unexpected method ${method}`);
      }),
    } as unknown as GatewayClient;

    await expect(
      updateGatewayAgentOverrides({
        client,
        agentId: "agent-1",
        overrides: {
          tools: {
            alsoAllow: ["group:runtime"],
          },
        },
      })
    ).rejects.toBeInstanceOf(GatewayResponseError);

    expect(configGetCount).toBe(2);
    expect(configSetCount).toBe(2);
  });

  it("fails fast when both allow and alsoAllow are provided", async () => {
    const client = {
      call: vi.fn(),
    } as unknown as GatewayClient;

    await expect(
      updateGatewayAgentOverrides({
        client,
        agentId: "agent-1",
        overrides: {
          tools: {
            allow: ["group:runtime"],
            alsoAllow: ["group:web"],
          },
        },
      })
    ).rejects.toThrow("Agent tools overrides cannot set both allow and alsoAllow.");

    expect(client.call).not.toHaveBeenCalled();
  });
});
