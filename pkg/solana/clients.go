// Package solana provides Solana blockchain integration for MawdBot.
// Clients for Helius RPC, Birdeye analytics, Jupiter swaps, and wallet management.
package solana

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

// ── Birdeye Client ───────────────────────────────────────────────────
// Token analytics, OHLCV, trending, technical signals.

type BirdeyeClient struct {
	apiKey     string
	baseURL    string
	httpClient *http.Client
}

type TokenOverview struct {
	Symbol            string  `json:"symbol"`
	Name              string  `json:"name"`
	Address           string  `json:"address"`
	Price             float64 `json:"price"`
	PriceChange24hPct float64 `json:"priceChange24hPercent"`
	Volume24h         float64 `json:"v24hUSD"`
	MarketCap         float64 `json:"mc"`
	Liquidity         float64 `json:"liquidity"`
	Holder            int     `json:"holder"`
	Trade24h          int     `json:"trade24h"`
	Buy24h            int     `json:"buy24h"`
	Sell24h           int     `json:"sell24h"`
}

type TechnicalSignals struct {
	RSI14        float64 `json:"rsi14"`
	EMA20        float64 `json:"ema20"`
	EMA50        float64 `json:"ema50"`
	VWAP         float64 `json:"vwap"`
	VolumeChange float64 `json:"volumeChange"`
	Trend        string  `json:"trend"`
	Signal       string  `json:"signal"`
}

type TrendingToken struct {
	Symbol    string  `json:"symbol"`
	Address   string  `json:"address"`
	Price     float64 `json:"price"`
	Change24h float64 `json:"change24h"`
	Volume24h float64 `json:"volume24h"`
	MCap      float64 `json:"mcap"`
	Rank      int     `json:"rank"`
}

type OHLCVBar struct {
	Open      float64 `json:"o"`
	High      float64 `json:"h"`
	Low       float64 `json:"l"`
	Close     float64 `json:"c"`
	Volume    float64 `json:"v"`
	Timestamp int64   `json:"unixTime"`
}

func NewBirdeyeClient(apiKey string) *BirdeyeClient {
	return &BirdeyeClient{
		apiKey:  apiKey,
		baseURL: "https://public-api.birdeye.so",
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

func (b *BirdeyeClient) GetTokenOverview(address string) (*TokenOverview, error) {
	url := fmt.Sprintf("%s/defi/token_overview?address=%s", b.baseURL, address)
	data, err := b.doRequest(url)
	if err != nil {
		return nil, err
	}

	var resp struct {
		Data TokenOverview `json:"data"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("parse token overview: %w", err)
	}
	return &resp.Data, nil
}

func (b *BirdeyeClient) GetTokenPrice(address string) (float64, error) {
	url := fmt.Sprintf("%s/defi/price?address=%s", b.baseURL, address)
	data, err := b.doRequest(url)
	if err != nil {
		return 0, err
	}

	var resp struct {
		Data struct {
			Value float64 `json:"value"`
		} `json:"data"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return 0, fmt.Errorf("parse price: %w", err)
	}
	return resp.Data.Value, nil
}

func (b *BirdeyeClient) GetTrending(limit int) ([]TrendingToken, error) {
	url := fmt.Sprintf("%s/defi/token_trending?sort_by=rank&sort_type=asc&offset=0&limit=%d", b.baseURL, limit)
	data, err := b.doRequest(url)
	if err != nil {
		return nil, err
	}

	var resp struct {
		Data struct {
			Tokens []TrendingToken `json:"tokens"`
		} `json:"data"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("parse trending: %w", err)
	}
	return resp.Data.Tokens, nil
}

func (b *BirdeyeClient) GetOHLCV(address string, resolution string, limit int) ([]OHLCVBar, error) {
	now := time.Now().Unix()
	from := now - int64(limit*3600) // rough approximation
	url := fmt.Sprintf("%s/defi/ohlcv?address=%s&type=%s&time_from=%d&time_to=%d",
		b.baseURL, address, resolution, from, now)
	data, err := b.doRequest(url)
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

func (b *BirdeyeClient) doRequest(url string) ([]byte, error) {
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("X-API-KEY", b.apiKey)
	req.Header.Set("x-chain", "solana")

	resp, err := b.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("birdeye request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("birdeye HTTP %d: %s", resp.StatusCode, string(body[:min(200, len(body))]))
	}
	return body, nil
}

// ── Helius Client ────────────────────────────────────────────────────
// Solana RPC, Enhanced API, DAS, WebSocket.

type HeliusClient struct {
	apiKey     string
	rpcURL     string
	wssURL     string
	network    string
	timeout    time.Duration
	maxRetries int
	backoff    time.Duration
	httpClient *http.Client
}

const (
	MainnetRPC = "https://mainnet.helius-rpc.com/"
	DevnetRPC  = "https://devnet.helius-rpc.com/"
	MainnetWSS = "wss://mainnet.helius-rpc.com/"
	DevnetWSS  = "wss://devnet.helius-rpc.com/"

	TokenProgramID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
)

type HeliusRPCError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    any    `json:"data,omitempty"`
}

func (e *HeliusRPCError) Error() string {
	if e == nil {
		return ""
	}
	return fmt.Sprintf("code=%d message=%s", e.Code, e.Message)
}

type heliusRPCResponse struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      any             `json:"id"`
	Result  json.RawMessage `json:"result"`
	Error   *HeliusRPCError `json:"error"`
}

type AccountBalance struct {
	SOL      float64 `json:"sol"`
	Lamports uint64  `json:"lamports"`
}

type TokenBalance struct {
	Mint   string  `json:"mint"`
	Amount float64 `json:"amount"`
	Symbol string  `json:"symbol"`
}

func NewHeliusClient(apiKey, rpcURL, wssURL string) *HeliusClient {
	return NewHeliusClientWithOptions(apiKey, rpcURL, wssURL, "mainnet", 20*time.Second, 3, 750*time.Millisecond)
}

func NewHeliusClientWithOptions(apiKey, rpcURL, wssURL, network string, timeout time.Duration, maxRetries int, backoff time.Duration) *HeliusClient {
	network = normalizeHeliusNetwork(network)
	if timeout <= 0 {
		timeout = 20 * time.Second
	}
	if maxRetries <= 0 {
		maxRetries = 3
	}
	if backoff <= 0 {
		backoff = 750 * time.Millisecond
	}

	if rpcURL == "" {
		if network == "devnet" {
			rpcURL = DevnetRPC
		} else {
			rpcURL = MainnetRPC
		}
	}
	if wssURL == "" {
		if network == "devnet" {
			wssURL = DevnetWSS
		} else {
			wssURL = MainnetWSS
		}
	}

	rpcURL = appendAPIKey(rpcURL, apiKey)
	wssURL = appendAPIKey(wssURL, apiKey)

	return &HeliusClient{
		apiKey:     apiKey,
		rpcURL:     rpcURL,
		wssURL:     wssURL,
		network:    network,
		timeout:    timeout,
		maxRetries: maxRetries,
		backoff:    backoff,
		httpClient: &http.Client{
			Timeout: timeout,
		},
	}
}

func (h *HeliusClient) GetBalance(pubkey string) (*AccountBalance, error) {
	var result struct {
		Value uint64 `json:"value"`
	}
	if err := h.rpcInto("getBalance", []any{pubkey}, &result); err != nil {
		return nil, err
	}

	return &AccountBalance{
		SOL:      float64(result.Value) / 1e9,
		Lamports: result.Value,
	}, nil
}

func (h *HeliusClient) GetSlot() (uint64, error) {
	var result uint64
	if err := h.rpcInto("getSlot", []any{}, &result); err != nil {
		return 0, err
	}
	return result, nil
}

func (h *HeliusClient) GetTokenBalances(pubkey string) ([]TokenBalance, error) {
	var result struct {
		Value []struct {
			Account struct {
				Data struct {
					Parsed struct {
						Info struct {
							Mint        string `json:"mint"`
							TokenAmount struct {
								UIAmount float64 `json:"uiAmount"`
							} `json:"tokenAmount"`
						} `json:"info"`
					} `json:"parsed"`
				} `json:"data"`
			} `json:"account"`
		} `json:"value"`
	}

	err := h.rpcInto(
		"getTokenAccountsByOwner",
		[]any{
			pubkey,
			map[string]string{"programId": TokenProgramID},
			map[string]string{"encoding": "jsonParsed"},
		},
		&result,
	)
	if err != nil {
		return nil, fmt.Errorf("parse token balances: %w", err)
	}

	var tokens []TokenBalance
	for _, v := range result.Value {
		info := v.Account.Data.Parsed.Info
		if info.TokenAmount.UIAmount > 0 {
			tokens = append(tokens, TokenBalance{
				Mint:   info.Mint,
				Amount: info.TokenAmount.UIAmount,
			})
		}
	}
	return tokens, nil
}

func (h *HeliusClient) GetAsset(assetID string, displayOptions map[string]any) (any, error) {
	params := map[string]any{"id": assetID}
	if len(displayOptions) > 0 {
		params["displayOptions"] = displayOptions
	}
	return h.RPCAny("getAsset", params)
}

func (h *HeliusClient) GetAssetBatch(ids []string) (any, error) {
	return h.RPCAny("getAssetBatch", map[string]any{"ids": ids})
}

func (h *HeliusClient) GetAssetProof(assetID string) (any, error) {
	return h.RPCAny("getAssetProof", map[string]any{"id": assetID})
}

func (h *HeliusClient) GetAssetsByOwner(ownerAddress string, page, limit int, tokenType string, displayOptions map[string]any) (any, error) {
	if page <= 0 {
		page = 1
	}
	if limit <= 0 {
		limit = 100
	}

	params := map[string]any{
		"ownerAddress": ownerAddress,
		"page":         page,
		"limit":        limit,
	}
	if tokenType != "" {
		params["tokenType"] = tokenType
	}
	if len(displayOptions) > 0 {
		params["displayOptions"] = displayOptions
	}

	return h.RPCAny("getAssetsByOwner", params)
}

func (h *HeliusClient) SearchAssets(params map[string]any) (any, error) {
	if params == nil {
		params = map[string]any{}
	}
	return h.RPCAny("searchAssets", params)
}

func (h *HeliusClient) GetSignaturesForAsset(assetID string, page, limit int) (any, error) {
	if page <= 0 {
		page = 1
	}
	if limit <= 0 {
		limit = 100
	}

	return h.RPCAny("getSignaturesForAsset", map[string]any{
		"id":    assetID,
		"page":  page,
		"limit": limit,
	})
}

func (h *HeliusClient) GetTokenAccountBalance(tokenAccount string) (any, error) {
	return h.RPCAny("getTokenAccountBalance", []any{tokenAccount})
}

func (h *HeliusClient) GetTokenAccountsByOwner(ownerAddress, programID, mint, encoding string) (any, error) {
	if encoding == "" {
		encoding = "jsonParsed"
	}

	var filter map[string]any
	if mint != "" {
		filter = map[string]any{"mint": mint}
	} else {
		if programID == "" {
			programID = TokenProgramID
		}
		filter = map[string]any{"programId": programID}
	}

	return h.RPCAny(
		"getTokenAccountsByOwner",
		[]any{ownerAddress, filter, map[string]any{"encoding": encoding}},
	)
}

func (h *HeliusClient) GetTokenSupply(mint string) (any, error) {
	return h.RPCAny("getTokenSupply", []any{mint})
}

func (h *HeliusClient) GetTokenLargestAccounts(mint string) (any, error) {
	return h.RPCAny("getTokenLargestAccounts", []any{mint})
}

func (h *HeliusClient) RPCAny(method string, params any) (any, error) {
	raw, err := h.rpcRaw(method, params)
	if err != nil {
		return nil, err
	}

	var result any
	if err := json.Unmarshal(raw, &result); err != nil {
		return nil, fmt.Errorf("parse %s result: %w", method, err)
	}
	return result, nil
}

func (h *HeliusClient) rpcInto(method string, params any, out any) error {
	raw, err := h.rpcRaw(method, params)
	if err != nil {
		return err
	}
	if out == nil {
		return nil
	}
	if err := json.Unmarshal(raw, out); err != nil {
		return fmt.Errorf("parse %s result: %w", method, err)
	}
	return nil
}

func (h *HeliusClient) rpcRaw(method string, params any) (json.RawMessage, error) {
	payload := map[string]any{
		"jsonrpc": "2.0",
		"id":      fmt.Sprintf("helius-%d", time.Now().UnixNano()),
		"method":  method,
		"params":  params,
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshal %s payload: %w", method, err)
	}

	var lastErr error
	for attempt := 1; attempt <= h.maxRetries; attempt++ {
		req, err := http.NewRequest(http.MethodPost, h.rpcURL, bytes.NewReader(jsonData))
		if err != nil {
			return nil, fmt.Errorf("create %s request: %w", method, err)
		}
		req.Header.Set("Content-Type", "application/json")

		resp, err := h.httpClient.Do(req)
		if err != nil {
			lastErr = fmt.Errorf("helius rpc transport: %w", err)
			if attempt < h.maxRetries {
				time.Sleep(h.backoff * time.Duration(1<<(attempt-1)))
				continue
			}
			break
		}

		body, readErr := io.ReadAll(resp.Body)
		resp.Body.Close()
		if readErr != nil {
			lastErr = fmt.Errorf("read %s response: %w", method, readErr)
			if attempt < h.maxRetries {
				time.Sleep(h.backoff * time.Duration(1<<(attempt-1)))
				continue
			}
			break
		}

		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			lastErr = fmt.Errorf("helius rpc HTTP %d: %s", resp.StatusCode, string(body[:min(200, len(body))]))
			if shouldRetryHTTP(resp.StatusCode) && attempt < h.maxRetries {
				time.Sleep(h.backoff * time.Duration(1<<(attempt-1)))
				continue
			}
			break
		}

		var rpcResp heliusRPCResponse
		if err := json.Unmarshal(body, &rpcResp); err != nil {
			lastErr = fmt.Errorf("decode %s response: %w", method, err)
			if attempt < h.maxRetries {
				time.Sleep(h.backoff * time.Duration(1<<(attempt-1)))
				continue
			}
			break
		}

		if rpcResp.Error != nil {
			return nil, fmt.Errorf("helius rpc %s failed: %w", method, rpcResp.Error)
		}

		if len(rpcResp.Result) == 0 {
			return json.RawMessage("null"), nil
		}
		return rpcResp.Result, nil
	}

	return nil, fmt.Errorf("helius rpc %s failed after %d attempts: %w", method, h.maxRetries, lastErr)
}

func normalizeHeliusNetwork(network string) string {
	if strings.EqualFold(strings.TrimSpace(network), "devnet") {
		return "devnet"
	}
	return "mainnet"
}

func appendAPIKey(endpoint, apiKey string) string {
	endpoint = strings.TrimSpace(endpoint)
	if endpoint == "" || apiKey == "" || strings.Contains(endpoint, "api-key=") || strings.Contains(endpoint, "api_key=") {
		return endpoint
	}

	separator := "?"
	if strings.Contains(endpoint, "?") {
		separator = "&"
	}

	queryKey := "api-key"
	if strings.Contains(endpoint, "solanatracker.io") {
		queryKey = "api_key"
	}

	return endpoint + separator + queryKey + "=" + url.QueryEscape(apiKey)
}

func shouldRetryHTTP(status int) bool {
	return status == http.StatusTooManyRequests || status >= 500
}

// ── Jupiter Client ───────────────────────────────────────────────────
// Swap routing and execution via Jupiter aggregator.

type JupiterClient struct {
	endpoint   string
	apiKey     string
	httpClient *http.Client
}

type SwapQuote struct {
	InputMint  string `json:"inputMint"`
	OutputMint string `json:"outputMint"`
	InAmount   string `json:"inAmount"`
	OutAmount  string `json:"outAmount"`
	Routes     int    `json:"routesCount"`
}

type SwapResult struct {
	Signature    string `json:"signature"`
	InputMint    string `json:"inputMint"`
	OutputMint   string `json:"outputMint"`
	InAmount     string `json:"inAmount"`
	OutAmount    string `json:"outAmount"`
	WalletPubkey string `json:"walletPublicKey"`
}

func NewJupiterClient(endpoint, apiKey string) *JupiterClient {
	if endpoint == "" {
		endpoint = "https://api.jup.ag"
	}
	return &JupiterClient{
		endpoint: endpoint,
		apiKey:   apiKey,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (j *JupiterClient) GetQuote(inputMint, outputMint string, amount uint64, slippageBps int) (*SwapQuote, error) {
	url := fmt.Sprintf("%s/v6/quote?inputMint=%s&outputMint=%s&amount=%d&slippageBps=%d",
		j.endpoint, inputMint, outputMint, amount, slippageBps)

	resp, err := j.httpClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("jupiter quote: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read quote: %w", err)
	}

	var quote SwapQuote
	if err := json.Unmarshal(body, &quote); err != nil {
		return nil, fmt.Errorf("parse quote: %w", err)
	}
	return &quote, nil
}

// ── Aster DEX Client ─────────────────────────────────────────────────
// Perpetual futures, funding rates, orderbook.

type AsterClient struct {
	apiKey     string
	apiSecret  string
	baseURL    string
	httpClient *http.Client
}

type PerpMarket struct {
	Symbol             string `json:"symbol"`
	LastPrice          string `json:"lastPrice"`
	PriceChangePercent string `json:"priceChangePercent"`
	QuoteVolume        string `json:"quoteVolume"`
	HighPrice          string `json:"highPrice"`
	LowPrice           string `json:"lowPrice"`
}

type MarketDigest struct {
	BTC         *PerpMarket `json:"btc"`
	ETH         *PerpMarket `json:"eth"`
	SOL         *PerpMarket `json:"sol"`
	MarketCount int         `json:"marketCount"`
	TotalVolume float64     `json:"totalVolume"`
}

type FundingRate struct {
	Symbol      string  `json:"symbol"`
	FundingRate float64 `json:"-"`
	FundingTime int64   `json:"nextFundingTime"`
}

func NewAsterClient(apiKey, apiSecret string) *AsterClient {
	return &AsterClient{
		apiKey:    apiKey,
		apiSecret: apiSecret,
		baseURL:   "https://fapi.asterdex.com",
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

func (a *AsterClient) ListMarkets() ([]PerpMarket, error) {
	url := fmt.Sprintf("%s/fapi/v3/ticker/24hr", a.baseURL)
	resp, err := a.httpClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("aster markets: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var markets []PerpMarket
	if err := json.Unmarshal(body, &markets); err != nil {
		return nil, fmt.Errorf("parse aster: %w", err)
	}
	return markets, nil
}

func (a *AsterClient) GetMarketDigest() (*MarketDigest, error) {
	markets, err := a.ListMarkets()
	if err != nil {
		return nil, err
	}

	digest := &MarketDigest{MarketCount: len(markets)}
	for i := range markets {
		digest.TotalVolume += parseAsterFloat(markets[i].QuoteVolume)
		switch markets[i].Symbol {
		case "BTCUSDT":
			digest.BTC = &markets[i]
		case "ETHUSDT":
			digest.ETH = &markets[i]
		case "SOLUSDT":
			digest.SOL = &markets[i]
		}
	}
	return digest, nil
}

func (a *AsterClient) GetFundingRate(symbol string) (*FundingRate, error) {
	url := fmt.Sprintf("%s/fapi/v3/premiumIndex?symbol=%s", a.baseURL, symbol)
	resp, err := a.httpClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("aster funding: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var raw struct {
		Symbol          string `json:"symbol"`
		LastFundingRate string `json:"lastFundingRate"`
		NextFundingTime int64  `json:"nextFundingTime"`
	}
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, fmt.Errorf("parse funding: %w", err)
	}
	rateValue, _ := strconv.ParseFloat(raw.LastFundingRate, 64)
	return &FundingRate{
		Symbol:      raw.Symbol,
		FundingRate: rateValue,
		FundingTime: raw.NextFundingTime,
	}, nil
}

// ── Helpers ──────────────────────────────────────────────────────────

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func parseAsterFloat(raw string) float64 {
	value, _ := strconv.ParseFloat(strings.TrimSpace(raw), 64)
	return value
}
