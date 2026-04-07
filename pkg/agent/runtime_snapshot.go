package agent

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/x402agent/Solana-Os-Go/pkg/config"
)

const runtimeSnapshotFilename = "ooda-runtime.json"

type RuntimeSnapshot struct {
	UpdatedAt                string     `json:"updatedAt"`
	Mode                     string     `json:"mode"`
	CycleCount               int        `json:"cycleCount"`
	WatchlistCount           int        `json:"watchlistCount"`
	ActionableWatchlistCount int        `json:"actionableWatchlistCount"`
	TradeReadiness           string     `json:"tradeReadiness"`
	OpenPositionCount        int        `json:"openPositionCount"`
	ClosedTradeCount         int        `json:"closedTradeCount"`
	WalletAddress            string     `json:"walletAddress,omitempty"`
	PublicSiteURL            string     `json:"publicSiteUrl,omitempty"`
	PublicDashboardURL       string     `json:"publicDashboardUrl,omitempty"`
	PublicPairURL            string     `json:"publicPairUrl,omitempty"`
	WalletSOL                float64    `json:"walletSOL"`
	MinReserveSOL            float64    `json:"minReserveSOL"`
	SwapSlippageBps          int        `json:"swapSlippageBps"`
	TradeBlockers            []string   `json:"tradeBlockers,omitempty"`
	OpenPositions            []Position `json:"openPositions"`
	RecentTrades             []Trade    `json:"recentTrades"`
}

func RuntimeSnapshotPath() string {
	return filepath.Join(config.DefaultWorkspacePath(), "state", runtimeSnapshotFilename)
}

func LoadRuntimeSnapshot() (*RuntimeSnapshot, error) {
	data, err := os.ReadFile(RuntimeSnapshotPath())
	if err != nil {
		return nil, err
	}
	var snapshot RuntimeSnapshot
	if err := json.Unmarshal(data, &snapshot); err != nil {
		return nil, fmt.Errorf("parse runtime snapshot: %w", err)
	}
	return &snapshot, nil
}

func (a *OODAAgent) writeRuntimeSnapshot(obs *Observation) {
	if a == nil {
		return
	}

	snapshot := RuntimeSnapshot{
		UpdatedAt:          time.Now().UTC().Format(time.RFC3339),
		Mode:               a.cfg.OODA.Mode,
		CycleCount:         a.cycleCount,
		WatchlistCount:     len(a.cfg.OODA.Watchlist),
		PublicSiteURL:      config.PublicHubURL(),
		PublicDashboardURL: config.PublicDashboardURL(),
		PublicPairURL:      config.PublicPairURL(),
		MinReserveSOL:      a.minReserveSOL(),
		SwapSlippageBps:    a.swapSlippageBps(),
	}
	if a.wallet != nil {
		snapshot.WalletAddress = a.wallet.PublicKeyStr()
	}
	if obs != nil {
		snapshot.WalletSOL = obs.WalletSOL
		snapshot.ActionableWatchlistCount = a.actionableWatchlistCount(obs)
		snapshot.TradeBlockers = a.currentBlockers(obs)
		snapshot.TradeReadiness = a.currentReadinessSummary(obs)
	}

	a.mu.RLock()
	snapshot.OpenPositions = make([]Position, 0, len(a.openPositions))
	for _, pos := range a.openPositions {
		snapshot.OpenPositions = append(snapshot.OpenPositions, *pos)
	}
	snapshot.OpenPositionCount = len(snapshot.OpenPositions)

	closedTrades := 0
	recent := make([]Trade, 0, 5)
	for i := len(a.tradeHistory) - 1; i >= 0; i-- {
		trade := a.tradeHistory[i]
		if trade.Outcome == "win" || trade.Outcome == "loss" {
			closedTrades++
		}
		if len(recent) < 5 {
			recent = append(recent, trade)
		}
	}
	snapshot.ClosedTradeCount = closedTrades
	snapshot.RecentTrades = recent
	a.mu.RUnlock()

	path := RuntimeSnapshotPath()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		log.Printf("[OODA] ⚠️  runtime snapshot mkdir failed: %v", err)
		return
	}

	data, err := json.MarshalIndent(snapshot, "", "  ")
	if err != nil {
		log.Printf("[OODA] ⚠️  runtime snapshot marshal failed: %v", err)
		return
	}

	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		log.Printf("[OODA] ⚠️  runtime snapshot write failed: %v", err)
		return
	}
	if err := os.Rename(tmp, path); err != nil {
		log.Printf("[OODA] ⚠️  runtime snapshot rename failed: %v", err)
	}
}
