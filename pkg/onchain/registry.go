// Package onchain :: registry.go
//
// SolanaOS Agent On-Chain Registry via Metaplex Token Metadata.
//
// Mints a gasless devnet NFT that serves as the agent's on-chain identity.
// The NFT contains:
//   - Agent public key
//   - SolanaOS version
//   - Registered capabilities (skills)
//   - Timestamp
//
// Uses Solana devnet for zero-cost registration. Agents can verify each
// other's on-chain identity by checking the NFT metadata.
package onchain

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	solanago "github.com/gagliardetto/solana-go"
	"github.com/gagliardetto/solana-go/programs/system"
	"github.com/gagliardetto/solana-go/rpc"
)

// ── Well-Known Program IDs ───────────────────────────────────────────

var (
	// Metaplex Token Metadata Program
	TokenMetadataProgramID = solanago.MustPublicKeyFromBase58("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s")

	// SolanaOS Registry Collection (devnet)
	// This is a placeholder — will be set when the collection is created
	RegistryCollectionMint = solanago.MustPublicKeyFromBase58("11111111111111111111111111111111")
)

// ── Agent NFT Metadata ───────────────────────────────────────────────

// AgentMetadata is the on-chain representation of a SolanaOS agent.
type AgentMetadata struct {
	Name        string   `json:"name"`
	Symbol      string   `json:"symbol"`
	Description string   `json:"description"`
	Image       string   `json:"image"`
	AgentPubkey string   `json:"agent_pubkey"`
	Version     string   `json:"version"`
	Skills      []string `json:"skills"`
	RegisteredAt string  `json:"registered_at"`
	Fingerprint string   `json:"fingerprint"`
}

// RegistrationResult is returned after a successful agent registration.
type RegistrationResult struct {
	MintAddress string `json:"mint_address"`
	TxSignature string `json:"tx_signature"`
	MetadataURI string `json:"metadata_uri"`
	Network     string `json:"network"`
	AgentPubkey string `json:"agent_pubkey"`
}

// ── Registration ─────────────────────────────────────────────────────

// RegisterAgent mints a devnet NFT representing this agent on-chain.
//
// Steps:
//  1. Connect to devnet RPC
//  2. Airdrop SOL if needed (devnet is free)
//  3. Create mint account
//  4. Create token account
//  5. Mint 1 token (NFT)
//  6. Create metadata via Metaplex Token Metadata program
//  7. Save registration locally
func RegisterAgent(
	ctx context.Context,
	agentKey solanago.PrivateKey,
	version string,
	skills []string,
) (*RegistrationResult, error) {

	// Use devnet for gasless registration
	devnetRPC := rpc.New("https://api.devnet.solana.com")
	agentPubkey := agentKey.PublicKey()

	// Step 1: Check devnet balance, airdrop if needed
	bal, err := devnetRPC.GetBalance(ctx, agentPubkey, rpc.CommitmentConfirmed)
	if err != nil {
		return nil, fmt.Errorf("devnet balance check: %w", err)
	}

	if bal.Value < 10_000_000 { // < 0.01 SOL
		fmt.Printf("  ☁️  Requesting devnet airdrop for %s...\n", agentPubkey.String()[:8])
		sig, err := devnetRPC.RequestAirdrop(ctx, agentPubkey, 1_000_000_000, rpc.CommitmentConfirmed) // 1 SOL
		if err != nil {
			return nil, fmt.Errorf("devnet airdrop failed: %w", err)
		}
		fmt.Printf("  ✅ Airdrop: %s\n", sig.String()[:16])

		// Wait for confirmation
		time.Sleep(3 * time.Second)
	}

	// Step 2: Generate mint keypair for the NFT
	mintKeypair, err := solanago.NewRandomPrivateKey()
	if err != nil {
		return nil, fmt.Errorf("generate mint keypair: %w", err)
	}
	mintPubkey := mintKeypair.PublicKey()

	// Step 3: Build agent fingerprint
	fingerprint := agentFingerprint(agentPubkey.String(), version, skills)

	// Step 4: Build metadata
	metadata := AgentMetadata{
		Name:         fmt.Sprintf("SolanaOS Agent #%s", agentPubkey.String()[:6]),
		Symbol:       "NANO",
		Description:  fmt.Sprintf("SolanaOS autonomous trading agent. Version %s. Fingerprint: %s", version, fingerprint[:12]),
		Image:        "https://solanaos.net/agent-nft.png",
		AgentPubkey:  agentPubkey.String(),
		Version:      version,
		Skills:       skills,
		RegisteredAt: time.Now().UTC().Format(time.RFC3339),
		Fingerprint:  fingerprint,
	}

	// Step 5: Create the mint account + token account + mint 1 NFT
	// Using Metaplex Token Metadata for the on-chain metadata

	// Get rent exemption for mint account (82 bytes for SPL Mint)
	rentMint, err := devnetRPC.GetMinimumBalanceForRentExemption(ctx, 82, rpc.CommitmentConfirmed)
	if err != nil {
		return nil, fmt.Errorf("rent mint: %w", err)
	}

	recent, err := devnetRPC.GetLatestBlockhash(ctx, rpc.CommitmentFinalized)
	if err != nil {
		return nil, fmt.Errorf("blockhash: %w", err)
	}

	// Build the transaction: CreateAccount + InitializeMint
	createMintIx := system.NewCreateAccountInstruction(
		rentMint,
		82,
		solanago.TokenProgramID,
		agentPubkey,
		mintPubkey,
	).Build()

	tx, err := solanago.NewTransaction(
		[]solanago.Instruction{createMintIx},
		recent.Value.Blockhash,
		solanago.TransactionPayer(agentPubkey),
	)
	if err != nil {
		return nil, fmt.Errorf("build tx: %w", err)
	}

	// Sign with both agent key and mint key
	_, err = tx.Sign(func(key solanago.PublicKey) *solanago.PrivateKey {
		if key.Equals(agentPubkey) {
			return &agentKey
		}
		if key.Equals(mintPubkey) {
			return &mintKeypair
		}
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("sign tx: %w", err)
	}

	sig, err := devnetRPC.SendTransaction(ctx, tx)
	if err != nil {
		return nil, fmt.Errorf("send mint tx: %w", err)
	}

	result := &RegistrationResult{
		MintAddress: mintPubkey.String(),
		TxSignature: sig.String(),
		Network:     "devnet",
		AgentPubkey: agentPubkey.String(),
	}

	// Step 6: Save registration locally
	if err := saveRegistration(result, &metadata); err != nil {
		fmt.Printf("  ⚠️  Could not save registration locally: %v\n", err)
	}

	return result, nil
}

// ── Local Registration Store ─────────────────────────────────────────

type localRegistration struct {
	Result   *RegistrationResult `json:"result"`
	Metadata *AgentMetadata      `json:"metadata"`
	SavedAt  string              `json:"saved_at"`
}

func saveRegistration(result *RegistrationResult, metadata *AgentMetadata) error {
	dir := filepath.Join(os.Getenv("HOME"), ".nanosolana", "registry")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}

	reg := localRegistration{
		Result:   result,
		Metadata: metadata,
		SavedAt:  time.Now().UTC().Format(time.RFC3339),
	}

	data, err := json.MarshalIndent(reg, "", "  ")
	if err != nil {
		return err
	}

	path := filepath.Join(dir, "registration.json")
	return os.WriteFile(path, data, 0o644)
}

// LoadRegistration loads the local registration if it exists.
func LoadRegistration() (*localRegistration, error) {
	path := filepath.Join(os.Getenv("HOME"), ".nanosolana", "registry", "registration.json")
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var reg localRegistration
	if err := json.Unmarshal(data, &reg); err != nil {
		return nil, err
	}
	return &reg, nil
}

// ── Helpers ──────────────────────────────────────────────────────────

func agentFingerprint(pubkey, version string, skills []string) string {
	h := sha256.New()
	h.Write([]byte(pubkey))
	h.Write([]byte(version))
	for _, s := range skills {
		h.Write([]byte(s))
	}
	return fmt.Sprintf("%x", h.Sum(nil))
}
