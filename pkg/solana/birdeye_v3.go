// Package solana :: birdeye_v3.go
// Comprehensive Birdeye API v3 methods for Solana token analytics.
// All endpoints use the BIRDEYE_API_KEY via the X-API-KEY header.
//
// Categories covered:
//   - Stats: Token Overview, Metadata, Market Data, Trade Data, Liquidity, Pair, Price Stats
//   - Token/Market List: Token List V3, New Listing
//   - Transactions: Token Trades V3, All Trades V3, Pair Trades, Filtered by Volume
//   - Wallet: Balance Change, Token Balance
//   - Transfers: Token/Wallet Transfer Lists
//   - Creation & Trending: Creation Info, Trending List
//   - Security: Token Security
//   - Search: Token Search
//   - Blockchain: Latest Block Number
//   - Mint/Burn: Token Mint/Burn
//   - Holder: Token Holders
package solana

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
)

// ═══════════════════════════════════════════════════════════════════════
// STATS: Token Overview, Metadata, Market Data, Trade Data
// ═══════════════════════════════════════════════════════════════════════

// GetTokenOverviewV3 returns rich overview with multi-timeframe price changes.
func (b *BirdeyeClient) GetTokenOverviewV3(address string) (*TokenOverviewV3, error) {
	u := fmt.Sprintf("%s/defi/token_overview?address=%s", b.baseURL, address)
	data, err := b.doRequest(u)
	if err != nil {
		return nil, err
	}
	var resp struct {
		Data TokenOverviewV3 `json:"data"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("parse token overview v3: %w", err)
	}
	return &resp.Data, nil
}

// GetTokenMetadata returns metadata (symbol, name, decimals, extensions, logo) for a single token.
func (b *BirdeyeClient) GetTokenMetadata(address string) (*TokenMetadata, error) {
	u := fmt.Sprintf("%s/defi/v3/token/meta-data/single?address=%s", b.baseURL, address)
	data, err := b.doRequest(u)
	if err != nil {
		return nil, err
	}
	var resp struct {
		Data TokenMetadata `json:"data"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("parse token metadata: %w", err)
	}
	return &resp.Data, nil
}

// GetTokenMetadataMultiple returns metadata for up to 50 tokens.
func (b *BirdeyeClient) GetTokenMetadataMultiple(addresses []string) (map[string]TokenMetadata, error) {
	joined := strings.Join(addresses, ",")
	u := fmt.Sprintf("%s/defi/v3/token/meta-data/multiple?list_address=%s", b.baseURL, joined)
	data, err := b.doRequest(u)
	if err != nil {
		return nil, err
	}
	var resp struct {
		Data map[string]TokenMetadata `json:"data"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("parse multi-metadata: %w", err)
	}
	return resp.Data, nil
}

// GetTokenMarketData returns market data (price, mcap, fdv, liquidity, supply, holders).
func (b *BirdeyeClient) GetTokenMarketData(address string) (*TokenMarketData, error) {
	u := fmt.Sprintf("%s/defi/v3/token/market-data?address=%s", b.baseURL, address)
	data, err := b.doRequest(u)
	if err != nil {
		return nil, err
	}
	var resp struct {
		Data TokenMarketData `json:"data"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("parse market data: %w", err)
	}
	return &resp.Data, nil
}

// GetTokenMarketDataMultiple returns market data for up to 20 tokens.
func (b *BirdeyeClient) GetTokenMarketDataMultiple(addresses []string) (map[string]TokenMarketData, error) {
	joined := strings.Join(addresses, ",")
	u := fmt.Sprintf("%s/defi/v3/token/market-data/multiple?list_address=%s", b.baseURL, joined)
	data, err := b.doRequest(u)
	if err != nil {
		return nil, err
	}
	var resp struct {
		Data map[string]TokenMarketData `json:"data"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("parse multi market data: %w", err)
	}
	return resp.Data, nil
}

// GetTokenTradeData returns detailed trade data with multi-timeframe buy/sell volume.
func (b *BirdeyeClient) GetTokenTradeData(address string) (*TokenTradeData, error) {
	u := fmt.Sprintf("%s/defi/v3/token/trade-data/single?address=%s", b.baseURL, address)
	data, err := b.doRequest(u)
	if err != nil {
		return nil, err
	}
	var resp struct {
		Data TokenTradeData `json:"data"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("parse trade data: %w", err)
	}
	return &resp.Data, nil
}

// GetTokenTradeDataMultiple returns trade data for up to 20 tokens.
func (b *BirdeyeClient) GetTokenTradeDataMultiple(addresses []string) (map[string]TokenTradeData, error) {
	joined := strings.Join(addresses, ",")
	u := fmt.Sprintf("%s/defi/v3/token/trade-data/multiple?list_address=%s", b.baseURL, joined)
	data, err := b.doRequest(u)
	if err != nil {
		return nil, err
	}
	var resp struct {
		Data map[string]TokenTradeData `json:"data"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("parse multi trade data: %w", err)
	}
	return resp.Data, nil
}

// ═══════════════════════════════════════════════════════════════════════
// PAIRS
// ═══════════════════════════════════════════════════════════════════════

// GetPairOverview returns pair overview for a single pair address.
func (b *BirdeyeClient) GetPairOverview(address string) (*PairOverview, error) {
	u := fmt.Sprintf("%s/defi/v3/pair/overview/single?address=%s", b.baseURL, address)
	data, err := b.doRequest(u)
	if err != nil {
		return nil, err
	}
	var resp struct {
		Data PairOverview `json:"data"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("parse pair overview: %w", err)
	}
	return &resp.Data, nil
}

// GetPairOverviewMultiple returns pair overview for up to 20 pairs.
func (b *BirdeyeClient) GetPairOverviewMultiple(addresses []string) (map[string]PairOverview, error) {
	joined := strings.Join(addresses, ",")
	u := fmt.Sprintf("%s/defi/v3/pair/overview/multiple?list_address=%s", b.baseURL, joined)
	data, err := b.doRequest(u)
	if err != nil {
		return nil, err
	}
	var resp struct {
		Data map[string]PairOverview `json:"data"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("parse multi pair overview: %w", err)
	}
	return resp.Data, nil
}

// ═══════════════════════════════════════════════════════════════════════
// PRICE STATS
// ═══════════════════════════════════════════════════════════════════════

// GetPriceStats returns price stats (high/low/change) across timeframes for a single token.
func (b *BirdeyeClient) GetPriceStats(address string, timeframes string) ([]PriceStatsItem, error) {
	u := fmt.Sprintf("%s/defi/v3/price/stats/single?address=%s", b.baseURL, address)
	if timeframes != "" {
		u += "&list_timeframe=" + timeframes
	}
	data, err := b.doRequest(u)
	if err != nil {
		return nil, err
	}
	var resp struct {
		Data []PriceStatsItem `json:"data"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("parse price stats: %w", err)
	}
	return resp.Data, nil
}

// ═══════════════════════════════════════════════════════════════════════
// TOKEN LIST
// ═══════════════════════════════════════════════════════════════════════

// TokenListOpts configures a token list query.
type TokenListOpts struct {
	SortBy         string  // liquidity, volume_24h_usd, price_change_24h_percent, etc.
	SortType       string  // desc, asc
	Offset         int
	Limit          int     // 1-100
	MinLiquidity   float64
	MinMarketCap   float64
	MinVolume24h   float64
	MinHolder      int
}

// GetTokenList returns a paginated list of tokens sorted by the given criteria.
func (b *BirdeyeClient) GetTokenList(opts TokenListOpts) ([]TokenListItem, error) {
	if opts.SortBy == "" {
		opts.SortBy = "liquidity"
	}
	if opts.SortType == "" {
		opts.SortType = "desc"
	}
	if opts.Limit <= 0 {
		opts.Limit = 50
	}

	u := fmt.Sprintf("%s/defi/v3/token/list?sort_by=%s&sort_type=%s&offset=%d&limit=%d",
		b.baseURL, opts.SortBy, opts.SortType, opts.Offset, opts.Limit)

	if opts.MinLiquidity > 0 {
		u += fmt.Sprintf("&min_liquidity=%.0f", opts.MinLiquidity)
	}
	if opts.MinMarketCap > 0 {
		u += fmt.Sprintf("&min_market_cap=%.0f", opts.MinMarketCap)
	}
	if opts.MinVolume24h > 0 {
		u += fmt.Sprintf("&min_volume_24h_usd=%.0f", opts.MinVolume24h)
	}
	if opts.MinHolder > 0 {
		u += fmt.Sprintf("&min_holder=%d", opts.MinHolder)
	}

	data, err := b.doRequest(u)
	if err != nil {
		return nil, err
	}
	var resp struct {
		Data struct {
			Items []TokenListItem `json:"items"`
		} `json:"data"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("parse token list: %w", err)
	}
	return resp.Data.Items, nil
}

// GetNewListingTokens returns recently listed tokens.
func (b *BirdeyeClient) GetNewListingTokens(limit int) ([]NewListingToken, error) {
	if limit <= 0 {
		limit = 20
	}
	u := fmt.Sprintf("%s/defi/v3/token/new-listing?limit=%d", b.baseURL, limit)
	data, err := b.doRequest(u)
	if err != nil {
		return nil, err
	}
	var resp struct {
		Data struct {
			Items []NewListingToken `json:"items"`
		} `json:"data"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("parse new listings: %w", err)
	}
	return resp.Data.Items, nil
}

// ═══════════════════════════════════════════════════════════════════════
// TRANSACTIONS
// ═══════════════════════════════════════════════════════════════════════

// GetTokenTrades returns token-specific trades (V3).
func (b *BirdeyeClient) GetTokenTrades(address string, limit int, txType string) ([]TradeItem, bool, error) {
	if limit <= 0 {
		limit = 50
	}
	if txType == "" {
		txType = "swap"
	}
	u := fmt.Sprintf("%s/defi/v3/token/txs?address=%s&limit=%d&tx_type=%s&sort_by=block_unix_time&sort_type=desc",
		b.baseURL, address, limit, txType)
	data, err := b.doRequest(u)
	if err != nil {
		return nil, false, err
	}
	var resp struct {
		Data struct {
			Items   []TradeItem `json:"items"`
			HasNext bool        `json:"has_next"`
		} `json:"data"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, false, fmt.Errorf("parse token trades: %w", err)
	}
	return resp.Data.Items, resp.Data.HasNext, nil
}

// GetAllTrades returns all trades across all tokens (V3).
func (b *BirdeyeClient) GetAllTrades(limit int) ([]TradeItem, bool, error) {
	if limit <= 0 {
		limit = 50
	}
	u := fmt.Sprintf("%s/defi/v3/txs?limit=%d&sort_by=block_unix_time&sort_type=desc&tx_type=swap",
		b.baseURL, limit)
	data, err := b.doRequest(u)
	if err != nil {
		return nil, false, err
	}
	var resp struct {
		Data struct {
			Items   []TradeItem `json:"items"`
			HasNext bool        `json:"hasNext"`
		} `json:"data"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, false, fmt.Errorf("parse all trades: %w", err)
	}
	return resp.Data.Items, resp.Data.HasNext, nil
}

// GetTokenTradesByVolume returns trades filtered by volume.
func (b *BirdeyeClient) GetTokenTradesByVolume(address string, minVolume, maxVolume float64, limit int) ([]TradeItem, error) {
	if limit <= 0 {
		limit = 50
	}
	u := fmt.Sprintf("%s/defi/v3/token/txs-by-volume?token_address=%s&volume_type=usd&sort_type=desc&limit=%d",
		b.baseURL, address, limit)
	if minVolume > 0 {
		u += fmt.Sprintf("&min_volume=%.2f", minVolume)
	}
	if maxVolume > 0 {
		u += fmt.Sprintf("&max_volume=%.2f", maxVolume)
	}
	data, err := b.doRequest(u)
	if err != nil {
		return nil, err
	}
	var resp struct {
		Data struct {
			Items []TradeItem `json:"items"`
		} `json:"data"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("parse volume trades: %w", err)
	}
	return resp.Data.Items, nil
}

// GetMintBurnTxs returns mint/burn transactions for a token.
func (b *BirdeyeClient) GetMintBurnTxs(address string, mbType string, limit int) ([]MintBurnTx, error) {
	if limit <= 0 {
		limit = 20
	}
	if mbType == "" {
		mbType = "all"
	}
	u := fmt.Sprintf("%s/defi/v3/token/mint-burn-txs?address=%s&type=%s&sort_by=block_time&sort_type=desc&limit=%d",
		b.baseURL, address, mbType, limit)
	data, err := b.doRequest(u)
	if err != nil {
		return nil, err
	}
	var resp struct {
		Data struct {
			Items []MintBurnTx `json:"items"`
		} `json:"data"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("parse mint/burn: %w", err)
	}
	return resp.Data.Items, nil
}

// ═══════════════════════════════════════════════════════════════════════
// WALLET, BALANCE & TRANSFER
// ═══════════════════════════════════════════════════════════════════════

// GetWalletBalanceChanges returns balance change history for a wallet.
func (b *BirdeyeClient) GetWalletBalanceChanges(walletAddr string, limit int) ([]WalletBalanceChange, error) {
	if limit <= 0 {
		limit = 20
	}
	u := fmt.Sprintf("%s/wallet/v2/balance-change?address=%s&limit=%d", b.baseURL, walletAddr, limit)
	data, err := b.doRequest(u)
	if err != nil {
		return nil, err
	}
	var resp struct {
		Data struct {
			Items []WalletBalanceChange `json:"items"`
		} `json:"data"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("parse balance changes: %w", err)
	}
	return resp.Data.Items, nil
}

// GetWalletTokenBalances returns token balances for a wallet (POST method).
func (b *BirdeyeClient) GetWalletTokenBalances(walletAddr string, tokenAddresses []string) ([]WalletTokenBalance, error) {
	body := map[string]any{
		"wallet":          walletAddr,
		"token_addresses": tokenAddresses,
	}
	data, err := b.doPostRequest(fmt.Sprintf("%s/wallet/v2/token-balance", b.baseURL), body)
	if err != nil {
		return nil, err
	}
	var resp struct {
		Data []WalletTokenBalance `json:"data"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("parse wallet balances: %w", err)
	}
	return resp.Data, nil
}

// GetWalletSingleTokenBalance returns a single token balance in a wallet.
func (b *BirdeyeClient) GetWalletSingleTokenBalance(walletAddr, tokenAddr string) (*WalletTokenBalance, error) {
	u := fmt.Sprintf("%s/v1/wallet/token_balance?wallet=%s&token_address=%s", b.baseURL, walletAddr, tokenAddr)
	data, err := b.doRequest(u)
	if err != nil {
		return nil, err
	}
	var resp struct {
		Data WalletTokenBalance `json:"data"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("parse wallet token balance: %w", err)
	}
	return &resp.Data, nil
}

// GetTokenTransfers returns a list of token transfer transactions (POST method).
func (b *BirdeyeClient) GetTokenTransfers(tokenAddr string, limit int) ([]TokenTransfer, error) {
	if limit <= 0 {
		limit = 20
	}
	body := map[string]any{
		"token_address": tokenAddr,
		"limit":         limit,
	}
	data, err := b.doPostRequest(fmt.Sprintf("%s/token/v1/transfer", b.baseURL), body)
	if err != nil {
		return nil, err
	}
	var resp struct {
		Data []TokenTransfer `json:"data"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("parse token transfers: %w", err)
	}
	return resp.Data, nil
}

// GetWalletTransfers returns transfer list for a wallet (POST method).
func (b *BirdeyeClient) GetWalletTransfers(walletAddr string, limit int) ([]TokenTransfer, error) {
	if limit <= 0 {
		limit = 20
	}
	body := map[string]any{
		"wallet": walletAddr,
		"limit":  limit,
	}
	data, err := b.doPostRequest(fmt.Sprintf("%s/wallet/v2/transfer", b.baseURL), body)
	if err != nil {
		return nil, err
	}
	var resp struct {
		Data []TokenTransfer `json:"data"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("parse wallet transfers: %w", err)
	}
	return resp.Data, nil
}

// ═══════════════════════════════════════════════════════════════════════
// CREATION & TRENDING
// ═══════════════════════════════════════════════════════════════════════

// GetTokenCreationInfo returns the creation transaction info for a token.
func (b *BirdeyeClient) GetTokenCreationInfo(address string) (*TokenCreationInfo, error) {
	u := fmt.Sprintf("%s/defi/token_creation_info?address=%s", b.baseURL, address)
	data, err := b.doRequest(u)
	if err != nil {
		return nil, err
	}
	var resp struct {
		Data TokenCreationInfo `json:"data"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("parse creation info: %w", err)
	}
	return &resp.Data, nil
}

// GetTrendingV3 returns trending tokens list.
func (b *BirdeyeClient) GetTrendingV3(limit int) ([]TrendingTokenV3, error) {
	if limit <= 0 {
		limit = 20
	}
	u := fmt.Sprintf("%s/defi/token_trending?sort_by=rank&sort_type=asc&offset=0&limit=%d", b.baseURL, limit)
	data, err := b.doRequest(u)
	if err != nil {
		return nil, err
	}
	var resp struct {
		Data struct {
			Items  []TrendingTokenV3 `json:"items"`
			Tokens []TrendingTokenV3 `json:"tokens"` // legacy format
		} `json:"data"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("parse trending: %w", err)
	}
	if len(resp.Data.Items) > 0 {
		return resp.Data.Items, nil
	}
	return resp.Data.Tokens, nil
}

// ═══════════════════════════════════════════════════════════════════════
// SECURITY
// ═══════════════════════════════════════════════════════════════════════

// GetTokenSecurity returns security analysis for a token.
func (b *BirdeyeClient) GetTokenSecurity(address string) (*TokenSecurity, error) {
	u := fmt.Sprintf("%s/defi/token_security?address=%s", b.baseURL, address)
	data, err := b.doRequest(u)
	if err != nil {
		return nil, err
	}
	var resp struct {
		Data TokenSecurity `json:"data"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("parse security: %w", err)
	}
	return &resp.Data, nil
}

// ═══════════════════════════════════════════════════════════════════════
// SEARCH
// ═══════════════════════════════════════════════════════════════════════

// SearchToken searches for tokens by keyword.
func (b *BirdeyeClient) SearchToken(keyword string, limit int) ([]SearchResult, error) {
	if limit <= 0 {
		limit = 10
	}
	u := fmt.Sprintf("%s/defi/v3/search?keyword=%s&chain=solana&target=token&sort_by=liquidity&sort_type=desc&limit=%d",
		b.baseURL, url.QueryEscape(keyword), limit)
	data, err := b.doRequest(u)
	if err != nil {
		return nil, err
	}
	var resp struct {
		Data struct {
			Items []SearchResult `json:"items"`
		} `json:"data"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("parse search: %w", err)
	}
	return resp.Data.Items, nil
}

// ═══════════════════════════════════════════════════════════════════════
// BLOCKCHAIN
// ═══════════════════════════════════════════════════════════════════════

// GetLatestBlockNumber returns the latest block number.
func (b *BirdeyeClient) GetLatestBlockNumber() (int64, error) {
	u := fmt.Sprintf("%s/defi/v3/txs/latest-block", b.baseURL)
	data, err := b.doRequest(u)
	if err != nil {
		return 0, err
	}
	var resp struct {
		Data struct {
			BlockNumber int64 `json:"block_number"`
		} `json:"data"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return 0, fmt.Errorf("parse latest block: %w", err)
	}
	return resp.Data.BlockNumber, nil
}

// ═══════════════════════════════════════════════════════════════════════
// HOLDERS
// ═══════════════════════════════════════════════════════════════════════

// GetTokenHolders returns top holders for a token.
func (b *BirdeyeClient) GetTokenHolders(address string, limit int) ([]TokenHolder, error) {
	if limit <= 0 {
		limit = 20
	}
	u := fmt.Sprintf("%s/defi/v3/token/holder?address=%s&limit=%d", b.baseURL, address, limit)
	data, err := b.doRequest(u)
	if err != nil {
		return nil, err
	}
	var resp struct {
		Data struct {
			Items []TokenHolder `json:"items"`
		} `json:"data"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("parse holders: %w", err)
	}
	return resp.Data.Items, nil
}

// ═══════════════════════════════════════════════════════════════════════
// POST HTTP HELPER
// ═══════════════════════════════════════════════════════════════════════

func (b *BirdeyeClient) doPostRequest(reqURL string, body any) ([]byte, error) {
	jsonData, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest("POST", reqURL, bytes.NewReader(jsonData))
	if err != nil {
		return nil, err
	}
	req.Header.Set("X-API-KEY", b.apiKey)
	req.Header.Set("x-chain", "solana")
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := b.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("birdeye POST request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read POST response: %w", err)
	}

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("birdeye HTTP %d: %s", resp.StatusCode, string(respBody[:min(200, len(respBody))]))
	}
	return respBody, nil
}
