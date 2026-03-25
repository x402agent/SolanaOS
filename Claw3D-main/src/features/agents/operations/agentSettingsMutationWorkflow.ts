import {
  resolveMutationStartGuard,
  type MutationStartGuardResult,
} from "@/features/agents/operations/mutationLifecycleWorkflow";

export const RESERVED_MAIN_AGENT_ID = "main";

type GuardedActionKind =
  | "delete-agent"
  | "rename-agent"
  | "update-agent-permissions"
  | "use-all-skills"
  | "disable-all-skills"
  | "set-skills-allowlist"
  | "set-skill-enabled"
  | "set-skill-global-enabled"
  | "install-skill"
  | "remove-skill"
  | "save-skill-api-key";
type CronActionKind = "run-cron-job" | "delete-cron-job";

export type AgentSettingsMutationRequest =
  | { kind: GuardedActionKind; agentId: string; skillName?: string; skillKey?: string }
  | { kind: "create-cron-job"; agentId: string }
  | { kind: CronActionKind; agentId: string; jobId: string };

export type AgentSettingsMutationContext = {
  status: "connected" | "connecting" | "disconnected";
  hasCreateBlock: boolean;
  hasRenameBlock: boolean;
  hasDeleteBlock: boolean;
  cronCreateBusy: boolean;
  cronRunBusyJobId: string | null;
  cronDeleteBusyJobId: string | null;
};

export type AgentSettingsMutationDenyReason =
  | "start-guard-deny"
  | "reserved-main-delete"
  | "cron-action-busy"
  | "missing-agent-id"
  | "missing-job-id"
  | "missing-skill-name"
  | "missing-skill-key";

export type AgentSettingsMutationDecision =
  | {
      kind: "allow";
      normalizedAgentId: string;
      normalizedJobId?: string;
    }
  | {
      kind: "deny";
      reason: AgentSettingsMutationDenyReason;
      message: string | null;
      guardReason?: Exclude<MutationStartGuardResult, { kind: "allow" }>["reason"];
    };

const normalizeId = (value: string) => value.trim();

const isGuardedAction = (
  kind: AgentSettingsMutationRequest["kind"]
): kind is GuardedActionKind =>
  kind === "delete-agent" ||
  kind === "rename-agent" ||
  kind === "update-agent-permissions" ||
  kind === "use-all-skills" ||
  kind === "disable-all-skills" ||
  kind === "set-skills-allowlist" ||
  kind === "set-skill-enabled" ||
  kind === "set-skill-global-enabled" ||
  kind === "install-skill" ||
  kind === "remove-skill" ||
  kind === "save-skill-api-key";

const isCronActionBusy = (context: AgentSettingsMutationContext) =>
  context.cronCreateBusy ||
  Boolean(context.cronRunBusyJobId?.trim()) ||
  Boolean(context.cronDeleteBusyJobId?.trim());

export const planAgentSettingsMutation = (
  request: AgentSettingsMutationRequest,
  context: AgentSettingsMutationContext
): AgentSettingsMutationDecision => {
  const normalizedAgentId = normalizeId(request.agentId);
  if (!normalizedAgentId) {
    return {
      kind: "deny",
      reason: "missing-agent-id",
      message: null,
    };
  }

  if (isGuardedAction(request.kind)) {
    const startGuard = resolveMutationStartGuard({
      status: context.status,
      hasCreateBlock: context.hasCreateBlock,
      hasRenameBlock: context.hasRenameBlock,
      hasDeleteBlock: context.hasDeleteBlock,
    });
    if (startGuard.kind === "deny") {
      return {
        kind: "deny",
        reason: "start-guard-deny",
        message: null,
        guardReason: startGuard.reason,
      };
    }
  }

  if (request.kind === "delete-agent" && normalizedAgentId === RESERVED_MAIN_AGENT_ID) {
    return {
      kind: "deny",
      reason: "reserved-main-delete",
      message: "The main agent cannot be deleted.",
    };
  }

  if (request.kind === "run-cron-job" || request.kind === "delete-cron-job") {
    const normalizedJobId = normalizeId(request.jobId);
    if (!normalizedJobId) {
      return {
        kind: "deny",
        reason: "missing-job-id",
        message: null,
      };
    }

    if (isCronActionBusy(context)) {
      return {
        kind: "deny",
        reason: "cron-action-busy",
        message: null,
      };
    }

    return {
      kind: "allow",
      normalizedAgentId,
      normalizedJobId,
    };
  }

  if (request.kind === "set-skill-enabled") {
    const normalizedSkillName = normalizeId(request.skillName ?? "");
    if (!normalizedSkillName) {
      return {
        kind: "deny",
        reason: "missing-skill-name",
        message: null,
      };
    }
  }

  if (
    request.kind === "set-skill-global-enabled" ||
    request.kind === "install-skill" ||
    request.kind === "remove-skill" ||
    request.kind === "save-skill-api-key"
  ) {
    const normalizedSkillKey = normalizeId(request.skillKey ?? "");
    if (!normalizedSkillKey) {
      return {
        kind: "deny",
        reason: "missing-skill-key",
        message: null,
      };
    }
  }

  return {
    kind: "allow",
    normalizedAgentId,
  };
};
