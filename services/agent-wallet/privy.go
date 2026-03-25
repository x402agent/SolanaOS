package agentwallet

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"
)

const privyAPIBase = "https://api.privy.io/v1"

// PrivyClient manages wallets through Privy's server-side REST API.
// Privy handles key management, signing, and multi-chain support
// so agents never touch raw private keys.
//
// Auth: Basic auth with appID:appSecret + privy-app-id header.
// Docs: https://docs.privy.io/api-reference/wallets
type PrivyClient struct {
	appID          string
	appSecret      string
	authKeyID      string // PRIVY_AUTH_KEY_ID for authorization signatures
	authPrivateKey string // PRIVY_AUTH_PRIVATE_KEY for signing requests
	httpClient     *http.Client
}

// PrivyWallet represents a Privy-managed wallet.
type PrivyWallet struct {
	ID        string `json:"id"`
	Address   string `json:"address"`
	ChainType string `json:"chain_type"` // "ethereum", "solana", "base", etc.
	CreatedAt string `json:"created_at"`
}

// PrivyConfig holds Privy API credentials.
type PrivyConfig struct {
	AppID     string
	AppSecret string
}

// DefaultPrivyConfig loads from environment.
func DefaultPrivyConfig() PrivyConfig {
	return PrivyConfig{
		AppID:     os.Getenv("PRIVY_APP_ID"),
		AppSecret: os.Getenv("PRIVY_APP_SECRET"),
	}
}

// PrivyAuthConfig holds auth key config for signing requests.
type PrivyAuthConfig struct {
	KeyID      string // PRIVY_AUTH_KEY_ID
	PrivateKey string // PRIVY_AUTH_PRIVATE_KEY
}

// NewPrivyClient creates a Privy API client.
func NewPrivyClient(cfg PrivyConfig) *PrivyClient {
	if cfg.AppID == "" || cfg.AppSecret == "" {
		log.Printf("[PRIVY] ⚠️  PRIVY_APP_ID/PRIVY_APP_SECRET not set — Privy wallets disabled")
		return nil
	}
	log.Printf("[PRIVY] 🔑 Privy client initialized (app: %s)", cfg.AppID)
	return &PrivyClient{
		appID:          cfg.AppID,
		appSecret:      cfg.AppSecret,
		authKeyID:      os.Getenv("PRIVY_AUTH_KEY_ID"),
		authPrivateKey: os.Getenv("PRIVY_AUTH_PRIVATE_KEY"),
		httpClient:     &http.Client{Timeout: 30 * time.Second},
	}
}

// IsConfigured returns true if Privy credentials are set.
func (p *PrivyClient) IsConfigured() bool {
	return p != nil && p.appID != "" && p.appSecret != ""
}

// privyRequest makes an authenticated Privy API call.
// Auth: Basic auth (appID:appSecret) + privy-app-id header.
// For wallet RPC calls, also sends privy-authorization-signature if auth key is configured.
func (p *PrivyClient) privyRequest(ctx context.Context, method, path string, body any) (json.RawMessage, error) {
	var reqBody io.Reader
	if body != nil {
		data, _ := json.Marshal(body)
		reqBody = bytes.NewReader(data)
	}

	url := privyAPIBase + path
	req, err := http.NewRequestWithContext(ctx, method, url, reqBody)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("privy-app-id", p.appID)
	req.SetBasicAuth(p.appID, p.appSecret)

	// Add authorization signature header if auth key is configured
	if p.authKeyID != "" {
		req.Header.Set("privy-authorization-key-id", p.authKeyID)
	}

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("privy %s %s: %w", method, path, err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("privy HTTP %d: %s", resp.StatusCode, string(respBody))
	}

	return json.RawMessage(respBody), nil
}

// CreateWallet creates a new Privy-managed wallet.
// chainType: "ethereum", "solana", "base", "polygon", etc.
func (p *PrivyClient) CreateWallet(ctx context.Context, chainType string) (*PrivyWallet, error) {
	if chainType == "" {
		chainType = "ethereum"
	}

	body := map[string]any{
		"chain_type": chainType,
	}

	result, err := p.privyRequest(ctx, "POST", "/wallets", body)
	if err != nil {
		return nil, err
	}

	var wallet PrivyWallet
	if err := json.Unmarshal(result, &wallet); err != nil {
		return nil, fmt.Errorf("decode wallet: %w", err)
	}

	log.Printf("[PRIVY] 🆕 Wallet created: %s (%s) → %s", wallet.ID, chainType, wallet.Address)
	return &wallet, nil
}

// GetWallet retrieves a Privy wallet by ID.
func (p *PrivyClient) GetWallet(ctx context.Context, walletID string) (*PrivyWallet, error) {
	result, err := p.privyRequest(ctx, "GET", "/wallets/"+walletID, nil)
	if err != nil {
		return nil, err
	}

	var wallet PrivyWallet
	if err := json.Unmarshal(result, &wallet); err != nil {
		return nil, fmt.Errorf("decode wallet: %w", err)
	}
	return &wallet, nil
}

// ListWallets lists all Privy wallets for this app.
func (p *PrivyClient) ListWallets(ctx context.Context, chainType string) ([]PrivyWallet, error) {
	path := "/wallets"
	if chainType != "" {
		path += "?chain_type=" + chainType
	}

	result, err := p.privyRequest(ctx, "GET", path, nil)
	if err != nil {
		return nil, err
	}

	var response struct {
		Data []PrivyWallet `json:"data"`
	}
	if err := json.Unmarshal(result, &response); err != nil {
		return nil, fmt.Errorf("decode wallets: %w", err)
	}
	return response.Data, nil
}

// SignMessage signs an arbitrary message with a Privy wallet.
// For EVM: uses personal_sign RPC method.
// For Solana: uses signMessage RPC method with base64 encoding.
func (p *PrivyClient) SignMessage(ctx context.Context, walletID, message, chainType string) (string, error) {
	var body map[string]any

	if chainType == "solana" {
		// Solana: POST /v1/wallets/{id}/rpc with signMessage
		body = map[string]any{
			"chain_type": "solana",
			"method":     "signMessage",
			"params": map[string]any{
				"message":  message,
				"encoding": "base64",
			},
		}
	} else {
		// EVM: POST /v1/wallets/{id}/rpc with personal_sign
		body = map[string]any{
			"method": "personal_sign",
			"params": map[string]any{
				"message": message,
			},
		}
	}

	result, err := p.privyRequest(ctx, "POST", "/wallets/"+walletID+"/rpc", body)
	if err != nil {
		return "", err
	}

	var response struct {
		Data struct {
			Signature string `json:"signature"`
			Encoding  string `json:"encoding"`
		} `json:"data"`
	}
	if err := json.Unmarshal(result, &response); err != nil {
		return "", fmt.Errorf("decode signature: %w", err)
	}
	return response.Data.Signature, nil
}

// SendTransaction sends a transaction through Privy.
// For EVM: uses eth_sendTransaction.
// For Solana: uses signAndSendTransaction with CAIP-2 chain identifier.
func (p *PrivyClient) SendTransaction(ctx context.Context, walletID string, txReq PrivyTxRequest) (string, error) {
	var body map[string]any

	if txReq.ChainType == "solana" {
		// Solana: signAndSendTransaction with CAIP-2 identifier
		caip2 := "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp" // mainnet
		body = map[string]any{
			"method": "signAndSendTransaction",
			"caip2":  caip2,
			"params": map[string]any{
				"transaction": txReq.Data,
				"encoding":    "base64",
			},
		}
	} else {
		// EVM: eth_sendTransaction
		body = map[string]any{
			"method": "eth_sendTransaction",
			"params": map[string]any{
				"transaction": map[string]any{
					"to":    txReq.To,
					"value": txReq.Value,
					"data":  txReq.Data,
				},
			},
		}
		if txReq.ChainID > 0 {
			body["caip2"] = fmt.Sprintf("eip155:%d", txReq.ChainID)
		}
	}

	result, err := p.privyRequest(ctx, "POST", "/wallets/"+walletID+"/rpc", body)
	if err != nil {
		return "", err
	}

	var response struct {
		Data struct {
			Hash      string `json:"hash"`
			Signature string `json:"signature"`
		} `json:"data"`
	}
	if err := json.Unmarshal(result, &response); err != nil {
		return "", fmt.Errorf("decode tx result: %w", err)
	}

	// Solana returns signature, EVM returns hash
	if response.Data.Hash != "" {
		return response.Data.Hash, nil
	}
	return response.Data.Signature, nil
}

// RawSign signs a raw hash with a Privy wallet (for Bitcoin, Tron, and other Tier 2 chains).
func (p *PrivyClient) RawSign(ctx context.Context, walletID, hash string) (string, error) {
	body := map[string]any{
		"method": "raw_sign",
		"params": map[string]any{
			"hash": hash,
		},
	}

	result, err := p.privyRequest(ctx, "POST", "/wallets/"+walletID+"/rpc", body)
	if err != nil {
		return "", err
	}

	var response struct {
		Data struct {
			Signature string `json:"signature"`
		} `json:"data"`
	}
	if err := json.Unmarshal(result, &response); err != nil {
		return "", fmt.Errorf("decode signature: %w", err)
	}
	return response.Data.Signature, nil
}

// PrivyTxRequest represents a transaction to sign/send via Privy.
type PrivyTxRequest struct {
	To        string `json:"to"`
	Value     string `json:"value,omitempty"`
	Data      string `json:"data,omitempty"`
	ChainID   int    `json:"chain_id,omitempty"`
	ChainType string `json:"chain_type,omitempty"` // "ethereum" or "solana"
	GasLimit  string `json:"gas_limit,omitempty"`
}

// ── Privy API Handlers for the HTTP server ───────────────────────

// RegisterPrivyRoutes adds Privy wallet endpoints to the API server.
func (s *Server) RegisterPrivyRoutes(mux *http.ServeMux, privy *PrivyClient) {
	if privy == nil || !privy.IsConfigured() {
		return
	}

	s.privy = privy

	mux.HandleFunc("POST /v1/privy/wallets", s.handlePrivyCreateWallet)
	mux.HandleFunc("GET /v1/privy/wallets", s.handlePrivyListWallets)
	mux.HandleFunc("GET /v1/privy/wallets/{id}", s.handlePrivyGetWallet)
	mux.HandleFunc("POST /v1/privy/wallets/{id}/sign", s.handlePrivySign)
	mux.HandleFunc("POST /v1/privy/wallets/{id}/send", s.handlePrivySend)

	log.Printf("[WALLET-API] 🔑 Privy wallet routes registered")
}

func (s *Server) handlePrivyCreateWallet(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ChainType string `json:"chain_type"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	wallet, err := s.privy.CreateWallet(r.Context(), req.ChainType)
	if err != nil {
		jsonError(w, err.Error(), http.StatusBadGateway)
		return
	}
	jsonResp(w, wallet)
}

func (s *Server) handlePrivyListWallets(w http.ResponseWriter, r *http.Request) {
	chainType := r.URL.Query().Get("chain_type")
	wallets, err := s.privy.ListWallets(r.Context(), chainType)
	if err != nil {
		jsonError(w, err.Error(), http.StatusBadGateway)
		return
	}
	jsonResp(w, wallets)
}

func (s *Server) handlePrivyGetWallet(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	wallet, err := s.privy.GetWallet(r.Context(), id)
	if err != nil {
		jsonError(w, err.Error(), http.StatusBadGateway)
		return
	}
	jsonResp(w, wallet)
}

func (s *Server) handlePrivySign(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req struct {
		Message   string `json:"message"`
		ChainType string `json:"chain_type"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	sig, err := s.privy.SignMessage(r.Context(), id, req.Message, req.ChainType)
	if err != nil {
		jsonError(w, err.Error(), http.StatusBadGateway)
		return
	}
	jsonResp(w, map[string]string{"signature": sig})
}

func (s *Server) handlePrivySend(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var txReq PrivyTxRequest
	json.NewDecoder(r.Body).Decode(&txReq)

	hash, err := s.privy.SendTransaction(r.Context(), id, txReq)
	if err != nil {
		jsonError(w, err.Error(), http.StatusBadGateway)
		return
	}
	jsonResp(w, map[string]string{"tx_hash": hash})
}
