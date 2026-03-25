import { describe, expect, it } from "vitest";

import {
  normalizeBrowserPreviewUrl,
  resolveBrowserControlBaseUrl,
  shouldPreferBrowserScreenshot,
} from "@/lib/office/browserPreview";

describe("browserPreview helpers", () => {
  it("prefers screenshots for frame-blocked social sites", () => {
    expect(shouldPreferBrowserScreenshot("https://x.com/example-user")).toBe(true);
    expect(shouldPreferBrowserScreenshot("https://www.linkedin.com/in/example")).toBe(true);
    expect(shouldPreferBrowserScreenshot("https://example.com/dashboard")).toBe(false);
  });

  it("derives the local browser control service url from the gateway websocket url", () => {
    expect(resolveBrowserControlBaseUrl("ws://localhost:18789")).toBe("http://localhost:18791");
    expect(resolveBrowserControlBaseUrl("ws://0.0.0.0:19000")).toBe("http://127.0.0.1:19002");
    expect(resolveBrowserControlBaseUrl("wss://localhost:443")).toBe("https://localhost:445");
  });

  it("ignores non-local gateway urls", () => {
    expect(resolveBrowserControlBaseUrl("ws://10.0.0.42:18789")).toBeNull();
  });

  it("normalizes hash-only browser url differences", () => {
    expect(
      normalizeBrowserPreviewUrl("https://example.com/dashboard#section-a"),
    ).toBe("https://example.com/dashboard");
  });
});
