import { WebSocket, type WebSocketServer } from "ws";

export function GET() {
  return new Response("WebSocket endpoint", { status: 200 });
}

export function UPGRADE(
  client: WebSocket,
  _server: WebSocketServer
) {
  const upstreamUrl = process.env.WS_URL;
  if (!upstreamUrl) {
    client.close(1011, "Server misconfigured");
    return;
  }

  const upstream = new WebSocket(upstreamUrl);

  upstream.on("open", () => {
    client.on("message", (data, isBinary) => {
      if (upstream.readyState === WebSocket.OPEN) {
        upstream.send(data, { binary: isBinary });
      }
    });
  });

  upstream.on("message", (data, isBinary) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data, { binary: isBinary });
    }
  });

  client.on("close", () => upstream.close());
  upstream.on("close", () => client.close());

  client.on("error", () => upstream.close());
  upstream.on("error", () => client.close());
}
