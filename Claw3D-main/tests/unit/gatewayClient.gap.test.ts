import { describe, expect, it, vi } from "vitest";

import { GatewayClient } from "@/lib/gateway/GatewayClient";

let lastOpts: Record<string, unknown> | null = null;

vi.mock("@/lib/gateway/solanaos/GatewayBrowserClient", () => {
  class GatewayBrowserClient {
    connected = true;
    constructor(opts: Record<string, unknown>) {
      lastOpts = opts;
    }
    start() {}
    stop() {}
    request() {
      return Promise.resolve({});
    }
  }
  return { GatewayBrowserClient };
});

describe("GatewayClient onGap", () => {
  it("forwards gateway seq gaps to subscribers", async () => {
    const client = new GatewayClient();
    const onGap = vi.fn();
    client.onGap(onGap);

    const connectPromise = client.connect({ gatewayUrl: "ws://example.invalid" });
    if (!lastOpts) throw new Error("Expected GatewayBrowserClient to be constructed");

    const onHello = lastOpts.onHello as ((hello: unknown) => void) | undefined;
    if (!onHello) throw new Error("Expected onHello callback");
    onHello({} as never);

    await connectPromise;

    const gapCb = lastOpts.onGap as ((info: { expected: number; received: number }) => void) | undefined;
    if (!gapCb) throw new Error("Expected onGap callback");
    gapCb({ expected: 10, received: 13 });

    expect(onGap).toHaveBeenCalledTimes(1);
    expect(onGap).toHaveBeenCalledWith({ expected: 10, received: 13 });
  });
});

