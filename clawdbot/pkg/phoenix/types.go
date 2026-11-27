// Package phoenix provides a Go client for the Phoenix perpetual futures API.
// Base URL: https://perp-api.phoenix.trade
// Docs:     https://docs.phoenix.trade/llms.txt
package phoenix

// ── Market types ─────────────────────────────────────────────────────

type Market struct {
	Symbol                    string  `json:"symbol"`
	AssetID                   int     `json:"assetId"`
	MarketStatus              string  `json:"marketStatus"`
	MarketPubkey              string  `json:"marketPubkey"`
	TickSize                  int64   `json:"tickSize"`
	BaseLotsDecimals          int     `json:"baseLotsDecimals"`
	TakerFee                  float64 `json:"takerFee"`
	MakerFee                  float64 `json:"makerFee"`
	FundingIntervalSeconds    int     `json:"fundingIntervalSeconds"`
	MaxFundingRatePerInterval int64   `json:"maxFundingRatePerInterval"`
	OpenInterestCapBaseLots   int64   `json:"openInterestCapBaseLots"`
	IsolatedOnly              bool    `json:"isolatedOnly"`
}

// ── Exchange snapshot ─────────────────────────────────────────────────

type ExchangeSnapshot struct {
	Version int              `json:"version"`
	Slot    int64            `json:"slot"`
	Markets []MarketSnapshot `json:"markets"`
}

type MarketSnapshot struct {
	Symbol       string  `json:"symbol"`
	AssetID      int     `json:"assetId"`
	MarketStatus string  `json:"marketStatus"`
	MarkPrice    float64 `json:"markPrice"`
	IndexPrice   float64 `json:"indexPrice"`
	FundingRate  float64 `json:"fundingRate"`
	OpenInterest float64 `json:"openInterest"`
	Volume24h    float64 `json:"volume24h"`
}

// ── Candles ───────────────────────────────────────────────────────────

type Candle struct {
	Time        int64    `json:"time"`
	Open        float64  `json:"open"`
	High        float64  `json:"high"`
	Low         float64  `json:"low"`
	Close       float64  `json:"close"`
	Volume      *float64 `json:"volume"`
	VolumeQuote *float64 `json:"volumeQuote"`
	TradeCount  *int64   `json:"tradeCount"`
	MarkOpen    float64  `json:"markOpen"`
	MarkClose   float64  `json:"markClose"`
}

// ── Trader state ──────────────────────────────────────────────────────

type TraderStateResponse struct {
	Slot      int64        `json:"slot"`
	Authority string       `json:"authority"`
	PdaIndex  int          `json:"pdaIndex"`
	Traders   []TraderView `json:"traders"`
}

type TraderView struct {
	Collateral          float64          `json:"collateral"`
	PortfolioValue      float64          `json:"portfolioValue"`
	EffectiveCollateral float64          `json:"effectiveCollateral"`
	UnrealizedPnl       float64          `json:"unrealizedPnl"`
	MaintenanceMargin   float64          `json:"maintenanceMargin"`
	InitialMargin       float64          `json:"initialMargin"`
	RiskState           string           `json:"riskState"`
	ActivityState       string           `json:"activityState"`
	Positions           []TraderPosition `json:"positions"`
	LimitOrders         []LimitOrder     `json:"limitOrders"`
}

type TraderPosition struct {
	Symbol           string  `json:"symbol"`
	BaseLots         string  `json:"baseLots"`
	EntryPrice       float64 `json:"entryPrice"`
	MarkPrice        float64 `json:"markPrice"`
	LiquidationPrice float64 `json:"liquidationPrice"`
	UnrealizedPnl    float64 `json:"unrealizedPnl"`
	Notional         float64 `json:"notional"`
	Margin           float64 `json:"margin"`
}

type LimitOrder struct {
	Symbol   string  `json:"symbol"`
	Side     string  `json:"side"`
	Price    float64 `json:"price"`
	BaseLots string  `json:"baseLots"`
	Margin   float64 `json:"margin"`
}

// ── Order history ─────────────────────────────────────────────────────

type PaginatedOrders struct {
	Data       []OrderHistoryItem `json:"data"`
	HasMore    bool               `json:"hasMore"`
	NextCursor *string            `json:"nextCursor"`
	PrevCursor *string            `json:"prevCursor"`
}

type OrderHistoryItem struct {
	OrderSequenceNumber int64   `json:"orderSequenceNumber"`
	MarketSymbol        string  `json:"marketSymbol"`
	Status              string  `json:"status"`
	Side                string  `json:"side"`
	IsReduceOnly        bool    `json:"isReduceOnly"`
	Price               float64 `json:"price"`
	BaseQty             string  `json:"baseQty"`
	FilledBaseQty       string  `json:"filledBaseQty"`
	RemainingBaseQty    string  `json:"remainingBaseQty"`
	PlacedAt            *string `json:"placedAt"`
	CompletedAt         *string `json:"completedAt"`
}

// ── Trade history ─────────────────────────────────────────────────────

type PaginatedTrades struct {
	Data       []TradeHistoryItem `json:"data"`
	HasMore    bool               `json:"hasMore"`
	NextCursor *string            `json:"nextCursor"`
}

type TradeHistoryItem struct {
	MarketSymbol  string  `json:"marketSymbol"`
	Timestamp     string  `json:"timestamp"`
	Price         string  `json:"price"`
	BaseLotsDelta string  `json:"baseLotsDelta"`
	RealizedPnl   string  `json:"realizedPnl"`
	Fees          string  `json:"fees"`
	Liquidity     string  `json:"liquidity"`
	TradeType     string  `json:"tradeType"`
	Signature     *string `json:"signature"`
}

// ── Order request params ──────────────────────────────────────────────

type MarketOrderParams struct {
	Authority  string
	Symbol     string
	Side       string // "buy" | "sell"
	Quantity   float64
	ReduceOnly bool
	PdaIndex   int
}

type LimitOrderParams struct {
	Authority  string
	Symbol     string
	Side       string // "buy" | "sell"
	Quantity   float64
	Price      float64
	ReduceOnly bool
	PdaIndex   int
}

// ── Solana instruction (returned by Phoenix API) ───────────────────────

type AccountMeta struct {
	Pubkey     string `json:"pubkey"`
	IsSigner   bool   `json:"isSigner"`
	IsWritable bool   `json:"isWritable"`
}

type Instruction struct {
	ProgramID string        `json:"programId"`
	Keys      []AccountMeta `json:"keys"`
	Data      []byte        `json:"-"`
	DataInts  []int         `json:"data"` // Phoenix returns data as []int
}

// DataBytes returns the instruction data as a byte slice.
func (ix *Instruction) DataBytes() []byte {
	if len(ix.Data) > 0 {
		return ix.Data
	}
	out := make([]byte, len(ix.DataInts))
	for i, v := range ix.DataInts {
		out[i] = byte(v)
	}
	return out
}
