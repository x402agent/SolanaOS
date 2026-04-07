#!/usr/bin/env node
/**
 * SolanaOS MCP Server — HTTP + SSE entrypoint
 *
 * Adapted from Claude Code's mcp-server/src/http.ts
 * Deploy to Fly.io for 24/7 operation:
 *
 *   fly launch --name solanaos-mcp
 *   fly secrets set SOLANAOS_GATEWAY_URL=https://gateway.solanaos.net
 *   fly secrets set MCP_API_KEY=your-secret-key
 *   fly deploy
 *
 * Supports:
 *   - Streamable HTTP (POST/GET /mcp) — modern MCP clients
 *   - Legacy SSE (GET /sse + POST /messages) — older clients
 *   - Health check (GET /health)
 *   - CORS for web-based clients
 *
 * Environment:
 *   PORT                    — HTTP port (default: 3000, Fly sets this)
 *   SOLANAOS_GATEWAY_URL    — SolanaOS gateway URL
 *   SOLANAOS_GATEWAY_API_KEY — Gateway API key (forwarded to tools)
 *   MCP_API_KEY             — Bearer token for MCP auth (optional)
 */

import express from "express";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { createServer, validateGateway, GATEWAY_URL } from "./server.js";

const PORT = parseInt(process.env.PORT ?? "3000", 10);
const MCP_API_KEY = process.env.MCP_API_KEY;
const GATEWAY_API_KEY = process.env.SOLANAOS_GATEWAY_API_KEY;

// ─────────────────────────────────────────────────────────────────────────────
// Auth middleware
// ─────────────────────────────────────────────────────────────────────────────

function authMiddleware(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): void {
  if (!MCP_API_KEY) return next();
  if (req.path === "/health") return next();

  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${MCP_API_KEY}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

// ─────────────────────────────────────────────────────────────────────────────
// CORS middleware (for web/extension clients)
// ─────────────────────────────────────────────────────────────────────────────

function corsMiddleware(
  _req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, mcp-session-id");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  next();
}

// ─────────────────────────────────────────────────────────────────────────────
// Streamable HTTP (modern MCP protocol)
// ─────────────────────────────────────────────────────────────────────────────

async function startStreamableHTTP(app: express.Express): Promise<void> {
  const transports = new Map<string, StreamableHTTPServerTransport>();

  app.post("/mcp", async (req, res) => {
    const sessionId = (req.headers["mcp-session-id"] as string) ?? undefined;
    let transport = sessionId ? transports.get(sessionId) : undefined;

    if (!transport) {
      const server = createServer(GATEWAY_API_KEY);
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
      });
      await server.connect(transport);
      transport.onclose = () => {
        if (transport!.sessionId) {
          transports.delete(transport!.sessionId);
        }
      };
    }

    await transport.handleRequest(req, res, req.body);

    if (transport.sessionId && !transports.has(transport.sessionId)) {
      transports.set(transport.sessionId, transport);
    }
  });

  app.get("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !transports.has(sessionId)) {
      res.status(400).json({ error: "Invalid or missing session ID" });
      return;
    }
    await transports.get(sessionId)!.handleRequest(req, res);
  });

  app.delete("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (sessionId && transports.has(sessionId)) {
      await transports.get(sessionId)!.close();
      transports.delete(sessionId);
    }
    res.status(200).json({ ok: true });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Legacy SSE transport
// ─────────────────────────────────────────────────────────────────────────────

async function startLegacySSE(app: express.Express): Promise<void> {
  const transports = new Map<string, SSEServerTransport>();

  app.get("/sse", async (_req, res) => {
    const server = createServer(GATEWAY_API_KEY);
    const transport = new SSEServerTransport("/messages", res);
    transports.set(transport.sessionId, transport);
    transport.onclose = () => {
      transports.delete(transport.sessionId);
    };
    await server.connect(transport);
  });

  app.post("/messages", async (req, res) => {
    const sessionId = req.query.sessionId as string;
    const transport = transports.get(sessionId);
    if (!transport) {
      res.status(400).json({ error: "Unknown session" });
      return;
    }
    await transport.handlePostMessage(req, res, req.body);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  await validateGateway();

  const app = express();
  app.use(express.json());
  app.use(corsMiddleware);
  app.use(authMiddleware);

  // Handle OPTIONS preflight
  app.options("*", (_req, res) => res.sendStatus(204));

  // Health check
  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      server: "solanaos-mcp",
      version: "1.0.0",
      gateway: GATEWAY_URL,
      auth: MCP_API_KEY ? "enabled" : "disabled",
    });
  });

  await startStreamableHTTP(app);
  await startLegacySSE(app);

  app.listen(PORT, () => {
    console.log(`\n🌊 SolanaOS MCP Server listening on port ${PORT}`);
    console.log(`   Streamable HTTP : POST/GET http://0.0.0.0:${PORT}/mcp`);
    console.log(`   Legacy SSE      : GET http://0.0.0.0:${PORT}/sse`);
    console.log(`   Health          : GET http://0.0.0.0:${PORT}/health`);
    console.log(`   Gateway         : ${GATEWAY_URL}`);
    if (MCP_API_KEY) console.log(`   Auth            : Bearer token required`);
    console.log();
  });
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
