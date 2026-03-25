import { describe, expect, it } from "vitest";
import {
  AGENT_STATUS_BADGE_CLASS,
  AGENT_STATUS_LABEL,
  GATEWAY_STATUS_BADGE_CLASS,
  GATEWAY_STATUS_LABEL,
  NEEDS_APPROVAL_BADGE_CLASS,
  resolveAgentStatusBadgeClass,
  resolveAgentStatusLabel,
  resolveGatewayStatusBadgeClass,
  resolveGatewayStatusLabel,
} from "@/features/agents/components/colorSemantics";

describe("colorSemantics", () => {
  it("maps agent statuses to semantic badge classes and labels", () => {
    expect(AGENT_STATUS_LABEL.idle).toBe("Idle");
    expect(AGENT_STATUS_LABEL.running).toBe("Running");
    expect(AGENT_STATUS_LABEL.error).toBe("Error");

    expect(AGENT_STATUS_BADGE_CLASS.idle).toBe("ui-badge-status-idle");
    expect(AGENT_STATUS_BADGE_CLASS.running).toBe("ui-badge-status-running");
    expect(AGENT_STATUS_BADGE_CLASS.error).toBe("ui-badge-status-error");

    expect(resolveAgentStatusLabel("idle")).toBe("Idle");
    expect(resolveAgentStatusBadgeClass("running")).toBe("ui-badge-status-running");
  });

  it("maps gateway statuses to semantic badge classes and labels", () => {
    expect(GATEWAY_STATUS_LABEL.disconnected).toBe("Disconnected");
    expect(GATEWAY_STATUS_LABEL.connecting).toBe("Connecting");
    expect(GATEWAY_STATUS_LABEL.connected).toBe("Connected");

    expect(GATEWAY_STATUS_BADGE_CLASS.disconnected).toBe("ui-badge-status-disconnected");
    expect(GATEWAY_STATUS_BADGE_CLASS.connecting).toBe("ui-badge-status-connecting");
    expect(GATEWAY_STATUS_BADGE_CLASS.connected).toBe("ui-badge-status-connected");

    expect(resolveGatewayStatusLabel("connected")).toBe("Connected");
    expect(resolveGatewayStatusBadgeClass("disconnected")).toBe("ui-badge-status-disconnected");
  });

  it("keeps approval state on its own semantic class", () => {
    expect(NEEDS_APPROVAL_BADGE_CLASS).toBe("ui-badge-approval");
  });
});
