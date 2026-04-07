// SolanaOS Control — web-based dashboard and agent control.
// Adapted from PicoClaw's web launcher — serves embedded frontend,
// provides API for config management and gateway control.
//
// Usage:
//   go build -o solanaos-web ./web/backend/
//   ./solanaos-web [config.json]
//   ./solanaos-web -public config.json

package main

import (
	"encoding/base64"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	neturl "net/url"
	"os"
	"os/exec"
	"path/filepath"
	"path"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/x402agent/Solana-Os-Go/pkg/agent"
	"github.com/x402agent/Solana-Os-Go/pkg/config"
	"github.com/x402agent/Solana-Os-Go/pkg/controlapi"
	gatewaypkg "github.com/x402agent/Solana-Os-Go/pkg/gateway"
	"github.com/x402agent/Solana-Os-Go/pkg/nanobot"
	"github.com/x402agent/Solana-Os-Go/pkg/solana"
)

const banner = `
  ╔══════════════════════════════════════════════╗
  ║        🖥️ SolanaOS Control Console            ║
  ║     Solana-native operator dashboard         ║
  ╚══════════════════════════════════════════════╝`

type setupCodeResponse struct {
	Code      string `json:"code"`
	ExpiresAt string `json:"expiresAt"`
	URL       string `json:"url"`
	Host      string `json:"host,omitempty"`
	Port      string `json:"port,omitempty"`
	TLS       bool   `json:"tls"`
	Token     string `json:"token,omitempty"`
	Password  string `json:"password,omitempty"`
}

type setupCodePayload struct {
	URL      string `json:"url"`
	Token    string `json:"token,omitempty"`
	Password string `json:"password,omitempty"`
}

type setupDownloadsResponse struct {
	GitHubRepo     string            `json:"githubRepo"`
	GitHubReleases string            `json:"githubReleases"`
	NpmPackage     string            `json:"npmPackage"`
	Android        map[string]string `json:"android"`
	Gateway        map[string]string `json:"gateway"`
	Runtime        map[string]string `json:"runtime"`
	Web            map[string]string `json:"web"`
}

type publicSupabaseConfig struct {
	Configured    bool   `json:"configured"`
	URL           string `json:"url,omitempty"`
	AnonKey       string `json:"anonKey,omitempty"`
	StorageBucket string `json:"storageBucket,omitempty"`
}

type publicConvexConfig struct {
	Configured    bool   `json:"configured"`
	Enabled       bool   `json:"enabled"`
	SiteURL       string `json:"siteUrl,omitempty"`
	CloudURL      string `json:"cloudUrl,omitempty"`
	HealthURL     string `json:"healthUrl,omitempty"`
	WalletSyncURL string `json:"walletSyncUrl,omitempty"`
}

type publicFrontendConfig struct {
	Supabase publicSupabaseConfig `json:"supabase"`
	Convex   publicConvexConfig   `json:"convex"`
	Gateway  any                  `json:"gateway"`
	Android  map[string]string    `json:"android"`
	Runtime  []runtimeAppEntry    `json:"runtime"`
}

type runtimeAppEntry struct {
	ID          string `json:"id"`
	Label       string `json:"label"`
	Href        string `json:"href"`
	Description string `json:"description"`
	Kind        string `json:"kind"`
}

type xaiVoiceStatusResponse struct {
	Configured       bool           `json:"configured"`
	RealtimeURL      string         `json:"realtimeUrl"`
	TTSProxyURL      string         `json:"ttsProxyUrl"`
	DefaultVoice     string         `json:"defaultVoice"`
	Voices           []string       `json:"voices"`
	SampleRate       int            `json:"sampleRate"`
	Instructions     string         `json:"instructions"`
	Session          map[string]any `json:"session"`
	RecommendedTools []string       `json:"recommendedTools"`
}

type xaiRealtimeSessionRequest struct {
	ExpiresAfter *struct {
		Seconds int `json:"seconds"`
	} `json:"expires_after,omitempty"`
	Voice        string `json:"voice,omitempty"`
	Instructions string `json:"instructions,omitempty"`
}

type bitaxeFleetSnapshot struct {
	TotalDevices  int                    `json:"totalDevices"`
	OnlineDevices int                    `json:"onlineDevices"`
	TotalHashRate float64                `json:"totalHashRate"`
	AvgTemp       float64                `json:"avgTemp"`
	TotalPower    float64                `json:"totalPower"`
	TotalShares   int                    `json:"totalShares"`
	Devices       []bitaxeDeviceSnapshot `json:"devices"`
}

type bitaxeDeviceSnapshot struct {
	ID             string  `json:"id"`
	IP             string  `json:"ip"`
	State          string  `json:"state"`
	Health         string  `json:"health"`
	PoolURL        string  `json:"poolUrl"`
	PoolPort       int     `json:"poolPort"`
	PoolUser       string  `json:"poolUser"`
	HashRate       float64 `json:"hashRate"`
	Temp           float64 `json:"temp"`
	Power          float64 `json:"power"`
	FrequencyMHz   int     `json:"frequencyMHz"`
	FanSpeed       int     `json:"fanSpeed"`
	FanRPM         int     `json:"fanRPM"`
	SharesAccepted int     `json:"sharesAccepted"`
	SharesRejected int     `json:"sharesRejected"`
	UptimeHours    float64 `json:"uptimeHours"`
}

type fleetStore struct {
	mu      sync.RWMutex
	devices []bitaxeDeviceSnapshot
}

func newFleetStore() *fleetStore {
	return &fleetStore{
		devices: []bitaxeDeviceSnapshot{},
	}
}

func main() {
	config.BootstrapEnv()

	port := flag.String("port", "", "Port to listen on")
	bindMode := flag.String("bind", "", "Bind mode: loopback, tailnet, or public")
	tailscaleMode := flag.String("tailscale", "", "Tailscale mode: off, serve, or funnel")
	authMode := flag.String("auth", "", "Gateway auth mode: none, token, or password")
	gatewayToken := flag.String("gateway-token", "", "Gateway auth token override")
	gatewayPassword := flag.String("gateway-password", "", "Gateway shared password override")
	public := flag.Bool("public", false, "Listen on all interfaces (0.0.0.0) instead of localhost only")
	noBrowser := flag.Bool("no-browser", false, "Do not auto-open browser on startup")

	flag.Usage = func() {
		fmt.Fprintf(os.Stderr, "SolanaOS Control — dashboard and agent control\n\n")
		fmt.Fprintf(os.Stderr, "Usage: %s [options] [config.json]\n\n", os.Args[0])
		fmt.Fprintf(os.Stderr, "Options:\n")
		flag.PrintDefaults()
	}
	flag.Parse()

	// Railway sets PORT env var
	if *port == "" {
		if envPort := os.Getenv("PORT"); envPort != "" {
			*port = envPort
			*public = true // Railway needs 0.0.0.0
			*noBrowser = true
		} else {
			*port = "18800"
		}
	}

	configPath := defaultConfigPath()
	if flag.NArg() > 0 {
		configPath = flag.Arg(0)
	}

	absPath, err := filepath.Abs(configPath)
	if err != nil {
		log.Fatalf("Config path error: %v", err)
	}

	portNum, err := strconv.Atoi(*port)
	if err != nil || portNum < 1 || portNum > 65535 {
		log.Fatalf("Invalid port: %s", *port)
	}

	cfg, _ := config.Load()
	runtimeCfg, err := resolveGatewayRuntimeConfig(cfg, *bindMode, *authMode, *gatewayToken, *gatewayPassword, *tailscaleMode)
	if err != nil {
		log.Fatalf("gateway access config: %v", err)
	}
	if *public && strings.TrimSpace(*bindMode) == "" && runtimeCfg.TailscaleMode == gatewaypkg.TailscaleModeOff {
		runtimeCfg.BindMode = "public"
	}
	listenHost, err := gatewayListenHost(runtimeCfg, *public)
	if err != nil {
		log.Fatalf("gateway bind: %v", err)
	}
	addr := net.JoinHostPort(listenHost, *port)
	controlHandler := controlapi.NewServer().Handler()
	fleet := newFleetStore()

	// API routes
	mux := http.NewServeMux()
	workspacePath := config.DefaultWorkspacePath()
	cliBinary := resolveCLIBinary()
	anthropicKey := strings.TrimSpace(os.Getenv("ANTHROPIC_API_KEY"))
	if anthropicKey == "" && cfg != nil {
		anthropicKey = strings.TrimSpace(cfg.Providers.Anthropic.APIKey)
	}
	codingSessions, err := gatewaypkg.NewCodingSessionManager(
		filepath.Join(workspacePath, "sessions", "gateway-coding"),
		anthropicKey,
	)
	if err != nil {
		log.Fatalf("coding session manager: %v", err)
	}

	// Wallet + portfolio APIs shared with SolanaOS Control
	if walletAPI, err := nanobot.NewWalletAPI(); err == nil {
		walletAPI.Register(mux)
		log.Printf("[wallet-api] enabled for web console")
	} else {
		log.Printf("[wallet-api] unavailable: %v", err)
	}
	mux.Handle("/api/control/", controlHandler)
	mux.Handle("/api/control", controlHandler)

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		writeJSON(w, http.StatusOK, map[string]any{
			"status":       "healthy",
			"service":      "solanaos-web",
			"version":      "1.0.0",
			"controlAPI":   "/api/control/status",
			"fleetAPI":     "/api/fleet",
			"setupCodeAPI": "/api/setup-code",
		})
	})

	mux.HandleFunc("/api/setup-code", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		writeJSON(w, http.StatusOK, buildSetupCodeResponse(r, runtimeCfg))
	})

	mux.HandleFunc("/api/setup/downloads", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		writeJSON(w, http.StatusOK, buildSetupDownloadsResponse())
	})

	mux.HandleFunc("/api/xai/status", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		writeJSON(w, http.StatusOK, buildXAIVoiceStatus())
	})

	mux.HandleFunc("/api/xai/realtime/session", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method == http.MethodOptions {
			w.Header().Set("Access-Control-Allow-Methods", "POST,OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			return
		}
		if r.Method != http.MethodPost {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]any{"error": "method not allowed"})
			return
		}
		apiKey := strings.TrimSpace(os.Getenv("XAI_API_KEY"))
		if apiKey == "" {
			writeJSON(w, http.StatusServiceUnavailable, map[string]any{"error": "XAI_API_KEY is not configured"})
			return
		}

		req := xaiRealtimeSessionRequest{}
		if r.Body != nil {
			defer r.Body.Close()
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil && err != io.EOF {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": "bad request"})
				return
			}
		}

		seconds := 300
		if req.ExpiresAfter != nil && req.ExpiresAfter.Seconds > 0 {
			seconds = req.ExpiresAfter.Seconds
		}
		upstreamBody, _ := json.Marshal(map[string]any{
			"expires_after": map[string]any{"seconds": seconds},
		})
		upstreamReq, err := http.NewRequest(http.MethodPost, "https://api.x.ai/v1/realtime/client_secrets", strings.NewReader(string(upstreamBody)))
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]any{"error": "unable to create xAI request"})
			return
		}
		upstreamReq.Header.Set("Authorization", "Bearer "+apiKey)
		upstreamReq.Header.Set("Content-Type", "application/json")

		resp, err := http.DefaultClient.Do(upstreamReq)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"error": fmt.Sprintf("xAI realtime session failed: %v", err)})
			return
		}
		defer resp.Body.Close()

		var payload map[string]any
		if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"error": "invalid xAI realtime response"})
			return
		}
		if resp.StatusCode >= 400 {
			writeJSON(w, resp.StatusCode, map[string]any{
				"error":   firstNonEmptyString(extractNestedString(payload, "error.message"), extractNestedString(payload, "message"), "xAI realtime session failed"),
				"details": payload,
			})
			return
		}

		sessionConfig := buildXAIRealtimeSessionConfig(req.Voice, req.Instructions)
		writeJSON(w, http.StatusOK, map[string]any{
			"configured":     true,
			"realtimeUrl":    "wss://api.x.ai/v1/realtime",
			"ephemeralToken": extractEphemeralToken(payload),
			"secret":         payload,
			"session":        sessionConfig,
		})
	})

	mux.HandleFunc("/api/xai/tts", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodOptions {
			w.Header().Set("Access-Control-Allow-Methods", "POST,OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			return
		}
		if r.Method != http.MethodPost {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]any{"error": "method not allowed"})
			return
		}
		apiKey := strings.TrimSpace(os.Getenv("XAI_API_KEY"))
		if apiKey == "" {
			w.Header().Set("Content-Type", "application/json")
			writeJSON(w, http.StatusServiceUnavailable, map[string]any{"error": "XAI_API_KEY is not configured"})
			return
		}

		body, err := io.ReadAll(r.Body)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "unable to read request"})
			return
		}
		if len(strings.TrimSpace(string(body))) == 0 {
			w.Header().Set("Content-Type", "application/json")
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "request body is required"})
			return
		}

		upstreamReq, err := http.NewRequest(http.MethodPost, "https://api.x.ai/v1/tts", strings.NewReader(string(body)))
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			writeJSON(w, http.StatusInternalServerError, map[string]any{"error": "unable to create xAI TTS request"})
			return
		}
		upstreamReq.Header.Set("Authorization", "Bearer "+apiKey)
		upstreamReq.Header.Set("Content-Type", "application/json")

		resp, err := http.DefaultClient.Do(upstreamReq)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			writeJSON(w, http.StatusBadGateway, map[string]any{"error": fmt.Sprintf("xAI TTS failed: %v", err)})
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode >= 400 {
			w.Header().Set("Content-Type", "application/json")
			payload, _ := io.ReadAll(resp.Body)
			writeJSON(w, resp.StatusCode, map[string]any{"error": strings.TrimSpace(string(payload))})
			return
		}

		contentType := resp.Header.Get("Content-Type")
		if strings.TrimSpace(contentType) == "" {
			contentType = "audio/mpeg"
		}
		w.Header().Set("Content-Type", contentType)
		if disposition := resp.Header.Get("Content-Disposition"); disposition != "" {
			w.Header().Set("Content-Disposition", disposition)
		}
		w.WriteHeader(resp.StatusCode)
		if _, err := io.Copy(w, resp.Body); err != nil {
			log.Printf("[xai-tts] stream copy failed: %v", err)
		}
	})

	mux.HandleFunc("/api/fleet", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method == http.MethodOptions {
			w.Header().Set("Access-Control-Allow-Methods", "GET")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			return
		}
		if r.Method != http.MethodGet {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]any{"error": "method not allowed"})
			return
		}
		writeJSON(w, http.StatusOK, fleet.snapshot())
	})

	mux.HandleFunc("/api/fleet/device/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method == http.MethodOptions {
			w.Header().Set("Access-Control-Allow-Methods", "GET,POST,PATCH")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			return
		}
		handleFleetDevice(w, r, fleet)
	})

	// API: Status
	mux.HandleFunc("/api/status", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		status := map[string]any{
			"status":         "running",
			"version":        "1.0.0",
			"agent":          "SolanaOS Control",
			"config":         absPath,
			"uptime":         time.Since(startTime).String(),
			"mode":           os.Getenv("AGENT_MODE"),
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
			}
		}

		keyPath := ""
		if cfg != nil {
			keyPath = cfg.Solana.WalletKeyPath
		}
		wallet, err := solana.WalletFromEnvOrFile(keyPath)
		if err == nil && wallet != nil {
			status["wallet"] = "configured"
			status["walletAddress"] = wallet.PublicKeyStr()
		}

		if snapshot, snapshotErr := agent.LoadRuntimeSnapshot(); snapshotErr == nil && snapshot != nil {
			status["recentTrades"] = snapshot.RecentTrades
			status["openPositions"] = snapshot.OpenPositions
			status["openPositionCount"] = snapshot.OpenPositionCount
			status["closedTradeCount"] = snapshot.ClosedTradeCount
			status["swapSlippageBps"] = snapshot.SwapSlippageBps
			status["minReserveSOL"] = snapshot.MinReserveSOL
			status["runtimeUpdatedAt"] = snapshot.UpdatedAt
			if snapshot.Mode != "" {
				status["oodaMode"] = snapshot.Mode
			}
			if snapshot.WalletAddress != "" {
				status["walletAddress"] = snapshot.WalletAddress
			}
			if snapshot.WalletSOL > 0 {
				status["walletBalanceSOL"] = snapshot.WalletSOL
			}
		}

		json.NewEncoder(w).Encode(status)
	})

	// API: Config read
	mux.HandleFunc("/api/config", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		data, err := os.ReadFile(absPath)
		if err != nil {
			if os.IsNotExist(err) {
				json.NewEncoder(w).Encode(map[string]any{
					"config": nil,
					"exists": false,
					"path":   absPath,
				})
				return
			}
			http.Error(w, err.Error(), 500)
			return
		}
		w.Write(data)
	})

	// API: Health
	mux.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"status": "ok",
			"agent":  "solanaos-go",
		})
	})

	mux.HandleFunc("/api/gateway/coding/sessions", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method == http.MethodOptions {
			w.Header().Set("Access-Control-Allow-Methods", "GET,POST")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
			return
		}

		switch r.Method {
		case http.MethodGet:
			sessions := codingSessions.List()
			writeJSON(w, http.StatusOK, map[string]any{
				"sessions":             sessions,
				"count":                len(sessions),
				"available_runtimes":   codingSessions.SupportedRuntimes(),
				"anthropic_configured": codingSessions.AnthropicConfigured(),
				"claude_cli_available": codingSessions.ClaudeAvailable(),
			})
		case http.MethodPost:
			var req gatewaypkg.CreateCodingSessionRequest
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": "bad request"})
				return
			}
			session, err := codingSessions.Create(req)
			if err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusAccepted, map[string]any{"session": session})
		default:
			writeJSON(w, http.StatusMethodNotAllowed, map[string]any{"error": "method not allowed"})
		}
	})

	mux.HandleFunc("/api/gateway/coding/sessions/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method == http.MethodOptions {
			w.Header().Set("Access-Control-Allow-Methods", "GET,POST")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
			return
		}

		path := strings.TrimPrefix(r.URL.Path, "/api/gateway/coding/sessions/")
		path = strings.Trim(path, "/")
		parts := strings.Split(path, "/")
		if len(parts) == 0 || strings.TrimSpace(parts[0]) == "" {
			writeJSON(w, http.StatusNotFound, map[string]any{"error": "session not found"})
			return
		}
		sessionID := parts[0]

		if len(parts) == 1 {
			if r.Method != http.MethodGet {
				writeJSON(w, http.StatusMethodNotAllowed, map[string]any{"error": "method not allowed"})
				return
			}
			session := codingSessions.Get(sessionID)
			if session == nil {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": "session not found"})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"session": session})
			return
		}

		switch parts[1] {
		case "prompt":
			if r.Method != http.MethodPost {
				writeJSON(w, http.StatusMethodNotAllowed, map[string]any{"error": "method not allowed"})
				return
			}
			var req gatewaypkg.ContinueCodingSessionRequest
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": "bad request"})
				return
			}
			session, err := codingSessions.Continue(sessionID, req.Prompt)
			if err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusAccepted, map[string]any{"session": session})
		case "log":
			if r.Method != http.MethodGet {
				writeJSON(w, http.StatusMethodNotAllowed, map[string]any{"error": "method not allowed"})
				return
			}
			content, run, err := codingSessions.ReadLog(sessionID, r.URL.Query().Get("run_id"))
			if err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{
				"run":     run,
				"content": content,
			})
		case "kill":
			if r.Method != http.MethodPost {
				writeJSON(w, http.StatusMethodNotAllowed, map[string]any{"error": "method not allowed"})
				return
			}
			if err := codingSessions.Kill(sessionID); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusAccepted, map[string]any{"ok": true})
		default:
			writeJSON(w, http.StatusNotFound, map[string]any{"error": "unknown action"})
		}
	})

	// API: Connectors status
	mux.HandleFunc("/api/connectors", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		bitaxeStatus := "not configured"
		if cfg != nil && cfg.Bitaxe.Enabled && cfg.Bitaxe.Host != "" {
			bitaxeStatus = "connected"
		}
		convexStatus := "not_configured"
		if convexConfigured(cfg) {
			convexStatus = "connected"
		}
		connectors := []map[string]any{
			{"name": "Helius", "status": envStatus("HELIUS_API_KEY"), "type": "rpc"},
			{"name": "Birdeye", "status": envStatus("BIRDEYE_API_KEY"), "type": "analytics"},
			{"name": "Jupiter", "status": envStatus("JUPITER_API_KEY"), "type": "swap"},
			{"name": "Aster", "status": envStatus("ASTER_API_KEY"), "type": "perps"},
			{"name": "OpenRouter", "status": envStatus("OPENROUTER_API_KEY"), "type": "llm"},
			{"name": "xAI", "status": envStatus("XAI_API_KEY"), "type": "voice-llm"},
			{"name": "Anthropic", "status": envStatus("ANTHROPIC_API_KEY"), "type": "llm"},
			{"name": "Claude Code", "status": binStatus("claude"), "type": "agent-cli"},
			{"name": "GitHub", "status": envAnyStatus("GH_TOKEN", "GITHUB_PAT", "Github_PAT", "GITHUB_TOKEN"), "type": "git"},
			{"name": "Tailscale", "status": binStatus("tailscale"), "type": "network"},
			{"name": "Supabase", "status": envStatus("SUPABASE_URL"), "type": "database"},
			{"name": "Convex", "status": convexStatus, "type": "backend"},
			{"name": "Bitaxe", "status": bitaxeStatus, "type": "miner"},
		}
		json.NewEncoder(w).Encode(connectors)
	})

	mux.HandleFunc("/api/public/config", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		siteURL := resolveConvexSiteURL(cfg)
		cloudURL := resolveConvexCloudURL(cfg)
		supabaseURL := firstNonEmpty(strings.TrimSpace(os.Getenv("SUPABASE_URL")), strings.TrimSpace(cfgValue(func() string {
			if cfg == nil {
				return ""
			}
			return cfg.Supabase.URL
		})))
		supabaseAnonKey := strings.TrimSpace(os.Getenv("SUPABASE_ANON_KEY"))
		storageBucket := strings.TrimSpace(os.Getenv("SUPABASE_STORAGE_BUCKET"))
		writeJSON(w, http.StatusOK, publicFrontendConfig{
			Supabase: publicSupabaseConfig{
				Configured:    supabaseURL != "" && supabaseAnonKey != "",
				URL:           supabaseURL,
				AnonKey:       supabaseAnonKey,
				StorageBucket: storageBucket,
			},
			Convex: publicConvexConfig{
				Configured:    siteURL != "",
				Enabled:       convexConfigured(cfg),
				SiteURL:       siteURL,
				CloudURL:      cloudURL,
				HealthURL:     joinURL(siteURL, "/solanaos/health"),
				WalletSyncURL: joinURL(siteURL, "/solanaos/users/upsert"),
			},
			Gateway: gatewayAccessStatus(runtimeCfg),
			Android: map[string]string{
				"convexSiteUrl":  siteURL,
				"convexCloudUrl": cloudURL,
			},
			Runtime: buildRuntimeAppEntries(),
		})
	})

	mux.HandleFunc("/api/convex/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		siteURL := resolveConvexSiteURL(cfg)
		if siteURL == "" {
			writeJSON(w, http.StatusServiceUnavailable, map[string]any{
				"status":  "missing",
				"backend": "convex",
				"error":   "CONVEX_SITE_URL is not configured",
			})
			return
		}
		payload, err := fetchConvexHealth(siteURL)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{
				"status":  "error",
				"backend": "convex",
				"siteUrl": siteURL,
				"error":   err.Error(),
			})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.HandleFunc("/api/gateway/access", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		writeJSON(w, http.StatusOK, gatewayAccessStatus(runtimeCfg))
	})

	// API: Strategy — GET returns current params, POST updates them
	mux.HandleFunc("/api/strategy", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		c, _ := config.Load()
		if r.Method == http.MethodGet || r.Method == "" {
			if c == nil {
				json.NewEncoder(w).Encode(map[string]any{"error": "config not loaded"})
				return
			}
			// Return pcts as whole numbers (7 = 7%) for UI display
			json.NewEncoder(w).Encode(map[string]any{
				"rsi_overbought": c.Strategy.RSIOverbought,
				"rsi_oversold":   c.Strategy.RSIOversold,
				"ema_fast":       c.Strategy.EMAFastPeriod,
				"ema_slow":       c.Strategy.EMASlowPeriod,
				"stop_loss":      c.Strategy.StopLossPct * 100,
				"take_profit":    c.Strategy.TakeProfitPct * 100,
				"position_size":  c.Strategy.PositionSizePct * 100,
			})
			return
		}
		if r.Method == http.MethodPost {
			if c == nil {
				http.Error(w, `{"error":"config not loaded"}`, 500)
				return
			}
			var patch map[string]float64
			if err := json.NewDecoder(r.Body).Decode(&patch); err != nil {
				http.Error(w, `{"error":"bad request"}`, 400)
				return
			}
			// UI sends whole-number pcts (7 = 7%); store as decimals
			if v, ok := patch["rsi_overbought"]; ok {
				c.Strategy.RSIOverbought = int(v)
			}
			if v, ok := patch["rsi_oversold"]; ok {
				c.Strategy.RSIOversold = int(v)
			}
			if v, ok := patch["ema_fast"]; ok {
				c.Strategy.EMAFastPeriod = int(v)
			}
			if v, ok := patch["ema_slow"]; ok {
				c.Strategy.EMASlowPeriod = int(v)
			}
			if v, ok := patch["stop_loss"]; ok {
				c.Strategy.StopLossPct = v / 100
			}
			if v, ok := patch["take_profit"]; ok {
				c.Strategy.TakeProfitPct = v / 100
			}
			if v, ok := patch["position_size"]; ok {
				c.Strategy.PositionSizePct = v / 100
			}
			if err := config.Save(c); err != nil {
				http.Error(w, `{"error":"save failed"}`, 500)
				return
			}
			json.NewEncoder(w).Encode(map[string]any{"ok": true})
			return
		}
		http.Error(w, `{"error":"method not allowed"}`, 405)
	})

	// API: Runtime snapshot (OODA trades, positions, pet, stats)
	mux.HandleFunc("/api/snapshot", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		snapshot, err := agent.LoadRuntimeSnapshot()
		if err != nil {
			json.NewEncoder(w).Encode(map[string]any{"error": "no snapshot"})
			return
		}

		// Compute win rate
		wins, losses := 0, 0
		var totalPnL float64
		for _, t := range snapshot.RecentTrades {
			if t.Outcome == "win" {
				wins++
				totalPnL += t.PnLPct
			} else if t.Outcome == "loss" {
				losses++
				totalPnL += t.PnLPct
			}
		}
		winRate := 0.0
		if wins+losses > 0 {
			winRate = float64(wins) / float64(wins+losses) * 100
		}

		json.NewEncoder(w).Encode(map[string]any{
			"updatedAt":         snapshot.UpdatedAt,
			"mode":              snapshot.Mode,
			"cycleCount":        snapshot.CycleCount,
			"watchlistCount":    snapshot.WatchlistCount,
			"openPositionCount": snapshot.OpenPositionCount,
			"closedTradeCount":  snapshot.ClosedTradeCount,
			"walletAddress":     snapshot.WalletAddress,
			"walletSOL":         snapshot.WalletSOL,
			"minReserveSOL":     snapshot.MinReserveSOL,
			"swapSlippageBps":   snapshot.SwapSlippageBps,
			"openPositions":     snapshot.OpenPositions,
			"recentTrades":      snapshot.RecentTrades,
			"winRate":           winRate,
			"totalPnL":          totalPnL,
		})
	})

	// API: Bitaxe miner — proxies to AxeOS or returns offline if not configured
	mux.HandleFunc("/api/miner", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == "OPTIONS" {
			return
		}
		w.Header().Set("Content-Type", "application/json")

		host := ""
		if cfg != nil && cfg.Bitaxe.Enabled {
			host = cfg.Bitaxe.Host
		}
		if h := r.URL.Query().Get("host"); h != "" {
			host = h // allow override via ?host=
		}
		if host == "" {
			json.NewEncoder(w).Encode(map[string]any{
				"online":  false,
				"error":   "bitaxe not configured",
				"enabled": false,
			})
			return
		}

		client := &http.Client{Timeout: 5 * time.Second}
		resp, err := client.Get("http://" + host + "/api/system/info")
		if err != nil {
			json.NewEncoder(w).Encode(map[string]any{
				"online": false,
				"host":   host,
				"error":  err.Error(),
			})
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
	})

	mux.HandleFunc("/api/run", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
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
		out, err := exec.CommandContext(r.Context(), cliBinary, args...).CombinedOutput()
		json.NewEncoder(w).Encode(map[string]any{
			"output": string(out),
			"ok":     err == nil,
		})
	})

	mux.HandleFunc("/api/chat", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method == "OPTIONS" {
			w.Header().Set("Access-Control-Allow-Methods", "POST")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
			return
		}

		var req struct {
			Message string `json:"message"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"bad request"}`, 400)
			return
		}

		reply := webReply(strings.TrimSpace(strings.ToLower(req.Message)))
		json.NewEncoder(w).Encode(map[string]any{
			"reply": reply,
			"mood":  "happy",
		})
	})

	// Serve built frontend when available, otherwise fall back to a simple status page.
	frontendDir := resolveFrontendDir(absPath)
	if frontendDir != "" {
		mux.Handle("/", frontendHandler(frontendDir))
	} else {
		mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/html")
			w.Write([]byte(fallbackHTML))
		})
	}

	if runtimeCfg.TailscaleMode != gatewaypkg.TailscaleModeOff {
		targetURL := "http://127.0.0.1:" + *port
		exposed, err := gatewaypkg.ConfigureTailscaleHTTPS(runtimeCfg.TailscaleMode, 443, targetURL)
		if err != nil {
			log.Fatalf("tailscale %s: %v", runtimeCfg.TailscaleMode, err)
		}
		if exposed != nil {
			runtimeCfg.TailscaleURL = exposed.URL
			if runtimeCfg.ResetOnExit {
				defer func() {
					if err := gatewaypkg.ResetTailscaleHTTPS(runtimeCfg.TailscaleMode); err != nil {
						log.Printf("tailscale reset: %v", err)
					}
				}()
			}
		}
	}

	if runtimeCfg.AuthMode == "token" && strings.TrimSpace(*gatewayToken) == "" &&
		(cfg == nil || strings.TrimSpace(cfg.Gateway.Auth.Token) == "") {
		log.Printf("[gateway] generated ephemeral token: %s", runtimeCfg.Token)
	}

	// CORS + auth middleware
	handler := corsMiddleware(loggerMiddleware(gatewayAccessMiddleware(runtimeCfg, mux)))

	// Startup
	fmt.Print(banner)
	fmt.Println()
	fmt.Printf("  Config: %s\n", absPath)
	fmt.Printf("  Open: http://localhost:%s\n", *port)
	fmt.Printf("  Bind: %s (%s)\n", runtimeCfg.BindMode, addr)
	if runtimeCfg.AuthMode != "none" {
		fmt.Printf("  Auth: %s\n", runtimeCfg.AuthMode)
	}
	if runtimeCfg.TailscaleURL != "" {
		fmt.Printf("  Tailscale: %s\n", runtimeCfg.TailscaleURL)
	}
	if runtimeCfg.BindMode == "public" {
		if ip := getLocalIP(); ip != "" {
			fmt.Printf("  Public: http://%s:%s\n", ip, *port)
		}
	}
	fmt.Println()

	openURL := "http://localhost:" + *port
	switch runtimeCfg.BindMode {
	case "public":
		openURL = "http://localhost:" + *port
	case "tailnet":
		openURL = "http://" + net.JoinHostPort(listenHost, *port)
	case "loopback":
		openURL = "http://127.0.0.1:" + *port
	}
	if !*noBrowser {
		go func() {
			time.Sleep(500 * time.Millisecond)
			openBrowser(openURL)
		}()
	}

	if err := http.ListenAndServe(addr, handler); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}

func resolveCLIBinary() string {
	if exe, err := os.Executable(); err == nil {
		base := filepath.Dir(exe)
		candidates := []string{
			filepath.Join(base, "solanaos"),
			filepath.Join(base, "..", "build", "solanaos"),
			filepath.Join(base, "..", "solanaos"),
			filepath.Join(base, "..", "..", "build", "solanaos"),
			filepath.Join(base, "solanaos"),
			filepath.Join(base, "..", "build", "solanaos"),
			filepath.Join(base, "..", "solanaos"),
			filepath.Join(base, "..", "..", "build", "solanaos"),
		}
		for _, candidate := range candidates {
			if info, err := os.Stat(candidate); err == nil && !info.IsDir() {
				return candidate
			}
		}
	}
	return "solanaos"
}

func webReply(msg string) string {
	switch {
	case strings.Contains(msg, "hello") || strings.Contains(msg, "hi") || strings.Contains(msg, "hey"):
		return "Hey there! 🖥️ SolanaOS Control is online. I can help with wallet status, RPC health, daemon state, and your watchlist."
	case strings.Contains(msg, "watchlist"):
		return "👀 The web console now exposes your active watchlist and OODA mode through `/api/status`, so the Chrome extension can reflect the same runtime state."
	case strings.Contains(msg, "health") || strings.Contains(msg, "status"):
		return "🩺 Use RPC Health in the extension or `/api/health` and `/api/status` here to inspect Helius connectivity, daemon heartbeat, mode, and watchlist."
	case strings.Contains(msg, "wallet") || strings.Contains(msg, "balance"):
		return "💰 Wallet endpoints are available from the web backend now: `/api/wallet`, `/api/wallet/portfolio`, `/api/wallet/tokens`, and `/api/wallet/history`."
	case strings.Contains(msg, "ooda") || strings.Contains(msg, "live"):
		return "🔄 Live mode is now the default. The web backend reports the active OODA mode so the extension stays aligned with your local runtime."
	default:
		return "🖥️ SolanaOS Control is focused on local operator control, wallet APIs, runtime status, and extension compatibility."
	}
}

func (s *fleetStore) snapshot() bitaxeFleetSnapshot {
	s.mu.RLock()
	defer s.mu.RUnlock()

	devices := make([]bitaxeDeviceSnapshot, len(s.devices))
	copy(devices, s.devices)

	var online int
	var totalHashRate float64
	var totalTemp float64
	var totalPower float64
	var totalShares int
	for _, device := range devices {
		if !strings.EqualFold(device.Health, "offline") {
			online++
		}
		totalHashRate += device.HashRate
		totalTemp += device.Temp
		totalPower += device.Power
		totalShares += device.SharesAccepted
	}

	avgTemp := 0.0
	if len(devices) > 0 {
		avgTemp = totalTemp / float64(len(devices))
	}

	return bitaxeFleetSnapshot{
		TotalDevices:  len(devices),
		OnlineDevices: online,
		TotalHashRate: totalHashRate,
		AvgTemp:       avgTemp,
		TotalPower:    totalPower,
		TotalShares:   totalShares,
		Devices:       devices,
	}
}

func (s *fleetStore) getDevice(id string) (bitaxeDeviceSnapshot, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, device := range s.devices {
		if device.ID == id {
			return device, true
		}
	}
	return bitaxeDeviceSnapshot{}, false
}

func (s *fleetStore) mutate(id string, fn func(*bitaxeDeviceSnapshot) error) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for idx := range s.devices {
		if s.devices[idx].ID == id {
			return fn(&s.devices[idx])
		}
	}
	return fmt.Errorf("device %q not found", id)
}

func handleFleetDevice(w http.ResponseWriter, r *http.Request, fleet *fleetStore) {
	path := strings.TrimPrefix(r.URL.Path, "/api/fleet/device/")
	parts := strings.Split(strings.Trim(path, "/"), "/")
	if len(parts) == 0 || parts[0] == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "device id required"})
		return
	}

	deviceID := parts[0]
	if len(parts) == 1 {
		if r.Method != http.MethodGet {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]any{"error": "method not allowed"})
			return
		}
		device, ok := fleet.getDevice(deviceID)
		if !ok {
			writeJSON(w, http.StatusNotFound, map[string]any{"error": "device not found"})
			return
		}
		writeJSON(w, http.StatusOK, device)
		return
	}

	action := parts[1]
	switch action {
	case "restart":
		if r.Method != http.MethodPost {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]any{"error": "method not allowed"})
			return
		}
		err := fleet.mutate(deviceID, func(device *bitaxeDeviceSnapshot) error {
			device.State = "restarting"
			device.Health = "RESTARTING"
			return nil
		})
		if err != nil {
			writeJSON(w, http.StatusNotFound, map[string]any{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusAccepted, map[string]any{"ok": true, "deviceId": deviceID, "action": action})
	case "identify":
		if r.Method != http.MethodPost {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]any{"error": "method not allowed"})
			return
		}
		if _, ok := fleet.getDevice(deviceID); !ok {
			writeJSON(w, http.StatusNotFound, map[string]any{"error": "device not found"})
			return
		}
		writeJSON(w, http.StatusAccepted, map[string]any{"ok": true, "deviceId": deviceID, "action": action})
	case "fan":
		if r.Method != http.MethodPatch {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]any{"error": "method not allowed"})
			return
		}
		var req struct {
			FanSpeed int `json:"fanSpeed"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "bad request"})
			return
		}
		if req.FanSpeed < 0 || req.FanSpeed > 100 {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "fanSpeed must be between 0 and 100"})
			return
		}
		err := fleet.mutate(deviceID, func(device *bitaxeDeviceSnapshot) error {
			device.FanSpeed = req.FanSpeed
			device.FanRPM = req.FanSpeed * 80
			return nil
		})
		if err != nil {
			writeJSON(w, http.StatusNotFound, map[string]any{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusAccepted, map[string]any{"ok": true, "deviceId": deviceID, "action": action})
	case "pool":
		if r.Method != http.MethodPatch {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]any{"error": "method not allowed"})
			return
		}
		var req struct {
			PoolURL  string `json:"poolUrl"`
			PoolPort int    `json:"poolPort"`
			PoolUser string `json:"poolUser"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "bad request"})
			return
		}
		err := fleet.mutate(deviceID, func(device *bitaxeDeviceSnapshot) error {
			if strings.TrimSpace(req.PoolURL) != "" {
				device.PoolURL = strings.TrimSpace(req.PoolURL)
			}
			if req.PoolPort > 0 {
				device.PoolPort = req.PoolPort
			}
			if strings.TrimSpace(req.PoolUser) != "" {
				device.PoolUser = strings.TrimSpace(req.PoolUser)
			}
			return nil
		})
		if err != nil {
			writeJSON(w, http.StatusNotFound, map[string]any{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusAccepted, map[string]any{"ok": true, "deviceId": deviceID, "action": action})
	case "overclock":
		if r.Method != http.MethodPatch {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]any{"error": "method not allowed"})
			return
		}
		var req struct {
			FrequencyMHz int `json:"frequencyMHz"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "bad request"})
			return
		}
		if req.FrequencyMHz <= 0 {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "frequencyMHz must be positive"})
			return
		}
		err := fleet.mutate(deviceID, func(device *bitaxeDeviceSnapshot) error {
			device.FrequencyMHz = req.FrequencyMHz
			return nil
		})
		if err != nil {
			writeJSON(w, http.StatusNotFound, map[string]any{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusAccepted, map[string]any{"ok": true, "deviceId": deviceID, "action": action})
	default:
		writeJSON(w, http.StatusNotFound, map[string]any{"error": "unknown device action"})
	}
}

func buildSetupCodeResponse(r *http.Request, runtime gatewayRuntimeConfig) setupCodeResponse {
	host := strings.TrimSpace(os.Getenv("SOLANAOS_GATEWAY_HOST"))
	if host == "" {
		if runtime.TailscaleURL != "" {
			if parsed, err := neturl.Parse(runtime.TailscaleURL); err == nil && parsed.Hostname() != "" {
				host = parsed.Hostname()
			}
		}
	}
	if host == "" && r != nil {
		host = requestHostname(r)
	}
	if host == "" {
		host = "127.0.0.1"
	}

	port := strings.TrimSpace(os.Getenv("SOLANAOS_GATEWAY_PORT"))
	if port == "" {
		port = "18790"
	}

	tlsEnabled := strings.EqualFold(strings.TrimSpace(os.Getenv("SOLANAOS_GATEWAY_TLS")), "true") ||
		runtime.TailscaleMode == gatewaypkg.TailscaleModeServe ||
		runtime.TailscaleMode == gatewaypkg.TailscaleModeFunnel

	scheme := "ws"
	if tlsEnabled {
		scheme = "wss"
	}

	payload := setupCodePayload{
		URL: fmt.Sprintf("%s://%s:%s", scheme, host, port),
	}
	response := setupCodeResponse{
		ExpiresAt: time.Now().Add(15 * time.Minute).UTC().Format(time.RFC3339),
		URL:       payload.URL,
		Host:      host,
		Port:      port,
		TLS:       tlsEnabled,
	}
	if runtime.AuthMode == "token" && strings.TrimSpace(runtime.Token) != "" {
		payload.Token = runtime.Token
		response.Token = runtime.Token
	}
	if runtime.AuthMode == "password" && strings.TrimSpace(runtime.Password) != "" {
		payload.Password = runtime.Password
		response.Password = runtime.Password
	}
	encoded, _ := json.Marshal(payload)
	response.Code = base64.RawURLEncoding.EncodeToString(encoded)
	return response
}

func buildSetupDownloadsResponse() setupDownloadsResponse {
	return setupDownloadsResponse{
		GitHubRepo:     "https://github.com/x402agent/Solana-Os-Go",
		GitHubReleases: "https://github.com/x402agent/Solana-Os-Go/releases/latest",
		NpmPackage:     "https://www.npmjs.com/package/solanaos-computer",
		Android: map[string]string{
			"guide":        "/guide#s19",
			"releases":     "https://github.com/x402agent/Solana-Os-Go/releases/latest",
			"buildCommand": "cd apps/android && GRADLE_USER_HOME=\"$PWD/.gradle-user\" ./gradlew :app:assembleDebug",
			"apkPath":      "apps/android/app/build/outputs/apk/debug/app-debug.apk",
		},
		Gateway: map[string]string{
			"runCommand":    "go run ./cmd/gateway-api",
			"dockerCommand": "docker build -f web/backend/Dockerfile -t solanaos-web .",
			"port":          "18790",
			"controlPort":   "18800",
		},
		Runtime: map[string]string{
			"oneShot":  "npx solanaos-computer@latest install --with-web",
			"shell":    "curl -fsSL https://raw.githubusercontent.com/x402agent/Solana-Os-Go/main/install.sh | bash -s -- --with-web",
			"fromRepo": "git clone https://github.com/x402agent/Solana-Os-Go.git && cd Solana-Os-Go && npm install && npm run build",
		},
		Web: map[string]string{
			"frontendDev": "cd web/frontend && npm run dev",
			"backendDev":  "cd web/backend && go run .",
			"makeDev":     "cd web && make dev",
		},
	}
}

func buildRuntimeAppEntries() []runtimeAppEntry {
	entries := []runtimeAppEntry{
		{
			ID:          "web-console",
			Label:       "Web Console",
			Href:        "/app/",
			Description: "Primary React runtime console mirroring the Android SolanaOS app shell.",
			Kind:        "react",
		},
		{
			ID:          "runtime-launcher",
			Label:       "Runtime Launcher",
			Href:        "/runtime/",
			Description: "HTML launch surface for newly shipped runtime apps and landing targets.",
			Kind:        "html",
		},
		{
			ID:          "android-guide",
			Label:       "Android Build",
			Href:        "/android/",
			Description: "Build, install, and pair the Android/Seeker app against the live runtime.",
			Kind:        "guide",
		},
		{
			ID:          "gateway-guide",
			Label:       "Gateway Setup",
			Href:        "/gateway/",
			Description: "Local runtime gateway bring-up, control API, and hardware bridge setup.",
			Kind:        "guide",
		},
		{
			ID:          "telegram-guide",
			Label:       "Telegram Bot",
			Href:        "/telegram/",
			Description: "Remote control surface for runtime status, alerts, and operator commands.",
			Kind:        "guide",
		},
		{
			ID:          "ore-miner",
			Label:       "ORE Miner",
			Href:        "/ore-miner/",
			Description: "Mining runtime surface and setup path for the ORE-focused app shell.",
			Kind:        "app",
		},
	}

	customLabel := strings.TrimSpace(os.Getenv("SOLANAOS_RUNTIME_APP_LABEL"))
	customHref := strings.TrimSpace(os.Getenv("SOLANAOS_RUNTIME_APP_PATH"))
	if customLabel != "" && customHref != "" {
		if !strings.HasPrefix(customHref, "/") {
			customHref = "/" + customHref
		}
		if !strings.HasSuffix(customHref, "/") {
			customHref += "/"
		}
		entries = append(entries, runtimeAppEntry{
			ID:          "custom-runtime-app",
			Label:       customLabel,
			Href:        customHref,
			Description: firstNonEmpty(strings.TrimSpace(os.Getenv("SOLANAOS_RUNTIME_APP_DESCRIPTION")), "Runtime HTML entry pushed from env configuration."),
			Kind:        firstNonEmpty(strings.TrimSpace(os.Getenv("SOLANAOS_RUNTIME_APP_KIND")), "custom"),
		})
	}

	return entries
}

func buildXAIVoiceStatus() xaiVoiceStatusResponse {
	return xaiVoiceStatusResponse{
		Configured:       strings.TrimSpace(os.Getenv("XAI_API_KEY")) != "",
		RealtimeURL:      "wss://api.x.ai/v1/realtime",
		TTSProxyURL:      "/api/xai/tts",
		DefaultVoice:     "Eve",
		Voices:           []string{"Eve", "Ara", "Rex", "Sal", "Leo"},
		SampleRate:       24000,
		Instructions:     "You are SolanaOS Voice, a concise Grok-powered copilot for the Seeker runtime. Keep spoken responses short, useful, and operationally aware.",
		Session:          buildXAIRealtimeSessionConfig("", ""),
		RecommendedTools: []string{"web_search", "x_search"},
	}
}

func buildXAIRealtimeSessionConfig(voice, instructions string) map[string]any {
	normalizedVoice := strings.TrimSpace(voice)
	if normalizedVoice == "" {
		normalizedVoice = "Eve"
	}
	normalizedInstructions := strings.TrimSpace(instructions)
	if normalizedInstructions == "" {
		normalizedInstructions = "You are SolanaOS Voice, a concise Grok-powered copilot for the Seeker runtime. Keep spoken responses short, useful, and operationally aware."
	}
	return map[string]any{
		"voice":        normalizedVoice,
		"instructions": normalizedInstructions,
		"turn_detection": map[string]any{
			"type":                "server_vad",
			"threshold":           0.85,
			"silence_duration_ms": 0,
		},
		"tools": []map[string]any{
			{"type": "web_search"},
			{"type": "x_search"},
		},
		"input_audio_transcription": map[string]any{
			"model": "grok-2-audio",
		},
		"audio": map[string]any{
			"input": map[string]any{
				"format": map[string]any{
					"type": "audio/pcm",
					"rate": 24000,
				},
			},
			"output": map[string]any{
				"format": map[string]any{
					"type": "audio/pcm",
					"rate": 24000,
				},
			},
		},
	}
}

func firstNonEmptyString(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func extractNestedString(payload map[string]any, path string) string {
	current := any(payload)
	for _, part := range strings.Split(path, ".") {
		next, ok := current.(map[string]any)
		if !ok {
			return ""
		}
		current, ok = next[part]
		if !ok {
			return ""
		}
	}
	value, _ := current.(string)
	return value
}

func extractEphemeralToken(payload map[string]any) string {
	return firstNonEmptyString(
		extractNestedString(payload, "client_secret.value"),
		extractNestedString(payload, "client_secret"),
		extractNestedString(payload, "secret.value"),
		extractNestedString(payload, "secret"),
		extractNestedString(payload, "value"),
		extractNestedString(payload, "token"),
	)
}

func requestHostname(r *http.Request) string {
	if r == nil {
		return ""
	}
	host := strings.TrimSpace(r.Host)
	if host == "" {
		return ""
	}
	if strings.Contains(host, ":") {
		if parsedHost, _, err := net.SplitHostPort(host); err == nil {
			return parsedHost
		}
	}
	return host
}

var startTime = time.Now()

func resolveFrontendDir(configPath string) string {
	candidates := []string{
		filepath.Join(filepath.Dir(configPath), "web", "frontend", "dist"),
		filepath.Join(filepath.Dir(configPath), "frontend", "dist"),
	}

	if cwd, err := os.Getwd(); err == nil {
		candidates = append(candidates,
			filepath.Join(cwd, "web", "frontend", "dist"),
			filepath.Join(cwd, "frontend", "dist"),
		)
	}

	if exe, err := os.Executable(); err == nil {
		base := filepath.Dir(exe)
		candidates = append(candidates,
			filepath.Join(base, "web", "frontend", "dist"),
			filepath.Join(base, "..", "web", "frontend", "dist"),
			filepath.Join(base, "frontend", "dist"),
		)
	}

	seen := map[string]bool{}
	for _, candidate := range candidates {
		if candidate == "" {
			continue
		}
		candidate = filepath.Clean(candidate)
		if seen[candidate] {
			continue
		}
		seen[candidate] = true
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			return candidate
		}
	}

	return ""
}

func defaultConfigPath() string {
	return config.DefaultConfigPath()
}

func envStatus(key string) string {
	if os.Getenv(key) != "" {
		return "connected"
	}
	return "not_configured"
}

func envAnyStatus(keys ...string) string {
	for _, key := range keys {
		if strings.TrimSpace(os.Getenv(key)) != "" {
			return "connected"
		}
	}
	return "not_configured"
}

func binStatus(name string) string {
	if _, err := exec.LookPath(name); err == nil {
		return "available"
	}
	return "not_installed"
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func cfgValue(fn func() string) string {
	if fn == nil {
		return ""
	}
	return strings.TrimSpace(fn())
}

func resolveConvexCloudURL(cfg *config.Config) string {
	if value := strings.TrimSpace(os.Getenv("CONVEX_URL")); value != "" {
		return value
	}
	if cfg != nil {
		return strings.TrimSpace(cfg.Convex.URL)
	}
	return ""
}

func resolveConvexSiteURL(cfg *config.Config) string {
	if value := strings.TrimSpace(os.Getenv("CONVEX_SITE_URL")); value != "" {
		return value
	}
	cloudURL := resolveConvexCloudURL(cfg)
	if strings.Contains(cloudURL, ".convex.cloud") {
		return strings.Replace(cloudURL, ".convex.cloud", ".convex.site", 1)
	}
	return ""
}

func convexConfigured(cfg *config.Config) bool {
	return resolveConvexSiteURL(cfg) != "" || resolveConvexCloudURL(cfg) != ""
}

func joinURL(base, suffix string) string {
	base = strings.TrimRight(strings.TrimSpace(base), "/")
	if base == "" {
		return ""
	}
	return base + suffix
}

func fetchConvexHealth(siteURL string) (map[string]any, error) {
	req, err := http.NewRequest(http.MethodGet, joinURL(siteURL, "/solanaos/health"), nil)
	if err != nil {
		return nil, err
	}
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("convex %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	var payload map[string]any
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, err
	}
	if _, ok := payload["siteUrl"]; !ok {
		payload["siteUrl"] = strings.TrimSpace(siteURL)
	}
	if _, ok := payload["cloudUrl"]; !ok {
		if cloudURL := resolveConvexCloudURL(nil); cloudURL != "" {
			payload["cloudUrl"] = cloudURL
		}
	}
	return payload, nil
}

func getLocalIP() string {
	addrs, err := net.InterfaceAddrs()
	if err != nil {
		return ""
	}
	for _, addr := range addrs {
		if ipnet, ok := addr.(*net.IPNet); ok && !ipnet.IP.IsLoopback() && ipnet.IP.To4() != nil {
			return ipnet.IP.String()
		}
	}
	return ""
}

func frontendHandler(frontendDir string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cleanPath := path.Clean("/" + strings.TrimSpace(r.URL.Path))
		if cleanPath == "." {
			cleanPath = "/"
		}
		trimmed := strings.TrimPrefix(cleanPath, "/")
		target := filepath.Join(frontendDir, filepath.FromSlash(trimmed))

		if info, err := os.Stat(target); err == nil {
			if info.IsDir() {
				indexPath := filepath.Join(target, "index.html")
				if _, err := os.Stat(indexPath); err == nil {
					http.ServeFile(w, r, indexPath)
					return
				}
			} else {
				http.ServeFile(w, r, target)
				return
			}
		}

		if strings.HasPrefix(cleanPath, "/app/") || cleanPath == "/app" {
			http.ServeFile(w, r, filepath.Join(frontendDir, "app", "index.html"))
			return
		}

		http.ServeFile(w, r, filepath.Join(frontendDir, "index.html"))
	})
}

func openBrowser(url string) error {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", url)
	case "linux":
		cmd = exec.Command("xdg-open", url)
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	default:
		return fmt.Errorf("unsupported OS: %s", runtime.GOOS)
	}
	return cmd.Start()
}

func corsMiddleware(next http.Handler) http.Handler {
	// Allow specific Vercel origins in production, * in dev
	allowedOrigins := map[string]bool{
		"http://localhost:5173": true,
		"http://localhost:3000": true,
		"http://127.0.0.1:5173": true,
	}
	// Add custom frontend URL from env
	if frontendURL := os.Getenv("FRONTEND_URL"); frontendURL != "" {
		allowedOrigins[frontendURL] = true
	}
	// Add Vercel preview/production URLs
	if vercelURL := os.Getenv("VERCEL_URL"); vercelURL != "" {
		allowedOrigins["https://"+vercelURL] = true
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if allowedOrigins[origin] || os.Getenv("CORS_ALLOW_ALL") == "true" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
		} else if strings.HasPrefix(origin, "chrome-extension://") {
			w.Header().Set("Access-Control-Allow-Origin", origin)
		} else if origin == "" {
			// No origin = same-site or server-to-server — do not set wildcard
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		if r.Method == "OPTIONS" {
			w.WriteHeader(204)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func loggerMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("[%s] %s %s %s", r.Method, r.URL.Path, r.RemoteAddr, time.Since(start))
	})
}

const fallbackHTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SolanaOS Control — Console</title>
<link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#020208;color:#c8d8e8;font-family:'Share Tech Mono',monospace;min-height:100vh;display:flex;align-items:center;justify-content:center}
.container{text-align:center;padding:2rem}
h1{color:#14F195;font-size:2rem;margin-bottom:1rem}
.status{color:#9945FF;margin:1rem 0}
.info{color:#556680;font-size:0.9em}
a{color:#00d4ff;text-decoration:none}
a:hover{text-decoration:underline}
</style>
</head>
<body>
<div class="container">
  <h1>🖥️ SolanaOS Control</h1>
  <p class="status">Web Console Running</p>
  <p>API: <a href="/api/status">/api/status</a> | <a href="/api/connectors">/api/connectors</a> | <a href="/api/health">/api/health</a></p>
  <p class="info">Build the frontend with: cd web/frontend && npm run build, then restart solanaos-web.</p>
</div>
</body>
</html>`
