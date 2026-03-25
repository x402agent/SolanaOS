package pinata

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"
)

// ── Mainnet Deployment Orchestrator ─────────────────────────────────
// Connects the Pinata Private IPFS Hub to Solana mainnet deployment
// via the 8004 Agent Registry and Metaplex mpl-core NFTs.
//
// Flow:
//   1. Build 8004-compatible registration metadata
//   2. Pin metadata to Private IPFS via Pinata
//   3. Optionally pin agent image/assets to Private IPFS
//   4. Trigger on-chain registration (8004, Metaplex, or dual)
//   5. Track deployment in Convex + mesh-sync to all nodes
//   6. Register NFT ownership per Solana wallet

// DeployMode controls which on-chain registry is used.
type DeployMode string

const (
	DeployMode8004     DeployMode = "8004"
	DeployModeMetaplex DeployMode = "metaplex"
	DeployModeDual     DeployMode = "dual"
)

// DeployConfig holds deployment parameters.
type DeployConfig struct {
	// Identity
	WalletAddress string
	GitHubUser    string
	DeviceID      string

	// Registry
	Mode    DeployMode
	Cluster string // "mainnet-beta", "devnet"
	RPCURL  string

	// Agent metadata (8004/Metaplex compatible)
	Name        string
	Description string
	Symbol      string
	ImagePath   string // local path or existing IPFS CID
	ExternalURL string

	// Services
	MCPURL    string
	A2AURL    string
	SNS       string
	ENS       string
	DID       string
	WalletSvc string

	// Capabilities
	Skills      []string
	Domains     []string
	X402Support bool

	// Deployment options
	ATOMEnabled       bool   // Enable ATOM reputation at creation (irreversible)
	CollectionPointer string // Existing collection pointer (c1:...)
	MeshSync          bool   // Auto-distribute registration to mesh nodes

	// Convex tracking
	ConvexURL      string
	ConvexDeployKey string

	// Node.js helper (for SDK operations not available in Go)
	NodeHelperPath string // path to agent-registry.mjs
}

// DeployResult contains the deployment outcome.
type DeployResult struct {
	// IPFS
	MetadataCID string `json:"metadata_cid"`
	MetadataURI string `json:"metadata_uri"` // ipfs://...
	ImageCID    string `json:"image_cid,omitempty"`
	ImageURI    string `json:"image_uri,omitempty"`

	// On-chain (8004)
	AssetAddress     string `json:"asset_address,omitempty"`
	RegistrationTx   string `json:"registration_tx,omitempty"`
	TransferTx       string `json:"transfer_tx,omitempty"`

	// On-chain (Metaplex)
	MetaplexAsset        string `json:"metaplex_asset,omitempty"`
	MetaplexIdentityPDA  string `json:"metaplex_identity_pda,omitempty"`
	MetaplexExecutivePDA string `json:"metaplex_executive_pda,omitempty"`
	MetaplexDelegatePDA  string `json:"metaplex_delegate_pda,omitempty"`
	MetaplexRegistrationTx string `json:"metaplex_registration_tx,omitempty"`

	// Pinata tracking
	PinataFileID string `json:"pinata_file_id,omitempty"`
	GroupID      string `json:"group_id,omitempty"`

	// Mesh
	SyncedNodes []string `json:"synced_nodes,omitempty"`

	// Status
	Mode      DeployMode `json:"mode"`
	Cluster   string     `json:"cluster"`
	Timestamp string     `json:"timestamp"`
}

// Deployer orchestrates mainnet deployment.
type Deployer struct {
	hub  *Hub
	mesh *MeshSync
}

// NewDeployer creates a deployment orchestrator.
func NewDeployer(hub *Hub, mesh *MeshSync) *Deployer {
	return &Deployer{hub: hub, mesh: mesh}
}

// ── Registration File (8004/Metaplex compatible) ────────────────────

// RegistrationService matches the 8004 SDK ServiceType format.
type RegistrationService struct {
	Type  string `json:"type"`
	Value string `json:"value"`
}

// RegistrationFile is the 8004-compatible metadata format.
type RegistrationFile struct {
	Name        string                `json:"name"`
	Description string                `json:"description"`
	Image       string                `json:"image,omitempty"`
	ExternalURL string                `json:"external_url,omitempty"`
	Services    []RegistrationService `json:"services,omitempty"`
	Skills      []string              `json:"skills,omitempty"`
	Domains     []string              `json:"domains,omitempty"`
	X402Support bool                  `json:"x402_support,omitempty"`
	Properties  map[string]any        `json:"properties,omitempty"`
}

// BuildRegistrationFile constructs 8004-compatible metadata from deploy config.
func BuildRegistrationFile(cfg DeployConfig) *RegistrationFile {
	rf := &RegistrationFile{
		Name:        cfg.Name,
		Description: cfg.Description,
		Image:       cfg.ImagePath,
		ExternalURL: cfg.ExternalURL,
		Skills:      cfg.Skills,
		Domains:     cfg.Domains,
		X402Support: cfg.X402Support,
		Properties:  make(map[string]any),
	}

	// Add services
	if cfg.MCPURL != "" {
		rf.Services = append(rf.Services, RegistrationService{Type: "mcp", Value: cfg.MCPURL})
	}
	if cfg.A2AURL != "" {
		rf.Services = append(rf.Services, RegistrationService{Type: "a2a", Value: cfg.A2AURL})
	}
	if cfg.SNS != "" {
		rf.Services = append(rf.Services, RegistrationService{Type: "sns", Value: cfg.SNS})
	}
	if cfg.ENS != "" {
		rf.Services = append(rf.Services, RegistrationService{Type: "ens", Value: cfg.ENS})
	}
	if cfg.DID != "" {
		rf.Services = append(rf.Services, RegistrationService{Type: "did", Value: cfg.DID})
	}
	if cfg.WalletSvc != "" {
		rf.Services = append(rf.Services, RegistrationService{Type: "wallet", Value: cfg.WalletSvc})
	}

	// Add properties for cross-platform tracking
	rf.Properties["solana_wallet"] = cfg.WalletAddress
	if cfg.GitHubUser != "" {
		rf.Properties["github_user"] = cfg.GitHubUser
	}
	if cfg.DeviceID != "" {
		rf.Properties["device_id"] = cfg.DeviceID
	}
	rf.Properties["deploy_mode"] = string(cfg.Mode)
	rf.Properties["deployed_at"] = time.Now().UTC().Format(time.RFC3339)

	return rf
}

// ── Deploy Pipeline ─────────────────────────────────────────────────

// Deploy executes the full mainnet deployment pipeline.
func (d *Deployer) Deploy(ctx context.Context, cfg DeployConfig) (*DeployResult, error) {
	result := &DeployResult{
		Mode:      cfg.Mode,
		Cluster:   cfg.Cluster,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	}

	// Step 1: Upload agent image to Private IPFS (if local path)
	if cfg.ImagePath != "" && !isIPFSURI(cfg.ImagePath) {
		log.Printf("[deploy] uploading agent image to Private IPFS...")
		imageResult, err := d.hub.UploadForWallet(ctx, cfg.WalletAddress, "agent-image", nil, map[string]string{
			"type": "agent-image",
			"name": cfg.Name,
		})
		if err != nil {
			log.Printf("[deploy] image upload failed (non-fatal): %v", err)
		} else {
			result.ImageCID = imageResult.CID
			result.ImageURI = "ipfs://" + imageResult.CID
			cfg.ImagePath = result.ImageURI // Update config with IPFS URI
		}
	}

	// Step 2: Build 8004-compatible registration metadata
	regFile := BuildRegistrationFile(cfg)
	log.Printf("[deploy] built registration file for %q", cfg.Name)

	// Step 3: Pin metadata to Private IPFS
	metadataJSON, err := json.Marshal(regFile)
	if err != nil {
		return nil, fmt.Errorf("deploy: marshal metadata: %w", err)
	}

	metaUpload, err := d.hub.UploadCrossIdentity(ctx,
		cfg.WalletAddress, cfg.GitHubUser, cfg.DeviceID,
		fmt.Sprintf("%s-metadata.json", cfg.Name),
		bytes.NewReader(metadataJSON),
		map[string]string{
			"type":       "agent-metadata",
			"agent_name": cfg.Name,
			"cluster":    cfg.Cluster,
			"mode":       string(cfg.Mode),
		},
	)
	if err != nil {
		return nil, fmt.Errorf("deploy: pin metadata: %w", err)
	}

	result.MetadataCID = metaUpload.CID
	result.MetadataURI = "ipfs://" + metaUpload.CID
	result.PinataFileID = metaUpload.ID
	log.Printf("[deploy] metadata pinned: %s", result.MetadataURI)

	// Step 4: Trigger on-chain registration via Node.js helper
	// The actual 8004/Metaplex SDK calls happen in TypeScript
	onchainResult, err := d.triggerOnChainRegistration(ctx, cfg, result)
	if err != nil {
		return result, fmt.Errorf("deploy: on-chain registration: %w", err)
	}
	mergeOnChainResult(result, onchainResult)

	// Step 5: Track in Convex
	if cfg.ConvexURL != "" {
		if err := d.trackInConvex(ctx, cfg, result); err != nil {
			log.Printf("[deploy] convex tracking failed (non-fatal): %v", err)
		}
	}

	// Step 6: Mesh-sync deployment info to all nodes
	if cfg.MeshSync && d.mesh != nil {
		log.Printf("[deploy] syncing deployment to mesh nodes...")
		d.mesh.SyncToAllOnline(result.PinataFileID, result.MetadataCID,
			fmt.Sprintf("%s-metadata.json", cfg.Name), cfg.WalletAddress)
	}

	log.Printf("[deploy] complete: %s on %s (mode=%s)", cfg.Name, cfg.Cluster, cfg.Mode)
	return result, nil
}

// ── On-Chain Registration ───────────────────────────────────────────

type onChainResult struct {
	// 8004
	AssetAddress   string `json:"asset_address,omitempty"`
	RegistrationTx string `json:"registration_tx,omitempty"`
	TransferTx     string `json:"transfer_tx,omitempty"`

	// Metaplex
	MetaplexAsset          string `json:"metaplex_asset,omitempty"`
	MetaplexIdentityPDA    string `json:"metaplex_identity_pda,omitempty"`
	MetaplexExecutivePDA   string `json:"metaplex_executive_pda,omitempty"`
	MetaplexDelegatePDA    string `json:"metaplex_delegate_pda,omitempty"`
	MetaplexRegistrationTx string `json:"metaplex_registration_tx,omitempty"`
}

// triggerOnChainRegistration calls the Convex action or Node.js helper
// to perform the actual SDK operations (8004-solana, @metaplex-foundation).
func (d *Deployer) triggerOnChainRegistration(ctx context.Context, cfg DeployConfig, partial *DeployResult) (*onChainResult, error) {
	// Prefer Convex action (runs in serverless, has full SDK access)
	if cfg.ConvexURL != "" && cfg.ConvexDeployKey != "" {
		return d.registerViaConvex(ctx, cfg, partial)
	}

	// Fallback: return partial result (metadata pinned, needs manual on-chain step)
	log.Printf("[deploy] no Convex credentials — metadata pinned, on-chain registration pending")
	return &onChainResult{}, nil
}

// registerViaConvex calls the Convex createAgentForUser action.
func (d *Deployer) registerViaConvex(ctx context.Context, cfg DeployConfig, partial *DeployResult) (*onChainResult, error) {
	payload := map[string]any{
		"name":               cfg.Name,
		"description":        cfg.Description,
		"symbol":             cfg.Symbol,
		"ownerWalletAddress": cfg.WalletAddress,
		"registryMode":       string(cfg.Mode),
		"metadataUri":        partial.MetadataURI,
		"metadataCid":        partial.MetadataCID,
		"skills":             cfg.Skills,
		"domains":            cfg.Domains,
		"atomEnabled":        cfg.ATOMEnabled,
		"collectionPointer":  cfg.CollectionPointer,
	}
	if cfg.ImagePath != "" {
		payload["imageUri"] = cfg.ImagePath
	}
	if cfg.MCPURL != "" {
		payload["mcpUrl"] = cfg.MCPURL
	}
	if cfg.A2AURL != "" {
		payload["a2aUrl"] = cfg.A2AURL
	}
	if cfg.ExternalURL != "" {
		payload["website"] = cfg.ExternalURL
	}

	body, _ := json.Marshal(payload)
	url := fmt.Sprintf("%s/api/v1/agents/deploy", cfg.ConvexURL)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("deploy: convex request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+cfg.ConvexDeployKey)

	resp, err := (&http.Client{Timeout: 120 * time.Second}).Do(req)
	if err != nil {
		return nil, fmt.Errorf("deploy: convex call: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("deploy: convex error (%d): %s", resp.StatusCode, string(respBody))
	}

	var result onChainResult
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("deploy: decode convex response: %w", err)
	}
	return &result, nil
}

// ── Convex Tracking ─────────────────────────────────────────────────

func (d *Deployer) trackInConvex(ctx context.Context, cfg DeployConfig, result *DeployResult) error {
	payload := map[string]any{
		"pinataId":      result.PinataFileID,
		"cid":           result.MetadataCID,
		"name":          fmt.Sprintf("%s-metadata.json", cfg.Name),
		"size":          0,
		"network":       "private",
		"solanaWallet":  cfg.WalletAddress,
		"githubUser":    cfg.GitHubUser,
		"deviceId":      cfg.DeviceID,
		"keyvalues": map[string]string{
			"type":          "agent-deployment",
			"agent_name":    cfg.Name,
			"cluster":       cfg.Cluster,
			"mode":          string(cfg.Mode),
			"asset_address": result.AssetAddress,
		},
	}

	body, _ := json.Marshal(payload)
	url := fmt.Sprintf("%s/api/v1/ipfs/track", cfg.ConvexURL)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	if cfg.ConvexDeployKey != "" {
		req.Header.Set("Authorization", "Bearer "+cfg.ConvexDeployKey)
	}

	resp, err := (&http.Client{Timeout: 30 * time.Second}).Do(req)
	if err != nil {
		return err
	}
	resp.Body.Close()
	return nil
}

// ── Helpers ─────────────────────────────────────────────────────────

func isIPFSURI(s string) bool {
	return len(s) > 7 && s[:7] == "ipfs://"
}

func mergeOnChainResult(dst *DeployResult, src *onChainResult) {
	if src == nil {
		return
	}
	dst.AssetAddress = src.AssetAddress
	dst.RegistrationTx = src.RegistrationTx
	dst.TransferTx = src.TransferTx
	dst.MetaplexAsset = src.MetaplexAsset
	dst.MetaplexIdentityPDA = src.MetaplexIdentityPDA
	dst.MetaplexExecutivePDA = src.MetaplexExecutivePDA
	dst.MetaplexDelegatePDA = src.MetaplexDelegatePDA
	dst.MetaplexRegistrationTx = src.MetaplexRegistrationTx
}

// ── NFT Metadata (Metaplex Core compatible) ─────────────────────────

// MetaplexNFTMetadata is the Metaplex-compatible NFT metadata format.
// Can be pinned to Private IPFS and used as the NFT URI.
type MetaplexNFTMetadata struct {
	Name                 string                `json:"name"`
	Symbol               string                `json:"symbol,omitempty"`
	Description          string                `json:"description"`
	Image                string                `json:"image"`
	ExternalURL          string                `json:"external_url,omitempty"`
	AnimationURL         string                `json:"animation_url,omitempty"`
	Attributes           []MetaplexAttribute   `json:"attributes,omitempty"`
	Properties           *MetaplexProperties   `json:"properties,omitempty"`
	// 8004 extension fields
	Services             []RegistrationService `json:"services,omitempty"`
	AgentRegistryVersion string                `json:"agent_registry_version,omitempty"`
}

// MetaplexAttribute is a trait attribute for the NFT.
type MetaplexAttribute struct {
	TraitType string `json:"trait_type"`
	Value     any    `json:"value"`
}

// MetaplexProperties holds the NFT file manifest.
type MetaplexProperties struct {
	Files    []MetaplexFile `json:"files,omitempty"`
	Category string         `json:"category,omitempty"`
}

// MetaplexFile is a file reference in the NFT properties.
type MetaplexFile struct {
	URI  string `json:"uri"`
	Type string `json:"type"`
}

// BuildNFTMetadata creates Metaplex-compatible NFT metadata from deploy config.
// This can be used for both 8004 registration URIs and standalone NFT minting.
func BuildNFTMetadata(cfg DeployConfig, imageCID string) *MetaplexNFTMetadata {
	meta := &MetaplexNFTMetadata{
		Name:        cfg.Name,
		Symbol:      cfg.Symbol,
		Description: cfg.Description,
		ExternalURL: cfg.ExternalURL,
		AgentRegistryVersion: "8004-v0.8",
	}

	// Image
	if imageCID != "" {
		meta.Image = "ipfs://" + imageCID
	} else if cfg.ImagePath != "" {
		meta.Image = cfg.ImagePath
	}

	// Attributes for on-chain searchability
	meta.Attributes = append(meta.Attributes,
		MetaplexAttribute{TraitType: "Agent Runtime", Value: "SolanaOS"},
		MetaplexAttribute{TraitType: "Registry Mode", Value: string(cfg.Mode)},
		MetaplexAttribute{TraitType: "Cluster", Value: cfg.Cluster},
	)
	if cfg.X402Support {
		meta.Attributes = append(meta.Attributes,
			MetaplexAttribute{TraitType: "x402 Support", Value: true})
	}
	if cfg.ATOMEnabled {
		meta.Attributes = append(meta.Attributes,
			MetaplexAttribute{TraitType: "ATOM Reputation", Value: true})
	}
	for _, skill := range cfg.Skills {
		meta.Attributes = append(meta.Attributes,
			MetaplexAttribute{TraitType: "Skill", Value: skill})
	}
	for _, domain := range cfg.Domains {
		meta.Attributes = append(meta.Attributes,
			MetaplexAttribute{TraitType: "Domain", Value: domain})
	}

	// Services
	if cfg.MCPURL != "" {
		meta.Services = append(meta.Services, RegistrationService{Type: "mcp", Value: cfg.MCPURL})
	}
	if cfg.A2AURL != "" {
		meta.Services = append(meta.Services, RegistrationService{Type: "a2a", Value: cfg.A2AURL})
	}
	if cfg.SNS != "" {
		meta.Services = append(meta.Services, RegistrationService{Type: "sns", Value: cfg.SNS})
	}

	// Properties (file manifest)
	if meta.Image != "" {
		meta.Properties = &MetaplexProperties{
			Category: "image",
			Files: []MetaplexFile{{
				URI:  meta.Image,
				Type: "image/png",
			}},
		}
	}

	return meta
}

// PinNFTMetadata uploads NFT metadata to Private IPFS and returns the CID.
func (d *Deployer) PinNFTMetadata(ctx context.Context, cfg DeployConfig, nftMeta *MetaplexNFTMetadata) (string, error) {
	metaJSON, err := json.Marshal(nftMeta)
	if err != nil {
		return "", fmt.Errorf("deploy: marshal nft metadata: %w", err)
	}

	result, err := d.hub.UploadCrossIdentity(ctx,
		cfg.WalletAddress, cfg.GitHubUser, cfg.DeviceID,
		fmt.Sprintf("%s-nft.json", cfg.Name),
		bytes.NewReader(metaJSON),
		map[string]string{
			"type":       "nft-metadata",
			"agent_name": cfg.Name,
			"standard":   "metaplex-core",
		},
	)
	if err != nil {
		return "", fmt.Errorf("deploy: pin nft metadata: %w", err)
	}

	return result.CID, nil
}
