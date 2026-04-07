package solana

import "strings"

// NewBirdeyeNewPairSubscription creates SUBSCRIBE_NEW_PAIR payload.
func NewBirdeyeNewPairSubscription() BirdeyeWSSubscription {
	return BirdeyeWSSubscription{Type: "SUBSCRIBE_NEW_PAIR"}
}

// NewBirdeyePairPriceSubscription creates a simple pair-price subscription.
func NewBirdeyePairPriceSubscription(pairAddress, chartType string) BirdeyeWSSubscription {
	chart := strings.TrimSpace(chartType)
	if chart == "" {
		chart = "1m"
	}
	return BirdeyeWSSubscription{
		Type: "SUBSCRIBE_PRICE",
		Data: map[string]any{
			"queryType": "simple",
			"chartType": chart,
			"address":   strings.TrimSpace(pairAddress),
			"currency":  "pair",
		},
	}
}

// NewBirdeyePairTxSubscription creates a simple pair transaction subscription.
func NewBirdeyePairTxSubscription(pairAddress string) BirdeyeWSSubscription {
	return BirdeyeWSSubscription{
		Type: "SUBSCRIBE_TXS",
		Data: map[string]any{
			"queryType":   "simple",
			"pairAddress": strings.TrimSpace(pairAddress),
		},
	}
}

// NewBirdeyeTokenPriceSubscription creates a simple token-level OHLCV price subscription.
// This subscribes to OHLCV updates for a token address (not pair).
func NewBirdeyeTokenPriceSubscription(tokenAddress, chartType, currency string) BirdeyeWSSubscription {
	chart := strings.TrimSpace(chartType)
	if chart == "" {
		chart = "1m"
	}
	cur := strings.TrimSpace(currency)
	if cur == "" {
		cur = "usd"
	}
	return BirdeyeWSSubscription{
		Type: "SUBSCRIBE_PRICE",
		Data: map[string]any{
			"queryType": "simple",
			"chartType": chart,
			"address":   strings.TrimSpace(tokenAddress),
			"currency":  cur,
		},
	}
}

// NewBirdeyeTokenTxSubscription creates a simple token transaction subscription.
func NewBirdeyeTokenTxSubscription(tokenAddress, txsType string) BirdeyeWSSubscription {
	tt := strings.TrimSpace(txsType)
	if tt == "" {
		tt = "swap"
	}
	return BirdeyeWSSubscription{
		Type: "SUBSCRIBE_TXS",
		Data: map[string]any{
			"queryType": "simple",
			"address":   strings.TrimSpace(tokenAddress),
			"txsType":   tt,
		},
	}
}

// NewBirdeyeBaseQuotePriceSubscription creates a base/quote price subscription.
func NewBirdeyeBaseQuotePriceSubscription(baseAddress, quoteAddress, chartType string) BirdeyeWSSubscription {
	chart := strings.TrimSpace(chartType)
	if chart == "" {
		chart = "1m"
	}
	return BirdeyeWSSubscription{
		Type: "SUBSCRIBE_BASE_QUOTE_PRICE",
		Data: map[string]any{
			"baseAddress":  strings.TrimSpace(baseAddress),
			"quoteAddress": strings.TrimSpace(quoteAddress),
			"chartType":    chart,
		},
	}
}

// NewBirdeyeTokenStatsSubscription creates a token stats subscription for real-time overview updates.
func NewBirdeyeTokenStatsSubscription(tokenAddress string) BirdeyeWSSubscription {
	return BirdeyeWSSubscription{
		Type: "SUBSCRIBE_TOKEN_STATS",
		Data: map[string]any{
			"address": strings.TrimSpace(tokenAddress),
		},
	}
}

// NewBirdeyePairPriceComplexSubscription creates a complex pair-price subscription.
func NewBirdeyePairPriceComplexSubscription(query string) BirdeyeWSSubscription {
	return BirdeyeWSSubscription{
		Type: "SUBSCRIBE_PRICE",
		Data: map[string]any{
			"queryType": "complex",
			"query":     strings.TrimSpace(query),
		},
	}
}

// NewBirdeyePairTxComplexSubscription creates a complex pair transaction subscription.
func NewBirdeyePairTxComplexSubscription(query string) BirdeyeWSSubscription {
	return BirdeyeWSSubscription{
		Type: "SUBSCRIBE_TXS",
		Data: map[string]any{
			"queryType": "complex",
			"query":     strings.TrimSpace(query),
		},
	}
}
