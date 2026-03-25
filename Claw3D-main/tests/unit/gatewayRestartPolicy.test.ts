import { describe, expect, it } from "vitest";

import { observeGatewayRestart } from "@/features/agents/operations/gatewayRestartPolicy";

describe("observeGatewayRestart", () => {
  it("marks_saw_disconnect_on_non_connected_status_and_completes_on_reconnect", () => {
    const start = { sawDisconnect: false };

    const connected = observeGatewayRestart(start, "connected");
    expect(connected).toEqual({ next: { sawDisconnect: false }, restartComplete: false });

    const connecting = observeGatewayRestart(connected.next, "connecting");
    expect(connecting).toEqual({ next: { sawDisconnect: true }, restartComplete: false });

    const reconnected = observeGatewayRestart(connecting.next, "connected");
    expect(reconnected).toEqual({ next: { sawDisconnect: true }, restartComplete: true });
  });
});

