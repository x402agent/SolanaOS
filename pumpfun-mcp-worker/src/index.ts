/**
 * pumpfun-mcp-server — Cloudflare Worker
 *
 * Remote MCP server for pump.fun token scanning.
 * - Exposes MCP tools via Streamable HTTP at POST /mcp
 * - Cron Trigger runs every 15 minutes for automated scans
 * - Stores results in KV, pushes to Convex, sends Telegram digests
 */

import type { Env, ScanResult } from "./types.js";
import { runScan, generatePumpMd } from "./scanner.js";
import { sendTelegramDigest } from "./telegram.js";
import { pushToConvex } from "./convex.js";
import { generateTweet } from "./tweet.js";

/*

  // ── Tool: pumpfun_scan_tokens ──────────────────────────────────────────────

  server.registerTool(
    "pumpfun_scan_tokens",
    {
      title: "Scan Pump.fun Tokens",
      description: `Run a fresh scan of pump.fun tokens using GeckoTerminal and Solana Tracker APIs.
Returns the top 100 trending Solana tokens sorted by market cap, with blocklist filtering applied.
Automatically stores results, pushes to Convex, and optionally sends a Telegram digest.

Args:
  - send_telegram (boolean): Whether to send Telegram digest after scan (default: true)
  - push_convex (boolean): Whether to push data to Convex backend (default: true)

Returns:
  JSON with scan metadata, token list, and summary statistics.`,
      inputSchema: {
        send_telegram: z.boolean().default(true).describe("Send Telegram digest after scan"),
        push_convex: z.boolean().default(true).describe("Push data to Convex backend"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const scan = await runScan(env);

        const sideEffects: string[] = [];

        if (params.push_convex) {
          const convexResult = await pushToConvex(scan, env);
          sideEffects.push(`Convex: ${convexResult.message}`);
        }

        if (params.send_telegram) {
          const tgResult = await sendTelegramDigest(scan, env);
          sideEffects.push(`Telegram: ${tgResult.message}`);
        }

        const output = {
          status: "success",
          timestamp: scan.timestamp,
          tokenCount: scan.tokenCount,
          summary: scan.summary,
          sideEffects,
          tokens: scan.tokens.slice(0, 20), // Return top 20 in response
          note: `Full 100 tokens stored in KV. Use pumpfun_get_latest_scan for complete data.`,
        };

        return {
          content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text",
              text: `Error running scan: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // ── Tool: pumpfun_get_latest_scan ──────────────────────────────────────────

  server.registerTool(
    "pumpfun_get_latest_scan",
    {
      title: "Get Latest Pump.fun Scan",
      description: `Retrieve the most recent scan results from KV storage.
Returns the full 100-token dataset with summary statistics.
Use this instead of running a new scan when you just need the latest data.

Args:
  - format ('json' | 'markdown'): Output format (default: 'json')
  - limit (number): Max tokens to return, 1-100 (default: 100)

Returns:
  Full scan result with tokens, summary, and metadata.`,
      inputSchema: {
        format: z
          .enum(["json", "markdown"])
          .default("json")
          .describe("Output format"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .default(100)
          .describe("Max tokens to return"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const raw = await env.SCANS.get("latest");
        if (!raw) {
          return {
            content: [
              {
                type: "text",
                text: "No scan data found. Run pumpfun_scan_tokens first.",
              },
            ],
          };
        }

        const scan: ScanResult = JSON.parse(raw);

        if (params.format === "markdown") {
          const md = generatePumpMd({
            ...scan,
            tokens: scan.tokens.slice(0, params.limit),
          });
          return { content: [{ type: "text", text: md }] };
        }

        scan.tokens = scan.tokens.slice(0, params.limit);
        return {
          content: [{ type: "text", text: JSON.stringify(scan, null, 2) }],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text",
              text: `Error retrieving scan: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // ── Tool: pumpfun_send_telegram ────────────────────────────────────────────

  server.registerTool(
    "pumpfun_send_telegram",
    {
      title: "Send Telegram Digest",
      description: `Send a formatted Telegram digest of the latest scan results.
Reads the most recent scan from KV and sends a summary to the configured Telegram chat.

Returns:
  Status message confirming whether the digest was sent.`,
      inputSchema: {},
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async () => {
      try {
        const raw = await env.SCANS.get("latest");
        if (!raw) {
          return {
            content: [{ type: "text", text: "No scan data available. Run a scan first." }],
          };
        }

        const scan: ScanResult = JSON.parse(raw);
        const result = await sendTelegramDigest(scan, env);
        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text",
              text: `Telegram error: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // ── Tool: pumpfun_generate_tweet ───────────────────────────────────────────

  server.registerTool(
    "pumpfun_generate_tweet",
    {
      title: "Generate Tweet Draft",
      description: `Generate a tweet-sized summary (≤280 chars) of the latest scan.
Picks 2 fresh snipers, 2 top movers, and 1 highest market cap token.
Does NOT post the tweet — returns the draft text for review.

Returns:
  Tweet text (≤280 characters) ready for posting.`,
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      try {
        const raw = await env.SCANS.get("latest");
        if (!raw) {
          return {
            content: [{ type: "text", text: "No scan data available. Run a scan first." }],
          };
        }

        const scan: ScanResult = JSON.parse(raw);
        const tweet = generateTweet(scan);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ tweet, length: tweet.length }, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text",
              text: `Tweet generation error: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // ── Tool: pumpfun_scan_history ─────────────────────────────────────────────

  server.registerTool(
    "pumpfun_scan_history",
    {
      title: "Get Scan History",
      description: `List recent scan timestamps stored in KV.
Returns metadata about recent scans without full token data.

Args:
  - limit (number): Max history entries to return, 1-50 (default: 10)

Returns:
  List of recent scan timestamps and token counts.`,
      inputSchema: {
        limit: z.number().int().min(1).max(50).default(10).describe("Max entries"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const list = await env.SCANS.list({ prefix: "scan:", limit: params.limit });
        const entries = list.keys.map((k) => ({
          key: k.name,
          timestamp: (k.metadata as Record<string, unknown>)?.timestamp || "unknown",
          tokenCount: (k.metadata as Record<string, unknown>)?.count || "unknown",
        }));
        return {
          content: [{ type: "text", text: JSON.stringify(entries, null, 2) }],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text",
              text: `History error: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  return server;
}
*/

// ── HTTP Handler (MCP endpoint — Streamable HTTP transport) ──────────────────

async function handleMcpRequest(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as Record<string, unknown>;
  const method = body.method as string;
  const id = body.id;
  const params = (body.params ?? {}) as Record<string, unknown>;

  // Session ID from request or generate one
  const sessionId = request.headers.get("Mcp-Session-Id") || crypto.randomUUID();

  const mcpHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    "Mcp-Session-Id": sessionId,
    ...CORS_HEADERS,
  };

  const jsonrpc = (result: unknown) =>
    new Response(JSON.stringify({ jsonrpc: "2.0", id, result }), {
      headers: mcpHeaders,
    });

  const jsonrpcError = (code: number, message: string) =>
    new Response(JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }), {
      headers: mcpHeaders,
    });

  // ── initialize ──
  if (method === "initialize") {
    return jsonrpc({
      protocolVersion: "2024-11-05",
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "pumpfun-mcp-server", version: "1.0.0" },
    });
  }

  // ── notifications/initialized — no response needed ──
  if (method === "notifications/initialized") {
    return new Response("", { status: 204 });
  }

  // ── tools/list ──
  if (method === "tools/list") {
    return jsonrpc({
      tools: [
        {
          name: "pumpfun_scan_tokens",
          description: "Run a fresh scan of pump.fun tokens. Returns top 100 trending Solana tokens.",
          inputSchema: {
            type: "object",
            properties: {
              send_telegram: { type: "boolean", description: "Send Telegram digest", default: true },
              push_convex: { type: "boolean", description: "Push to Convex", default: true },
            },
          },
        },
        {
          name: "pumpfun_get_latest_scan",
          description: "Get the most recent scan results from KV storage.",
          inputSchema: {
            type: "object",
            properties: {
              limit: { type: "number", description: "Max tokens to return (1-100)", default: 20 },
            },
          },
        },
        {
          name: "pumpfun_send_telegram",
          description: "Send the latest scan as a Telegram digest.",
          inputSchema: { type: "object", properties: {} },
        },
        {
          name: "pumpfun_generate_tweet",
          description: "Generate a tweet-sized summary of the latest scan.",
          inputSchema: { type: "object", properties: {} },
        },
        {
          name: "pumpfun_scan_history",
          description: "List recent scan timestamps.",
          inputSchema: {
            type: "object",
            properties: {
              limit: { type: "number", description: "Max entries (1-50)", default: 10 },
            },
          },
        },
      ],
    });
  }

  // ── tools/call ──
  if (method === "tools/call") {
    const toolName = params.name;
    const args = params.arguments ?? {};
    try {
      // Execute using the server's registered tools
      if (toolName === "pumpfun_scan_tokens") {
        const scan = await runScan(env);
        const sideEffects: string[] = [];
        if (args.push_convex !== false) {
          const cx = await pushToConvex(scan, env);
          sideEffects.push(`Convex: ${cx.message}`);
        }
        if (args.send_telegram !== false) {
          const tg = await sendTelegramDigest(scan, env);
          sideEffects.push(`Telegram: ${tg.message}`);
        }
        return jsonrpc({
          content: [{
            type: "text",
            text: JSON.stringify({
              status: "success",
              timestamp: scan.timestamp,
              tokenCount: scan.tokenCount,
              summary: scan.summary,
              sideEffects,
              tokens: scan.tokens.slice(0, 20),
            }, null, 2),
          }],
        });
      }

      if (toolName === "pumpfun_get_latest_scan") {
        const raw = await env.SCANS.get("latest");
        if (!raw) return jsonrpc({ content: [{ type: "text", text: "No scan data. Run a scan first." }] });
        const scan: ScanResult = JSON.parse(raw);
        const limit = Math.min(Math.max(args.limit ?? 20, 1), 100);
        return jsonrpc({
          content: [{
            type: "text",
            text: JSON.stringify({
              timestamp: scan.timestamp,
              tokenCount: scan.tokenCount,
              summary: scan.summary,
              tokens: scan.tokens.slice(0, limit),
            }, null, 2),
          }],
        });
      }

      if (toolName === "pumpfun_send_telegram") {
        const raw = await env.SCANS.get("latest");
        if (!raw) return jsonrpc({ content: [{ type: "text", text: "No scan data." }] });
        const scan: ScanResult = JSON.parse(raw);
        const result = await sendTelegramDigest(scan, env);
        return jsonrpc({ content: [{ type: "text", text: JSON.stringify(result) }] });
      }

      if (toolName === "pumpfun_generate_tweet") {
        const raw = await env.SCANS.get("latest");
        if (!raw) return jsonrpc({ content: [{ type: "text", text: "No scan data." }] });
        const scan: ScanResult = JSON.parse(raw);
        const tweet = generateTweet(scan);
        return jsonrpc({ content: [{ type: "text", text: JSON.stringify({ tweet, length: tweet.length }) }] });
      }

      if (toolName === "pumpfun_scan_history") {
        const limit = Math.min(Math.max(args.limit ?? 10, 1), 50);
        const keys = await env.SCANS.list({ prefix: "scan:", limit });
        const entries = keys.keys.map((k: any) => ({
          key: k.name,
          expiration: k.expiration,
        }));
        return jsonrpc({ content: [{ type: "text", text: JSON.stringify(entries, null, 2) }] });
      }

      return jsonrpcError(-32601, `Unknown tool: ${toolName}`);
    } catch (err) {
      return jsonrpc({
        content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      });
    }
  }

  // ── ping ──
  if (method === "ping") {
    return jsonrpc({});
  }

  return jsonrpcError(-32601, `Method not found: ${method}`);
}

// ── Cron Handler (every 15 minutes) ──────────────────────────────────────────

async function handleScheduled(env: Env): Promise<void> {
  console.log(`[CRON] Starting scheduled scan at ${new Date().toISOString()}`);

  try {
    const scan = await runScan(env);
    console.log(`[CRON] Scanned ${scan.tokenCount} tokens`);

    // Push to Convex
    const convex = await pushToConvex(scan, env);
    console.log(`[CRON] Convex: ${convex.message}`);

    // Send Telegram
    const tg = await sendTelegramDigest(scan, env);
    console.log(`[CRON] Telegram: ${tg.message}`);

    console.log(`[CRON] Scan complete at ${scan.timestamp}`);
  } catch (err) {
    console.error(`[CRON] Scan failed:`, err);
  }
}

// ── CORS Helper ──────────────────────────────────────────────────────────────

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id",
  "Access-Control-Expose-Headers": "Mcp-Session-Id",
};

function corsJson(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

// ── Worker Export ────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // ── Health check ──
    if (url.pathname === "/" || url.pathname === "/health") {
      const latest = await env.SCANS.get("latest", { type: "json" }) as ScanResult | null;
      return corsJson({
        name: "pumpfun-mcp-server",
        version: "1.0.0",
        status: "healthy",
        lastScan: latest?.timestamp || "never",
        lastTokenCount: latest?.tokenCount || 0,
        mcp_endpoint: "/mcp",
      });
    }

    // ── MCP endpoint: POST (JSON-RPC requests) ──
    if (url.pathname === "/mcp" && request.method === "POST") {
      return handleMcpRequest(request, env);
    }

    // ── MCP endpoint: GET (SSE stream for server-to-client notifications) ──
    if (url.pathname === "/mcp" && request.method === "GET") {
      const accept = request.headers.get("Accept") || "";
      if (accept.includes("text/event-stream")) {
        // Return an SSE stream — Streamable HTTP transport requires this
        const sessionId = request.headers.get("Mcp-Session-Id") || crypto.randomUUID();
        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();
        const encoder = new TextEncoder();

        // Send an initial keepalive comment, then hold the connection open
        (async () => {
          try {
            await writer.write(encoder.encode(": keepalive\n\n"));
            // Hold the stream open for up to 55s (CF limit is 60s)
            // The client can reconnect after this
            await new Promise(resolve => setTimeout(resolve, 55000));
            await writer.close();
          } catch {
            // Client disconnected — that's fine
          }
        })();

        return new Response(readable, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Mcp-Session-Id": sessionId,
            ...CORS_HEADERS,
          },
        });
      }
      // Non-SSE GET returns a hint
      return corsJson({
        error: "GET /mcp requires Accept: text/event-stream header for SSE transport",
        hint: "Use POST /mcp for JSON-RPC requests",
      }, 400);
    }

    // ── MCP endpoint: DELETE (session cleanup) ──
    if (url.pathname === "/mcp" && request.method === "DELETE") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // ── REST API: latest scan (full data for frontend) ──
    if (url.pathname === "/api/latest") {
      try {
        const raw = await env.SCANS.get("latest");
        if (!raw) return corsJson({ error: "No scan data yet" }, 404);
        const scan: ScanResult = JSON.parse(raw);
        return corsJson(scan);
      } catch (err) {
        return corsJson({ error: String(err) }, 500);
      }
    }

    // ── REST API: scan history ──
    if (url.pathname === "/api/history") {
      try {
        const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 50);
        const keys = await env.SCANS.list({ prefix: "scan:", limit });
        const entries = keys.keys.map((k: any) => ({
          key: k.name,
          expiration: k.expiration,
        }));
        return corsJson({ entries, count: entries.length });
      } catch (err) {
        return corsJson({ error: String(err) }, 500);
      }
    }

    // ── REST API: generate tweet from latest ──
    if (url.pathname === "/api/tweet") {
      try {
        const raw = await env.SCANS.get("latest");
        if (!raw) return corsJson({ error: "No scan data" }, 404);
        const scan: ScanResult = JSON.parse(raw);
        const tweet = generateTweet(scan);
        return corsJson({ tweet, length: tweet.length });
      } catch (err) {
        return corsJson({ error: String(err) }, 500);
      }
    }

    // ── REST API: trigger scan ──
    if (url.pathname === "/api/scan" || url.pathname === "/scan") {
      try {
        const scan = await runScan(env);
        await pushToConvex(scan, env);
        await sendTelegramDigest(scan, env);
        return corsJson({
          status: "success",
          timestamp: scan.timestamp,
          tokenCount: scan.tokenCount,
          summary: scan.summary,
        });
      } catch (err) {
        return corsJson({ error: String(err) }, 500);
      }
    }

    // ── REST API: pump.md format ──
    if (url.pathname === "/api/pump.md") {
      try {
        const raw = await env.SCANS.get("latest");
        if (!raw) return new Response("No scan data", { status: 404, headers: CORS_HEADERS });
        const scan: ScanResult = JSON.parse(raw);
        const md = generatePumpMd(scan);
        return new Response(md, {
          headers: { "Content-Type": "text/markdown; charset=utf-8", ...CORS_HEADERS },
        });
      } catch (err) {
        return new Response(String(err), { status: 500, headers: CORS_HEADERS });
      }
    }

    // ── Dashboard UI ──
    if (url.pathname === "/dashboard") {
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>pump.fun Scanner Dashboard</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.26.2/babel.min.js"></script>
<style>
  :root {
    --bg: #0a0a0f; --surface: #12121a; --surface2: #1a1a2e; --border: #2a2a3e;
    --text: #e4e4ef; --text2: #8888aa; --accent: #7c5cfc; --accent2: #5c3cdc;
    --green: #22c55e; --red: #ef4444; --yellow: #eab308; --cyan: #06b6d4;
  }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'SF Mono', 'Fira Code', 'JetBrains Mono', monospace; background:var(--bg); color:var(--text); }
  .app { max-width:1400px; margin:0 auto; padding:16px; }

  /* Header */
  .header { display:flex; justify-content:space-between; align-items:center; padding:16px 0; border-bottom:1px solid var(--border); margin-bottom:16px; }
  .header h1 { font-size:18px; font-weight:600; }
  .header h1 span { color:var(--accent); }
  .status { display:flex; align-items:center; gap:8px; font-size:12px; color:var(--text2); }
  .dot { width:8px; height:8px; border-radius:50%; }
  .dot.live { background:var(--green); box-shadow:0 0 6px var(--green); }
  .dot.off { background:var(--red); }

  /* Stats Row */
  .stats { display:grid; grid-template-columns:repeat(auto-fit, minmax(180px,1fr)); gap:12px; margin-bottom:16px; }
  .stat { background:var(--surface); border:1px solid var(--border); border-radius:8px; padding:14px; }
  .stat-label { font-size:10px; text-transform:uppercase; letter-spacing:1px; color:var(--text2); margin-bottom:4px; }
  .stat-value { font-size:22px; font-weight:700; }
  .stat-sub { font-size:11px; color:var(--text2); margin-top:2px; }

  /* Actions */
  .actions { display:flex; gap:8px; margin-bottom:16px; flex-wrap:wrap; }
  .btn { background:var(--accent); color:#fff; border:none; border-radius:6px; padding:8px 16px; font-size:12px; font-family:inherit; cursor:pointer; transition:all .15s; }
  .btn:hover { background:var(--accent2); }
  .btn:disabled { opacity:.4; cursor:not-allowed; }
  .btn.outline { background:transparent; border:1px solid var(--border); color:var(--text2); }
  .btn.outline:hover { border-color:var(--accent); color:var(--text); }

  /* Tabs */
  .tabs { display:flex; gap:0; margin-bottom:16px; border-bottom:1px solid var(--border); }
  .tab { padding:8px 16px; font-size:12px; cursor:pointer; color:var(--text2); border-bottom:2px solid transparent; font-family:inherit; background:none; border-top:none; border-left:none; border-right:none; }
  .tab.active { color:var(--accent); border-bottom-color:var(--accent); }

  /* Token Table */
  .table-wrap { overflow-x:auto; background:var(--surface); border:1px solid var(--border); border-radius:8px; }
  table { width:100%; border-collapse:collapse; font-size:12px; }
  th { text-align:left; padding:10px 12px; font-size:10px; text-transform:uppercase; letter-spacing:1px; color:var(--text2); background:var(--surface2); position:sticky; top:0; }
  td { padding:8px 12px; border-top:1px solid var(--border); }
  tr:hover td { background:var(--surface2); }
  .mc { color:var(--green); font-weight:600; }
  .pct { font-weight:600; }
  .pct.high { color:var(--green); }
  .pct.mid { color:var(--yellow); }
  .pct.low { color:var(--text2); }
  .mint { font-size:10px; color:var(--text2); max-width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; cursor:pointer; }
  .mint:hover { color:var(--cyan); }
  .age { color:var(--text2); }
  .age.fresh { color:var(--cyan); font-weight:600; }
  .rank { color:var(--text2); width:30px; }
  .src { font-size:9px; padding:2px 6px; border-radius:3px; background:var(--surface2); color:var(--text2); }

  /* Tweet Panel */
  .tweet-panel { background:var(--surface); border:1px solid var(--border); border-radius:8px; padding:16px; margin-bottom:16px; }
  .tweet-text { white-space:pre-wrap; font-size:13px; line-height:1.5; padding:12px; background:var(--bg); border-radius:6px; border:1px solid var(--border); }
  .tweet-meta { display:flex; justify-content:space-between; margin-top:8px; font-size:11px; color:var(--text2); }

  /* Search */
  .search { background:var(--surface); border:1px solid var(--border); border-radius:6px; padding:8px 12px; font-size:12px; color:var(--text); font-family:inherit; width:240px; outline:none; }
  .search:focus { border-color:var(--accent); }
  .search::placeholder { color:var(--text2); }

  /* Loading */
  .loading { text-align:center; padding:40px; color:var(--text2); }
  @keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:1} }
  .loading span { animation:pulse 1.5s infinite; }

  /* Scrollbar */
  ::-webkit-scrollbar { width:6px; height:6px; }
  ::-webkit-scrollbar-track { background:var(--bg); }
  ::-webkit-scrollbar-thumb { background:var(--border); border-radius:3px; }
</style>
</head>
<body>
<div id="root"></div>
<script type="text/babel">
const { useState, useEffect, useCallback, useMemo } = React;

const API = "https://pumpfun-mcp-server.x402.workers.dev";

function App() {
  const [scan, setScan] = useState(null);
  const [health, setHealth] = useState(null);
  const [tweet, setTweet] = useState(null);
  const [tab, setTab] = useState("tokens");
  const [search, setSearch] = useState("");
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastFetch, setLastFetch] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [latestRes, healthRes] = await Promise.all([
        fetch(\`\${API}/api/latest\`),
        fetch(\`\${API}/\`),
      ]);
      if (latestRes.ok) {
        const data = await latestRes.json();
        setScan(data);
        setLastFetch(new Date());
      }
      if (healthRes.ok) setHealth(await healthRes.json());
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  const triggerScan = async () => {
    setScanning(true);
    try {
      const res = await fetch(\`\${API}/api/scan\`);
      if (res.ok) {
        await fetchData();
      }
    } catch (e) { setError(e.message); }
    setScanning(false);
  };

  const fetchTweet = async () => {
    try {
      const res = await fetch(\`\${API}/api/tweet\`);
      if (res.ok) setTweet(await res.json());
    } catch {}
  };

  useEffect(() => { fetchData(); fetchTweet(); }, [fetchData]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(fetchData, 60000);
    return () => clearInterval(id);
  }, [autoRefresh, fetchData]);

  const filteredTokens = useMemo(() => {
    if (!scan?.tokens) return [];
    if (!search) return scan.tokens;
    const q = search.toLowerCase();
    return scan.tokens.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.symbol.toLowerCase().includes(q) ||
      t.mint.toLowerCase().includes(q)
    );
  }, [scan, search]);

  const pctClass = (v) => v >= 90 ? "high" : v >= 50 ? "mid" : "low";
  const ageClass = (m) => m !== null && m <= 10 ? "fresh" : "";

  const copyMint = (mint) => {
    navigator.clipboard?.writeText(mint);
  };

  if (!scan) return (
    <div className="app">
      <div className="loading"><span>Loading scanner data...</span></div>
    </div>
  );

  const s = scan.summary;
  const scanAge = Math.round((Date.now() - new Date(scan.timestamp).getTime()) / 60000);

  return (
    <div className="app">
      {/* Header */}
      <div className="header">
        <h1><span>pump</span>.fun Scanner</h1>
        <div className="status">
          <div className={\`dot \${scanAge < 20 ? "live" : "off"}\`} />
          {scanAge < 20 ? "Live" : \`\${scanAge}m ago\`}
          {" · "}
          Cron: */15 min
          {lastFetch && \` · Fetched \${new Date(lastFetch).toLocaleTimeString()}\`}
        </div>
      </div>

      {/* Stats */}
      <div className="stats">
        <div className="stat">
          <div className="stat-label">Tokens</div>
          <div className="stat-value">{s.totalTokens}</div>
          <div className="stat-sub">blocklist filtered</div>
        </div>
        <div className="stat">
          <div className="stat-label">Top Market Cap</div>
          <div className="stat-value mc">{s.highestMcToken?.mc || "—"}</div>
          <div className="stat-sub">{s.highestMcToken?.name} ({s.highestMcToken?.symbol})</div>
        </div>
        <div className="stat">
          <div className="stat-label">Near Graduation</div>
          <div className="stat-value" style={{color:"var(--yellow)"}}>{s.nearGraduation}</div>
          <div className="stat-sub">≥90% bonding</div>
        </div>
        <div className="stat">
          <div className="stat-label">Fresh Tokens</div>
          <div className="stat-value" style={{color:"var(--cyan)"}}>{s.freshTokens}</div>
          <div className="stat-sub">≤10 min old</div>
        </div>
        <div className="stat">
          <div className="stat-label">Last Scan</div>
          <div className="stat-value" style={{fontSize:14}}>{new Date(scan.timestamp).toLocaleTimeString()}</div>
          <div className="stat-sub">{scan.source}</div>
        </div>
      </div>

      {/* Actions */}
      <div className="actions">
        <button className="btn" onClick={triggerScan} disabled={scanning}>
          {scanning ? "Scanning..." : "⚡ Run Scan"}
        </button>
        <button className="btn outline" onClick={fetchData}>↻ Refresh</button>
        <button className="btn outline" onClick={() => setAutoRefresh(!autoRefresh)}>
          {autoRefresh ? "⏸ Pause Auto" : "▶ Resume Auto"}
        </button>
        <button className="btn outline" onClick={() => window.open(\`\${API}/api/pump.md\`)}>
          📄 pump.md
        </button>
        {error && <span style={{color:"var(--red)", fontSize:11, alignSelf:"center"}}>{error}</span>}
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={\`tab \${tab==="tokens"?"active":""}\`} onClick={()=>setTab("tokens")}>
          Tokens ({filteredTokens.length})
        </button>
        <button className={\`tab \${tab==="top5"?"active":""}\`} onClick={()=>setTab("top5")}>
          Top 5
        </button>
        <button className={\`tab \${tab==="tweet"?"active":""}\`} onClick={()=>{setTab("tweet"); fetchTweet();}}>
          Tweet Draft
        </button>
      </div>

      {/* Tab Content */}
      {tab === "tokens" && (
        <>
          <div style={{marginBottom:12}}>
            <input
              className="search"
              placeholder="Search name, symbol, or mint..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="table-wrap" style={{maxHeight:"65vh", overflow:"auto"}}>
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Name</th><th>Symbol</th><th>Mint</th>
                  <th>Market Cap</th><th>Age</th><th>Bonding %</th><th>Source</th>
                </tr>
              </thead>
              <tbody>
                {filteredTokens.map(t => (
                  <tr key={t.mint}>
                    <td className="rank">{t.rank}</td>
                    <td>{t.name}</td>
                    <td><strong>{t.symbol}</strong></td>
                    <td className="mint" title={t.mint} onClick={() => copyMint(t.mint)}>
                      {t.mint.slice(0,6)}...{t.mint.slice(-4)}
                    </td>
                    <td className="mc">{t.marketCap}</td>
                    <td className={\`age \${ageClass(t.ageMinutes)}\`}>{t.age}</td>
                    <td className={\`pct \${pctClass(t.bondingPctNum)}\`}>{t.bondingPct}</td>
                    <td><span className="src">{t.source === "geckoterminal" ? "GT" : "ST"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "top5" && (
        <div style={{display:"grid", gap:12}}>
          {s.top5ByMc.map((t, i) => (
            <div key={i} className="stat" style={{display:"flex", alignItems:"center", gap:16}}>
              <div style={{fontSize:28, fontWeight:800, color:"var(--accent)", width:40, textAlign:"center"}}>
                {i+1}
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:16, fontWeight:600}}>{t.name}</div>
                <div style={{fontSize:12, color:"var(--text2)"}}>{t.symbol}</div>
              </div>
              <div className="mc" style={{fontSize:20}}>{t.mc}</div>
            </div>
          ))}
        </div>
      )}

      {tab === "tweet" && tweet && (
        <div className="tweet-panel">
          <div className="tweet-text">{tweet.tweet}</div>
          <div className="tweet-meta">
            <span>{tweet.length}/280 chars</span>
            <button className="btn" style={{padding:"4px 12px", fontSize:11}}
              onClick={() => navigator.clipboard?.writeText(tweet.tweet)}>
              Copy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
</script>
</body>
</html>
`;
      return new Response(html, {
        headers: { "Content-Type": "text/html; charset=utf-8", ...CORS_HEADERS },
      });
    }

    return corsJson({ error: "Not Found" }, 404);
  },

  // Cron Trigger — runs every 15 minutes
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    await handleScheduled(env);
  },
};
