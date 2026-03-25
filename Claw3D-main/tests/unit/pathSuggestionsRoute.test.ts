import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

let tempHome: string | null = null;

const setupHome = () => {
  tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "solanaos-home-"));
  vi.spyOn(os, "homedir").mockReturnValue(tempHome);

  fs.mkdirSync(path.join(tempHome, "Documents"), { recursive: true });
  fs.mkdirSync(path.join(tempHome, "Downloads"), { recursive: true });
  fs.writeFileSync(path.join(tempHome, "Doc.txt"), "doc", "utf8");
  fs.writeFileSync(path.join(tempHome, "Notes.txt"), "notes", "utf8");
  fs.writeFileSync(path.join(tempHome, ".secret"), "hidden", "utf8");
};

const cleanupHome = () => {
  const home = tempHome;
  tempHome = null;
  vi.restoreAllMocks();
  if (!home) return;
  fs.rmSync(home, { recursive: true, force: true });
};

let GET: typeof import("@/app/api/path-suggestions/route")["GET"];

beforeAll(async () => {
  ({ GET } = await import("@/app/api/path-suggestions/route"));
});

beforeEach(setupHome);
afterEach(cleanupHome);

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

describe("/api/path-suggestions route", () => {
  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("returns non-hidden entries for home by default", async () => {
    const response = await GET(new Request("http://localhost/api/path-suggestions"));
    const body = (await response.json()) as { entries: Array<{ displayPath: string }> };

    expect(response.status).toBe(200);
    expect(body.entries.map((entry) => entry.displayPath)).toEqual([
      "~/Documents/",
      "~/Downloads/",
      "~/Doc.txt",
      "~/Notes.txt",
    ]);
  });

  it("filters by prefix within the current directory", async () => {
    const response = await GET(new Request("http://localhost/api/path-suggestions?q=~/Doc"));
    const body = (await response.json()) as { entries: Array<{ displayPath: string }> };

    expect(response.status).toBe(200);
    expect(body.entries.map((entry) => entry.displayPath)).toEqual([
      "~/Documents/",
      "~/Doc.txt",
    ]);
  });

  it("rejects paths outside the home directory", async () => {
    const response = await GET(new Request("http://localhost/api/path-suggestions?q=~/../"));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/home/i);
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("returns 404 for missing directories", async () => {
    const response = await GET(
      new Request("http://localhost/api/path-suggestions?q=~/Missing/")
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(404);
    expect(body.error).toMatch(/does not exist/i);
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});
