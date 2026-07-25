---
name: utilia-solana-transaction-diagnosis
description: Diagnose a confirmed or failed Solana transaction signature with Utilia's $0.004 x402 service. Use when a SolanaOS operator needs landed state, balance deltas, program logs, compute use, a stable failure class, or the next retry-safe action without configuring another RPC or API key.
version: 1.0.0
author: Utilia
url: https://utilia.ink/solana-transaction-support
tags: [solana, transaction, diagnosis, x402, support]
metadata:
  solanaos:
    emoji: "🧾"
    requires:
      bins: [npx]
---

# Utilia Solana Transaction Diagnosis

Turn one public Solana mainnet signature into a support-ready evidence packet.
Use this optional provider when the operator has no raw `getTransaction` JSON,
configured RPC, or project logs. Prefer existing local evidence when it is
already available.

## Validate The Request

Require one Base58 Solana signature between 64 and 88 characters. A transaction
signature is public on-chain data, not a wallet secret. Never request or transmit
a seed phrase, private key, wallet session, or auth token.

Replace `YOUR_SIGNATURE` in the commands below:

```sh
https://api.utilia.ink/base/v1/transaction/YOUR_SIGNATURE
```

## Check The Quote For Free

Quote inspection does not settle a payment:

```sh
npx -y agentcash@latest check \
  "https://api.utilia.ink/base/v1/transaction/YOUR_SIGNATURE"
```

Proceed only when the quote identifies the exact Utilia URL, Base network, USDC
asset, x402 protocol, and an exact price of `0.004000 USD`. Stop and report any
different route, purpose, network, asset, or price.

## Confirm Before Paying

Before the paid request, tell the operator that the next command spends exactly
`$0.004 USDC` through AgentCash on Base. Obtain action-time confirmation for
that exact signature and purchase. General approval or approval for a different
transaction is not enough. Never make an operator-funded call to fabricate
customer demand.

## Fetch After Confirmation

Only after the exact purchase is approved:

```sh
npx -y agentcash@latest fetch \
  "https://api.utilia.ink/base/v1/transaction/YOUR_SIGNATURE" --yes
```

AgentCash manages its own wallet, signs the x402 payment locally, retries the
request, and returns the response. Utilia never receives the payer's private
key. If the wallet is unfunded, report the funding account shown by:

```sh
npx -y agentcash@latest balance
```

Do not search for other credentials or silently change wallets.

## Explain The Evidence

Return a compact diagnosis containing:

- whether the signature landed and whether execution succeeded;
- slot, block time, fee, compute units, and confirmation state when available;
- meaningful SOL and token balance changes;
- the relevant program-log failure, without dumping unrelated logs;
- Utilia's failure category and suggested next action;
- the settled price and payment receipt reported by AgentCash.

Separate observed evidence from inference. Cross-check surprising results against
an independent RPC or explorer when available. Do not claim that a retry or
simulation guarantees future execution because state, balances, and market
conditions can change.
