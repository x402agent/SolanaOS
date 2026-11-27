package solana

import (
	"fmt"
	"strings"
)

// SOLMint is native wrapped SOL.
const SOLMint = "So11111111111111111111111111111111111111112"

// MarketRow is one trending or watchlist market line for CLI/UI output.
type MarketRow struct {
	Symbol    string  `json:"symbol"`
	Name      string  `json:"name,omitempty"`
	Address   string  `json:"address,omitempty"`
	Price     float64 `json:"price"`
	Change24h float64 `json:"change24h"`
	MarketCap float64 `json:"marketCap"`
	Volume24h float64 `json:"volume24h"`
	Source    string  `json:"source"`
}

// TrendingRequest selects a live trending source. An empty Birdeye key uses the
// key-less Jupiter watchlist so `clawdbot solana trending` works on a fresh install.
type TrendingRequest struct {
	BirdeyeAPIKey string
	Limit         int
	Jupiter       *JupiterClient
}

// WatchToken is a well-known Solana mint used when Birdeye is unavailable.
type WatchToken struct {
	Symbol string
	Name   string
	Mint   string
}

// DefaultWatchlist is the key-less Jupiter fallback set.
func DefaultWatchlist() []WatchToken {
	return []WatchToken{
		{Symbol: "SOL", Name: "Solana", Mint: SOLMint},
		{Symbol: "JUP", Name: "Jupiter", Mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN"},
		{Symbol: "BONK", Name: "Bonk", Mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"},
		{Symbol: "WIF", Name: "dogwifhat", Mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm"},
		{Symbol: "JTO", Name: "Jito", Mint: "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL"},
		{Symbol: "PYTH", Name: "Pyth Network", Mint: "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3"},
		{Symbol: "RAY", Name: "Raydium", Mint: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R"},
		{Symbol: "ORCA", Name: "Orca", Mint: "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE"},
	}
}

// SelectTrendingSource returns the live source the CLI will try first.
func SelectTrendingSource(birdeyeAPIKey string) string {
	if strings.TrimSpace(birdeyeAPIKey) != "" {
		return "birdeye"
	}
	return "jupiter"
}

// FetchTrending returns live market rows. Birdeye is used when a key is present;
// otherwise Jupiter lite prices for DefaultWatchlist are used.
func FetchTrending(req TrendingRequest) ([]MarketRow, error) {
	limit := req.Limit
	if limit <= 0 {
		limit = 20
	}
	if strings.TrimSpace(req.BirdeyeAPIKey) != "" {
		rows, err := fetchBirdeyeTrending(req.BirdeyeAPIKey, limit)
		if err == nil && len(rows) > 0 {
			return rows, nil
		}
	}
	return fetchJupiterWatchlist(req.Jupiter, limit)
}

func fetchBirdeyeTrending(apiKey string, limit int) ([]MarketRow, error) {
	client := NewBirdeyeClient(apiKey)
	live, err := client.GetTrendingLive(limit)
	if err == nil && len(live) > 0 {
		out := make([]MarketRow, 0, len(live))
		for _, t := range live {
			symbol := strings.TrimSpace(t.Symbol)
			if symbol == "" {
				continue
			}
			out = append(out, MarketRow{
				Symbol:    symbol,
				Name:      t.Name,
				Address:   t.Address,
				Price:     t.Price,
				Change24h: t.Change24h,
				MarketCap: t.MarketCap,
				Volume24h: t.Volume24hUSD,
				Source:    "birdeye",
			})
		}
		if len(out) > 0 {
			return out, nil
		}
	}
	legacy, err := client.GetTrendingV3(limit)
	if err != nil {
		return nil, err
	}
	out := make([]MarketRow, 0, len(legacy))
	for _, t := range legacy {
		symbol := strings.TrimSpace(t.Symbol)
		if symbol == "" {
			continue
		}
		out = append(out, MarketRow{
			Symbol:    symbol,
			Name:      t.Name,
			Address:   t.Address,
			Price:     t.Price,
			Change24h: t.PriceChange24hPct,
			MarketCap: t.MarketCap,
			Volume24h: t.Volume24hUSD,
			Source:    "birdeye",
		})
	}
	return out, nil
}

func fetchJupiterWatchlist(jup *JupiterClient, limit int) ([]MarketRow, error) {
	if jup == nil {
		jup = NewJupiterClient("", "")
	}
	watch := DefaultWatchlist()
	if limit > 0 && limit < len(watch) {
		watch = watch[:limit]
	}
	mints := make([]string, len(watch))
	byMint := make(map[string]WatchToken, len(watch))
	for i, tok := range watch {
		mints[i] = tok.Mint
		byMint[tok.Mint] = tok
	}
	prices, err := jup.GetPrices(mints)
	if err != nil {
		return nil, fmt.Errorf("jupiter trending: %w", err)
	}
	return RowsFromJupiterPrices(watch, prices), nil
}

// RowsFromJupiterPrices maps a watchlist plus a Jupiter price snapshot into
// MarketRows, preserving watchlist order and skipping unpriced mints.
func RowsFromJupiterPrices(watch []WatchToken, prices map[string]JupiterPrice) []MarketRow {
	out := make([]MarketRow, 0, len(watch))
	for _, tok := range watch {
		px, ok := prices[tok.Mint]
		if !ok || px.USDPrice <= 0 {
			continue
		}
		out = append(out, MarketRow{
			Symbol:    tok.Symbol,
			Name:      tok.Name,
			Address:   tok.Mint,
			Price:     px.USDPrice,
			Change24h: px.PriceChange24h,
			Source:    "jupiter",
		})
	}
	return out
}

// FormatTrending renders market rows the way the CLI prints them.
func FormatTrending(rows []MarketRow) string {
	var b strings.Builder
	b.WriteString("Trending Solana Tokens\n")
	for i, row := range rows {
		fmt.Fprintf(&b, "  %2d. %-8s $%.6f  %+.2f%%  MCap: $%.0f  Vol: $%.0f  [%s]\n",
			i+1, row.Symbol, row.Price, row.Change24h, row.MarketCap, row.Volume24h, row.Source)
	}
	return b.String()
}
