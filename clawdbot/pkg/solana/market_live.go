package solana

import (
	"encoding/json"
	"fmt"
	"time"
)

// ── Live market helpers ───────────────────────────────────────────────
// Correctly-mapped reads of the Birdeye DeFi endpoints for the web console and
// OODA loop. GetTrending's struct tags predate the current API field names, so
// these use the documented field names directly.

// TrendingTokenLive mirrors the documented /defi/token_trending item shape.
type TrendingTokenLive struct {
	Address      string  `json:"address"`
	Symbol       string  `json:"symbol"`
	Name         string  `json:"name"`
	Decimals     int     `json:"decimals"`
	Price        float64 `json:"price"`
	Change24h    float64 `json:"price24hChangePercent"`
	Volume24hUSD float64 `json:"volume24hUSD"`
	VolumeChange float64 `json:"volume24hChangePercent"`
	Liquidity    float64 `json:"liquidity"`
	MarketCap    float64 `json:"marketcap"`
	FDV          float64 `json:"fdv"`
	Rank         int     `json:"rank"`
	LogoURI      string  `json:"logoURI"`
}

// GetTrendingLive returns trending Solana tokens with correctly-mapped fields.
func (b *BirdeyeClient) GetTrendingLive(limit int) ([]TrendingTokenLive, error) {
	if limit <= 0 || limit > 50 {
		limit = 20
	}
	u := fmt.Sprintf("%s/defi/token_trending?sort_by=rank&sort_type=asc&offset=0&limit=%d", b.baseURL, limit)
	data, err := b.doRequest(u)
	if err != nil {
		return nil, err
	}
	var resp struct {
		Success bool `json:"success"`
		Data    struct {
			Tokens []TrendingTokenLive `json:"tokens"`
		} `json:"data"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("parse trending: %w", err)
	}
	return resp.Data.Tokens, nil
}

// GetOHLCVRange fetches OHLCV bars for a token over a lookback window sized to
// the resolution, so an hourly request actually spans `limit` hours (the older
// GetOHLCV assumed 1h regardless of resolution).
func (b *BirdeyeClient) GetOHLCVRange(address, resolution string, limit int) ([]OHLCVBar, error) {
	if resolution == "" {
		resolution = "1H"
	}
	if limit <= 0 {
		limit = 200
	}
	step := resolutionSeconds(resolution)
	now := time.Now().Unix()
	from := now - int64(limit)*step
	u := fmt.Sprintf("%s/defi/ohlcv?address=%s&type=%s&time_from=%d&time_to=%d",
		b.baseURL, address, resolution, from, now)
	data, err := b.doRequest(u)
	if err != nil {
		return nil, err
	}
	var resp struct {
		Data struct {
			Items []OHLCVBar `json:"items"`
		} `json:"data"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("parse ohlcv: %w", err)
	}
	return resp.Data.Items, nil
}

// resolutionSeconds maps a Birdeye OHLCV resolution to its duration in seconds.
func resolutionSeconds(resolution string) int64 {
	switch resolution {
	case "1m":
		return 60
	case "5m":
		return 5 * 60
	case "15m":
		return 15 * 60
	case "30m":
		return 30 * 60
	case "1H":
		return 3600
	case "4H":
		return 4 * 3600
	case "1D":
		return 24 * 3600
	default:
		return 3600
	}
}
