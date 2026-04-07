package main

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"
)

const (
	defaultPort = "18790"
	apiVersion  = "3.1.0"
)

type config struct {
	port       string
	websiteDir string
	setupHost  string
	setupPort  string
	setupTLS   bool
	apiKey     string
	network    string
	heliusRPC  string
	xaiKey     string
	openRouterModel string
}

type setupCodeResponse struct {
	Code      string `json:"code"`
	ExpiresAt string `json:"expiresAt"`
	URL       string `json:"url"`
}

type setupCodePayload struct {
	URL string `json:"url"`
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
		devices: []bitaxeDeviceSnapshot{
			{
				ID:             "bitaxe-gamma-001",
				IP:             "192.168.1.42",
				State:          "mining",
				Health:         "online",
				PoolURL:        "stratum+tcp://ocean.xyz",
				PoolPort:       3334,
				PoolUser:       "mawdbot.worker1",
				HashRate:       1.28,
				Temp:           58.4,
				Power:          16.2,
				FrequencyMHz:   600,
				FanSpeed:       72,
				FanRPM:         5760,
				SharesAccepted: 1842,
				SharesRejected: 11,
				UptimeHours:    137.4,
			},
			{
				ID:             "orin-nano-001",
				IP:             "192.168.1.55",
				State:          "online",
				Health:         "online",
				PoolURL:        "",
				PoolPort:       0,
				PoolUser:       "",
				HashRate:       0,
				Temp:           41.2,
				Power:          11.8,
				FrequencyMHz:   0,
				FanSpeed:       38,
				FanRPM:         2100,
				SharesAccepted: 0,
				SharesRejected: 0,
				UptimeHours:    512.9,
			},
		},
	}
}

func (s *fleetStore) snapshot() bitaxeFleetSnapshot {
	s.mu.RLock()
	defer s.mu.RUnlock()

	out := make([]bitaxeDeviceSnapshot, len(s.devices))
	copy(out, s.devices)

	var online int
	var hashRate float64
	var temp float64
	var power float64
	var shares int
	for _, device := range out {
		if !strings.EqualFold(device.Health, "offline") {
			online++
		}
		hashRate += device.HashRate
		temp += device.Temp
		power += device.Power
		shares += device.SharesAccepted
	}

	avgTemp := 0.0
	if len(out) > 0 {
		avgTemp = temp / float64(len(out))
	}

	return bitaxeFleetSnapshot{
		TotalDevices:  len(out),
		OnlineDevices: online,
		TotalHashRate: roundFloat(hashRate, 2),
		AvgTemp:       roundFloat(avgTemp, 2),
		TotalPower:    roundFloat(power, 2),
		TotalShares:   shares,
		Devices:       out,
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

func main() {
	cfg := loadConfig()
	fleet := newFleetStore()

	mux := http.NewServeMux()
	api, err := registerMobileAPIRoutes(mux, cfg, fleet)
	if err != nil {
		log.Fatalf("failed to start mobile API: %v", err)
	}
	mux.HandleFunc("/health", withCORS(func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{
			"status":      "healthy",
			"service":     "solanaos-gateway-api",
			"version":     apiVersion,
			"websiteDir":  cfg.websiteDir,
			"controlAPI":  "/api/control/status",
			"fleetAPI":    "/api/fleet",
			"setupCodeAPI": "/api/setup-code",
		})
	}))
	mux.HandleFunc("/api/setup-code", withCORS(func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, generateSetupCode(cfg))
	}))
	mux.HandleFunc("/api/fleet", withCORS(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeError(w, http.StatusMethodNotAllowed, "GET required")
			return
		}
		if !checkAPIKey(w, r, cfg.apiKey) {
			return
		}
		writeJSON(w, http.StatusOK, fleet.snapshot())
	}))
	mux.HandleFunc("/api/fleet/device/", withCORS(func(w http.ResponseWriter, r *http.Request) {
		if !checkAPIKey(w, r, cfg.apiKey) {
			return
		}
		handleFleetDevice(w, r, fleet)
	}))
	mux.Handle("/", http.FileServer(http.Dir(cfg.websiteDir)))
	registerLegacyControlRoutes(mux, api)

	addr := ":" + cfg.port
	log.Printf("solanaos-gateway-api listening on %s", addr)
	log.Printf("website: http://127.0.0.1%s/", addr)
	log.Printf("health:  http://127.0.0.1%s/health", addr)
	log.Printf("status:  http://127.0.0.1%s/api/control/status", addr)
	log.Printf("threads: http://127.0.0.1%s/api/control/threads", addr)
	log.Printf("fleet:   http://127.0.0.1%s/api/fleet", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatal(err)
	}
}

func loadConfig() config {
	port := strings.TrimSpace(os.Getenv("SOLANAOS_PORT"))
	if port == "" {
		port = defaultPort
	}

	setupHost := strings.TrimSpace(os.Getenv("SOLANAOS_GATEWAY_HOST"))
	if setupHost == "" {
		setupHost = "127.0.0.1"
	}

	setupPort := strings.TrimSpace(os.Getenv("SOLANAOS_GATEWAY_PORT"))
	if setupPort == "" {
		setupPort = port
	}

	websiteDir := strings.TrimSpace(os.Getenv("SOLANAOS_WEBSITE_DIR"))
	if websiteDir == "" {
		websiteDir = resolveWebsiteDir()
	}

	return config{
		port:            port,
		websiteDir:      websiteDir,
		setupHost:       setupHost,
		setupPort:       setupPort,
		setupTLS:        strings.EqualFold(strings.TrimSpace(os.Getenv("SOLANAOS_GATEWAY_TLS")), "true"),
		apiKey:          strings.TrimSpace(os.Getenv("SOLANAOS_FLEET_API_KEY")),
		network:         envOrDefault("SOLANA_NETWORK", "mainnet-beta"),
		heliusRPC:       envOrDefault("HELIUS_RPC_URL", "https://mainnet.helius-rpc.com"),
		xaiKey:          strings.TrimSpace(os.Getenv("XAI_API_KEY")),
		openRouterModel: envOrDefault("OPENROUTER_MODEL", "anthropic/claude-sonnet-4-20250514"),
	}
}

func envOrDefault(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

func resolveWebsiteDir() string {
	wd, err := os.Getwd()
	if err != nil {
		log.Fatalf("resolve website dir: %v", err)
	}

	for current := wd; current != filepath.Dir(current); current = filepath.Dir(current) {
		candidate := filepath.Join(current, "website")
		if stat, err := os.Stat(filepath.Join(candidate, "index.html")); err == nil && !stat.IsDir() {
			return candidate
		}
	}

	log.Fatalf("could not find website/index.html from %s", wd)
	return ""
}

func generateSetupCode(cfg config) setupCodeResponse {
	scheme := "ws"
	if cfg.setupTLS {
		scheme = "wss"
	}
	url := fmt.Sprintf("%s://%s:%s", scheme, cfg.setupHost, cfg.setupPort)
	payload := setupCodePayload{URL: url}
	encoded, _ := json.Marshal(payload)
	code := base64.RawURLEncoding.EncodeToString(encoded)
	return setupCodeResponse{
		Code:      code,
		ExpiresAt: time.Now().Add(15 * time.Minute).UTC().Format(time.RFC3339),
		URL:       url,
	}
}

func handleFleetDevice(w http.ResponseWriter, r *http.Request, fleet *fleetStore) {
	path := strings.TrimPrefix(r.URL.Path, "/api/fleet/device/")
	parts := strings.Split(strings.Trim(path, "/"), "/")
	if len(parts) == 0 || parts[0] == "" {
		writeError(w, http.StatusBadRequest, "device id required")
		return
	}

	deviceID := parts[0]
	if len(parts) == 1 {
		if r.Method != http.MethodGet {
			writeError(w, http.StatusMethodNotAllowed, "GET required")
			return
		}
		device, ok := fleet.getDevice(deviceID)
		if !ok {
			writeError(w, http.StatusNotFound, "device not found")
			return
		}
		writeJSON(w, http.StatusOK, device)
		return
	}

	action := parts[1]
	switch action {
	case "restart":
		if r.Method != http.MethodPost {
			writeError(w, http.StatusMethodNotAllowed, "POST required")
			return
		}
		err := fleet.mutate(deviceID, func(device *bitaxeDeviceSnapshot) error {
			device.State = "restarting"
			device.Health = "RESTARTING"
			return nil
		})
		if err != nil {
			writeError(w, http.StatusNotFound, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"status": "ok", "id": deviceID, "action": "restart"})
	case "identify":
		if r.Method != http.MethodPost {
			writeError(w, http.StatusMethodNotAllowed, "POST required")
			return
		}
		if err := fleet.mutate(deviceID, func(device *bitaxeDeviceSnapshot) error {
			device.State = "identify"
			return nil
		}); err != nil {
			writeError(w, http.StatusNotFound, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"status": "ok", "id": deviceID, "action": "identify"})
	case "fan":
		if r.Method != http.MethodPatch {
			writeError(w, http.StatusMethodNotAllowed, "PATCH required")
			return
		}
		var req struct {
			FanSpeed int `json:"fanSpeed"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid JSON")
			return
		}
		if req.FanSpeed < 0 || req.FanSpeed > 100 {
			writeError(w, http.StatusBadRequest, "fanSpeed must be between 0 and 100")
			return
		}
		if err := fleet.mutate(deviceID, func(device *bitaxeDeviceSnapshot) error {
			device.FanSpeed = req.FanSpeed
			device.FanRPM = req.FanSpeed * 80
			return nil
		}); err != nil {
			writeError(w, http.StatusNotFound, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"status": "ok", "id": deviceID, "fanSpeed": req.FanSpeed})
	case "pool":
		if r.Method != http.MethodPatch {
			writeError(w, http.StatusMethodNotAllowed, "PATCH required")
			return
		}
		var req struct {
			PoolURL  string `json:"poolUrl"`
			PoolPort int    `json:"poolPort"`
			PoolUser string `json:"poolUser"`
			PoolPass string `json:"poolPass"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid JSON")
			return
		}
		if strings.TrimSpace(req.PoolURL) == "" || req.PoolPort <= 0 || strings.TrimSpace(req.PoolUser) == "" {
			writeError(w, http.StatusBadRequest, "poolUrl, poolPort, and poolUser are required")
			return
		}
		if err := fleet.mutate(deviceID, func(device *bitaxeDeviceSnapshot) error {
			device.PoolURL = strings.TrimSpace(req.PoolURL)
			device.PoolPort = req.PoolPort
			device.PoolUser = strings.TrimSpace(req.PoolUser)
			return nil
		}); err != nil {
			writeError(w, http.StatusNotFound, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"status": "ok", "id": deviceID})
	case "overclock":
		if r.Method != http.MethodPatch {
			writeError(w, http.StatusMethodNotAllowed, "PATCH required")
			return
		}
		var req struct {
			FrequencyMHz int  `json:"frequencyMHz"`
			CoreVoltage  *int `json:"coreVoltage"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid JSON")
			return
		}
		if req.FrequencyMHz <= 0 {
			writeError(w, http.StatusBadRequest, "frequencyMHz must be > 0")
			return
		}
		if err := fleet.mutate(deviceID, func(device *bitaxeDeviceSnapshot) error {
			device.FrequencyMHz = req.FrequencyMHz
			device.HashRate = roundFloat(float64(req.FrequencyMHz)*2.05, 2)
			return nil
		}); err != nil {
			writeError(w, http.StatusNotFound, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"status": "ok", "id": deviceID, "frequencyMHz": req.FrequencyMHz})
	default:
		writeError(w, http.StatusNotFound, "unsupported device action")
	}
}

func withCORS(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next(w, r)
	}
}

func checkAPIKey(w http.ResponseWriter, r *http.Request, requiredKey string) bool {
	if requiredKey == "" {
		return true
	}
	if strings.TrimSpace(r.Header.Get("X-API-Key")) == requiredKey {
		return true
	}
	writeError(w, http.StatusUnauthorized, "missing or invalid X-API-Key")
	return false
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

func roundFloat(v float64, digits int) float64 {
	pow := math.Pow(10, float64(digits))
	return math.Round(v*pow) / pow
}

func init() {
	if port := strings.TrimSpace(os.Getenv("PORT")); port != "" {
		_ = os.Setenv("SOLANAOS_PORT", port)
	}
	if _, err := strconv.Atoi(strings.TrimPrefix(strings.TrimSpace(os.Getenv("SOLANAOS_PORT")), ":")); err != nil && strings.TrimSpace(os.Getenv("SOLANAOS_PORT")) != "" {
		log.Printf("warning: SOLANAOS_PORT=%q may be invalid", os.Getenv("SOLANAOS_PORT"))
	}
}
