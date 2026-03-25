#!/usr/bin/env node
/**
 * register-scanner-agent.mjs — Register the pump.fun scanner as an on-chain agent
 *
 * Uses 8004 Trustless Agent Registry + Pinata IPFS.
 * Follows the same patterns as agent-registry.mjs but is scanner-specific.
 *
 * Usage:
 *   node scripts/register-scanner-agent.mjs [--dry-run] [--cluster devnet]
 *
 * Env vars:
 *   SOLANA_PRIVATE_KEY       — JSON array of secret key bytes
 *   HELIUS_RPC_URL           — Solana RPC endpoint
 *   PINATA_JWT               — Pinata JWT for IPFS pinning
 *   AGENT_REGISTRY_SYNC_URL  — Convex HTTP sync endpoint (optional)
 *   AGENT_REGISTRY_SYNC_KEY  — Auth key for sync endpoint (optional)
 */

import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const nanohubModules = path.join(scriptDir, "..", "nanohub", "node_modules");

// Dynamic ESM imports from nanohub's node_modules
const { Keypair, PublicKey } = await import(path.join(nanohubModules, "@solana", "web3.js", "lib", "index.browser.cjs.js"));
const sdk8004 = await import(path.join(nanohubModules, "8004-solana", "dist", "index.js"));
const { SolanaSDK, IPFSClient, ServiceType, buildRegistrationFileJson } = sdk8004;

function env(name, fallback = "") {
  const value = process.env[name];
  return value === undefined ? fallback : String(value).trim();
}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const cluster = args.find((a) => a.startsWith("--cluster="))?.split("=")[1]
  || env("AGENT_REGISTRY_CLUSTER", "mainnet-beta");

async function main() {

  // Load signer (supports JSON array or base58 format)
  const rawKey = env("SOLANA_PRIVATE_KEY");
  if (!rawKey) {
    console.error("ERROR: SOLANA_PRIVATE_KEY is required");
    process.exit(1);
  }
  let keyBytes;
  if (rawKey.startsWith("[")) {
    keyBytes = Uint8Array.from(JSON.parse(rawKey));
  } else {
    // Base58 encoded key — decode manually
    const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    let result = 0n;
    for (const ch of rawKey) {
      const idx = ALPHABET.indexOf(ch);
      if (idx < 0) throw new Error(`Invalid base58 character: ${ch}`);
      result = result * 58n + BigInt(idx);
    }
    const hex = result.toString(16).padStart(128, "0");
    keyBytes = Uint8Array.from(hex.match(/.{2}/g).map((b) => parseInt(b, 16)));
  }
  const signer = Keypair.fromSecretKey(keyBytes);
  const wallet = signer.publicKey.toBase58();
  console.log(`[scanner-agent] Wallet: ${wallet}`);
  console.log(`[scanner-agent] Cluster: ${cluster}`);

  // Build scanner-specific metadata
  const metadata = buildRegistrationFileJson({
    name: "SolanaOS Pump.fun Scanner",
    description:
      "Autonomous pump.fun token scanner. Fetches top 100 trending tokens from GeckoTerminal + Solana Tracker, " +
      "classifies by trading tiers (fresh snipers, near-graduation, micro/mid/large cap), validates bonding curve " +
      "state on-chain via Helius RPC, and sends Telegram alerts. Runs hourly via Claude Code dispatch + locally " +
      "via Chrome computer use. Part of the SolanaOS trading agent stack.",
    image: env("AGENT_REGISTRY_IMAGE", ""),
    services: [
      { type: ServiceType.WALLET, value: wallet },
      { type: ServiceType.A2A, value: "https://solanaos.net/st/pump-scan" },
    ],
    skills: [
      "advanced_reasoning_planning/strategic_planning",
      "data_engineering/data_engineering",
      "data_engineering/data_quality_assessment",
    ],
    domains: [
      "finance_and_business/finance",
      "technology/blockchain/cryptocurrency",
    ],
    x402Support: false,
  });

  console.log(`[scanner-agent] Metadata:`, JSON.stringify(metadata, null, 2));

  if (dryRun) {
    console.log("[scanner-agent] --dry-run: would register with above metadata");
    return;
  }

  // Pin metadata to IPFS via Pinata
  const pinataJwt = env("PINATA_JWT") || env("PINATA_JWT_SECRET");
  if (!pinataJwt) {
    console.error("ERROR: PINATA_JWT is required for IPFS pinning");
    process.exit(1);
  }

  console.log("[scanner-agent] Pinning metadata to IPFS via Pinata...");
  const ipfs = new IPFSClient({ pinataEnabled: true, pinataJwt });
  const cid = await ipfs.addJson(metadata);
  if (typeof ipfs.close === "function") await ipfs.close();
  const tokenUri = `ipfs://${cid}`;
  console.log(`[scanner-agent] Metadata CID: ${cid}`);
  console.log(`[scanner-agent] Token URI: ${tokenUri}`);

  // Initialize SDK
  const rpcUrl = env("HELIUS_RPC_URL") || env("SOLANA_RPC_URL");
  const sdkConfig = { cluster, signer, useIndexer: true, indexerFallback: true };
  if (rpcUrl) sdkConfig.rpcUrl = rpcUrl;
  const sdk = new SolanaSDK(sdkConfig);

  // Check if agent already exists
  let existing = null;
  try {
    existing = await sdk.getAgentByWallet(wallet);
  } catch (e) {
    console.log(`[scanner-agent] No existing agent found: ${e.message}`);
  }

  let assetAddress;
  let action;

  if (existing?.asset) {
    assetAddress = typeof existing.asset === "string"
      ? existing.asset
      : existing.asset.toBase58?.() ?? String(existing.asset);
    action = "update";
    console.log(`[scanner-agent] Existing agent found: ${assetAddress}`);

    // Update metadata URI
    try {
      await sdk.setAgentUri(new PublicKey(assetAddress), tokenUri);
      console.log("[scanner-agent] Updated agent URI");
    } catch (e) {
      console.log(`[scanner-agent] URI update skipped: ${e.message}`);
    }
  } else {
    action = "register";
    console.log("[scanner-agent] Registering new agent...");

    const result = await sdk.registerAgent(tokenUri, { atomEnabled: true });
    assetAddress = result.asset?.toBase58?.() ?? String(result.asset);
    console.log(`[scanner-agent] Registered! Asset: ${assetAddress}`);
    console.log(`[scanner-agent] Tx: ${result.signature}`);

    // Set agent wallet
    try {
      await sdk.setAgentWallet(new PublicKey(assetAddress), signer);
      console.log("[scanner-agent] Agent wallet set");
    } catch (e) {
      console.log(`[scanner-agent] Wallet set skipped: ${e.message}`);
    }
  }

  // Set on-chain metadata
  const metadataEntries = {
    scanner_type: "pump_fun",
    pipeline: "geckoterminal+solanatracker+helius",
    scan_endpoint: "https://solanaos.net/st/pump-scan",
    dashboard_url: "https://solanaos.net/tracker",
    telegram_bot: "@Nemosolanabot",
  };

  for (const [key, value] of Object.entries(metadataEntries)) {
    try {
      await sdk.setMetadata(new PublicKey(assetAddress), key, value);
    } catch (e) {
      console.log(`[scanner-agent] Metadata ${key} skipped: ${e.message}`);
    }
  }

  // Save state locally
  const stateDir = path.join(os.homedir(), ".nanosolana", "registry");
  await fs.mkdir(stateDir, { recursive: true });
  const state = {
    action,
    asset: assetAddress,
    wallet,
    cluster,
    tokenUri,
    cid,
    metadata,
    registeredAt: new Date().toISOString(),
    onChainMetadata: metadataEntries,
  };
  await fs.writeFile(
    path.join(stateDir, "scanner-agent.json"),
    JSON.stringify(state, null, 2),
  );
  console.log(`[scanner-agent] State saved to ~/.nanosolana/registry/scanner-agent.json`);

  // Sync to nanohub Convex backend
  const syncUrl = env("AGENT_REGISTRY_SYNC_URL");
  const syncKey = env("AGENT_REGISTRY_SYNC_KEY");
  if (syncUrl && syncKey) {
    console.log("[scanner-agent] Syncing to nanohub...");
    try {
      const resp = await fetch(syncUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${syncKey}`,
        },
        body: JSON.stringify({
          ...state,
          agentType: "scanner",
          status: "ok",
          trigger: "register-scanner-agent",
        }),
      });
      if (resp.ok) {
        console.log("[scanner-agent] Synced to nanohub");
      } else {
        console.log(`[scanner-agent] Sync failed: HTTP ${resp.status}`);
      }
    } catch (e) {
      console.log(`[scanner-agent] Sync error: ${e.message}`);
    }
  }

  // Fetch initial reputation
  try {
    const summary = await sdk.getSummary(new PublicKey(assetAddress));
    console.log(`[scanner-agent] Reputation: score=${summary?.averageScore ?? 0}, feedbacks=${summary?.totalFeedbacks ?? 0}`);
  } catch {
    console.log("[scanner-agent] No reputation data yet (expected for new agents)");
  }

  console.log("\n[scanner-agent] Done!");
  console.log(`  Asset:     ${assetAddress}`);
  console.log(`  IPFS:      ${tokenUri}`);
  console.log(`  Explorer:  https://explorer.solana.com/address/${assetAddress}${cluster !== "mainnet-beta" ? `?cluster=${cluster}` : ""}`);
  console.log(`  Dashboard: https://solanaos.net/agents/${assetAddress}`);
}

main().catch((err) => {
  console.error("[scanner-agent] Fatal:", err);
  process.exit(1);
});
