import { afterEach, describe, expect, it, vi } from "vitest";

import { GatewayClient } from "@/lib/gateway/GatewayClient";

type MockClientOptions = {
  token?: unknown;
  onHello?: (hello: unknown) => void;
  onClose?: (info: { code: number; reason: string }) => void;
};

type MockInstance = {
  opts: MockClientOptions;
  stopped: boolean;
};

let instances: MockInstance[] = [];

vi.mock("@/lib/gateway/solanaos/GatewayBrowserClient", () => {
  class GatewayBrowserClient {
    connected = false;
    private index: number;

    constructor(opts: MockClientOptions) {
      this.index = instances.length;
      instances.push({ opts, stopped: false });
    }

    start() {
      this.connected = true;
    }

    stop() {
      this.connected = false;
      instances[this.index]!.stopped = true;
    }

    request() {
      return Promise.resolve({});
    }
  }

  return { GatewayBrowserClient };
});

afterEach(() => {
  instances = [];
});

describe("GatewayClient reconnect recovery", () => {
  it("allows a fresh connect after unexpected close", async () => {
    const client = new GatewayClient();
    const statuses: string[] = [];
    client.onStatus((status) => statuses.push(status));

    const firstConnect = client.connect({
      gatewayUrl: "ws://example.invalid",
      token: "old-token",
    });
    const first = instances[0];
    if (!first) throw new Error("Expected first GatewayBrowserClient instance");

    const onHelloFirst = first.opts.onHello;
    const onCloseFirst = first.opts.onClose;
    if (!onHelloFirst || !onCloseFirst) {
      throw new Error("Expected first instance callbacks");
    }

    onHelloFirst({});
    await expect(firstConnect).resolves.toBeUndefined();

    onCloseFirst({ code: 1012, reason: "upstream closed" });

    expect(first.stopped).toBe(true);
    expect(statuses.at(-1)).toBe("disconnected");

    const secondConnect = client.connect({
      gatewayUrl: "ws://example.invalid",
      token: "new-token",
    });
    const second = instances[1];
    if (!second) throw new Error("Expected second GatewayBrowserClient instance");

    expect(second.opts.token).toBe("new-token");

    const onHelloSecond = second.opts.onHello;
    if (!onHelloSecond) {
      throw new Error("Expected second instance onHello callback");
    }

    onHelloSecond({});
    await expect(secondConnect).resolves.toBeUndefined();

    expect(statuses.at(-1)).toBe("connected");
  });

  it("ignores stale onClose callbacks from old instances", async () => {
    const client = new GatewayClient();
    const statuses: string[] = [];
    client.onStatus((status) => statuses.push(status));

    const firstConnect = client.connect({ gatewayUrl: "ws://example.invalid" });
    const first = instances[0];
    if (!first) throw new Error("Expected first GatewayBrowserClient instance");

    const onHelloFirst = first.opts.onHello;
    const onCloseFirst = first.opts.onClose;
    if (!onHelloFirst || !onCloseFirst) {
      throw new Error("Expected first instance callbacks");
    }

    onHelloFirst({});
    await firstConnect;

    onCloseFirst({ code: 1012, reason: "upstream closed" });

    const secondConnect = client.connect({ gatewayUrl: "ws://example.invalid" });
    const second = instances[1];
    if (!second) throw new Error("Expected second GatewayBrowserClient instance");

    const onHelloSecond = second.opts.onHello;
    if (!onHelloSecond) {
      throw new Error("Expected second instance onHello callback");
    }

    onHelloSecond({});
    await secondConnect;

    const statusCountBeforeStaleClose = statuses.length;
    onCloseFirst({ code: 1012, reason: "late stale close" });

    expect(statuses.length).toBe(statusCountBeforeStaleClose);
    expect(statuses.at(-1)).toBe("connected");
  });
});
