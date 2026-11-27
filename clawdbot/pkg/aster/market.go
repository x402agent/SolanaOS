// Package aster :: market.go
// Market data endpoints for both spot and futures.
//
// Futures: /fapi/v1/...
// Spot:    /api/v1/...
package aster

import (
	"encoding/json"
	"net/url"
	"strconv"
)

// ── Futures Market Data ──────────────────────────────────────────────

// FutPing tests connectivity to the futures REST API.
func (c *Client) FutPing() error {
	_, err := c.futGet("/fapi/v1/ping", nil)
	return err
}

// FutServerTime returns the server time in milliseconds.
func (c *Client) FutServerTime() (int64, error) {
	data, err := c.futGet("/fapi/v1/time", nil)
	if err != nil {
		return 0, err
	}
	var res struct {
		ServerTime int64 `json:"serverTime"`
	}
	if err := json.Unmarshal(data, &res); err != nil {
		return 0, err
	}
	return res.ServerTime, nil
}

// FutExchangeInfo returns trading rules and symbol information.
func (c *Client) FutExchangeInfo() (*ExchangeInfo, error) {
	data, err := c.futGet("/fapi/v1/exchangeInfo", nil)
	if err != nil {
		return nil, err
	}
	var info ExchangeInfo
	if err := json.Unmarshal(data, &info); err != nil {
		return nil, err
	}
	return &info, nil
}

// FutMarkPrice returns mark price and funding rate for a symbol (or all).
func (c *Client) FutMarkPrice(symbol string) ([]MarkPrice, error) {
	params := url.Values{}
	if symbol != "" {
		params.Set("symbol", symbol)
	}
	data, err := c.futGet("/fapi/v1/premiumIndex", params)
	if err != nil {
		return nil, err
	}

	// Single symbol returns object, all returns array
	if symbol != "" {
		var mp MarkPrice
		if err := json.Unmarshal(data, &mp); err != nil {
			return nil, err
		}
		return []MarkPrice{mp}, nil
	}
	var mps []MarkPrice
	if err := json.Unmarshal(data, &mps); err != nil {
		return nil, err
	}
	return mps, nil
}

// FutFundingRate returns funding rate history.
func (c *Client) FutFundingRate(symbol string, limit int) ([]FundingRate, error) {
	params := url.Values{}
	if symbol != "" {
		params.Set("symbol", symbol)
	}
	if limit > 0 {
		params.Set("limit", strconv.Itoa(limit))
	}
	data, err := c.futGet("/fapi/v1/fundingRate", params)
	if err != nil {
		return nil, err
	}
	var rates []FundingRate
	if err := json.Unmarshal(data, &rates); err != nil {
		return nil, err
	}
	return rates, nil
}

// FutFundingInfo returns funding rate configuration for all symbols.
func (c *Client) FutFundingInfo(symbol string) ([]FundingInfo, error) {
	params := url.Values{}
	if symbol != "" {
		params.Set("symbol", symbol)
	}
	data, err := c.futGet("/fapi/v1/fundingInfo", params)
	if err != nil {
		return nil, err
	}
	var info []FundingInfo
	if err := json.Unmarshal(data, &info); err != nil {
		return nil, err
	}
	return info, nil
}

// FutKlines returns candlestick data.
func (c *Client) FutKlines(symbol, interval string, limit int) ([]Kline, error) {
	params := url.Values{
		"symbol":   {symbol},
		"interval": {interval},
	}
	if limit > 0 {
		params.Set("limit", strconv.Itoa(limit))
	}
	data, err := c.futGet("/fapi/v1/klines", params)
	if err != nil {
		return nil, err
	}
	return parseKlines(data)
}

// FutTicker24hr returns 24hr price change statistics.
func (c *Client) FutTicker24hr(symbol string) ([]Ticker24hr, error) {
	params := url.Values{}
	if symbol != "" {
		params.Set("symbol", symbol)
	}
	data, err := c.futGet("/fapi/v1/ticker/24hr", params)
	if err != nil {
		return nil, err
	}
	if symbol != "" {
		var t Ticker24hr
		if err := json.Unmarshal(data, &t); err != nil {
			return nil, err
		}
		return []Ticker24hr{t}, nil
	}
	var ts []Ticker24hr
	if err := json.Unmarshal(data, &ts); err != nil {
		return nil, err
	}
	return ts, nil
}

// FutTickerPrice returns latest price for a symbol or all symbols.
func (c *Client) FutTickerPrice(symbol string) ([]PriceTicker, error) {
	params := url.Values{}
	if symbol != "" {
		params.Set("symbol", symbol)
	}
	data, err := c.futGet("/fapi/v1/ticker/price", params)
	if err != nil {
		return nil, err
	}
	if symbol != "" {
		var t PriceTicker
		if err := json.Unmarshal(data, &t); err != nil {
			return nil, err
		}
		return []PriceTicker{t}, nil
	}
	var ts []PriceTicker
	if err := json.Unmarshal(data, &ts); err != nil {
		return nil, err
	}
	return ts, nil
}

// FutBookTicker returns best bid/ask for a symbol or all.
func (c *Client) FutBookTicker(symbol string) ([]BookTicker, error) {
	params := url.Values{}
	if symbol != "" {
		params.Set("symbol", symbol)
	}
	data, err := c.futGet("/fapi/v1/ticker/bookTicker", params)
	if err != nil {
		return nil, err
	}
	if symbol != "" {
		var t BookTicker
		if err := json.Unmarshal(data, &t); err != nil {
			return nil, err
		}
		return []BookTicker{t}, nil
	}
	var ts []BookTicker
	if err := json.Unmarshal(data, &ts); err != nil {
		return nil, err
	}
	return ts, nil
}

// FutDepth returns order book depth.
func (c *Client) FutDepth(symbol string, limit int) (*Depth, error) {
	params := url.Values{"symbol": {symbol}}
	if limit > 0 {
		params.Set("limit", strconv.Itoa(limit))
	}
	data, err := c.futGet("/fapi/v1/depth", params)
	if err != nil {
		return nil, err
	}
	var d Depth
	if err := json.Unmarshal(data, &d); err != nil {
		return nil, err
	}
	return &d, nil
}

// FutIndexPriceKlines returns index price kline data.
func (c *Client) FutIndexPriceKlines(pair, interval string, limit int) ([]Kline, error) {
	params := url.Values{
		"pair":     {pair},
		"interval": {interval},
	}
	if limit > 0 {
		params.Set("limit", strconv.Itoa(limit))
	}
	data, err := c.futGet("/fapi/v1/indexPriceKlines", params)
	if err != nil {
		return nil, err
	}
	return parseKlines(data)
}

// FutMarkPriceKlines returns mark price kline data.
func (c *Client) FutMarkPriceKlines(symbol, interval string, limit int) ([]Kline, error) {
	params := url.Values{
		"symbol":   {symbol},
		"interval": {interval},
	}
	if limit > 0 {
		params.Set("limit", strconv.Itoa(limit))
	}
	data, err := c.futGet("/fapi/v1/markPriceKlines", params)
	if err != nil {
		return nil, err
	}
	return parseKlines(data)
}

// ── Spot Market Data ─────────────────────────────────────────────────

// SpotPing tests connectivity to the spot REST API.
func (c *Client) SpotPing() error {
	_, err := c.spotGet("/api/v1/ping", nil)
	return err
}

// SpotExchangeInfo returns spot trading rules and symbol information.
func (c *Client) SpotExchangeInfo() (*ExchangeInfo, error) {
	data, err := c.spotGet("/api/v1/exchangeInfo", nil)
	if err != nil {
		return nil, err
	}
	var info ExchangeInfo
	if err := json.Unmarshal(data, &info); err != nil {
		return nil, err
	}
	return &info, nil
}

// SpotKlines returns spot kline data.
func (c *Client) SpotKlines(symbol, interval string, limit int) ([]Kline, error) {
	params := url.Values{
		"symbol":   {symbol},
		"interval": {interval},
	}
	if limit > 0 {
		params.Set("limit", strconv.Itoa(limit))
	}
	data, err := c.spotGet("/api/v1/klines", params)
	if err != nil {
		return nil, err
	}
	return parseKlines(data)
}

// SpotTickerPrice returns latest spot price.
func (c *Client) SpotTickerPrice(symbol string) ([]PriceTicker, error) {
	params := url.Values{}
	if symbol != "" {
		params.Set("symbol", symbol)
	}
	data, err := c.spotGet("/api/v1/ticker/price", params)
	if err != nil {
		return nil, err
	}
	if symbol != "" {
		var t PriceTicker
		if err := json.Unmarshal(data, &t); err != nil {
			return nil, err
		}
		return []PriceTicker{t}, nil
	}
	var ts []PriceTicker
	if err := json.Unmarshal(data, &ts); err != nil {
		return nil, err
	}
	return ts, nil
}

// ── Kline Parser ─────────────────────────────────────────────────────

func parseKlines(data []byte) ([]Kline, error) {
	var raw [][]json.RawMessage
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil, err
	}
	klines := make([]Kline, len(raw))
	for i, row := range raw {
		if len(row) < 11 {
			continue
		}
		var k Kline
		json.Unmarshal(row[0], &k.OpenTime)
		json.Unmarshal(row[1], &k.Open)
		json.Unmarshal(row[2], &k.High)
		json.Unmarshal(row[3], &k.Low)
		json.Unmarshal(row[4], &k.Close)
		json.Unmarshal(row[5], &k.Volume)
		json.Unmarshal(row[6], &k.CloseTime)
		json.Unmarshal(row[7], &k.QuoteVolume)
		json.Unmarshal(row[8], &k.Trades)
		json.Unmarshal(row[9], &k.TakerBuyBaseVolume)
		json.Unmarshal(row[10], &k.TakerBuyQuoteVolume)
		klines[i] = k
	}
	return klines, nil
}
