import { describe, expect, it, vi, afterEach } from "vitest";

import { fetchJson } from "@/lib/http";

type MockResponse = {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
};

const createResponse = (body: string, ok: boolean, status: number): MockResponse => ({
  ok,
  status,
  text: vi.fn().mockResolvedValue(body),
});

describe("fetchJson", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws when response is not ok", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createResponse(JSON.stringify({ error: "Nope" }), false, 400)
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(fetchJson("/api/test")).rejects.toThrow("Nope");
  });

  it("returns parsed JSON for ok responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createResponse(JSON.stringify({ ok: true }), true, 200)
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(fetchJson("/api/test")).resolves.toEqual({ ok: true });
  });
});
