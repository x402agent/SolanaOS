import { describe, expect, it, vi } from "vitest";

import {
  ensureGatewayReloadModeHotForLocalStudio,
  shouldAwaitDisconnectRestartForRemoteMutation,
} from "@/lib/gateway/gatewayReloadMode";
import { GatewayResponseError, type GatewayClient } from "@/lib/gateway/GatewayClient";

describe("ensureGatewayReloadModeHotForLocalStudio", () => {
  it("skips non-local upstream gateways", async () => {
    const client = { call: vi.fn() } as unknown as GatewayClient;
    await ensureGatewayReloadModeHotForLocalStudio({
      client,
      upstreamGatewayUrl: "ws://10.0.0.5:18789",
    });
    expect((client.call as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });

  it("sets gateway.reload.mode=hot when missing", async () => {
    const client = {
      call: vi.fn(async (method: string, params?: unknown) => {
        if (method === "config.get") {
          return { exists: true, hash: "hash-1", config: {} };
        }
        if (method === "config.set") {
          const payload = params as { raw?: string; baseHash?: string };
          expect(payload.baseHash).toBe("hash-1");
          const parsed = JSON.parse(payload.raw ?? "{}") as {
            gateway?: { reload?: { mode?: string } };
          };
          expect(parsed.gateway?.reload?.mode).toBe("hot");
          return { ok: true };
        }
        throw new Error(`unexpected method: ${method}`);
      }),
    } as unknown as GatewayClient;

    await ensureGatewayReloadModeHotForLocalStudio({
      client,
      upstreamGatewayUrl: "ws://127.0.0.1:18789",
    });
  });

  it("does nothing when mode is already hot", async () => {
    const client = {
      call: vi.fn(async (method: string) => {
        if (method === "config.get") {
          return { exists: true, hash: "hash-1", config: { gateway: { reload: { mode: "hot" } } } };
        }
        if (method === "config.set") {
          throw new Error("config.set should not be called");
        }
        throw new Error(`unexpected method: ${method}`);
      }),
    } as unknown as GatewayClient;

    await ensureGatewayReloadModeHotForLocalStudio({
      client,
      upstreamGatewayUrl: "ws://localhost:18789",
    });
  });

  it("retries once on base-hash mismatch", async () => {
    let getCount = 0;
    const client = {
      call: vi.fn(async (method: string) => {
        if (method === "config.get") {
          getCount += 1;
          return { exists: true, hash: getCount === 1 ? "hash-1" : "hash-2", config: {} };
        }
        if (method === "config.set") {
          if (getCount === 1) {
            throw new GatewayResponseError({
              code: "INVALID_REQUEST",
              message: "config changed since last load; re-run config.get and retry",
            });
          }
          return { ok: true };
        }
        throw new Error(`unexpected method: ${method}`);
      }),
    } as unknown as GatewayClient;

    await ensureGatewayReloadModeHotForLocalStudio({
      client,
      upstreamGatewayUrl: "ws://127.0.0.1:18789",
    });

    const setCalls = (client.call as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([method]) => method === "config.set",
    );
    expect(setCalls.length).toBe(2);
    expect(getCount).toBe(2);
  });
});

describe("shouldAwaitDisconnectRestartForRemoteMutation", () => {
  it("returns false for cached hot mode", async () => {
    const client = { call: vi.fn() } as unknown as GatewayClient;
    const shouldAwait = await shouldAwaitDisconnectRestartForRemoteMutation({
      client,
      cachedConfigSnapshot: { config: { gateway: { reload: { mode: "hot" } } } },
    });
    expect(shouldAwait).toBe(false);
    expect((client.call as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });

  it("returns false for cached off mode", async () => {
    const client = { call: vi.fn() } as unknown as GatewayClient;
    const shouldAwait = await shouldAwaitDisconnectRestartForRemoteMutation({
      client,
      cachedConfigSnapshot: { config: { gateway: { reload: { mode: "off" } } } },
    });
    expect(shouldAwait).toBe(false);
    expect((client.call as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });

  it("returns false for cached hybrid mode", async () => {
    const client = { call: vi.fn() } as unknown as GatewayClient;
    const shouldAwait = await shouldAwaitDisconnectRestartForRemoteMutation({
      client,
      cachedConfigSnapshot: { config: { gateway: { reload: { mode: "hybrid" } } } },
    });
    expect(shouldAwait).toBe(false);
    expect((client.call as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });

  it("treats missing cached reload mode as hybrid", async () => {
    const client = { call: vi.fn() } as unknown as GatewayClient;
    const shouldAwait = await shouldAwaitDisconnectRestartForRemoteMutation({
      client,
      cachedConfigSnapshot: { config: {} },
    });
    expect(shouldAwait).toBe(false);
    expect((client.call as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });

  it("returns true when reload mode is unknown", async () => {
    const client = { call: vi.fn() } as unknown as GatewayClient;
    const shouldAwait = await shouldAwaitDisconnectRestartForRemoteMutation({
      client,
      cachedConfigSnapshot: { config: { gateway: { reload: { mode: "restart" } } } },
    });
    expect(shouldAwait).toBe(true);
    expect((client.call as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });

  it("loads config when cache is missing and returns false for hot mode", async () => {
    const client = {
      call: vi.fn(async (method: string) => {
        if (method !== "config.get") {
          throw new Error(`unexpected method: ${method}`);
        }
        return { config: { gateway: { reload: { mode: "hot" } } } };
      }),
    } as unknown as GatewayClient;
    const shouldAwait = await shouldAwaitDisconnectRestartForRemoteMutation({
      client,
      cachedConfigSnapshot: null,
    });
    expect(shouldAwait).toBe(false);
    expect((client.call as ReturnType<typeof vi.fn>).mock.calls).toEqual([["config.get", {}]]);
  });

  it("loads config when cache is missing and treats missing reload mode as hybrid", async () => {
    const client = {
      call: vi.fn(async (method: string) => {
        if (method !== "config.get") {
          throw new Error(`unexpected method: ${method}`);
        }
        return { config: {} };
      }),
    } as unknown as GatewayClient;
    const shouldAwait = await shouldAwaitDisconnectRestartForRemoteMutation({
      client,
      cachedConfigSnapshot: null,
    });
    expect(shouldAwait).toBe(false);
    expect((client.call as ReturnType<typeof vi.fn>).mock.calls).toEqual([["config.get", {}]]);
  });
});
