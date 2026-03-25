// Package x402 integrates the x402 payment protocol into MawdBot.
//
// x402 is a standard for paywalled HTTP endpoints using crypto payments.
// This package wraps github.com/mark3labs/x402-go to provide:
//
//   - Solana USDC payment support via the agent's agentic wallet
//   - Multi-chain payment requirements (Solana + Base + Polygon)
//   - x402 middleware for MawdBot's HTTP endpoints
//   - Payment client for consuming x402-gated APIs
//   - Facilitator proxy that runs alongside the daemon
//
// On daemon startup, MawdBot initializes the x402 subsystem:
//  1. Creates an SVM signer from the agent's Solana wallet
//  2. Configures USDC payment requirements (Solana mainnet)
//  3. Starts the facilitator proxy (connects to facilitator.x402.rs)
//  4. Creates a payment-aware HTTP client for agent API calls
package x402

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/mark3labs/x402-go"
	x402http "github.com/mark3labs/x402-go/http"
	"github.com/mark3labs/x402-go/signers/svm"

	mawdsolana "github.com/x402agent/Solana-Os-Go/pkg/solana"
)

// ── Constants ────────────────────────────────────────────────────────

const (
	// DefaultFacilitatorURL is the public x402 facilitator endpoint.
	DefaultFacilitatorURL = "https://facilitator.x402.rs"

	// DefaultFacilitatorProxyPort is the local facilitator proxy port.
	DefaultFacilitatorProxyPort = 18403

	// DefaultPaywallPort is the port for the local x402 paywall server.
	DefaultPaywallPort = 18402

	// DefaultPaymentAmount is the default USDC amount per API call.
	DefaultPaymentAmount = "0.001" // $0.001 per call
)

// ── X402 Service ─────────────────────────────────────────────────────

// Service manages the x402 payment subsystem for MawdBot.
type Service struct {
	mu               sync.RWMutex
	wallet           *mawdsolana.Wallet
	svmSigner        *svm.Signer
	paymentClient    *x402http.Client
	facilitatorURL   string
	upstreamURL      string
	authorization    string
	recipientAddress string
	network          string
	proxyServer      *http.Server
	paywallServer    *http.Server
	requirements     []x402.PaymentRequirement
	proxyRunning     bool
	paywallRunning   bool
}

// Config holds x402 configuration.
type Config struct {
	// FacilitatorURL is the facilitator endpoint (default: facilitator.x402.rs)
	FacilitatorURL string

	// FacilitatorAuthorization is an optional Authorization header sent to upstream facilitator
	FacilitatorAuthorization string

	// ProxyEnabled starts a local facilitator proxy exposing /supported,/verify,/settle
	ProxyEnabled bool

	// ProxyPort is the bind port for local facilitator proxy (default: 18403)
	ProxyPort int

	// RecipientAddress is the wallet that receives payments (default: agent wallet)
	RecipientAddress string

	// PaymentAmount is the USDC amount per API call (default: "0.001")
	PaymentAmount string

	// Network is the blockchain network ("solana" or "solana-devnet")
	Network string

	// PaywallPort is the port for the local x402 paywall server (default: 18402)
	PaywallPort int

	// PaywallEnabled enables the local paywall HTTP server
	PaywallEnabled bool

	// Chains configures which chains to accept payments on
	Chains []x402.ChainConfig
}

// DefaultConfig returns a config with sensible defaults.
func DefaultConfig() Config {
	return Config{
		FacilitatorURL: DefaultFacilitatorURL,
		ProxyEnabled:   true,
		ProxyPort:      DefaultFacilitatorProxyPort,
		PaymentAmount:  DefaultPaymentAmount,
		Network:        "solana",
		PaywallPort:    DefaultPaywallPort,
		PaywallEnabled: false,
		Chains:         []x402.ChainConfig{x402.SolanaMainnet},
	}
}

// ConfigFromEnv loads x402 config from environment variables.
func ConfigFromEnv() Config {
	cfg := DefaultConfig()

	if url := os.Getenv("X402_FACILITATOR_URL"); url != "" {
		cfg.FacilitatorURL = url
	}
	if auth := os.Getenv("X402_FACILITATOR_AUTHORIZATION"); auth != "" {
		cfg.FacilitatorAuthorization = auth
	}
	if v := os.Getenv("X402_PROXY_ENABLED"); v != "" {
		cfg.ProxyEnabled = parseBool(v, cfg.ProxyEnabled)
	}
	if v := os.Getenv("X402_PROXY_PORT"); v != "" {
		if port, err := strconv.Atoi(v); err == nil && port > 0 {
			cfg.ProxyPort = port
		}
	}
	if addr := os.Getenv("X402_RECIPIENT_ADDRESS"); addr != "" {
		cfg.RecipientAddress = addr
	}
	if amt := os.Getenv("X402_PAYMENT_AMOUNT"); amt != "" {
		cfg.PaymentAmount = amt
	}
	if net := os.Getenv("X402_NETWORK"); net != "" {
		cfg.Network = net
	}
	if os.Getenv("X402_PAYWALL_ENABLED") == "true" || os.Getenv("X402_PAYWALL_ENABLED") == "1" {
		cfg.PaywallEnabled = true
	}
	if v := os.Getenv("X402_PAYWALL_PORT"); v != "" {
		if port, err := strconv.Atoi(v); err == nil && port > 0 {
			cfg.PaywallPort = port
		}
	}

	// Multi-chain support from env
	chains := os.Getenv("X402_CHAINS")
	if chains != "" {
		cfg.Chains = ParseChains(chains)
	}

	return cfg
}

func parseBool(in string, def bool) bool {
	switch strings.ToLower(strings.TrimSpace(in)) {
	case "1", "true", "yes", "on":
		return true
	case "0", "false", "no", "off":
		return false
	default:
		return def
	}
}

// ── New ──────────────────────────────────────────────────────────────

// NewService creates a new x402 payment service using the agent's wallet.
func NewService(wallet *mawdsolana.Wallet, cfg Config) (*Service, error) {
	if wallet == nil || wallet.IsReadOnly() {
		return nil, fmt.Errorf("x402: wallet required (cannot be read-only)")
	}

	if strings.TrimSpace(cfg.FacilitatorURL) == "" {
		cfg.FacilitatorURL = DefaultFacilitatorURL
	}
	if strings.TrimSpace(cfg.PaymentAmount) == "" {
		cfg.PaymentAmount = DefaultPaymentAmount
	}
	if cfg.ProxyPort <= 0 {
		cfg.ProxyPort = DefaultFacilitatorProxyPort
	}
	if cfg.PaywallPort <= 0 {
		cfg.PaywallPort = DefaultPaywallPort
	}
	if len(cfg.Chains) == 0 {
		cfg.Chains = []x402.ChainConfig{x402.SolanaMainnet}
	}

	recipientAddr := cfg.RecipientAddress
	if recipientAddr == "" {
		recipientAddr = wallet.PublicKeyStr()
	}

	// Determine chain config based on network
	var chain x402.ChainConfig
	switch cfg.Network {
	case "solana", "mainnet":
		chain = x402.SolanaMainnet
	case "solana-devnet", "devnet":
		chain = x402.SolanaDevnet
	default:
		chain = x402.SolanaMainnet
	}

	// Create USDC token config for the SVM signer
	token := x402.NewUSDCTokenConfig(chain, 1) // Priority 1 (highest)

	// Create SVM signer from agent wallet's keygen file
	walletKeyPath := wallet.KeyPath()
	var signerOpts []svm.SignerOption

	if walletKeyPath != "" {
		signerOpts = append(signerOpts, svm.WithKeygenFile(walletKeyPath))
	} else {
		// Fallback: export private key as base58
		privKeyB58 := wallet.PrivateKeyBase58()
		if privKeyB58 == "" {
			return nil, fmt.Errorf("x402: cannot extract private key from wallet")
		}
		signerOpts = append(signerOpts, svm.WithPrivateKey(privKeyB58))
	}

	signerOpts = append(signerOpts,
		svm.WithNetwork(chain.NetworkID),
		svm.WithToken(token.Address, token.Symbol, token.Decimals),
	)

	svmSigner, err := svm.NewSigner(signerOpts...)
	if err != nil {
		return nil, fmt.Errorf("x402: svm signer: %w", err)
	}

	// Build payment requirements for all configured chains
	var requirements []x402.PaymentRequirement
	for _, c := range cfg.Chains {
		req, err := x402.NewUSDCPaymentRequirement(x402.USDCRequirementConfig{
			Chain:            c,
			Amount:           cfg.PaymentAmount,
			RecipientAddress: recipientAddr,
			Description:      "MawdBot API access",
		})
		if err != nil {
			log.Printf("[X402] ⚠️ Failed to create requirement for %s: %v", c.NetworkID, err)
			continue
		}
		requirements = append(requirements, req)
	}

	// Create payment-aware HTTP client
	paymentClient, err := x402http.NewClient(x402http.WithSigner(svmSigner))
	if err != nil {
		return nil, fmt.Errorf("x402: http client: %w", err)
	}

	svc := &Service{
		wallet:           wallet,
		svmSigner:        svmSigner,
		paymentClient:    paymentClient,
		facilitatorURL:   cfg.FacilitatorURL,
		upstreamURL:      cfg.FacilitatorURL,
		authorization:    cfg.FacilitatorAuthorization,
		recipientAddress: recipientAddr,
		network:          cfg.Network,
		requirements:     requirements,
	}

	if cfg.ProxyEnabled {
		if svc.startFacilitatorProxy(cfg.ProxyPort) {
			svc.facilitatorURL = fmt.Sprintf("http://127.0.0.1:%d", cfg.ProxyPort)
		}
	}

	// Optionally start the local paywall server
	if cfg.PaywallEnabled {
		svc.startPaywallServer(cfg.PaywallPort)
	}

	return svc, nil
}

// ── Public API ───────────────────────────────────────────────────────

// Client returns the payment-aware HTTP client.
// Use this to make requests to x402-gated APIs — payments happen automatically.
func (s *Service) Client() *x402http.Client {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.paymentClient
}

// Requirements returns the configured payment requirements.
func (s *Service) Requirements() []x402.PaymentRequirement {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.requirements
}

// Middleware returns x402 middleware for protecting HTTP endpoints.
func (s *Service) Middleware() func(http.Handler) http.Handler {
	config := &x402http.Config{
		FacilitatorURL:           s.facilitatorURL,
		FacilitatorAuthorization: s.authorization,
		PaymentRequirements:      s.requirements,
	}
	return x402http.NewX402Middleware(config)
}

// FacilitatorURL returns the configured facilitator URL.
func (s *Service) FacilitatorURL() string {
	return s.facilitatorURL
}

// SignerAddress returns the SVM signer's public key.
func (s *Service) SignerAddress() string {
	if s.svmSigner != nil {
		return s.svmSigner.Address()
	}
	return ""
}

// NetworkID returns the configured network identifier.
func (s *Service) NetworkID() string {
	return s.network
}

// Status returns a human-readable status string.
func (s *Service) Status() string {
	s.mu.RLock()
	defer s.mu.RUnlock()

	chains := make([]string, 0, len(s.requirements))
	for _, r := range s.requirements {
		chains = append(chains, r.Network)
	}

	return fmt.Sprintf("x402 Payment Gateway\n"+
		"  Facilitator: %s\n"+
		"  Upstream: %s\n"+
		"  Recipient: %s\n"+
		"  Signer: %s\n"+
		"  Chains: %s\n"+
		"  Requirements: %d\n"+
		"  FacilitatorProxy: %v\n"+
		"  Paywall: %v",
		s.facilitatorURL,
		s.upstreamURL,
		s.recipientAddress,
		s.SignerAddress(),
		strings.Join(chains, ", "),
		len(s.requirements),
		s.proxyRunning,
		s.paywallRunning,
	)
}

func (s *Service) startFacilitatorProxy(port int) bool {
	target, err := url.Parse(s.upstreamURL)
	if err != nil {
		log.Printf("[X402] ⚠️ Invalid facilitator upstream URL %q: %v", s.upstreamURL, err)
		return false
	}

	proxy := httputil.NewSingleHostReverseProxy(target)
	originalDirector := proxy.Director
	proxy.Director = func(req *http.Request) {
		originalDirector(req)
		if s.authorization != "" && req.Header.Get("Authorization") == "" {
			req.Header.Set("Authorization", s.authorization)
		}
		req.Header.Set("X-MawdBot-Facilitator-Proxy", "1")
	}
	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, proxyErr error) {
		log.Printf("[X402] ⚠️ Facilitator proxy upstream error: %v", proxyErr)
		http.Error(w, "facilitator upstream unavailable", http.StatusBadGateway)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		allowed := map[string]string{
			"/supported": http.MethodGet,
			"/verify":    http.MethodPost,
			"/settle":    http.MethodPost,
		}

		expectedMethod, ok := allowed[r.URL.Path]
		if !ok {
			http.NotFound(w, r)
			return
		}
		if r.Method != expectedMethod {
			w.Header().Set("Allow", expectedMethod)
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		proxy.ServeHTTP(w, r)
	})

	bindAddr := fmt.Sprintf("127.0.0.1:%d", port)
	listener, err := net.Listen("tcp", bindAddr)
	if err != nil {
		log.Printf("[X402] ⚠️ Facilitator proxy bind error on %s: %v", bindAddr, err)
		return false
	}

	s.proxyServer = &http.Server{
		Addr:         bindAddr,
		Handler:      mux,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	go func() {
		s.mu.Lock()
		s.proxyRunning = true
		s.mu.Unlock()

		log.Printf("[X402] 🧭 Facilitator proxy listening on http://%s", bindAddr)
		log.Printf("[X402]    Upstream facilitator: %s", s.upstreamURL)

		if err := s.proxyServer.Serve(listener); err != nil && err != http.ErrServerClosed {
			log.Printf("[X402] ⚠️ Facilitator proxy error: %v", err)
		}

		s.mu.Lock()
		s.proxyRunning = false
		s.mu.Unlock()
	}()

	return true
}

// ── Paywall Server ───────────────────────────────────────────────────
// A local HTTP server that gates MawdBot's API endpoints with x402.

func (s *Service) startPaywallServer(port int) {
	mux := http.NewServeMux()

	// Paywall-protected endpoints
	middleware := s.Middleware()

	// Health — free
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok","service":"solanaos-x402"}`))
	})

	// x402 info — free
	mux.HandleFunc("/x402/info", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"facilitator":"%s","recipient":"%s","network":"%s","chains":%d}`,
			s.facilitatorURL, s.recipientAddress, s.network, len(s.requirements))
	})

	// Trading signals — paywalled
	mux.Handle("/api/signals", middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"signals":[],"status":"premium","note":"MawdBot trading signals - x402 payment verified"}`))
	})))

	// Research reports — paywalled
	mux.Handle("/api/research", middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"reports":[],"status":"premium","note":"MawdBot research data - x402 payment verified"}`))
	})))

	// Agent status — paywalled
	mux.Handle("/api/agent", middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"wallet":"%s","network":"%s","status":"active"}`,
			s.recipientAddress, s.network)
	})))

	s.paywallServer = &http.Server{
		Addr:         fmt.Sprintf(":%d", port),
		Handler:      mux,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	go func() {
		s.mu.Lock()
		s.paywallRunning = true
		s.mu.Unlock()

		log.Printf("[X402] 💰 Paywall server starting on :%d", port)
		log.Printf("[X402]    Facilitator: %s", s.facilitatorURL)
		log.Printf("[X402]    Recipient: %s", s.recipientAddress)
		log.Printf("[X402]    Chains: %d configured", len(s.requirements))

		if err := s.paywallServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Printf("[X402] ⚠️ Paywall server error: %v", err)
		}

		s.mu.Lock()
		s.paywallRunning = false
		s.mu.Unlock()
	}()
}

// Stop gracefully stops the paywall server.
func (s *Service) Stop(ctx context.Context) error {
	var errs []error

	if s.proxyServer != nil {
		log.Println("[X402] Stopping facilitator proxy...")
		if err := s.proxyServer.Shutdown(ctx); err != nil {
			err = fmt.Errorf("shutdown facilitator proxy: %w", err)
			errs = append(errs, err)
		}
	}

	if s.paywallServer != nil {
		log.Println("[X402] Stopping paywall server...")
		if err := s.paywallServer.Shutdown(ctx); err != nil {
			err = fmt.Errorf("shutdown paywall server: %w", err)
			errs = append(errs, err)
		}
	}

	return errors.Join(errs...)
}

// ── Helpers ──────────────────────────────────────────────────────────

func ParseChains(csv string) []x402.ChainConfig {
	parts := strings.Split(csv, ",")
	var chains []x402.ChainConfig

	chainMap := map[string]x402.ChainConfig{
		"solana":         x402.SolanaMainnet,
		"solana-devnet":  x402.SolanaDevnet,
		"base":           x402.BaseMainnet,
		"base-sepolia":   x402.BaseSepolia,
		"polygon":        x402.PolygonMainnet,
		"polygon-amoy":   x402.PolygonAmoy,
		"avalanche":      x402.AvalancheMainnet,
		"avalanche-fuji": x402.AvalancheFuji,
	}

	for _, part := range parts {
		name := strings.TrimSpace(strings.ToLower(part))
		if cfg, ok := chainMap[name]; ok {
			chains = append(chains, cfg)
		}
	}

	if len(chains) == 0 {
		return []x402.ChainConfig{x402.SolanaMainnet}
	}
	return chains
}
