// Package solana :: birdeye_types.go
// Comprehensive Birdeye API v3 response types for Solana token analytics.
package solana

// ── Token Metadata ───────────────────────────────────────────────────

type TokenExtensions struct {
	CoingeckoID string `json:"coingecko_id,omitempty"`
	Website     string `json:"website,omitempty"`
	Twitter     string `json:"twitter,omitempty"`
	Discord     string `json:"discord,omitempty"`
	Telegram    string `json:"telegram,omitempty"`
	Medium      string `json:"medium,omitempty"`
	Description string `json:"description,omitempty"`
}

type TokenMetadata struct {
	Address    string          `json:"address"`
	Symbol     string          `json:"symbol"`
	Name       string          `json:"name"`
	Decimals   int             `json:"decimals"`
	Extensions TokenExtensions `json:"extensions"`
	LogoURI    string          `json:"logo_uri"`
}

// ── Token Market Data ────────────────────────────────────────────────

type TokenMarketData struct {
	Address           string   `json:"address"`
	Price             float64  `json:"price"`
	Liquidity         float64  `json:"liquidity"`
	TotalSupply       float64  `json:"total_supply"`
	CirculatingSupply float64  `json:"circulating_supply"`
	MarketCap         float64  `json:"market_cap"`
	FDV               float64  `json:"fdv"`
	Holder            int      `json:"holder"`
	IsScaledUIToken   bool     `json:"is_scaled_ui_token"`
	Multiplier        *float64 `json:"multiplier"`
}

type TokenLiquidityData struct {
	Address   string  `json:"address"`
	Liquidity float64 `json:"liquidity"`
}

// ── Token Overview (full v1 overview) ────────────────────────────────

type TokenOverviewV3 struct {
	Address              string          `json:"address"`
	Decimals             int             `json:"decimals"`
	Symbol               string          `json:"symbol"`
	Name                 string          `json:"name"`
	MarketCap            float64         `json:"marketCap"`
	FDV                  float64         `json:"fdv"`
	Extensions           TokenExtensions `json:"extensions"`
	LogoURI              string          `json:"logoURI"`
	Liquidity            float64         `json:"liquidity"`
	LastTradeUnixTime    int64           `json:"lastTradeUnixTime"`
	LastTradeHumanTime   string          `json:"lastTradeHumanTime"`
	Price                float64         `json:"price"`
	History1mPrice       float64         `json:"history1mPrice"`
	PriceChange1mPct     float64         `json:"priceChange1mPercent"`
	History5mPrice       float64         `json:"history5mPrice"`
	PriceChange5mPct     float64         `json:"priceChange5mPercent"`
	History30mPrice      float64         `json:"history30mPrice"`
	PriceChange30mPct    float64         `json:"priceChange30mPercent"`
	History1hPrice       float64         `json:"history1hPrice"`
	PriceChange1hPct     float64         `json:"priceChange1hPercent"`
	History2hPrice       float64         `json:"history2hPrice"`
	PriceChange2hPct     float64         `json:"priceChange2hPercent"`
	History4hPrice       float64         `json:"history4hPrice"`
	PriceChange4hPct     float64         `json:"priceChange4hPercent"`
	History6hPrice       float64         `json:"history6hPrice"`
	PriceChange6hPct     float64         `json:"priceChange6hPercent"`
	History8hPrice       float64         `json:"history8hPrice"`
	PriceChange8hPct     float64         `json:"priceChange8hPercent"`
	History12hPrice      float64         `json:"history12hPrice"`
	PriceChange12hPct    float64         `json:"priceChange12hPercent"`
	History24hPrice      float64         `json:"history24hPrice"`
	PriceChange24hPct    float64         `json:"priceChange24hPercent"`
	UniqueWallet1m       int             `json:"uniqueWallet1m"`
	UniqueWallet30m      int             `json:"uniqueWallet30m"`
	UniqueWallet1h       int             `json:"uniqueWallet1h"`
	UniqueWallet2h       int             `json:"uniqueWallet2h"`
	UniqueWallet4h       int             `json:"uniqueWallet4h"`
	UniqueWallet8h       int             `json:"uniqueWallet8h"`
	UniqueWallet24h      int             `json:"uniqueWallet24h"`
}

// ── Token Trade Data ─────────────────────────────────────────────────

type TokenTradeData struct {
	Address              string  `json:"address"`
	Holder               int     `json:"holder"`
	Market               int     `json:"market"`
	LastTradeUnixTime    int64   `json:"last_trade_unix_time"`
	LastTradeHumanTime   string  `json:"last_trade_human_time"`
	Price                float64 `json:"price"`
	History30mPrice      float64 `json:"history_30m_price"`
	PriceChange30mPct    float64 `json:"price_change_30m_percent"`
	History1hPrice       float64 `json:"history_1h_price"`
	PriceChange1hPct     float64 `json:"price_change_1h_percent"`
	History24hPrice      float64 `json:"history_24h_price"`
	PriceChange24hPct    float64 `json:"price_change_24h_percent"`
	UniqueWallet30m      int     `json:"unique_wallet_30m"`
	UniqueWallet1h       int     `json:"unique_wallet_1h"`
	UniqueWallet24h      int     `json:"unique_wallet_24h"`
	Trade30m             int     `json:"trade_30m"`
	Trade1h              int     `json:"trade_1h"`
	Trade24h             int     `json:"trade_24h"`
	Buy30m               int     `json:"buy_30m"`
	Sell30m              int     `json:"sell_30m"`
	Buy1h                int     `json:"buy_1h"`
	Sell1h               int     `json:"sell_1h"`
	Buy24h               int     `json:"buy_24h"`
	Sell24h              int     `json:"sell_24h"`
	Volume30mUSD         float64 `json:"volume_30m_usd"`
	Volume1hUSD          float64 `json:"volume_1h_usd"`
	Volume24hUSD         float64 `json:"volume_24h_usd"`
	VolumeBuy30mUSD      float64 `json:"volume_buy_30m_usd"`
	VolumeSell30mUSD     float64 `json:"volume_sell_30m_usd"`
	VolumeBuy1hUSD       float64 `json:"volume_buy_1h_usd"`
	VolumeSell1hUSD      float64 `json:"volume_sell_1h_usd"`
	VolumeBuy24hUSD      float64 `json:"volume_buy_24h_usd"`
	VolumeSell24hUSD     float64 `json:"volume_sell_24h_usd"`
}

// ── Pair Overview ────────────────────────────────────────────────────

type PairAsset struct {
	Address         string   `json:"address"`
	Decimals        int      `json:"decimals"`
	Icon            string   `json:"icon"`
	Symbol          string   `json:"symbol"`
	IsScaledUIToken bool     `json:"is_scaled_ui_token"`
	Multiplier      *float64 `json:"multiplier"`
}

type PairOverview struct {
	Address                   string    `json:"address"`
	Name                      string    `json:"name"`
	Source                    string    `json:"source"`
	Base                      PairAsset `json:"base"`
	Quote                     PairAsset `json:"quote"`
	CreatedAt                 string    `json:"created_at"`
	Liquidity                 float64   `json:"liquidity"`
	Price                     float64   `json:"price"`
	Trade24h                  int       `json:"trade_24h"`
	Trade24hChangePct         float64   `json:"trade_24h_change_percent"`
	UniqueWallet24h           int       `json:"unique_wallet_24h"`
	UniqueWallet24hChangePct  float64   `json:"unique_wallet_24h_change_percent"`
	Volume24h                 float64   `json:"volume_24h"`
	Volume1h                  float64   `json:"volume_1h"`
	Volume30m                 float64   `json:"volume_30m"`
}

// ── Price Stats ──────────────────────────────────────────────────────

type PriceStatFrame struct {
	UnixTimeUpdatePrice int64   `json:"unix_time_update_price"`
	TimeFrame           string  `json:"time_frame"`
	Price               float64 `json:"price"`
	PriceChangePct      float64 `json:"price_change_percent"`
	High                float64 `json:"high"`
	Low                 float64 `json:"low"`
}

type PriceStatsItem struct {
	Address         string           `json:"address"`
	IsScaledUIToken bool             `json:"is_scaled_ui_token"`
	Data            []PriceStatFrame `json:"data"`
}

// ── Token List ───────────────────────────────────────────────────────

type TokenListItem struct {
	Address              string          `json:"address"`
	LogoURI              string          `json:"logo_uri"`
	Name                 string          `json:"name"`
	Symbol               string          `json:"symbol"`
	Decimals             int             `json:"decimals"`
	Extensions           TokenExtensions `json:"extensions,omitempty"`
	MarketCap            float64         `json:"market_cap"`
	FDV                  float64         `json:"fdv"`
	Liquidity            float64         `json:"liquidity"`
	Price                float64         `json:"price"`
	Holder               int             `json:"holder"`
	Volume1hUSD          float64         `json:"volume_1h_usd"`
	Volume24hUSD         float64         `json:"volume_24h_usd"`
	PriceChange1hPct     float64         `json:"price_change_1h_percent"`
	PriceChange24hPct    float64         `json:"price_change_24h_percent"`
	Trade1hCount         int             `json:"trade_1h_count"`
	Trade24hCount        int             `json:"trade_24h_count"`
	RecentListingTime    *int64          `json:"recent_listing_time"`
}

// ── Transactions (V3) ───────────────────────────────────────────────

type TradeItem struct {
	TxType        string           `json:"tx_type"`
	TxHash        string           `json:"tx_hash"`
	BlockUnixTime int64            `json:"block_unix_time"`
	BlockNumber   int64            `json:"block_number"`
	VolumeUSD     float64          `json:"volume_usd"`
	Volume        float64          `json:"volume"`
	Owner         string           `json:"owner"`
	Signers       []string         `json:"signers"`
	Source        string           `json:"source"`
	Side          string           `json:"side"`
	PricePair     float64          `json:"price_pair"`
	PoolID        string           `json:"pool_id"`
	From          *TradeTokenInfo  `json:"from"`
	To            *TradeTokenInfo  `json:"to"`
}

type TradeTokenInfo struct {
	Symbol   string  `json:"symbol"`
	Address  string  `json:"address"`
	Decimals int     `json:"decimals"`
	Price    float64 `json:"price"`
	Amount   string  `json:"amount"`
	UIAmount float64 `json:"ui_amount"`
}

// ── Wallet ───────────────────────────────────────────────────────────

type WalletBalanceChange struct {
	Time          string           `json:"time"`
	BlockNumber   int64            `json:"block_number"`
	BlockUnixTime int64            `json:"block_unix_time"`
	Address       string           `json:"address"`
	TxHash        string           `json:"tx_hash"`
	PreBalance    string           `json:"pre_balance"`
	PostBalance   string           `json:"post_balance"`
	Amount        string           `json:"amount"`
	TokenInfo     *WalletTokenInfo `json:"token_info"`
	TypeText      string           `json:"type_text"`
	ChangeTypeText string          `json:"change_type_text"`
}

type WalletTokenInfo struct {
	Address  string `json:"address"`
	Decimals int    `json:"decimals"`
	Symbol   string `json:"symbol"`
	Name     string `json:"name"`
	LogoURI  string `json:"logo_uri"`
}

type WalletTokenBalance struct {
	Address  string  `json:"address"`
	Decimals int     `json:"decimals"`
	Price    float64 `json:"price"`
	Balance  string  `json:"balance"`
	Amount   float64 `json:"amount"`
	Network  string  `json:"network"`
	Name     string  `json:"name"`
	Symbol   string  `json:"symbol"`
	LogoURI  string  `json:"logo_uri"`
	Value    string  `json:"value"`
}

// ── Token Transfer ───────────────────────────────────────────────────

type TokenTransfer struct {
	Time             string           `json:"time"`
	BlockNumber      int64            `json:"block_number"`
	UnixTime         int64            `json:"unix_time"`
	TokenAddress     string           `json:"token_address"`
	FromAddress      string           `json:"from_address"`
	ToAddress        string           `json:"to_address"`
	Amount           string           `json:"amount"`
	UIAmount         float64          `json:"ui_amount"`
	Price            float64          `json:"price"`
	Value            float64          `json:"value"`
	TxHash           string           `json:"tx_hash"`
	Flow             string           `json:"flow"`
	TokenInfo        *WalletTokenInfo `json:"token_info"`
	Action           string           `json:"action"`
}

// ── Creation & Trending ──────────────────────────────────────────────

type TokenCreationInfo struct {
	Address          string `json:"address"`
	Symbol           string `json:"symbol"`
	Name             string `json:"name"`
	Decimals         int    `json:"decimals"`
	Owner            string `json:"owner"`
	TxHash           string `json:"txHash"`
	Slot             int64  `json:"slot"`
	BlockHumanTime   string `json:"blockHumanTime"`
	BlockUnixTime    int64  `json:"blockUnixTime"`
}

type TrendingTokenV3 struct {
	Address              string  `json:"address"`
	Symbol               string  `json:"symbol"`
	Name                 string  `json:"name"`
	Decimals             int     `json:"decimals"`
	LogoURI              string  `json:"logo_uri"`
	Price                float64 `json:"price"`
	PriceChange24hPct    float64 `json:"price_change_24h_percent"`
	Volume24hUSD         float64 `json:"volume_24h_usd"`
	MarketCap            float64 `json:"market_cap"`
	Liquidity            float64 `json:"liquidity"`
	Rank                 int     `json:"rank"`
}

// ── Security ─────────────────────────────────────────────────────────

type TokenSecurity struct {
	OwnerAddress    string  `json:"ownerAddress"`
	CreatorAddress  string  `json:"creatorAddress"`
	OwnerBalance    float64 `json:"ownerBalance"`
	CreatorBalance  float64 `json:"creatorBalance"`
	OwnerPercentage float64 `json:"ownerPercentage"`
	Top10Percentage float64 `json:"top10HolderPercent"`
	IsMutable       bool    `json:"isMutable"`
	IsFreezable     int     `json:"isToken2022"`
	HasMintAuth     string  `json:"mintAuthority"`
	HasFreezeAuth   string  `json:"freezeAuthority"`
	TransferFeeEnable string `json:"transferFeeEnable"`
}

// ── Search ───────────────────────────────────────────────────────────

type SearchResult struct {
	Address   string  `json:"address"`
	Symbol    string  `json:"symbol"`
	Name      string  `json:"name"`
	Price     float64 `json:"price"`
	LogoURI   string  `json:"logo_uri"`
	Liquidity float64 `json:"liquidity"`
	Volume24h float64 `json:"volume_24h_usd"`
	Network   string  `json:"network"`
}

// ── Mint/Burn ────────────────────────────────────────────────────────

type MintBurnTx struct {
	Amount         string  `json:"amount"`
	BlockHumanTime string  `json:"block_human_time"`
	BlockTime      float64 `json:"block_time"`
	CommonType     string  `json:"common_type"`
	Decimals       int     `json:"decimals"`
	Mint           string  `json:"mint"`
	ProgramID      string  `json:"program_id"`
	Slot           int64   `json:"slot"`
	TxHash         string  `json:"tx_hash"`
	UIAmount       float64 `json:"ui_amount"`
}

// ── New Listing ──────────────────────────────────────────────────────

type NewListingToken struct {
	Address       string  `json:"address"`
	Symbol        string  `json:"symbol"`
	Name          string  `json:"name"`
	Decimals      int     `json:"decimals"`
	LogoURI       string  `json:"logo_uri"`
	Liquidity     float64 `json:"liquidity"`
	MarketCap     float64 `json:"market_cap"`
	Price         float64 `json:"price"`
	ListingTime   int64   `json:"listing_time"`
}

// ── Holder ───────────────────────────────────────────────────────────

type TokenHolder struct {
	Address    string  `json:"address"`
	Amount     float64 `json:"amount"`
	Decimals   int     `json:"decimals"`
	Owner      string  `json:"owner"`
	UIAmount   float64 `json:"uiAmount"`
}

type HolderDistribution struct {
	Shark   int `json:"shark"`
	Whale   int `json:"whale"`
	Fish    int `json:"fish"`
	Shrimp  int `json:"shrimp"`
}

type TokenExitLiquidityPrice struct {
	Value          float64 `json:"value"`
	UpdateUnixTime int64   `json:"update_unix_time"`
	UpdateHumanTime string `json:"update_human_time"`
	UpdateInSlot   int64   `json:"update_in_slot"`
}

type TokenExitLiquidity struct {
	Token         string                  `json:"token"`
	ExitLiquidity float64                 `json:"exit_liquidity"`
	Liquidity     float64                 `json:"liquidity"`
	Price         TokenExitLiquidityPrice `json:"price"`
	Currency      string                  `json:"currency"`
	Address       string                  `json:"address"`
	Name          string                  `json:"name"`
	Symbol        string                  `json:"symbol"`
	Decimals      int                     `json:"decimals"`
	Extensions    map[string]any          `json:"extensions"`
	LogoURI       string                  `json:"logo_uri"`
}

// ── Token List (V3 Scroll / V1 / Markets) ──────────────────────────

type TokenListScrollPage struct {
	NextScrollID string          `json:"next_scroll_id"`
	ScrollTime   string          `json:"scroll_time"`
	Items        []TokenListItem `json:"items"`
}

type TokenListV1Item struct {
	Address          string   `json:"address"`
	Decimals         int      `json:"decimals"`
	Price            float64  `json:"price"`
	LastTradeUnixTime int64   `json:"lastTradeUnixTime"`
	Liquidity        float64  `json:"liquidity"`
	LogoURI          string   `json:"logoURI"`
	MC               float64  `json:"mc"`
	Name             string   `json:"name"`
	Symbol           string   `json:"symbol"`
	V24hChangePct    float64  `json:"v24hChangePercent"`
	V24hUSD          float64  `json:"v24hUSD"`
	IsScaledUIToken  bool     `json:"isScaledUiToken"`
	Multiplier       *float64 `json:"multiplier"`
}

type MarketListAsset struct {
	Address  string `json:"address"`
	Decimals int    `json:"decimals"`
	Symbol   string `json:"symbol"`
	Icon     string `json:"icon"`
}

type MarketListItem struct {
	Address                     string          `json:"address"`
	Base                        MarketListAsset `json:"base"`
	Quote                       MarketListAsset `json:"quote"`
	CreatedAt                   string          `json:"createdAt"`
	Name                        string          `json:"name"`
	Source                      string          `json:"source"`
	Liquidity                   float64         `json:"liquidity"`
	Price                       float64         `json:"price"`
	Trade24h                    int             `json:"trade24h"`
	Trade24hChangePercent       float64         `json:"trade24hChangePercent"`
	UniqueWallet24h             int             `json:"uniqueWallet24h"`
	UniqueWallet24hChangePercent float64        `json:"uniqueWallet24hChangePercent"`
	Volume24h                   float64         `json:"volume24h"`
}

// ── Pair Transactions ────────────────────────────────────────────────

type PairTradeToken struct {
	Symbol             string   `json:"symbol"`
	Address            string   `json:"address"`
	Decimals           int      `json:"decimals"`
	Price              float64  `json:"price"`
	Amount             *float64 `json:"amount,omitempty"`
	UIAmount           *float64 `json:"uiAmount,omitempty"`
	UIChangeAmount     *float64 `json:"uiChangeAmount,omitempty"`
	TypeSwap           string   `json:"typeSwap,omitempty"`
	IsScaledUIToken    bool     `json:"isScaledUiToken"`
	Multiplier         *float64 `json:"multiplier"`
}

type PairTradeItem struct {
	TxHash        string         `json:"txHash"`
	Source        string         `json:"source"`
	BlockUnixTime int64          `json:"blockUnixTime"`
	TxType        string         `json:"txType"`
	Address       string         `json:"address"`
	Owner         string         `json:"owner"`
	From          PairTradeToken `json:"from"`
	To            PairTradeToken `json:"to"`
}

// ── Wallet Net Worth / PnL ──────────────────────────────────────────

type WalletCurrentNetWorthItem struct {
	Address  string  `json:"address"`
	Decimals int     `json:"decimals"`
	Price    float64 `json:"price"`
	Balance  string  `json:"balance"`
	Amount   float64 `json:"amount"`
	Network  string  `json:"network"`
	Name     string  `json:"name"`
	Symbol   string  `json:"symbol"`
	LogoURI  string  `json:"logo_uri"`
	Value    string  `json:"value"`
}

type WalletCurrentNetWorth struct {
	WalletAddress    string                     `json:"wallet_address"`
	Currency         string                     `json:"currency"`
	TotalValue       string                     `json:"total_value"`
	CurrentTimestamp string                     `json:"current_timestamp"`
	Items            []WalletCurrentNetWorthItem `json:"items"`
}

type WalletNetWorthHistoryPoint struct {
	Timestamp             string  `json:"timestamp"`
	NetWorth              float64 `json:"net_worth"`
	NetWorthChange        float64 `json:"net_worth_change"`
	NetWorthChangePercent float64 `json:"net_worth_change_percent"`
}

type WalletNetWorthHistory struct {
	WalletAddress     string                      `json:"wallet_address"`
	Currency          string                      `json:"currency"`
	CurrentTimestamp  string                      `json:"current_timestamp"`
	PastTimestamp     string                      `json:"past_timestamp"`
	History           []WalletNetWorthHistoryPoint `json:"history"`
}

type WalletSummaryValue struct {
	Value string `json:"value"`
}

type WalletNetWorthAsset struct {
	Symbol       string  `json:"symbol"`
	TokenAddress string  `json:"token_address"`
	Decimal      int     `json:"decimal"`
	Balance      string  `json:"balance"`
	Price        float64 `json:"price"`
	Value        float64 `json:"value"`
}

type WalletNetWorthDetails struct {
	WalletAddress     string                `json:"wallet_address"`
	Currency          string                `json:"currency"`
	NetWorth          float64               `json:"net_worth"`
	RequestedTimestamp string               `json:"requested_timestamp"`
	ResolvedTimestamp string                `json:"resolved_timestamp"`
	NetAssets         []WalletNetWorthAsset `json:"net_assets"`
}

type WalletPnLCounts struct {
	TotalBuy   int     `json:"total_buy"`
	TotalSell  int     `json:"total_sell"`
	TotalTrade int     `json:"total_trade"`
	TotalWin   int     `json:"total_win"`
	TotalLoss  int     `json:"total_loss"`
	WinRate    float64 `json:"win_rate"`
}

type WalletPnLCashflow struct {
	TotalInvested    float64 `json:"total_invested"`
	CostOfQuantitySold float64 `json:"cost_of_quantity_sold"`
	TotalSold        float64 `json:"total_sold"`
	CurrentValue     float64 `json:"current_value"`
}

type WalletPnLMetrics struct {
	RealizedProfitUSD      float64 `json:"realized_profit_usd"`
	RealizedProfitPercent  float64 `json:"realized_profit_percent"`
	UnrealizedUSD          float64 `json:"unrealized_usd"`
	UnrealizedPercent      float64 `json:"unrealized_percent"`
	TotalUSD               float64 `json:"total_usd"`
	TotalPercent           float64 `json:"total_percent"`
	AvgProfitPerTradeUSD   float64 `json:"avg_profit_per_trade_usd"`
}

type WalletPnLSummaryData struct {
	UniqueTokens int             `json:"unique_tokens"`
	Counts       WalletPnLCounts `json:"counts"`
	CashflowUSD  WalletPnLCashflow `json:"cashflow_usd"`
	PnL          WalletPnLMetrics `json:"pnl"`
}

type WalletPnLSummary struct {
	Summary WalletPnLSummaryData `json:"summary"`
}

type WalletPnLQuantity struct {
	TotalBoughtAmount float64 `json:"total_bought_amount"`
	TotalSoldAmount   float64 `json:"total_sold_amount"`
	Holding           float64 `json:"holding"`
}

type WalletPnLPricing struct {
	CurrentPrice float64 `json:"current_price"`
	AvgBuyCost   float64 `json:"avg_buy_cost"`
	AvgSellCost  float64 `json:"avg_sell_cost"`
}

type WalletPnLToken struct {
	Symbol    string            `json:"symbol"`
	Decimals  int               `json:"decimals"`
	Address   string            `json:"address"`
	Counts    WalletPnLCounts   `json:"counts"`
	Quantity  WalletPnLQuantity `json:"quantity"`
	Cashflow  WalletPnLCashflow `json:"cashflow_usd"`
	PnL       WalletPnLMetrics  `json:"pnl"`
	Pricing   WalletPnLPricing  `json:"pricing"`
}

type WalletPnLMeta struct {
	Address      string `json:"address"`
	Currency     string `json:"currency"`
	HoldingCheck bool   `json:"holding_check"`
	Time         string `json:"time"`
}

type WalletPnLDetails struct {
	Meta    WalletPnLMeta    `json:"meta"`
	Tokens  []WalletPnLToken `json:"tokens"`
	Summary map[string]any   `json:"summary"`
}

// ── Smart Money / All-time / Meme ───────────────────────────────────

type SmartMoneyToken struct {
	Token            string  `json:"token"`
	Price            float64 `json:"price"`
	Liquidity        float64 `json:"liquidity"`
	MarketCap        float64 `json:"market_cap"`
	NetFlow          float64 `json:"net_flow"`
	SmartTradersNo   int     `json:"smart_traders_no"`
	TraderStyle      string  `json:"trader_style"`
	VolumeUSD        float64 `json:"volume_usd"`
	VolumeBuyUSD     float64 `json:"volume_buy_usd"`
	VolumeSellUSD    float64 `json:"volume_sell_usd"`
	Symbol           string  `json:"symbol"`
	Name             string  `json:"name"`
	LogoURI          string  `json:"logo_uri"`
	PriceChangePct   float64 `json:"price_change_percent"`
}

type AllTimeTradesItem struct {
	Address        string  `json:"address"`
	TotalVolume    float64 `json:"total_volume"`
	TotalVolumeUSD float64 `json:"total_volume_usd"`
	VolumeBuyUSD   float64 `json:"volume_buy_usd"`
	VolumeSellUSD  float64 `json:"volume_sell_usd"`
	VolumeBuy      float64 `json:"volume_buy"`
	VolumeSell     float64 `json:"volume_sell"`
	TotalTrade     int     `json:"total_trade"`
	Buy            int     `json:"buy"`
	Sell           int     `json:"sell"`
}

type MemeTokenDetail struct {
	Address          string                 `json:"address"`
	Name             string                 `json:"name"`
	Symbol           string                 `json:"symbol"`
	Decimals         int                    `json:"decimals"`
	Extensions       map[string]any         `json:"extensions"`
	LogoURI          string                 `json:"logo_uri"`
	Price            float64                `json:"price"`
	Liquidity        float64                `json:"liquidity"`
	CirculatingSupply float64               `json:"circulating_supply"`
	MarketCap        float64                `json:"market_cap"`
	TotalSupply      float64                `json:"total_supply"`
	FDV              float64                `json:"fdv"`
	MemeInfo         map[string]any         `json:"meme_info"`
}

// ── OHLCV V3 ────────────────────────────────────────────────────────

type BirdeyeOHLCVV3Item struct {
	O        float64 `json:"o"`
	H        float64 `json:"h"`
	L        float64 `json:"l"`
	C        float64 `json:"c"`
	V        float64 `json:"v"`
	VUSD     float64 `json:"v_usd"`
	UnixTime int64   `json:"unix_time"`
	Address  string  `json:"address"`
	Type     string  `json:"type"`
	Currency string  `json:"currency"`
}

type BirdeyeOHLCVV3Response struct {
	IsScaledUIToken bool                  `json:"is_scaled_ui_token"`
	Multiplier      *float64              `json:"multiplier"`
	Items           []BirdeyeOHLCVV3Item  `json:"items"`
}

// ── Historical Price ─────────────────────────────────────────────────

type BirdeyeHistoryPriceItem struct {
	UnixTime int64   `json:"unixTime"`
	Value    float64 `json:"value"`
}

type BirdeyeHistoryPriceResponse struct {
	IsScaledUIToken bool                      `json:"isScaledUiToken"`
	Items           []BirdeyeHistoryPriceItem `json:"items"`
}

// ── Multi-Price ──────────────────────────────────────────────────────

type BirdeyeMultiPriceItem struct {
	Value          float64 `json:"value"`
	UpdateUnixTime int64   `json:"updateUnixTime"`
	PriceChange24h float64 `json:"priceChange24h"`
	PriceInNative  float64 `json:"priceInNative"`
	Liquidity      float64 `json:"liquidity"`
}

// ── Price Volume ─────────────────────────────────────────────────────

type BirdeyePriceVolumeItem struct {
	Price     float64 `json:"price"`
	Volume    float64 `json:"volume"`
	VolumeUSD float64 `json:"volumeUSD"`
	UnixTime  int64   `json:"unixTime"`
}

type MemeTokenListItem struct {
	Address            string  `json:"address"`
	LogoURI            string  `json:"logo_uri"`
	Name               string  `json:"name"`
	Symbol             string  `json:"symbol"`
	Decimals           int     `json:"decimals"`
	MarketCap          float64 `json:"market_cap"`
	FDV                float64 `json:"fdv"`
	Liquidity          float64 `json:"liquidity"`
	Price              float64 `json:"price"`
	Holder             int     `json:"holder"`
	Volume24hUSD       float64 `json:"volume_24h_usd"`
	PriceChange24hPct  float64 `json:"price_change_24h_percent"`
	Trade24hCount      int     `json:"trade_24h_count"`
	ProgressPercent    float64 `json:"progress_percent"`
	Source             string  `json:"source"`
	CreationTime       int64   `json:"creation_time"`
	Graduated          bool    `json:"graduated"`
	GraduatedTime      int64   `json:"graduated_time"`
}
