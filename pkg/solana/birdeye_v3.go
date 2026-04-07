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

// GetTokenLiquidity returns liquidity data for a single token.
func (b *BirdeyeClient) GetTokenLiquidity(address string) (*TokenLiquidityData, error) {
	u := fmt.Sprintf("%s/defi/v3/token/liquidity/single?address=%s", b.baseURL, address)
	data, err := b.doRequest(u)
	if err != nil {
		return nil, err
	}
	var resp struct {
		Data TokenLiquidityData `json:"data"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("parse token liquidity: %w", err)
	}
	return &resp.Data, nil
}

// GetTokenLiquidityMultiple returns liquidity data for up to 20 tokens.
func (b *BirdeyeClient) GetTokenLiquidityMultiple(addresses []string) (map[string]TokenLiquidityData, error) {
	joined := strings.Join(addresses, ",")
	u := fmt.Sprintf("%s/defi/v3/token/liquidity/multiple?list_address=%s", b.baseURL, joined)
	data, err := b.doRequest(u)
	if err != nil {
		return nil, err
	}
	var resp struct {
		Data map[string]TokenLiquidityData `json:"data"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("parse multi liquidity: %w", err)
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

// GetPriceStatsMultiple returns price stats for up to 20 tokens.
func (b *BirdeyeClient) GetPriceStatsMultiple(addresses []string, timeframes string) ([]PriceStatsItem, error) {
	if len(addresses) == 0 {
		return nil, fmt.Errorf("addresses required")
	}
	u := fmt.Sprintf("%s/defi/v3/price/stats/multiple", b.baseURL)
	if strings.TrimSpace(timeframes) != "" {
		u += "?list_timeframe=" + url.QueryEscape(strings.TrimSpace(timeframes))
	}
	body := map[string]any{
		"list_address": strings.Join(addresses, ","),
	}
	data, err := b.doPostRequest(u, body)
	if err != nil {
		return nil, err
	}
	var resp struct {
		Data []PriceStatsItem `json:"data"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("parse multi price stats: %w", err)
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

// GetTokenListScroll returns a large token page and optional next_scroll_id.
func (b *BirdeyeClient) GetTokenListScroll(opts TokenListOpts, scrollID string, limit int) (*TokenListScrollPage, error) {
	if limit <= 0 {
		limit = 5000
	}
	v := url.Values{}
	v.Set("limit", fmt.Sprintf("%d", limit))
	if strings.TrimSpace(scrollID) != "" {
		v.Set("scroll_id", strings.TrimSpace(scrollID))
	} else {
		sortBy := strings.TrimSpace(opts.SortBy)
		if sortBy == "" {
			sortBy = "liquidity"
		}
		sortType := strings.TrimSpace(opts.SortType)
		if sortType == "" {
			sortType = "desc"
		}
		v.Set("sort_by", sortBy)
		v.Set("sort_type", sortType)
		if opts.MinLiquidity > 0 {
			v.Set("min_liquidity", fmt.Sprintf("%.0f", opts.MinLiquidity))
		}
		if opts.MinMarketCap > 0 {
			v.Set("min_market_cap", fmt.Sprintf("%.0f", opts.MinMarketCap))
		}
		if opts.MinVolume24h > 0 {
			v.Set("min_volume_24h_usd", fmt.Sprintf("%.0f", opts.MinVolume24h))
		}
		if opts.MinHolder > 0 {
			v.Set("min_holder", fmt.Sprintf("%d", opts.MinHolder))
		}
	}

	u := fmt.Sprintf("%s/defi/v3/token/list/scroll?%s", b.baseURL, v.Encode())
	data, err := b.doRequest(u)
	if err != nil {
		return nil, err
	}
	var resp struct {
		Data TokenListScrollPage `json:"data"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("parse token list scroll: %w", err)
	}
	return &resp.Data, nil
}

// GetTokenListV1 returns legacy token list endpoint data.
func (b *BirdeyeClient) GetTokenListV1(sortBy, sortType string, offset, limit int, minLiquidity float64) ([]TokenListV1Item, int, error) {
	if strings.TrimSpace(sortBy) == "" {
		sortBy = "v24hUSD"
	}
	if strings.TrimSpace(sortType) == "" {
		sortType = "desc"
	}
	if limit <= 0 {
		limit = 50
	}
	v := url.Values{}
	v.Set("sort_by", sortBy)
	v.Set("sort_type", sortType)
	v.Set("offset", fmt.Sprintf("%d", offset))
	v.Set("limit", fmt.Sprintf("%d", limit))
	if minLiquidity > 0 {
		v.Set("min_liquidity", fmt.Sprintf("%.0f", minLiquidity))
	}
	u := fmt.Sprintf("%s/defi/tokenlist?%s", b.baseURL, v.Encode())
	data, err := b.doRequest(u)
	if err != nil {
		return nil, 0, err
	}
	var resp struct {
		Data struct {
			Total  int               `json:"total"`
			Tokens []TokenListV1Item `json:"tokens"`
		} `json:"data"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, 0, fmt.Errorf("parse token list v1: %w", err)
	}
	return resp.Data.Tokens, resp.Data.Total, nil
}

// GetTokenAllMarkets returns market/pair list for a token.
func (b *BirdeyeClient) GetTokenAllMarkets(address, timeFrame, sortBy, sortType string, offset, limit int) ([]MarketListItem, int, error) {
	if strings.TrimSpace(address) == "" {
		return nil, 0, fmt.Errorf("address required")
	}
	if strings.TrimSpace(timeFrame) == "" {
		timeFrame = "24h"
	}
	if strings.TrimSpace(sortBy) == "" {
		sortBy = "liquidity"
	}
	if strings.TrimSpace(sortType) == "" {
		sortType = "desc"
	}
	if limit <= 0 {
		limit = 10
	}
	v := url.Values{}
	v.Set("address", address)
	v.Set("time_frame", timeFrame)
	v.Set("sort_by", sortBy)
	v.Set("sort_type", sortType)
	v.Set("offset", fmt.Sprintf("%d", offset))
	v.Set("limit", fmt.Sprintf("%d", limit))
	u := fmt.Sprintf("%s/defi/v2/markets?%s", b.baseURL, v.Encode())

	data, err := b.doRequest(u)
	if err != nil {
		return nil, 0, err
	}
	var resp struct {
		Data struct {
			Items []MarketListItem `json:"items"`
			Total int              `json:"total"`
		} `json:"data"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, 0, fmt.Errorf("parse token markets: %w", err)
	}
	return resp.Data.Items, resp.Data.Total, nil
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

// GetPairTrades returns transactions for a specific pair address.
func (b *BirdeyeClient) GetPairTrades(address string, limit int, txType, sortType string) ([]PairTradeItem, bool, error) {
	if strings.TrimSpace(address) == "" {
		return nil, false, fmt.Errorf("address required")
	}
	if limit <= 0 {
		limit = 50
	}
	if strings.TrimSpace(txType) == "" {
		txType = "swap"
	}
	if strings.TrimSpace(sortType) == "" {
		sortType = "desc"
	}
	v := url.Values{}
	v.Set("address", address)
	v.Set("limit", fmt.Sprintf("%d", limit))
	v.Set("tx_type", txType)
	v.Set("sort_type", sortType)
	u := fmt.Sprintf("%s/defi/txs/pair?%s", b.baseURL, v.Encode())
	data, err := b.doRequest(u)
	if err != nil {
		return nil, false, err
	}
	var resp struct {
		Data struct {
			Items   []PairTradeItem `json:"items"`
			HasNext bool            `json:"hasNext"`
			HasNext2 bool           `json:"has_next"`
		} `json:"data"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, false, fmt.Errorf("parse pair trades: %w", err)
	}
	hasNext := resp.Data.HasNext || resp.Data.HasNext2
	return resp.Data.Items, hasNext, nil
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
// WALLET NET WORTH & PNL
// ═══════════════════════════════════════════════════════════════════════

// GetWalletCurrentNetWorth returns current net worth and top wallet assets.
func (b *BirdeyeClient) GetWalletCurrentNetWorth(walletAddr string, limit int) (*WalletCurrentNetWorth, error) {
	if strings.TrimSpace(walletAddr) == "" {
		return nil, fmt.Errorf("wallet required")
	}
	if limit <= 0 {
		limit = 20
	}
	u := fmt.Sprintf("%s/wallet/v2/current-net-worth?wallet=%s&sort_type=desc&limit=%d&offset=0", b.baseURL, walletAddr, limit)
	data, err := b.doRequest(u)
	if err != nil {
		return nil, err
	}
	var resp struct {
		Data WalletCurrentNetWorth `json:"data"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("parse wallet current net worth: %w", err)
	}
	return &resp.Data, nil
}

// GetWalletNetWorthChart returns net worth history points.
func (b *BirdeyeClient) GetWalletNetWorthChart(walletAddr string, count int, direction, intervalType, atTime string) (*WalletNetWorthHistory, error) {
	if strings.TrimSpace(walletAddr) == "" {
		return nil, fmt.Errorf("wallet required")
	}
	if count <= 0 {
		count = 7
	}
	if strings.TrimSpace(direction) == "" {
		direction = "back"
	}
	if strings.TrimSpace(intervalType) == "" {
		intervalType = "1d"
	}
	v := url.Values{}
	v.Set("wallet", walletAddr)
	v.Set("count", fmt.Sprintf("%d", count))
	v.Set("direction", direction)
	v.Set("type", intervalType)
	v.Set("sort_type", "desc")
	if strings.TrimSpace(atTime) != "" {
		v.Set("time", atTime)
	}
	u := fmt.Sprintf("%s/wallet/v2/net-worth?%s", b.baseURL, v.Encode())
	data, err := b.doRequest(u)
	if err != nil {
		return nil, err
	}
	var resp struct {
		Data WalletNetWorthHistory `json:"data"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("parse wallet net worth chart: %w", err)
	}
	return &resp.Data, nil
}

// GetWalletNetWorthSummaryMultiple returns current net worth for up to 100 wallets.
func (b *BirdeyeClient) GetWalletNetWorthSummaryMultiple(wallets []string) (map[string]WalletSummaryValue, error) {
	if len(wallets) == 0 {
		return nil, fmt.Errorf("wallets required")
	}
	body := map[string]any{"wallets": wallets}
	data, err := b.doPostRequest(fmt.Sprintf("%s/wallet/v2/net-worth-summary/multiple", b.baseURL), body)
	if err != nil {
		return nil, err
	}
	var resp struct {
		Data struct {
			Wallets map[string]WalletSummaryValue `json:"wallets"`
		} `json:"data"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("parse wallet net worth summary multiple: %w", err)
	}
	return resp.Data.Wallets, nil
}

// GetWalletNetWorthDetails returns wallet assets at a specific snapshot.
func (b *BirdeyeClient) GetWalletNetWorthDetails(walletAddr, intervalType, atTime string, limit, offset int) (*WalletNetWorthDetails, error) {
	if strings.TrimSpace(walletAddr) == "" {
		return nil, fmt.Errorf("wallet required")
	}
	if strings.TrimSpace(intervalType) == "" {
		intervalType = "1d"
	}
	if limit <= 0 {
		limit = 20
	}
	v := url.Values{}
	v.Set("wallet", walletAddr)
	v.Set("type", intervalType)
	v.Set("sort_type", "desc")
	v.Set("limit", fmt.Sprintf("%d", limit))
	v.Set("offset", fmt.Sprintf("%d", offset))
	if strings.TrimSpace(atTime) != "" {
		v.Set("time", atTime)
	}
	u := fmt.Sprintf("%s/wallet/v2/net-worth-details?%s", b.baseURL, v.Encode())
	data, err := b.doRequest(u)
	if err != nil {
		return nil, err
	}
	var resp struct {
		Data WalletNetWorthDetails `json:"data"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("parse wallet net worth details: %w", err)
	}
	return &resp.Data, nil
}

// GetWalletPnLSummary returns high-level wallet pnl summary.
func (b *BirdeyeClient) GetWalletPnLSummary(walletAddr, duration string) (*WalletPnLSummary, error) {
	if strings.TrimSpace(walletAddr) == "" {
		return nil, fmt.Errorf("wallet required")
	}
	if strings.TrimSpace(duration) == "" {
		duration = "all"
	}
	u := fmt.Sprintf("%s/wallet/v2/pnl/summary?wallet=%s&duration=%s", b.baseURL, walletAddr, duration)
	data, err := b.doRequest(u)
	if err != nil {
		return nil, err
	}
	var resp struct {
		Data WalletPnLSummary `json:"data"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("parse wallet pnl summary: %w", err)
	}
	return &resp.Data, nil
}

// GetWalletPnLDetails returns wallet pnl broken down by tokens.
func (b *BirdeyeClient) GetWalletPnLDetails(walletAddr string, tokenAddresses []string, duration string, limit, offset int) (*WalletPnLDetails, error) {
	if strings.TrimSpace(walletAddr) == "" {
		return nil, fmt.Errorf("wallet required")
	}
	if strings.TrimSpace(duration) == "" {
		duration = "all"
	}
	if limit <= 0 {
		limit = 10
	}
	body := map[string]any{
		"wallet":    walletAddr,
		"duration":  duration,
		"sort_type": "desc",
		"sort_by":   "last_trade",
		"limit":     limit,
		"offset":    offset,
	}
	if len(tokenAddresses) > 0 {
		body["token_addresses"] = tokenAddresses
	}
	data, err := b.doPostRequest(fmt.Sprintf("%s/wallet/v2/pnl/details", b.baseURL), body)
	if err != nil {
		return nil, err
	}
	var resp struct {
		Data WalletPnLDetails `json:"data"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("parse wallet pnl details: %w", err)
	}
	return &resp.Data, nil
}

// GetWalletTransactionHistory returns beta transaction history rows for a wallet.
func (b *BirdeyeClient) GetWalletTransactionHistory(walletAddr string, limit int, before string) ([]map[string]any, error) {
	if strings.TrimSpace(walletAddr) == "" {
		return nil, fmt.Errorf("wallet required")
	}
	if limit <= 0 {
		limit = 100
	}
	v := url.Values{}
	v.Set("wallet", walletAddr)
	v.Set("limit", fmt.Sprintf("%d", limit))
	if strings.TrimSpace(before) != "" {
		v.Set("before", before)
	}
	u := fmt.Sprintf("%s/v1/wallet/tx_list?%s", b.baseURL, v.Encode())
	data, err := b.doRequest(u)
	if err != nil {
		return nil, err
	}
	var resp struct {
		Data map[string][]map[string]any `json:"data"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("parse wallet tx list: %w", err)
	}
	if rows, ok := resp.Data["solana"]; ok {
		return rows, nil
	}
	for _, rows := range resp.Data {
		return rows, nil
	}
	return nil, nil
}

// GetTokenTransferTotal returns token transfer aggregate count for the filter.
func (b *BirdeyeClient) GetTokenTransferTotal(tokenAddr string) (int, error) {
	if strings.TrimSpace(tokenAddr) == "" {
		return 0, fmt.Errorf("token address required")
	}
	body := map[string]any{"token_address": tokenAddr}
	data, err := b.doPostRequest(fmt.Sprintf("%s/token/v1/transfer/total", b.baseURL), body)
	if err != nil {
		return 0, err
	}
	var resp struct {
		Data struct {
			Total int `json:"total"`
		} `json:"data"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return 0, fmt.Errorf("parse token transfer total: %w", err)
	}
	return resp.Data.Total, nil
}

// GetWalletTransferTotal returns wallet transfer aggregate count for the filter.
func (b *BirdeyeClient) GetWalletTransferTotal(walletAddr string) (int, error) {
	if strings.TrimSpace(walletAddr) == "" {
		return 0, fmt.Errorf("wallet required")
	}
	body := map[string]any{"wallet": walletAddr}
	data, err := b.doPostRequest(fmt.Sprintf("%s/wallet/v2/transfer/total", b.baseURL), body)
	if err != nil {
		return 0, err
	}
	var resp struct {
		Data struct {
			Total int `json:"total"`
		} `json:"data"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return 0, fmt.Errorf("parse wallet transfer total: %w", err)
	}
	return resp.Data.Total, nil
}

// ═══════════════════════════════════════════════════════════════════════
// SMART MONEY / ALL-TIME / MEME
// ═══════════════════════════════════════════════════════════════════════

// GetSmartMoneyTokenList returns smart-money ranked tokens.
func (b *BirdeyeClient) GetSmartMoneyTokenList(interval, traderStyle, sortBy, sortType string, offset, limit int) ([]SmartMoneyToken, error) {
	if strings.TrimSpace(interval) == "" {
		interval = "1d"
	}
	if strings.TrimSpace(traderStyle) == "" {
		traderStyle = "all"
	}
	if strings.TrimSpace(sortBy) == "" {
		sortBy = "smart_traders_no"
	}
	if strings.TrimSpace(sortType) == "" {
		sortType = "desc"
	}
	if limit <= 0 {
		limit = 20
	}
	v := url.Values{}
	v.Set("interval", interval)
	v.Set("trader_style", traderStyle)
	v.Set("sort_by", sortBy)
	v.Set("sort_type", sortType)
	v.Set("offset", fmt.Sprintf("%d", offset))
	v.Set("limit", fmt.Sprintf("%d", limit))
	u := fmt.Sprintf("%s/smart-money/v1/token/list?%s", b.baseURL, v.Encode())
	data, err := b.doRequest(u)
	if err != nil {
		return nil, err
	}
	var resp struct {
		Data []SmartMoneyToken `json:"data"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("parse smart money list: %w", err)
	}
	return resp.Data, nil
}

// GetAllTimeTradesSingle returns all-time/duration trade stats for one token.
func (b *BirdeyeClient) GetAllTimeTradesSingle(address, timeFrame string) ([]AllTimeTradesItem, error) {
	if strings.TrimSpace(address) == "" {
		return nil, fmt.Errorf("address required")
	}
	if strings.TrimSpace(timeFrame) == "" {
		timeFrame = "24h"
	}
	u := fmt.Sprintf("%s/defi/v3/all-time/trades/single?time_frame=%s&address=%s", b.baseURL, timeFrame, address)
	data, err := b.doRequest(u)
	if err != nil {
		return nil, err
	}
	var resp struct {
		Data []AllTimeTradesItem `json:"data"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("parse all-time trades single: %w", err)
	}
	return resp.Data, nil
}

// GetAllTimeTradesMultiple returns all-time/duration trade stats for multiple tokens.
func (b *BirdeyeClient) GetAllTimeTradesMultiple(addresses []string, timeFrame string) ([]AllTimeTradesItem, error) {
	if len(addresses) == 0 {
		return nil, fmt.Errorf("addresses required")
	}
	if strings.TrimSpace(timeFrame) == "" {
		timeFrame = "24h"
	}
	u := fmt.Sprintf("%s/defi/v3/all-time/trades/multiple?time_frame=%s&list_address=%s", b.baseURL, timeFrame, strings.Join(addresses, ","))
	data, err := b.doPostRequest(u, map[string]any{})
	if err != nil {
		return nil, err
	}
	var resp struct {
		Data []AllTimeTradesItem `json:"data"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("parse all-time trades multiple: %w", err)
	}
	return resp.Data, nil
}

// GetMemeTokenDetail returns detailed meme token metadata + progress.
func (b *BirdeyeClient) GetMemeTokenDetail(address string) (*MemeTokenDetail, error) {
	if strings.TrimSpace(address) == "" {
		return nil, fmt.Errorf("address required")
	}
	u := fmt.Sprintf("%s/defi/v3/token/meme/detail/single?address=%s", b.baseURL, address)
	data, err := b.doRequest(u)
	if err != nil {
		return nil, err
	}
	var resp struct {
		Data MemeTokenDetail `json:"data"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("parse meme token detail: %w", err)
	}
	return &resp.Data, nil
}

// GetMemeTokenList returns list of meme tokens with optional filters.
func (b *BirdeyeClient) GetMemeTokenList(sortBy, sortType, source string, offset, limit int) ([]MemeTokenListItem, bool, error) {
	if strings.TrimSpace(sortBy) == "" {
		sortBy = "progress_percent"
	}
	if strings.TrimSpace(sortType) == "" {
		sortType = "desc"
	}
	if strings.TrimSpace(source) == "" {
		source = "all"
	}
	if limit <= 0 {
		limit = 20
	}
	v := url.Values{}
	v.Set("sort_by", sortBy)
	v.Set("sort_type", sortType)
	v.Set("source", source)
	v.Set("offset", fmt.Sprintf("%d", offset))
	v.Set("limit", fmt.Sprintf("%d", limit))
	u := fmt.Sprintf("%s/defi/v3/token/meme/list?%s", b.baseURL, v.Encode())
	data, err := b.doRequest(u)
	if err != nil {
		return nil, false, err
	}
	var resp struct {
		Data struct {
			Items   []MemeTokenListItem `json:"items"`
			HasNext bool                `json:"hasNext"`
			HasNext2 bool               `json:"has_next"`
		} `json:"data"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, false, fmt.Errorf("parse meme token list: %w", err)
	}
	hasNext := resp.Data.HasNext || resp.Data.HasNext2
	return resp.Data.Items, hasNext, nil
}

// GetTokenExitLiquidity returns exit liquidity for tokens on base.
func (b *BirdeyeClient) GetTokenExitLiquidity(address string) (*TokenExitLiquidity, error) {
	if strings.TrimSpace(address) == "" {
		return nil, fmt.Errorf("address required")
	}
	u := fmt.Sprintf("%s/defi/v3/token/exit-liquidity?address=%s", b.baseURL, address)
	data, err := b.doRequestWithChain(u, "base")
	if err != nil {
		return nil, err
	}
	var resp struct {
		Data TokenExitLiquidity `json:"data"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("parse token exit liquidity: %w", err)
	}
	return &resp.Data, nil
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

// ═══════════════════════════════════════════════════════════════════════
// OHLCV V3 — Candlestick data (token & pair)
// ═══════════════════════════════════════════════════════════════════════

// GetOHLCVV3 retrieves OHLCV candlestick data for a token.
// Supports: 1s, 15s, 30s, 1m, 3m, 5m, 15m, 30m, 1H, 2H, 4H, 6H, 8H, 12H, 1D, 3D, 1W, 1M
// Max 5000 records per request.
func (b *BirdeyeClient) GetOHLCVV3(address, resolution string, timeFrom, timeTo int64) (*BirdeyeOHLCVV3Response, error) {
	if strings.TrimSpace(address) == "" {
		return nil, fmt.Errorf("address required")
	}
	if strings.TrimSpace(resolution) == "" {
		resolution = "1m"
	}
	u := fmt.Sprintf("%s/defi/v3/ohlcv?address=%s&type=%s&time_from=%d&time_to=%d",
		b.baseURL, url.QueryEscape(address), url.QueryEscape(resolution), timeFrom, timeTo)
	data, err := b.doRequest(u)
	if err != nil {
		return nil, err
	}
	var resp struct {
		Data BirdeyeOHLCVV3Response `json:"data"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("parse ohlcv v3: %w", err)
	}
	return &resp.Data, nil
}

// GetOHLCVV3Pair retrieves OHLCV candlestick data for a specific pair.
func (b *BirdeyeClient) GetOHLCVV3Pair(pairAddress, resolution string, timeFrom, timeTo int64) (*BirdeyeOHLCVV3Response, error) {
	if strings.TrimSpace(pairAddress) == "" {
		return nil, fmt.Errorf("pair address required")
	}
	if strings.TrimSpace(resolution) == "" {
		resolution = "1m"
	}
	u := fmt.Sprintf("%s/defi/v3/ohlcv/pair?address=%s&type=%s&time_from=%d&time_to=%d",
		b.baseURL, url.QueryEscape(pairAddress), url.QueryEscape(resolution), timeFrom, timeTo)
	data, err := b.doRequest(u)
	if err != nil {
		return nil, err
	}
	var resp struct {
		Data BirdeyeOHLCVV3Response `json:"data"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("parse ohlcv v3 pair: %w", err)
	}
	return &resp.Data, nil
}

// GetOHLCVBaseQuote retrieves OHLCV data for a base/quote token pair.
func (b *BirdeyeClient) GetOHLCVBaseQuote(baseAddr, quoteAddr, resolution string, timeFrom, timeTo int64) (*BirdeyeOHLCVV3Response, error) {
	if strings.TrimSpace(baseAddr) == "" || strings.TrimSpace(quoteAddr) == "" {
		return nil, fmt.Errorf("base and quote addresses required")
	}
	if strings.TrimSpace(resolution) == "" {
		resolution = "1m"
	}
	u := fmt.Sprintf("%s/defi/ohlcv/base_quote?base_address=%s&quote_address=%s&type=%s&time_from=%d&time_to=%d",
		b.baseURL, url.QueryEscape(baseAddr), url.QueryEscape(quoteAddr), url.QueryEscape(resolution), timeFrom, timeTo)
	data, err := b.doRequest(u)
	if err != nil {
		return nil, err
	}
	var resp struct {
		Data BirdeyeOHLCVV3Response `json:"data"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("parse ohlcv base/quote: %w", err)
	}
	return &resp.Data, nil
}

// ═══════════════════════════════════════════════════════════════════════
// PRICE — Historical, Multi-Price, Price Volume
// ═══════════════════════════════════════════════════════════════════════

// GetHistoryPrice retrieves historical price line chart for a token.
func (b *BirdeyeClient) GetHistoryPrice(address, resolution string, timeFrom, timeTo int64) (*BirdeyeHistoryPriceResponse, error) {
	if strings.TrimSpace(address) == "" {
		return nil, fmt.Errorf("address required")
	}
	if strings.TrimSpace(resolution) == "" {
		resolution = "1m"
	}
	u := fmt.Sprintf("%s/defi/history_price?address=%s&address_type=token&type=%s&time_from=%d&time_to=%d",
		b.baseURL, url.QueryEscape(address), url.QueryEscape(resolution), timeFrom, timeTo)
	data, err := b.doRequest(u)
	if err != nil {
		return nil, err
	}
	var resp struct {
		Data BirdeyeHistoryPriceResponse `json:"data"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("parse history price: %w", err)
	}
	return &resp.Data, nil
}

// GetHistoryPriceAtUnix retrieves the price at a specific unix timestamp.
func (b *BirdeyeClient) GetHistoryPriceAtUnix(address string, unixTime int64) (float64, error) {
	if strings.TrimSpace(address) == "" {
		return 0, fmt.Errorf("address required")
	}
	u := fmt.Sprintf("%s/defi/historical_price_unix?address=%s&unixtime=%d",
		b.baseURL, url.QueryEscape(address), unixTime)
	data, err := b.doRequest(u)
	if err != nil {
		return 0, err
	}
	var resp struct {
		Data struct {
			Value float64 `json:"value"`
		} `json:"data"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return 0, fmt.Errorf("parse historical price unix: %w", err)
	}
	return resp.Data.Value, nil
}

// GetMultiPrice retrieves current prices for multiple tokens (max 100).
func (b *BirdeyeClient) GetMultiPrice(addresses []string, includeLiquidity bool) (map[string]BirdeyeMultiPriceItem, error) {
	if len(addresses) == 0 {
		return nil, fmt.Errorf("at least one address required")
	}
	list := strings.Join(addresses, ",")
	inclLiq := "false"
	if includeLiquidity {
		inclLiq = "true"
	}
	u := fmt.Sprintf("%s/defi/multi_price?list_address=%s&include_liquidity=%s",
		b.baseURL, url.QueryEscape(list), inclLiq)
	data, err := b.doRequest(u)
	if err != nil {
		return nil, err
	}
	var resp struct {
		Data map[string]BirdeyeMultiPriceItem `json:"data"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("parse multi price: %w", err)
	}
	return resp.Data, nil
}

func (b *BirdeyeClient) doRequestWithChain(reqURL, chain string) ([]byte, error) {
	if strings.TrimSpace(chain) == "" {
		chain = "solana"
	}
	req, err := http.NewRequest("GET", reqURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("X-API-KEY", b.apiKey)
	req.Header.Set("x-chain", chain)
	req.Header.Set("Accept", "application/json")

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
