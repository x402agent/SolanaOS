package pumplaunch

import (
	"encoding/json"
	"os"
	"path/filepath"

	"github.com/x402agent/Solana-Os-Go/pkg/config"
)

const stateFileName = "pump-launch.json"

type State struct {
	Status        string `json:"status"`
	Action        string `json:"action,omitempty"`
	Mode          string `json:"mode,omitempty"`
	Cluster       string `json:"cluster,omitempty"`
	ProfileID     string `json:"profileId,omitempty"`
	Name          string `json:"name,omitempty"`
	Symbol        string `json:"symbol,omitempty"`
	Mint          string `json:"mint,omitempty"`
	TokenURI      string `json:"tokenUri,omitempty"`
	Signature     string `json:"signature,omitempty"`
	InitialBuySOL string `json:"initialBuySol,omitempty"`
	InitialBuyTx  string `json:"initialBuyTx,omitempty"`
	LaunchedAt    string `json:"launchedAt,omitempty"`
	Reason        string `json:"reason,omitempty"`
	Error         string `json:"error,omitempty"`
}

func StatePath() string {
	return filepath.Join(config.DefaultHome(), "pump", stateFileName)
}

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
