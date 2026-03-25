// Package solana — Native Solana RPC client.
// Wraps gagliardetto/solana-go/rpc for direct on-chain operations.
// Used alongside the existing HeliusClient for enhanced API features.
package solana

import (
	"context"
	"fmt"
	"log"
	"time"

	solanago "github.com/gagliardetto/solana-go"
	"github.com/gagliardetto/solana-go/rpc"
)

// ── SolanaRPC wraps the native solana-go RPC client ─────────────────

// SolanaRPC provides direct Solana on-chain operations using the native
// solana-go library. This complements HeliusClient (which uses manual
// JSON-RPC over HTTP) with the full typed RPC interface.
type SolanaRPC struct {
	client  *rpc.Client
	wallet  *Wallet
	network string // "mainnet", "devnet", "testnet"
}

// NewSolanaRPC creates a new native RPC client.
// rpcURL should include the API key if needed (e.g. Helius endpoint).
func NewSolanaRPC(rpcURL string, wallet *Wallet, network string) *SolanaRPC {
	if rpcURL == "" {
		rpcURL = rpc.MainNetBeta_RPC // fallback
	}

	return &SolanaRPC{
		client:  rpc.New(rpcURL),
		wallet:  wallet,
		network: network,
	}
}

// ── Account Operations ──────────────────────────────────────────────

// GetBalance returns the SOL balance for a public key.
func (s *SolanaRPC) GetBalance(pubkey solanago.PublicKey) (float64, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	result, err := s.client.GetBalance(ctx, pubkey, rpc.CommitmentFinalized)
	if err != nil {
		return 0, fmt.Errorf("rpc getBalance: %w", err)
	}
	return float64(result.Value) / float64(solanago.LAMPORTS_PER_SOL), nil
}

// GetWalletBalance returns the SOL balance for the loaded wallet.
func (s *SolanaRPC) GetWalletBalance() (float64, error) {
	if s.wallet == nil {
		return 0, fmt.Errorf("no wallet loaded")
	}
	return s.GetBalance(s.wallet.PublicKey)
}

// GetSlot returns the current slot number.
func (s *SolanaRPC) GetSlot() (uint64, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	slot, err := s.client.GetSlot(ctx, rpc.CommitmentFinalized)
	if err != nil {
		return 0, fmt.Errorf("rpc getSlot: %w", err)
	}
	return slot, nil
}

// GetBlockHeight returns the current block height.
func (s *SolanaRPC) GetBlockHeight() (uint64, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	height, err := s.client.GetBlockHeight(ctx, rpc.CommitmentFinalized)
	if err != nil {
		return 0, fmt.Errorf("rpc getBlockHeight: %w", err)
	}
	return height, nil
}

// GetLatestBlockhash fetches the latest blockhash for transaction building.
func (s *SolanaRPC) GetLatestBlockhash() (*rpc.GetLatestBlockhashResult, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	result, err := s.client.GetLatestBlockhash(ctx, rpc.CommitmentFinalized)
	if err != nil {
		return nil, fmt.Errorf("rpc getLatestBlockhash: %w", err)
	}
	return result, nil
}

// GetAccountInfo fetches account data for a public key.
func (s *SolanaRPC) GetAccountInfo(pubkey solanago.PublicKey) (*rpc.GetAccountInfoResult, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	result, err := s.client.GetAccountInfo(ctx, pubkey)
	if err != nil {
		return nil, fmt.Errorf("rpc getAccountInfo: %w", err)
	}
	return result, nil
}

// GetMinimumBalanceForRentExemption returns the minimum lamports needed
// for an account of the given data size.
func (s *SolanaRPC) GetMinimumBalanceForRentExemption(dataSize uint64) (uint64, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	result, err := s.client.GetMinimumBalanceForRentExemption(ctx, dataSize, rpc.CommitmentFinalized)
	if err != nil {
		return 0, fmt.Errorf("rpc getMinimumBalanceForRentExemption: %w", err)
	}
	return result, nil
}

// GetHealth checks if the RPC node is healthy.
func (s *SolanaRPC) GetHealth() (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := s.client.GetHealth(ctx)
	if err != nil {
		return "error", fmt.Errorf("rpc getHealth: %w", err)
	}
	return "ok", nil
}

// GetVersion returns the Solana node version.
func (s *SolanaRPC) GetVersion() (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	result, err := s.client.GetVersion(ctx)
	if err != nil {
		return "", fmt.Errorf("rpc getVersion: %w", err)
	}
	return result.SolanaCore, nil
}

// ── Transaction Operations ──────────────────────────────────────────

// SendTransaction signs and sends a transaction.
func (s *SolanaRPC) SendTransaction(tx *solanago.Transaction) (solanago.Signature, error) {
	if s.wallet == nil {
		return solanago.Signature{}, fmt.Errorf("no wallet loaded — cannot sign")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	sig, err := s.client.SendTransaction(ctx, tx)
	if err != nil {
		return solanago.Signature{}, fmt.Errorf("rpc sendTransaction: %w", err)
	}

	log.Printf("[RPC] ✅ Transaction sent: %s", sig)
	return sig, nil
}

// ConfirmTransaction waits for a transaction to be confirmed.
func (s *SolanaRPC) ConfirmTransaction(sig solanago.Signature, maxAttempts int) (bool, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	for attempt := 0; attempt < maxAttempts; attempt++ {
		result, err := s.client.GetSignatureStatuses(ctx, true, sig)
		if err != nil {
			time.Sleep(1 * time.Second)
			continue
		}

		if result != nil && len(result.Value) > 0 && result.Value[0] != nil {
			status := result.Value[0]
			if status.Err != nil {
				return false, fmt.Errorf("transaction failed: %v", status.Err)
			}
			if status.ConfirmationStatus == rpc.ConfirmationStatusFinalized ||
				status.ConfirmationStatus == rpc.ConfirmationStatusConfirmed {
				return true, nil
			}
		}

		time.Sleep(500 * time.Millisecond)
	}

	return false, fmt.Errorf("transaction not confirmed after %d attempts", maxAttempts)
}

// ── Token Operations ────────────────────────────────────────────────

// GetTokenAccountsByOwner returns all token accounts for an owner.
func (s *SolanaRPC) GetTokenAccountsByOwner(owner solanago.PublicKey) ([]TokenAccountInfo, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	tokenProgram := solanago.TokenProgramID
	result, err := s.client.GetTokenAccountsByOwner(
		ctx,
		owner,
		&rpc.GetTokenAccountsConfig{
			ProgramId: &tokenProgram,
		},
		&rpc.GetTokenAccountsOpts{
			Encoding: solanago.EncodingJSONParsed,
		},
	)
	if err != nil {
		return nil, fmt.Errorf("rpc getTokenAccountsByOwner: %w", err)
	}

	var accounts []TokenAccountInfo
	for _, a := range result.Value {
		accounts = append(accounts, TokenAccountInfo{
			Pubkey:  a.Pubkey.String(),
			Account: a,
		})
	}
	return accounts, nil
}

// TokenAccountInfo wraps a token account response.
type TokenAccountInfo struct {
	Pubkey  string
	Account *rpc.TokenAccount
}

// ── Convenience ─────────────────────────────────────────────────────

// WalletPubkey returns the wallet's public key string, or empty if no wallet.
func (s *SolanaRPC) WalletPubkey() string {
	if s.wallet == nil {
		return ""
	}
	return s.wallet.PublicKeyStr()
}

// IsHealthy checks if the RPC connection is working.
func (s *SolanaRPC) IsHealthy() bool {
	_, err := s.GetHealth()
	return err == nil
}

// Network returns the configured network name.
func (s *SolanaRPC) Network() string {
	return s.network
}

// Wallet returns the underlying wallet (may be nil in read-only mode).
func (s *SolanaRPC) Wallet() *Wallet {
	return s.wallet
}
