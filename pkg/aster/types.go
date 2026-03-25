// Package aster provides a Go client for the Aster DEX perpetual futures API.
// Base URLs:
//   Spot:    https://sapi.asterdex.com
//   Futures: https://fapi.asterdex.com
//   WS Spot: wss://sstream.asterdex.com
//   WS Perp: wss://fstream.asterdex.com
package aster

// ── Enums ────────────────────────────────────────────────────────────

type OrderSide string

const (
	SideBuy  OrderSide = "BUY"
	SideSell OrderSide = "SELL"
)

type OrderType string

const (
	OrderLimit            OrderType = "LIMIT"
	OrderMarket           OrderType = "MARKET"
	OrderStop             OrderType = "STOP"
	OrderStopMarket       OrderType = "STOP_MARKET"
	OrderTakeProfit       OrderType = "TAKE_PROFIT"
	OrderTakeProfitMarket OrderType = "TAKE_PROFIT_MARKET"
	OrderTrailingStop     OrderType = "TRAILING_STOP_MARKET"
)

type TimeInForce string

const (
	TifGTC    TimeInForce = "GTC"
	TifIOC    TimeInForce = "IOC"
	TifFOK    TimeInForce = "FOK"
	TifGTX    TimeInForce = "GTX"
	TifHidden TimeInForce = "HIDDEN"
)

type PositionSide string

const (
	PosBoth  PositionSide = "BOTH"
	PosLong  PositionSide = "LONG"
	PosShort PositionSide = "SHORT"
)

type MarginType string

const (
	MarginIsolated MarginType = "ISOLATED"
	MarginCrossed  MarginType = "CROSSED"
)

type WorkingType string

const (
	WorkingMarkPrice     WorkingType = "MARK_PRICE"
	WorkingContractPrice WorkingType = "CONTRACT_PRICE"
)

// ── Market Data Types ────────────────────────────────────────────────

type ExchangeInfo struct {
	Timezone   string       `json:"timezone"`
	ServerTime int64        `json:"serverTime"`
	Symbols    []SymbolInfo `json:"symbols"`
}

type SymbolInfo struct {
	Symbol            string   `json:"symbol"`
	Pair              string   `json:"pair"`
	ContractType      string   `json:"contractType"`
	Status            string   `json:"status"`
	BaseAsset         string   `json:"baseAsset"`
	QuoteAsset        string   `json:"quoteAsset"`
	MarginAsset       string   `json:"marginAsset"`
	PricePrecision    int      `json:"pricePrecision"`
	QuantityPrecision int      `json:"quantityPrecision"`
	OrderTypes        []string `json:"orderTypes,omitempty"`
	OrderType         []string `json:"OrderType,omitempty"` // futures uses this key
	TimeInForce       []string `json:"timeInForce"`
}

type MarkPrice struct {
	Symbol               string `json:"symbol"`
	MarkPrice            string `json:"markPrice"`
	IndexPrice           string `json:"indexPrice"`
	EstimatedSettlePrice string `json:"estimatedSettlePrice"`
	LastFundingRate      string `json:"lastFundingRate"`
	NextFundingTime      int64  `json:"nextFundingTime"`
	InterestRate         string `json:"interestRate"`
	Time                 int64  `json:"time"`
}

type FundingRate struct {
	Symbol      string `json:"symbol"`
	FundingRate string `json:"fundingRate"`
	FundingTime int64  `json:"fundingTime"`
}

type FundingInfo struct {
	Symbol              string  `json:"symbol"`
	InterestRate        string  `json:"interestRate"`
	Time                int64   `json:"time"`
	FundingIntervalHours int    `json:"fundingIntervalHours"`
	FundingFeeCap       float64 `json:"fundingFeeCap"`
	FundingFeeFloor     float64 `json:"fundingFeeFloor"`
}

type Ticker24hr struct {
	Symbol             string `json:"symbol"`
	PriceChange        string `json:"priceChange"`
	PriceChangePercent string `json:"priceChangePercent"`
	WeightedAvgPrice   string `json:"weightedAvgPrice"`
	LastPrice          string `json:"lastPrice"`
	LastQty            string `json:"lastQty"`
	OpenPrice          string `json:"openPrice"`
	HighPrice          string `json:"highPrice"`
	LowPrice           string `json:"lowPrice"`
	Volume             string `json:"volume"`
	QuoteVolume        string `json:"quoteVolume"`
	OpenTime           int64  `json:"openTime"`
	CloseTime          int64  `json:"closeTime"`
	Count              int    `json:"count"`
}

type PriceTicker struct {
	Symbol string `json:"symbol"`
	Price  string `json:"price"`
	Time   int64  `json:"time"`
}

type BookTicker struct {
	Symbol   string `json:"symbol"`
	BidPrice string `json:"bidPrice"`
	BidQty   string `json:"bidQty"`
	AskPrice string `json:"askPrice"`
	AskQty   string `json:"askQty"`
	Time     int64  `json:"time"`
}

type Kline struct {
	OpenTime                 int64
	Open, High, Low, Close   string
	Volume                   string
	CloseTime                int64
	QuoteVolume              string
	Trades                   int
	TakerBuyBaseVolume       string
	TakerBuyQuoteVolume      string
}

type Depth struct {
	LastUpdateID int64      `json:"lastUpdateId"`
	Bids         [][]string `json:"bids"`
	Asks         [][]string `json:"asks"`
}

// ── Account Types ────────────────────────────────────────────────────

type FuturesBalance struct {
	Asset               string `json:"asset"`
	Balance             string `json:"balance"`
	CrossWalletBalance  string `json:"crossWalletBalance"`
	CrossUnPnl          string `json:"crossUnPnl"`
	AvailableBalance    string `json:"availableBalance"`
	MaxWithdrawAmount   string `json:"maxWithdrawAmount"`
	MarginAvailable     bool   `json:"marginAvailable"`
	UpdateTime          int64  `json:"updateTime"`
}

type FuturesAccount struct {
	FeeTier                  int               `json:"feeTier"`
	CanTrade                 bool              `json:"canTrade"`
	TotalWalletBalance       string            `json:"totalWalletBalance"`
	TotalUnrealizedProfit    string            `json:"totalUnrealizedProfit"`
	TotalMarginBalance       string            `json:"totalMarginBalance"`
	AvailableBalance         string            `json:"availableBalance"`
	MaxWithdrawAmount        string            `json:"maxWithdrawAmount"`
	Assets                   []AccountAsset    `json:"assets"`
	Positions                []AccountPosition `json:"positions"`
}

type AccountAsset struct {
	Asset                string `json:"asset"`
	WalletBalance        string `json:"walletBalance"`
	UnrealizedProfit     string `json:"unrealizedProfit"`
	MarginBalance        string `json:"marginBalance"`
	AvailableBalance     string `json:"availableBalance"`
	MaxWithdrawAmount    string `json:"maxWithdrawAmount"`
	MarginAvailable      bool   `json:"marginAvailable"`
	UpdateTime           int64  `json:"updateTime"`
}

type AccountPosition struct {
	Symbol           string `json:"symbol"`
	InitialMargin    string `json:"initialMargin"`
	MaintMargin      string `json:"maintMargin"`
	UnrealizedProfit string `json:"unrealizedProfit"`
	Leverage         string `json:"leverage"`
	Isolated         bool   `json:"isolated"`
	EntryPrice       string `json:"entryPrice"`
	MaxNotional      string `json:"maxNotional"`
	PositionSide     string `json:"positionSide"`
	PositionAmt      string `json:"positionAmt"`
	UpdateTime       int64  `json:"updateTime"`
}

type PositionRisk struct {
	Symbol           string `json:"symbol"`
	EntryPrice       string `json:"entryPrice"`
	MarginType       string `json:"marginType"`
	IsAutoAddMargin  string `json:"isAutoAddMargin"`
	IsolatedMargin   string `json:"isolatedMargin"`
	Leverage         string `json:"leverage"`
	LiquidationPrice string `json:"liquidationPrice"`
	MarkPrice        string `json:"markPrice"`
	MaxNotionalValue string `json:"maxNotionalValue"`
	PositionAmt      string `json:"positionAmt"`
	UnRealizedProfit string `json:"unRealizedProfit"`
	PositionSide     string `json:"positionSide"`
	UpdateTime       int64  `json:"updateTime"`
}

// ── Order Types ──────────────────────────────────────────────────────

type OrderResponse struct {
	Symbol        string `json:"symbol"`
	OrderID       int64  `json:"orderId"`
	ClientOrderID string `json:"clientOrderId"`
	Price         string `json:"price"`
	AvgPrice      string `json:"avgPrice"`
	OrigQty       string `json:"origQty"`
	ExecutedQty   string `json:"executedQty"`
	CumQuote      string `json:"cumQuote"`
	Status        string `json:"status"`
	TimeInForce   string `json:"timeInForce"`
	Type          string `json:"type"`
	OrigType      string `json:"origType"`
	Side          string `json:"side"`
	PositionSide  string `json:"positionSide"`
	StopPrice     string `json:"stopPrice"`
	ClosePosition bool   `json:"closePosition"`
	ReduceOnly    bool   `json:"reduceOnly"`
	WorkingType   string `json:"workingType"`
	UpdateTime    int64  `json:"updateTime"`
	Time          int64  `json:"time"`
}

type NewOrderParams struct {
	Symbol           string
	Side             OrderSide
	Type             OrderType
	PositionSide     PositionSide // BOTH, LONG, SHORT
	TimeInForce      TimeInForce
	Quantity         string
	Price            string
	StopPrice        string
	ReduceOnly       bool
	ClosePosition    bool
	ActivationPrice  string // trailing stop
	CallbackRate     string // trailing stop
	WorkingType      WorkingType
	NewClientOrderID string
}

type LeverageResponse struct {
	Leverage         int    `json:"leverage"`
	MaxNotionalValue string `json:"maxNotionalValue"`
	Symbol           string `json:"symbol"`
}

type LeverageBracket struct {
	Symbol   string `json:"symbol"`
	Brackets []struct {
		Bracket            int     `json:"bracket"`
		InitialLeverage    int     `json:"initialLeverage"`
		NotionalCap        float64 `json:"notionalCap"`
		NotionalFloor      float64 `json:"notionalFloor"`
		MaintMarginRatio   float64 `json:"maintMarginRatio"`
		Cum                float64 `json:"cum"`
	} `json:"brackets"`
}

type IncomeRecord struct {
	Symbol     string `json:"symbol"`
	IncomeType string `json:"incomeType"`
	Income     string `json:"income"`
	Asset      string `json:"asset"`
	Info       string `json:"info"`
	Time       int64  `json:"time"`
	TranID     string `json:"tranId"`
	TradeID    string `json:"tradeId"`
}

type TradeRecord struct {
	Symbol          string `json:"symbol"`
	ID              int64  `json:"id"`
	OrderID         int64  `json:"orderId"`
	Side            string `json:"side"`
	Price           string `json:"price"`
	Qty             string `json:"qty"`
	QuoteQty        string `json:"quoteQty"`
	Commission      string `json:"commission"`
	CommissionAsset string `json:"commissionAsset"`
	Time            int64  `json:"time"`
	PositionSide    string `json:"positionSide"`
	RealizedPnl     string `json:"realizedPnl"`
	Maker           bool   `json:"maker"`
	Buyer           bool   `json:"buyer"`
}

// ── Transfer Types ───────────────────────────────────────────────────

type TransferResponse struct {
	TranID int64  `json:"tranId"`
	Status string `json:"status"`
}

// ── Listen Key ───────────────────────────────────────────────────────

type ListenKeyResponse struct {
	ListenKey string `json:"listenKey"`
}

// ── API Error ────────────────────────────────────────────────────────

type APIError struct {
	Code int    `json:"code"`
	Msg  string `json:"msg"`
}

func (e *APIError) Error() string {
	return e.Msg
}
