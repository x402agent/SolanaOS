/**
 * SolanaOS MCP Server — shared transport-agnostic definition
 *
 * Adapted from Claude Code's mcp-server/src/server.ts
 * Replaces the claude-code-explorer server with a SolanaOS-native MCP server
 * that exposes the SolanaOS tool registry, agent fleet, memory, and skills
 * to any MCP-compatible client (Claude Desktop, Cursor, VS Code, etc.)
 *
 * Tools exposed:
 *   solana.price        — Live token price (via SolanaOS gateway)
 *   solana.trending     — Trending tokens (SolanaTracker)
 *   solana.token_info   — Token metadata and security score
 *   solana.wallet_pnl   — Wallet PnL via SolanaTracker
 *   solana.search       — Token search by name/symbol
 *   agent.spawn         — Spawn a SolanaOS coordinator worker
 *   agent.list          — List active coordinator workers
 *   agent.stop          — Stop a worker
 *   memory.recall       — Query Honcho memory + vault
 *   memory.write        — Write a fact to the vault
 *   task.create         — Create a SolanaOS task (ooda, scanner, dream, skill)
 *   task.list           — List tasks for current session
 *   skill.list          — List available SKILL.md skills
 *   skill.run           — Execute a skill
 *   gateway.health      — SolanaOS gateway health check
 *
 * Resources:
 *   solanaos://soul     — SOUL.md (the SolanaOS identity document)
 *   solanaos://skills   — Skill registry JSON
 *   solanaos://tools    — Tool registry JSON
 *   solanaos://source/{path} — SolanaOS src/ files (for meta-tooling)
 *
 * Deploy to Fly.io:
 *   fly launch --name solanaos-mcp --dockerfile Dockerfile
 *   fly secrets set SOLANAOS_GATEWAY_URL=https://your-gateway.solanaos.net
 *   fly secrets set MCP_API_KEY=your-secret
 *   fly deploy
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** SolanaOS gateway base URL — all API calls route through here */
export const GATEWAY_URL =
  process.env.SOLANAOS_GATEWAY_URL ?? "http://localhost:8080";

/** SolanaOS src/ root (for meta-tooling & source reading) */
export const SRC_ROOT = path.resolve(
  process.env.SOLANAOS_SRC_ROOT ?? path.join(__dirname, "..", "..", "src"),
);

/** SolanaOS repo root (for SOUL.md, README.md) */
export const REPO_ROOT = path.resolve(
  process.env.SOLANAOS_REPO_ROOT ?? path.join(__dirname, "..", ".."),
);

// ─────────────────────────────────────────────────────────────────────────────
// Gateway API helper
// ─────────────────────────────────────────────────────────────────────────────

async function gatewayGet<T = unknown>(
  path: string,
  apiKey?: string,
): Promise<T> {
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    headers: {
      Accept: "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Gateway ${path} → ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

async function gatewayPost<T = unknown>(
  endpointPath: string,
  body: unknown,
  apiKey?: string,
): Promise<T> {
  const res = await fetch(`${GATEWAY_URL}${endpointPath}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Gateway POST ${endpointPath} → ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ─────────────────────────────────────────────────────────────────────────────
// File helpers
// ─────────────────────────────────────────────────────────────────────────────

function safePath(root: string, rel: string): string | null {
  const resolved = path.resolve(root, rel);
  if (!resolved.startsWith(root)) return null;
  return resolved;
}

async function readFileText(abs: string): Promise<string | null> {
  try {
    return await fs.readFile(abs, "utf-8");
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Server factory
// ─────────────────────────────────────────────────────────────────────────────

export function createServer(apiKey?: string): Server {
  const server = new Server(
    { name: "solanaos-mcp", version: "1.0.0" },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
    },
  );

  // ── Resources ─────────────────────────────────────────────────────────────

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [
      {
        uri: "solanaos://soul",
        name: "SOUL.md",
        description: "SolanaOS identity document — who SolanaOS is, what it does, how it thinks",
        mimeType: "text/markdown",
      },
      {
        uri: "solanaos://skills",
        name: "Skill Registry",
        description: "All available SolanaOS SKILL.md skills",
        mimeType: "application/json",
      },
      {
        uri: "solanaos://tools",
        name: "Tool Registry",
        description: "SolanaOS tool registry with permission levels",
        mimeType: "application/json",
      },
      {
        uri: "solanaos://readme",
        name: "README",
        description: "SolanaOS README",
        mimeType: "text/markdown",
      },
    ],
  }));

  server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
    resourceTemplates: [
      {
        uriTemplate: "solanaos://source/{path}",
        name: "SolanaOS source file",
        description: "Read a file from the SolanaOS src/ directory",
        mimeType: "text/plain",
      },
    ],
  }));

  server.setRequestHandler(
    ReadResourceRequestSchema,
    async (request: { params: { uri: string } }) => {
      const { uri } = request.params;

      if (uri === "solanaos://soul") {
        const text =
          (await readFileText(path.join(REPO_ROOT, "SOUL.md"))) ??
          (await readFileText(path.join(REPO_ROOT, "soul.md"))) ??
          "SOUL.md not found.";
        return { contents: [{ uri, mimeType: "text/markdown", text }] };
      }

      if (uri === "solanaos://readme") {
        const text = (await readFileText(path.join(REPO_ROOT, "README.md"))) ?? "README.md not found.";
        return { contents: [{ uri, mimeType: "text/markdown", text }] };
      }

      if (uri === "solanaos://skills") {
        try {
          const data = await gatewayGet("/api/v1/skills", apiKey);
          return {
            contents: [{ uri, mimeType: "application/json", text: JSON.stringify(data, null, 2) }],
          };
        } catch {
          const skillsDir = path.join(REPO_ROOT, "skills");
          let skills: string[] = [];
          try {
            const entries = await fs.readdir(skillsDir, { withFileTypes: true });
            skills = entries.map((e) => e.name);
          } catch { /* ignore */ }
          return {
            contents: [{ uri, mimeType: "application/json", text: JSON.stringify({ skills }, null, 2) }],
          };
        }
      }

      if (uri === "solanaos://tools") {
        try {
          const data = await gatewayGet("/api/v1/tools", apiKey);
          return {
            contents: [{ uri, mimeType: "application/json", text: JSON.stringify(data, null, 2) }],
          };
        } catch {
          return {
            contents: [{ uri, mimeType: "application/json", text: "[]" }],
          };
        }
      }

      if (uri.startsWith("solanaos://source/")) {
        const relPath = uri.slice("solanaos://source/".length);
        const abs = safePath(SRC_ROOT, relPath);
        if (!abs) throw new Error("Invalid path");
        const text = await readFileText(abs);
        if (!text) throw new Error(`File not found: ${relPath}`);
        return { contents: [{ uri, mimeType: "text/plain", text }] };
      }

      throw new Error(`Unknown resource: ${uri}`);
    },
  );

  // ── Tools ─────────────────────────────────────────────────────────────────

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      // ── Solana data ──
      {
        name: "solana_price",
        description: "Get live price and 24h change for a Solana token by mint address or symbol",
        inputSchema: {
          type: "object" as const,
          properties: {
            token: { type: "string", description: "Token mint address or symbol (e.g. 'SOL', 'BONK')" },
          },
          required: ["token"],
        },
      },
      {
        name: "solana_trending",
        description: "Get trending Solana tokens from SolanaTracker",
        inputSchema: {
          type: "object" as const,
          properties: {
            limit: { type: "number", description: "Number of tokens to return (default: 10)" },
            timeframe: { type: "string", description: "Timeframe: '1h', '6h', '24h' (default: '1h')" },
          },
        },
      },
      {
        name: "solana_token_info",
        description: "Get token metadata, security score, and market data",
        inputSchema: {
          type: "object" as const,
          properties: {
            mint: { type: "string", description: "Token mint address" },
          },
          required: ["mint"],
        },
      },
      {
        name: "solana_wallet_pnl",
        description: "Get wallet PnL, trade history, and performance metrics",
        inputSchema: {
          type: "object" as const,
          properties: {
            wallet: { type: "string", description: "Solana wallet address" },
          },
          required: ["wallet"],
        },
      },
      {
        name: "solana_search",
        description: "Search for Solana tokens by name, symbol, or keyword",
        inputSchema: {
          type: "object" as const,
          properties: {
            query: { type: "string", description: "Search query" },
            limit: { type: "number", description: "Max results (default: 10)" },
          },
          required: ["query"],
        },
      },
      // ── Agent fleet ──
      {
        name: "agent_spawn",
        description: "Spawn a SolanaOS coordinator worker (research, trade, memory, skill, scanner)",
        inputSchema: {
          type: "object" as const,
          properties: {
            description: { type: "string", description: "Worker description" },
            type: {
              type: "string",
              enum: ["research", "trade", "memory", "skill", "scanner", "general"],
              description: "Worker type",
            },
            prompt: { type: "string", description: "Task prompt for the worker" },
          },
          required: ["description", "type", "prompt"],
        },
      },
      {
        name: "agent_list",
        description: "List active SolanaOS coordinator workers",
        inputSchema: { type: "object" as const, properties: {} },
      },
      {
        name: "agent_stop",
        description: "Stop a SolanaOS coordinator worker by ID",
        inputSchema: {
          type: "object" as const,
          properties: {
            workerId: { type: "string", description: "Worker ID to stop" },
          },
          required: ["workerId"],
        },
      },
      // ── Memory ──
      {
        name: "memory_recall",
        description: "Query SolanaOS Honcho memory and vault for relevant facts",
        inputSchema: {
          type: "object" as const,
          properties: {
            query: { type: "string", description: "What to recall" },
            tier: {
              type: "string",
              enum: ["KNOWN", "LEARNED", "INFERRED", "all"],
              description: "Memory tier (default: all)",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "memory_write",
        description: "Write a fact to the SolanaOS vault (INFERRED or LEARNED tier)",
        inputSchema: {
          type: "object" as const,
          properties: {
            content: { type: "string", description: "Fact to store" },
            tier: {
              type: "string",
              enum: ["LEARNED", "INFERRED"],
              description: "Memory tier",
            },
          },
          required: ["content"],
        },
      },
      // ── Tasks ──
      {
        name: "task_create",
        description: "Create a SolanaOS background task (ooda, scanner, dream, skill, shell)",
        inputSchema: {
          type: "object" as const,
          properties: {
            type: {
              type: "string",
              enum: ["ooda", "scanner", "dream", "skill", "shell"],
            },
            description: { type: "string" },
            input: { type: "object", description: "Type-specific task input" },
          },
          required: ["type", "description", "input"],
        },
      },
      {
        name: "task_list",
        description: "List SolanaOS tasks with optional status filter",
        inputSchema: {
          type: "object" as const,
          properties: {
            status: {
              type: "string",
              enum: ["pending", "running", "completed", "failed", "stopped"],
            },
          },
        },
      },
      // ── Skills ──
      {
        name: "skill_list",
        description: "List available SolanaOS SKILL.md skills",
        inputSchema: { type: "object" as const, properties: {} },
      },
      {
        name: "skill_run",
        description: "Execute a SolanaOS skill by name",
        inputSchema: {
          type: "object" as const,
          properties: {
            skillName: { type: "string", description: "Skill name" },
            args: { type: "object", description: "Skill arguments" },
          },
          required: ["skillName"],
        },
      },
      // ── Health ──
      {
        name: "gateway_health",
        description: "Check SolanaOS gateway health",
        inputSchema: { type: "object" as const, properties: {} },
      },
    ],
  }));

  server.setRequestHandler(
    CallToolRequestSchema,
    async (request: { params: { name: string; arguments?: Record<string, unknown> } }) => {
      const { name, arguments: args } = request.params;
      const a = (args ?? {}) as Record<string, unknown>;

      const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });
      const json = (v: unknown) => text(JSON.stringify(v, null, 2));

      try {
        switch (name) {
          // ── Solana data ──
          case "solana_price": {
            const data = await gatewayGet(`/api/v1/solana/price?token=${encodeURIComponent(String(a.token))}`, apiKey);
            return json(data);
          }
          case "solana_trending": {
            const limit = Number(a.limit ?? 10);
            const tf = String(a.timeframe ?? "1h");
            const data = await gatewayGet(`/api/v1/solana/trending?limit=${limit}&timeframe=${tf}`, apiKey);
            return json(data);
          }
          case "solana_token_info": {
            const data = await gatewayGet(`/api/v1/solana/token/${encodeURIComponent(String(a.mint))}`, apiKey);
            return json(data);
          }
          case "solana_wallet_pnl": {
            const data = await gatewayGet(`/api/v1/solana/wallet/${encodeURIComponent(String(a.wallet))}/pnl`, apiKey);
            return json(data);
          }
          case "solana_search": {
            const data = await gatewayGet(`/api/v1/solana/search?q=${encodeURIComponent(String(a.query))}&limit=${Number(a.limit ?? 10)}`, apiKey);
            return json(data);
          }

          // ── Agent fleet ──
          case "agent_spawn": {
            const data = await gatewayPost("/api/v1/coordinator/spawn", {
              description: a.description,
              type: a.type,
              prompt: a.prompt,
            }, apiKey);
            return json(data);
          }
          case "agent_list": {
            const data = await gatewayGet("/api/v1/coordinator/workers", apiKey);
            return json(data);
          }
          case "agent_stop": {
            const data = await gatewayPost(`/api/v1/coordinator/workers/${encodeURIComponent(String(a.workerId))}/stop`, {}, apiKey);
            return json(data);
          }

          // ── Memory ──
          case "memory_recall": {
            const data = await gatewayPost("/api/v1/memory/recall", {
              query: a.query,
              tier: a.tier ?? "all",
            }, apiKey);
            return json(data);
          }
          case "memory_write": {
            const data = await gatewayPost("/api/v1/memory/write", {
              content: a.content,
              tier: a.tier ?? "INFERRED",
            }, apiKey);
            return json(data);
          }

          // ── Tasks ──
          case "task_create": {
            const data = await gatewayPost("/api/v1/tasks", {
              type: a.type,
              description: a.description,
              input: a.input ?? {},
            }, apiKey);
            return json(data);
          }
          case "task_list": {
            const statusParam = a.status ? `?status=${encodeURIComponent(String(a.status))}` : "";
            const data = await gatewayGet(`/api/v1/tasks${statusParam}`, apiKey);
            return json(data);
          }

          // ── Skills ──
          case "skill_list": {
            const data = await gatewayGet("/api/v1/skills", apiKey);
            return json(data);
          }
          case "skill_run": {
            const data = await gatewayPost("/api/v1/skills/run", {
              skillName: a.skillName,
              args: a.args ?? {},
            }, apiKey);
            return json(data);
          }

          // ── Health ──
          case "gateway_health": {
            const data = await gatewayGet("/api/v1/health", apiKey);
            return json(data);
          }

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (err) {
        return text(`Error: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  );

  // ── Prompts ───────────────────────────────────────────────────────────────

  server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: [
      {
        name: "solanaos_overview",
        description: "Get a comprehensive overview of SolanaOS capabilities and architecture",
      },
      {
        name: "trade_research",
        description: "Research a Solana token for a trading decision — price, security, trends, memory",
        arguments: [
          { name: "token", description: "Token symbol or mint address", required: true },
        ],
      },
      {
        name: "ooda_loop",
        description: "Run an OODA loop: Observe (data) → Orient (analysis) → Decide (plan) → Act (execute)",
      },
      {
        name: "explain_skill",
        description: "Explain what a SolanaOS skill does and how to use it",
        arguments: [
          { name: "skillName", description: "Skill name (e.g. 'memcrystalize', 'whalefetch')", required: true },
        ],
      },
      {
        name: "soul_context",
        description: "Load SOUL.md as context for an autonomous SolanaOS session",
      },
    ],
  }));

  server.setRequestHandler(
    GetPromptRequestSchema,
    async (request: { params: { name: string; arguments?: Record<string, string> } }) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case "solanaos_overview": {
          const soul = (await readFileText(path.join(REPO_ROOT, "SOUL.md")))
            ?? (await readFileText(path.join(REPO_ROOT, "soul.md")))
            ?? "";
          return {
            description: "SolanaOS architecture and capabilities overview",
            messages: [
              {
                role: "user" as const,
                content: {
                  type: "text" as const,
                  text: `You are SolanaOS, an autonomous Solana trading and operator runtime. Here is your identity document:\n\n${soul}\n\nPlease give a structured overview of your capabilities, tools, and how you work.`,
                },
              },
            ],
          };
        }

        case "trade_research": {
          const token = args?.token ?? "SOL";
          return {
            description: `Research prompt for ${token}`,
            messages: [
              {
                role: "user" as const,
                content: {
                  type: "text" as const,
                  text: `Research ${token} for a trading decision. Use the available tools to:\n1. Get current price and 24h change (solana_price)\n2. Get token security info (solana_token_info if you have a mint)\n3. Check if it appears in trending (solana_trending)\n4. Recall any LEARNED memory about this token (memory_recall)\n\nSummarize with KNOWN data, LEARNED patterns, and your INFERRED signal. Conclude with a suggested action (buy/wait/avoid) with a risk level.`,
                },
              },
            ],
          };
        }

        case "ooda_loop": {
          return {
            description: "OODA loop prompt for SolanaOS autonomous operation",
            messages: [
              {
                role: "user" as const,
                content: {
                  type: "text" as const,
                  text: `Run an OODA loop:\n\n**OBSERVE** — Gather fresh KNOWN data:\n- Use solana_trending to see what's moving\n- Use memory_recall to surface relevant LEARNED patterns\n\n**ORIENT** — Synthesize:\n- What signals are KNOWN with confidence?\n- What LEARNED patterns apply?\n- What can you INFER?\n\n**DECIDE** — Form a plan:\n- Identify 1-3 high-conviction opportunities\n- Assess risk level (low/medium/high)\n- Decide: act now, wait, or observe more?\n\n**ACT** — If acting:\n- Use agent_spawn to create a trade worker if live execution is warranted\n- Otherwise use memory_write to log your INFERRED signals for future loops\n\nReport findings.`,
                },
              },
            ],
          };
        }

        case "explain_skill": {
          const skillName = args?.skillName ?? "";
          const skillPath = path.join(REPO_ROOT, "skills", `${skillName}.md`);
          const altPath = path.join(REPO_ROOT, "skills", skillName, "SKILL.md");
          const content =
            (await readFileText(skillPath)) ??
            (await readFileText(altPath)) ??
            `Skill "${skillName}" not found in skills/ directory.`;
          return {
            description: `Explanation of ${skillName} skill`,
            messages: [
              {
                role: "user" as const,
                content: {
                  type: "text" as const,
                  text: `Explain what this SolanaOS skill does and how to use it:\n\n\`\`\`markdown\n${content}\n\`\`\``,
                },
              },
            ],
          };
        }

        case "soul_context": {
          const soul = (await readFileText(path.join(REPO_ROOT, "SOUL.md")))
            ?? (await readFileText(path.join(REPO_ROOT, "soul.md")))
            ?? "SOUL.md not found.";
          return {
            description: "SolanaOS soul context prompt",
            messages: [
              {
                role: "user" as const,
                content: {
                  type: "text" as const,
                  text: soul,
                },
              },
            ],
          };
        }

        default:
          throw new Error(`Unknown prompt: ${name}`);
      }
    },
  );

  return server;
}

export async function validateGateway(): Promise<void> {
  try {
    await gatewayGet("/api/v1/health");
  } catch {
    console.warn(`⚠ SolanaOS gateway unreachable at ${GATEWAY_URL} — tool data will be unavailable`);
  }
}
