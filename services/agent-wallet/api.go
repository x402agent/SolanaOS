package agentwallet

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"os"
	"strings"
	"time"

	solanago "github.com/gagliardetto/solana-go"
	"github.com/gagliardetto/solana-go/programs/system"
	"github.com/gagliardetto/solana-go/rpc"
)

// Server is the agentic wallet HTTP API.
type Server struct {
	vault      *Vault
	solanaRPC  *rpc.Client
	evmClients map[int]*EVMClient // chainID → client
	privy      *PrivyClient       // Privy managed wallets (optional)
	deployer   *Deployer          // E2B sandbox deployer (optional)
	port       string
	httpSrv    *http.Server
}

// ServerConfig holds API server configuration.
type ServerConfig struct {
	Port        string
	VaultConfig VaultConfig
	SolanaRPC   string
	EVMChains   map[int]string // chainID → RPC URL
}

// DefaultServerConfig returns config from environment.
func DefaultServerConfig() ServerConfig {
	solRPC := os.Getenv("SOLANA_RPC_URL")
	if solRPC == "" {
		solRPC = os.Getenv("HELIUS_RPC_URL")
	}
	if solRPC == "" {
		solRPC = os.Getenv("SOLANA_TRACKER_RPC_URL")
	}
	if solRPC == "" {
		solRPC = "https://api.mainnet-beta.solana.com"
	}

	port := os.Getenv("WALLET_API_PORT")
	if port == "" {
		port = "8421"
	}

	// Parse EVM chains from env: EVM_CHAINS=1:https://eth-rpc.com,8453:https://base-rpc.com
	evmChains := make(map[int]string)
	if chainsEnv := os.Getenv("EVM_CHAINS"); chainsEnv != "" {
		for _, pair := range strings.Split(chainsEnv, ",") {
			parts := strings.SplitN(pair, ":", 2)
			if len(parts) == 2 {
				var chainID int
				fmt.Sscanf(parts[0], "%d", &chainID)
				if chainID > 0 {
					evmChains[chainID] = parts[1]
				}
			}
		}
	}

	// Default chains if none configured
	if len(evmChains) == 0 {
		if baseRPC := os.Getenv("BASE_RPC_URL"); baseRPC != "" {
			evmChains[8453] = baseRPC
		}
		if ethRPC := os.Getenv("ETH_RPC_URL"); ethRPC != "" {
			evmChains[1] = ethRPC
		}
	}

	return ServerConfig{
		Port:        port,
		VaultConfig: DefaultVaultConfig(),
		SolanaRPC:   solRPC,
		EVMChains:   evmChains,
	}
}

// NewServer creates the agentic wallet API server.
func NewServer(cfg ServerConfig) (*Server, error) {
	vault, err := NewVault(cfg.VaultConfig)
	if err != nil {
		return nil, fmt.Errorf("init vault: %w", err)
	}

	s := &Server{
		vault:      vault,
		solanaRPC:  rpc.New(cfg.SolanaRPC),
		evmClients: make(map[int]*EVMClient),
		privy:      NewPrivyClient(DefaultPrivyConfig()),
		deployer:   NewDeployer(),
		port:       cfg.Port,
	}

	// Initialize EVM clients
	for chainID, rpcURL := range cfg.EVMChains {
		client, err := NewEVMClient(chainID, rpcURL)
		if err != nil {
			log.Printf("[WALLET-API] ⚠️  Failed to init EVM chain %d: %v", chainID, err)
			continue
		}
		s.evmClients[chainID] = client
		log.Printf("[WALLET-API] ⛓️  EVM chain %d connected: %s", chainID, ChainName(chainID))
	}

	return s, nil
}

// Start begins serving the HTTP API.
func (s *Server) Start() error {
	mux := http.NewServeMux()

	// Wallet CRUD
	mux.HandleFunc("POST /v1/wallets", s.handleCreateWallet)
	mux.HandleFunc("GET /v1/wallets", s.handleListWallets)
	mux.HandleFunc("GET /v1/wallets/{id}", s.handleGetWallet)
	mux.HandleFunc("DELETE /v1/wallets/{id}", s.handleDeleteWallet)

	// Wallet operations
	mux.HandleFunc("GET /v1/wallets/{id}/balance", s.handleGetBalance)
	mux.HandleFunc("POST /v1/wallets/{id}/transfer", s.handleTransfer)
	mux.HandleFunc("POST /v1/wallets/{id}/sign", s.handleSign)
	mux.HandleFunc("POST /v1/wallets/{id}/pause", s.handlePause)
	mux.HandleFunc("POST /v1/wallets/{id}/unpause", s.handleUnpause)

	// EVM-specific
	mux.HandleFunc("POST /v1/wallets/{id}/transfer-token", s.handleTransferToken)
	mux.HandleFunc("POST /v1/eth-call", s.handleEthCall)

	// Chain info
	mux.HandleFunc("GET /v1/chains", s.handleGetChains)

	// E2B deployment
	mux.HandleFunc("POST /v1/deploy", s.handleDeploy)
	mux.HandleFunc("GET /v1/deployments", s.handleListDeployments)
	mux.HandleFunc("DELETE /v1/deployments/{agent_id}", s.handleTeardown)

	// Privy managed wallets (if configured)
	if s.privy != nil {
		s.RegisterPrivyRoutes(mux, s.privy)
	}

	// Health
	mux.HandleFunc("GET /v1/health", s.handleHealth)
	mux.HandleFunc("GET /", s.handleRoot)

	s.httpSrv = &http.Server{
		Addr:         ":" + s.port,
		Handler:      s.authMiddleware(mux),
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 60 * time.Second,
	}

	log.Printf("[WALLET-API] 🚀 Agent wallet API listening on :%s", s.port)
	return s.httpSrv.ListenAndServe()
}

// Stop gracefully shuts down the server.
func (s *Server) Stop(ctx context.Context) error {
	return s.httpSrv.Shutdown(ctx)
}

// ── Middleware ────────────────────────────────────────────────────

func (s *Server) authMiddleware(next http.Handler) http.Handler {
	apiKey := os.Getenv("WALLET_API_KEY")
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Skip auth for health/root
		if r.URL.Path == "/" || r.URL.Path == "/v1/health" {
			next.ServeHTTP(w, r)
			return
		}

		if apiKey != "" {
			auth := r.Header.Get("Authorization")
			if auth != "Bearer "+apiKey {
				jsonError(w, "unauthorized", http.StatusUnauthorized)
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

// ── Handlers ─────────────────────────────────────────────────────

func (s *Server) handleRoot(w http.ResponseWriter, r *http.Request) {
	jsonResp(w, map[string]any{
		"service": "nanosolana-agent-wallet",
		"version": "1.0.0",
		"chains":  []string{"solana", "evm"},
	})
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	jsonResp(w, map[string]any{
		"status":      "ok",
		"wallets":     len(s.vault.ListWallets()),
		"evm_chains":  len(s.evmClients),
		"solana_rpc":  s.solanaRPC != nil,
	})
}

type createWalletReq struct {
	Label   string `json:"label"`
	Chain   string `json:"chain"`    // "solana" or "evm"
	ChainID int    `json:"chain_id"` // EVM chain ID (ignored for Solana)
}

func (s *Server) handleCreateWallet(w http.ResponseWriter, r *http.Request) {
	var req createWalletReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	id := GenerateID()
	chainType := ChainType(req.Chain)
	if chainType == "" {
		chainType = ChainSolana
	}

	switch chainType {
	case ChainSolana:
		wallet := solanago.NewWallet()
		pk := wallet.PrivateKey
		address := wallet.PublicKey().String()

		if err := s.vault.AddWallet(id, req.Label, ChainSolana, 900, address, []byte(pk)); err != nil {
			jsonError(w, err.Error(), http.StatusInternalServerError)
			return
		}

		jsonResp(w, map[string]any{
			"id":      id,
			"address": address,
			"chain":   "solana",
			"label":   req.Label,
		})

	case ChainEVM:
		chainID := req.ChainID
		if chainID == 0 {
			chainID = 8453 // Default to Base
		}

		privKey, address, err := GenerateEVMKeypair()
		if err != nil {
			jsonError(w, "keygen failed: "+err.Error(), http.StatusInternalServerError)
			return
		}

		privBytes := privKey.D.Bytes()
		if err := s.vault.AddWallet(id, req.Label, ChainEVM, chainID, address, privBytes); err != nil {
			jsonError(w, err.Error(), http.StatusInternalServerError)
			return
		}

		jsonResp(w, map[string]any{
			"id":       id,
			"address":  address,
			"chain":    "evm",
			"chain_id": chainID,
			"label":    req.Label,
		})

	default:
		jsonError(w, "unsupported chain type: "+string(chainType), http.StatusBadRequest)
	}
}

func (s *Server) handleListWallets(w http.ResponseWriter, r *http.Request) {
	wallets := s.vault.ListWallets()
	result := make([]map[string]any, len(wallets))
	for i, wl := range wallets {
		result[i] = map[string]any{
			"id":        wl.ID,
			"label":     wl.Label,
			"chain":     wl.ChainType,
			"chain_id":  wl.ChainID,
			"address":   wl.Address,
			"paused":    wl.Paused,
			"created_at": wl.CreatedAt,
		}
	}
	jsonResp(w, result)
}

func (s *Server) handleGetWallet(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	wl, err := s.vault.GetWallet(id)
	if err != nil {
		jsonError(w, err.Error(), http.StatusNotFound)
		return
	}
	jsonResp(w, map[string]any{
		"id":        wl.ID,
		"label":     wl.Label,
		"chain":     wl.ChainType,
		"chain_id":  wl.ChainID,
		"address":   wl.Address,
		"paused":    wl.Paused,
		"created_at": wl.CreatedAt,
	})
}

func (s *Server) handleDeleteWallet(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := s.vault.DeleteWallet(id); err != nil {
		jsonError(w, err.Error(), http.StatusNotFound)
		return
	}
	jsonResp(w, map[string]any{"deleted": true})
}

func (s *Server) handleGetBalance(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	wl, err := s.vault.GetWallet(id)
	if err != nil {
		jsonError(w, err.Error(), http.StatusNotFound)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	switch wl.ChainType {
	case ChainSolana:
		pubKey, err := solanago.PublicKeyFromBase58(wl.Address)
		if err != nil {
			jsonError(w, "invalid solana address", http.StatusInternalServerError)
			return
		}
		balance, err := s.solanaRPC.GetBalance(ctx, pubKey, rpc.CommitmentFinalized)
		if err != nil {
			jsonError(w, "rpc error: "+err.Error(), http.StatusBadGateway)
			return
		}
		lamports := balance.Value
		solBalance := float64(lamports) / 1e9
		jsonResp(w, map[string]any{
			"address":  wl.Address,
			"chain":    "solana",
			"lamports": lamports,
			"sol":      solBalance,
		})

	case ChainEVM:
		chainID := wl.ChainID
		if qChain := r.URL.Query().Get("chain_id"); qChain != "" {
			fmt.Sscanf(qChain, "%d", &chainID)
		}
		client, ok := s.evmClients[chainID]
		if !ok {
			jsonError(w, fmt.Sprintf("no RPC for chain %d", chainID), http.StatusBadRequest)
			return
		}
		balance, err := client.GetBalance(ctx, wl.Address)
		if err != nil {
			jsonError(w, "rpc error: "+err.Error(), http.StatusBadGateway)
			return
		}
		// Format wei to ETH
		ethBal := new(big.Float).Quo(new(big.Float).SetInt(balance), big.NewFloat(1e18))
		jsonResp(w, map[string]any{
			"address":  wl.Address,
			"chain":    "evm",
			"chain_id": chainID,
			"wei":      balance.String(),
			"balance":  ethBal.Text('f', 18),
		})

	default:
		jsonError(w, "unsupported chain", http.StatusBadRequest)
	}
}

type transferReq struct {
	To      string `json:"to"`
	Amount  string `json:"amount"` // Human-readable (e.g. "0.1")
	ChainID int    `json:"chain_id,omitempty"`
}

func (s *Server) handleTransfer(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req transferReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	wl, err := s.vault.GetWallet(id)
	if err != nil {
		jsonError(w, err.Error(), http.StatusNotFound)
		return
	}
	if wl.Paused {
		jsonError(w, "wallet is paused", http.StatusForbidden)
		return
	}

	privKeyBytes, err := s.vault.GetPrivateKey(id)
	if err != nil {
		jsonError(w, err.Error(), http.StatusForbidden)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	switch wl.ChainType {
	case ChainSolana:
		sig, err := s.solanaTransfer(ctx, privKeyBytes, req.To, req.Amount)
		if err != nil {
			jsonError(w, err.Error(), http.StatusInternalServerError)
			return
		}
		jsonResp(w, map[string]any{
			"signature": sig,
			"from":      wl.Address,
			"to":        req.To,
			"amount":    req.Amount,
			"chain":     "solana",
		})

	case ChainEVM:
		chainID := req.ChainID
		if chainID == 0 {
			chainID = wl.ChainID
		}
		client, ok := s.evmClients[chainID]
		if !ok {
			jsonError(w, fmt.Sprintf("no RPC for chain %d", chainID), http.StatusBadRequest)
			return
		}
		txHash, err := client.Transfer(ctx, privKeyBytes, req.To, req.Amount)
		if err != nil {
			jsonError(w, err.Error(), http.StatusInternalServerError)
			return
		}
		jsonResp(w, map[string]any{
			"tx_hash":  txHash,
			"from":     wl.Address,
			"to":       req.To,
			"amount":   req.Amount,
			"chain":    "evm",
			"chain_id": chainID,
		})

	default:
		jsonError(w, "unsupported chain", http.StatusBadRequest)
	}
}

type signReq struct {
	Message string `json:"message"` // base64 or hex payload to sign
}

func (s *Server) handleSign(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req signReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	wl, err := s.vault.GetWallet(id)
	if err != nil {
		jsonError(w, err.Error(), http.StatusNotFound)
		return
	}
	if wl.Paused {
		jsonError(w, "wallet is paused", http.StatusForbidden)
		return
	}

	privKeyBytes, err := s.vault.GetPrivateKey(id)
	if err != nil {
		jsonError(w, err.Error(), http.StatusForbidden)
		return
	}

	switch wl.ChainType {
	case ChainSolana:
		pk := solanago.PrivateKey(privKeyBytes)
		sig, err := pk.Sign([]byte(req.Message))
		if err != nil {
			jsonError(w, err.Error(), http.StatusInternalServerError)
			return
		}
		jsonResp(w, map[string]any{
			"signature": sig.String(),
			"address":   wl.Address,
		})

	case ChainEVM:
		sig, err := EVMSign(privKeyBytes, []byte(req.Message))
		if err != nil {
			jsonError(w, err.Error(), http.StatusInternalServerError)
			return
		}
		jsonResp(w, map[string]any{
			"signature": sig,
			"address":   wl.Address,
		})

	default:
		jsonError(w, "unsupported chain", http.StatusBadRequest)
	}
}

func (s *Server) handlePause(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := s.vault.PauseWallet(id); err != nil {
		jsonError(w, err.Error(), http.StatusNotFound)
		return
	}
	jsonResp(w, map[string]any{"paused": true})
}

func (s *Server) handleUnpause(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := s.vault.UnpauseWallet(id); err != nil {
		jsonError(w, err.Error(), http.StatusNotFound)
		return
	}
	jsonResp(w, map[string]any{"paused": false})
}

type transferTokenReq struct {
	Token    string `json:"token"`    // Token contract address
	To       string `json:"to"`       // Recipient
	Amount   string `json:"amount"`   // Human-readable
	ChainID  int    `json:"chain_id"` // EVM chain ID
	Decimals int    `json:"decimals"` // Token decimals
}

func (s *Server) handleTransferToken(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req transferTokenReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	wl, err := s.vault.GetWallet(id)
	if err != nil {
		jsonError(w, err.Error(), http.StatusNotFound)
		return
	}
	if wl.Paused {
		jsonError(w, "wallet is paused", http.StatusForbidden)
		return
	}

	privKeyBytes, err := s.vault.GetPrivateKey(id)
	if err != nil {
		jsonError(w, err.Error(), http.StatusForbidden)
		return
	}

	chainID := req.ChainID
	if chainID == 0 {
		chainID = wl.ChainID
	}

	client, ok := s.evmClients[chainID]
	if !ok {
		jsonError(w, fmt.Sprintf("no RPC for chain %d", chainID), http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	txHash, err := client.TransferERC20(ctx, privKeyBytes, req.Token, req.To, req.Amount, req.Decimals)
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	jsonResp(w, map[string]any{
		"tx_hash":  txHash,
		"token":    req.Token,
		"to":       req.To,
		"amount":   req.Amount,
		"chain_id": chainID,
	})
}

type ethCallReq struct {
	ChainID int    `json:"chain_id"`
	To      string `json:"to"`
	Data    string `json:"data"` // hex calldata
}

func (s *Server) handleEthCall(w http.ResponseWriter, r *http.Request) {
	var req ethCallReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	client, ok := s.evmClients[req.ChainID]
	if !ok {
		jsonError(w, fmt.Sprintf("no RPC for chain %d", req.ChainID), http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	result, err := client.Call(ctx, req.To, req.Data)
	if err != nil {
		jsonError(w, err.Error(), http.StatusBadGateway)
		return
	}

	jsonResp(w, map[string]any{"result": result})
}

func (s *Server) handleGetChains(w http.ResponseWriter, r *http.Request) {
	chains := []map[string]any{
		{"chain_id": 900, "name": "Solana", "type": "solana", "native": "SOL", "decimals": 9, "active": true},
	}
	for chainID := range s.evmClients {
		chains = append(chains, map[string]any{
			"chain_id": chainID,
			"name":     ChainName(chainID),
			"type":     "evm",
			"native":   NativeToken(chainID),
			"decimals": 18,
			"active":   true,
		})
	}
	jsonResp(w, chains)
}

// ── Deployment Handlers ──────────────────────────────────────────

type deployReq struct {
	AgentID string            `json:"agent_id"`
	Env     map[string]string `json:"env,omitempty"`
}

func (s *Server) handleDeploy(w http.ResponseWriter, r *http.Request) {
	if s.deployer == nil || !s.deployer.IsConfigured() {
		jsonError(w, "E2B deployer not configured — set E2B_API_KEY", http.StatusServiceUnavailable)
		return
	}

	var req deployReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.AgentID == "" {
		req.AgentID = GenerateID()
	}

	ctx, cancel := context.WithTimeout(r.Context(), 120*time.Second)
	defer cancel()

	dep, err := s.deployer.Deploy(ctx, req.AgentID, req.Env)
	if err != nil {
		jsonError(w, "deploy failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	jsonResp(w, dep)
}

func (s *Server) handleListDeployments(w http.ResponseWriter, r *http.Request) {
	if s.deployer == nil || !s.deployer.IsConfigured() {
		jsonResp(w, []any{})
		return
	}
	jsonResp(w, s.deployer.ListDeployments())
}

func (s *Server) handleTeardown(w http.ResponseWriter, r *http.Request) {
	if s.deployer == nil || !s.deployer.IsConfigured() {
		jsonError(w, "E2B deployer not configured", http.StatusServiceUnavailable)
		return
	}

	agentID := r.PathValue("agent_id")
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	if err := s.deployer.Teardown(ctx, agentID); err != nil {
		jsonError(w, err.Error(), http.StatusNotFound)
		return
	}
	jsonResp(w, map[string]any{"torn_down": true, "agent_id": agentID})
}

// ── Solana Transfer ──────────────────────────────────────────────

func (s *Server) solanaTransfer(ctx context.Context, privKeyBytes []byte, toAddr, amount string) (string, error) {
	pk := solanago.PrivateKey(privKeyBytes)
	from := pk.PublicKey()

	to, err := solanago.PublicKeyFromBase58(toAddr)
	if err != nil {
		return "", fmt.Errorf("invalid to address: %w", err)
	}

	// Parse amount as SOL → lamports
	lamports, err := parseSOLAmount(amount)
	if err != nil {
		return "", err
	}

	recent, err := s.solanaRPC.GetLatestBlockhash(ctx, rpc.CommitmentFinalized)
	if err != nil {
		return "", fmt.Errorf("get blockhash: %w", err)
	}

	tx, err := solanago.NewTransaction(
		[]solanago.Instruction{
			system.NewTransferInstruction(lamports, from, to).Build(),
		},
		recent.Value.Blockhash,
		solanago.TransactionPayer(from),
	)
	if err != nil {
		return "", fmt.Errorf("build tx: %w", err)
	}

	_, err = tx.Sign(func(key solanago.PublicKey) *solanago.PrivateKey {
		if key.Equals(from) {
			return &pk
		}
		return nil
	})
	if err != nil {
		return "", fmt.Errorf("sign tx: %w", err)
	}

	sig, err := s.solanaRPC.SendTransaction(ctx, tx)
	if err != nil {
		return "", fmt.Errorf("send tx: %w", err)
	}

	return sig.String(), nil
}

func parseSOLAmount(amount string) (uint64, error) {
	f := new(big.Float)
	f, ok := f.SetString(amount)
	if !ok {
		return 0, fmt.Errorf("invalid amount: %s", amount)
	}
	// Multiply by 1e9 for lamports
	lamportsFloat := new(big.Float).Mul(f, big.NewFloat(1e9))
	lamportsInt, _ := lamportsFloat.Int64()
	if lamportsInt <= 0 {
		return 0, fmt.Errorf("amount must be positive")
	}
	return uint64(lamportsInt), nil
}

// ── Public Vault Accessors (for CLI one-shot bootstrap) ──────────

// ListWallets returns all wallet entries from the vault.
func (s *Server) ListWallets() []*WalletEntry {
	return s.vault.ListWallets()
}

// AddWallet stores a new wallet with encrypted private key in the vault.
func (s *Server) AddWallet(id, label string, chainType ChainType, chainID int, address string, privateKey []byte) error {
	return s.vault.AddWallet(id, label, chainType, chainID, address, privateKey)
}

// ── JSON Helpers ──────────────────────────────────────────────────

func jsonResp(w http.ResponseWriter, data any) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}

func jsonError(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
