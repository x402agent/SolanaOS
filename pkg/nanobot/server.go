// Package nanobot provides the interactive SolanaOS Control UI server.
//
// Serves a local web UI on localhost that provides:
//   - Animated SolanaOS assistant you can talk to
//   - Real-time system status (wallet, OODA, pet)
//   - Feature dashboard with all capabilities
//   - Chat interface for interacting with the agent
//   - One-click access to all solanaos commands
package nanobot

import (
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"io/fs"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/x402agent/Solana-Os-Go/pkg/agent"
	"github.com/x402agent/Solana-Os-Go/pkg/autoreply"
	"github.com/x402agent/Solana-Os-Go/pkg/config"
	"github.com/x402agent/Solana-Os-Go/pkg/llm"
	"github.com/x402agent/Solana-Os-Go/pkg/memory"
	"github.com/x402agent/Solana-Os-Go/pkg/solana"
)

//go:embed ui/*
var uiFS embed.FS

// Server is the SolanaOS Control local UI server.
type Server struct {
	port     int
	binary   string // path to solanaos binary
	host     string
	open     bool
	logf     func(string, ...any)
	llm      *llm.Client
	recorder *memory.RecursiveRecorder
}

// NewServer creates a SolanaOS Control UI server.
func NewServer(port int, binary string) *Server {
	return NewServerWithOptions(port, binary, "127.0.0.1", true)
}

// NewServerWithOptions creates a SolanaOS Control UI server with bind/open controls.
func NewServerWithOptions(port int, binary, host string, openBrowser bool) *Server {
	if port == 0 {
		port = 7777
	}
	if strings.TrimSpace(host) == "" {
		host = "127.0.0.1"
	}
	return &Server{
		port:   port,
		binary: binary,
		host:   host,
		open:   openBrowser,
		logf:   func(f string, a ...any) { fmt.Fprintf(os.Stderr, "[solanaos-control] "+f+"\n", a...) },
		llm:    llm.New(),
	}
}

// Start serves the SolanaOS Control UI and opens the browser.
func (s *Server) Start(ctx context.Context) error {
	mux := http.NewServeMux()

	// Serve embedded UI files
	uiContent, err := fs.Sub(uiFS, "ui")
	if err != nil {
		return fmt.Errorf("embed ui: %w", err)
	}
	mux.Handle("/", http.FileServer(http.FS(uiContent)))

	// Auth endpoints
	mux.HandleFunc("/login", s.handleLogin)
	mux.HandleFunc("/auth/telegram", s.handleTelegramAuth)
	mux.HandleFunc("/auth/logout", s.handleLogout)

	// API endpoints
	mux.HandleFunc("/api/status", s.handleStatus)
	mux.HandleFunc("/api/run", s.handleRun)
	mux.HandleFunc("/api/chat", s.handleChat)
	mux.HandleFunc("/api/miner", s.handleMiner)

	// Wallet API (best-effort — won't fail if Helius not configured)
	if walletAPI, err := NewWalletAPI(); err == nil {
		walletAPI.Register(mux)
		s.logf("💰 Wallet API enabled: %s", walletAPI.wallet.ShortKey(4))
	} else {
		s.logf("⚠️ Wallet API disabled: %v", err)
	}

	addr := fmt.Sprintf("%s:%d", s.host, s.port)
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		return fmt.Errorf("listen %s: %w", addr, err)
	}

	srv := &http.Server{Handler: requireAuth(mux)}
	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		_ = srv.Shutdown(shutdownCtx)
	}()

	publicHost := s.host
	if publicHost == "0.0.0.0" {
		publicHost = "127.0.0.1"
	}
	url := fmt.Sprintf("http://%s:%d", publicHost, s.port)
	s.logf("🤖 SolanaOS Control: %s", url)

	// Open in browser
	if s.open {
		go func() {
			time.Sleep(200 * time.Millisecond)
			openBrowser(url)
		}()
	}

	return srv.Serve(ln)
}

// Port returns the configured port.
func (s *Server) Port() int { return s.port }

// handleStatus returns system status JSON.
func (s *Server) handleStatus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	cfg, _ := config.Load()
	workspacePath := config.DefaultWorkspacePath()

	status := map[string]any{
		"agent":          "SolanaOS",
		"version":        "2.0.0",
		"platform":       runtime.GOOS + "/" + runtime.GOARCH,
		"binary":         s.binary,
		"time":           time.Now().UTC().Format(time.RFC3339),
		"uptime":         "running",
		"status":         "ready",
		"daemon":         "stopped",
		"oodaMode":       "",
		"watchlist":      []string{},
		"watchlistCount": 0,
		"intervalSec":    0,
		"network":        "",
		"rpcConfigured":  false,
		"wallet":         "not configured",
	}
	if cfg != nil {
		status["network"] = cfg.Solana.HeliusNetwork
		status["oodaMode"] = cfg.OODA.Mode
		status["watchlist"] = cfg.OODA.Watchlist
		status["watchlistCount"] = len(cfg.OODA.Watchlist)
		status["intervalSec"] = cfg.OODA.IntervalSeconds
		status["rpcConfigured"] = strings.TrimSpace(cfg.Solana.HeliusRPCURL) != ""
		if cfg.Solana.WalletPubkey != "" {
			status["configuredWalletPubkey"] = cfg.Solana.WalletPubkey
		}
	}

	heartbeatPath := filepath.Join(workspacePath, "HEARTBEAT.md")
	if data, err := os.ReadFile(heartbeatPath); err == nil {
		status["heartbeat"] = string(data)
		if info, statErr := os.Stat(heartbeatPath); statErr == nil {
			status["heartbeatUpdatedAt"] = info.ModTime().UTC().Format(time.RFC3339)
			if time.Since(info.ModTime()) <= 10*time.Minute {
				status["daemon"] = "alive"
				status["status"] = "daemon alive"
			} else {
				status["daemon"] = "stale"
				status["status"] = "heartbeat stale"
			}
		} else {
			status["daemon"] = "alive"
			status["status"] = "daemon alive"
		}
	} else {
		status["daemon"] = "stopped"
	}

	walletPath := filepath.Join(config.DefaultHome(), "wallet", "agent-wallet.json")
	keyPath := ""
	if cfg != nil {
		keyPath = cfg.Solana.WalletKeyPath
	}
	wallet, err := solana.WalletFromEnvOrFile(keyPath)
	if err == nil && wallet != nil {
		status["wallet"] = "configured"
		status["walletAddress"] = wallet.PublicKeyStr()
		if keyPath != "" {
			status["walletPath"] = keyPath
		} else {
			home, _ := os.UserHomeDir()
			defaultPath := filepath.Join(home, ".config", "solana", "id.json")
			if _, statErr := os.Stat(defaultPath); statErr == nil {
				status["walletPath"] = defaultPath
			}
		}
	} else if _, statErr := os.Stat(walletPath); statErr == nil {
		status["wallet"] = "configured"
		status["walletPath"] = walletPath
	} else {
		status["wallet"] = "not configured"
	}

	if snapshot, err := agent.LoadRuntimeSnapshot(); err == nil && snapshot != nil {
		status["recentTrades"] = snapshot.RecentTrades
		status["openPositions"] = snapshot.OpenPositions
		status["cycleCount"] = snapshot.CycleCount
		status["actionableWatchlistCount"] = snapshot.ActionableWatchlistCount
		status["tradeReadiness"] = snapshot.TradeReadiness
		status["openPositionCount"] = snapshot.OpenPositionCount
		status["closedTradeCount"] = snapshot.ClosedTradeCount
		status["swapSlippageBps"] = snapshot.SwapSlippageBps
		status["minReserveSOL"] = snapshot.MinReserveSOL
		status["runtimeUpdatedAt"] = snapshot.UpdatedAt
		status["tradeBlockers"] = snapshot.TradeBlockers
		if snapshot.Mode != "" {
			status["oodaMode"] = snapshot.Mode
		}
		if snapshot.WalletAddress != "" {
			status["walletAddress"] = snapshot.WalletAddress
		}
		status["walletBalanceSOL"] = snapshot.WalletSOL
	}

	json.NewEncoder(w).Encode(status)
}

// handleRun executes a solanaos CLI command and returns output.
func (s *Server) handleRun(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	if r.Method == "OPTIONS" {
		w.Header().Set("Access-Control-Allow-Methods", "POST")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		return
	}

	var req struct {
		Command string `json:"command"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"bad request"}`, 400)
		return
	}

	// Only allow safe commands
	allowed := map[string]bool{
		"version": true, "solana health": true, "solana balance": true,
		"solana wallet": true, "solana trending": true, "solana registry": true,
		"pet": true, "status": true, "solana register": true,
	}
	cmd := strings.TrimSpace(req.Command)
	if !allowed[cmd] {
		json.NewEncoder(w).Encode(map[string]any{
			"output": fmt.Sprintf("⚠️ Command '%s' not available in UI mode. Use the terminal for full access.", cmd),
			"ok":     false,
		})
		return
	}

	args := strings.Fields(cmd)
	out, err := exec.CommandContext(r.Context(), s.binary, args...).CombinedOutput()
	result := map[string]any{
		"output": string(out),
		"ok":     err == nil,
	}
	json.NewEncoder(w).Encode(result)
}

// handleChat processes a chat message and returns SolanaOS Control's response.
func (s *Server) handleChat(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	if r.Method == "OPTIONS" {
		w.Header().Set("Access-Control-Allow-Methods", "POST")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		return
	}

	var req struct {
		Message   string `json:"message"`
		SessionID string `json:"session_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"bad request"}`, 400)
		return
	}

	msg := strings.TrimSpace(req.Message)
	msg = autoreply.SanitizeInboundUserText(msg)
	if msg == "" {
		http.Error(w, `{"error":"empty message"}`, 400)
		return
	}

	sessionID := req.SessionID
	if sessionID == "" {
		sessionID = "web"
	}
	sessionID = "web:" + sessionID
	s.captureTurn(memory.CaptureTurnInput{
		SessionID: sessionID,
		Role:      "user",
		Channel:   "web",
		ChatID:    sessionID,
		Content:   msg,
	})

	var reply string
	if s.llm.IsConfigured() {
		ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
		defer cancel()
		contextStr := ""
		if cfg, err := config.Load(); err == nil && cfg != nil {
			contextStr = agent.BuildLiveContext(ctx, cfg)
		}
		var err error
		reply, err = s.llm.Chat(ctx, sessionID, msg, contextStr)
		if err != nil {
			reply = "⚠️ LLM error: " + err.Error()
		}
	} else {
		reply = nanobotReply(strings.ToLower(msg))
	}
	reply = autoreply.VisibleAssistantText(reply)
	s.captureTurn(memory.CaptureTurnInput{
		SessionID: sessionID,
		Role:      "assistant",
		Channel:   "web",
		ChatID:    sessionID,
		Content:   reply,
		Provider:  s.replyProvider(),
		Model:     s.llm.Model(),
	})

	json.NewEncoder(w).Encode(map[string]any{
		"reply":    reply,
		"response": reply,
		"mood":     "happy",
	})
}

func (s *Server) captureTurn(input memory.CaptureTurnInput) {
	rec := s.ensureRecorder()
	if rec == nil {
		return
	}
	if _, err := rec.CaptureTurn(input); err != nil {
		s.logf("⚠️ memory capture failed: %v", err)
	}
}

func (s *Server) ensureRecorder() *memory.RecursiveRecorder {
	if s.recorder != nil {
		return s.recorder
	}
	cfg, err := config.Load()
	if err != nil || cfg == nil {
		return nil
	}
	s.recorder = memory.NewRecursiveRecorder(
		filepath.Join(config.DefaultWorkspacePath(), "vault"),
		cfg.Convex.URL,
		cfg.Convex.DeployKey,
	)
	if err := s.recorder.Init(); err != nil {
		s.logf("⚠️ recorder init failed: %v", err)
		return nil
	}
	return s.recorder
}

func (s *Server) replyProvider() string {
	if !s.llm.IsConfigured() {
		return "fallback"
	}
	last := strings.TrimSpace(s.llm.LastResolvedClient())
	if last != "" {
		return last
	}
	return s.llm.Provider()
}

// nanobotReply is the keyword fallback when no LLM key is configured.
func nanobotReply(msg string) string {
	switch {
	case strings.Contains(msg, "hello") || strings.Contains(msg, "hi") || strings.Contains(msg, "hey"):
		return "Hey! 🤖 SolanaOS online. Ask me about trades, wallet, OODA, Hyperliquid, Aster, or Pump.fun."
	case strings.Contains(msg, "trade") || strings.Contains(msg, "swap"):
		return "📈 OODA loop handles autonomous trades via Jupiter Ultra. Ask about a specific token or check /trending."
	case strings.Contains(msg, "wallet") || strings.Contains(msg, "balance"):
		return "💰 Wallet tab shows live balance. Set HELIUS_RPC_URL for on-chain data."
	case strings.Contains(msg, "ooda"):
		return "🔄 OODA: Observe → Orient → Decide → Act. Runs every 60s in live mode. Impulse buys enabled at 20% probability per cycle."
	case strings.Contains(msg, "help"):
		return "Commands: trade • wallet • status • ooda • trending • pet. Or just ask naturally!"
	default:
		return "🤖 Set ANTHROPIC_API_KEY, OPENROUTER_API_KEY, XAI_API_KEY, or OLLAMA_MODEL for natural language. Currently in fallback mode."
	}
}

func openBrowser(url string) {
	switch runtime.GOOS {
	case "darwin":
		_ = exec.Command("open", url).Start()
	case "linux":
		_ = exec.Command("xdg-open", url).Start()
	case "windows":
		_ = exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()
	}
}

func (s *Server) handleMiner(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	if r.Method == http.MethodOptions {
		return
	}
	w.Header().Set("Content-Type", "application/json")

	cfg, _ := config.Load()

	host := ""
	if cfg != nil && cfg.Bitaxe.Enabled && cfg.Bitaxe.Host != "" {
		host = cfg.Bitaxe.Host
	}
	if h := r.URL.Query().Get("host"); h != "" {
		host = h
	}
	if host == "" {
		json.NewEncoder(w).Encode(map[string]any{"online": false, "error": "bitaxe not configured"})
		return
	}

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get("http://" + host + "/api/system/info")
	if err != nil {
		json.NewEncoder(w).Encode(map[string]any{"online": false, "host": host, "error": err.Error()})
		return
	}
	defer resp.Body.Close()

	var data map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		json.NewEncoder(w).Encode(map[string]any{"online": false, "error": "decode: " + err.Error()})
		return
	}
	data["online"] = true
	data["host"] = host
	json.NewEncoder(w).Encode(data)
}
