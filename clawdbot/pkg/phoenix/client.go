// Package phoenix :: client.go
// HTTP client for the Phoenix perpetual futures REST API.
// Base URL: https://perp-api.phoenix.trade
package phoenix

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"time"
)

const DefaultAPIURL = "https://perp-api.phoenix.trade"

// Client is a thin HTTP wrapper around the Phoenix API.
// Market-data endpoints are public (no auth). Trader endpoints need
// the trader authority pubkey as a path parameter.
type Client struct {
	apiURL     string
	httpClient *http.Client
}

func NewClient(apiURL string) *Client {
	if apiURL == "" {
		apiURL = DefaultAPIURL
	}
	return &Client{
		apiURL:     apiURL,
		httpClient: &http.Client{Timeout: 15 * time.Second},
	}
}

// ── Market data (public) ──────────────────────────────────────────────

// ListMarkets returns all market configurations.
// GET /exchange/markets
func (c *Client) ListMarkets(ctx context.Context) ([]Market, error) {
	data, err := c.get(ctx, "/exchange/markets", nil)
	if err != nil {
		return nil, err
	}
	var markets []Market
	if err := json.Unmarshal(data, &markets); err != nil {
		return nil, fmt.Errorf("parse markets: %w", err)
	}
	return markets, nil
}

// GetSnapshot returns the full exchange snapshot with mark prices.
// GET /v1/exchange/snapshot
func (c *Client) GetSnapshot(ctx context.Context) (*ExchangeSnapshot, error) {
	data, err := c.get(ctx, "/v1/exchange/snapshot", nil)
	if err != nil {
		return nil, err
	}
	var snap ExchangeSnapshot
	if err := json.Unmarshal(data, &snap); err != nil {
		return nil, fmt.Errorf("parse snapshot: %w", err)
	}
	return &snap, nil
}

// GetCandles returns OHLCV candles for a market.
// Timeframe examples: "1m", "5m", "15m", "1h", "4h", "1d"
// GET /candles?symbol=SOL&timeframe=1h&limit=20
func (c *Client) GetCandles(ctx context.Context, symbol, timeframe string, limit int) ([]Candle, error) {
	params := url.Values{
		"symbol":    {symbol},
		"timeframe": {timeframe},
	}
	if limit > 0 {
		params.Set("limit", strconv.Itoa(limit))
	}
	data, err := c.get(ctx, "/candles", params)
	if err != nil {
		return nil, err
	}
	var candles []Candle
	if err := json.Unmarshal(data, &candles); err != nil {
		return nil, fmt.Errorf("parse candles: %w", err)
	}
	return candles, nil
}

// ── Trader endpoints (need authority pubkey) ──────────────────────────

// GetTraderState returns the trader's account state: positions, PnL, margins.
// GET /trader/{authority}/state
func (c *Client) GetTraderState(ctx context.Context, authority string, pdaIndex int) (*TraderStateResponse, error) {
	params := url.Values{}
	if pdaIndex > 0 {
		params.Set("pdaIndex", strconv.Itoa(pdaIndex))
	}
	path := "/trader/" + url.PathEscape(authority) + "/state"
	data, err := c.get(ctx, path, params)
	if err != nil {
		return nil, err
	}
	var resp TraderStateResponse
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("parse trader state: %w", err)
	}
	return &resp, nil
}

// GetOrderHistory returns paginated order history.
// GET /trader/{authority}/order-history
func (c *Client) GetOrderHistory(ctx context.Context, authority, symbol string, limit int, cursor string) (*PaginatedOrders, error) {
	params := url.Values{"limit": {strconv.Itoa(limit)}}
	if symbol != "" {
		params.Set("marketSymbol", symbol)
	}
	if cursor != "" {
		params.Set("cursor", cursor)
	}
	path := "/trader/" + url.PathEscape(authority) + "/order-history"
	data, err := c.get(ctx, path, params)
	if err != nil {
		return nil, err
	}
	var resp PaginatedOrders
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("parse order history: %w", err)
	}
	return &resp, nil
}

// GetTradeHistory returns paginated trade history.
// GET /trader/{authority}/trades-history
func (c *Client) GetTradeHistory(ctx context.Context, authority, symbol string, limit int, cursor string) (*PaginatedTrades, error) {
	params := url.Values{}
	if limit > 0 {
		params.Set("limit", strconv.Itoa(limit))
	}
	if symbol != "" {
		params.Set("marketSymbol", symbol)
	}
	if cursor != "" {
		params.Set("cursor", cursor)
	}
	path := "/trader/" + url.PathEscape(authority) + "/trades-history"
	data, err := c.get(ctx, path, params)
	if err != nil {
		return nil, err
	}
	var resp PaginatedTrades
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("parse trade history: %w", err)
	}
	return &resp, nil
}

// ── Order building ────────────────────────────────────────────────────

// BuildMarketOrder requests Phoenix to build an isolated market-order instruction set.
// POST /v1/ix/place-isolated-market-order
// Returns raw Solana instructions; call SignAndSend to execute.
func (c *Client) BuildMarketOrder(ctx context.Context, p MarketOrderParams) ([]Instruction, error) {
	body := map[string]any{
		"authority": p.Authority,
		"symbol":    p.Symbol,
		"side":      p.Side,
	}
	if p.Quantity > 0 {
		body["quantity"] = p.Quantity
	}
	if p.ReduceOnly {
		body["isReduceOnly"] = true
	}
	if p.PdaIndex > 0 {
		body["pdaIndex"] = p.PdaIndex
	}
	return c.buildInstructions(ctx, "/v1/ix/place-isolated-market-order", body)
}

// BuildLimitOrder requests Phoenix to build an isolated limit-order instruction set.
// POST /v1/ix/place-isolated-limit-order
func (c *Client) BuildLimitOrder(ctx context.Context, p LimitOrderParams) ([]Instruction, error) {
	body := map[string]any{
		"authority": p.Authority,
		"symbol":    p.Symbol,
		"side":      p.Side,
		"quantity":  p.Quantity,
		"price":     p.Price,
	}
	if p.ReduceOnly {
		body["isReduceOnly"] = true
	}
	if p.PdaIndex > 0 {
		body["pdaIndex"] = p.PdaIndex
	}
	return c.buildInstructions(ctx, "/v1/ix/place-isolated-limit-order", body)
}

func (c *Client) buildInstructions(ctx context.Context, path string, body map[string]any) ([]Instruction, error) {
	data, err := c.post(ctx, path, body)
	if err != nil {
		return nil, err
	}
	var ixs []Instruction
	if err := json.Unmarshal(data, &ixs); err != nil {
		return nil, fmt.Errorf("parse instructions: %w", err)
	}
	return ixs, nil
}

// ── HTTP helpers ──────────────────────────────────────────────────────

func (c *Client) get(ctx context.Context, path string, params url.Values) ([]byte, error) {
	reqURL := c.apiURL + path
	if len(params) > 0 {
		reqURL += "?" + params.Encode()
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	return c.do(req)
}

func (c *Client) post(ctx context.Context, path string, body map[string]any) ([]byte, error) {
	payload, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.apiURL+path, bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	return c.do(req)
}

func (c *Client) do(req *http.Request) ([]byte, error) {
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("phoenix request: %w", err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 400 {
		n := len(body)
		if n > 300 {
			n = 300
		}
		return nil, fmt.Errorf("phoenix HTTP %d: %s", resp.StatusCode, string(body[:n]))
	}
	return body, nil
}
