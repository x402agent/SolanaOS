// Package hyperliquid provides a focused Hyperliquid perpetuals client for SolanaOS.
// The implementation is adapted from the upstream go-hyperliquid library while keeping
// a narrow surface area for bot account, market, and trading commands.
package hyperliquid

import "encoding/json"

// UserState is the perpetuals clearinghouse state for a wallet.
type UserState struct {
	MarginSummary struct {
		AccountValue    string `json:"accountValue"`
		TotalNtlPos     string `json:"totalNtlPos"`
		TotalRawUsd     string `json:"totalRawUsd"`
		TotalMarginUsed string `json:"totalMarginUsed"`
	} `json:"marginSummary"`
	CrossMarginSummary struct {
		AccountValue    string `json:"accountValue"`
		TotalNtlPos     string `json:"totalNtlPos"`
		TotalRawUsd     string `json:"totalRawUsd"`
		TotalMarginUsed string `json:"totalMarginUsed"`
	} `json:"crossMarginSummary"`
	AssetPositions []AssetPosition `json:"assetPositions"`
	Withdrawable   string          `json:"withdrawable"`
}

type AssetPosition struct {
	Position Position `json:"position"`
	Type     string   `json:"type"`
}

type Position struct {
	Coin           string      `json:"coin"`
	Szi            string      `json:"szi"`
	EntryPx        *string     `json:"entryPx"`
	PositionValue  string      `json:"positionValue"`
	UnrealizedPnl  string      `json:"unrealizedPnl"`
	ReturnOnEquity string      `json:"returnOnEquity"`
	Leverage       Leverage    `json:"leverage"`
	LiquidationPx  *string     `json:"liquidationPx,omitempty"`
	MarginUsed     string      `json:"marginUsed,omitempty"`
	CumFunding     *CumFunding `json:"cumFunding,omitempty"`
}

type Leverage struct {
	Type   string  `json:"type"`
	Value  int     `json:"value"`
	RawUsd *string `json:"rawUsd,omitempty"`
}

type CumFunding struct {
	AllTime     string `json:"allTime"`
	SinceChange string `json:"sinceChange"`
	SinceOpen   string `json:"sinceOpen"`
}

type OpenOrder struct {
	Coin      string  `json:"coin"`
	Side      string  `json:"side"`
	LimitPx   string  `json:"limitPx"`
	Sz        string  `json:"sz"`
	Oid       int64   `json:"oid"`
	Timestamp int64   `json:"timestamp"`
	Cloid     *string `json:"cloid,omitempty"`
}

type Fill struct {
	ClosedPnl     string `json:"closedPnl"`
	Coin          string `json:"coin"`
	Crossed       bool   `json:"crossed"`
	Dir           string `json:"dir"`
	Hash          string `json:"hash"`
	Oid           int64  `json:"oid"`
	Price         string `json:"px"`
	Side          string `json:"side"`
	StartPosition string `json:"startPosition"`
	Size          string `json:"sz"`
	Time          int64  `json:"time"`
	Fee           string `json:"fee"`
	FeeToken      string `json:"feeToken"`
	BuilderFee    string `json:"builderFee,omitempty"`
	Tid           int64  `json:"tid"`
}

type Candle struct {
	TimeOpen    int64  `json:"t"`
	TimeClose   int64  `json:"T"`
	Interval    string `json:"i"`
	TradesCount int    `json:"n"`
	Open        string `json:"o"`
	High        string `json:"h"`
	Low         string `json:"l"`
	Close       string `json:"c"`
	Symbol      string `json:"s"`
	Volume      string `json:"v"`
}

type MarketState struct {
	Coin         string
	MarkPx       string
	OraclePx     string
	MidPx        string
	Funding      string
	OpenInterest string
	DayNtlVlm    string
	PrevDayPx    string
	MaxLeverage  int
	SzDecimals   int
}

type OrderResult struct {
	Status        string
	Oid           int64
	AvgPx         string
	TotalSz       string
	ClientOrderID string
}

type orderWire struct {
	Asset      int           `msgpack:"a"`
	IsBuy      bool          `msgpack:"b"`
	LimitPx    string        `msgpack:"p"`
	Size       string        `msgpack:"s"`
	ReduceOnly bool          `msgpack:"r"`
	OrderType  orderWireType `msgpack:"t"`
}

type orderWireType struct {
	Limit *orderWireTypeLimit `msgpack:"limit,omitempty"`
}

type orderWireTypeLimit struct {
	Tif string `msgpack:"tif"`
}

type orderAction struct {
	Type     string      `msgpack:"type"`
	Orders   []orderWire `msgpack:"orders"`
	Grouping string      `msgpack:"grouping"`
}

type cancelWire struct {
	Asset   int   `msgpack:"a"`
	OrderID int64 `msgpack:"o"`
}

type cancelAction struct {
	Type    string       `msgpack:"type"`
	Cancels []cancelWire `msgpack:"cancels"`
}

type updateLeverageAction struct {
	Type     string `msgpack:"type"`
	Asset    int    `msgpack:"asset"`
	IsCross  bool   `msgpack:"isCross"`
	Leverage int    `msgpack:"leverage"`
}

type exchangeResponse struct {
	Status   string `json:"status"`
	Response struct {
		Type string `json:"type"`
		Data *struct {
			Statuses []orderStatus `json:"statuses"`
		} `json:"data,omitempty"`
	} `json:"response"`
}

type orderStatus struct {
	Resting *struct {
		Oid   int64   `json:"oid"`
		Cloid *string `json:"cloid,omitempty"`
	} `json:"resting,omitempty"`
	Filled *struct {
		TotalSz string `json:"totalSz"`
		AvgPx   string `json:"avgPx"`
		Oid     int64  `json:"oid"`
	} `json:"filled,omitempty"`
	Error *string `json:"error,omitempty"`
}

type cancelResponse struct {
	Statuses []json.RawMessage `json:"statuses"`
}

type signatureResult struct {
	R string `json:"r"`
	S string `json:"s"`
	V int    `json:"v"`
}

type metaAsset struct {
	Name        string `json:"name"`
	SzDecimals  int    `json:"szDecimals"`
	MaxLeverage int    `json:"maxLeverage,omitempty"`
}

type metaResponse struct {
	Universe []metaAsset `json:"universe"`
}

type assetCtx struct {
	Funding      string   `json:"funding"`
	OpenInterest string   `json:"openInterest"`
	PrevDayPx    string   `json:"prevDayPx"`
	DayNtlVlm    string   `json:"dayNtlVlm"`
	Premium      string   `json:"premium"`
	OraclePx     string   `json:"oraclePx"`
	MarkPx       string   `json:"markPx"`
	MidPx        string   `json:"midPx,omitempty"`
	ImpactPxs    []string `json:"impactPxs,omitempty"`
	DayBaseVlm   string   `json:"dayBaseVlm,omitempty"`
}
