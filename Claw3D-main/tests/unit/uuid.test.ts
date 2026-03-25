import { describe, expect, it, vi } from "vitest";

import { randomUUID } from "@/lib/uuid";

describe("randomUUID", () => {
  it("uses crypto.randomUUID when available", () => {
    const cryptoLike = { randomUUID: vi.fn(() => "fixed-uuid") };
    expect(randomUUID(cryptoLike)).toBe("fixed-uuid");
    expect(cryptoLike.randomUUID).toHaveBeenCalledTimes(1);
  });

  it("uses crypto.getRandomValues when randomUUID is missing", () => {
    const getRandomValues = vi.fn((arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) arr[i] = i;
      return arr;
    });

    const out = randomUUID({ getRandomValues });
    expect(getRandomValues).toHaveBeenCalledTimes(1);
    expect(out).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("falls back when no crypto APIs are available", () => {
    const out = randomUUID(null);
    expect(out).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
