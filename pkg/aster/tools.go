// Package aster :: tools.go
// Tool definitions for the MawdBot agent tool registry.
// These are the functions the LLM can call autonomously.
package aster

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/x402agent/Solana-Os-Go/pkg/tools"
)

// RegisterTools adds all Aster perp trading tools to the agent's tool registry.
func RegisterTools(registry *tools.Registry, trader *PerpTrader, client *Client) {
	// ── Market Data Tools ────────────────────────────────────────

	registry.Register(&tools.ToolDef{
		ToolName: "aster_perp_price",
		Desc:     "Get current perpetual futures mark price, index price, and funding rate for a symbol",
		ExecuteFn: func(ctx context.Context, args map[string]any) (string, error) {
			symbol := getString(args, "symbol")
			if symbol == "" {
				return "", fmt.Errorf("symbol required")
			}
			mps, err := client.FutMarkPrice(strings.ToUpper(symbol))
			if err != nil {
				return "", err
			}
			if len(mps) == 0 {
				return "no data", nil
			}
			mp := mps[0]
			return fmt.Sprintf("Symbol: %s\nMark Price: %s\nIndex Price: %s\nFunding Rate: %s\nNext Funding: %d\n",
				mp.Symbol, mp.MarkPrice, mp.IndexPrice, mp.LastFundingRate, mp.NextFundingTime), nil
		},
	})

	registry.Register(&tools.ToolDef{
		ToolName: "aster_perp_klines",
		Desc:     "Get perpetual futures OHLCV candlestick data. Interval: 1m,5m,15m,1h,4h,1d",
		ExecuteFn: func(ctx context.Context, args map[string]any) (string, error) {
			symbol := getString(args, "symbol")
			interval := getString(args, "interval")
			if symbol == "" || interval == "" {
				return "", fmt.Errorf("symbol and interval required")
			}
			limit := getInt(args, "limit", 20)
			klines, err := client.FutKlines(strings.ToUpper(symbol), interval, limit)
			if err != nil {
				return "", err
			}
			var sb strings.Builder
			sb.WriteString(fmt.Sprintf("Klines %s (%s) — %d candles:\n", symbol, interval, len(klines)))
			sb.WriteString("Open | High | Low | Close | Volume\n")
			for _, k := range klines {
				sb.WriteString(fmt.Sprintf("%s | %s | %s | %s | %s\n",
					k.Open, k.High, k.Low, k.Close, k.Volume))
			}
			return sb.String(), nil
		},
	})

	registry.Register(&tools.ToolDef{
		ToolName: "aster_perp_funding",
		Desc:     "Get funding rate history and configuration for a perpetual futures symbol",
		ExecuteFn: func(ctx context.Context, args map[string]any) (string, error) {
			symbol := getString(args, "symbol")
			if symbol == "" {
				return "", fmt.Errorf("symbol required")
			}
			rates, err := client.FutFundingRate(strings.ToUpper(symbol), 10)
			if err != nil {
				return "", err
			}
			info, _ := client.FutFundingInfo(strings.ToUpper(symbol))

			var sb strings.Builder
			sb.WriteString(fmt.Sprintf("Funding Rate History — %s:\n", symbol))
			for _, r := range rates {
				sb.WriteString(fmt.Sprintf("  %s @ %d\n", r.FundingRate, r.FundingTime))
			}
			if len(info) > 0 {
				fi := info[0]
				sb.WriteString(fmt.Sprintf("\nConfig: interval=%dh, cap=%.4f, floor=%.4f\n",
					fi.FundingIntervalHours, fi.FundingFeeCap, fi.FundingFeeFloor))
			}
			return sb.String(), nil
		},
	})

	registry.Register(&tools.ToolDef{
		ToolName: "aster_perp_depth",
		Desc:     "Get order book depth for a perpetual futures symbol",
		ExecuteFn: func(ctx context.Context, args map[string]any) (string, error) {
			symbol := getString(args, "symbol")
			if symbol == "" {
				return "", fmt.Errorf("symbol required")
			}
			limit := getInt(args, "limit", 10)
			depth, err := client.FutDepth(strings.ToUpper(symbol), limit)
			if err != nil {
				return "", err
			}
			var sb strings.Builder
			sb.WriteString(fmt.Sprintf("Order Book — %s:\n\nAsks (sell):\n", symbol))
			for i := len(depth.Asks) - 1; i >= 0; i-- {
				if len(depth.Asks[i]) >= 2 {
					sb.WriteString(fmt.Sprintf("  %s @ %s\n", depth.Asks[i][1], depth.Asks[i][0]))
				}
			}
			sb.WriteString("\nBids (buy):\n")
			for _, bid := range depth.Bids {
				if len(bid) >= 2 {
					sb.WriteString(fmt.Sprintf("  %s @ %s\n", bid[1], bid[0]))
				}
			}
			return sb.String(), nil
		},
	})

	registry.Register(&tools.ToolDef{
		ToolName: "aster_perp_markets",
		Desc:     "List all available perpetual futures trading pairs on Aster DEX",
		ExecuteFn: func(ctx context.Context, args map[string]any) (string, error) {
			info, err := client.FutExchangeInfo()
			if err != nil {
				return "", err
			}
			var sb strings.Builder
			sb.WriteString(fmt.Sprintf("Aster Futures — %d symbols:\n\n", len(info.Symbols)))
			for _, s := range info.Symbols {
				if s.Status == "TRADING" {
					sb.WriteString(fmt.Sprintf("  %s (%s/%s) — %s\n",
						s.Symbol, s.BaseAsset, s.QuoteAsset, s.ContractType))
				}
			}
			return sb.String(), nil
		},
	})

	// ── Account Tools ────────────────────────────────────────────

	registry.Register(&tools.ToolDef{
		ToolName: "aster_perp_balance",
		Desc:     "Get Aster futures account balance (USDT available, wallet, unrealized PnL)",
		ExecuteFn: func(ctx context.Context, args map[string]any) (string, error) {
			summary, err := trader.GetAccountSummary()
			if err != nil {
				return "", err
			}
			return summary, nil
		},
	})

	registry.Register(&tools.ToolDef{
		ToolName: "aster_perp_positions",
		Desc:     "Get all current open perpetual futures positions with unrealized PnL",
		ExecuteFn: func(ctx context.Context, args map[string]any) (string, error) {
			positions, err := client.FutPositionRisk("")
			if err != nil {
				return "", err
			}
			var sb strings.Builder
			sb.WriteString("## Exchange Positions\n\n")

			active := 0
			for _, p := range positions {
				amt, _ := strconv.ParseFloat(p.PositionAmt, 64)
				if amt == 0 {
					continue
				}
				active++
				sb.WriteString(fmt.Sprintf("**%s** %s @ %s | Qty: %s | PnL: %s | Lev: %sx | Liq: %s\n",
					p.Symbol, p.PositionSide, p.EntryPrice, p.PositionAmt,
					p.UnRealizedProfit, p.Leverage, p.LiquidationPrice))
			}
			if active == 0 {
				sb.WriteString("No open positions.\n")
			}

			managed := trader.GetPositionsSummary()
			sb.WriteString("\n" + managed)

			return sb.String(), nil
		},
	})

	// ── Trading Tools (EXECUTION) ────────────────────────────────

	registry.Register(&tools.ToolDef{
		ToolName:         "aster_open_position",
		Desc:             "Open a perpetual futures position. Requires approval. Args: symbol, side (BUY/SELL), confidence (0-1), thesis, entry_price (0=market), stop_loss, take_profit, leverage, size_pct",
		RequiresApproval: true,
		ExecuteFn: func(ctx context.Context, args map[string]any) (string, error) {
			symbol := getString(args, "symbol")
			side := getString(args, "side")
			confidence := getFloat(args, "confidence", 0.7)
			thesis := getString(args, "thesis")

			if symbol == "" || side == "" {
				return "", fmt.Errorf("symbol and side required")
			}

			signal := TradeSignal{
				Symbol:       strings.ToUpper(symbol),
				Side:         OrderSide(strings.ToUpper(side)),
				Confidence:   confidence,
				SignalSource: getString(args, "signal_source"),
				Thesis:       thesis,
				EntryPrice:   getFloat(args, "entry_price", 0),
				StopLoss:     getFloat(args, "stop_loss", 0),
				TakeProfit:   getFloat(args, "take_profit", 0),
				Leverage:     getInt(args, "leverage", 0),
				SizePct:      getFloat(args, "size_pct", 0),
			}

			result := trader.ExecuteSignal(ctx, signal)

			resultJSON, _ := json.MarshalIndent(result, "", "  ")
			return string(resultJSON), nil
		},
	})

	registry.Register(&tools.ToolDef{
		ToolName:         "aster_close_position",
		Desc:             "Close an open perpetual futures position at market. Requires approval. Args: symbol, reason",
		RequiresApproval: true,
		ExecuteFn: func(ctx context.Context, args map[string]any) (string, error) {
			symbol := getString(args, "symbol")
			reason := getString(args, "reason")
			if symbol == "" {
				return "", fmt.Errorf("symbol required")
			}
			if reason == "" {
				reason = "manual close"
			}

			result, err := trader.ClosePosition(ctx, strings.ToUpper(symbol), reason)
			if err != nil {
				return "", err
			}
			resultJSON, _ := json.MarshalIndent(result, "", "  ")
			return string(resultJSON), nil
		},
	})

	registry.Register(&tools.ToolDef{
		ToolName: "aster_set_leverage",
		Desc:     "Change leverage for a perpetual futures symbol. Args: symbol, leverage (1-125)",
		ExecuteFn: func(ctx context.Context, args map[string]any) (string, error) {
			symbol := getString(args, "symbol")
			leverage := getInt(args, "leverage", 5)
			if symbol == "" {
				return "", fmt.Errorf("symbol required")
			}
			resp, err := client.FutChangeLeverage(strings.ToUpper(symbol), leverage)
			if err != nil {
				return "", err
			}
			return fmt.Sprintf("Leverage set: %s → %dx (max notional: %s)",
				resp.Symbol, resp.Leverage, resp.MaxNotionalValue), nil
		},
	})

	registry.Register(&tools.ToolDef{
		ToolName:         "aster_cancel_orders",
		Desc:             "Cancel all open orders for a perpetual futures symbol. Requires approval. Args: symbol",
		RequiresApproval: true,
		ExecuteFn: func(ctx context.Context, args map[string]any) (string, error) {
			symbol := getString(args, "symbol")
			if symbol == "" {
				return "", fmt.Errorf("symbol required")
			}
			err := client.FutCancelAllOrders(strings.ToUpper(symbol))
			if err != nil {
				return "", err
			}
			return fmt.Sprintf("All open orders for %s cancelled.", symbol), nil
		},
	})

	registry.Register(&tools.ToolDef{
		ToolName: "aster_trade_history",
		Desc:     "Get recent trade history for a perpetual futures symbol. Args: symbol, limit",
		ExecuteFn: func(ctx context.Context, args map[string]any) (string, error) {
			symbol := getString(args, "symbol")
			if symbol == "" {
				return "", fmt.Errorf("symbol required")
			}
			limit := getInt(args, "limit", 20)
			trades, err := client.FutUserTrades(strings.ToUpper(symbol), limit)
			if err != nil {
				return "", err
			}
			var sb strings.Builder
			sb.WriteString(fmt.Sprintf("Trade History — %s (%d):\n\n", symbol, len(trades)))
			for _, tr := range trades {
				sb.WriteString(fmt.Sprintf("  #%d %s %s @ %s qty=%s pnl=%s\n",
					tr.ID, tr.Side, tr.PositionSide, tr.Price, tr.Qty, tr.RealizedPnl))
			}
			return sb.String(), nil
		},
	})

	registry.Register(&tools.ToolDef{
		ToolName: "aster_income_history",
		Desc:     "Get income history (PnL, funding fees, commissions). Args: symbol (optional), income_type (optional: REALIZED_PNL, FUNDING_FEE, COMMISSION), limit",
		ExecuteFn: func(ctx context.Context, args map[string]any) (string, error) {
			symbol := getString(args, "symbol")
			incomeType := getString(args, "income_type")
			limit := getInt(args, "limit", 20)
			records, err := client.FutIncome(strings.ToUpper(symbol), incomeType, limit)
			if err != nil {
				return "", err
			}
			var sb strings.Builder
			sb.WriteString(fmt.Sprintf("Income History (%d records):\n\n", len(records)))
			for _, r := range records {
				sb.WriteString(fmt.Sprintf("  %s — %s %s %s (%s)\n",
					r.Symbol, r.IncomeType, r.Income, r.Asset, r.Info))
			}
			return sb.String(), nil
		},
	})

	// ── Transfer Tool ────────────────────────────────────────────

	registry.Register(&tools.ToolDef{
		ToolName:         "aster_transfer",
		Desc:             "Transfer USDT between spot and futures accounts. Requires approval. Args: amount, direction (to_futures/to_spot)",
		RequiresApproval: true,
		ExecuteFn: func(ctx context.Context, args map[string]any) (string, error) {
			amount := getString(args, "amount")
			direction := getString(args, "direction")
			if amount == "" || direction == "" {
				return "", fmt.Errorf("amount and direction required")
			}
			kindType := "SPOT_FUTURE"
			if direction == "to_spot" {
				kindType = "FUTURE_SPOT"
			}
			clientTranID := fmt.Sprintf("solanaos-%d", time.Now().UnixMilli())
			resp, err := client.Transfer("USDT", amount, kindType, clientTranID)
			if err != nil {
				return "", err
			}
			return fmt.Sprintf("Transfer %s: %s USDT (tranId: %d, status: %s)",
				direction, amount, resp.TranID, resp.Status), nil
		},
	})
}

// ── Arg helpers ──────────────────────────────────────────────────────

func getString(args map[string]any, key string) string {
	v, ok := args[key]
	if !ok {
		return ""
	}
	s, ok := v.(string)
	if ok {
		return s
	}
	return fmt.Sprintf("%v", v)
}

func getFloat(args map[string]any, key string, dflt float64) float64 {
	v, ok := args[key]
	if !ok {
		return dflt
	}
	switch val := v.(type) {
	case float64:
		return val
	case string:
		f, err := strconv.ParseFloat(val, 64)
		if err != nil {
			return dflt
		}
		return f
	default:
		return dflt
	}
}

func getInt(args map[string]any, key string, dflt int) int {
	v, ok := args[key]
	if !ok {
		return dflt
	}
	switch val := v.(type) {
	case float64:
		return int(val)
	case int:
		return val
	case string:
		i, err := strconv.Atoi(val)
		if err != nil {
			return dflt
		}
		return i
	default:
		return dflt
	}
}
