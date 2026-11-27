package solana

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

// ── Birdeye Perps Data API ────────────────────────────────────────────
// Live perpetuals open-interest and positioning from Birdeye's Perps Data API.
// These endpoints require the x-perp exchange header (currently hyperliquid)
// rather than the x-chain header used by the DeFi endpoints.

// PerpsToken is one row of the perps token list: open interest split by side,
// margin usage, and a directional bias readout.
type PerpsToken struct {
	Token         string  `json:"token"`
	LongIO        float64 `json:"long_io"`
	ShortIO       float64 `json:"short_io"`
	OpenInterest  float64 `json:"open_interest"`
	Margin        float64 `json:"margin"`
	MarginUsed    float64 `json:"margin_used"`
	EntryMargin   float64 `json:"entry_margin"`
	UnrealizedPnL float64 `json:"unrealized_pnl"`
	Bias          float64 `json:"bias"`
	Leverage      float64 `json:"leverage"`
	BiasText      string  `json:"bias_text"`
}

// GetPerpsTokenList returns the top perps tokens by open interest from the given
// exchange (defaults to hyperliquid). timeFrame is one of 4h/1d/7d/30d/all.
func (b *BirdeyeClient) GetPerpsTokenList(exchange, timeFrame string, limit int) ([]PerpsToken, error) {
	if exchange == "" {
		exchange = "hyperliquid"
	}
	if timeFrame == "" {
		timeFrame = "all"
	}
	if limit <= 0 || limit > 20 {
		limit = 10
	}
	u := fmt.Sprintf("%s/perps/v1/token/list?time_frame=%s&sort_by=open_interest&sort_type=desc&offset=0&limit=%d",
		b.baseURL, timeFrame, limit)
	data, err := b.perpsRequest(u, exchange)
	if err != nil {
		return nil, err
	}
	var resp struct {
		Success bool `json:"success"`
		Data    struct {
			Items []PerpsToken `json:"items"`
			// The API has historically returned the list either as a bare array
			// under data or under an items/tokens field; support both shapes.
			Tokens []PerpsToken `json:"tokens"`
		} `json:"data"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		// Fall back to data being a raw array of tokens.
		var alt struct {
			Data []PerpsToken `json:"data"`
		}
		if err2 := json.Unmarshal(data, &alt); err2 == nil && len(alt.Data) > 0 {
			return alt.Data, nil
		}
		return nil, fmt.Errorf("parse perps token list: %w", err)
	}
	if len(resp.Data.Items) > 0 {
		return resp.Data.Items, nil
	}
	if len(resp.Data.Tokens) > 0 {
		return resp.Data.Tokens, nil
	}
	// data may itself be the array.
	var alt struct {
		Data []PerpsToken `json:"data"`
	}
	if err := json.Unmarshal(data, &alt); err == nil {
		return alt.Data, nil
	}
	return nil, nil
}

// perpsRequest issues a GET with the perps exchange header set.
func (b *BirdeyeClient) perpsRequest(url, exchange string) ([]byte, error) {
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("X-API-KEY", b.apiKey)
	req.Header.Set("accept", "application/json")
	req.Header.Set("x-perp", exchange)

	resp, err := b.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("birdeye perps request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read perps response: %w", err)
	}
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("birdeye perps HTTP %d: %s", resp.StatusCode, string(body[:min(200, len(body))]))
	}
	return body, nil
}
