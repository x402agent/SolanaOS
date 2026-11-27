package solana

import (
	"fmt"
	"strings"
)

// LooksLikePriceQuery reports whether a natural-language prompt is asking for
// a live token price. Used by the agent CLI to fall back to Jupiter when the
// free zkrouter path is unavailable.
func LooksLikePriceQuery(query string) bool {
	q := strings.ToLower(strings.TrimSpace(query))
	if q == "" {
		return false
	}
	hasPrice := strings.Contains(q, "price") || strings.Contains(q, "worth") || strings.Contains(q, "cost")
	hasAsset := strings.Contains(q, "sol") || strings.Contains(q, "jup") || strings.Contains(q, "token")
	return hasPrice && hasAsset
}

// SymbolForPriceQuery picks a watchlist symbol from a user prompt.
func SymbolForPriceQuery(query string) WatchToken {
	q := strings.ToLower(query)
	for _, tok := range DefaultWatchlist() {
		if tok.Symbol == "SOL" {
			continue
		}
		if strings.Contains(q, strings.ToLower(tok.Symbol)) || strings.Contains(q, strings.ToLower(tok.Name)) {
			return tok
		}
	}
	return WatchToken{Symbol: "SOL", Name: "Solana", Mint: SOLMint}
}

// FormatPriceAnswer turns a Jupiter snapshot into a human agent reply.
func FormatPriceAnswer(query string, prices map[string]JupiterPrice) string {
	tok := SymbolForPriceQuery(query)
	px, ok := prices[tok.Mint]
	if !ok || px.USDPrice <= 0 {
		return ""
	}
	return fmt.Sprintf("%s (%s) is $%.4f USD (24h %+0.2f%%) via Jupiter lite price. Free AI path: zkrouter.",
		tok.Symbol, tok.Name, px.USDPrice, px.PriceChange24h)
}

// LivePriceAnswer fetches a live Jupiter price for a price-style prompt.
func LivePriceAnswer(query string) (string, error) {
	tok := SymbolForPriceQuery(query)
	jup := NewJupiterClient("", "")
	prices, err := jup.GetPrices([]string{tok.Mint})
	if err != nil {
		return "", err
	}
	answer := FormatPriceAnswer(query, prices)
	if answer == "" {
		return "", fmt.Errorf("no live price for %s", tok.Symbol)
	}
	return answer, nil
}
