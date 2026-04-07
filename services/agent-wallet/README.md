# Agent Wallet Service

AES-256-GCM encrypted agentic wallet vault for Solana + EVM. Manages local signing keys for development and trading, exposes an HTTP API for agents, and deploys into E2B sandboxes (or local process sandboxes) for isolated execution.

## Architecture

```
services/agent-wallet/
├── vault.go          — Encrypted multi-wallet vault (Solana + EVM)
├── local_signer.go   — AES-256 local dev + trade signing keys
├── local_sandbox.go  — Local process sandbox (E2B fallback, no API key needed)
├── api.go            — HTTP API server (vault + local signers + sandboxes)
├── deployer.go       — E2B cloud sandbox deployer
├── evm.go            — EVM chain support (Ethereum, Base, Arbitrum, ...)
├── privy.go          — Privy managed wallet integration (optional)
└── cmd/main.go       — Binary entry point
```

## Local Signers

Two dedicated AES-256-GCM encrypted keypairs — `dev` (devnet / testing) and `trade` (mainnet) — loaded automatically at startup.

### Key lifecycle

1. Check `LOCAL_SIGNER_DEV_KEY` / `LOCAL_SIGNER_TRADE_KEY` env vars (base58 private key)
2. Load from disk at `~/.nanosolana/signers/{dev,trade}.enc`
3. Generate a fresh keypair and persist it

Keys are encrypted with AES-256-GCM. The master key is derived from `VAULT_PASSPHRASE` (or `TRADE_SIGNER_PASSPHRASE` for the trade key) via SHA-256. The envelope format stored on disk:

```json
{
  "data":  "<hex AES-256-GCM ciphertext>",
  "nonce": "<hex GCM nonce>"
}
```

### API endpoints

```
GET  /v1/local-signers              → list dev + trade pubkeys
GET  /v1/local-signers/{mode}       → get pubkey for mode (dev|trade)
POST /v1/local-signers/{mode}/sign  → sign arbitrary message
POST /v1/local-signers/{mode}/sign-tx → build + sign + broadcast SOL transfer
```

**Sign a message (dev key):**
```bash
curl -X POST http://localhost:8421/v1/local-signers/dev/sign \
  -H "Content-Type: application/json" \
  -d '{"message": "hello solana"}'
# → {"signature":"...","pubkey":"...","mode":"dev"}
```

**Send a SOL transfer (trade key):**
```bash
curl -X POST http://localhost:8421/v1/local-signers/trade/sign-tx \
  -H "Authorization: Bearer $WALLET_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"to":"<pubkey>","amount":"0.001"}'
# → {"signature":"...","from":"...","to":"...","amount":"0.001","mode":"trade"}
```

## Vault Wallets

The vault manages any number of named wallets (Solana + EVM), each with a separately encrypted private key. These are distinct from the local signers — they are created on demand and identified by a generated ID.

```
POST   /v1/wallets                    → create wallet
GET    /v1/wallets                    → list all wallets
GET    /v1/wallets/{id}               → get wallet
DELETE /v1/wallets/{id}               → delete wallet
GET    /v1/wallets/{id}/balance       → check balance
POST   /v1/wallets/{id}/transfer      → send SOL/ETH
POST   /v1/wallets/{id}/sign          → sign message
POST   /v1/wallets/{id}/pause         → freeze wallet
POST   /v1/wallets/{id}/unpause       → unfreeze wallet
POST   /v1/wallets/{id}/transfer-token → send ERC-20/SPL
POST   /v1/eth-call                   → raw EVM call
GET    /v1/chains                     → list supported chains
```

## Sandboxes

Deploy the wallet API into an isolated environment for remote or ephemeral agent access. Two modes:

| Mode | Requires | URL pattern |
|------|----------|-------------|
| **Local process** | Nothing (auto fallback) | `http://localhost:{port}` |
| **E2B cloud** | `E2B_API_KEY` | `https://{sandbox-id}-{port}.e2b.dev` |

```
POST   /v1/deploy                  → start sandbox (E2B or local)
GET    /v1/deployments             → list running sandboxes
DELETE /v1/deployments/{agent_id}  → teardown sandbox
```

**Start a local sandbox:**
```bash
curl -X POST http://localhost:8421/v1/deploy \
  -H "Content-Type: application/json" \
  -d '{"agent_id":"my-agent"}'
# → {"api_url":"http://localhost:8430","status":"running",...}
```

## Running

### Standalone binary

```bash
# Build
go build -o build/agent-wallet ./services/agent-wallet/cmd

# Run (generates dev + trade keys on first start)
VAULT_PASSPHRASE=my-secret \
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com \
./build/agent-wallet
```

### Via Makefile

```bash
make build-agent-wallet   # build only
make start-agent-wallet   # start in background
make stop-agent-wallet    # stop
```

### Via main SolanaOS binary

The agent wallet is embedded into the main `solanaos` binary and started automatically. It runs on port `8421` by default alongside the daemon.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `WALLET_API_PORT` | `8421` | HTTP listen port |
| `WALLET_API_KEY` | _(none)_ | Bearer token for API auth |
| `VAULT_PASSPHRASE` | `nanosolana-agent-vault-default` | Master AES key passphrase |
| `TRADE_SIGNER_PASSPHRASE` | _(uses VAULT_PASSPHRASE)_ | Separate passphrase for trade key |
| `LOCAL_SIGNER_DEV_KEY` | _(generated)_ | Seed dev signer with base58 private key |
| `LOCAL_SIGNER_TRADE_KEY` | _(generated)_ | Seed trade signer with base58 private key |
| `LOCAL_SIGNER_PATH` | `~/.nanosolana/signers` | Directory for `.enc` key files |
| `SOLANA_RPC_URL` | Solana mainnet | Solana RPC endpoint |
| `E2B_API_KEY` | _(none)_ | E2B API key for cloud sandboxes |
| `LOCAL_SANDBOX_BASE_PORT` | `8430` | Base port for local sandbox processes |
| `EVM_CHAINS` | _(none)_ | `chainID:rpcURL,...` pairs |
| `BASE_RPC_URL` | _(none)_ | Base chain RPC shortcut |
| `ETH_RPC_URL` | _(none)_ | Ethereum RPC shortcut |
| `PRIVY_APP_ID` | _(none)_ | Privy app ID for managed wallets |
| `PRIVY_APP_SECRET` | _(none)_ | Privy app secret |

## Security Notes

- Private keys are **never** returned by the API — only public keys and signatures
- All keys are AES-256-GCM encrypted at rest; the vault file itself is also encrypted
- Paused wallets refuse signing and transfer requests
- Set `WALLET_API_KEY` to require Bearer auth on all non-health endpoints
- Key files are stored with `0o600` permissions; the signer directory with `0o700`
