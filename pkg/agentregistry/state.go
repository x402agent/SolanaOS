package agentregistry

import (
	"encoding/json"
	"os"
	"path/filepath"
)

// State is the JSON written by the Node.js registry helper after each sync.
type State struct {
	Status                 string         `json:"status"`
	Trigger                string         `json:"trigger,omitempty"`
	Cluster                string         `json:"cluster,omitempty"`
	Wallet                 string         `json:"wallet,omitempty"`
	Asset                  string         `json:"asset,omitempty"`
	Signature              string         `json:"signature,omitempty"`
	TokenURI               string         `json:"tokenUri,omitempty"`
	SiteURL                string         `json:"siteUrl,omitempty"`
	DashboardURL           string         `json:"dashboardUrl,omitempty"`
	PairURL                string         `json:"pairUrl,omitempty"`
	Action                 string         `json:"action,omitempty"`
	SyncedAt               string         `json:"syncedAt,omitempty"`
	Reason                 string         `json:"reason,omitempty"`
	Error                  string         `json:"error,omitempty"`
	Pump                   map[string]any `json:"pump,omitempty"`
	Metadata               map[string]any `json:"metadata,omitempty"`
	Capabilities           []string       `json:"capabilities,omitempty"`
	LookupError            string         `json:"lookupError,omitempty"`
	HeartbeatMetadata      string         `json:"heartbeatMetadata,omitempty"`
	HeartbeatMetadataError string         `json:"heartbeatMetadataError,omitempty"`
	HubSync                map[string]any `json:"hubSync,omitempty"`
	HubSyncSkipped         string         `json:"hubSyncSkipped,omitempty"`
	HubSyncError           string         `json:"hubSyncError,omitempty"`
}

// LoadState reads the persisted registry state written by the Node.js helper.
func LoadState() (*State, error) {
	data, err := os.ReadFile(StatePath())
	if err != nil {
		return nil, err
	}
	var state State
	if err := json.Unmarshal(data, &state); err != nil {
		return nil, err
	}
	return &state, nil
}

// SaveState writes a State to disk. Used by tests and manual overrides.
func SaveState(state *State) error {
	path := StatePath()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o644)
}

// IsRegistered returns true if a previous sync successfully registered an asset.
func IsRegistered() bool {
	state, err := LoadState()
	return err == nil && state != nil && state.Status == "ok" && state.Asset != ""
}

// AssetAddress returns the on-chain asset address from the last successful sync,
// or an empty string if never registered.
func AssetAddress() string {
	state, err := LoadState()
	if err != nil || state == nil {
		return ""
	}
	return state.Asset
}
