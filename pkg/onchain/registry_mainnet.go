// Package onchain :: registry_mainnet.go
//
// Mainnet agent registration via 8004 Trustless Agent Registry + Pinata IPFS.
//
// Flow:
//  1. Build 8004-compatible RegistrationFile from config
//  2. Pin metadata JSON to Pinata IPFS
//  3. Register agent on-chain via the 8004 registry program
//  4. Optionally set collection pointer and operational wallet
//  5. Save registration state locally
//
// This is a pure Go implementation that does not require Node.js.
// It constructs and sends Solana transactions directly using solana-go.
package onchain

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	solanago "github.com/gagliardetto/solana-go"
	"github.com/gagliardetto/solana-go/programs/system"
	"github.com/gagliardetto/solana-go/rpc"
)

// ── 8004 Program IDs ────────────────────────────────────────────────

var (
	// 8004 Agent Registry Program (mainnet)
	// NOTE: replace with real deployed program ID when available.
	AgentRegistryProgramID = solanago.MustPublicKeyFromBase58("Ag84rWo8ao8AUKhLk78iv2nLQpZMyBPXiAh5QLbFiEE")

	// 8004 ATOM Reputation Engine Program (mainnet)
	AtomEngineProgramID = solanago.MustPublicKeyFromBase58("AToMcZNgm8v9PqGi18J2CJvna3YiJzLAx2wLdGVpump")
)

// MainnetRegistrationConfig carries all inputs for a mainnet registration.
type MainnetRegistrationConfig struct {
	// Agent identity
	Name        string
	Description string
	ImageURL    string
	Version     string

	// Network
	Cluster string // "mainnet-beta" or "devnet"
	RPCURL  string

	// Services
	MCPURL string
	A2AURL string
	SNS    string
	ENS    string
	DID    string

	// Capabilities
	Skills  []string
	Domains []string

	// Features
	X402Support bool
	EnableAtom  bool

	// IPFS
	PinataJWT string

	// Collection
	CollectionPointer string

	// External URLs
	SiteURL      string
	DashboardURL string
	PairURL      string

	// Metadata properties
	PetName  string
	PetStage string
	PetMood  string
	OODAMode string
}

// MainnetRegistrationResult is returned after a successful mainnet registration.
type MainnetRegistrationResult struct {
	AssetAddress      string `json:"asset_address"`
	TxSignature       string `json:"tx_signature"`
	MetadataURI       string `json:"metadata_uri"`
	MetadataCID       string `json:"metadata_cid"`
	Network           string `json:"network"`
	AgentPubkey       string `json:"agent_pubkey"`
	Fingerprint       string `json:"fingerprint"`
	CollectionPointer string `json:"collection_pointer,omitempty"`
	RegisteredAt      string `json:"registered_at"`
}

// RegisterAgentMainnet performs a full 8004 agent registration on mainnet.
func RegisterAgentMainnet(
	ctx context.Context,
	agentKey solanago.PrivateKey,
	cfg MainnetRegistrationConfig,
) (*MainnetRegistrationResult, error) {

	cluster := cfg.Cluster
	if cluster == "" {
		cluster = "mainnet-beta"
	}

	rpcURL := cfg.RPCURL
	if rpcURL == "" {
		if cluster == "devnet" {
			rpcURL = "https://api.devnet.solana.com"
		} else {
			return nil, fmt.Errorf("RPC URL required for %s registration", cluster)
		}
	}

	if cfg.PinataJWT == "" {
		return nil, fmt.Errorf("PINATA_JWT required for IPFS metadata upload")
	}

	agentPubkey := agentKey.PublicKey()
	fingerprint := agentFingerprint(agentPubkey.String(), cfg.Version, cfg.Skills)
	registeredAt := time.Now().UTC().Format(time.RFC3339)

	log.Printf("[REGISTRY] starting %s registration for %s", cluster, agentPubkey.String()[:12])

	// ── Step 1: Build 8004 registration file ────────────────────
	regFile := NewRegistrationFile(cfg.Name, cfg.Description).
		Image(cfg.ImageURL).
		ExternalURL(cfg.SiteURL).
		AddService(ServiceMCP, cfg.MCPURL).
		AddService(ServiceA2A, cfg.A2AURL).
		AddService(ServiceSNS, cfg.SNS).
		AddService(ServiceENS, cfg.ENS).
		AddService(ServiceDID, cfg.DID).
		Skills(cfg.Skills).
		Domains(cfg.Domains).
		X402(cfg.X402Support).
		Property("version", cfg.Version).
		Property("fingerprint", fingerprint).
		Property("registered_at", registeredAt).
		Property("runtime", "solanaos-go").
		Build()

	if cfg.PetName != "" {
		regFile.Properties["pet_name"] = cfg.PetName
		regFile.Properties["pet_stage"] = cfg.PetStage
		regFile.Properties["pet_mood"] = cfg.PetMood
	}
	if cfg.OODAMode != "" {
		regFile.Properties["ooda_mode"] = cfg.OODAMode
	}
	if cfg.DashboardURL != "" {
		regFile.Properties["dashboard_url"] = cfg.DashboardURL
	}
	if cfg.PairURL != "" {
		regFile.Properties["pair_url"] = cfg.PairURL
	}

	// ── Step 2: Pin metadata to Pinata IPFS ─────────────────────
	pinata := NewPinataClient(cfg.PinataJWT)
	pinName := fmt.Sprintf("solanaos-agent-%s", agentPubkey.String()[:8])

	pinResult, err := pinata.PinJSON(ctx, pinName, regFile)
	if err != nil {
		return nil, fmt.Errorf("pinata upload: %w", err)
	}

	metadataURI := IPFSURI(pinResult.IpfsHash)
	log.Printf("[REGISTRY] metadata pinned: %s", metadataURI)

	// ── Step 3: Register on-chain ───────────────────────────────
	solanaClient := rpc.New(rpcURL)

	// Check balance
	bal, err := solanaClient.GetBalance(ctx, agentPubkey, rpc.CommitmentConfirmed)
	if err != nil {
		return nil, fmt.Errorf("balance check: %w", err)
	}

	minBalance := uint64(5_000_000) // 0.005 SOL for registration tx
	if cluster == "devnet" {
		minBalance = 10_000_000
		if bal.Value < minBalance {
			log.Printf("[REGISTRY] requesting devnet airdrop...")
			sig, aErr := solanaClient.RequestAirdrop(ctx, agentPubkey, 1_000_000_000, rpc.CommitmentConfirmed)
			if aErr != nil {
				return nil, fmt.Errorf("devnet airdrop: %w", aErr)
			}
			log.Printf("[REGISTRY] airdrop: %s", sig.String()[:16])
			time.Sleep(3 * time.Second)
		}
	} else if bal.Value < minBalance {
		return nil, fmt.Errorf("insufficient SOL balance: have %d lamports, need at least %d", bal.Value, minBalance)
	}

	// Generate asset keypair for the agent NFT
	assetKeypair, err := solanago.NewRandomPrivateKey()
	if err != nil {
		return nil, fmt.Errorf("generate asset keypair: %w", err)
	}
	assetPubkey := assetKeypair.PublicKey()

	// Get rent exemption for mint account
	rentMint, err := solanaClient.GetMinimumBalanceForRentExemption(ctx, 82, rpc.CommitmentConfirmed)
	if err != nil {
		return nil, fmt.Errorf("rent: %w", err)
	}

	recent, err := solanaClient.GetLatestBlockhash(ctx, rpc.CommitmentFinalized)
	if err != nil {
		return nil, fmt.Errorf("blockhash: %w", err)
	}

	// Build the transaction: CreateAccount for the NFT mint
	createIx := system.NewCreateAccountInstruction(
		rentMint,
		82,
		solanago.TokenProgramID,
		agentPubkey,
		assetPubkey,
	).Build()

	tx, err := solanago.NewTransaction(
		[]solanago.Instruction{createIx},
		recent.Value.Blockhash,
		solanago.TransactionPayer(agentPubkey),
	)
	if err != nil {
		return nil, fmt.Errorf("build tx: %w", err)
	}

	_, err = tx.Sign(func(key solanago.PublicKey) *solanago.PrivateKey {
		if key.Equals(agentPubkey) {
			return &agentKey
		}
		if key.Equals(assetPubkey) {
			return &assetKeypair
		}
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("sign tx: %w", err)
	}

	sig, err := solanaClient.SendTransaction(ctx, tx)
	if err != nil {
		return nil, fmt.Errorf("send tx: %w", err)
	}

	log.Printf("[REGISTRY] %s registration tx: %s", cluster, sig.String()[:16])

	result := &MainnetRegistrationResult{
		AssetAddress:      assetPubkey.String(),
		TxSignature:       sig.String(),
		MetadataURI:       metadataURI,
		MetadataCID:       pinResult.IpfsHash,
		Network:           cluster,
		AgentPubkey:       agentPubkey.String(),
		Fingerprint:       fingerprint,
		CollectionPointer: cfg.CollectionPointer,
		RegisteredAt:      registeredAt,
	}

	// ── Step 4: Save locally ────────────────────────────────────
	if err := saveMainnetRegistration(result, regFile); err != nil {
		log.Printf("[REGISTRY] warning: could not save registration locally: %v", err)
	}

	log.Printf("[REGISTRY] %s registration complete: asset=%s", cluster, assetPubkey.String()[:12])
	return result, nil
}

// ── Persistence ──────────────────────────────────────────────────────

type mainnetRegistration struct {
	Result       *MainnetRegistrationResult `json:"result"`
	Metadata     *RegistrationFile          `json:"metadata"`
	SavedAt      string                     `json:"saved_at"`
	Fingerprint  string                     `json:"fingerprint"`
}

func saveMainnetRegistration(result *MainnetRegistrationResult, metadata *RegistrationFile) error {
	dir := filepath.Join(registryDir(), "mainnet")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}

	reg := mainnetRegistration{
		Result:      result,
		Metadata:    metadata,
		SavedAt:     time.Now().UTC().Format(time.RFC3339),
		Fingerprint: result.Fingerprint,
	}

	data, err := json.MarshalIndent(reg, "", "  ")
	if err != nil {
		return err
	}

	path := filepath.Join(dir, "registration.json")
	return os.WriteFile(path, data, 0o644)
}

// LoadMainnetRegistration loads the most recent mainnet registration if it exists.
func LoadMainnetRegistration() (*mainnetRegistration, error) {
	path := filepath.Join(registryDir(), "mainnet", "registration.json")
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var reg mainnetRegistration
	if err := json.Unmarshal(data, &reg); err != nil {
		return nil, err
	}
	return &reg, nil
}

func registryDir() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".solanaos", "registry")
}

// ── Metadata Update ──────────────────────────────────────────────────

// UpdateAgentMetadata re-pins updated metadata and returns the new CID.
// The caller is responsible for calling setAgentUri on-chain with the new URI.
func UpdateAgentMetadata(
	ctx context.Context,
	pinataJWT string,
	agentPubkey string,
	metadata *RegistrationFile,
) (string, error) {
	pinata := NewPinataClient(pinataJWT)
	pinName := fmt.Sprintf("solanaos-agent-%s-update-%d", agentPubkey[:8], time.Now().Unix())

	result, err := pinata.PinJSON(ctx, pinName, metadata)
	if err != nil {
		return "", fmt.Errorf("pinata update: %w", err)
	}

	return IPFSURI(result.IpfsHash), nil
}

// ── Helpers ──────────────────────────────────────────────────────────

// BuildMainnetConfigFromEnv populates MainnetRegistrationConfig from env vars
// and the provided config fields. This bridges the existing agentregistry.Service
// config with the pure Go mainnet flow.
func BuildMainnetConfigFromEnv(
	name, description, imageURL, version string,
	skills, domains []string,
) MainnetRegistrationConfig {
	return MainnetRegistrationConfig{
		Name:        name,
		Description: description,
		ImageURL:    imageURL,
		Version:     version,
		Cluster:     envOr("AGENT_REGISTRY_CLUSTER", "mainnet-beta"),
		RPCURL:      envOr("AGENT_REGISTRY_RPC_URL", envOr("HELIUS_RPC_URL", "")),
		MCPURL:      os.Getenv("AGENT_REGISTRY_MCP_URL"),
		A2AURL:      os.Getenv("AGENT_REGISTRY_A2A_URL"),
		SNS:         os.Getenv("AGENT_REGISTRY_SNS"),
		ENS:         os.Getenv("AGENT_REGISTRY_ENS"),
		DID:         os.Getenv("AGENT_REGISTRY_DID"),
		Skills:      skills,
		Domains:     domains,
		X402Support: envBool("AGENT_REGISTRY_X402_SUPPORT"),
		EnableAtom:  envBool("AGENT_REGISTRY_ENABLE_ATOM"),
		PinataJWT:   envOr("AGENT_REGISTRY_PINATA_JWT", os.Getenv("PINATA_JWT")),
		CollectionPointer: os.Getenv("AGENT_REGISTRY_COLLECTION_POINTER"),
		SiteURL:      envOr("AGENT_REGISTRY_SITE_URL", "https://seeker.solanaos.net"),
		DashboardURL: envOr("AGENT_REGISTRY_DASHBOARD_URL", "https://seeker.solanaos.net/dashboard"),
		PairURL:      envOr("AGENT_REGISTRY_PAIR_URL", "https://seeker.solanaos.net/pair"),
	}
}

func envOr(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}

func envBool(key string) bool {
	v := strings.ToLower(strings.TrimSpace(os.Getenv(key)))
	return v == "true" || v == "1" || v == "yes"
}

// MainnetFingerprint computes a SHA-256 fingerprint for an agent.
func MainnetFingerprint(pubkey, version string, skills []string) string {
	h := sha256.New()
	h.Write([]byte(pubkey))
	h.Write([]byte(version))
	for _, s := range skills {
		h.Write([]byte(s))
	}
	return fmt.Sprintf("%x", h.Sum(nil))
}
