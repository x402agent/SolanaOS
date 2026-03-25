import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const here = path.dirname(fileURLToPath(import.meta.url));

function normalizeBase(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return "/";
  }
  if (trimmed === "./") {
    return "./";
  }
  if (trimmed.endsWith("/")) {
    return trimmed;
  }
  return `${trimmed}/`;
}

const GATEWAY_HOST = process.env.SOLANAOS_GATEWAY_HOST?.trim() || "127.0.0.1";
const GATEWAY_PORT = Number(process.env.SOLANAOS_GATEWAY_PORT?.trim()) || 18790;

export default defineConfig(() => {
  const envBase = process.env.OPENCLAW_CONTROL_UI_BASE_PATH?.trim();
  const base = envBase ? normalizeBase(envBase) : "./";
  return {
    base,
    publicDir: path.resolve(here, "public"),
    optimizeDeps: {
      include: ["lit/directives/repeat.js"],
    },
    build: {
      outDir: path.resolve(here, "../dist/control-ui"),
      emptyOutDir: true,
      sourcemap: true,
    },
    server: {
      host: true,
      port: 5173,
      strictPort: true,
    },
    plugins: [
      {
        name: "gateway-ws-proxy",
        configureServer(server) {
          // Proxy WebSocket upgrades to the SolanaOS gateway on port 18790.
          // Only intercepts WS upgrade requests; regular HTTP passes through to Vite.
          server.httpServer?.on("upgrade", (req, socket, head) => {
            // Skip Vite's own HMR WebSocket
            if (req.headers["sec-websocket-protocol"]?.includes("vite-hmr")) {
              return;
            }

            const upstream = net.createConnection(GATEWAY_PORT, GATEWAY_HOST, () => {
              // Replay the original HTTP upgrade request to the gateway
              const reqLine = `${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`;
              const headers = Object.entries(req.headers)
                .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
                .join("\r\n");
              upstream.write(`${reqLine}${headers}\r\n\r\n`);
              if (head.length > 0) {
                upstream.write(head);
              }
              // Bi-directional pipe
              upstream.pipe(socket as net.Socket);
              (socket as net.Socket).pipe(upstream);
            });

            upstream.on("error", () => {
              socket.destroy();
            });
            socket.on("error", () => {
              upstream.destroy();
            });
          });
        },
      },
    ],
  };
});
