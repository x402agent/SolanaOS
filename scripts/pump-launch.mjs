#!/usr/bin/env node

import crypto from "node:crypto";
import { createRequire } from "node:module";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { Connection, Keypair, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import BN from "bn.js";
import bs58 from "bs58";
import { IPFSClient } from "8004-solana";

const require = createRequire(import.meta.url);

async function loadPumpSdk() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(scriptDir, "node_modules", "@nirholas", "pump-sdk", "dist", "index.js"),
    path.join(scriptDir, "node_modules", "@nirholas", "pump-sdk", "index.js"),
  ];
  const resolved = new Set();
  const errors = [];

  for (const specifier of [
    "@nirholas/pump-sdk/dist/index.js",
    "@nirholas/pump-sdk",
  ]) {
    try {
      const absolute = require.resolve(specifier);
      if (!resolved.has(absolute)) {
        candidates.unshift(absolute);
        resolved.add(absolute);
      }
    } catch (err) {
      errors.push(`${specifier}: ${err?.message || String(err)}`);
    }
  }

  const normalize = (mod, loader) => {
    const source = mod?.default ?? mod;
    if (
      source?.OnlinePumpSdk &&
      source?.PUMP_SDK &&
      source?.getBuyTokenAmountFromSolAmount
    ) {
      return {
        OnlinePumpSdk: source.OnlinePumpSdk,
        PUMP_SDK: source.PUMP_SDK,
        getBuyTokenAmountFromSolAmount: source.getBuyTokenAmountFromSolAmount,
        loader,
      };
    }
    return null;
  };

  for (const candidate of candidates) {
    try {
      const mod = require(candidate);
      const normalized = normalize(mod, `require:${candidate}`);
      if (normalized) return normalized;
      errors.push(`${candidate}: missing expected exports via require`);
    } catch (err) {
      errors.push(`${candidate}: ${err?.message || String(err)}`);
    }

    try {
      const mod = await import(pathToFileURL(candidate).href);
      const normalized = normalize(mod, `import:${candidate}`);
      if (normalized) return normalized;
      errors.push(`${candidate}: missing expected exports via import`);
    } catch (err) {
      errors.push(`${candidate}: ${err?.message || String(err)}`);
    }
  }

  throw new Error(`Unable to load @nirholas/pump-sdk: ${errors.join(" | ")}`);
}

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

function envFloat(name, fallback = 0) {
  const raw = env(name, "");
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function pinataAuth(prefix) {
  return {
    jwt:
      env(`${prefix}_PINATA_JWT`) ||
      env("AGENT_REGISTRY_PINATA_JWT") ||
      env("PINATA_JWT_SECRET"),
    apiKey:
      env(`${prefix}_PINATA_API_KEY`) ||
      env("AGENT_REGISTRY_PINATA_API_KEY") ||
      env("PINATA_API_KEY"),
    apiSecret:
      env(`${prefix}_PINATA_API_SECRET`) ||
      env("AGENT_REGISTRY_PINATA_API_SECRET") ||
      env("PINATA_API_SECRET"),
  };
}

async function pinJsonToPinata(metadata, auth, filename) {
  const payload = JSON.stringify(metadata);
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

async function loadSigner() {
  const rawBase58 = env("SOLANA_PRIVATE_KEY_BASE58");
  if (rawBase58) {
    return Keypair.fromSecretKey(Uint8Array.from(bs58.decode(rawBase58)));
  }

  const rawPrivateKey = env("SOLANA_PRIVATE_KEY");
  if (rawPrivateKey) {
    if (rawPrivateKey.startsWith("[")) {
      const parsed = JSON.parse(rawPrivateKey);
      const bytes = Uint8Array.from(parsed);
      if (bytes.length === 64) {
        return Keypair.fromSecretKey(bytes);
      }
      if (bytes.length === 32) {
        return Keypair.fromSeed(bytes);
      }
      throw new Error(`unsupported secret key length ${bytes.length}`);
    }

    const bytes = Uint8Array.from(bs58.decode(rawPrivateKey));
    if (bytes.length === 64) {
      return Keypair.fromSecretKey(bytes);
    }
    if (bytes.length === 32) {
      return Keypair.fromSeed(bytes);
    }
    throw new Error(`unsupported base58 secret key length ${bytes.length}`);
  }

  const keyPath = env("SOLANA_PRIVATE_KEY_PATH");
  if (keyPath) {
    const raw = await fs.readFile(keyPath, "utf8");
    const parsed = JSON.parse(raw);
    const bytes = Uint8Array.from(parsed);
    if (bytes.length === 64) {
      return Keypair.fromSecretKey(bytes);
    }
    if (bytes.length === 32) {
      return Keypair.fromSeed(bytes);
    }
    throw new Error(`unsupported key file secret key length ${bytes.length}`);
  }

  throw new Error("SOLANA_PRIVATE_KEY_BASE58, SOLANA_PRIVATE_KEY, or SOLANA_PRIVATE_KEY_PATH is required for pump launch");
}

function statePath() {
  return (
    env("PUMP_LAUNCH_STATE_PATH") ||
    path.join(os.homedir(), ".nanosolana", "pump", "pump-launch.json")
  );
}

async function readState() {
  try {
    const raw = await fs.readFile(statePath(), "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeState(payload) {
  const file = statePath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function buildProfile() {
  return {
    mode: env("PUMP_LAUNCH_MODE", "once_only"),
    cluster: env("PUMP_LAUNCH_CLUSTER", "mainnet-beta"),
    rpcUrl: env("PUMP_LAUNCH_RPC_URL") || env("HELIUS_RPC_URL") || env("SOLANA_RPC_URL"),
    metadataUri: env("PUMP_LAUNCH_METADATA_URI"),
    pinata: pinataAuth("PUMP_LAUNCH"),
    name: env("PUMP_LAUNCH_NAME", "SolanaOS"),
    symbol: env("PUMP_LAUNCH_SYMBOL", "NANO"),
    description: env(
      "PUMP_LAUNCH_DESCRIPTION",
      "SolanaOS autonomous Solana trading agent token.",
    ),
    image: env("PUMP_LAUNCH_IMAGE"),
    website: env("PUMP_LAUNCH_WEBSITE"),
    xUrl: env("PUMP_LAUNCH_X_URL"),
    telegramUrl: env("PUMP_LAUNCH_TELEGRAM_URL"),
    initialBuySol: envFloat("PUMP_LAUNCH_INITIAL_BUY_SOL", 0),
    slippagePct: envFloat("PUMP_LAUNCH_SLIPPAGE_PCT", 2),
    mayhemMode: envBool("PUMP_LAUNCH_MAYHEM_MODE", false),
    cashback: envBool("PUMP_LAUNCH_CASHBACK", false),
  };
}

function profileId(profile) {
  return crypto.createHash("sha256").update(JSON.stringify(profile)).digest("hex").slice(0, 16);
}

async function resolveMetadataUri(profile) {
  if (profile.metadataUri) return profile.metadataUri;
  if (!profile.pinata?.jwt && !(profile.pinata?.apiKey && profile.pinata?.apiSecret)) {
    return "";
  }

  const metadata = {
    name: profile.name,
    symbol: profile.symbol,
    description: profile.description,
    image: profile.image,
    external_url: profile.website,
    extensions: {
      website: profile.website,
      twitter: profile.xUrl,
      telegram: profile.telegramUrl,
    },
  };

  const cid = await pinJsonToPinata(metadata, profile.pinata, `${profile.symbol || "token"}-metadata.json`);
  return `ipfs://${cid}`;
}

async function main() {
  const { OnlinePumpSdk, PUMP_SDK, getBuyTokenAmountFromSolAmount, loader } = await loadPumpSdk();
  const signer = await loadSigner();
  const profile = buildProfile();
  const id = profileId(profile);
  const existing = await readState();
  const preserveExisting = (overrides) =>
    existing?.status === "ok" && existing?.mint ? { ...existing, ...overrides } : overrides;

  console.log(JSON.stringify({
    status: "info",
    action: "sdk_loader",
    loader,
  }));

  if (env("PUMP_LAUNCH_CONFIRM") !== "launch") {
    const payload = preserveExisting({
      status: "ok",
      action: "noop",
      reason: "missing PUMP_LAUNCH_CONFIRM=launch",
      profileId: id,
    });
    await writeState(payload);
    console.log(JSON.stringify(payload));
    return;
  }

  if (profile.mode === "once_only" && existing?.status === "ok" && existing?.mint) {
    await writeState({
      ...existing,
      action: "noop",
      reason: "launch already completed in once_only mode",
    });
    console.log(JSON.stringify({
      status: "ok",
      action: "noop",
      reason: "launch already completed in once_only mode",
      mint: existing.mint,
      profileId: existing.profileId || id,
    }));
    return;
  }

  if (!profile.rpcUrl) {
    const payload = preserveExisting({
      status: "ok",
      action: "noop",
      reason: "missing PUMP_LAUNCH_RPC_URL / HELIUS_RPC_URL",
      profileId: id,
    });
    await writeState(payload);
    console.log(JSON.stringify(payload));
    return;
  }

  const uri = await resolveMetadataUri(profile);
  if (!uri) {
    const payload = preserveExisting({
      status: "ok",
      action: "noop",
      reason: "missing PUMP_LAUNCH_METADATA_URI or Pinata credentials",
      profileId: id,
    });
    await writeState(payload);
    console.log(JSON.stringify(payload));
    return;
  }

  const connection = new Connection(profile.rpcUrl, "confirmed");
  const sdk = new OnlinePumpSdk(connection);
  const mint = Keypair.generate();

  let instructions;
  let initialBuyTx = "";
  if (profile.initialBuySol > 0) {
    const global = await sdk.fetchGlobal();
    const feeConfig = await sdk.fetchFeeConfig();
    const solAmount = new BN(Math.round(profile.initialBuySol * 1e9));
    const amount = getBuyTokenAmountFromSolAmount({
      global,
      feeConfig,
      mintSupply: null,
      bondingCurve: null,
      amount: solAmount,
    });

    instructions = await PUMP_SDK.createV2AndBuyInstructions({
      global,
      mint: mint.publicKey,
      name: profile.name,
      symbol: profile.symbol,
      uri,
      creator: signer.publicKey,
      user: signer.publicKey,
      amount,
      solAmount,
      mayhemMode: profile.mayhemMode,
      cashback: profile.cashback,
    });
    initialBuyTx = "included";
  } else {
    const instruction = await PUMP_SDK.createV2Instruction({
      mint: mint.publicKey,
      name: profile.name,
      symbol: profile.symbol,
      uri,
      creator: signer.publicKey,
      user: signer.publicKey,
      mayhemMode: profile.mayhemMode,
      cashback: profile.cashback,
    });
    instructions = [instruction];
  }

  const tx = new Transaction().add(...instructions);
  const signature = await sendAndConfirmTransaction(connection, tx, [signer, mint], {
    commitment: "confirmed",
  });

  const payload = {
    status: "ok",
    action: "launched",
    mode: profile.mode,
    cluster: profile.cluster,
    profileId: id,
    name: profile.name,
    symbol: profile.symbol,
    mint: mint.publicKey.toBase58(),
    tokenUri: uri,
    signature,
    initialBuySol: profile.initialBuySol ? String(profile.initialBuySol) : "",
    initialBuyTx,
    launchedAt: new Date().toISOString(),
  };
  await writeState(payload);
  console.log(JSON.stringify(payload));
}

main().catch(async (error) => {
  const payload = {
    status: "error",
    error: error instanceof Error ? error.message : String(error),
    launchedAt: new Date().toISOString(),
  };
  try {
    await writeState(payload);
  } catch {}
  console.error(JSON.stringify(payload));
  process.exitCode = 1;
});
