package solana

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
)

// BirdeyePairListToken describes one token/pair entry from list JSON files.
type BirdeyePairListToken struct {
	Address     string `json:"address,omitempty"`
	PairAddress string `json:"pairAddress,omitempty"`
	ChartType   string `json:"chartType,omitempty"`
	Currency    string `json:"currency,omitempty"`
}

type birdeyePairListPayload struct {
	Tokens []BirdeyePairListToken `json:"tokens"`
}

// LoadBirdeyePairList reads a Birdeye list.json/tokenlist.json style file.
func LoadBirdeyePairList(path string) ([]BirdeyePairListToken, error) {
	path = strings.TrimSpace(path)
	if path == "" {
		return nil, fmt.Errorf("list path is required")
	}

	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read pair list %q: %w", path, err)
	}

	payload := birdeyePairListPayload{}
	if err := json.Unmarshal(raw, &payload); err != nil {
		return nil, fmt.Errorf("parse pair list %q: %w", path, err)
	}

	out := make([]BirdeyePairListToken, 0, len(payload.Tokens))
	seen := make(map[string]struct{}, len(payload.Tokens))
	for _, token := range payload.Tokens {
		addr := strings.TrimSpace(token.Address)
		if addr == "" {
			addr = strings.TrimSpace(token.PairAddress)
		}
		if addr == "" {
			continue
		}
		if _, exists := seen[addr]; exists {
			continue
		}
		seen[addr] = struct{}{}
		out = append(out, BirdeyePairListToken{
			Address:     addr,
			PairAddress: addr,
			ChartType:   strings.TrimSpace(token.ChartType),
			Currency:    strings.TrimSpace(token.Currency),
		})
	}

	if len(out) == 0 {
		return nil, fmt.Errorf("pair list %q has no valid addresses", path)
	}

	return out, nil
}

// BuildBirdeyePairPriceComplexQuery builds queryType=complex payload for SUBSCRIBE_PRICE.
func BuildBirdeyePairPriceComplexQuery(tokens []BirdeyePairListToken, defaultChartType, defaultCurrency string) string {
	parts := make([]string, 0, len(tokens))
	for _, token := range tokens {
		addr := strings.TrimSpace(token.Address)
		if addr == "" {
			addr = strings.TrimSpace(token.PairAddress)
		}
		if addr == "" {
			continue
		}

		chart := strings.TrimSpace(token.ChartType)
		if chart == "" {
			chart = strings.TrimSpace(defaultChartType)
		}
		if chart == "" {
			chart = "1m"
		}

		currency := strings.TrimSpace(token.Currency)
		if currency == "" {
			currency = strings.TrimSpace(defaultCurrency)
		}
		if currency == "" {
			currency = "pair"
		}

		parts = append(parts, fmt.Sprintf("(address = %s AND chartType = %s AND currency = %s)", addr, chart, currency))
	}

	return strings.Join(parts, " OR ")
}

// BuildBirdeyePairTxComplexQuery builds queryType=complex payload for SUBSCRIBE_TXS.
func BuildBirdeyePairTxComplexQuery(tokens []BirdeyePairListToken) string {
	parts := make([]string, 0, len(tokens))
	for _, token := range tokens {
		addr := strings.TrimSpace(token.Address)
		if addr == "" {
			addr = strings.TrimSpace(token.PairAddress)
		}
		if addr == "" {
			continue
		}
		parts = append(parts, "address = "+addr)
	}
	return strings.Join(parts, " OR ")
}
