// Package seeker provides the SolanaOS agent for the Solana Seeker phone.
//
// Replaces the Node.js + OpenClaw stack from SeekerClaw with a native Go
// binary running the full SolanaOS OODA trading loop + Telegram bot.
//
// Architecture:
//
//	Android App (Kotlin/Compose)
//	 └─ Foreground Service
//	     └─ SolanaOS binary (ARM64, ~10MB)
//	         ├─ OODA trading loop (observe/orient/decide/act)
//	         ├─ Solana on-chain engine (Helius RPC/WSS)
//	         ├─ Jupiter swap execution
//	         ├─ TamaGOchi pet engine
//	         ├─ Telegram bot interface
//	         ├─ Android Bridge client (localhost:8765)
//	         ├─ Heartbeat + watchdog probe
//	         ├─ SolanaOS gateway (TCP + Tailscale)
//	         └─ On-chain NFT registry (devnet)
//
// The Android Bridge provides device-native capabilities:
//   - Battery level, storage stats
//   - GPS location, contacts, SMS, calls
//   - Clipboard, TTS, camera, app control
//
// These feed into the OODA observe phase alongside Helius RPC data.
package seeker

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"
)

// ── Android Bridge Client ────────────────────────────────────────────

const (
	DefaultBridgePort = 8765
	DefaultStatsPort  = 8766
	HeartbeatInterval = 5 * time.Minute
	WatchdogInterval  = 30 * time.Second
)

// BridgeClient connects to the Android Bridge HTTP server running in
// the SeekerClaw/SolanaOS Android app foreground service.
type BridgeClient struct {
	baseURL string
	http    *http.Client
	logf    func(string, ...any)
}

// NewBridgeClient creates a bridge client connected to the Android app.
func NewBridgeClient(port int) *BridgeClient {
	if port == 0 {
		port = DefaultBridgePort
	}
	return &BridgeClient{
		baseURL: fmt.Sprintf("http://localhost:%d", port),
		http:    &http.Client{Timeout: 10 * time.Second},
		logf:    func(f string, a ...any) { fmt.Fprintf(os.Stderr, "[seeker] "+f+"\n", a...) },
	}
}

// ── Device Info ──────────────────────────────────────────────────────

// BatteryStatus represents the device battery state.
type BatteryStatus struct {
	Level      int    `json:"level"`
	IsCharging bool   `json:"isCharging"`
	ChargeType string `json:"chargeType"`
}

// StorageInfo represents device storage stats.
type StorageInfo struct {
	TotalGB     float64 `json:"totalGb"`
	AvailableGB float64 `json:"availableGb"`
	UsedPercent float64 `json:"usedPercent"`
}

// LocationInfo represents GPS coordinates.
type LocationInfo struct {
	Latitude  float64   `json:"latitude"`
	Longitude float64   `json:"longitude"`
	Accuracy  float64   `json:"accuracy"`
	Time      time.Time `json:"time"`
}

// GetBattery returns the current battery status.
func (b *BridgeClient) GetBattery(ctx context.Context) (*BatteryStatus, error) {
	var result BatteryStatus
	if err := b.post(ctx, "/battery", nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// GetStorage returns device storage statistics.
func (b *BridgeClient) GetStorage(ctx context.Context) (*StorageInfo, error) {
	var result StorageInfo
	if err := b.post(ctx, "/storage", nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// GetLocation returns the current GPS location.
func (b *BridgeClient) GetLocation(ctx context.Context) (*LocationInfo, error) {
	var result LocationInfo
	if err := b.post(ctx, "/location", nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// GetClipboard reads the device clipboard.
func (b *BridgeClient) GetClipboard(ctx context.Context) (string, error) {
	var result struct {
		Text string `json:"text"`
	}
	if err := b.post(ctx, "/clipboard/get", nil, &result); err != nil {
		return "", err
	}
	return result.Text, nil
}

// SetClipboard writes to the device clipboard.
func (b *BridgeClient) SetClipboard(ctx context.Context, text string) error {
	return b.post(ctx, "/clipboard/set", map[string]string{"text": text}, nil)
}

// Speak uses text-to-speech on the device.
func (b *BridgeClient) Speak(ctx context.Context, text string, speed, pitch float64) error {
	if speed == 0 {
		speed = 1.0
	}
	if pitch == 0 {
		pitch = 1.0
	}
	return b.post(ctx, "/tts", map[string]any{
		"text":  text,
		"speed": speed,
		"pitch": pitch,
	}, nil)
}

// Ping checks if the Android bridge is reachable.
func (b *BridgeClient) Ping(ctx context.Context) error {
	return b.post(ctx, "/ping", nil, nil)
}

// ReportMessage tells the Android app a message was processed (for stats).
func (b *BridgeClient) ReportMessage(ctx context.Context) error {
	return b.post(ctx, "/stats/message", nil, nil)
}

// ── HTTP Helpers ─────────────────────────────────────────────────────

func (b *BridgeClient) post(ctx context.Context, path string, body any, result any) error {
	var reader io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("marshal body: %w", err)
		}
		reader = io.NopCloser(jsonReader(data))
	}

	req, err := http.NewRequestWithContext(ctx, "POST", b.baseURL+path, reader)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := b.http.Do(req)
	if err != nil {
		return fmt.Errorf("bridge %s: %w", path, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("bridge %s: %d %s", path, resp.StatusCode, string(respBody[:min(200, len(respBody))]))
	}

	if result != nil {
		if err := json.NewDecoder(resp.Body).Decode(result); err != nil {
			return fmt.Errorf("bridge %s decode: %w", path, err)
		}
	}
	return nil
}

func jsonReader(data []byte) io.Reader {
	return &jsonReaderImpl{data: data}
}

type jsonReaderImpl struct {
	data []byte
	pos  int
}

func (r *jsonReaderImpl) Read(p []byte) (n int, err error) {
	if r.pos >= len(r.data) {
		return 0, io.EOF
	}
	n = copy(p, r.data[r.pos:])
	r.pos += n
	return n, nil
}

// ── SeekerConfig ─────────────────────────────────────────────────────

// SeekerConfig holds configuration for the Seeker agent.
type SeekerConfig struct {
	// Android bridge
	BridgePort int    `json:"bridge_port"`
	StatsPort  int    `json:"stats_port"`

	// Agent workspace
	WorkspacePath string `json:"workspace_path"`

	// Heartbeat
	HeartbeatPath    string `json:"heartbeat_path"`
	HeartbeatInterval time.Duration `json:"heartbeat_interval"`

	// Device info (populated at startup)
	DeviceModel  string `json:"device_model"`
	AndroidVersion string `json:"android_version"`
	RAM          string `json:"ram"`
}

// DefaultSeekerConfig returns Seeker-optimized defaults.
func DefaultSeekerConfig() SeekerConfig {
	home, _ := os.UserHomeDir()
	ws := filepath.Join(home, ".solanaos", "workspace")

	return SeekerConfig{
		BridgePort:        DefaultBridgePort,
		StatsPort:         DefaultStatsPort,
		WorkspacePath:     ws,
		HeartbeatPath:     filepath.Join(ws, "HEARTBEAT.md"),
		HeartbeatInterval: HeartbeatInterval,
	}
}

// ── Heartbeat ────────────────────────────────────────────────────────

// WriteHeartbeat writes the HEARTBEAT.md probe file with current status.
func WriteHeartbeat(cfg SeekerConfig, status string) error {
	dir := filepath.Dir(cfg.HeartbeatPath)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}

	content := fmt.Sprintf(`# HEARTBEAT

Status: %s
Time: %s
Agent: SolanaOS Seeker
Binary: ~10MB Go ARM64
`, status, time.Now().UTC().Format(time.RFC3339))

	return os.WriteFile(cfg.HeartbeatPath, []byte(content), 0o644)
}

// HeartbeatLoop writes periodic heartbeats for the Android watchdog.
func HeartbeatLoop(ctx context.Context, cfg SeekerConfig, bridge *BridgeClient) {
	ticker := time.NewTicker(cfg.HeartbeatInterval)
	defer ticker.Stop()

	// Write initial heartbeat
	_ = WriteHeartbeat(cfg, "ALIVE")

	for {
		select {
		case <-ctx.Done():
			_ = WriteHeartbeat(cfg, "STOPPING")
			return
		case <-ticker.C:
			_ = WriteHeartbeat(cfg, "ALIVE")
			// Also ping the bridge to prove liveness
			if bridge != nil {
				_ = bridge.Ping(ctx)
			}
		}
	}
}

// ── PLATFORM.md Generation ───────────────────────────────────────────

// WritePlatformInfo generates PLATFORM.md with device state, similar to
// SeekerClaw's auto-generated platform file.
func WritePlatformInfo(ctx context.Context, cfg SeekerConfig, bridge *BridgeClient) error {
	content := "# PLATFORM.md — Device State\n\n" +
		"> Auto-generated by SolanaOS Seeker on startup.\n\n" +
		"## Runtime\n" +
		"- **Agent**: SolanaOS v2.0.0 (Go ARM64)\n" +
		"- **Binary**: ~10MB\n" +
		"- **Boot time**: <1s\n" +
		"- **Platform**: Android (Solana Seeker)\n"

	if bridge != nil {
		// Try to get battery info
		if bat, err := bridge.GetBattery(ctx); err == nil {
			content += fmt.Sprintf(`
## Battery
- Level: %d%%
- Charging: %v (%s)
`, bat.Level, bat.IsCharging, bat.ChargeType)
		}

		// Try to get storage info
		if storage, err := bridge.GetStorage(ctx); err == nil {
			content += fmt.Sprintf(`
## Storage
- Total: %.1f GB
- Available: %.1f GB
- Used: %.0f%%
`, storage.TotalGB, storage.AvailableGB, storage.UsedPercent)
		}
	}

	platformPath := filepath.Join(cfg.WorkspacePath, "PLATFORM.md")
	return os.WriteFile(platformPath, []byte(content), 0o644)
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
