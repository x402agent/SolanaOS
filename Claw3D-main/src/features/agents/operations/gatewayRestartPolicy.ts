export type GatewayStatus = "disconnected" | "connecting" | "connected";

export type RestartObservation = {
  sawDisconnect: boolean;
};

export function observeGatewayRestart(
  prev: RestartObservation,
  status: GatewayStatus
): { next: RestartObservation; restartComplete: boolean } {
  const sawDisconnect = prev.sawDisconnect || status !== "connected";
  return {
    next: { sawDisconnect },
    restartComplete: status === "connected" && sawDisconnect,
  };
}

