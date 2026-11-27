// SolanaOS Agent Wallet — Deployable Service Entry Point
//
// Starts the agentic wallet HTTP API server with:
//   - Encrypted vault for Solana + EVM keypairs
//   - Privy managed wallet integration (optional)
//   - E2B sandbox deployment for remote agent access
//   - MCP server compatibility for AI agent tooling
//
// Usage:
//
//	go run ./services/agent-wallet/cmd
//	go run ./services/agent-wallet/cmd migrate-kdf   # opt-in: re-encrypt legacy
//	                                                 # SHA-256-KDF files with argon2id
//
// Environment:
//
//	WALLET_API_PORT     — HTTP port (default: 8421)
//	WALLET_API_KEY      — Bearer token for auth (optional)
//	VAULT_PASSPHRASE    — Master encryption key for vault
//	SOLANA_RPC_URL      — Solana RPC endpoint
//	EVM_CHAINS          — Comma-separated chainID:rpcURL pairs
//	BASE_RPC_URL        — Base chain RPC (shortcut)
//	ETH_RPC_URL         — Ethereum RPC (shortcut)
//	E2B_API_KEY         — E2B sandbox API key
//	PRIVY_APP_ID        — Privy app ID
//	PRIVY_APP_SECRET    — Privy app secret
package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/x402agent/Solana-Os-Go/pkg/config"
	agentwallet "github.com/x402agent/Solana-Os-Go/services/agent-wallet"
)

func main() {
	log.SetFlags(log.Ltime | log.Lshortfile)

	// Load .env files (same as main SolanaOS binary)
	config.BootstrapEnv()

	if len(os.Args) > 1 && os.Args[1] == "migrate-kdf" {
		os.Exit(runMigrateKDF())
	}

	log.Println("┌─────────────────────────────────────────────────────┐")
	log.Println("│  SolanaOS Agent Wallet · Deployable Vault Service │")
	log.Println("│  Solana + EVM · E2B Sandboxes · Privy Integration   │")
	log.Println("└─────────────────────────────────────────────────────┘")

	cfg := agentwallet.DefaultServerConfig()

	srv, err := agentwallet.NewServer(cfg)
	if err != nil {
		log.Fatalf("[FATAL] Failed to create server: %v", err)
	}

	// Graceful shutdown
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		if err := srv.Start(); err != nil {
			log.Printf("[WALLET-API] Server stopped: %v", err)
		}
	}()

	<-sigCh
	log.Println("[WALLET-API] Shutting down...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	srv.Stop(ctx)
}

// runMigrateKDF is the explicit, opt-in path that re-encrypts legacy
// (SHA-256 KDF) vault and local-signer files with argon2id. It uses the same
// passphrase environment as the service and keeps an encrypted .bak copy of
// every file it rewrites. Stop the wallet service before running it.
func runMigrateKDF() int {
	failed := false
	report := func(name string, migrated bool, backup string, err error) {
		switch {
		case err != nil:
			failed = true
			log.Printf("[MIGRATE-KDF] ❌ %s: %v", name, err)
		case migrated:
			log.Printf("[MIGRATE-KDF] ✅ %s re-encrypted with argon2id (legacy backup: %s)", name, backup)
		default:
			log.Printf("[MIGRATE-KDF] – %s: nothing to migrate", name)
		}
	}
	m, b, err := agentwallet.MigrateVaultKDF(agentwallet.DefaultVaultConfig())
	report("vault", m, b, err)
	dev, trade := agentwallet.DefaultLocalSignerConfigs()
	m, b, err = agentwallet.MigrateLocalSignerKDF(dev)
	report("dev signer", m, b, err)
	m, b, err = agentwallet.MigrateLocalSignerKDF(trade)
	report("trade signer", m, b, err)
	if failed {
		return 1
	}
	return 0
}
