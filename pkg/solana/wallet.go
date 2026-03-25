// Package solana — NanoSolana wallet management.
// Wraps gagliardetto/solana-go keypair and wallet primitives
// for signing transactions, managing keys, and deriving PDAs.
//
// On first heartbeat, EnsureAgentWallet auto-generates a Solana keypair
// and persists it in standard Solana keygen JSON format at
// ~/.nanosolana/wallet/agent-wallet.json.
package solana

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sync"

	solanago "github.com/gagliardetto/solana-go"
)

var (
	agentWalletOnce sync.Once
	agentWallet     *Wallet
)

// ── NanoSolana Wallet wrapper ─────────────────────────────────────────
// Adapts gagliardetto/solana-go wallet types for the trading agent.

// Wallet holds the private key and provides signing operations.
type Wallet struct {
	inner     *solanago.Wallet
	PublicKey solanago.PublicKey
	keyPath   string // path used to load, if any
}

// NewRandomWallet generates a brand-new random wallet.
func NewRandomWallet() *Wallet {
	w := solanago.NewWallet()
	return &Wallet{
		inner:     w,
		PublicKey: w.PublicKey(),
	}
}

// WalletFromPrivateKeyBase58 creates a wallet from a base58-encoded
// private key (the 64-byte Solana keypair format).
func WalletFromPrivateKeyBase58(b58 string) (*Wallet, error) {
	w, err := solanago.WalletFromPrivateKeyBase58(b58)
	if err != nil {
		return nil, fmt.Errorf("wallet from base58: %w", err)
	}
	return &Wallet{
		inner:     w,
		PublicKey: w.PublicKey(),
	}, nil
}

// WalletFromKeygenFile loads a wallet from a Solana CLI keygen JSON file
// (e.g. ~/.config/solana/id.json or a path set via config).
func WalletFromKeygenFile(path string) (*Wallet, error) {
	pk, err := solanago.PrivateKeyFromSolanaKeygenFile(path)
	if err != nil {
		return nil, fmt.Errorf("load keygen file %s: %w", path, err)
	}
	return &Wallet{
		inner: &solanago.Wallet{
			PrivateKey: pk,
		},
		PublicKey: pk.PublicKey(),
		keyPath:   path,
	}, nil
}

// WalletFromEnvOrFile attempts to load a wallet from the
// SOLANA_PRIVATE_KEY env var (base58), falling back to the
// provided file path (Solana keygen JSON).
// Returns nil (no wallet, read-only) if neither is set.
func WalletFromEnvOrFile(keyPath string) (*Wallet, error) {
	// 1. Try env var (base58 private key)
	if envKey := os.Getenv("SOLANA_PRIVATE_KEY"); envKey != "" {
		return WalletFromPrivateKeyBase58(envKey)
	}

	// 2. Try keygen file
	if keyPath != "" {
		if _, err := os.Stat(keyPath); err == nil {
			return WalletFromKeygenFile(keyPath)
		}
	}

	// 3. Try default Solana CLI path
	home, _ := os.UserHomeDir()
	defaultPath := home + "/.config/solana/id.json"
	if _, err := os.Stat(defaultPath); err == nil {
		return WalletFromKeygenFile(defaultPath)
	}

	// No wallet available — read-only mode
	return nil, nil
}

// PublicKeyStr returns the base58 pubkey string.
func (w *Wallet) PublicKeyStr() string {
	return w.PublicKey.String()
}

// ShortKey returns a shortened pubkey for display (e.g. "7xKX...3vBp").
func (w *Wallet) ShortKey(n int) string {
	return w.PublicKey.Short(n)
}

// Sign signs a payload with this wallet's private key.
func (w *Wallet) Sign(payload []byte) (solanago.Signature, error) {
	return w.inner.PrivateKey.Sign(payload)
}

// PrivateKeyGetter returns a function compatible with
// solana-go's Transaction.Sign() callback.
func (w *Wallet) PrivateKeyGetter() func(solanago.PublicKey) *solanago.PrivateKey {
	return func(key solanago.PublicKey) *solanago.PrivateKey {
		if key.Equals(w.PublicKey) {
			pk := w.inner.PrivateKey
			return &pk
		}
		return nil
	}
}

// IsReadOnly returns true if no private key is loaded.
func (w *Wallet) IsReadOnly() bool {
	return w == nil || w.inner == nil
}

// PrivateKeyBase58 returns the private key as a base58-encoded string.
// Returns empty string if no private key is loaded (read-only wallet).
func (w *Wallet) PrivateKeyBase58() string {
	if w == nil || w.inner == nil {
		return ""
	}
	return w.inner.PrivateKey.String()
}

// GetPrivateKey returns the raw solana-go PrivateKey for signing.
// Returns a zero-value key if the wallet is read-only.
func (w *Wallet) GetPrivateKey() solanago.PrivateKey {
	if w == nil || w.inner == nil {
		return solanago.PrivateKey{}
	}
	return w.inner.PrivateKey
}

// ── Public-Key Helpers ──────────────────────────────────────────────
// Re-exports from solana-go for convenience, so callers don't need
// to import solana-go directly.

type PublicKey = solanago.PublicKey
type Signature = solanago.Signature

// MustPublicKeyFromBase58 parses a base58 pubkey string, panicking on error.
func MustPublicKeyFromBase58(in string) PublicKey {
	return solanago.MustPublicKeyFromBase58(in)
}

// PublicKeyFromBase58 parses a base58 pubkey string.
func PublicKeyFromBase58(in string) (PublicKey, error) {
	return solanago.PublicKeyFromBase58(in)
}

// FindProgramAddress derives a PDA for the given seeds + programID.
func FindProgramAddress(seeds [][]byte, programID PublicKey) (PublicKey, uint8, error) {
	return solanago.FindProgramAddress(seeds, programID)
}

// FindAssociatedTokenAddress derives the ATA for a wallet + mint.
func FindAssociatedTokenAddress(wallet, mint PublicKey) (PublicKey, uint8, error) {
	return solanago.FindAssociatedTokenAddress(wallet, mint)
}

// ── Agentic Wallet Auto-Generation ──────────────────────────────────
// On first heartbeat the agent auto-generates a Solana keypair and
// persists it in standard keygen JSON format (same as `solana-keygen`).
// Subsequent boots re-load the same wallet.

const (
	defaultWalletDir  = "wallet"
	defaultWalletFile = "agent-wallet.json"
)

// EnsureAgentWallet loads or generates the MawdBot agent wallet.
// Called on first heartbeat. Thread-safe via sync.Once.
//   - If walletKeyPath is set and exists, uses it.
//   - If SOLANA_PRIVATE_KEY env is set, uses it.
//   - Otherwise generates a new keypair at ~/.nanosolana/wallet/agent-wallet.json.
//
// Returns the wallet (may be the same across all calls).
func EnsureAgentWallet(walletKeyPath string) (*Wallet, error) {
	var ensureErr error

	agentWalletOnce.Do(func() {
		// 1. Try configured key path or env
		w, err := WalletFromEnvOrFile(walletKeyPath)
		if err != nil {
			ensureErr = err
			return
		}
		if w != nil {
			agentWallet = w
			log.Printf("[WALLET] 🔑 Agent wallet loaded: %s (source: %s)",
				w.ShortKey(4), walletSource(w))
			return
		}

		// 2. Check if we already generated one previously
		home, _ := os.UserHomeDir()
		agentPath := filepath.Join(home, ".nanosolana", defaultWalletDir, defaultWalletFile)
		if _, err := os.Stat(agentPath); err == nil {
			w, err = WalletFromKeygenFile(agentPath)
			if err != nil {
				ensureErr = fmt.Errorf("load existing agent wallet %s: %w", agentPath, err)
				return
			}
			agentWallet = w
			log.Printf("[WALLET] 🔑 Agent wallet restored: %s (file: %s)",
				w.ShortKey(4), agentPath)
			return
		}

		// 3. Generate new agentic wallet
		w = NewRandomWallet()

		// Save in standard Solana keygen format
		if err := w.SaveKeygenFile(agentPath); err != nil {
			ensureErr = fmt.Errorf("save agent wallet: %w", err)
			return
		}

		agentWallet = w
		log.Printf("[WALLET] 🆕 New agentic wallet generated: %s", w.PublicKeyStr())
		log.Printf("[WALLET] 📁 Saved to: %s", agentPath)
		log.Printf("[WALLET] ⚠️  Fund this wallet before live trading!")
	})

	if ensureErr != nil {
		return nil, ensureErr
	}
	return agentWallet, nil
}

// GetAgentWallet returns the current agent wallet (nil if not yet initialized).
func GetAgentWallet() *Wallet {
	return agentWallet
}

// SaveKeygenFile writes the wallet's private key to a file in standard
// Solana CLI keygen JSON format ([byte array of 64-byte keypair]).
func (w *Wallet) SaveKeygenFile(path string) error {
	if w.inner == nil {
		return fmt.Errorf("wallet has no private key")
	}

	// Ensure directory exists
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return fmt.Errorf("create wallet dir: %w", err)
	}

	// Standard Solana keygen format: JSON array of 64 bytes
	// (32 bytes private key + 32 bytes public key)
	keypairBytes := []byte(w.inner.PrivateKey)
	jsonBytes, err := json.Marshal(keypairBytes)
	if err != nil {
		return fmt.Errorf("marshal keypair: %w", err)
	}

	// Write with restrictive permissions (owner read/write only)
	if err := os.WriteFile(path, jsonBytes, 0o600); err != nil {
		return fmt.Errorf("write keygen file: %w", err)
	}

	w.keyPath = path
	return nil
}

// KeyPath returns the file path used to load/save this wallet.
func (w *Wallet) KeyPath() string {
	return w.keyPath
}

func walletSource(w *Wallet) string {
	if w.keyPath != "" {
		return "file:" + w.keyPath
	}
	if os.Getenv("SOLANA_PRIVATE_KEY") != "" {
		return "env:SOLANA_PRIVATE_KEY"
	}
	return "generated"
}
