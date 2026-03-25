#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { PumpAgent } from "@pump-fun/agent-payments-sdk";
import {
  IPFSClient,
  ServiceType,
  SolanaSDK,
  buildRegistrationFileJson,
} from "8004-solana";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

function env(name, fallback = "") {
  const value = process.env[name];
  return value === undefined ? fallback : String(value).trim();
}

function envBool(name, fallback = false) {
  const raw = env(name, "");
  if (!raw) return fallback;
  switch (raw.toLowerCase()) {
    case "1":
    case "true":
    case "yes":
    case "on":
      return true;
    case "0":
    case "false":
    case "no":
    case "off":
      return false;
    default:
      return fallback;
  }
}

function csv(name) {
  return env(name, "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function pinataAuth(prefix) {
  return {
    jwt: env(`${prefix}_PINATA_JWT`) || env("PINATA_JWT_SECRET"),
    apiKey: env(`${prefix}_PINATA_API_KEY`) || env("PINATA_API_KEY"),
    apiSecret: env(`${prefix}_PINATA_API_SECRET`) || env("PINATA_API_SECRET"),
  };
}

async function pinJsonToPinata(metadata, auth, filename) {
  const errors = [];

  if (auth.apiKey && auth.apiSecret) {
    try {
      const response = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          pinata_api_key: auth.apiKey,
          pinata_secret_api_key: auth.apiSecret,
        },
        body: JSON.stringify({
          pinataMetadata: { name: filename },
          pinataContent: metadata,
        }),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} - ${await response.text()}`);
      }
      const result = await response.json();
      const cid = result?.IpfsHash || result?.cid;
      if (!cid) {
        throw new Error(`No CID returned from Pinata. Response: ${JSON.stringify(result)}`);
      }
      return cid;
    } catch (error) {
      errors.push(`apiKey/apiSecret: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (auth.jwt) {
    try {
      const ipfs = new IPFSClient({
        pinataEnabled: true,
        pinataJwt: auth.jwt,
      });
      const cid = await ipfs.addJson(metadata);
      if (typeof ipfs.close === "function") {
        await ipfs.close();
      }
      return cid;
    } catch (error) {
      errors.push(`jwt: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (errors.length === 0) {
    throw new Error("missing Pinata credentials");
  }
  throw new Error(`Failed to pin to Pinata: ${errors.join(" | ")}`);
}

function maybePublicKey(value) {
  if (!value) return null;
  try {
    return new PublicKey(value);
  } catch {
    return null;
  }
}

function toBase58(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value?.toBase58 === "function") return value.toBase58();
  if (typeof value?.toString === "function") return value.toString();
  return String(value);
}

function toPublicKey(value) {
  if (!value) return null;
  if (value instanceof PublicKey) return value;
  try {
    return new PublicKey(toBase58(value));
  } catch {
    return null;
  }
}

function pickAgentAsset(record) {
  if (!record || typeof record !== "object") return null;
  const candidates = [
    record.asset,
    record.assetPubkey,
    record.asset_pubkey,
    record.mint,
    record.pubkey,
    record.publicKey,
  ];
  for (const candidate of candidates) {
    const pubkey = toPublicKey(candidate);
    if (pubkey) return pubkey;
  }
  return null;
}

function appendPumpSummary(description, pumpProfile) {
  if (!pumpProfile?.configured) return description;
  const parts = [
    description,
    `Tokenized payments enabled via pump.fun agent mint ${pumpProfile.agentMint}.`,
  ];
  if (pumpProfile.currencyMint && pumpProfile.priceAmount) {
    parts.push(
      `Payment currency ${pumpProfile.currencyMint} with price ${pumpProfile.priceAmount}.`,
    );
  }
  return parts.join(" ");
}

async function ensureDir(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function writeState(payload) {
  const statePath =
    env("AGENT_REGISTRY_STATE_PATH") ||
    path.join(os.homedir(), ".nanosolana", "registry", "agent-registry.json");
  await ensureDir(statePath);
  await fs.writeFile(statePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function readAcpManifest() {
  const explicitPath = env("ACP_REGISTRY_MANIFEST_PATH");
  const manifestPath =
    explicitPath || path.resolve(scriptDir, "..", "acp_registry", "agent.json");
  try {
    const raw = await fs.readFile(manifestPath, "utf8");
    const payload = JSON.parse(raw);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return null;
    }

    const distribution =
      payload.distribution &&
      typeof payload.distribution === "object" &&
      !Array.isArray(payload.distribution)
        ? payload.distribution
        : null;

    return {
      schemaVersion:
        typeof payload.schema_version === "number" ? payload.schema_version : null,
      name: typeof payload.name === "string" ? payload.name : "",
      displayName:
        typeof payload.display_name === "string" ? payload.display_name : "",
      description:
        typeof payload.description === "string" ? payload.description : "",
      distribution: distribution
        ? {
            type:
              typeof distribution.type === "string" ? distribution.type : "",
            command:
              typeof distribution.command === "string"
                ? distribution.command
                : "",
            args: Array.isArray(distribution.args)
              ? distribution.args
                  .filter((entry) => typeof entry === "string")
                  .map((entry) => entry.trim())
                  .filter(Boolean)
              : [],
          }
        : null,
    };
  } catch {
    return null;
  }
}

async function syncToHub(syncState) {
  const syncUrl = env("AGENT_REGISTRY_SYNC_URL");
  const syncKey = env("AGENT_REGISTRY_SYNC_KEY");
  if (!syncUrl || !syncKey) {
    return { skipped: true, reason: "sync endpoint not configured" };
  }
  if (!syncState?.asset || !syncState?.wallet || !syncState?.metadata) {
    return { skipped: true, reason: "sync payload missing required fields" };
  }

  const response = await fetch(syncUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${syncKey}`,
    },
    body: JSON.stringify(syncState),
  });
  const payloadText = await response.text();
  let payload = null;
  try {
    payload = JSON.parse(payloadText);
  } catch {
    payload = null;
  }
  if (!response.ok) {
    throw new Error(
      `hub sync ${response.status}: ${
        (payload && typeof payload?.error === "string" && payload.error) || payloadText.slice(0, 220)
      }`,
    );
  }
  return payload;
}

async function buildPumpProfile(rpcUrl) {
  const agentMint = env("PUMP_FUN_AGENT_MINT_ADDRESS");
  const currencyMint = env("PUMP_FUN_CURRENCY_MINT");
  const priceAmount = env("PUMP_FUN_PAYMENT_AMOUNT");
  const enabled = envBool("PUMP_FUN_ENABLED", Boolean(agentMint));

  if (!enabled && !agentMint && !currencyMint && !priceAmount) {
    return { configured: false };
  }

  const agentMintKey = maybePublicKey(agentMint);
  const currencyMintKey = maybePublicKey(currencyMint);
  if (!agentMintKey) {
    return {
      configured: false,
      error: "invalid pump.fun agent mint",
    };
  }

  const connection = rpcUrl ? new Connection(rpcUrl, "confirmed") : undefined;
  const environment = env("PUMP_FUN_ENVIRONMENT", "mainnet");
  const pumpAgent = new PumpAgent(agentMintKey, environment, connection);

  return {
    configured: true,
    environment,
    agentMint: agentMintKey.toBase58(),
    currencyMint: currencyMintKey ? currencyMintKey.toBase58() : "",
    priceAmount,
    paymentReady: Boolean(currencyMintKey && priceAmount),
    sdkLoaded: Boolean(pumpAgent),
  };
}

async function resolveTokenUri(metadata) {
  const explicit = env("AGENT_REGISTRY_TOKEN_URI");
  if (explicit) return explicit;

  const auth = pinataAuth("AGENT_REGISTRY");
  if (!auth.jwt && !(auth.apiKey && auth.apiSecret)) return "";

  const cid = await pinJsonToPinata(metadata, auth, "agent-registry.json");
  return `ipfs://${cid}`;
}

function buildServices(walletAddress) {
  const services = [];
  if (walletAddress) {
    services.push({ type: ServiceType.WALLET, value: walletAddress });
  }
  if (env("AGENT_REGISTRY_MCP_URL")) {
    services.push({ type: ServiceType.MCP, value: env("AGENT_REGISTRY_MCP_URL") });
  }
  if (env("AGENT_REGISTRY_A2A_URL")) {
    services.push({ type: ServiceType.A2A, value: env("AGENT_REGISTRY_A2A_URL") });
  }
  if (env("AGENT_REGISTRY_SNS")) {
    services.push({ type: ServiceType.SNS, value: env("AGENT_REGISTRY_SNS") });
  }
  if (env("AGENT_REGISTRY_ENS")) {
    services.push({ type: ServiceType.ENS, value: env("AGENT_REGISTRY_ENS") });
  }
  if (env("AGENT_REGISTRY_DID")) {
    services.push({ type: ServiceType.DID, value: env("AGENT_REGISTRY_DID") });
  }
  return services;
}

async function setStaticMetadata(sdk, assetPubkey, key, value, syncState, errorKey) {
  if (!assetPubkey || !value) return;
  try {
    await sdk.setMetadata(assetPubkey, key, value);
  } catch (error) {
    syncState[errorKey] = error instanceof Error ? error.message : String(error);
  }
}

async function main() {
  const rawPrivateKey = env("SOLANA_PRIVATE_KEY");
  if (!rawPrivateKey) {
    throw new Error("SOLANA_PRIVATE_KEY is required for agent registry sync");
  }

  const signer = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(rawPrivateKey)),
  );

  const cluster = env("AGENT_REGISTRY_CLUSTER", "mainnet-beta");
  const rpcUrl =
    env("AGENT_REGISTRY_RPC_URL") ||
    env("HELIUS_RPC_URL") ||
    env("SOLANA_RPC_URL");
  const trigger = env("AGENT_REGISTRY_TRIGGER", process.argv[2] || "sync");
  const pumpProfile = await buildPumpProfile(rpcUrl);
  const acp = await readAcpManifest();

  const sdkConfig = {
    cluster,
    signer,
    useIndexer: true,
    indexerFallback: true,
  };
  if (rpcUrl) sdkConfig.rpcUrl = rpcUrl;
  if (env("AGENT_REGISTRY_INDEXER_API_KEY")) {
    sdkConfig.indexerApiKey = env("AGENT_REGISTRY_INDEXER_API_KEY");
  }

  const sdk = new SolanaSDK(sdkConfig);
  const metadata = buildRegistrationFileJson({
    name: env("AGENT_REGISTRY_NAME", "SolanaOS"),
    description: appendPumpSummary(
      env(
        "AGENT_REGISTRY_DESCRIPTION",
        "Autonomous Solana trading agent with OODA runtime, Telegram control, x402 monetization, and TamaGOchi state.",
      ),
      pumpProfile,
    ),
    image: env("AGENT_REGISTRY_IMAGE"),
    services: buildServices(signer.publicKey.toBase58()),
    skills: csv("AGENT_REGISTRY_SKILLS"),
    domains: csv("AGENT_REGISTRY_DOMAINS"),
    x402Support: envBool("AGENT_REGISTRY_X402_SUPPORT", false),
  });

  const tokenUri = await resolveTokenUri(metadata);
  const siteUrl = env("AGENT_REGISTRY_SITE_URL");
  const dashboardUrl = env("AGENT_REGISTRY_DASHBOARD_URL");
  const pairUrl = env("AGENT_REGISTRY_PAIR_URL");
  const runtimeVersion = env("SOLANAOS_VERSION") || env("NANOSOLANA_VERSION");
  const capabilities = Array.from(
    new Set([...(acp ? ["acp"] : []), ...csv("AGENT_CAPABILITIES")]),
  );
  const syncState = {
    status: "ok",
    trigger,
    cluster,
    wallet: signer.publicKey.toBase58(),
    tokenUri,
    siteUrl,
    dashboardUrl,
    pairUrl,
    syncedAt: new Date().toISOString(),
    helper: "8004-solana + pump-fun",
    runtimeVersion,
    metadata,
    pump: pumpProfile,
    capabilities,
    acp,
  };

  let existing = null;
  try {
    existing = await sdk.getAgentByWallet(signer.publicKey.toBase58());
  } catch (error) {
    syncState.lookupError = error instanceof Error ? error.message : String(error);
  }

  let assetPubkey = pickAgentAsset(existing);
  if (assetPubkey) {
    syncState.action = "exists";
    syncState.asset = assetPubkey.toBase58();
  }

  if (!assetPubkey && syncState.lookupError) {
    syncState.action = "noop";
    syncState.reason = "agent lookup failed; refusing to register without a clean wallet lookup";
    await writeState(syncState);
    console.log(JSON.stringify(syncState));
    return;
  }

  if (!assetPubkey) {
    if (!tokenUri) {
      syncState.action = "noop";
      syncState.reason = "missing AGENT_REGISTRY_TOKEN_URI or Pinata credentials";
      await writeState(syncState);
      console.log(JSON.stringify(syncState));
      return;
    }

    const registerOptions = {};
    if (envBool("AGENT_REGISTRY_ENABLE_ATOM", false)) {
      registerOptions.atomEnabled = true;
    }
    const result = await sdk.registerAgent(tokenUri, registerOptions);
    assetPubkey = toPublicKey(result?.asset);
    syncState.action = "registered";
    syncState.asset = toBase58(result?.asset);
    syncState.signature = toBase58(result?.signature);

    if (assetPubkey) {
      try {
        await sdk.setAgentWallet(assetPubkey, signer);
      } catch (error) {
        syncState.setAgentWalletError =
          error instanceof Error ? error.message : String(error);
      }
    }
  }

  const shouldWriteStaticMetadata = syncState.action === "registered";

  if (assetPubkey) {
    await setStaticMetadata(sdk, assetPubkey, "site_url", siteUrl, syncState, "siteMetadataError");
    await setStaticMetadata(
      sdk,
      assetPubkey,
      "dashboard_url",
      dashboardUrl,
      syncState,
      "dashboardMetadataError",
    );
    await setStaticMetadata(sdk, assetPubkey, "pair_url", pairUrl, syncState, "pairMetadataError");

    if (shouldWriteStaticMetadata && runtimeVersion) {
      await setStaticMetadata(
        sdk,
        assetPubkey,
        "version",
        runtimeVersion,
        syncState,
        "versionMetadataError",
      );
    }

    if (shouldWriteStaticMetadata && pumpProfile?.configured) {
      await setStaticMetadata(
        sdk,
        assetPubkey,
        "pump_fun_mint",
        pumpProfile.agentMint,
        syncState,
        "pumpMetadataError",
      );
      if (pumpProfile.currencyMint) {
        await setStaticMetadata(
          sdk,
          assetPubkey,
          "pump_fun_currency",
          pumpProfile.currencyMint,
          syncState,
          "pumpCurrencyMetadataError",
        );
      }
    }

    if (envBool("AGENT_REGISTRY_WRITE_HEARTBEAT", false)) {
      const heartbeatKey = env("AGENT_REGISTRY_HEARTBEAT_KEY", "last_seen");
      try {
        await sdk.setMetadata(
          assetPubkey,
          heartbeatKey,
          new Date().toISOString(),
        );
        syncState.heartbeatMetadata = heartbeatKey;
      } catch (error) {
        syncState.heartbeatMetadataError =
          error instanceof Error ? error.message : String(error);
      }
    }
  }

  try {
    const hubSync = await syncToHub(syncState);
    if (hubSync && !hubSync.skipped) {
      syncState.hubSync = hubSync;
    } else if (hubSync?.reason) {
      syncState.hubSyncSkipped = hubSync.reason;
    }
  } catch (error) {
    syncState.hubSyncError = error instanceof Error ? error.message : String(error);
  }

  await writeState(syncState);
  console.log(JSON.stringify(syncState));
}

main().catch(async (error) => {
  const payload = {
    status: "error",
    syncedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
  };
  try {
    await writeState(payload);
  } catch {}
  console.error(JSON.stringify(payload));
  process.exitCode = 1;
});
