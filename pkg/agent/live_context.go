package agent

import (
	"context"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/x402agent/Solana-Os-Go/pkg/config"
	"github.com/x402agent/Solana-Os-Go/pkg/solana"
)

// BuildLiveContext returns a compact state block for LLM prompts.
func BuildLiveContext(ctx context.Context, cfg *config.Config) string {
	if cfg == nil {
		return ""
	}

	select {
	case <-ctx.Done():
		return ""
	default:
	}

	sections := []string{
		buildConfigContext(cfg),
		buildRuntimeContext(),
		buildAsterContext(cfg),
	}

	parts := make([]string, 0, len(sections))
	for _, section := range sections {
		section = strings.TrimSpace(section)
		if section != "" {
			parts = append(parts, section)
		}
	}

	return strings.Join(parts, "\n\n")
}

func buildConfigContext(cfg *config.Config) string {
	return fmt.Sprintf(
		"Runtime\n- time: %s\n- ooda_mode: %s\n- watchlist_count: %d\n- interval_sec: %d\n- use_perps: %t\n- signal_threshold: %.2f\n- confidence_threshold: %.2f\n- max_positions: %d\n- default_model: %s",
		time.Now().UTC().Format(time.RFC3339),
		cfg.OODA.Mode,
		len(cfg.OODA.Watchlist),
		cfg.OODA.IntervalSeconds,
		cfg.Strategy.UsePerps,
		cfg.OODA.MinSignalStr,
		cfg.OODA.MinConfidence,
		cfg.OODA.MaxPositions,
		cfg.Agents.Defaults.ModelName,
	)
}

func buildRuntimeContext() string {
	snapshot, err := LoadRuntimeSnapshot()
	if err != nil || snapshot == nil {
		return ""
	}

	lines := []string{
		"Latest OODA Snapshot",
		fmt.Sprintf("- updated_at: %s", snapshot.UpdatedAt),
		fmt.Sprintf("- cycles: %d", snapshot.CycleCount),
		fmt.Sprintf("- public_site: %s", emptyOr(snapshot.PublicSiteURL, "unknown")),
		fmt.Sprintf("- public_dashboard: %s", emptyOr(snapshot.PublicDashboardURL, "unknown")),
		fmt.Sprintf("- public_pair: %s", emptyOr(snapshot.PublicPairURL, "unknown")),
		fmt.Sprintf("- wallet: %s", emptyOr(snapshot.WalletAddress, "unknown")),
		fmt.Sprintf("- wallet_sol: %.4f", snapshot.WalletSOL),
		fmt.Sprintf("- open_positions: %d", snapshot.OpenPositionCount),
		fmt.Sprintf("- closed_trades: %d", snapshot.ClosedTradeCount),
	}

	if len(snapshot.OpenPositions) > 0 {
		lines = append(lines, "- current_positions:")
		for _, pos := range snapshot.OpenPositions {
			lines = append(lines, fmt.Sprintf("  - %s %s entry=%.6f sl=%.6f tp=%.6f size_sol=%.4f",
				pos.Symbol, pos.Direction, pos.EntryPrice, pos.StopLoss, pos.TakeProfit, pos.SizeSOL))
		}
	}

	if len(snapshot.RecentTrades) > 0 {
		lines = append(lines, "- recent_trades:")
		limit := minInt(3, len(snapshot.RecentTrades))
		for _, trade := range snapshot.RecentTrades[:limit] {
			lines = append(lines, fmt.Sprintf("  - %s %s pnl=%.2f%% outcome=%s reason=%s",
				trade.Symbol, trade.Direction, trade.PnLPct, trade.Outcome, sanitizeReason(trade.Reason)))
		}
	}

	return strings.Join(lines, "\n")
}

func buildAsterContext(cfg *config.Config) string {
	client := solana.NewAsterClient(cfg.Solana.AsterAPIKey, cfg.Solana.AsterAPISecret)
	markets, err := client.ListMarkets()
	if err != nil || len(markets) == 0 {
		return ""
	}

	byVolume := append([]solana.PerpMarket(nil), markets...)
	sort.Slice(byVolume, func(i, j int) bool {
		return parseFloat(byVolume[i].QuoteVolume) > parseFloat(byVolume[j].QuoteVolume)
	})

	topCount := minInt(6, len(byVolume))
	topMarkets := byVolume[:topCount]

	liquidSlice := append([]solana.PerpMarket(nil), byVolume[:minInt(20, len(byVolume))]...)
	sort.Slice(liquidSlice, func(i, j int) bool {
		return abs(parseFloat(liquidSlice[i].PriceChangePercent)) > abs(parseFloat(liquidSlice[j].PriceChangePercent))
	})
	moverCount := minInt(3, len(liquidSlice))

	lines := []string{
		"Aster Perps",
		"- top_volume_markets:",
	}
	for _, market := range topMarkets {
		lines = append(lines, fmt.Sprintf("  - %s last=%s 24h=%+.2f%% quote_vol=%.0f",
			market.Symbol,
			market.LastPrice,
			parseFloat(market.PriceChangePercent),
			parseFloat(market.QuoteVolume),
		))
	}

	if moverCount > 0 {
		lines = append(lines, "- strongest_moves_in_liquid_names:")
		for _, market := range liquidSlice[:moverCount] {
			lines = append(lines, fmt.Sprintf("  - %s %+.2f%% last=%s",
				market.Symbol,
				parseFloat(market.PriceChangePercent),
				market.LastPrice,
			))
		}
	}

	return strings.Join(lines, "\n")
}

func parseFloat(raw string) float64 {
	value, _ := strconv.ParseFloat(strings.TrimSpace(raw), 64)
	return value
}

func abs(v float64) float64 {
	if v < 0 {
		return -v
	}
	return v
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func emptyOr(v, fallback string) string {
	if strings.TrimSpace(v) == "" {
		return fallback
	}
	return v
}

func sanitizeReason(reason string) string {
	reason = strings.TrimSpace(reason)
	if reason == "" {
		return "n/a"
	}
	reason = strings.ReplaceAll(reason, "\n", " ")
	if len(reason) > 80 {
		return reason[:80] + "..."
	}
	return reason
}
