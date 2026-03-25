import { Datastream } from "@solana-tracker/data-api";

let datastream: Datastream | null = null;

function getWsProxyUrl(): string {
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}/ws`;
}

export function getDatastream(): Datastream {
  if (typeof window === "undefined") {
    throw new Error("Datastream can only be used on the client side.");
  }

  if (!datastream) {
    datastream = new Datastream({ wsUrl: getWsProxyUrl() });

    datastream.on("error", (err) =>
      console.error("[datastream] error", err)
    );

    datastream.connect();
  }

  return datastream;
}

export function disconnectDatastream() {
  if (datastream) {
    datastream.disconnect();
    datastream = null;
  }
}
