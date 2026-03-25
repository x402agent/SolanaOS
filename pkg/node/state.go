package node

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// NodeConfig holds all configuration for the headless node client.
type NodeConfig struct {
	BridgeAddr   string
	StatePath    string
	NodeID       string
	DisplayName  string
	Platform     string
	Version      string
	DeviceFamily string
	ModelID      string // model identifier (e.g. "orin-nano", "raspi4")
	Caps         []string
	Commands     []string
	Permissions  map[string]bool
	PairSilent   bool

	SessionKey     string
	ChatSessionKey string
	ChatSubscribe  bool
	AgentRequest   bool
	Deliver        bool
	DeliverChannel string
	DeliverTo      string

	PingInterval time.Duration
	MDNSEnabled  bool
	MDNSService  string
	MDNSDomain   string
	MDNSName     string

	TTSEngine  string
	TTSVoice   string
	TTSRate    int
	TTSCommand string
}

// DefaultNodeConfig returns sensible defaults for a headless node.
func DefaultNodeConfig() NodeConfig {
	return NodeConfig{
		BridgeAddr:   "127.0.0.1:18790",
		StatePath:    DefaultStatePath(),
		Platform:     detectPlatform(),
		Version:      "dev",
		DeviceFamily: detectDeviceFamily(),
		Caps:         []string{"voiceWake"},
		SessionKey:   "main",
		PingInterval: 30 * time.Second,
		MDNSEnabled:  true,
		MDNSService:  "_nanoclaw-node._tcp",
		MDNSDomain:   "local.",
		ChatSubscribe: true,
		TTSEngine:    "none",
		TTSVoice:     "en-us",
		TTSRate:      180,
		TTSCommand:   "espeak-ng",
	}
}

// NodeState holds persistent node identity and authentication.
type NodeState struct {
	NodeID      string `json:"nodeId"`
	Token       string `json:"token,omitempty"`
	DisplayName string `json:"displayName,omitempty"`
}

// DefaultStatePath returns the default path for node state persistence.
func DefaultStatePath() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return "./nanosolana-node.json"
	}
	return filepath.Join(home, ".nanosolana", "node.json")
}

// LoadOrInitState loads existing state or creates a new identity.
func LoadOrInitState(path string) (*NodeState, error) {
	if path == "" {
		path = DefaultStatePath()
	}
	data, err := os.ReadFile(path)
	if err == nil {
		var st NodeState
		if err := json.Unmarshal(data, &st); err != nil {
			return nil, err
		}
		if st.NodeID == "" {
			st.NodeID = DeriveNodeID()
		}
		if st.DisplayName == "" {
			st.DisplayName = DefaultDisplayName()
		}
		return &st, nil
	}
	if !errors.Is(err, os.ErrNotExist) {
		return nil, err
	}
	st := &NodeState{
		NodeID:      DeriveNodeID(),
		DisplayName: DefaultDisplayName(),
	}
	if err := SaveState(path, st); err != nil {
		return nil, err
	}
	return st, nil
}

// SaveState persists the node state to disk.
func SaveState(path string, st *NodeState) error {
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return err
	}
	payload, err := json.MarshalIndent(st, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, payload, 0o600)
}

// DeriveNodeID builds a node ID from hostname + machine ID.
func DeriveNodeID() string {
	host := DefaultDisplayName()
	base := SanitizeID(host)
	if mid := machineID(); mid != "" {
		return fmt.Sprintf("nano-%s-%s", base, mid[:8])
	}
	return fmt.Sprintf("nano-%s-%s", base, RandomID(6))
}

// DefaultDisplayName returns the system hostname.
func DefaultDisplayName() string {
	host, err := os.Hostname()
	if err != nil || strings.TrimSpace(host) == "" {
		return "nanoclaw"
	}
	return host
}

// RandomID generates a cryptographic random hex string.
func RandomID(n int) string {
	if n <= 0 {
		n = 6
	}
	buf := make([]byte, n)
	if _, err := rand.Read(buf); err != nil {
		return fmt.Sprintf("%d", time.Now().UnixNano())
	}
	return hex.EncodeToString(buf)
}

// SanitizeID normalizes a string into a safe node identifier.
func SanitizeID(input string) string {
	input = strings.ToLower(strings.TrimSpace(input))
	if input == "" {
		return "node"
	}
	var b strings.Builder
	for _, r := range input {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
			continue
		}
		if r == '-' || r == '_' {
			b.WriteRune('-')
			continue
		}
		b.WriteRune('-')
	}
	out := strings.Trim(b.String(), "-")
	if out == "" {
		return "node"
	}
	return out
}

func machineID() string {
	data, err := os.ReadFile("/etc/machine-id")
	if err != nil {
		return ""
	}
	id := strings.TrimSpace(string(data))
	id = strings.ReplaceAll(id, "-", "")
	if len(id) < 8 {
		return ""
	}
	return id
}

func detectPlatform() string {
	// Detect based on OS
	if _, err := os.Stat("/proc/device-tree/model"); err == nil {
		return "linux"
	}
	return "darwin" // fallback for macOS dev
}

func detectDeviceFamily() string {
	// Check for Raspberry Pi
	data, err := os.ReadFile("/proc/cpuinfo")
	if err == nil && strings.Contains(strings.ToLower(string(data)), "raspberry pi") {
		return "raspi"
	}
	// Check for NVIDIA Jetson / Orin
	data, err = os.ReadFile("/proc/device-tree/model")
	if err == nil {
		model := strings.ToLower(string(data))
		if strings.Contains(model, "orin") || strings.Contains(model, "jetson") {
			return "orin"
		}
	}
	return "workstation"
}

// SplitCSV splits a comma-separated string into trimmed parts.
func SplitCSV(value string) []string {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	parts := strings.Split(value, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		item := strings.TrimSpace(part)
		if item == "" {
			continue
		}
		out = append(out, item)
	}
	return out
}
