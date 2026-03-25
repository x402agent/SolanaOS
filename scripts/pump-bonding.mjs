#!/usr/bin/env node
/**
 * pump-bonding.mjs — On-chain BondingCurve enrichment via @nirholas/pump-sdk + Helius RPC
 *
 * Reads a JSON array of token objects from stdin.
 * For each token where bonding_pct is null (and not graduated), calls:
 *   OnlinePumpSdk.fetchBondingCurveSummary(mint)   → isGraduated, marketCap
 *   getGraduationProgress(bondingCurve, global)      → progressBps, solAccumulated
 *
 * Writes enriched JSON array to stdout.
 * All logs go to stderr.
 *
 * Env: HELIUS_RPC_URL (or SOLANA_TRACKER_RPC_URL as fallback)
 *
 * Analytics available via @nirholas/pump-sdk (from nanosolana):
 *   fetchBondingCurveSummary  → marketCap, isGraduated, tokensRemaining
 *   getGraduationProgress     → progressBps, solAccumulated, tokensRemaining
 *   calculateBuyPriceImpact   → priceImpactBps, effectivePrice
 *   getTokenPrice             → buyPricePerToken, sellPricePerToken
 *   computeFeesBps            → protocolFeeBps, creatorFeeBps
 */

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import process from "node:process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// ── Load @nirholas/pump-sdk (same resolution logic as pump-launch.mjs) ────────
async function loadPumpSdk() {
  const candidates = [
    path.join(__dirname, "node_modules", "@nirholas", "pump-sdk", "dist", "index.js"),
    path.join(__dirname, "node_modules", "@nirholas", "pump-sdk", "index.js"),
  ];

  for (const specifier of ["@nirholas/pump-sdk/dist/index.js", "@nirholas/pump-sdk"]) {
    try {
      const resolved = require.resolve(specifier);
      if (!candidates.includes(resolved)) candidates.unshift(resolved);
    } catch { /* ignore */ }
  }

  for (const candidate of candidates) {
    for (const loader of ["require", "import"]) {
      try {
        const mod = loader === "require"
          ? require(candidate)
          : await import(new URL(`file://${candidate}`).href);
        const src = mod?.default ?? mod;
        if (src?.OnlinePumpSdk) {
          process.stderr.write(`[pump-bonding] SDK loaded via ${loader}:${candidate}\n`);
          return src;
        }
      } catch { /* try next */ }
    }
  }
  throw new Error("@nirholas/pump-sdk not found in scripts/node_modules");
}

// ── Load @solana/web3.js Connection ───────────────────────────────────────────
async function loadConnection() {
  try {
    const web3 = require("@solana/web3.js");
    return web3.Connection;
  } catch {
    const mod = await import("@solana/web3.js");
    return (mod.default ?? mod).Connection;
  }
}

// ── Read all stdin ────────────────────────────────────────────────────────────
function readStdin() {
  return new Promise((resolve) => {
    const chunks = [];
    process.stdin.on("data", (d) => chunks.push(d));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    process.stdin.on("error", () => resolve("[]"));
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const rpcUrl =
    process.env.HELIUS_RPC_URL ||
    process.env.SOLANA_TRACKER_RPC_URL ||
    "";

  if (!rpcUrl) {
    process.stderr.write("[pump-bonding] No RPC URL — pass-through unchanged\n");
    process.stdout.write(await readStdin());
    return;
  }

  // Parse input
  const raw = await readStdin();
  let tokens;
  try {
    tokens = JSON.parse(raw);
    if (!Array.isArray(tokens)) throw new Error("Expected JSON array");
  } catch (e) {
    process.stderr.write(`[pump-bonding] JSON parse error: ${e.message}\n`);
    process.stdout.write(raw);
    return;
  }

  // Load SDK
  let sdk, Connection;
  try {
    [sdk, Connection] = await Promise.all([loadPumpSdk(), loadConnection()]);
  } catch (e) {
    process.stderr.write(`[pump-bonding] SDK load failed: ${e.message}\n`);
    process.stdout.write(JSON.stringify(tokens));
    return;
  }

  const {
    OnlinePumpSdk,
    getGraduationProgress,
    calculateBuyPriceImpact,
    getTokenPrice,
  } = sdk;

  const connection = new Connection(rpcUrl, "confirmed");
  const pumpSdk = new OnlinePumpSdk(connection);

  // Fetch global config + fee config once (needed for analytics)
  let global_, feeConfig;
  try {
    [global_, feeConfig] = await Promise.all([
      pumpSdk.fetchGlobal(),
      pumpSdk.fetchFeeConfig(),
    ]);
    process.stderr.write("[pump-bonding] Global config fetched\n");
  } catch (e) {
    process.stderr.write(`[pump-bonding] Global config failed: ${e.message} — skipping enrichment\n`);
    process.stdout.write(JSON.stringify(tokens));
    return;
  }

  // Only enrich tokens that are missing bonding_pct and not graduated
  const toEnrich = tokens
    .filter((t) => t.bonding_pct == null && !t.graduated)
    .slice(0, 40); // cap at 40 on-chain calls per scan

  process.stderr.write(`[pump-bonding] Enriching ${toEnrich.length} tokens via Helius RPC...\n`);

  let enriched = 0;
  const BATCH = 4; // concurrent RPC calls per batch

  for (let i = 0; i < toEnrich.length; i += BATCH) {
    const batch = toEnrich.slice(i, i + BATCH);

    await Promise.allSettled(
      batch.map(async (tok) => {
        try {
          // Primary: fetchBondingCurveSummary (high-level wrapper)
          const summary = await pumpSdk.fetchBondingCurveSummary(tok.mint);
          if (!summary) return;

          tok.graduated = Boolean(summary.isGraduated);

          if (summary.isGraduated) {
            tok.bonding_pct = 100;
          } else {
            // Detailed graduation progress
            try {
              const bondingCurve = await pumpSdk.fetchBondingCurve(tok.mint);
              const progress = getGraduationProgress(bondingCurve, global_);
              tok.bonding_pct = Number(progress.progressBps) / 100;
              tok.sol_accumulated = progress.solAccumulated?.toString();
              tok.tokens_remaining = progress.tokensRemaining?.toString();

              // Token price from bonding curve
              if (getTokenPrice) {
                try {
                  const price = getTokenPrice(bondingCurve, global_, feeConfig);
                  tok.buy_price_lamports  = price.buyPricePerToken?.toString();
                  tok.sell_price_lamports = price.sellPricePerToken?.toString();
                } catch { /* price calc optional */ }
              }
            } catch (e2) {
              // Fall back to summary data only
              process.stderr.write(`[pump-bonding] progress calc ${tok.mint.slice(0, 8)}: ${e2.message}\n`);
            }
          }

          // Market cap from on-chain if missing
          if (!tok.fdv && summary.marketCap) {
            // marketCap is in lamports (SOL-denominated) — flag for later USD conversion
            tok.mc_lamports = summary.marketCap.toString();
          }

          enriched++;
          process.stderr.write(
            `[pump-bonding] ${tok.mint.slice(0, 8)}... bonding=${tok.bonding_pct?.toFixed(1)}%` +
              ` graduated=${tok.graduated}\n`
          );
        } catch (e) {
          process.stderr.write(`[pump-bonding] ${tok.mint.slice(0, 8)}...: ${e.message}\n`);
        }
      })
    );

    if (i + BATCH < toEnrich.length) {
      await sleep(400); // ~10 calls/s — within Helius free tier
    }
  }

  process.stderr.write(`[pump-bonding] Complete: ${enriched}/${toEnrich.length} enriched\n`);
  process.stdout.write(JSON.stringify(tokens));
}

main().catch((e) => {
  process.stderr.write(`[pump-bonding] Fatal: ${e.message}\n`);
  process.exit(0); // never block the pipeline
});
