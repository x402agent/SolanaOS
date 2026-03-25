package trading

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"time"

	"github.com/x402agent/Solana-Os-Go/pkg/memory"
)

// ---------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------

// Side represents long or short.
type Side string

const (
	SideLong  Side = "long"
	SideShort Side = "short"
)

// OrderType represents the order execution type.
type OrderType string

const (
	OrderMarket OrderType = "market"
	OrderLimit  OrderType = "limit"
)

// Position represents an open perpetual position.
type Position struct {
	Symbol       string  `json:"symbol"`
	Side         Side    `json:"side"`
	Size         float64 `json:"size"`
	EntryPrice   float64 `json:"entry_price"`
	MarkPrice    float64 `json:"mark_price"`
	UnrealizedPL float64 `json:"unrealized_pnl"`
	Leverage     float64 `json:"leverage"`
	LiqPrice     float64 `json:"liquidation_price"`
	Exchange     string  `json:"exchange"` // "hyperliquid" or "aster"
}

// OrderRequest is a unified order request across exchanges.
type OrderRequest struct {
	Symbol    string    `json:"symbol"`
	Side      Side      `json:"side"`
	Size      float64   `json:"size"`
	OrderType OrderType `json:"order_type"`
	Price     float64   `json:"price,omitempty"` // for limit orders
	Leverage  float64   `json:"leverage"`
	StopLoss  float64   `json:"stop_loss,omitempty"`
	TakeProfit float64  `json:"take_profit,omitempty"`
	Reduce    bool      `json:"reduce_only,omitempty"`
}

// OrderResult captures the outcome of an order.
type OrderResult struct {
	OrderID    string    `json:"order_id"`
	Symbol     string    `json:"symbol"`
	Side       Side      `json:"side"`
	Size       float64   `json:"size"`
	Price      float64   `json:"price"`
	Status     string    `json:"status"`
	Exchange   string    `json:"exchange"`
	Timestamp  time.Time `json:"timestamp"`
}

// AccountInfo holds balance and margin information.
type AccountInfo struct {
	TotalEquity     float64 `json:"total_equity"`
	AvailableMargin float64 `json:"available_margin"`
	UsedMargin      float64 `json:"used_margin"`
	UnrealizedPL    float64 `json:"unrealized_pnl"`
	Exchange        string  `json:"exchange"`
}

// Candle represents OHLCV data.
type Candle struct {
	Time   int64   `json:"time"`
	Open   float64 `json:"open"`
	High   float64 `json:"high"`
	Low    float64 `json:"low"`
	Close  float64 `json:"close"`
	Volume float64 `json:"volume"`
}

// RiskLimits defines the operator's risk boundaries.
type RiskLimits struct {
	MaxPositionUSD  float64
	MaxLeverage     float64
	StopLossPercent float64
	DefaultSlippage float64
}

// ---------------------------------------------------------------------
// Exchange interface
// ---------------------------------------------------------------------

// Exchange is the unified interface for perp trading backends.
type Exchange interface {
	Name() string
	GetAccount(ctx context.Context) (*AccountInfo, error)
	GetPositions(ctx context.Context) ([]Position, error)
	PlaceOrder(ctx context.Context, req OrderRequest) (*OrderResult, error)
	ClosePosition(ctx context.Context, symbol string) (*OrderResult, error)
	GetCandles(ctx context.Context, symbol string, interval string, limit int) ([]Candle, error)
}

// ---------------------------------------------------------------------
// Hyperliquid client
// ---------------------------------------------------------------------

// HyperliquidClient implements the Exchange interface for Hyperliquid.
type HyperliquidClient struct {
	baseURL    string
	privateKey string
	httpClient *http.Client
	logger     *slog.Logger
}

// NewHyperliquidClient creates a Hyperliquid perp client.
func NewHyperliquidClient(baseURL, privateKey string, logger *slog.Logger) *HyperliquidClient {
	return &HyperliquidClient{
		baseURL:    baseURL,
		privateKey: privateKey,
		httpClient: &http.Client{Timeout: 15 * time.Second},
		logger:     logger,
	}
}

func (h *HyperliquidClient) Name() string { return "hyperliquid" }

func (h *HyperliquidClient) GetAccount(ctx context.Context) (*AccountInfo, error) {
	var resp struct {
		MarginSummary struct {
			AccountValue    string `json:"accountValue"`
			TotalMarginUsed string `json:"totalMarginUsed"`
		} `json:"marginSummary"`
	}
	err := h.infoPost(ctx, map[string]any{
		"type": "clearinghouseState",
		"user": h.walletAddress(),
	}, &resp)
	if err != nil {
		return nil, fmt.Errorf("hl_get_account: %w", err)
	}
	equity := parseFloat(resp.MarginSummary.AccountValue)
	used := parseFloat(resp.MarginSummary.TotalMarginUsed)
	return &AccountInfo{
		TotalEquity:     equity,
		UsedMargin:      used,
		AvailableMargin: equity - used,
		Exchange:        "hyperliquid",
	}, nil
}

func (h *HyperliquidClient) GetPositions(ctx context.Context) ([]Position, error) {
	var resp struct {
		AssetPositions []struct {
			Position struct {
				Coin           string `json:"coin"`
				Szi            string `json:"szi"`
				EntryPx        string `json:"entryPx"`
				PositionValue  string `json:"positionValue"`
				UnrealizedPnl  string `json:"unrealizedPnl"`
				Leverage       struct {
					Value string `json:"value"`
				} `json:"leverage"`
				LiquidationPx string `json:"liquidationPx"`
			} `json:"position"`
		} `json:"assetPositions"`
	}
	err := h.infoPost(ctx, map[string]any{
		"type": "clearinghouseState",
		"user": h.walletAddress(),
	}, &resp)
	if err != nil {
		return nil, fmt.Errorf("hl_get_positions: %w", err)
	}

	var positions []Position
	for _, ap := range resp.AssetPositions {
		p := ap.Position
		size := parseFloat(p.Szi)
		if size == 0 {
			continue
		}
		side := SideLong
		if size < 0 {
			side = SideShort
			size = -size
		}
		positions = append(positions, Position{
			Symbol:       p.Coin,
			Side:         side,
			Size:         size,
			EntryPrice:   parseFloat(p.EntryPx),
			UnrealizedPL: parseFloat(p.UnrealizedPnl),
			Leverage:     parseFloat(p.Leverage.Value),
			LiqPrice:     parseFloat(p.LiquidationPx),
			Exchange:     "hyperliquid",
		})
	}
	return positions, nil
}

func (h *HyperliquidClient) PlaceOrder(ctx context.Context, req OrderRequest) (*OrderResult, error) {
	h.logger.Info("hl_place_order",
		"symbol", req.Symbol,
		"side", req.Side,
		"size", req.Size,
		"leverage", req.Leverage,
	)
	// NOTE: Production implementation requires EIP-712 signing with the private key.
	// This is the order construction — signing omitted for CGO_ENABLED=0 builds.
	return &OrderResult{
		Symbol:    req.Symbol,
		Side:      req.Side,
		Size:      req.Size,
		Exchange:  "hyperliquid",
		Status:    "simulated",
		Timestamp: time.Now(),
	}, nil
}

func (h *HyperliquidClient) ClosePosition(ctx context.Context, symbol string) (*OrderResult, error) {
	positions, err := h.GetPositions(ctx)
	if err != nil {
		return nil, err
	}
	for _, p := range positions {
		if p.Symbol == symbol {
			closeSide := SideShort
			if p.Side == SideShort {
				closeSide = SideLong
			}
			return h.PlaceOrder(ctx, OrderRequest{
				Symbol:    symbol,
				Side:      closeSide,
				Size:      p.Size,
				OrderType: OrderMarket,
				Reduce:    true,
			})
		}
	}
	return nil, fmt.Errorf("no open position for %s", symbol)
}

func (h *HyperliquidClient) GetCandles(ctx context.Context, symbol string, interval string, limit int) ([]Candle, error) {
	var resp [][]any
	err := h.infoPost(ctx, map[string]any{
		"type":     "candleSnapshot",
		"coin":     symbol,
		"interval": interval,
		"startTime": time.Now().Add(-24 * time.Hour).UnixMilli(),
	}, &resp)
	if err != nil {
		return nil, fmt.Errorf("hl_get_candles: %w", err)
	}
	var candles []Candle
	for _, r := range resp {
		if len(r) < 6 {
			continue
		}
		candles = append(candles, Candle{
			Time:   int64(toFloat(r[0])),
			Open:   toFloat(r[1]),
			High:   toFloat(r[2]),
			Low:    toFloat(r[3]),
			Close:  toFloat(r[4]),
			Volume: toFloat(r[5]),
		})
	}
	return candles, nil
}

func (h *HyperliquidClient) walletAddress() string {
	// Derive address from private key — placeholder
	return "0x" + h.privateKey[:40]
}

func (h *HyperliquidClient) infoPost(ctx context.Context, body any, out any) error {
	data, err := json.Marshal(body)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, h.baseURL+"/info", bytes.NewReader(data))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := h.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return fmt.Errorf("hl info %d: %s", resp.StatusCode, string(respBody))
	}
	return json.Unmarshal(respBody, out)
}

// ---------------------------------------------------------------------
// Aster client
// ---------------------------------------------------------------------

// AsterClient implements the Exchange interface for Aster Finance.
type AsterClient struct {
	baseURL    string
	apiKey     string
	secretKey  string
	httpClient *http.Client
	logger     *slog.Logger
}

// NewAsterClient creates an Aster perp client.
func NewAsterClient(baseURL, apiKey, secretKey string, logger *slog.Logger) *AsterClient {
	return &AsterClient{
		baseURL:    baseURL,
		apiKey:     apiKey,
		secretKey:  secretKey,
		httpClient: &http.Client{Timeout: 15 * time.Second},
		logger:     logger,
	}
}

func (a *AsterClient) Name() string { return "aster" }

func (a *AsterClient) GetAccount(ctx context.Context) (*AccountInfo, error) {
	var resp struct {
		TotalEquity     float64 `json:"totalEquity"`
		AvailableMargin float64 `json:"availableMargin"`
		UsedMargin      float64 `json:"usedMargin"`
		UnrealizedPnl   float64 `json:"unrealizedPnl"`
	}
	if err := a.signedGet(ctx, "/api/v1/account", &resp); err != nil {
		return nil, fmt.Errorf("aster_get_account: %w", err)
	}
	return &AccountInfo{
		TotalEquity:     resp.TotalEquity,
		AvailableMargin: resp.AvailableMargin,
		UsedMargin:      resp.UsedMargin,
		UnrealizedPL:    resp.UnrealizedPnl,
		Exchange:        "aster",
	}, nil
}

func (a *AsterClient) GetPositions(ctx context.Context) ([]Position, error) {
	var resp []struct {
		Symbol       string  `json:"symbol"`
		Side         string  `json:"positionSide"`
		Amount       float64 `json:"positionAmount"`
		EntryPrice   float64 `json:"entryPrice"`
		MarkPrice    float64 `json:"markPrice"`
		Unrealized   float64 `json:"unrealizedProfit"`
		Leverage     float64 `json:"leverage"`
		LiqPrice     float64 `json:"liquidationPrice"`
	}
	if err := a.signedGet(ctx, "/api/v1/positions", &resp); err != nil {
		return nil, fmt.Errorf("aster_get_positions: %w", err)
	}
	var positions []Position
	for _, p := range resp {
		if p.Amount == 0 {
			continue
		}
		side := SideLong
		if p.Side == "SHORT" || p.Amount < 0 {
			side = SideShort
		}
		positions = append(positions, Position{
			Symbol:       p.Symbol,
			Side:         side,
			Size:         abs(p.Amount),
			EntryPrice:   p.EntryPrice,
			MarkPrice:    p.MarkPrice,
			UnrealizedPL: p.Unrealized,
			Leverage:     p.Leverage,
			LiqPrice:     p.LiqPrice,
			Exchange:     "aster",
		})
	}
	return positions, nil
}

func (a *AsterClient) PlaceOrder(ctx context.Context, req OrderRequest) (*OrderResult, error) {
	a.logger.Info("aster_place_order",
		"symbol", req.Symbol,
		"side", req.Side,
		"size", req.Size,
		"leverage", req.Leverage,
	)
	// NOTE: Production implementation requires HMAC-SHA256 signing.
	return &OrderResult{
		Symbol:    req.Symbol,
		Side:      req.Side,
		Size:      req.Size,
		Exchange:  "aster",
		Status:    "simulated",
		Timestamp: time.Now(),
	}, nil
}

func (a *AsterClient) ClosePosition(ctx context.Context, symbol string) (*OrderResult, error) {
	positions, err := a.GetPositions(ctx)
	if err != nil {
		return nil, err
	}
	for _, p := range positions {
		if p.Symbol == symbol {
			closeSide := SideShort
			if p.Side == SideShort {
				closeSide = SideLong
			}
			return a.PlaceOrder(ctx, OrderRequest{
				Symbol:    symbol,
				Side:      closeSide,
				Size:      p.Size,
				OrderType: OrderMarket,
				Reduce:    true,
			})
		}
	}
	return nil, fmt.Errorf("no open position for %s", symbol)
}

func (a *AsterClient) GetCandles(ctx context.Context, symbol string, interval string, limit int) ([]Candle, error) {
	// Aster kline endpoint
	return nil, fmt.Errorf("aster candles not implemented")
}

func (a *AsterClient) signedGet(ctx context.Context, path string, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, a.baseURL+path, nil)
	if err != nil {
		return err
	}
	req.Header.Set("X-API-KEY", a.apiKey)
	// Production: add HMAC signature header
	resp, err := a.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return fmt.Errorf("aster %d: %s", resp.StatusCode, string(body))
	}
	return json.Unmarshal(body, out)
}

// ---------------------------------------------------------------------
// TradingEngine — unified facade with memory persistence
// ---------------------------------------------------------------------

// TradingEngine wraps exchanges with risk limits and memory persistence.
type TradingEngine struct {
	exchanges map[string]Exchange
	limits    RiskLimits
	vault     memory.Vault
	logger    *slog.Logger
}

// NewTradingEngine creates a unified trading engine.
func NewTradingEngine(vault memory.Vault, limits RiskLimits, logger *slog.Logger) *TradingEngine {
	return &TradingEngine{
		exchanges: make(map[string]Exchange),
		limits:    limits,
		vault:     vault,
		logger:    logger,
	}
}

// RegisterExchange adds an exchange backend.
func (te *TradingEngine) RegisterExchange(ex Exchange) {
	te.exchanges[ex.Name()] = ex
}

// GetExchange retrieves an exchange by name.
func (te *TradingEngine) GetExchange(name string) (Exchange, bool) {
	ex, ok := te.exchanges[name]
	return ex, ok
}

// AllPositions returns positions across all exchanges.
func (te *TradingEngine) AllPositions(ctx context.Context) ([]Position, error) {
	var all []Position
	for _, ex := range te.exchanges {
		positions, err := ex.GetPositions(ctx)
		if err != nil {
			te.logger.Error("get_positions_failed", "exchange", ex.Name(), "error", err)
			continue
		}
		all = append(all, positions...)
	}
	return all, nil
}

// ExecuteOrder places an order with risk validation and memory persistence.
func (te *TradingEngine) ExecuteOrder(ctx context.Context, cs *memory.ChannelSession, exchange string, req OrderRequest) (*OrderResult, error) {
	// Validate risk limits
	if req.Size*req.Price > te.limits.MaxPositionUSD {
		return nil, fmt.Errorf("position size $%.2f exceeds max $%.2f", req.Size*req.Price, te.limits.MaxPositionUSD)
	}
	if req.Leverage > te.limits.MaxLeverage {
		return nil, fmt.Errorf("leverage %.1fx exceeds max %.1fx", req.Leverage, te.limits.MaxLeverage)
	}

	ex, ok := te.exchanges[exchange]
	if !ok {
		return nil, fmt.Errorf("exchange %s not registered", exchange)
	}

	// Execute
	result, err := ex.PlaceOrder(ctx, req)
	if err != nil {
		// Persist failure
		_ = te.vault.StoreTradingEvent(ctx, cs, "order_failed", map[string]any{
			"exchange": exchange,
			"symbol":   req.Symbol,
			"side":     string(req.Side),
			"size":     req.Size,
			"error":    err.Error(),
		})
		return nil, fmt.Errorf("order failed on %s: %w", exchange, err)
	}

	// Persist success to memory — this triggers Honcho reasoning about trading patterns
	_ = te.vault.StoreTradingEvent(ctx, cs, "order_placed", map[string]any{
		"exchange":  exchange,
		"symbol":    result.Symbol,
		"side":      string(result.Side),
		"size":      result.Size,
		"price":     result.Price,
		"order_id":  result.OrderID,
		"status":    result.Status,
		"leverage":  req.Leverage,
		"stop_loss": req.StopLoss,
	})

	te.logger.Info("order_executed",
		"exchange", exchange,
		"symbol", result.Symbol,
		"side", result.Side,
		"size", result.Size,
		"status", result.Status,
	)
	return result, nil
}

// ClosePosition closes a position and persists the event.
func (te *TradingEngine) ClosePosition(ctx context.Context, cs *memory.ChannelSession, exchange, symbol string) (*OrderResult, error) {
	ex, ok := te.exchanges[exchange]
	if !ok {
		return nil, fmt.Errorf("exchange %s not registered", exchange)
	}
	result, err := ex.ClosePosition(ctx, symbol)
	if err != nil {
		return nil, err
	}
	_ = te.vault.StoreTradingEvent(ctx, cs, "position_closed", map[string]any{
		"exchange": exchange,
		"symbol":   symbol,
		"side":     string(result.Side),
		"size":     result.Size,
	})
	return result, nil
}

// Exchanges returns all registered exchange backends.
func (te *TradingEngine) Exchanges() map[string]Exchange {
	return te.exchanges
}

// --- helpers ---

func parseFloat(s string) float64 {
	var f float64
	fmt.Sscanf(s, "%f", &f)
	return f
}

func toFloat(v any) float64 {
	switch x := v.(type) {
	case float64:
		return x
	case string:
		return parseFloat(x)
	default:
		return 0
	}
}

func abs(f float64) float64 {
	if f < 0 {
		return -f
	}
	return f
}
