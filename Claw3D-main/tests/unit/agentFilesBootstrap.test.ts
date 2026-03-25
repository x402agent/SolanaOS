import { describe, expect, it, vi } from "vitest";
import { writeGatewayAgentFiles } from "@/lib/gateway/agentFiles";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";

describe("writeGatewayAgentFiles", () => {
  it("writes each provided file to agents.files.set", async () => {
    const client = {
      call: vi.fn(async () => ({ ok: true })),
    } as unknown as GatewayClient;

    await writeGatewayAgentFiles({
      client,
      agentId: "agent-1",
      files: {
        "AGENTS.md": "# mission",
        "SOUL.md": "# tone",
      },
    });

    expect(client.call).toHaveBeenCalledTimes(2);
    expect((client.call as ReturnType<typeof vi.fn>).mock.calls[0]).toEqual([
      "agents.files.set",
      { agentId: "agent-1", name: "AGENTS.md", content: "# mission" },
    ]);
    expect((client.call as ReturnType<typeof vi.fn>).mock.calls[1]).toEqual([
      "agents.files.set",
      { agentId: "agent-1", name: "SOUL.md", content: "# tone" },
    ]);
  });

  it("fails fast for empty agent id", async () => {
    const client = {
      call: vi.fn(async () => ({ ok: true })),
    } as unknown as GatewayClient;

    await expect(
      writeGatewayAgentFiles({
        client,
        agentId: "   ",
        files: { "AGENTS.md": "# mission" },
      })
    ).rejects.toThrow("agentId is required.");
    expect(client.call).not.toHaveBeenCalled();
  });
});
