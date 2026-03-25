// Package solana provides Solana data clients for NanoSolana.
package solana

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"sort"
	"strings"
	"time"
)

const solanaTrackerBaseURL = "https://data.solanatracker.io"

type SolanaTrackerClient struct {
	apiKey     string
	baseURL    string
	httpClient *http.Client
}

type TrackerAmount struct {
	Quote float64 `json:"quote"`
	USD   float64 `json:"usd"`
}

type TrackerSecurity struct {
	FreezeAuthority any `json:"freezeAuthority"`
	MintAuthority   any `json:"mintAuthority"`
}

type TrackerTxns struct {
	Buys     int     `json:"buys"`
	Sells    int     `json:"sells"`
	Total    int     `json:"total"`
	Volume   float64 `json:"volume"`
	Volume24 float64 `json:"volume24h"`
}

type TrackerCreation struct {
	Creator     string `json:"creator"`
	CreatedTx   string `json:"created_tx"`
	CreatedTime int64  `json:"created_time"`
}

type TrackerToken struct {
	Name            string            `json:"name"`
	Symbol          string            `json:"symbol"`
	Mint            string            `json:"mint"`
	URI             string            `json:"uri"`
	Decimals        int               `json:"decimals"`
	Description     string            `json:"description"`
	Image           string            `json:"image"`
	HasFileMetaData bool              `json:"hasFileMetaData"`
	StrictSocials   map[string]string `json:"strictSocials"`
	Twitter         string            `json:"twitter"`
	Telegram        string            `json:"telegram"`
	Website         string            `json:"website"`
	CreatedOn       string            `json:"createdOn"`
	Creation        TrackerCreation   `json:"creation"`
}

type TrackerPool struct {
	PoolID          string          `json:"poolId"`
	Liquidity       TrackerAmount   `json:"liquidity"`
	Price           TrackerAmount   `json:"price"`
	TokenSupply     float64         `json:"tokenSupply"`
	LPBurn          float64         `json:"lpBurn"`
	TokenAddress    string          `json:"tokenAddress"`
	MarketCap       TrackerAmount   `json:"marketCap"`
	Market          string          `json:"market"`
	QuoteToken      string          `json:"quoteToken"`
	Decimals        int             `json:"decimals"`
	Security        TrackerSecurity `json:"security"`
	LastUpdated     int64           `json:"lastUpdated"`
	CreatedAt       int64           `json:"createdAt"`
	Deployer        string          `json:"deployer"`
	CurvePercentage float64         `json:"curvePercentage"`
	Curve           string          `json:"curve"`
	BundleID        string          `json:"bundleId"`
	Txns            TrackerTxns     `json:"txns"`
}

type TrackerEventPoint struct {
	PriceChangePercentage float64 `json:"priceChangePercentage"`
}

type TrackerRiskFees struct {
	TotalTrading float64 `json:"totalTrading"`
	TotalTips    float64 `json:"totalTips"`
	Total        float64 `json:"total"`
}

type TrackerRiskDev struct {
	Percentage float64 `json:"percentage"`
	Amount     float64 `json:"amount"`
}

type TrackerBundlerWallet struct {
	Wallet            string  `json:"wallet"`
	InitialBalance    float64 `json:"initialBalance"`
	InitialPercentage float64 `json:"initialPercentage"`
	Balance           float64 `json:"balance"`
	Percentage        float64 `json:"percentage"`
	BundleTime        int64   `json:"bundleTime"`
}

type TrackerWalletGroup struct {
	Count           int                    `json:"count"`
	TotalBalance    float64                `json:"totalBalance"`
	TotalPercentage float64                `json:"totalPercentage"`
	Wallets         []TrackerBundlerWallet `json:"wallets"`
}

type TrackerBundlers struct {
	Count                  int                    `json:"count"`
	TotalBalance           float64                `json:"totalBalance"`
	TotalPercentage        float64                `json:"totalPercentage"`
	TotalInitialBalance    float64                `json:"totalInitialBalance"`
	TotalInitialPercentage float64                `json:"totalInitialPercentage"`
	Wallets                []TrackerBundlerWallet `json:"wallets"`
}

type TrackerRisk struct {
	Snipers         TrackerWalletGroup `json:"snipers"`
	Bundlers        TrackerBundlers    `json:"bundlers"`
	Insiders        TrackerWalletGroup `json:"insiders"`
	Top10           float64            `json:"top10"`
	Dev             TrackerRiskDev     `json:"dev"`
	Fees            TrackerRiskFees    `json:"fees"`
	Rugged          bool               `json:"rugged"`
	Risks           []any              `json:"risks"`
	Score           float64            `json:"score"`
	JupiterVerified bool               `json:"jupiterVerified"`
}

type TrackerTokenFull struct {
	Token   TrackerToken                 `json:"token"`
	Pools   []TrackerPool                `json:"pools"`
	Events  map[string]TrackerEventPoint `json:"events"`
	Risk    TrackerRisk                  `json:"risk"`
	Buys    int                          `json:"buys"`
	Sells   int                          `json:"sells"`
	Txns    int                          `json:"txns"`
	Holders int                          `json:"holders"`
	Balance float64                      `json:"balance"`
	Value   float64                      `json:"value"`
}

type TrackerSearchResult struct {
	ID                string            `json:"id"`
	Name              string            `json:"name"`
	Symbol            string            `json:"symbol"`
	Mint              string            `json:"mint"`
	Image             string            `json:"image"`
	Decimals          int               `json:"decimals"`
	HasSocials        bool              `json:"hasSocials"`
	PoolAddress       string            `json:"poolAddress"`
	LiquidityUSD      float64           `json:"liquidityUsd"`
	MarketCapUSD      float64           `json:"marketCapUsd"`
	PriceUSD          float64           `json:"priceUsd"`
	LPBurn            float64           `json:"lpBurn"`
	Market            string            `json:"market"`
	QuoteToken        string            `json:"quoteToken"`
	FreezeAuthority   any               `json:"freezeAuthority"`
	MintAuthority     any               `json:"mintAuthority"`
	Deployer          string            `json:"deployer"`
	Status            string            `json:"status"`
	CreatedAt         int64             `json:"createdAt"`
	LastUpdated       int64             `json:"lastUpdated"`
	Holders           int               `json:"holders"`
	Buys              int               `json:"buys"`
	Sells             int               `json:"sells"`
	TotalTransactions int               `json:"totalTransactions"`
	Volume            float64           `json:"volume"`
	Volume5m          float64           `json:"volume_5m"`
	Volume15m         float64           `json:"volume_15m"`
	Volume30m         float64           `json:"volume_30m"`
	Volume1h          float64           `json:"volume_1h"`
	Volume6h          float64           `json:"volume_6h"`
	Volume12h         float64           `json:"volume_12h"`
	Volume24h         float64           `json:"volume_24h"`
	Top10             float64           `json:"top10"`
	Dev               float64           `json:"dev"`
	Insiders          float64           `json:"insiders"`
	Snipers           float64           `json:"snipers"`
	RiskScore         float64           `json:"riskScore"`
	Socials           map[string]string `json:"socials"`
}

type TrackerSearchResponse struct {
	Status     string                `json:"status"`
	Data       []TrackerSearchResult `json:"data"`
	Total      int                   `json:"total"`
	Pages      int                   `json:"pages"`
	Page       int                   `json:"page"`
	Cursor     string                `json:"cursor"`
	NextCursor string                `json:"nextCursor"`
	HasMore    bool                  `json:"hasMore"`
}

type TrackerHoldersResponse struct {
	Total    int                  `json:"total"`
	Accounts []TrackerHolderEntry `json:"accounts"`
	Cursor   string               `json:"cursor"`
	HasMore  bool                 `json:"hasMore"`
	Limit    int                  `json:"limit"`
}

type TrackerHolderEntry struct {
	Wallet     string        `json:"wallet"`
	Account    string        `json:"account"`
	Amount     float64       `json:"amount"`
	Value      TrackerAmount `json:"value"`
	Percentage float64       `json:"percentage"`
}

type TrackerTopHolder struct {
	Address    string        `json:"address"`
	Amount     float64       `json:"amount"`
	Percentage float64       `json:"percentage"`
	Value      TrackerAmount `json:"value"`
}

type TrackerATH struct {
	HighestPrice     float64 `json:"highest_price"`
	HighestMarketCap float64 `json:"highest_market_cap"`
	Timestamp        int64   `json:"timestamp"`
	PoolID           string  `json:"pool_id"`
}

type TrackerBundlersResponse struct {
	Total             int                    `json:"total"`
	Balance           float64                `json:"balance"`
	Percentage        float64                `json:"percentage"`
	InitialBalance    float64                `json:"initialBalance"`
	InitialPercentage float64                `json:"initialPercentage"`
	Wallets           []TrackerBundlerWallet `json:"wallets"`
}

type TrackerMultipleTokensResponse struct {
	Tokens map[string]TrackerTokenFull `json:"tokens"`
}

type TrackerTokenOverviewResponse struct {
	Latest     []TrackerTokenFull `json:"latest"`
	Graduating []TrackerTokenFull `json:"graduating"`
	Graduated  []TrackerTokenFull `json:"graduated"`
}

type TrackerWalletBasicToken struct {
	Address   string        `json:"address"`
	Balance   float64       `json:"balance"`
	Value     float64       `json:"value"`
	Price     TrackerAmount `json:"price"`
	MarketCap TrackerAmount `json:"marketCap"`
	Liquidity TrackerAmount `json:"liquidity"`
}

type TrackerWalletBasicResponse struct {
	Tokens   []TrackerWalletBasicToken `json:"tokens"`
	Total    float64                   `json:"total"`
	TotalSol float64                   `json:"totalSol"`
}

type TrackerWalletTokensResponse struct {
	Tokens    []TrackerTokenFull `json:"tokens"`
	Total     float64            `json:"total"`
	TotalSol  float64            `json:"totalSol"`
	Timestamp string             `json:"timestamp"`
}

type TrackerTradeLegToken struct {
	Name     string `json:"name"`
	Symbol   string `json:"symbol"`
	Image    string `json:"image"`
	Decimals int    `json:"decimals"`
}

type TrackerTradeLeg struct {
	Address  string               `json:"address"`
	Amount   float64              `json:"amount"`
	Token    TrackerTradeLegToken `json:"token"`
	PriceUSD float64              `json:"priceUsd"`
}

type TrackerWalletTrade struct {
	Tx    string          `json:"tx"`
	From  TrackerTradeLeg `json:"from"`
	To    TrackerTradeLeg `json:"to"`
	Price struct {
		USD float64 `json:"usd"`
		SOL string  `json:"sol"`
	} `json:"price"`
	Volume struct {
		USD float64 `json:"usd"`
		SOL float64 `json:"sol"`
	} `json:"volume"`
	Wallet  string `json:"wallet"`
	Program string `json:"program"`
	Time    int64  `json:"time"`
}

type TrackerWalletTradesResponse struct {
	Trades      []TrackerWalletTrade `json:"trades"`
	NextCursor  any                  `json:"nextCursor"`
	HasNextPage bool                 `json:"hasNextPage"`
}

type TrackerWalletChartPoint struct {
	Date          string  `json:"date"`
	Value         float64 `json:"value"`
	Timestamp     int64   `json:"timestamp"`
	PnLPercentage float64 `json:"pnlPercentage"`
}

type TrackerWalletChartResponse struct {
	ChartData  []TrackerWalletChartPoint `json:"chartData"`
	PnL        map[string]TrackerPnLMeta `json:"pnl"`
	Statistics map[string]any            `json:"statistics"`
}

type TrackerPnLMeta struct {
	Value      float64 `json:"value"`
	Percentage float64 `json:"percentage"`
}

type TrackerTrade struct {
	Tx        string   `json:"tx"`
	Amount    float64  `json:"amount"`
	PriceUSD  float64  `json:"priceUsd"`
	Volume    float64  `json:"volume"`
	VolumeSOL float64  `json:"volumeSol"`
	Type      string   `json:"type"`
	Wallet    string   `json:"wallet"`
	Time      int64    `json:"time"`
	Program   string   `json:"program"`
	Pools     []string `json:"pools"`
}

type TrackerTradesResponse struct {
	Trades      []TrackerTrade `json:"trades"`
	NextCursor  any            `json:"nextCursor"`
	HasNextPage bool           `json:"hasNextPage"`
}

type TrackerPnLToken struct {
	Holding           float64 `json:"holding"`
	Held              float64 `json:"held"`
	Sold              float64 `json:"sold"`
	SoldUSD           float64 `json:"sold_usd"`
	Realized          float64 `json:"realized"`
	Unrealized        float64 `json:"unrealized"`
	Total             float64 `json:"total"`
	TotalSold         float64 `json:"total_sold"`
	TotalInvested     float64 `json:"total_invested"`
	AverageBuyAmount  float64 `json:"average_buy_amount"`
	AverageSellAmount float64 `json:"average_sell_amount"`
	CurrentValue      float64 `json:"current_value"`
	CostBasis         float64 `json:"cost_basis"`
	FirstBuyTime      int64   `json:"first_buy_time"`
	LastBuyTime       int64   `json:"last_buy_time"`
	LastSellTime      int64   `json:"last_sell_time"`
	LastTradeTime     int64   `json:"last_trade_time"`
	BuyTransactions   int     `json:"buy_transactions"`
	SellTransactions  int     `json:"sell_transactions"`
	TotalTransactions int     `json:"total_transactions"`
}

type TrackerWalletPnLResponse struct {
	Tokens  map[string]TrackerPnLToken `json:"tokens"`
	Summary map[string]any             `json:"summary"`
}

type TrackerFirstBuyer struct {
	Wallet            string `json:"wallet"`
	FirstBuyTime      int64  `json:"first_buy_time"`
	FirstSellTime     int64  `json:"first_sell_time"`
	LastTransactionAt int64  `json:"last_transaction_time"`
	TrackerPnLToken
}

type TrackerOHLCVBar struct {
	Open   float64 `json:"open"`
	Close  float64 `json:"close"`
	Low    float64 `json:"low"`
	High   float64 `json:"high"`
	Volume float64 `json:"volume"`
	Time   int64   `json:"time"`
}

type TrackerChartResponse struct {
	OCLHV []TrackerOHLCVBar `json:"oclhv"`
}

type TrackerHoldersChartPoint struct {
	Holders int   `json:"holders"`
	Time    int64 `json:"time"`
}

type TrackerHoldersChartResponse struct {
	Holders []TrackerHoldersChartPoint `json:"holders"`
}

type TrackerPriceResponse struct {
	Price       float64 `json:"price"`
	PriceQuote  float64 `json:"priceQuote"`
	Liquidity   float64 `json:"liquidity"`
	MarketCap   float64 `json:"marketCap"`
	LastUpdated int64   `json:"lastUpdated"`
}

type TrackerPriceHistoryResponse struct {
	Current float64 `json:"current"`
	D1      float64 `json:"1d"`
	D3      float64 `json:"3d"`
	D5      float64 `json:"5d"`
	D7      float64 `json:"7d"`
	D14     float64 `json:"14d"`
	D30     float64 `json:"30d"`
}

type TrackerTopTraderWallet struct {
	Wallet  string             `json:"wallet"`
	Summary map[string]float64 `json:"summary"`
}

type TrackerTopTradersAllResponse struct {
	Wallets []TrackerTopTraderWallet `json:"wallets"`
}

type TrackerTopTraderToken struct {
	Wallet        string  `json:"wallet"`
	Held          float64 `json:"held"`
	Sold          float64 `json:"sold"`
	Holding       float64 `json:"holding"`
	Realized      float64 `json:"realized"`
	Unrealized    float64 `json:"unrealized"`
	Total         float64 `json:"total"`
	TotalInvested float64 `json:"total_invested"`
}

func NewSolanaTrackerClient(apiKey string) *SolanaTrackerClient {
	return &SolanaTrackerClient{
		apiKey:  strings.TrimSpace(apiKey),
		baseURL: solanaTrackerBaseURL,
		httpClient: &http.Client{
			Timeout: 15 * time.Second,
		},
	}
}

func (c *SolanaTrackerClient) GetJSON(endpoint string, query url.Values, out any) error {
	return c.doRequest(http.MethodGet, endpoint, query, nil, out)
}

func (c *SolanaTrackerClient) PostJSON(endpoint string, payload any, out any) error {
	return c.doRequest(http.MethodPost, endpoint, nil, payload, out)
}

func (c *SolanaTrackerClient) SearchToken(keyword string, limit int) ([]TrackerSearchResult, error) {
	q := url.Values{}
	q.Set("query", strings.TrimSpace(keyword))
	if limit > 0 {
		q.Set("limit", fmt.Sprintf("%d", limit))
	}
	var resp TrackerSearchResponse
	if err := c.GetJSON("/search", q, &resp); err != nil {
		return nil, err
	}
	return resp.Data, nil
}

func (c *SolanaTrackerClient) GetToken(token string) (*TrackerTokenFull, error) {
	var resp TrackerTokenFull
	if err := c.GetJSON(path.Join("/tokens", token), nil, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

func (c *SolanaTrackerClient) GetTokenByPool(pool string) (*TrackerTokenFull, error) {
	var resp TrackerTokenFull
	if err := c.GetJSON(path.Join("/tokens/by-pool", pool), nil, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

func (c *SolanaTrackerClient) GetTrending(limit int) ([]TrendingToken, error) {
	items, err := c.GetTrendingTokens(limit)
	if err != nil {
		return nil, err
	}
	out := make([]TrendingToken, 0, len(items))
	for i, item := range items {
		pool := trackerBestPool(item)
		out = append(out, TrendingToken{
			Symbol:    trackerTokenSymbol(item),
			Address:   item.Token.Mint,
			Price:     pool.Price.USD,
			Change24h: trackerEventChange(item, "24h"),
			Volume24h: trackerPoolVolume24h(pool),
			MCap:      pool.MarketCap.USD,
			Rank:      i + 1,
		})
	}
	return out, nil
}

func (c *SolanaTrackerClient) GetTrendingTokens(limit int) ([]TrackerTokenFull, error) {
	var resp []TrackerTokenFull
	if err := c.GetJSON("/tokens/trending", nil, &resp); err != nil {
		return nil, err
	}
	return limitTrackerTokenSlice(resp, limit), nil
}

func (c *SolanaTrackerClient) GetTrendingTokensByTimeframe(timeframe string, limit int) ([]TrackerTokenFull, error) {
	var resp []TrackerTokenFull
	if err := c.GetJSON(path.Join("/tokens/trending", normalizeTrackerTimeframe(timeframe)), nil, &resp); err != nil {
		return nil, err
	}
	return limitTrackerTokenSlice(resp, limit), nil
}

func (c *SolanaTrackerClient) GetTokensByVolume(limit int) ([]TrackerTokenFull, error) {
	var resp []TrackerTokenFull
	if err := c.GetJSON("/tokens/volume", nil, &resp); err != nil {
		return nil, err
	}
	return limitTrackerTokenSlice(resp, limit), nil
}

func (c *SolanaTrackerClient) GetTokensByVolumeWithTimeframe(timeframe string, limit int) ([]TrackerTokenFull, error) {
	var resp []TrackerTokenFull
	if err := c.GetJSON(path.Join("/tokens/volume", normalizeTrackerTimeframe(timeframe)), nil, &resp); err != nil {
		return nil, err
	}
	return limitTrackerTokenSlice(resp, limit), nil
}

func (c *SolanaTrackerClient) GetTopPerformingTokens(timeframe string, limit int) ([]TrackerTokenFull, error) {
	var resp []TrackerTokenFull
	if err := c.GetJSON(path.Join("/top-performers", normalizeTrackerTimeframe(timeframe)), nil, &resp); err != nil {
		return nil, err
	}
	return limitTrackerTokenSlice(resp, limit), nil
}

func (c *SolanaTrackerClient) GetTokenOverview(limit int) (*TrackerTokenOverviewResponse, error) {
	q := url.Values{}
	if limit > 0 {
		q.Set("limit", fmt.Sprintf("%d", limit))
	}
	var resp TrackerTokenOverviewResponse
	if err := c.GetJSON("/tokens/multi/all", q, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

func (c *SolanaTrackerClient) GetGraduatingTokens(limit int) ([]TrackerTokenFull, error) {
	q := url.Values{}
	if limit > 0 {
		q.Set("limit", fmt.Sprintf("%d", limit))
	}
	var resp []TrackerTokenFull
	if err := c.GetJSON("/tokens/multi/graduating", q, &resp); err != nil {
		return nil, err
	}
	return limitTrackerTokenSlice(resp, limit), nil
}

func (c *SolanaTrackerClient) GetGraduatedTokens(limit int) ([]TrackerTokenFull, error) {
	q := url.Values{}
	if limit > 0 {
		q.Set("limit", fmt.Sprintf("%d", limit))
	}
	var resp []TrackerTokenFull
	if err := c.GetJSON("/tokens/multi/graduated", q, &resp); err != nil {
		return nil, err
	}
	return limitTrackerTokenSlice(resp, limit), nil
}

func (c *SolanaTrackerClient) GetLatestTokens(pageNum int) ([]TrackerTokenFull, error) {
	q := url.Values{}
	if pageNum > 0 {
		q.Set("page", fmt.Sprintf("%d", pageNum))
	}
	var resp []TrackerTokenFull
	if err := c.GetJSON("/tokens/latest", q, &resp); err != nil {
		return nil, err
	}
	return resp, nil
}

func (c *SolanaTrackerClient) GetMultipleTokens(tokens []string) (*TrackerMultipleTokensResponse, error) {
	body := map[string]any{"tokens": tokens}
	var resp TrackerMultipleTokensResponse
	if err := c.PostJSON("/tokens/multi", body, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

func (c *SolanaTrackerClient) GetTokenHolders(token string) (*TrackerHoldersResponse, error) {
	var resp TrackerHoldersResponse
	if err := c.GetJSON(path.Join("/tokens", token, "holders"), nil, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

func (c *SolanaTrackerClient) GetAllTokenHolders(token string, limit int, cursor string) (*TrackerHoldersResponse, error) {
	q := url.Values{}
	if limit > 0 {
		q.Set("limit", fmt.Sprintf("%d", limit))
	}
	if strings.TrimSpace(cursor) != "" {
		q.Set("cursor", cursor)
	}
	var resp TrackerHoldersResponse
	if err := c.GetJSON(path.Join("/tokens", token, "holders", "paginated"), q, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

func (c *SolanaTrackerClient) GetTopTokenHolders(token string) ([]TrackerTopHolder, error) {
	var resp []TrackerTopHolder
	if err := c.GetJSON(path.Join("/tokens", token, "holders", "top"), nil, &resp); err != nil {
		return nil, err
	}
	return resp, nil
}

func (c *SolanaTrackerClient) GetTokenATH(token string) (*TrackerATH, error) {
	var resp TrackerATH
	if err := c.GetJSON(path.Join("/tokens", token, "ath"), nil, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

func (c *SolanaTrackerClient) GetTokenBundlers(token string) (*TrackerBundlersResponse, error) {
	var resp TrackerBundlersResponse
	if err := c.GetJSON(path.Join("/tokens", token, "bundlers"), nil, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

func (c *SolanaTrackerClient) GetTokensByDeployer(wallet string, pageNum, limit int) (*TrackerSearchResponse, error) {
	q := url.Values{}
	if pageNum > 0 {
		q.Set("page", fmt.Sprintf("%d", pageNum))
	}
	if limit > 0 {
		q.Set("limit", fmt.Sprintf("%d", limit))
	}
	var resp TrackerSearchResponse
	if err := c.GetJSON(path.Join("/deployer", wallet), q, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

func (c *SolanaTrackerClient) GetPrice(token string) (*TrackerPriceResponse, error) {
	q := url.Values{}
	q.Set("token", token)
	var resp TrackerPriceResponse
	if err := c.GetJSON("/price", q, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

func (c *SolanaTrackerClient) GetTokenPrice(token string) (float64, error) {
	price, err := c.GetPrice(token)
	if err != nil {
		return 0, err
	}
	return price.Price, nil
}

func (c *SolanaTrackerClient) GetPriceHistory(token string) (*TrackerPriceHistoryResponse, error) {
	q := url.Values{}
	q.Set("token", token)
	var resp TrackerPriceHistoryResponse
	if err := c.GetJSON("/price/history", q, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

func (c *SolanaTrackerClient) GetWalletTokens(owner string) (*TrackerWalletTokensResponse, error) {
	var resp TrackerWalletTokensResponse
	if err := c.GetJSON(path.Join("/wallet", owner), nil, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

func (c *SolanaTrackerClient) GetWalletBasic(owner string) (*TrackerWalletBasicResponse, error) {
	var resp TrackerWalletBasicResponse
	if err := c.GetJSON(path.Join("/wallet", owner, "basic"), nil, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

func (c *SolanaTrackerClient) GetWalletTokensPage(owner string, pageNum int) (*TrackerWalletTokensResponse, error) {
	var resp TrackerWalletTokensResponse
	if err := c.GetJSON(path.Join("/wallet", owner, "page", fmt.Sprintf("%d", pageNum)), nil, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

func (c *SolanaTrackerClient) GetWalletTrades(owner, cursor string) (*TrackerWalletTradesResponse, error) {
	q := url.Values{}
	if strings.TrimSpace(cursor) != "" {
		q.Set("cursor", cursor)
	}
	var resp TrackerWalletTradesResponse
	if err := c.GetJSON(path.Join("/wallet", owner, "trades"), q, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

func (c *SolanaTrackerClient) GetWalletChart(owner string) (*TrackerWalletChartResponse, error) {
	var resp TrackerWalletChartResponse
	if err := c.GetJSON(path.Join("/wallet", owner, "chart"), nil, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

func (c *SolanaTrackerClient) GetTokenTrades(token string, query url.Values) (*TrackerTradesResponse, error) {
	var resp TrackerTradesResponse
	if err := c.GetJSON(path.Join("/trades", token), query, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

func (c *SolanaTrackerClient) GetPoolTrades(token, pool string, query url.Values) (*TrackerTradesResponse, error) {
	var resp TrackerTradesResponse
	if err := c.GetJSON(path.Join("/trades", token, pool), query, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

func (c *SolanaTrackerClient) GetWalletTokenTrades(token, owner string, query url.Values) (*TrackerTradesResponse, error) {
	var resp TrackerTradesResponse
	if err := c.GetJSON(path.Join("/trades", token, "by-wallet", owner), query, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

func (c *SolanaTrackerClient) GetWalletPnL(wallet string, query url.Values) (*TrackerWalletPnLResponse, error) {
	var resp TrackerWalletPnLResponse
	if err := c.GetJSON(path.Join("/pnl", wallet), query, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

func (c *SolanaTrackerClient) GetTokenPnL(wallet, token string) (*TrackerPnLToken, error) {
	var resp TrackerPnLToken
	if err := c.GetJSON(path.Join("/pnl", wallet, token), nil, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

func (c *SolanaTrackerClient) GetFirstBuyers(token string) ([]TrackerFirstBuyer, error) {
	var resp []TrackerFirstBuyer
	if err := c.GetJSON(path.Join("/first-buyers", token), nil, &resp); err != nil {
		return nil, err
	}
	return resp, nil
}

func (c *SolanaTrackerClient) GetOHLCV(token, resolution string, limit int) ([]OHLCVBar, error) {
	q := url.Values{}
	tf := normalizeTrackerChartType(resolution)
	q.Set("type", tf)
	q.Set("currency", "usd")
	q.Set("removeOutliers", "true")
	q.Set("dynamicPools", "true")
	now := time.Now().Unix()
	if limit > 0 {
		seconds := trackerChartWindowSeconds(tf, limit)
		q.Set("time_from", fmt.Sprintf("%d", now-seconds))
		q.Set("time_to", fmt.Sprintf("%d", now))
	}

	var resp TrackerChartResponse
	if err := c.GetJSON(path.Join("/chart", token), q, &resp); err != nil {
		return nil, err
	}

	out := make([]OHLCVBar, 0, len(resp.OCLHV))
	for _, bar := range resp.OCLHV {
		out = append(out, OHLCVBar{
			Open:      bar.Open,
			High:      bar.High,
			Low:       bar.Low,
			Close:     bar.Close,
			Volume:    bar.Volume,
			Timestamp: bar.Time,
		})
	}
	return out, nil
}

func (c *SolanaTrackerClient) GetTokenChart(token string, query url.Values) (*TrackerChartResponse, error) {
	var resp TrackerChartResponse
	if err := c.GetJSON(path.Join("/chart", token), query, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

func (c *SolanaTrackerClient) GetTokenPoolChart(token, pool string, query url.Values) (*TrackerChartResponse, error) {
	var resp TrackerChartResponse
	if err := c.GetJSON(path.Join("/chart", token, pool), query, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

func (c *SolanaTrackerClient) GetHoldersChart(token string, query url.Values) (*TrackerHoldersChartResponse, error) {
	var resp TrackerHoldersChartResponse
	if err := c.GetJSON(path.Join("/holders/chart", token), query, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

func (c *SolanaTrackerClient) GetTokenStats(token string) (map[string]any, error) {
	var resp map[string]any
	if err := c.GetJSON(path.Join("/stats", token), nil, &resp); err != nil {
		return nil, err
	}
	return resp, nil
}

func (c *SolanaTrackerClient) GetTokenPoolStats(token, pool string) (map[string]any, error) {
	var resp map[string]any
	if err := c.GetJSON(path.Join("/stats", token, pool), nil, &resp); err != nil {
		return nil, err
	}
	return resp, nil
}

func (c *SolanaTrackerClient) GetTopTradersAll(sortBy string) (*TrackerTopTradersAllResponse, error) {
	q := url.Values{}
	if strings.TrimSpace(sortBy) != "" {
		q.Set("sortBy", sortBy)
	}
	var resp TrackerTopTradersAllResponse
	if err := c.GetJSON("/top-traders/all", q, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

func (c *SolanaTrackerClient) GetTopTradersAllPage(pageNum int, sortBy string) (*TrackerTopTradersAllResponse, error) {
	q := url.Values{}
	if strings.TrimSpace(sortBy) != "" {
		q.Set("sortBy", sortBy)
	}
	var resp TrackerTopTradersAllResponse
	if err := c.GetJSON(path.Join("/top-traders/all", fmt.Sprintf("%d", pageNum)), q, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

func (c *SolanaTrackerClient) GetTopTradersToken(token string) ([]TrackerTopTraderToken, error) {
	var resp []TrackerTopTraderToken
	if err := c.GetJSON(path.Join("/top-traders", token), nil, &resp); err != nil {
		return nil, err
	}
	return resp, nil
}

func (c *SolanaTrackerClient) doRequest(method, endpoint string, query url.Values, payload any, out any) error {
	if c == nil || c.apiKey == "" {
		return fmt.Errorf("solana tracker API key not configured")
	}

	base, err := url.Parse(c.baseURL)
	if err != nil {
		return err
	}
	base.Path = path.Join(base.Path, endpoint)
	if len(query) > 0 {
		base.RawQuery = query.Encode()
	}

	var body io.Reader
	if payload != nil {
		buf, err := json.Marshal(payload)
		if err != nil {
			return err
		}
		body = bytes.NewReader(buf)
	}

	req, err := http.NewRequest(method, base.String(), body)
	if err != nil {
		return err
	}
	req.Header.Set("x-api-key", c.apiKey)
	if payload != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("solana tracker request: %w", err)
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("read solana tracker response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("solana tracker HTTP %d: %s", resp.StatusCode, truncateBody(raw))
	}
	if out == nil || len(raw) == 0 {
		return nil
	}
	if err := json.Unmarshal(raw, out); err != nil {
		return fmt.Errorf("parse solana tracker response: %w", err)
	}
	return nil
}

func trackerBestPool(item TrackerTokenFull) TrackerPool {
	if len(item.Pools) == 0 {
		return TrackerPool{}
	}
	pools := make([]TrackerPool, len(item.Pools))
	copy(pools, item.Pools)
	sort.SliceStable(pools, func(i, j int) bool {
		return pools[i].Liquidity.USD > pools[j].Liquidity.USD
	})
	return pools[0]
}

func trackerTokenSymbol(item TrackerTokenFull) string {
	if strings.TrimSpace(item.Token.Symbol) != "" {
		return item.Token.Symbol
	}
	if pool := trackerBestPool(item); strings.TrimSpace(pool.TokenAddress) != "" {
		return pool.TokenAddress
	}
	return item.Token.Mint
}

func trackerEventChange(item TrackerTokenFull, timeframe string) float64 {
	point, ok := item.Events[timeframe]
	if !ok {
		return 0
	}
	return point.PriceChangePercentage
}

func trackerPoolVolume24h(pool TrackerPool) float64 {
	if pool.Txns.Volume24 != 0 {
		return pool.Txns.Volume24
	}
	return pool.Txns.Volume
}

func limitTrackerTokenSlice(items []TrackerTokenFull, limit int) []TrackerTokenFull {
	if limit <= 0 || len(items) <= limit {
		return items
	}
	return items[:limit]
}

func normalizeTrackerTimeframe(tf string) string {
	switch strings.ToLower(strings.TrimSpace(tf)) {
	case "5m", "15m", "30m", "1h", "2h", "3h", "4h", "5h", "6h", "12h", "24h":
		return strings.ToLower(strings.TrimSpace(tf))
	default:
		return "1h"
	}
}

func normalizeTrackerChartType(tf string) string {
	switch strings.ToLower(strings.TrimSpace(tf)) {
	case "1s", "5s", "15s", "1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "8h", "12h", "1d", "3d", "1w", "1mn":
		return strings.ToLower(strings.TrimSpace(tf))
	case "1hr", "1hour":
		return "1h"
	case "4hr", "4hour":
		return "4h"
	case "1day":
		return "1d"
	default:
		return "1h"
	}
}

func trackerChartWindowSeconds(tf string, limit int) int64 {
	perBar := map[string]int64{
		"1s": 1, "5s": 5, "15s": 15,
		"1m": 60, "3m": 180, "5m": 300, "15m": 900, "30m": 1800,
		"1h": 3600, "2h": 7200, "4h": 14400, "6h": 21600, "8h": 28800, "12h": 43200,
		"1d": 86400, "3d": 259200, "1w": 604800, "1mn": 2629800,
	}
	seconds, ok := perBar[tf]
	if !ok {
		seconds = 3600
	}
	return seconds * int64(limit)
}

func truncateBody(body []byte) string {
	if len(body) <= 200 {
		return strings.TrimSpace(string(body))
	}
	return strings.TrimSpace(string(body[:200]))
}
