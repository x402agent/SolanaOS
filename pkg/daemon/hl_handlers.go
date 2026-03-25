package daemon

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"
)

// ── Hyperliquid command helpers ──────────────────────────────────────

func (d *Daemon) hlNotConfigured() string {
	return "📈 Hyperliquid not configured.\n\nAdd to `.env`:\n```\nHYPERLIQUID_PRIVATE_KEY=0x...\nHYPERLIQUID_WALLET=0x...\n```"
}

// hlAccountResponse shows full account overview.
func (d *Daemon) hlAccountResponse() string {
	if d.hl == nil {
		return d.hlNotConfigured()
	}
	ctx, cancel := context.WithTimeout(d.ctx, 15*time.Second)
	defer cancel()

	state, err := d.hl.AccountState(ctx)
	if err != nil {
		return fmt.Sprintf("📈 Hyperliquid error: %v", err)
	}

	acv := state.MarginSummary.AccountValue
	withdrawable := state.Withdrawable
	ntl := state.MarginSummary.TotalNtlPos
	marginUsed := state.MarginSummary.TotalMarginUsed

	posCount := 0
	for _, ap := range state.AssetPositions {
		szi, _ := strconv.ParseFloat(ap.Position.Szi, 64)
		if szi != 0 {
			posCount++
		}
	}

	var sb strings.Builder
	fmt.Fprintf(&sb, "📈 **Hyperliquid Account**\n\n")
	fmt.Fprintf(&sb, "Wallet: `%s`\n", d.hl.Wallet())
	fmt.Fprintf(&sb, "Account Value: **$%s**\n", acv)
	fmt.Fprintf(&sb, "Withdrawable: $%s\n", withdrawable)
	fmt.Fprintf(&sb, "Total Notional: $%s\n", ntl)
	fmt.Fprintf(&sb, "Margin Used: $%s\n", marginUsed)
	fmt.Fprintf(&sb, "Open Positions: %d\n\n", posCount)
	fmt.Fprintf(&sb, "Use `/hl_positions` for position details.")
	return sb.String()
}

// hlBalanceResponse shows just the USD balance.
func (d *Daemon) hlBalanceResponse() string {
	if d.hl == nil {
		return d.hlNotConfigured()
	}
	ctx, cancel := context.WithTimeout(d.ctx, 15*time.Second)
	defer cancel()

	state, err := d.hl.AccountState(ctx)
	if err != nil {
		return fmt.Sprintf("📈 Hyperliquid error: %v", err)
	}
	return fmt.Sprintf("📈 **HL Balance**\n\nAccount Value: **$%s**\nWithdrawable: $%s",
		state.MarginSummary.AccountValue, state.Withdrawable)
}

// hlPositionsResponse lists open perpetual positions.
func (d *Daemon) hlPositionsResponse() string {
	if d.hl == nil {
		return d.hlNotConfigured()
	}
	ctx, cancel := context.WithTimeout(d.ctx, 15*time.Second)
	defer cancel()

	state, err := d.hl.AccountState(ctx)
	if err != nil {
		return fmt.Sprintf("📈 Hyperliquid error: %v", err)
	}

	var positions []string
	for _, ap := range state.AssetPositions {
		pos := ap.Position
		szi, _ := strconv.ParseFloat(pos.Szi, 64)
		if szi == 0 {
			continue
		}
		side := "LONG"
		if szi < 0 {
			side = "SHORT"
		}
		pnl := pos.UnrealizedPnl
		if !strings.HasPrefix(pnl, "-") {
			pnl = "+" + pnl
		}
		entry := "n/a"
		if pos.EntryPx != nil && strings.TrimSpace(*pos.EntryPx) != "" {
			entry = *pos.EntryPx
		}
		positions = append(positions, fmt.Sprintf(
			"• **%s** %s %.4f @ $%s | PnL: $%s | Lev: %dx",
			pos.Coin, side, absFloat(szi), entry, pnl, pos.Leverage.Value,
		))
	}

	if len(positions) == 0 {
		return "📈 **Hyperliquid Positions**\n\nNo open positions."
	}
	return "📈 **Hyperliquid Positions**\n\n" + strings.Join(positions, "\n")
}

// hlOrdersResponse lists open orders.
func (d *Daemon) hlOrdersResponse() string {
	if d.hl == nil {
		return d.hlNotConfigured()
	}
	ctx, cancel := context.WithTimeout(d.ctx, 15*time.Second)
	defer cancel()

	orders, err := d.hl.OpenOrders(ctx)
	if err != nil {
		return fmt.Sprintf("📈 Hyperliquid error: %v", err)
	}
	if len(orders) == 0 {
		return "📈 **Hyperliquid Orders**\n\nNo open orders."
	}
	var lines []string
	for _, o := range orders {
		lines = append(lines, fmt.Sprintf("• **%s** %s sz=%s @ $%s (oid=%d)",
			o.Coin, o.Side, o.Sz, o.LimitPx, o.Oid))
	}
	return "📈 **Hyperliquid Orders**\n\n" + strings.Join(lines, "\n")
}

// hlOpenResponse opens a perp market order.
// Usage: /hl_open <COIN> <long|short> [size] [slippage%]
func (d *Daemon) hlOpenResponse(args []string) string {
	if d.hl == nil {
		return d.hlNotConfigured()
	}
	if len(args) < 2 {
		return "Usage: `/hl_open <COIN> <long|short> [size] [slippage%]`\nExample: `/hl_open BTC long 0.01`"
	}
	coin := strings.ToUpper(args[0])
	side := strings.ToLower(args[1])
	isBuy := side == "long" || side == "buy"

	sz := 0.01
	if len(args) >= 3 {
		if v, err := strconv.ParseFloat(args[2], 64); err == nil && v > 0 {
			sz = v
		}
	}
	slippage := 0.05
	if len(args) >= 4 {
		if v, err := strconv.ParseFloat(strings.TrimSuffix(args[3], "%"), 64); err == nil && v > 0 {
			slippage = v / 100
		}
	}

	ctx, cancel := context.WithTimeout(d.ctx, 20*time.Second)
	defer cancel()

	sideStr := "LONG"
	if !isBuy {
		sideStr = "SHORT"
	}

	if err := d.hl.MarketOpen(ctx, coin, isBuy, sz, slippage); err != nil {
		return fmt.Sprintf("📈 HL open failed: %v", err)
	}
	return fmt.Sprintf("📈 **HL Order Placed**\n\n%s %s\nSize: %g\nSlippage: %.1f%%\n\nUse `/hl_positions` to confirm fill.",
		sideStr, coin, sz, slippage*100)
}

// hlOrderResponse places a priced perp order.
// Usage: /hl_order <COIN> <long|short> <size> <price> [gtc|alo|ioc] [reduce]
func (d *Daemon) hlOrderResponse(args []string) string {
	if d.hl == nil {
		return d.hlNotConfigured()
	}
	if len(args) < 4 {
		return "Usage: `/hl_order <COIN> <long|short> <size> <price> [gtc|alo|ioc] [reduce]`\nExample: `/hl_order BTC long 0.01 85000 gtc`"
	}
	coin := strings.ToUpper(args[0])
	side := strings.ToLower(args[1])
	isBuy := side == "long" || side == "buy"
	sz, err := strconv.ParseFloat(args[2], 64)
	if err != nil || sz <= 0 {
		return "📈 Invalid size. Example: `/hl_order BTC long 0.01 85000 gtc`"
	}
	px, err := strconv.ParseFloat(args[3], 64)
	if err != nil || px <= 0 {
		return "📈 Invalid price. Example: `/hl_order BTC long 0.01 85000 gtc`"
	}
	tif := "gtc"
	if len(args) >= 5 {
		tif = strings.ToLower(args[4])
	}
	reduceOnly := len(args) >= 6 && strings.EqualFold(args[5], "reduce")

	ctx, cancel := context.WithTimeout(d.ctx, 20*time.Second)
	defer cancel()

	result, err := d.hl.PlaceLimitOrder(ctx, coin, isBuy, sz, px, tif, reduceOnly)
	if err != nil {
		return fmt.Sprintf("📈 HL order failed: %v", err)
	}

	sideStr := "LONG"
	if !isBuy {
		sideStr = "SHORT"
	}
	var sb strings.Builder
	fmt.Fprintf(&sb, "📈 **HL Limit Order Placed**\n\n")
	fmt.Fprintf(&sb, "%s %s\n", sideStr, coin)
	fmt.Fprintf(&sb, "Size: %g\n", sz)
	fmt.Fprintf(&sb, "Price: $%g\n", px)
	fmt.Fprintf(&sb, "TIF: %s\n", strings.ToUpper(tif))
	if reduceOnly {
		fmt.Fprintf(&sb, "Mode: reduce-only\n")
	}
	if result != nil {
		if result.Oid > 0 {
			fmt.Fprintf(&sb, "OID: `%d`\n", result.Oid)
		}
		if result.AvgPx != "" {
			fmt.Fprintf(&sb, "Avg Fill: $%s\n", result.AvgPx)
		}
		if result.TotalSz != "" {
			fmt.Fprintf(&sb, "Filled Size: %s\n", result.TotalSz)
		}
	}
	return sb.String()
}

// hlCloseResponse closes a perp position.
// Usage: /hl_close <COIN> [size]
func (d *Daemon) hlCloseResponse(args []string) string {
	if d.hl == nil {
		return d.hlNotConfigured()
	}
	if len(args) < 1 {
		return "Usage: `/hl_close <COIN> [size]`\nExample: `/hl_close BTC`"
	}
	coin := strings.ToUpper(args[0])
	sz := 0.0
	if len(args) >= 2 {
		if v, err := strconv.ParseFloat(args[1], 64); err == nil && v > 0 {
			sz = v
		}
	}

	ctx, cancel := context.WithTimeout(d.ctx, 20*time.Second)
	defer cancel()

	if err := d.hl.MarketClose(ctx, coin, sz, 0.05); err != nil {
		return fmt.Sprintf("📈 HL close failed: %v", err)
	}
	return fmt.Sprintf("📈 **HL Position Closed**\n\n%s position closed.\nUse `/hl_positions` to confirm.", coin)
}

// hlCancelResponse cancels either a specific order or all open orders.
func (d *Daemon) hlCancelResponse(args []string) string {
	if d.hl == nil {
		return d.hlNotConfigured()
	}
	ctx, cancel := context.WithTimeout(d.ctx, 20*time.Second)
	defer cancel()

	if len(args) >= 2 {
		coin := strings.ToUpper(args[0])
		oid, err := strconv.ParseInt(args[1], 10, 64)
		if err != nil {
			return "Usage: `/hl_cancel <COIN> <oid>` or `/hl_cancel` to cancel all orders."
		}
		if err := d.hl.CancelOrder(ctx, coin, oid); err != nil {
			return fmt.Sprintf("📈 HL cancel failed: %v", err)
		}
		return fmt.Sprintf("📈 Cancelled Hyperliquid order `%d` on %s.", oid, coin)
	}

	n, err := d.hl.CancelAll(ctx)
	if err != nil {
		return fmt.Sprintf("📈 HL cancel failed: %v", err)
	}
	if n == 0 {
		return "📈 No open Hyperliquid orders to cancel."
	}
	return fmt.Sprintf("📈 Cancelled %d Hyperliquid order(s).", n)
}

func (d *Daemon) hlMidResponse(args []string) string {
	if d.hl == nil {
		return d.hlNotConfigured()
	}
	if len(args) < 1 {
		return "Usage: `/hl_mid <COIN>`\nExample: `/hl_mid BTC`"
	}
	coin := strings.ToUpper(args[0])
	ctx, cancel := context.WithTimeout(d.ctx, 15*time.Second)
	defer cancel()

	market, err := d.hl.MarketState(ctx, coin)
	if err != nil {
		return fmt.Sprintf("📈 Hyperliquid error: %v", err)
	}
	var sb strings.Builder
	fmt.Fprintf(&sb, "📈 **HL Market: %s**\n\n", market.Coin)
	fmt.Fprintf(&sb, "Mid: $%s\n", market.MidPx)
	fmt.Fprintf(&sb, "Mark: $%s\n", market.MarkPx)
	fmt.Fprintf(&sb, "Oracle: $%s\n", market.OraclePx)
	fmt.Fprintf(&sb, "Funding: %s\n", market.Funding)
	fmt.Fprintf(&sb, "OI: %s\n", market.OpenInterest)
	fmt.Fprintf(&sb, "24h Ntl Vol: %s\n", market.DayNtlVlm)
	if market.MaxLeverage > 0 {
		fmt.Fprintf(&sb, "Max Leverage: %dx\n", market.MaxLeverage)
	}
	return sb.String()
}

func (d *Daemon) hlLeverageResponse(args []string) string {
	if d.hl == nil {
		return d.hlNotConfigured()
	}
	if len(args) < 2 {
		return "Usage: `/hl_leverage <COIN> <LEV> [cross|isolated]`\nExample: `/hl_leverage BTC 5 cross`"
	}
	coin := strings.ToUpper(args[0])
	lev, err := strconv.Atoi(args[1])
	if err != nil || lev <= 0 {
		return "📈 Invalid leverage. Example: `/hl_leverage BTC 5 cross`"
	}
	isCross := true
	if len(args) >= 3 && strings.HasPrefix(strings.ToLower(args[2]), "iso") {
		isCross = false
	}
	ctx, cancel := context.WithTimeout(d.ctx, 20*time.Second)
	defer cancel()
	state, err := d.hl.UpdateLeverage(ctx, coin, lev, isCross)
	if err != nil {
		return fmt.Sprintf("📈 HL leverage update failed: %v", err)
	}
	mode := "cross"
	if !isCross {
		mode = "isolated"
	}
	return fmt.Sprintf("📈 **HL Leverage Updated**\n\n%s now set to **%dx** %s.\nAccount Value: $%s",
		coin, lev, mode, state.MarginSummary.AccountValue)
}

func (d *Daemon) hlFillsResponse(args []string) string {
	if d.hl == nil {
		return d.hlNotConfigured()
	}
	coinFilter := ""
	if len(args) >= 1 {
		coinFilter = strings.ToUpper(args[0])
	}
	ctx, cancel := context.WithTimeout(d.ctx, 20*time.Second)
	defer cancel()

	fills, err := d.hl.UserFills(ctx, false)
	if err != nil {
		return fmt.Sprintf("📈 Hyperliquid error: %v", err)
	}
	if coinFilter != "" {
		filtered := fills[:0]
		for _, f := range fills {
			if strings.EqualFold(f.Coin, coinFilter) {
				filtered = append(filtered, f)
			}
		}
		fills = filtered
	}
	if len(fills) == 0 {
		return "📈 **Hyperliquid Fills**\n\nNo fills found."
	}
	if len(fills) > 6 {
		fills = fills[:6]
	}
	var lines []string
	for _, f := range fills {
		pnl := strings.TrimSpace(f.ClosedPnl)
		if pnl != "" && !strings.HasPrefix(pnl, "-") {
			pnl = "+" + pnl
		}
		lines = append(lines, fmt.Sprintf("• **%s** %s %s @ $%s | fee %s | pnl %s",
			f.Coin, strings.ToUpper(f.Side), f.Size, f.Price, f.Fee, blankIfEmpty(pnl, "0")))
	}
	return "📈 **Hyperliquid Fills**\n\n" + strings.Join(lines, "\n")
}

func (d *Daemon) hlCandlesResponse(args []string) string {
	if d.hl == nil {
		return d.hlNotConfigured()
	}
	if len(args) < 1 {
		return "Usage: `/hl_candles <COIN> [interval] [hours]`\nExample: `/hl_candles BTC 1h 24`"
	}
	coin := strings.ToUpper(args[0])
	interval := "1h"
	if len(args) >= 2 && strings.TrimSpace(args[1]) != "" {
		interval = args[1]
	}
	hours := 24
	if len(args) >= 3 {
		if n, err := strconv.Atoi(args[2]); err == nil && n > 0 {
			hours = n
		}
	}
	end := time.Now().UnixMilli()
	start := time.Now().Add(-time.Duration(hours) * time.Hour).UnixMilli()
	ctx, cancel := context.WithTimeout(d.ctx, 20*time.Second)
	defer cancel()

	candles, err := d.hl.CandleSnapshot(ctx, coin, interval, start, end)
	if err != nil {
		return fmt.Sprintf("📈 Hyperliquid error: %v", err)
	}
	if len(candles) == 0 {
		return fmt.Sprintf("📈 **HL Candles**\n\nNo candle data for %s.", coin)
	}
	last := candles[len(candles)-1]
	var sb strings.Builder
	fmt.Fprintf(&sb, "📈 **HL Candles: %s**\n\n", coin)
	fmt.Fprintf(&sb, "Interval: %s\n", interval)
	fmt.Fprintf(&sb, "Bars: %d\n", len(candles))
	fmt.Fprintf(&sb, "Last Close: $%s\n", last.Close)
	fmt.Fprintf(&sb, "Last High/Low: $%s / $%s\n", last.High, last.Low)
	fmt.Fprintf(&sb, "Last Volume: %s\n", last.Volume)
	fmt.Fprintf(&sb, "Window: %dh", hours)
	return sb.String()
}

func absFloat(x float64) float64 {
	if x < 0 {
		return -x
	}
	return x
}

func blankIfEmpty(in, fallback string) string {
	if strings.TrimSpace(in) == "" {
		return fallback
	}
	return in
}
