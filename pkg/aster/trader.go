// Package aster :: trader.go
// Autonomous perpetual futures trader for MawdBot.
//
// This module provides high-level trading operations that combine
// the low-level Aster client with risk management, position sizing,
// and signal-based execution.
//
// Flow:
//   Signal → Validate → Size → Execute → Monitor → Record
package aster

import (
	"context"
	"fmt"
	"math"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/x402agent/Solana-Os-Go/pkg/logger"
	"github.com/x402agent/Solana-Os-Go/pkg/memory"
)

// ── TraderConfig ─────────────────────────────────────────────────────

type TraderConfig struct {
	Client          *Client
	Vault           *memory.ClawVault
	MemEngine       *memory.MemoryEngine
	DefaultLeverage int
	MaxPositions    int
	MaxPositionPct  float64 // max % of balance per position
	MinNotional     float64 // min order value in USD
	StopLossPct     float64 // default stop loss %
	TakeProfitPct   float64 // default take profit %
	DryRun          bool    // simulate only, no real orders
}

// ── PerpTrader ───────────────────────────────────────────────────────

type PerpTrader struct {
	client          *Client
	vault           *memory.ClawVault
	memEngine       *memory.MemoryEngine
	defaultLeverage int
	maxPositions    int
	maxPositionPct  float64
	minNotional     float64
	stopLossPct     float64
	takeProfitPct   float64
	dryRun          bool

	mu              sync.Mutex
	activePositions map[string]*ManagedPosition
}

// ManagedPosition tracks an open perp position with risk params.
type ManagedPosition struct {
	Symbol       string    `json:"symbol"`
	Side         OrderSide `json:"side"`
	EntryPrice   float64   `json:"entry_price"`
	Quantity     float64   `json:"quantity"`
	Leverage     int       `json:"leverage"`
	StopLoss     float64   `json:"stop_loss"`
	TakeProfit   float64   `json:"take_profit"`
	OrderID      int64     `json:"order_id"`
	StopOrderID  int64     `json:"stop_order_id"`
	TPOrderID    int64     `json:"tp_order_id"`
	OpenedAt     time.Time `json:"opened_at"`
	Thesis       string    `json:"thesis"`
	Confidence   float64   `json:"confidence"`
	SignalSource string    `json:"signal_source"`
}

// TradeSignal represents a trading signal from the agent.
type TradeSignal struct {
	Symbol       string    `json:"symbol"`
	Side         OrderSide `json:"side"` // BUY or SELL
	Confidence   float64   `json:"confidence"`
	SignalSource string    `json:"signal_source"`
	Thesis       string    `json:"thesis"`
	EntryPrice   float64   `json:"entry_price,omitempty"` // 0 = market
	StopLoss     float64   `json:"stop_loss,omitempty"`
	TakeProfit   float64   `json:"take_profit,omitempty"`
	Leverage     int       `json:"leverage,omitempty"`
	SizePct      float64   `json:"size_pct,omitempty"` // override position size %
}

// TradeResult captures the outcome of a trade execution.
type TradeResult struct {
	Success     bool    `json:"success"`
	DryRun      bool    `json:"dry_run"`
	Symbol      string  `json:"symbol"`
	Side        string  `json:"side"`
	Quantity    string  `json:"quantity"`
	EntryPrice  string  `json:"entry_price"`
	StopLoss    float64 `json:"stop_loss"`
	TakeProfit  float64 `json:"take_profit"`
	Leverage    int     `json:"leverage"`
	OrderID     int64   `json:"order_id"`
	StopOrderID int64   `json:"stop_order_id"`
	TPOrderID   int64   `json:"tp_order_id"`
	Error       string  `json:"error,omitempty"`
	Thesis      string  `json:"thesis"`
}

// ── Constructor ──────────────────────────────────────────────────────

func NewPerpTrader(cfg TraderConfig) *PerpTrader {
	if cfg.DefaultLeverage <= 0 {
		cfg.DefaultLeverage = 5
	}
	if cfg.MaxPositions <= 0 {
		cfg.MaxPositions = 5
	}
	if cfg.MaxPositionPct <= 0 {
		cfg.MaxPositionPct = 0.10
	}
	if cfg.MinNotional <= 0 {
		cfg.MinNotional = 5.0
	}
	if cfg.StopLossPct <= 0 {
		cfg.StopLossPct = 0.08
	}
	if cfg.TakeProfitPct <= 0 {
		cfg.TakeProfitPct = 0.20
	}

	return &PerpTrader{
		client:          cfg.Client,
		vault:           cfg.Vault,
		memEngine:       cfg.MemEngine,
		defaultLeverage: cfg.DefaultLeverage,
		maxPositions:    cfg.MaxPositions,
		maxPositionPct:  cfg.MaxPositionPct,
		minNotional:     cfg.MinNotional,
		stopLossPct:     cfg.StopLossPct,
		takeProfitPct:   cfg.TakeProfitPct,
		dryRun:          cfg.DryRun,
		activePositions: make(map[string]*ManagedPosition),
	}
}

// ═══════════════════════════════════════════════════════════════════════
// EXECUTE SIGNAL
// ═══════════════════════════════════════════════════════════════════════

// ExecuteSignal takes a trading signal and executes it end-to-end.
func (t *PerpTrader) ExecuteSignal(_ context.Context, signal TradeSignal) TradeResult {
	t.mu.Lock()
	defer t.mu.Unlock()

	result := TradeResult{
		Symbol: signal.Symbol,
		Side:   string(signal.Side),
		Thesis: signal.Thesis,
	}

	// ── Validation ───────────────────────────────────────────────
	if signal.Confidence < 0.60 {
		result.Error = fmt.Sprintf("confidence %.2f below 0.60 threshold", signal.Confidence)
		t.logTrade("REJECTED", signal, result)
		return result
	}

	if len(t.activePositions) >= t.maxPositions {
		result.Error = fmt.Sprintf("max positions reached (%d)", t.maxPositions)
		t.logTrade("REJECTED", signal, result)
		return result
	}

	if _, exists := t.activePositions[signal.Symbol]; exists {
		result.Error = fmt.Sprintf("already has position in %s", signal.Symbol)
		t.logTrade("REJECTED", signal, result)
		return result
	}

	// ── Get current price ────────────────────────────────────────
	markPrices, err := t.client.FutMarkPrice(signal.Symbol)
	if err != nil {
		result.Error = fmt.Sprintf("failed to get mark price: %v", err)
		t.logTrade("ERROR", signal, result)
		return result
	}
	if len(markPrices) == 0 {
		result.Error = "no mark price data"
		t.logTrade("ERROR", signal, result)
		return result
	}

	markPrice, _ := strconv.ParseFloat(markPrices[0].MarkPrice, 64)
	if markPrice <= 0 {
		result.Error = "invalid mark price"
		t.logTrade("ERROR", signal, result)
		return result
	}

	// ── Calculate position size ──────────────────────────────────
	sizePct := t.maxPositionPct
	if signal.SizePct > 0 && signal.SizePct <= t.maxPositionPct {
		sizePct = signal.SizePct
	}

	leverage := t.defaultLeverage
	if signal.Leverage > 0 && signal.Leverage <= 125 {
		leverage = signal.Leverage
	}

	availableBalance, err := t.getAvailableBalance()
	if err != nil {
		result.Error = fmt.Sprintf("failed to get balance: %v", err)
		t.logTrade("ERROR", signal, result)
		return result
	}

	// Position size: available * sizePct * leverage
	notional := availableBalance * sizePct * float64(leverage)
	if notional < t.minNotional {
		result.Error = fmt.Sprintf("notional $%.2f below min $%.2f", notional, t.minNotional)
		t.logTrade("REJECTED", signal, result)
		return result
	}

	quantity := notional / markPrice

	// ── Get symbol precision ─────────────────────────────────────
	qtyPrec, pricePrec := t.getSymbolPrecision(signal.Symbol)
	qtyStr := formatFloat(quantity, qtyPrec)
	result.Quantity = qtyStr

	// ── Stop loss / take profit ──────────────────────────────────
	slPct := t.stopLossPct
	if signal.StopLoss > 0 {
		slPct = 0 // use absolute price
	}
	tpPct := t.takeProfitPct
	if signal.TakeProfit > 0 {
		tpPct = 0
	}

	var stopLoss, takeProfit float64
	if signal.Side == SideBuy {
		if signal.StopLoss > 0 {
			stopLoss = signal.StopLoss
		} else {
			stopLoss = markPrice * (1 - slPct)
		}
		if signal.TakeProfit > 0 {
			takeProfit = signal.TakeProfit
		} else {
			takeProfit = markPrice * (1 + tpPct)
		}
	} else {
		if signal.StopLoss > 0 {
			stopLoss = signal.StopLoss
		} else {
			stopLoss = markPrice * (1 + slPct)
		}
		if signal.TakeProfit > 0 {
			takeProfit = signal.TakeProfit
		} else {
			takeProfit = markPrice * (1 - tpPct)
		}
	}
	result.StopLoss = stopLoss
	result.TakeProfit = takeProfit
	result.Leverage = leverage
	result.EntryPrice = formatFloat(markPrice, pricePrec)

	// ── DRY RUN ──────────────────────────────────────────────────
	if t.dryRun {
		result.Success = true
		result.DryRun = true
		t.logTrade("SIMULATED", signal, result)
		t.recordToVault(signal, result)
		return result
	}

	// ── Set leverage ─────────────────────────────────────────────
	_, err = t.client.FutChangeLeverage(signal.Symbol, leverage)
	if err != nil {
		logger.WarnCF("aster", "leverage change failed (may be already set)", map[string]any{
			"symbol": signal.Symbol, "leverage": leverage, "error": err.Error(),
		})
	}

	// ── Place main order (MARKET) ────────────────────────────────
	order, err := t.client.FutNewOrder(NewOrderParams{
		Symbol:   signal.Symbol,
		Side:     signal.Side,
		Type:     OrderMarket,
		Quantity: qtyStr,
	})
	if err != nil {
		result.Error = fmt.Sprintf("order failed: %v", err)
		t.logTrade("FAILED", signal, result)
		return result
	}
	result.OrderID = order.OrderID
	result.Success = true

	if order.AvgPrice != "" && order.AvgPrice != "0" && order.AvgPrice != "0.00000000" {
		result.EntryPrice = order.AvgPrice
	}

	// ── Place stop loss ──────────────────────────────────────────
	slSide := SideSell
	if signal.Side == SideSell {
		slSide = SideBuy
	}

	slOrder, err := t.client.FutNewOrder(NewOrderParams{
		Symbol:     signal.Symbol,
		Side:       slSide,
		Type:       OrderStopMarket,
		StopPrice:  formatFloat(stopLoss, pricePrec),
		Quantity:   qtyStr,
		ReduceOnly: true,
	})
	if err != nil {
		logger.WarnCF("aster", "stop-loss order failed", map[string]any{
			"symbol": signal.Symbol, "error": err.Error(),
		})
	} else {
		result.StopOrderID = slOrder.OrderID
	}

	// ── Place take profit ────────────────────────────────────────
	tpOrder, err := t.client.FutNewOrder(NewOrderParams{
		Symbol:     signal.Symbol,
		Side:       slSide,
		Type:       OrderTakeProfitMarket,
		StopPrice:  formatFloat(takeProfit, pricePrec),
		Quantity:   qtyStr,
		ReduceOnly: true,
	})
	if err != nil {
		logger.WarnCF("aster", "take-profit order failed", map[string]any{
			"symbol": signal.Symbol, "error": err.Error(),
		})
	} else {
		result.TPOrderID = tpOrder.OrderID
	}

	// ── Track position ───────────────────────────────────────────
	entryF, _ := strconv.ParseFloat(result.EntryPrice, 64)
	qtyF, _ := strconv.ParseFloat(qtyStr, 64)

	t.activePositions[signal.Symbol] = &ManagedPosition{
		Symbol:       signal.Symbol,
		Side:         signal.Side,
		EntryPrice:   entryF,
		Quantity:     qtyF,
		Leverage:     leverage,
		StopLoss:     stopLoss,
		TakeProfit:   takeProfit,
		OrderID:      order.OrderID,
		StopOrderID:  result.StopOrderID,
		TPOrderID:    result.TPOrderID,
		OpenedAt:     time.Now(),
		Thesis:       signal.Thesis,
		Confidence:   signal.Confidence,
		SignalSource: signal.SignalSource,
	}

	t.logTrade("EXECUTED", signal, result)
	t.recordToVault(signal, result)

	return result
}

// ═══════════════════════════════════════════════════════════════════════
// POSITION MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════

// ClosePosition closes a managed position at market.
func (t *PerpTrader) ClosePosition(_ context.Context, symbol string, reason string) (*TradeResult, error) {
	t.mu.Lock()
	pos, exists := t.activePositions[symbol]
	if !exists {
		t.mu.Unlock()
		return nil, fmt.Errorf("no managed position for %s", symbol)
	}
	t.mu.Unlock()

	// Cancel SL/TP orders
	if pos.StopOrderID > 0 {
		t.client.FutCancelOrder(symbol, pos.StopOrderID, "")
	}
	if pos.TPOrderID > 0 {
		t.client.FutCancelOrder(symbol, pos.TPOrderID, "")
	}

	// Close at market
	closeSide := SideSell
	if pos.Side == SideSell {
		closeSide = SideBuy
	}

	qtyStr := formatFloat(pos.Quantity, 8)

	if !t.dryRun {
		_, err := t.client.FutNewOrder(NewOrderParams{
			Symbol:     symbol,
			Side:       closeSide,
			Type:       OrderMarket,
			Quantity:   qtyStr,
			ReduceOnly: true,
		})
		if err != nil {
			return nil, fmt.Errorf("close order failed: %w", err)
		}
	}

	// Calculate P&L
	currentPrice := 0.0
	if markPrices, err := t.client.FutMarkPrice(symbol); err == nil && len(markPrices) > 0 {
		currentPrice, _ = strconv.ParseFloat(markPrices[0].MarkPrice, 64)
	}

	pnl := 0.0
	if currentPrice > 0 {
		if pos.Side == SideBuy {
			pnl = (currentPrice - pos.EntryPrice) * pos.Quantity
		} else {
			pnl = (pos.EntryPrice - currentPrice) * pos.Quantity
		}
	}

	t.mu.Lock()
	delete(t.activePositions, symbol)
	t.mu.Unlock()

	result := &TradeResult{
		Success:    true,
		DryRun:     t.dryRun,
		Symbol:     symbol,
		Side:       string(closeSide),
		Quantity:   qtyStr,
		EntryPrice: formatFloat(pos.EntryPrice, 8),
		Thesis:     fmt.Sprintf("CLOSE: %s | PnL: $%.2f | Reason: %s", pos.Thesis, pnl, reason),
	}

	// Record to vault
	outcome := "neutral"
	if pnl > 0 {
		outcome = "win"
	} else if pnl < 0 {
		outcome = "loss"
	}

	if t.vault != nil {
		t.vault.RecordTrade(memory.TradeRecordInput{
			Token:      symbol,
			Side:       string(closeSide),
			Size:       pos.Quantity,
			EntryPrice: pos.EntryPrice,
			ExitPrice:  currentPrice,
			PnlUSD:     pnl,
			Rationale:  reason,
			Signals:    map[string]any{"source": pos.SignalSource},
			Outcome:    outcome,
		})
	}

	logger.InfoCF("aster", fmt.Sprintf("Position CLOSED: %s PnL=$%.2f", symbol, pnl), map[string]any{
		"reason": reason, "entry": pos.EntryPrice, "exit": currentPrice,
	})

	return result, nil
}

// GetActivePositions returns a copy of all managed positions.
func (t *PerpTrader) GetActivePositions() map[string]ManagedPosition {
	t.mu.Lock()
	defer t.mu.Unlock()
	result := make(map[string]ManagedPosition, len(t.activePositions))
	for k, v := range t.activePositions {
		result[k] = *v
	}
	return result
}

// SyncPositions reconciles managed positions with actual exchange positions.
func (t *PerpTrader) SyncPositions(_ context.Context) error {
	positions, err := t.client.FutPositionRisk("")
	if err != nil {
		return err
	}

	t.mu.Lock()
	defer t.mu.Unlock()

	for _, pos := range positions {
		amt, _ := strconv.ParseFloat(pos.PositionAmt, 64)
		if math.Abs(amt) < 1e-10 {
			// Position closed on exchange, remove from managed
			delete(t.activePositions, pos.Symbol)
			continue
		}

		if _, tracked := t.activePositions[pos.Symbol]; !tracked {
			// Untracked position found on exchange
			entry, _ := strconv.ParseFloat(pos.EntryPrice, 64)
			lev, _ := strconv.Atoi(pos.Leverage)
			side := SideBuy
			if amt < 0 {
				side = SideSell
				amt = -amt
			}
			t.activePositions[pos.Symbol] = &ManagedPosition{
				Symbol:     pos.Symbol,
				Side:       side,
				EntryPrice: entry,
				Quantity:   amt,
				Leverage:   lev,
				OpenedAt:   time.Now(),
				Thesis:     "synced from exchange",
			}
			logger.InfoCF("aster", fmt.Sprintf("Synced untracked position: %s %s %.4f @ %.2f",
				pos.Symbol, side, amt, entry), nil)
		}
	}
	return nil
}

// ═══════════════════════════════════════════════════════════════════════
// MONITORING
// ═══════════════════════════════════════════════════════════════════════

// CheckPositions monitors all positions and closes if SL/TP hit.
// Call this periodically (e.g., every 30s) as a safety net.
func (t *PerpTrader) CheckPositions(ctx context.Context) {
	t.mu.Lock()
	symbols := make([]string, 0, len(t.activePositions))
	for s := range t.activePositions {
		symbols = append(symbols, s)
	}
	t.mu.Unlock()

	for _, symbol := range symbols {
		markPrices, err := t.client.FutMarkPrice(symbol)
		if err != nil || len(markPrices) == 0 {
			continue
		}
		currentPrice, _ := strconv.ParseFloat(markPrices[0].MarkPrice, 64)
		if currentPrice <= 0 {
			continue
		}

		t.mu.Lock()
		pos, exists := t.activePositions[symbol]
		t.mu.Unlock()
		if !exists {
			continue
		}

		// Check manual SL/TP (safety net if exchange orders didn't fire)
		shouldClose := false
		reason := ""

		if pos.Side == SideBuy {
			if pos.StopLoss > 0 && currentPrice <= pos.StopLoss {
				shouldClose = true
				reason = fmt.Sprintf("stop-loss hit (%.2f <= %.2f)", currentPrice, pos.StopLoss)
			}
			if pos.TakeProfit > 0 && currentPrice >= pos.TakeProfit {
				shouldClose = true
				reason = fmt.Sprintf("take-profit hit (%.2f >= %.2f)", currentPrice, pos.TakeProfit)
			}
		} else {
			if pos.StopLoss > 0 && currentPrice >= pos.StopLoss {
				shouldClose = true
				reason = fmt.Sprintf("stop-loss hit (%.2f >= %.2f)", currentPrice, pos.StopLoss)
			}
			if pos.TakeProfit > 0 && currentPrice <= pos.TakeProfit {
				shouldClose = true
				reason = fmt.Sprintf("take-profit hit (%.2f <= %.2f)", currentPrice, pos.TakeProfit)
			}
		}

		if shouldClose {
			logger.WarnCF("aster", fmt.Sprintf("Safety net triggered: %s — %s", symbol, reason), nil)
			t.ClosePosition(ctx, symbol, reason)
		}
	}
}

// ═══════════════════════════════════════════════════════════════════════
// DIAGNOSTICS
// ═══════════════════════════════════════════════════════════════════════

// GetAccountSummary returns a formatted account summary.
func (t *PerpTrader) GetAccountSummary() (string, error) {
	account, err := t.client.FutAccount()
	if err != nil {
		return "", err
	}

	var sb strings.Builder
	sb.WriteString("## Aster Futures Account\n\n")
	sb.WriteString("| Metric | Value |\n")
	sb.WriteString("|--------|-------|\n")
	sb.WriteString(fmt.Sprintf("| Wallet Balance | %s USDT |\n", account.TotalWalletBalance))
	sb.WriteString(fmt.Sprintf("| Unrealized PnL | %s USDT |\n", account.TotalUnrealizedProfit))
	sb.WriteString(fmt.Sprintf("| Margin Balance | %s USDT |\n", account.TotalMarginBalance))
	sb.WriteString(fmt.Sprintf("| Available | %s USDT |\n", account.AvailableBalance))
	sb.WriteString(fmt.Sprintf("| Can Trade | %v |\n", account.CanTrade))
	sb.WriteString(fmt.Sprintf("| Active Positions | %d |\n", len(t.activePositions)))
	sb.WriteString(fmt.Sprintf("| Mode | %s |\n", modeStr(t.dryRun)))

	return sb.String(), nil
}

// GetPositionsSummary returns formatted position summary.
func (t *PerpTrader) GetPositionsSummary() string {
	t.mu.Lock()
	defer t.mu.Unlock()

	if len(t.activePositions) == 0 {
		return "No active positions."
	}

	var sb strings.Builder
	sb.WriteString("## Active Positions\n\n")
	sb.WriteString("| Symbol | Side | Entry | Qty | SL | TP | Leverage | Age |\n")
	sb.WriteString("|--------|------|-------|-----|----|----|----------|-----|\n")

	for _, pos := range t.activePositions {
		age := time.Since(pos.OpenedAt).Round(time.Second)
		sb.WriteString(fmt.Sprintf("| %s | %s | %.4f | %.4f | %.4f | %.4f | %dx | %s |\n",
			pos.Symbol, pos.Side, pos.EntryPrice, pos.Quantity,
			pos.StopLoss, pos.TakeProfit, pos.Leverage, age))
	}

	return sb.String()
}

// ═══════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════

func (t *PerpTrader) getAvailableBalance() (float64, error) {
	balances, err := t.client.FutBalance()
	if err != nil {
		return 0, err
	}
	for _, b := range balances {
		if b.Asset == "USDT" {
			bal, _ := strconv.ParseFloat(b.AvailableBalance, 64)
			return bal, nil
		}
	}
	return 0, fmt.Errorf("no USDT balance found")
}

func (t *PerpTrader) getSymbolPrecision(symbol string) (qtyPrec, pricePrec int) {
	info, err := t.client.FutExchangeInfo()
	if err != nil {
		return 3, 2 // safe defaults
	}
	for _, s := range info.Symbols {
		if s.Symbol == symbol {
			return s.QuantityPrecision, s.PricePrecision
		}
	}
	return 3, 2
}

func (t *PerpTrader) logTrade(status string, signal TradeSignal, result TradeResult) {
	logger.InfoCF("aster", fmt.Sprintf("[%s] %s %s | conf=%.2f | qty=%s | thesis=%s",
		status, signal.Side, signal.Symbol, signal.Confidence,
		result.Quantity, truncStr(signal.Thesis, 60)), nil)
}

func (t *PerpTrader) recordToVault(signal TradeSignal, result TradeResult) {
	if t.vault == nil {
		return
	}

	entry, _ := strconv.ParseFloat(result.EntryPrice, 64)

	t.vault.RecordTrade(memory.TradeRecordInput{
		Token:      signal.Symbol,
		Side:       string(signal.Side),
		Size:       0, // will be determined from quantity
		EntryPrice: entry,
		Rationale:  signal.Thesis,
		Signals:    map[string]any{"source": signal.SignalSource, "confidence": signal.Confidence},
		Outcome:    "", // open position
	})

	// Also remember as a memory
	if t.memEngine != nil {
		t.memEngine.Remember(memory.RememberInput{
			MemoryType: memory.TypeLearned,
			Source:     "aster_perp_trade",
			Topic:     fmt.Sprintf("%s %s trade", signal.Side, signal.Symbol),
			Asset:     signal.Symbol,
			Content:   fmt.Sprintf("Executed %s %s at %s (conf=%.2f, lev=%dx). Thesis: %s",
				signal.Side, signal.Symbol, result.EntryPrice, signal.Confidence, result.Leverage, signal.Thesis),
			Confidence: signal.Confidence,
		})
	}
}

func formatFloat(f float64, precision int) string {
	return strconv.FormatFloat(f, 'f', precision, 64)
}

func truncStr(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}

func modeStr(dryRun bool) string {
	if dryRun {
		return "DRY RUN (simulation)"
	}
	return "LIVE"
}
