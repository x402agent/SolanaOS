// Package solana — tracker_swap.go implements the SolanaTracker Swap API v2.
// Supports Pump.fun, PumpSwap, Orca, Meteora, Moonshot, Raydium, and Jupiter routing.
//
// API: https://swap-v2.solanatracker.io/swap
// Docs: https://docs.solanatracker.io/swap-api
package solana

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const trackerSwapBaseURL = "https://swap-v2.solanatracker.io"

// TrackerSwapClient builds swap transactions via SolanaTracker's multi-venue aggregator.
type TrackerSwapClient struct {
	apiKey     string
	httpClient *http.Client
}

// TrackerSwapParams holds the parameters for a SolanaTracker swap.
type TrackerSwapParams struct {
	From             string  // base token mint address (SOL = So11111111111111111111111111111111111111112)
	To               string  // quote token mint address
	FromAmount       string  // numeric, "auto", or "50%"
	Slippage         float64 // 0-100
	Payer            string  // wallet public key
	PriorityFee      string  // numeric SOL amount or "auto"
	PriorityFeeLevel string  // min, low, medium, high, veryHigh, unsafeMax
	TxVersion        string  // "v0" or "legacy"
	Fee              string  // "WALLET:PERCENTAGE" for custom fees
	FeeType          string  // "add" or "deduct"
}

// TrackerSwapResponse is the response from the swap endpoint.
type TrackerSwapResponse struct {
	Txn  string `json:"txn"`
	Rate struct {
		AmountIn       float64 `json:"amountIn"`
		AmountOut      float64 `json:"amountOut"`
		MinAmountOut   float64 `json:"minAmountOut"`
		CurrentPrice   float64 `json:"currentPrice"`
		ExecutionPrice float64 `json:"executionPrice"`
		PriceImpact    float64 `json:"priceImpact"`
		Fee            float64 `json:"fee"`
		PlatformFee    int64   `json:"platformFee"`
		PlatformFeeUI  float64 `json:"platformFeeUI"`
	} `json:"rate"`
	TimeTaken float64 `json:"timeTaken"`
	Type      string  `json:"type"`
}

// TrackerRateResponse is a quote without a transaction.
type TrackerRateResponse struct {
	AmountIn       float64 `json:"amountIn"`
	AmountOut      float64 `json:"amountOut"`
	MinAmountOut   float64 `json:"minAmountOut"`
	CurrentPrice   float64 `json:"currentPrice"`
	ExecutionPrice float64 `json:"executionPrice"`
	PriceImpact    float64 `json:"priceImpact"`
	Fee            float64 `json:"fee"`
	PlatformFee    int64   `json:"platformFee"`
	PlatformFeeUI  float64 `json:"platformFeeUI"`
}

// NewTrackerSwapClient creates a new SolanaTracker swap client.
func NewTrackerSwapClient(apiKey string) *TrackerSwapClient {
	return &TrackerSwapClient{
		apiKey: apiKey,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// GetRate fetches a swap quote without building a transaction.
func (c *TrackerSwapClient) GetRate(ctx context.Context, from, to, amount string, slippage float64) (*TrackerRateResponse, error) {
	params := url.Values{
		"from":     {from},
		"to":       {to},
		"amount":   {amount},
		"slippage": {fmt.Sprintf("%.0f", slippage)},
	}

	req, err := http.NewRequestWithContext(ctx, "GET", trackerSwapBaseURL+"/rate?"+params.Encode(), nil)
	if err != nil {
		return nil, err
	}
	if c.apiKey != "" {
		req.Header.Set("x-api-key", c.apiKey)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("rate API returned %d: %s", resp.StatusCode, string(body))
	}

	var rate TrackerRateResponse
	if err := json.Unmarshal(body, &rate); err != nil {
		return nil, fmt.Errorf("rate parse error: %w", err)
	}
	return &rate, nil
}

// BuildSwap builds a swap transaction via the SolanaTracker API.
func (c *TrackerSwapClient) BuildSwap(ctx context.Context, p TrackerSwapParams) (*TrackerSwapResponse, error) {
	params := url.Values{
		"from":       {p.From},
		"to":         {p.To},
		"fromAmount": {p.FromAmount},
		"slippage":   {fmt.Sprintf("%.0f", p.Slippage)},
		"payer":      {p.Payer},
	}

	if p.PriorityFee != "" {
		params.Set("priorityFee", p.PriorityFee)
	}
	if p.PriorityFeeLevel != "" {
		params.Set("priorityFeeLevel", p.PriorityFeeLevel)
	}
	txVersion := p.TxVersion
	if txVersion == "" {
		txVersion = "v0"
	}
	params.Set("txVersion", txVersion)

	if p.Fee != "" {
		params.Set("fee", p.Fee)
	}
	if p.FeeType != "" {
		params.Set("feeType", p.FeeType)
	}

	req, err := http.NewRequestWithContext(ctx, "GET", trackerSwapBaseURL+"/swap?"+params.Encode(), nil)
	if err != nil {
		return nil, err
	}
	if c.apiKey != "" {
		req.Header.Set("x-api-key", c.apiKey)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("swap API returned %d: %s", resp.StatusCode, string(body))
	}

	var swapResp TrackerSwapResponse
	if err := json.Unmarshal(body, &swapResp); err != nil {
		return nil, fmt.Errorf("swap parse error: %w", err)
	}
	return &swapResp, nil
}

// FormatSwapSummary returns a human-readable summary of a swap result.
func FormatSwapSummary(resp *TrackerSwapResponse, fromSymbol, toSymbol string) string {
	var b strings.Builder
	b.WriteString(fmt.Sprintf("🔄 Swap: %s → %s\n", fromSymbol, toSymbol))
	b.WriteString(fmt.Sprintf("Amount In: %.6f %s\n", resp.Rate.AmountIn, fromSymbol))
	b.WriteString(fmt.Sprintf("Amount Out: %.6f %s\n", resp.Rate.AmountOut, toSymbol))
	b.WriteString(fmt.Sprintf("Min Out: %.6f %s\n", resp.Rate.MinAmountOut, toSymbol))
	b.WriteString(fmt.Sprintf("Price Impact: %.4f%%\n", resp.Rate.PriceImpact*100))
	b.WriteString(fmt.Sprintf("Fee: %.6f SOL\n", resp.Rate.Fee))
	b.WriteString(fmt.Sprintf("Time: %.3fs | Type: %s", resp.TimeTaken, resp.Type))
	return b.String()
}

// FormatRateSummary returns a human-readable quote summary.
func FormatRateSummary(rate *TrackerRateResponse, fromSymbol, toSymbol string) string {
	var b strings.Builder
	b.WriteString(fmt.Sprintf("📊 Quote: %s → %s\n", fromSymbol, toSymbol))
	b.WriteString(fmt.Sprintf("In: %.6f %s\n", rate.AmountIn, fromSymbol))
	b.WriteString(fmt.Sprintf("Out: %.6f %s\n", rate.AmountOut, toSymbol))
	b.WriteString(fmt.Sprintf("Min Out: %.6f %s\n", rate.MinAmountOut, toSymbol))
	b.WriteString(fmt.Sprintf("Price: $%.8f\n", rate.CurrentPrice))
	b.WriteString(fmt.Sprintf("Impact: %.4f%%\n", rate.PriceImpact*100))
	return b.String()
}
