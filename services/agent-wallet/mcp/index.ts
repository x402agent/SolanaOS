#!/usr/bin/env npx tsx
/**
 * NanoSolana Agent Wallet — MCP Server
 *
 * Gives AI agents access to the NanoSolana wallet vault:
 * create wallets (Solana + EVM), check balances, sign transactions,
 * transfer tokens, deploy wallet APIs into E2B sandboxes,
 * and manage Privy-hosted wallets.
 *
 * All operations go through the Go wallet API server.
 * Supports self-custodial vault wallets AND Privy managed wallets.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// ─── Configuration ──────────────────────────────────────────────

const API_BASE =
  process.env.WALLET_API_URL || "http://localhost:8420/v1";
const API_KEY = process.env.WALLET_API_KEY || "";

// ─── API Helper ─────────────────────────────────────────────────

async function api(
  path: string,
  method = "GET",
  body?: Record<string, unknown>
): Promise<unknown> {
  const url = `${API_BASE}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (API_KEY) {
    headers["Authorization"] = `Bearer ${API_KEY}`;
  }

  const options: RequestInit = { method, headers };
  if (body && method !== "GET") {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(url, options);
  const data = await res.json();

  if (!res.ok) {
    const error = (data as { error?: string }).error || `HTTP ${res.status}`;
    throw new Error(error);
  }

  return data;
}

function jsonResponse(data: unknown) {
  return {
    content: [
      { type: "text" as const, text: JSON.stringify(data, null, 2) },
    ],
  };
}

// ─── MCP Server ─────────────────────────────────────────────────

const server = new McpServer(
  {
    name: "nanosolana-agent-wallet",
    version: "1.0.0",
  },
  {
    instructions: `NanoSolana Agent Wallet gives AI agents their own blockchain wallets with two modes:

## Vault Wallets (Self-Custodial)
Private keys are AES-256-GCM encrypted in a local vault. Full control, no third-party dependency.
- create_wallet → creates Solana or EVM wallet
- list_wallets → see all vault wallets
- get_balance → check native token balance
- transfer → send SOL/ETH/native tokens
- transfer_token → send ERC-20/SPL tokens
- sign_message → sign arbitrary data

## Privy Wallets (Managed)
Keys managed by Privy's infrastructure. No raw key handling, built-in policies.
- privy_create_wallet → create Privy-managed wallet
- privy_list_wallets → list managed wallets
- privy_sign → sign with Privy wallet
- privy_send → send transaction via Privy

## E2B Deployment
Deploy the wallet API into isolated E2B sandboxes for remote agent access.
- deploy_sandbox → spin up wallet API in E2B
- list_deployments → see running sandboxes
- teardown_sandbox → stop a deployment

## Supported Chains
- **Solana:** Mainnet, Devnet
- **EVM:** Ethereum, Base, Arbitrum, Optimism, Polygon, BSC, Avalanche, Zora, PulseChain

## Quick Start
1. create_wallet with chain "solana" or "evm"
2. Fund the wallet externally
3. Use transfer/sign operations
4. Optionally deploy to E2B for remote access`,
  }
);

// ─── Vault Wallet Tools ─────────────────────────────────────────

server.tool(
  "create_wallet",
  "Create a new Solana or EVM wallet in the encrypted vault. " +
    "Returns wallet ID and address. Private key is AES-256-GCM encrypted server-side.",
  {
    label: z.string().default("").describe("Friendly name for the wallet"),
    chain: z
      .enum(["solana", "evm"])
      .default("solana")
      .describe("Blockchain family"),
    chain_id: z
      .number()
      .int()
      .default(900)
      .describe(
        "Chain ID (900=Solana, 1=Ethereum, 8453=Base, 42161=Arbitrum, 10=Optimism, 137=Polygon)"
      ),
  },
  async ({ label, chain, chain_id }) => {
    const data = await api("/wallets", "POST", { label, chain, chain_id });
    return jsonResponse(data);
  }
);

server.tool(
  "list_wallets",
  "List all wallets in the vault. Returns IDs, addresses, chains, and status.",
  {},
  async () => {
    const data = await api("/wallets");
    return jsonResponse(data);
  }
);

server.tool(
  "get_wallet",
  "Get details for a specific vault wallet by ID.",
  {
    wallet_id: z.string().describe("Wallet ID"),
  },
  async ({ wallet_id }) => {
    const data = await api(`/wallets/${wallet_id}`);
    return jsonResponse(data);
  }
);

server.tool(
  "get_balance",
  "Get native token balance (SOL, ETH, etc.) for a vault wallet.",
  {
    wallet_id: z.string().describe("Wallet ID"),
    chain_id: z
      .number()
      .int()
      .optional()
      .describe("Override chain ID for EVM wallets"),
  },
  async ({ wallet_id, chain_id }) => {
    const params = chain_id ? `?chain_id=${chain_id}` : "";
    const data = await api(`/wallets/${wallet_id}/balance${params}`);
    return jsonResponse(data);
  }
);

server.tool(
  "transfer",
  "Send native tokens (SOL, ETH, etc.) from a vault wallet. " +
    "Amount in human-readable format (e.g. '0.1' for 0.1 SOL).",
  {
    wallet_id: z.string().describe("Wallet ID to send from"),
    to: z.string().describe("Recipient address"),
    amount: z
      .string()
      .describe("Amount in human-readable format (e.g. '0.1')"),
    chain_id: z.number().int().optional().describe("Override chain ID"),
  },
  async ({ wallet_id, to, amount, chain_id }) => {
    const body: Record<string, unknown> = { to, amount };
    if (chain_id) body.chain_id = chain_id;
    const data = await api(`/wallets/${wallet_id}/transfer`, "POST", body);
    return jsonResponse(data);
  }
);

server.tool(
  "transfer_token",
  "Send ERC-20 or SPL tokens from a vault wallet.",
  {
    wallet_id: z.string().describe("Wallet ID"),
    token: z.string().describe("Token contract address"),
    to: z.string().describe("Recipient address"),
    amount: z.string().describe("Amount in human-readable format"),
    chain_id: z.number().int().describe("Chain ID"),
    decimals: z
      .number()
      .int()
      .default(6)
      .describe("Token decimals (6 for USDC)"),
  },
  async ({ wallet_id, token, to, amount, chain_id, decimals }) => {
    const data = await api(`/wallets/${wallet_id}/transfer-token`, "POST", {
      token,
      to,
      amount,
      chain_id,
      decimals,
    });
    return jsonResponse(data);
  }
);

server.tool(
  "sign_message",
  "Sign an arbitrary message with a vault wallet's private key.",
  {
    wallet_id: z.string().describe("Wallet ID"),
    message: z.string().describe("Message to sign"),
  },
  async ({ wallet_id, message }) => {
    const data = await api(`/wallets/${wallet_id}/sign`, "POST", { message });
    return jsonResponse(data);
  }
);

server.tool(
  "pause_wallet",
  "Emergency pause a vault wallet. No transactions can be signed while paused.",
  {
    wallet_id: z.string().describe("Wallet ID to pause"),
  },
  async ({ wallet_id }) => {
    const data = await api(`/wallets/${wallet_id}/pause`, "POST");
    return jsonResponse(data);
  }
);

server.tool(
  "unpause_wallet",
  "Resume a paused vault wallet.",
  {
    wallet_id: z.string().describe("Wallet ID to unpause"),
  },
  async ({ wallet_id }) => {
    const data = await api(`/wallets/${wallet_id}/unpause`, "POST");
    return jsonResponse(data);
  }
);

server.tool(
  "delete_wallet",
  "Delete a vault wallet permanently.",
  {
    wallet_id: z.string().describe("Wallet ID to delete"),
  },
  async ({ wallet_id }) => {
    const data = await api(`/wallets/${wallet_id}`, "DELETE");
    return jsonResponse(data);
  }
);

server.tool(
  "eth_call",
  "Execute a read-only call against an EVM smart contract. " +
    "Returns raw hex result. No gas cost.",
  {
    chain_id: z.number().int().describe("Chain ID"),
    to: z.string().describe("Contract address"),
    data: z.string().describe("ABI-encoded calldata (0x-prefixed)"),
  },
  async ({ chain_id, to, data }) => {
    const result = await api("/eth-call", "POST", { chain_id, to, data });
    return jsonResponse(result);
  }
);

server.tool(
  "get_chains",
  "List all supported chains with native tokens and configuration.",
  {},
  async () => {
    const data = await api("/chains");
    return jsonResponse(data);
  }
);

// ─── Privy Managed Wallet Tools ─────────────────────────────────

server.tool(
  "privy_create_wallet",
  "Create a Privy-managed wallet. Keys are held by Privy infrastructure — " +
    "no raw key exposure. Supports ethereum, solana, base, polygon, etc.",
  {
    chain_type: z
      .string()
      .default("ethereum")
      .describe("Chain type: ethereum, solana, base, polygon, arbitrum"),
  },
  async ({ chain_type }) => {
    const data = await api("/privy/wallets", "POST", { chain_type });
    return jsonResponse(data);
  }
);

server.tool(
  "privy_list_wallets",
  "List all Privy-managed wallets.",
  {
    chain_type: z
      .string()
      .optional()
      .describe("Filter by chain type"),
  },
  async ({ chain_type }) => {
    const params = chain_type ? `?chain_type=${chain_type}` : "";
    const data = await api(`/privy/wallets${params}`);
    return jsonResponse(data);
  }
);

server.tool(
  "privy_get_wallet",
  "Get details for a Privy-managed wallet.",
  {
    wallet_id: z.string().describe("Privy wallet ID"),
  },
  async ({ wallet_id }) => {
    const data = await api(`/privy/wallets/${wallet_id}`);
    return jsonResponse(data);
  }
);

server.tool(
  "privy_sign",
  "Sign a message with a Privy-managed wallet.",
  {
    wallet_id: z.string().describe("Privy wallet ID"),
    message: z.string().describe("Message to sign"),
  },
  async ({ wallet_id, message }) => {
    const data = await api(`/privy/wallets/${wallet_id}/sign`, "POST", {
      message,
    });
    return jsonResponse(data);
  }
);

server.tool(
  "privy_send",
  "Send a transaction through a Privy-managed wallet. " +
    "Privy handles signing and broadcasting.",
  {
    wallet_id: z.string().describe("Privy wallet ID"),
    to: z.string().describe("Recipient address"),
    value: z.string().default("0").describe("Value in wei/lamports"),
    data: z.string().default("").describe("Calldata for contract interaction"),
    chain_id: z.number().int().optional().describe("EVM chain ID"),
    chain_type: z
      .string()
      .default("ethereum")
      .describe("Chain type: ethereum or solana"),
  },
  async ({ wallet_id, to, value, data, chain_id, chain_type }) => {
    const body: Record<string, unknown> = { to, value, data, chain_type };
    if (chain_id) body.chain_id = chain_id;
    const result = await api(
      `/privy/wallets/${wallet_id}/send`,
      "POST",
      body
    );
    return jsonResponse(result);
  }
);

// ─── E2B Deployment Tools ───────────────────────────────────────

server.tool(
  "deploy_sandbox",
  "Deploy the wallet API into an E2B sandbox for isolated remote agent access. " +
    "Returns the sandbox API URL that agents can call directly.",
  {
    agent_id: z
      .string()
      .default("")
      .describe("Unique agent ID (auto-generated if empty)"),
    env: z
      .record(z.string())
      .default({})
      .describe(
        "Environment variables for the sandbox (e.g. SOLANA_RPC_URL, VAULT_PASSPHRASE)"
      ),
  },
  async ({ agent_id, env }) => {
    const data = await api("/deploy", "POST", { agent_id, env });
    return jsonResponse(data);
  }
);

server.tool(
  "list_deployments",
  "List all active E2B sandbox deployments.",
  {},
  async () => {
    const data = await api("/deployments");
    return jsonResponse(data);
  }
);

server.tool(
  "teardown_sandbox",
  "Stop and remove an E2B sandbox deployment.",
  {
    agent_id: z.string().describe("Agent ID of the deployment to remove"),
  },
  async ({ agent_id }) => {
    const data = await api(`/deployments/${agent_id}`, "DELETE");
    return jsonResponse(data);
  }
);

// ─── Start Server ───────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
