import { describe, expect, it, vi } from "vitest";

import { buildLatestUpdatePatch } from "@/features/agents/operations/latestUpdateWorkflow";
import { createSpecialLatestUpdateOperation } from "@/features/agents/operations/specialLatestUpdateOperation";
import { resolveLatestCronJobForAgent, type CronJobSummary } from "@/lib/cron/types";
import type { AgentState } from "@/features/agents/state/store";

const makeAgent = (overrides?: Partial<Pick<AgentState, "agentId" | "sessionKey" | "latestOverride" | "latestOverrideKind">>) => {
  return {
    agentId: "agent-1",
    sessionKey: "agent:agent-1:main",
    latestOverride: null,
    latestOverrideKind: null,
    ...overrides,
  } as unknown as AgentState;
};

describe("specialLatestUpdateOperation", () => {
  it("dispatches reset patch when intent resolves to reset", async () => {
    const agent = makeAgent({ latestOverrideKind: "cron" });

    const dispatchUpdateAgent = vi.fn();
    const operation = createSpecialLatestUpdateOperation({
      callGateway: async () => {
        throw new Error("callGateway should not be invoked for reset intent");
      },
      listCronJobs: async () => ({ jobs: [] }),
      resolveCronJobForAgent: () => null,
      formatCronJobDisplay: () => "",
      dispatchUpdateAgent,
      isDisconnectLikeError: () => false,
      logError: () => {},
    });

    await operation.update(agent.agentId, agent, "plain user prompt");

    expect(dispatchUpdateAgent).toHaveBeenCalledTimes(1);
    expect(dispatchUpdateAgent).toHaveBeenCalledWith(agent.agentId, buildLatestUpdatePatch(""));
  });

  it("selects heartbeat session, reads history, and stores last assistant response after a heartbeat prompt", async () => {
    const agent = makeAgent();

    const callGateway = vi.fn(async (method: string) => {
      if (method === "sessions.list") {
        return {
          sessions: [
            { key: "agent:agent-1:main", updatedAt: 200, origin: { label: "main" } },
            { key: "agent:agent-1:hb", updatedAt: 100, origin: { label: "Heartbeat" } },
          ],
        };
      }
      if (method === "chat.history") {
        return {
          messages: [
            { role: "user", content: "Read HEARTBEAT.md if it exists" },
            { role: "assistant", content: "First response" },
            { role: "assistant", content: "Second response" },
          ],
        };
      }
      throw new Error(`Unhandled gateway method: ${method}`);
    });

    const dispatchUpdateAgent = vi.fn();
    const operation = createSpecialLatestUpdateOperation({
      callGateway,
      listCronJobs: async () => ({ jobs: [] }),
      resolveCronJobForAgent: () => null,
      formatCronJobDisplay: () => "",
      dispatchUpdateAgent,
      isDisconnectLikeError: () => false,
      logError: () => {},
    });

    await operation.update(agent.agentId, agent, "heartbeat please");

    expect(callGateway).toHaveBeenCalledWith("sessions.list", expect.anything());
    expect(callGateway).toHaveBeenCalledWith("chat.history", expect.anything());
    expect(dispatchUpdateAgent).toHaveBeenCalledWith(
      agent.agentId,
      buildLatestUpdatePatch("Second response", "heartbeat")
    );
  });

  it("fetches cron jobs, selects latest cron for agentId, and stores formatted cron display", async () => {
    const agent = makeAgent();

    const jobs: CronJobSummary[] = [
      {
        id: "job-1",
        name: "Older",
        agentId: "agent-1",
        enabled: true,
        updatedAtMs: 1,
        schedule: { kind: "every", everyMs: 60000 },
        sessionTarget: "main",
        wakeMode: "now",
        payload: { kind: "systemEvent", text: "one" },
        state: {},
      },
      {
        id: "job-2",
        name: "Newer",
        agentId: "agent-1",
        enabled: true,
        updatedAtMs: 2,
        schedule: { kind: "every", everyMs: 60000 },
        sessionTarget: "main",
        wakeMode: "now",
        payload: { kind: "systemEvent", text: "two" },
        state: {},
      },
    ];

    const dispatchUpdateAgent = vi.fn();
    const operation = createSpecialLatestUpdateOperation({
      callGateway: async () => {
        throw new Error("callGateway should not be invoked for cron intent");
      },
      listCronJobs: async () => ({ jobs }),
      resolveCronJobForAgent: resolveLatestCronJobForAgent,
      formatCronJobDisplay: (job) => `formatted:${job.id}`,
      dispatchUpdateAgent,
      isDisconnectLikeError: () => false,
      logError: () => {},
    });

    await operation.update(agent.agentId, agent, "cron report pending");

    expect(dispatchUpdateAgent).toHaveBeenCalledWith(
      agent.agentId,
      buildLatestUpdatePatch("formatted:job-2", "cron")
    );
  });

  it("dedupes concurrent updates for same agentId while first is in flight", async () => {
    const agent = makeAgent();

    let resolveSessions!: (value: unknown) => void;
    const sessionsPromise = new Promise<unknown>((resolve) => {
      resolveSessions = resolve;
    });

    const callGateway = vi.fn((method: string) => {
      if (method === "sessions.list") {
        return sessionsPromise;
      }
      if (method === "chat.history") {
        return Promise.resolve({
          messages: [
            { role: "user", content: "Read HEARTBEAT.md if it exists" },
            { role: "assistant", content: "ok" },
          ],
        });
      }
      return Promise.reject(new Error(`Unhandled gateway method: ${method}`));
    });

    const dispatchUpdateAgent = vi.fn();
    const operation = createSpecialLatestUpdateOperation({
      callGateway,
      listCronJobs: async () => ({ jobs: [] }),
      resolveCronJobForAgent: () => null,
      formatCronJobDisplay: () => "",
      dispatchUpdateAgent,
      isDisconnectLikeError: () => false,
      logError: () => {},
    });

    const first = operation.update(agent.agentId, agent, "heartbeat please");
    const second = operation.update(agent.agentId, agent, "heartbeat please");
    await second;

    expect(callGateway).toHaveBeenCalledTimes(1);
    expect(callGateway).toHaveBeenCalledWith("sessions.list", expect.anything());

    resolveSessions({
      sessions: [{ key: "agent:agent-1:hb", updatedAt: 1, origin: { label: "heartbeat" } }],
    });
    await first;

    expect(callGateway).toHaveBeenCalledTimes(2);
    expect(callGateway).toHaveBeenCalledWith("chat.history", expect.anything());
    expect(dispatchUpdateAgent).toHaveBeenCalledWith(
      agent.agentId,
      buildLatestUpdatePatch("ok", "heartbeat")
    );
  });
});
