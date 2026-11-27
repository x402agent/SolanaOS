package solana

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// ── Jupiter live price feed ───────────────────────────────────────────
// Free, key-less USD prices for any Solana mint via Jupiter's price API. Used as
// the always-available live market source for the web console and OODA loop when
// higher-tier providers (e.g. Birdeye) are throttled or unentitled.

// JupiterPrice is one token's live price snapshot.
type JupiterPrice struct {
	Mint           string  `json:"mint"`
	USDPrice       float64 `json:"usdPrice"`
	PriceChange24h float64 `json:"priceChange24h"`
	Liquidity      float64 `json:"liquidity"`
	Decimals       int     `json:"decimals"`
	BlockID        int64   `json:"blockId"`
}

// jupiterPriceBase is the key-less lite price host; it is independent of the
// swap endpoint so throttling on one does not affect the other.
const jupiterPriceBase = "https://lite-api.jup.ag/price/v3"

// GetPrices returns live USD prices for up to ~50 mints in one call. Mints that
// Jupiter cannot price are simply omitted from the result map.
func (j *JupiterClient) GetPrices(mints []string) (map[string]JupiterPrice, error) {
	if len(mints) == 0 {
		return map[string]JupiterPrice{}, nil
	}
	client := j.httpClient
	if client == nil {
		client = &http.Client{Timeout: 10 * time.Second}
	}
	url := jupiterPriceBase + "?ids=" + strings.Join(mints, ",")
	resp, err := client.Get(url)
	if err != nil {
		return nil, fmt.Errorf("jupiter price: %w", err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read jupiter price: %w", err)
	}
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("jupiter price HTTP %d: %s", resp.StatusCode, string(body[:min(200, len(body))]))
	}

	// Response shape: { "<mint>": { "usdPrice":.., "priceChange24h":.., ... }, ... }
	var raw map[string]struct {
		USDPrice       float64 `json:"usdPrice"`
		PriceChange24h float64 `json:"priceChange24h"`
		Liquidity      float64 `json:"liquidity"`
		Decimals       int     `json:"decimals"`
		BlockID        int64   `json:"blockId"`
	}
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, fmt.Errorf("parse jupiter price: %w", err)
	}
	out := make(map[string]JupiterPrice, len(raw))
	for mint, v := range raw {
		out[mint] = JupiterPrice{
			Mint:           mint,
			USDPrice:       v.USDPrice,
			PriceChange24h: v.PriceChange24h,
			Liquidity:      v.Liquidity,
			Decimals:       v.Decimals,
			BlockID:        v.BlockID,
		}
	}
	return out, nil
}
