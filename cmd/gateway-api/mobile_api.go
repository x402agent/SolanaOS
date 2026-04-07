package main

import (
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math"
	"math/big"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

const (
	gatewayProtocolVersion = 3
	defaultSeamColorARGB   = 0xFF4F7A9A
	oodaTickInterval       = 10 * time.Second
)

type gatewayTransport string

const (
	transportWebSocketRPC  gatewayTransport = "WebSocketRpc"
	transportNativeJSONTCP gatewayTransport = "NativeJsonTcp"
)

type gatewaySetupCode struct {
	URL      string `json:"url"`
	Token    string `json:"token,omitempty"`
	Password string `json:"password,omitempty"`
}

type gatewayEndpointConfig struct {
	Host       string           `json:"host"`
	Port       int              `json:"port"`
	TLS        bool             `json:"tls"`
	Transport  gatewayTransport `json:"transport"`
	DisplayURL string           `json:"displayUrl"`
}

type authPayloadV3 struct {
	DeviceID     string
	ClientID     string
	ClientMode   string
	Role         string
	Scopes       []string
	SignedAtMs   int64
	Token        string
	Nonce        string
	Platform     string
	DeviceFamily string
}

type invokeResult struct {
	OK      bool             `json:"ok"`
	Payload json.RawMessage  `json:"payload,omitempty"`
	Error   *invokeErrResult `json:"error,omitempty"`
}

type invokeErrResult struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type parsedInvokeError struct {
	Code            string `json:"code"`
	Message         string `json:"message"`
	HadExplicitCode bool   `json:"hadExplicitCode"`
}

type deviceIdentity struct {
	DeviceID           string `json:"deviceId"`
	PublicKeyRawBase64 string `json:"publicKeyRawBase64"`
	PrivateKeyPkcs8B64 string `json:"privateKeyPkcs8Base64"`
	CreatedAtMs        int64  `json:"createdAtMs"`
	pubKey             ed25519.PublicKey
	privKey            ed25519.PrivateKey
}

type mobileAPI struct {
	cfg       config
	fleet     *fleetStore
	startedAt time.Time
	identity  *deviceIdentity

	foreground atomic.Bool
	cycle      atomic.Int64

	mu        sync.RWMutex
	watchlist []map[string]any
	trending  []map[string]any
	positions []map[string]any
	threads   []map[string]any
	chat      []map[string]any
	voiceLog  []map[string]any
}

func registerMobileAPIRoutes(mux *http.ServeMux, cfg config, fleet *fleetStore) (*mobileAPI, error) {
	api, err := newMobileAPI(cfg, fleet)
	if err != nil {
		return nil, fmt.Errorf("mobile API init: %w", err)
	}
	go api.run()

	mux.HandleFunc("/api/v1/health", withCORS(api.handleHealth))
	mux.HandleFunc("/api/v1/version", withCORS(api.handleVersion))
	mux.HandleFunc("/api/v1/runtime", withCORS(api.handleRuntime))
	mux.HandleFunc("/api/v1/state", withCORS(api.handleState))
	mux.HandleFunc("/api/v1/wallet", withCORS(api.handleWallet))
	mux.HandleFunc("/api/v1/companion", withCORS(api.handleCompanion))
	mux.HandleFunc("/api/v1/trading", withCORS(api.handleTrading))
	mux.HandleFunc("/api/v1/watchlist", withCORS(api.handleWatchlist))
	mux.HandleFunc("/api/v1/trending", withCORS(api.handleTrending))
	mux.HandleFunc("/api/v1/positions", withCORS(api.handlePositions))
	mux.HandleFunc("/api/v1/strategy", withCORS(api.handleStrategy))
	mux.HandleFunc("/api/v1/hardware", withCORS(api.handleHardware))
	mux.HandleFunc("/api/v1/services", withCORS(api.handleServices))
	mux.HandleFunc("/api/v1/threads", withCORS(api.handleThreads))
	mux.HandleFunc("/api/v1/solana", withCORS(api.handleSolana))
	mux.HandleFunc("/api/v1/chat", withCORS(api.handleChat))
	mux.HandleFunc("/api/v1/grok", withCORS(api.handleGrok))
	mux.HandleFunc("/api/v1/ore", withCORS(api.handleOre))
	mux.HandleFunc("/api/v1/voice", withCORS(api.handleVoice))
	mux.HandleFunc("/api/v1/prefs", withCORS(api.handlePrefs))
	mux.HandleFunc("/api/v1/command", withCORS(api.handleCommand))
	mux.HandleFunc("/api/v1/device", withCORS(api.handleDevice))
	mux.HandleFunc("/api/v1/notifications", withCORS(api.handleNotifications))
	mux.HandleFunc("/api/v1/canvas", withCORS(api.handleCanvas))
	mux.HandleFunc("/api/v1/identity", withCORS(api.handleIdentity))
	mux.HandleFunc("/api/v1/capabilities", withCORS(api.handleCapabilities))
	mux.HandleFunc("/api/v1/setup-code", withCORS(api.handleSetupCode))
	mux.HandleFunc("/api/v1/invoke", withCORS(api.handleInvoke))
	return api, nil
}

func registerLegacyControlRoutes(mux *http.ServeMux, api *mobileAPI) {
	mux.HandleFunc("/api/control/status", withCORS(api.handleControlStatus))
	mux.HandleFunc("/api/control/intents", withCORS(api.handleControlIntents))
	mux.HandleFunc("/api/control/threads", withCORS(api.handleControlThreads))
	mux.HandleFunc("/api/control/trade/quote", withCORS(api.handleControlQuoteTrade))
	mux.HandleFunc("/api/control/trade/stage", withCORS(api.handleControlStageTrade))
	mux.HandleFunc("/api/control/pumpfun/launch", withCORS(api.handleControlLaunchPumpfun))
	mux.HandleFunc("/api/control/pumpfun/buy", withCORS(api.handleControlBuyPumpfun))
	mux.HandleFunc("/api/control/pumpfun/sell", withCORS(api.handleControlSellPumpfun))
	mux.HandleFunc("/api/control/tokenmill/market", withCORS(api.handleControlTokenMillMarket))
	mux.HandleFunc("/api/control/openrouter/config", withCORS(api.handleControlOpenRouterConfig))
}

func newMobileAPI(cfg config, fleet *fleetStore) (*mobileAPI, error) {
	identity, err := loadOrCreateDeviceIdentity(filepath.Join(userHomeDir(), ".solanaos"))
	if err != nil {
		return nil, err
	}
	api := &mobileAPI{
		cfg:       cfg,
		fleet:     fleet,
		startedAt: time.Now(),
		identity:  identity,
		watchlist: []map[string]any{
			tokenRow("SOL", "So11111111111111111111111111111111111111112", 176.12, 5.4, 4.1e9, 8.4e10),
			tokenRow("JUP", "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", 1.42, 2.8, 1.2e8, 1.9e9),
			tokenRow("BONK", "DezXAZ8z7PnrnRJjz3wXBoRgixCa6YaB1pPB263sQ4x", 0.0000231, 8.2, 3.4e8, 1.7e9),
			tokenRow("$MAWD", randomAddress(), 0.0042, 14.9, 8.7e5, 4.2e6),
		},
		trending: []map[string]any{
			{"symbol": "BONK", "mint": randomAddress(), "price": 0.0000231, "change": 8.2, "volume": 3.4e8},
			{"symbol": "WIF", "mint": randomAddress(), "price": 2.84, "change": 5.7, "volume": 1.28e8},
			{"symbol": "POPCAT", "mint": randomAddress(), "price": 0.88, "change": 11.4, "volume": 7.6e7},
		},
		positions: []map[string]any{
			{"token": "JUP", "mint": randomAddress(), "amount": 845.3, "value": 1200.4, "pnl": 8.6, "entryPrice": 1.18},
			{"token": "$MAWD", "mint": randomAddress(), "amount": 121000, "value": 508.2, "pnl": 14.2, "entryPrice": 0.0031},
		},
		threads: []map[string]any{
			{"id": "t1", "body": "OODA cycle completed 148 simulated trades with +4.78 SOL PnL.", "summary": "OODA Cycle #247 Report", "createdAt": "2m ago", "kind": "thread"},
			{"id": "t2", "body": "BONK volume spike detected with 24h breakout continuation.", "summary": "BONK +45.2% in 24h", "createdAt": "5m ago", "kind": "market"},
		},
		chat: []map[string]any{
			{"id": "m1", "role": "system", "content": "SolanaOS Gateway connected. Chat runtime booted.", "timestamp": time.Now().Add(-2 * time.Minute).UnixMilli()},
			{"id": "m2", "role": "assistant", "content": "Ready. Ask for market data, gateway actions, or invoke commands.", "timestamp": time.Now().Add(-90 * time.Second).UnixMilli()},
		},
		voiceLog: []map[string]any{
			{"role": "system", "text": "Session created · voice: Eve · VAD: server_vad · PCM 24000Hz", "timestampMs": time.Now().Add(-30 * time.Second).UnixMilli()},
		},
	}
	api.foreground.Store(true)
	return api, nil
}

func (a *mobileAPI) run() {
	ticker := time.NewTicker(oodaTickInterval)
	defer ticker.Stop()
	phases := []string{"OODA:OBSERVE", "OODA:ORIENT", "OODA:DECIDE", "OODA:ACT"}
	for range ticker.C {
		cycle := a.cycle.Add(1)
		a.mu.Lock()
		for _, row := range a.watchlist {
			if price, ok := row["price"].(float64); ok {
				row["price"] = roundFloat(price*(1+randFloat(-0.015, 0.015)), 8)
			}
			if change, ok := row["change24h"].(float64); ok {
				row["change24h"] = roundFloat(change+randFloat(-0.8, 0.8), 2)
			}
		}
		for _, row := range a.trending {
			if price, ok := row["price"].(float64); ok {
				row["price"] = roundFloat(price*(1+randFloat(-0.025, 0.025)), 8)
			}
			if change, ok := row["change"].(float64); ok {
				row["change"] = roundFloat(change+randFloat(-1.2, 1.2), 2)
			}
		}
		a.threads = append([]map[string]any{
			{
				"id":        fmt.Sprintf("ooda-%d", cycle),
				"body":      fmt.Sprintf("%s cycle advanced to %s with updated market state.", a.runtimeStatus(cycle), phases[int(cycle)%len(phases)]),
				"summary":   fmt.Sprintf("Cycle %d", cycle),
				"createdAt": "now",
				"kind":      "runtime",
			},
		}, a.threads...)
		if len(a.threads) > 8 {
			a.threads = a.threads[:8]
		}
		a.mu.Unlock()
	}
}

func (a *mobileAPI) runtimeStatus(cycle int64) string {
	phases := []string{"OODA:OBSERVE", "OODA:ORIENT", "OODA:DECIDE", "OODA:ACT"}
	return phases[int(cycle)%len(phases)]
}

func (a *mobileAPI) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"status":   "ok",
		"uptime":   a.uptime(),
		"version":  apiVersion,
		"protocol": gatewayProtocolVersion,
		"cycle":    a.cycle.Load(),
	})
}

func (a *mobileAPI) handleVersion(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"app":       "SolanaOS",
		"version":   apiVersion,
		"protocol":  gatewayProtocolVersion,
		"arch":      "ARM64",
		"binary":    "<10MB",
		"transport": []string{string(transportWebSocketRPC), string(transportNativeJSONTCP)},
	})
}

func (a *mobileAPI) handleRuntime(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, a.runtimePayload())
}

func (a *mobileAPI) handleState(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"runtime":       a.runtimePayload(),
		"wallet":        a.walletPayload(),
		"companion":     a.companionPayload(),
		"trading":       a.tradingPayload(),
		"watchlist":     a.watchlistPayload(),
		"trending":      a.trendingPayload(),
		"positions":     a.positionsPayload(),
		"strategy":      a.strategyPayload(),
		"hardware":      a.hardwarePayload(),
		"services":      a.servicesPayload(),
		"threads":       a.threadsPayload(),
		"solana":        a.solanaPayload(),
		"grok":          a.grokPayload(),
		"ore":           a.orePayload(),
		"chat":          a.chatPayload(),
		"voice":         a.voicePayload(),
		"prefs":         a.prefsPayload(),
		"canvas":        a.canvasPayload(),
		"device":        a.devicePayload(),
		"notifications": a.notificationsPayload(),
	})
}

func (a *mobileAPI) handleWallet(w http.ResponseWriter, r *http.Request)         { writeJSON(w, http.StatusOK, a.walletPayload()) }
func (a *mobileAPI) handleCompanion(w http.ResponseWriter, r *http.Request)      { writeJSON(w, http.StatusOK, a.companionPayload()) }
func (a *mobileAPI) handleTrading(w http.ResponseWriter, r *http.Request)        { writeJSON(w, http.StatusOK, a.tradingPayload()) }
func (a *mobileAPI) handleWatchlist(w http.ResponseWriter, r *http.Request)      { writeJSON(w, http.StatusOK, a.watchlistPayload()) }
func (a *mobileAPI) handleTrending(w http.ResponseWriter, r *http.Request)       { writeJSON(w, http.StatusOK, a.trendingPayload()) }
func (a *mobileAPI) handlePositions(w http.ResponseWriter, r *http.Request)      { writeJSON(w, http.StatusOK, a.positionsPayload()) }
func (a *mobileAPI) handleStrategy(w http.ResponseWriter, r *http.Request)       { writeJSON(w, http.StatusOK, a.strategyPayload()) }
func (a *mobileAPI) handleHardware(w http.ResponseWriter, r *http.Request)       { writeJSON(w, http.StatusOK, a.hardwarePayload()) }
func (a *mobileAPI) handleServices(w http.ResponseWriter, r *http.Request)       { writeJSON(w, http.StatusOK, a.servicesPayload()) }
func (a *mobileAPI) handleDevice(w http.ResponseWriter, r *http.Request)         { writeJSON(w, http.StatusOK, a.devicePayload()) }
func (a *mobileAPI) handleNotifications(w http.ResponseWriter, r *http.Request)  { writeJSON(w, http.StatusOK, a.notificationsPayload()) }
func (a *mobileAPI) handleCanvas(w http.ResponseWriter, r *http.Request)         { writeJSON(w, http.StatusOK, a.canvasPayload()) }
func (a *mobileAPI) handlePrefs(w http.ResponseWriter, r *http.Request)          { writeJSON(w, http.StatusOK, a.prefsPayload()) }

func (a *mobileAPI) handleThreads(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodPost {
		var req struct {
			Body string `json:"body"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)
		body := strings.TrimSpace(req.Body)
		if body == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "body required"})
			return
		}
		item := map[string]any{
			"id":        fmt.Sprintf("t-%d", time.Now().UnixMilli()),
			"body":      body,
			"summary":   truncate(body, 60),
			"createdAt": "now",
			"kind":      "manual",
		}
		a.mu.Lock()
		a.threads = append([]map[string]any{item}, a.threads...)
		a.mu.Unlock()
		writeJSON(w, http.StatusOK, item)
		return
	}
	writeJSON(w, http.StatusOK, a.threadsPayload())
}

func (a *mobileAPI) handleControlStatus(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"data": map[string]any{
			"service":           "solana-control",
			"openRouter":        map[string]any{"enabled": a.cfg.openRouterModel != "", "model": a.cfg.openRouterModel},
			"threadCount":       len(a.threadsPayload()),
			"stagedIntentCount": 2,
			"features":          []string{"threads", "trade", "pumpfun", "tokenmill", "openrouter.vision"},
			"status":            "healthy",
		},
	})
}

func (a *mobileAPI) handleControlIntents(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"data": []map[string]any{
			{"id": "si1", "kind": "pumpfun_launch", "status": "pending", "summary": "Launch SEEKR · 0.10 SOL", "createdAt": "1m ago"},
			{"id": "si2", "kind": "trade", "status": "executed", "summary": "Swap 0.75 SOL → JUP", "createdAt": "12m ago"},
		},
	})
}

func (a *mobileAPI) handleControlThreads(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodPost {
		a.handleThreads(w, r)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"success": true, "data": a.threadsPayload()})
}

func (a *mobileAPI) handleControlQuoteTrade(w http.ResponseWriter, r *http.Request)     { a.handleControlOp(w, "quoteTrade", r) }
func (a *mobileAPI) handleControlStageTrade(w http.ResponseWriter, r *http.Request)     { a.handleControlOp(w, "stageTrade", r) }
func (a *mobileAPI) handleControlLaunchPumpfun(w http.ResponseWriter, r *http.Request)  { a.handleControlOp(w, "launchPumpfun", r) }
func (a *mobileAPI) handleControlBuyPumpfun(w http.ResponseWriter, r *http.Request)     { a.handleControlOp(w, "buyPumpfun", r) }
func (a *mobileAPI) handleControlSellPumpfun(w http.ResponseWriter, r *http.Request)    { a.handleControlOp(w, "sellPumpfun", r) }
func (a *mobileAPI) handleControlTokenMillMarket(w http.ResponseWriter, r *http.Request) { a.handleControlOp(w, "createTokenMill", r) }

func (a *mobileAPI) handleControlOpenRouterConfig(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"data": map[string]any{
			"configured": a.cfg.openRouterModel != "",
			"model":      a.cfg.openRouterModel,
		},
	})
}

func (a *mobileAPI) handleControlOp(w http.ResponseWriter, op string, r *http.Request) {
	var payload json.RawMessage
	if r.Body != nil {
		decoder := json.NewDecoder(r.Body)
		var raw map[string]any
		if decoder.Decode(&raw) == nil {
			payload, _ = json.Marshal(raw)
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"success": true, "data": a.processSolanaOp(op, payload)})
}

func (a *mobileAPI) handleSolana(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		writeJSON(w, http.StatusOK, a.solanaPayload())
		return
	}
	var req struct {
		Op     string          `json:"op"`
		Params json.RawMessage `json:"params"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)
	writeJSON(w, http.StatusOK, a.processSolanaOp(req.Op, req.Params))
}

func (a *mobileAPI) handleChat(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		writeJSON(w, http.StatusOK, a.chatPayload())
		return
	}
	var req struct {
		Message    string `json:"message"`
		SessionKey string `json:"sessionKey"`
		Thinking   string `json:"thinkingLevel"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)
	userMsg := map[string]any{
		"id":        fmt.Sprintf("m-%d", time.Now().UnixMilli()),
		"role":      "user",
		"content":   req.Message,
		"timestamp": time.Now().UnixMilli(),
	}
	reply := map[string]any{
		"id":        fmt.Sprintf("m-%d", time.Now().UnixMilli()+1),
		"role":      "assistant",
		"content":   fmt.Sprintf("[Gateway] %s", truncate(strings.TrimSpace(req.Message), 120)),
		"timestamp": time.Now().UnixMilli(),
	}
	a.mu.Lock()
	a.chat = append(a.chat, userMsg, reply)
	a.mu.Unlock()
	writeJSON(w, http.StatusOK, map[string]any{
		"userMessage":      userMsg,
		"assistantMessage": reply,
		"transport":        "Gateway",
		"sessionKey":       defaultString(req.SessionKey, "main"),
		"thinkingLevel":    defaultString(req.Thinking, "medium"),
	})
}

func (a *mobileAPI) handleGrok(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Op     string          `json:"op"`
		Params json.RawMessage `json:"params"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)
	writeJSON(w, http.StatusOK, a.processGrokOp(req.Op, req.Params))
}

func (a *mobileAPI) handleOre(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		writeJSON(w, http.StatusOK, a.orePayload())
		return
	}
	var req struct {
		SOLPerBlock float64 `json:"solPerBlock"`
		Blocks      int     `json:"blocks"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)
	writeJSON(w, http.StatusOK, calculateOreMiningPlan(req.SOLPerBlock, req.Blocks))
}

func (a *mobileAPI) handleVoice(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		writeJSON(w, http.StatusOK, a.voicePayload())
		return
	}
	var req struct {
		Voice        string  `json:"voice"`
		VadThreshold float64 `json:"vadThreshold"`
		SampleRate   int     `json:"sampleRate"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)
	a.mu.Lock()
	if strings.TrimSpace(req.Voice) != "" {
		a.voiceLog = append(a.voiceLog, map[string]any{
			"role":        "system",
			"text":        fmt.Sprintf("Voice changed to %s", strings.TrimSpace(req.Voice)),
			"timestampMs": time.Now().UnixMilli(),
		})
	}
	a.mu.Unlock()
	payload := a.voicePayload()
	if voice := strings.TrimSpace(req.Voice); voice != "" {
		payload["voice"] = voice
	}
	if req.VadThreshold > 0 {
		payload["vadThreshold"] = req.VadThreshold
	}
	if req.SampleRate > 0 {
		payload["sampleRate"] = req.SampleRate
	}
	writeJSON(w, http.StatusOK, payload)
}

func (a *mobileAPI) handleCommand(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Command string          `json:"command"`
		Params  json.RawMessage `json:"params"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)
	writeJSON(w, http.StatusOK, a.processCommand(req.Command, req.Params))
}

func (a *mobileAPI) handleIdentity(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"deviceId":  a.identity.DeviceID,
		"publicKey": a.identity.PublicKeyBase64URL(),
		"createdAt": a.identity.CreatedAtMs,
		"protocol":  gatewayProtocolVersion,
		"authPayload": buildAuthV3(authPayloadV3{
			DeviceID:     a.identity.DeviceID,
			ClientID:     "solanaos-seeker",
			ClientMode:   "companion",
			Role:         "operator",
			Scopes:       []string{"chat", "invoke", "canvas"},
			SignedAtMs:   time.Now().UnixMilli(),
			Nonce:        hex.EncodeToString(randBytes(8)),
			Platform:     "android",
			DeviceFamily: "seeker",
		}),
	})
}

func (a *mobileAPI) handleCapabilities(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"capabilities": []string{"canvas", "device", "notifications", "system", "camera", "sms", "voiceWake", "location", "photos", "contacts", "calendar", "motion"},
		"commands": []string{
			"canvas.present", "canvas.hide", "canvas.navigate", "canvas.eval", "canvas.snapshot",
			"canvas.a2ui.push", "canvas.a2ui.pushJSONL", "canvas.a2ui.reset",
			"system.notify", "camera.list", "camera.snap", "camera.clip", "location.get",
			"device.status", "device.info", "device.permissions", "device.health",
			"notifications.list", "notifications.actions", "photos.latest", "contacts.search", "contacts.add",
			"calendar.events", "calendar.add", "motion.activity", "motion.pedometer", "sms.send", "debug.logs", "debug.ed25519",
		},
		"flags": map[string]any{
			"cameraEnabled":           true,
			"locationEnabled":         true,
			"smsAvailable":            true,
			"voiceWakeEnabled":        true,
			"motionActivityAvailable": true,
			"motionPedometerAvailable": true,
			"debugBuild":              true,
		},
	})
}

func (a *mobileAPI) handleSetupCode(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"code":      fmt.Sprintf("%d %d %d %d %d %d", randInt(0, 9), randInt(0, 9), randInt(0, 9), randInt(0, 9), randInt(0, 9), randInt(0, 9)),
		"setupCode": generateSetupCodeV1(a.cfg, a.identity.DeviceID[:16]),
		"deviceId":  a.identity.DeviceID,
		"publicKey": a.identity.PublicKeyBase64URL(),
		"protocol":  gatewayProtocolVersion,
		"filePath":  filepath.Join(userHomeDir(), ".solanaos", "connect", "setup-code.txt"),
	})
}

func (a *mobileAPI) handleInvoke(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Command string          `json:"command"`
		Params  json.RawMessage `json:"params"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)
	writeJSON(w, http.StatusOK, a.processInvoke(req.Command, req.Params))
}

func (a *mobileAPI) runtimePayload() map[string]any {
	cycle := a.cycle.Load()
	return map[string]any{
		"status":         a.runtimeStatus(cycle),
		"cycle":          cycle,
		"network":        a.cfg.network,
		"uptime":         a.uptime(),
		"version":        apiVersion,
		"binary":         "<10MB",
		"arch":           "ARM64",
		"isConnected":    true,
		"nodeConnected":  true,
		"serverName":     "SolanaOS",
		"remoteAddress":  fmt.Sprintf("%s:%s", a.cfg.setupHost, a.cfg.setupPort),
		"seamColorArgb":  defaultSeamColorARGB,
		"mainSessionKey": "main",
	}
}

func (a *mobileAPI) walletPayload() map[string]any {
	addr := a.identity.DeviceID[:32]
	short := addr[:8] + "..." + addr[len(addr)-4:]
	return map[string]any{
		"address":     short,
		"fullAddress": addr,
		"balance":     2.4831,
		"usdValue":    437.12,
	}
}

func (a *mobileAPI) companionPayload() map[string]any {
	return map[string]any{
		"stage":         "Lobster",
		"name":          "MawdBot",
		"level":         9,
		"mood":          "HAPPY",
		"xp":            1824,
		"nextEvolution": "CyberLobster",
	}
}

func (a *mobileAPI) tradingPayload() map[string]any {
	return map[string]any{
		"active":      true,
		"pnl24h":      4.78,
		"trades24h":   148,
		"winRate":     0.64,
		"fees24h":     0.19,
		"mode":        "autonomous",
		"slippageBps": 50,
	}
}

func (a *mobileAPI) watchlistPayload() []map[string]any {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return cloneRows(a.watchlist)
}

func (a *mobileAPI) trendingPayload() []map[string]any {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return cloneRows(a.trending)
}

func (a *mobileAPI) positionsPayload() []map[string]any {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return cloneRows(a.positions)
}

func (a *mobileAPI) strategyPayload() map[string]any {
	return map[string]any{
		"name":       "RSI+EMA Crossover",
		"rsiPeriod":  14,
		"emaFast":    9,
		"emaSlow":    21,
		"maxPosition": 5.0,
		"stopLoss":   0.05,
		"takeProfit": 0.15,
		"signals":    []string{"RSI oversold", "EMA bullish cross"},
	}
}

func (a *mobileAPI) hardwarePayload() any {
	return a.fleet.snapshot()
}

func (a *mobileAPI) servicesPayload() []map[string]any {
	return []map[string]any{
		{"name": "Gateway", "status": "running", "port": mustAtoi(a.cfg.port), "uptime": a.uptime()},
		{"name": "Canvas", "status": "running", "port": 18791, "uptime": a.uptime()},
		{"name": "OODA Loop", "status": "active"},
		{"name": "Helius RPC", "status": "connected"},
		{"name": "Jupiter Swap", "status": "ready"},
		{"name": "Control API", "status": "ready"},
	}
}

func (a *mobileAPI) threadsPayload() []map[string]any {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return cloneRows(a.threads)
}

func (a *mobileAPI) solanaPayload() map[string]any {
	return map[string]any{
		"controlConnected":  true,
		"controlBaseUrl":    "/api/control",
		"trackerConfigured": true,
		"trackerStreamConnected": true,
		"datastreamConnected":    true,
		"trackerStatusText":      "Connected · streaming",
		"rpcSlot":                258400000 + a.cycle.Load(),
		"dexBoard":               a.watchlistPayload(),
		"searchResults": []map[string]any{
			{"mint": randomAddress(), "symbol": "TRUMP", "name": "TRUMP", "price": 14.23, "marketCap": 1.42e10, "liquidity": 2.4e6},
			{"mint": randomAddress(), "symbol": "JUP", "name": "Jupiter", "price": 1.42, "marketCap": 1.9e9, "liquidity": 1.8e7},
		},
		"selectedToken": map[string]any{
			"mint":       randomAddress(),
			"symbol":     "TRUMP",
			"name":       "TRUMP",
			"price":      14.23,
			"marketCap":  1.42e10,
			"liquidity":  2.4e6,
			"holders":    234000,
			"buys24h":    45000,
			"sells24h":   23000,
			"priceChange1m":  0.3,
			"priceChange5m":  1.2,
			"priceChange1h":  -0.8,
			"priceChange24h": 5.2,
			"risk": map[string]any{
				"rugged":           false,
				"top10HolderPercent": 18.4,
				"devHolderPercent":   0.1,
				"bundlerPercent":     2.3,
				"sniperPercent":      4.1,
			},
		},
		"stagedIntents": []map[string]any{
			{"id": "si1", "kind": "pumpfun_launch", "status": "pending", "body": "Launch SEEKR · 0.10 SOL"},
			{"id": "si2", "kind": "trade", "status": "executed", "body": "Swap 0.75 SOL → JUP"},
		},
		"datastreamEvents": []map[string]any{
			{"kind": "latestMessage", "mint": randomAddress(), "symbol": "SEEKR", "price": 0.0042, "amount": 0, "side": "", "timestamp": time.Now().UnixMilli()},
			{"kind": "tokenTxMessage", "mint": randomAddress(), "symbol": "TRUMP", "price": 14.21, "amount": 0.5, "side": "BUY", "timestamp": time.Now().UnixMilli()},
		},
	}
}

func (a *mobileAPI) grokPayload() map[string]any {
	return map[string]any{
		"available":  a.cfg.xaiKey != "",
		"model":      "grok-4.20-reasoning",
		"imageModel": "grok-imagine-image",
	}
}

func (a *mobileAPI) orePayload() map[string]any {
	return map[string]any{
		"walletReady":  true,
		"solBalance":   2.4831,
		"rpcLabel":     rpcLabel(a.cfg.heliusRPC),
		"miningActive": false,
		"currentRound": calculateOreMiningPlan(0.01, 5),
	}
}

func (a *mobileAPI) chatPayload() map[string]any {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return map[string]any{
		"transport":     "Gateway",
		"sessionKey":    "main",
		"thinkingLevel": "medium",
		"messages":      cloneRows(a.chat),
		"sessions":      []string{"main", "global"},
	}
}

func (a *mobileAPI) voicePayload() map[string]any {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return map[string]any{
		"connected":   false,
		"voice":       "Eve",
		"isListening": true,
		"isSpeaking":  false,
		"vadThreshold": 0.5,
		"sampleRate":   24000,
		"transcript":   cloneRows(a.voiceLog),
	}
}

func (a *mobileAPI) prefsPayload() map[string]any {
	return map[string]any{
		"instanceId":               a.identity.DeviceID[:8],
		"displayName":              "Seeker Node",
		"cameraEnabled":            true,
		"locationMode":             "whileUsing",
		"locationPreciseEnabled":   true,
		"preventSleep":             true,
		"autoStartOnBoot":          true,
		"darkMode":                 true,
		"voiceWakeMode":            "foreground",
		"wakeWords":                []string{"solanaos", "seeker"},
		"talkEnabled":              false,
		"speakerEnabled":           true,
		"onboardingCompleted":      true,
		"rewardsWaitlistJoined":    false,
		"canvasDebugStatusEnabled": false,
	}
}

func (a *mobileAPI) canvasPayload() map[string]any {
	return map[string]any{
		"currentUrl":       "",
		"a2uiHydrated":     true,
		"rehydratePending": false,
	}
}

func (a *mobileAPI) devicePayload() map[string]any {
	return map[string]any{
		"battery": map[string]any{
			"level":               0.87,
			"state":               "charging",
			"lowPowerModeEnabled": false,
			"temperatureC":        31.2,
			"chargingType":        "usb",
			"currentMa":           -450,
		},
		"thermal": "nominal",
		"memory": map[string]any{
			"pressure":          "normal",
			"totalRamBytes":     int64(8 * 1024 * 1024 * 1024),
			"availableRamBytes": int64(5 * 1024 * 1024 * 1024),
			"usedRamBytes":      int64(3 * 1024 * 1024 * 1024),
			"lowMemory":         false,
		},
		"network": map[string]any{
			"status":        "satisfied",
			"isExpensive":   false,
			"isConstrained": false,
			"interfaces":    []string{"wifi"},
		},
		"storage": map[string]any{
			"totalBytes": int64(137438953472),
			"freeBytes":  int64(92341796864),
			"usedBytes":  int64(45097156608),
		},
		"uptimeSeconds": math.Round(time.Since(a.startedAt).Seconds()),
		"permissions": map[string]any{
			"camera":               map[string]any{"status": "granted", "promptable": false},
			"microphone":           map[string]any{"status": "granted", "promptable": false},
			"location":             map[string]any{"status": "granted", "promptable": false},
			"sms":                  map[string]any{"status": "granted", "promptable": false},
			"notificationListener": map[string]any{"status": "granted", "promptable": false},
			"notifications":        map[string]any{"status": "granted", "promptable": false},
			"photos":               map[string]any{"status": "granted", "promptable": false},
			"contacts":             map[string]any{"status": "denied", "promptable": true},
			"calendar":             map[string]any{"status": "denied", "promptable": true},
			"motion":               map[string]any{"status": "granted", "promptable": false},
		},
	}
}

func (a *mobileAPI) notificationsPayload() map[string]any {
	return map[string]any{
		"enabled":   true,
		"connected": true,
		"notifications": []map[string]any{
			{"key": "notif-1", "packageName": "org.telegram.messenger", "title": "MawdBot", "text": "Trade staged", "category": "msg", "postTimeMs": time.Now().Add(-1 * time.Minute).UnixMilli(), "isOngoing": false, "isClearable": true},
		},
	}
}

func (a *mobileAPI) processSolanaOp(op string, params json.RawMessage) any {
	switch op {
	case "searchTokens":
		return a.solanaPayload()["searchResults"]
	case "tokenDetail":
		return a.solanaPayload()["selectedToken"]
	case "quoteTrade":
		var req struct {
			From        string  `json:"from"`
			To          string  `json:"to"`
			Amount      float64 `json:"amount"`
			SlippageBps int     `json:"slippageBps"`
		}
		_ = json.Unmarshal(params, &req)
		return map[string]any{
			"inputMint":      req.From,
			"outputMint":     req.To,
			"expectedOutput": roundFloat(req.Amount*0.704, 4),
			"priceImpact":    0.003,
			"slippageBps":    req.SlippageBps,
			"route":          "Jupiter V6",
		}
	case "stageTrade":
		return map[string]any{"id": fmt.Sprintf("si-%d", time.Now().UnixMilli()), "kind": "trade", "status": "staged"}
	case "launchPumpfun":
		return map[string]any{"status": "staged", "platform": "pump.fun"}
	case "buyPumpfun", "sellPumpfun":
		return map[string]any{"status": "staged", "side": strings.TrimSuffix(op, "Pumpfun")}
	case "createTokenMill":
		return map[string]any{"status": "staged", "platform": "tokenmill"}
	case "mintNFT":
		return map[string]any{"status": "minted", "mint": randomAddress()}
	case "parseSolanaPay":
		return map[string]any{"parsed": true}
	case "dexBoard":
		return a.watchlistPayload()
	case "datastreamEvents":
		return a.solanaPayload()["datastreamEvents"]
	case "dexSwapPreview":
		return map[string]any{
			"inputAmountUi":  "0.05",
			"inputSymbol":    "SOL",
			"outputAmountUi": "2380",
			"outputSymbol":   "TOKEN",
			"slippageBps":    100,
			"priceImpactPct": 0.0012,
			"routeCount":     3,
			"contextSlot":    258400000 + a.cycle.Load(),
		}
	case "dexSwapExecute":
		return map[string]any{"status": "submitted", "txHash": randomAddress()}
	case "refreshOverview":
		return map[string]any{"ok": true, "action": "refreshSolanaTrackerOverview"}
	case "refreshTrending":
		return map[string]any{"ok": true, "action": "refreshSolanaTrackerTrending"}
	case "analyzeToken":
		return map[string]any{"content": "SolanaTrackerAnalysisResult: Token analysis complete", "generatedAtMs": time.Now().UnixMilli()}
	default:
		return map[string]string{"error": "unknown op: " + op}
	}
}

func (a *mobileAPI) processGrokOp(op string, params json.RawMessage) any {
	switch op {
	case "search":
		var req struct {
			Query string `json:"query"`
			Mode  string `json:"mode"`
		}
		_ = json.Unmarshal(params, &req)
		return map[string]any{"content": fmt.Sprintf("Search results for: %s", req.Query), "citations": []string{"solana.com", "ore.supply", "x.com"}, "model": "grok-4.20-reasoning", "mode": req.Mode}
	case "respond":
		var req struct {
			Prompt string `json:"prompt"`
		}
		_ = json.Unmarshal(params, &req)
		return map[string]any{"content": fmt.Sprintf("Response to: %s", truncate(req.Prompt, 80)), "model": "grok-4.20-reasoning"}
	case "generateImage":
		var req struct {
			Prompt      string `json:"prompt"`
			AspectRatio string `json:"aspectRatio"`
		}
		_ = json.Unmarshal(params, &req)
		return map[string]any{"prompt": req.Prompt, "base64": "", "model": "grok-imagine-image", "aspectRatio": req.AspectRatio}
	case "codeExecution":
		return map[string]any{"output": "# Code execution result\n...", "language": "python"}
	default:
		return map[string]string{"error": "unknown grok op"}
	}
}

func (a *mobileAPI) processCommand(command string, params json.RawMessage) any {
	switch command {
	case "connect":
		return map[string]any{"ok": true, "message": "connected"}
	case "disconnect":
		return map[string]any{"ok": true, "message": "disconnected"}
	case "setForeground":
		var req struct {
			Value bool `json:"value"`
		}
		_ = json.Unmarshal(params, &req)
		a.foreground.Store(req.Value)
		return map[string]any{"ok": true}
	case "requestCanvasRehydrate":
		return map[string]any{"ok": true, "message": "rehydrate requested"}
	default:
		return map[string]any{"ok": false, "message": "unknown command: " + command}
	}
}

func (a *mobileAPI) processInvoke(command string, params json.RawMessage) invokeResult {
	switch command {
	case "device.status":
		return invokeOK(a.devicePayload())
	case "device.info":
		return invokeOK(map[string]any{"deviceName": "Seeker Node", "modelIdentifier": "seeker", "systemName": "Android", "systemVersion": "15", "appVersion": apiVersion, "appBuild": "1", "locale": "en-US"})
	case "device.permissions":
		return invokeOK(map[string]any{"permissions": a.devicePayload()["permissions"]})
	case "device.health":
		device := a.devicePayload()
		return invokeOK(map[string]any{"memory": device["memory"], "battery": device["battery"], "power": map[string]any{"dozeModeEnabled": false, "lowPowerModeEnabled": false}, "system": map[string]any{"securityPatchLevel": "2026-02-01"}})
	case "notifications.list":
		return invokeOK(a.notificationsPayload())
	case "notifications.actions":
		var req struct {
			Key      string `json:"key"`
			Action   string `json:"action"`
			ReplyText string `json:"replyText"`
		}
		_ = json.Unmarshal(params, &req)
		if strings.TrimSpace(req.Key) == "" {
			return invokeError("INVALID_REQUEST", "key required")
		}
		if strings.TrimSpace(req.Action) == "" {
			return invokeError("INVALID_REQUEST", "action required")
		}
		return invokeOK(map[string]any{"ok": true, "key": req.Key, "action": req.Action})
	case "system.notify":
		return invokeOK(nil)
	case "location.get":
		if !a.foreground.Load() {
			return invokeError("LOCATION_BACKGROUND_UNAVAILABLE", "location requires foreground")
		}
		return invokeOK(map[string]any{"lat": 40.4420, "lon": -74.4247, "accuracyMeters": 12.4, "timestamp": time.Now().Format(time.RFC3339), "isPrecise": true, "source": "gps"})
	case "motion.activity":
		return invokeOK(map[string]any{"activities": []map[string]any{{"startISO": time.Now().Add(-2 * time.Second).Format(time.RFC3339), "endISO": time.Now().Format(time.RFC3339), "confidence": "high", "isWalking": true}}})
	case "motion.pedometer":
		return invokeOK(map[string]any{"startISO": a.startedAt.Format(time.RFC3339), "endISO": time.Now().Format(time.RFC3339), "steps": 4821})
	case "sms.send":
		var req struct {
			To      string `json:"to"`
			Message string `json:"message"`
		}
		_ = json.Unmarshal(params, &req)
		if strings.TrimSpace(req.To) == "" {
			return invokeError("INVALID_REQUEST", "'to' phone number required")
		}
		if strings.TrimSpace(req.Message) == "" {
			return invokeError("INVALID_REQUEST", "'message' text required")
		}
		return invokeOK(map[string]any{"ok": true, "to": req.To})
	case "photos.latest":
		return invokeOK(map[string]any{"photos": []any{}})
	case "contacts.search":
		return invokeOK(map[string]any{"contacts": []any{}})
	case "contacts.add", "calendar.add":
		return invokeOK(map[string]any{"ok": true})
	case "calendar.events":
		return invokeOK(map[string]any{"events": []any{}})
	case "canvas.present", "canvas.hide", "canvas.navigate", "canvas.a2ui.push", "canvas.a2ui.pushJSONL", "canvas.a2ui.reset":
		return invokeOK(nil)
	case "canvas.eval":
		return invokeOK(map[string]any{"result": "undefined"})
	case "canvas.snapshot":
		return invokeOK(map[string]any{"format": "jpeg", "base64": ""})
	case "camera.list":
		return invokeOK(map[string]any{"cameras": []map[string]string{{"id": "back", "facing": "back"}, {"id": "front", "facing": "front"}}})
	case "camera.snap":
		return invokeOK(map[string]any{"format": "jpeg", "base64": "", "width": 1920, "height": 1080})
	case "camera.clip":
		return invokeOK(map[string]any{"format": "mp4", "durationMs": 3000})
	case "voicewake.get":
		return invokeOK(map[string]any{"triggers": []string{"solanaos", "seeker"}})
	case "voicewake.set":
		var req struct {
			Triggers []string `json:"triggers"`
		}
		_ = json.Unmarshal(params, &req)
		return invokeOK(map[string]any{"triggers": sanitizeWakeWords(req.Triggers)})
	case "debug.ed25519":
		payload := "test-payload"
		signature := a.identity.SignPayload(payload)
		return invokeOK(map[string]any{"payload": payload, "signature": signature, "verified": a.identity.VerifySignature(payload, signature)})
	case "debug.logs":
		return invokeOK(map[string]any{"logs": "gateway log output..."})
	default:
		return invokeError("INVALID_REQUEST", "unknown command: "+command)
	}
}

func calculateOreMiningPlan(solPerBlock float64, blocks int) map[string]any {
	if blocks < 1 {
		blocks = 1
	}
	if blocks > 25 {
		blocks = 25
	}
	total := solPerBlock * float64(blocks)
	coverage := float64(blocks) / 25.0
	strategy := "Wide Coverage"
	risk := "Low — broad exposure"
	switch {
	case blocks == 1:
		strategy = "Single Block"
		risk = "Very High — 4% coverage, high volatility"
	case blocks <= 3:
		strategy = "Concentrated"
		risk = "High — limited spread"
	case blocks <= 8:
		strategy = "Balanced"
		risk = "Medium — reasonable diversification"
	case blocks <= 15:
		strategy = "Diversified"
		risk = "Low-Medium — good coverage"
	}
	return map[string]any{
		"blocks":      blocks,
		"solPerBlock": solPerBlock,
		"solTotal":    roundFloat(total, 4),
		"coverage":    roundFloat(coverage, 4),
		"strategy":    strategy,
		"risk":        risk,
	}
}

func generateSetupCodeV1(cfg config, token string) string {
	scheme := "ws"
	if cfg.setupTLS {
		scheme = "wss"
	}
	payload, _ := json.Marshal(gatewaySetupCode{
		URL:   fmt.Sprintf("%s://%s:%s", scheme, cfg.setupHost, cfg.setupPort),
		Token: token,
	})
	return base64.RawURLEncoding.EncodeToString(payload)
}

func decodeGatewaySetupCode(rawInput string) (*gatewaySetupCode, error) {
	trimmed := strings.TrimSpace(rawInput)
	if trimmed == "" {
		return nil, fmt.Errorf("empty setup code")
	}
	padded := strings.NewReplacer("-", "+", "_", "/").Replace(trimmed)
	if remainder := len(padded) % 4; remainder != 0 {
		padded += strings.Repeat("=", 4-remainder)
	}
	decoded, err := base64.StdEncoding.DecodeString(padded)
	if err != nil {
		return nil, err
	}
	var payload gatewaySetupCode
	if err := json.Unmarshal(decoded, &payload); err != nil {
		return nil, err
	}
	if strings.TrimSpace(payload.URL) == "" {
		return nil, fmt.Errorf("missing url")
	}
	return &payload, nil
}

func parseGatewayEndpoint(rawInput string) (*gatewayEndpointConfig, error) {
	raw := strings.TrimSpace(rawInput)
	if raw == "" {
		return nil, fmt.Errorf("empty endpoint")
	}
	normalized := raw
	if !strings.Contains(raw, "://") {
		normalized = "https://" + raw
	}
	parsed, err := url.Parse(normalized)
	if err != nil {
		return nil, err
	}
	host := strings.TrimSpace(parsed.Hostname())
	if host == "" {
		return nil, fmt.Errorf("empty host")
	}
	scheme := strings.ToLower(strings.TrimSpace(parsed.Scheme))
	tlsEnabled := scheme != "http" && scheme != "ws"
	transport := transportWebSocketRPC
	if scheme == "http" {
		transport = transportNativeJSONTCP
	}
	port := 18790
	if parsed.Port() != "" {
		p, err := strconv.Atoi(parsed.Port())
		if err == nil && p >= 1 && p <= 65535 {
			port = p
		}
	}
	displayScheme := "https"
	if !tlsEnabled {
		displayScheme = "http"
	}
	return &gatewayEndpointConfig{
		Host:       host,
		Port:       port,
		TLS:        tlsEnabled,
		Transport:  transport,
		DisplayURL: fmt.Sprintf("%s://%s:%d", displayScheme, host, port),
	}, nil
}

func composeGatewayManualURL(hostInput, portInput string, useTLS bool) string {
	host := strings.TrimSpace(hostInput)
	port, err := strconv.Atoi(strings.TrimSpace(portInput))
	if err != nil || host == "" || port < 1 || port > 65535 {
		return ""
	}
	scheme := "https"
	if !useTLS {
		scheme = "http"
	}
	return fmt.Sprintf("%s://%s:%d", scheme, host, port)
}

func buildAuthV3(p authPayloadV3) string {
	return strings.Join([]string{
		"v3",
		strings.TrimSpace(p.DeviceID),
		strings.TrimSpace(p.ClientID),
		strings.TrimSpace(p.ClientMode),
		strings.TrimSpace(p.Role),
		strings.Join(normalizeScopes(p.Scopes), ","),
		strconv.FormatInt(p.SignedAtMs, 10),
		strings.TrimSpace(p.Token),
		strings.TrimSpace(p.Nonce),
		normalizeMetadataField(p.Platform),
		normalizeMetadataField(p.DeviceFamily),
	}, "|")
}

func normalizeScopes(scopes []string) []string {
	seen := make(map[string]struct{}, len(scopes))
	out := make([]string, 0, len(scopes))
	for _, scope := range scopes {
		scope = strings.TrimSpace(scope)
		if scope == "" {
			continue
		}
		if _, ok := seen[scope]; ok {
			continue
		}
		seen[scope] = struct{}{}
		out = append(out, scope)
	}
	return out
}

func normalizeMetadataField(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	var builder strings.Builder
	builder.Grow(len(value))
	for i := 0; i < len(value); i++ {
		ch := value[i]
		if ch >= 'A' && ch <= 'Z' {
			builder.WriteByte(ch + 32)
			continue
		}
		builder.WriteByte(ch)
	}
	return builder.String()
}

func normalizeFingerprint(raw string) string {
	s := strings.TrimSpace(raw)
	for _, prefix := range []string{"sha-256:", "sha256:", "sha-256 ", "sha256 "} {
		if strings.HasPrefix(strings.ToLower(s), prefix) {
			s = s[len(prefix):]
			break
		}
	}
	var out strings.Builder
	for _, ch := range strings.ToLower(s) {
		if (ch >= '0' && ch <= '9') || (ch >= 'a' && ch <= 'f') {
			out.WriteRune(ch)
		}
	}
	return out.String()
}

func parseInvokeErrorMessage(raw string) parsedInvokeError {
	trimmed := strings.Join(strings.Fields(strings.TrimSpace(raw)), " ")
	if trimmed == "" {
		return parsedInvokeError{Code: "UNAVAILABLE", Message: "error"}
	}
	if parsed, ok := parseExplicitInvokeError(trimmed); ok {
		return parsed
	}
	if idx := strings.Index(trimmed, ":"); idx > 0 {
		if parsed, ok := parseExplicitInvokeError(strings.TrimSpace(trimmed[idx+1:])); ok {
			return parsed
		}
	}
	return parsedInvokeError{Code: "UNAVAILABLE", Message: trimmed}
}

func parseExplicitInvokeError(raw string) (parsedInvokeError, bool) {
	if idx := strings.Index(raw, ":"); idx > 0 {
		code := strings.TrimSpace(raw[:idx])
		message := strings.TrimSpace(raw[idx+1:])
		if isExplicitCode(code) {
			if message == "" {
				message = humanizeInvokeErrorCode(code)
			}
			return parsedInvokeError{Code: code, Message: message, HadExplicitCode: true}, true
		}
	}
	if strings.HasPrefix(raw, "[") {
		if idx := strings.Index(raw, "]"); idx > 0 {
			code := raw[1:idx]
			message := strings.TrimSpace(raw[idx+1:])
			if isExplicitCode(code) {
				if message == "" {
					message = humanizeInvokeErrorCode(code)
				}
				return parsedInvokeError{Code: code, Message: message, HadExplicitCode: true}, true
			}
		}
	}
	return parsedInvokeError{}, false
}

func isExplicitCode(code string) bool {
	if code == "" || code[0] < 'A' || code[0] > 'Z' {
		return false
	}
	for _, ch := range code {
		if !((ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9') || ch == '_') {
			return false
		}
	}
	return true
}

func humanizeInvokeErrorCode(code string) string {
	parts := strings.Split(strings.ToLower(code), "_")
	for i, part := range parts {
		if part == "" {
			continue
		}
		parts[i] = strings.ToUpper(part[:1]) + part[1:]
	}
	return strings.Join(parts, " ")
}

func bonjourDecode(input string) string {
	if input == "" {
		return input
	}
	var out []byte
	for i := 0; i < len(input); {
		if input[i] == '\\' && i+3 < len(input) && isDigit(input[i+1]) && isDigit(input[i+2]) && isDigit(input[i+3]) {
			value := int(input[i+1]-'0')*100 + int(input[i+2]-'0')*10 + int(input[i+3]-'0')
			if value >= 0 && value <= 255 {
				out = append(out, byte(value))
				i += 4
				continue
			}
		}
		out = append(out, input[i])
		i++
	}
	return string(out)
}

func sanitizeWakeWords(words []string) []string {
	out := make([]string, 0, len(words))
	for _, word := range words {
		word = strings.TrimSpace(word)
		if word == "" {
			continue
		}
		if len(word) > 64 {
			word = word[:64]
		}
		out = append(out, word)
		if len(out) == 32 {
			break
		}
	}
	if len(out) == 0 {
		return []string{"solanaos", "seeker"}
	}
	return out
}

func loadOrCreateDeviceIdentity(dataDir string) (*deviceIdentity, error) {
	path := filepath.Join(dataDir, "identity", "device.json")
	if raw, err := os.ReadFile(path); err == nil {
		var identity deviceIdentity
		if json.Unmarshal(raw, &identity) == nil {
			pub, pubErr := base64.StdEncoding.DecodeString(identity.PublicKeyRawBase64)
			privRaw, privErr := base64.StdEncoding.DecodeString(identity.PrivateKeyPkcs8B64)
			if pubErr == nil && privErr == nil {
				parsed, parseErr := x509.ParsePKCS8PrivateKey(privRaw)
				if parseErr == nil {
					if priv, ok := parsed.(ed25519.PrivateKey); ok {
						identity.pubKey = ed25519.PublicKey(pub)
						identity.privKey = priv
						identity.DeviceID = sha256Hex(pub)
						return &identity, nil
					}
				}
			}
		}
	}

	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return nil, err
	}
	privPKCS8, err := x509.MarshalPKCS8PrivateKey(priv)
	if err != nil {
		return nil, err
	}
	identity := &deviceIdentity{
		DeviceID:           sha256Hex(pub),
		PublicKeyRawBase64: base64.StdEncoding.EncodeToString(pub),
		PrivateKeyPkcs8B64: base64.StdEncoding.EncodeToString(privPKCS8),
		CreatedAtMs:        time.Now().UnixMilli(),
		pubKey:             pub,
		privKey:            priv,
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return nil, err
	}
	encoded, _ := json.Marshal(identity)
	if err := os.WriteFile(path, encoded, 0o600); err != nil {
		return nil, err
	}
	return identity, nil
}

func (d *deviceIdentity) SignPayload(payload string) string {
	return base64.RawURLEncoding.EncodeToString(ed25519.Sign(d.privKey, []byte(payload)))
}

func (d *deviceIdentity) VerifySignature(payload, signature string) bool {
	raw, err := base64.RawURLEncoding.DecodeString(signature)
	if err != nil {
		return false
	}
	return ed25519.Verify(d.pubKey, []byte(payload), raw)
}

func (d *deviceIdentity) PublicKeyBase64URL() string {
	return base64.RawURLEncoding.EncodeToString(d.pubKey)
}

func sha256Hex(input []byte) string {
	sum := sha256.Sum256(input)
	return hex.EncodeToString(sum[:])
}

func invokeOK(payload any) invokeResult {
	var raw json.RawMessage
	if payload != nil {
		encoded, _ := json.Marshal(payload)
		raw = encoded
	}
	return invokeResult{OK: true, Payload: raw}
}

func invokeError(code, message string) invokeResult {
	return invokeResult{OK: false, Error: &invokeErrResult{Code: code, Message: message}}
}

func tokenRow(symbol, mint string, price, change, volume, marketCap float64) map[string]any {
	return map[string]any{
		"symbol":    symbol,
		"mint":      mint,
		"price":     roundFloat(price, 8),
		"change24h": roundFloat(change, 2),
		"volume24h": volume,
		"marketCap": marketCap,
	}
}

func cloneRows(rows []map[string]any) []map[string]any {
	out := make([]map[string]any, 0, len(rows))
	for _, row := range rows {
		cp := make(map[string]any, len(row))
		for key, value := range row {
			cp[key] = value
		}
		out = append(out, cp)
	}
	return out
}

func rpcLabel(raw string) string {
	switch {
	case strings.Contains(raw, "solanatracker"):
		return "Tracker"
	case strings.Contains(raw, "helius"):
		return "Helius"
	case strings.Contains(raw, "mainnet-beta"):
		return "Solana"
	default:
		return "Custom"
	}
}

func defaultString(value, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return value
}

func userHomeDir() string {
	home, err := os.UserHomeDir()
	if err != nil || strings.TrimSpace(home) == "" {
		return "."
	}
	return home
}

func randInt(min, max int) int {
	n, _ := rand.Int(rand.Reader, big.NewInt(int64(max-min+1)))
	return int(n.Int64()) + min
}

func randFloat(min, max float64) float64 {
	n, _ := rand.Int(rand.Reader, big.NewInt(10000))
	return min + (max-min)*float64(n.Int64())/10000
}

func randBytes(n int) []byte {
	buffer := make([]byte, n)
	_, _ = rand.Read(buffer)
	return buffer
}

func randomAddress() string {
	buffer := make([]byte, 33)
	_, _ = rand.Read(buffer)
	encoded := base64.RawStdEncoding.EncodeToString(buffer)
	if len(encoded) > 44 {
		return encoded[:44]
	}
	return encoded
}

func truncate(value string, maxLen int) string {
	if len(value) <= maxLen {
		return value
	}
	return value[:maxLen] + "..."
}

func mustAtoi(raw string) int {
	value, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil {
		return 0
	}
	return value
}

func isDigit(value byte) bool {
	return value >= '0' && value <= '9'
}

func (a *mobileAPI) uptime() string {
	elapsed := time.Since(a.startedAt)
	hours := int(elapsed.Hours())
	minutes := int(elapsed.Minutes()) % 60
	return fmt.Sprintf("%dh %dm", hours, minutes)
}
