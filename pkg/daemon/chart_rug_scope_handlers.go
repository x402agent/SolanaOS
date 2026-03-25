package daemon

import (
	"fmt"
	"net/url"
	"strings"

	"github.com/x402agent/Solana-Os-Go/pkg/bus"
	"github.com/x402agent/Solana-Os-Go/pkg/solana"
)

// ─── /rug — Rug check via Solana Tracker risk scoring ─────────────────────────

func (d *Daemon) rugCheckResponse(args []string) string {
	if len(args) < 1 {
		return "Usage: `/rug <mint>`\n\nChecks risk score, bundlers, snipers, insiders, dev holdings, freeze/mint authority, and rug status."
	}
	client, err := d.trackerClient()
	if err != nil {
		return "🌐 Set `SOLANA_TRACKER_API_KEY` to enable rug checks."
	}
	mint := strings.TrimSpace(args[0])
	info, err := client.GetToken(mint)
	if err != nil {
		return fmt.Sprintf("❌ Token lookup failed: %v", err)
	}

	pool := trackerBestPoolLocal(info)
	risk := info.Risk
	var b strings.Builder

	// Header
	b.WriteString(fmt.Sprintf("🛡️ **Rug Check — %s (%s)**\n\n", info.Token.Name, info.Token.Symbol))
	b.WriteString(fmt.Sprintf("Mint: `%s`\n\n", info.Token.Mint))

	// Risk verdict
	if risk.Rugged {
		b.WriteString("⛔ **RUGGED** — This token has been flagged as rugged.\n\n")
	} else if risk.Score == 0 && risk.JupiterVerified {
		b.WriteString("✅ **LOW RISK** — Jupiter verified, score 0.\n\n")
	} else if risk.Score <= 3 {
		b.WriteString(fmt.Sprintf("✅ **LOW RISK** — Score: %.0f/10\n\n", risk.Score))
	} else if risk.Score <= 6 {
		b.WriteString(fmt.Sprintf("⚠️ **MEDIUM RISK** — Score: %.0f/10\n\n", risk.Score))
	} else {
		b.WriteString(fmt.Sprintf("🔴 **HIGH RISK** — Score: %.0f/10\n\n", risk.Score))
	}

	// Key metrics
	b.WriteString("**Metrics:**\n")
	b.WriteString(fmt.Sprintf("• Price: $%.8f · MC: $%.0f · Liq: $%.0f\n", pool.Price.USD, pool.MarketCap.USD, pool.Liquidity.USD))
	b.WriteString(fmt.Sprintf("• Holders: %d · Txns: %d · Buys: %d · Sells: %d\n", info.Holders, info.Txns, info.Buys, info.Sells))

	// Holder distribution
	b.WriteString(fmt.Sprintf("\n**Holder Distribution:**\n"))
	b.WriteString(fmt.Sprintf("• Top 10: %.2f%%\n", risk.Top10))
	b.WriteString(fmt.Sprintf("• Dev: %.4f%% (%.4f tokens)\n", risk.Dev.Percentage, risk.Dev.Amount))
	b.WriteString(fmt.Sprintf("• Snipers: %d wallets (%.2f%%)\n", risk.Snipers.Count, risk.Snipers.TotalPercentage))
	b.WriteString(fmt.Sprintf("• Insiders: %d wallets (%.2f%%)\n", risk.Insiders.Count, risk.Insiders.TotalPercentage))
	b.WriteString(fmt.Sprintf("• Bundlers: %d wallets (%.2f%%)\n", risk.Bundlers.Count, risk.Bundlers.TotalPercentage))

	// Security
	b.WriteString(fmt.Sprintf("\n**Security:**\n"))
	b.WriteString(fmt.Sprintf("• Jupiter Verified: %t\n", risk.JupiterVerified))
	if pool.Security.FreezeAuthority == nil {
		b.WriteString("• Freeze Authority: ✅ none\n")
	} else {
		b.WriteString(fmt.Sprintf("• Freeze Authority: ⚠️ %v\n", pool.Security.FreezeAuthority))
	}
	if pool.Security.MintAuthority == nil {
		b.WriteString("• Mint Authority: ✅ none\n")
	} else {
		b.WriteString(fmt.Sprintf("• Mint Authority: ⚠️ %v\n", pool.Security.MintAuthority))
	}
	if pool.LPBurn > 0 {
		b.WriteString(fmt.Sprintf("• LP Burn: %.0f%%\n", pool.LPBurn))
	}

	// Fees
	if risk.Fees.Total > 0 {
		b.WriteString(fmt.Sprintf("\n**Fees (SOL):**\n"))
		b.WriteString(fmt.Sprintf("• Total: %.4f · Trading: %.4f · Tips: %.4f\n", risk.Fees.Total, risk.Fees.TotalTrading, risk.Fees.TotalTips))
	}

	// Chart link
	b.WriteString(fmt.Sprintf("\n📊 [View Chart](https://seeker.solanaos.net/dex?token=%s)", mint))
	b.WriteString(fmt.Sprintf(" · [SolanaTracker](https://www.solanatracker.io/token/%s)", mint))

	return strings.TrimSpace(b.String())
}

// ─── /scope — Memescope: graduating + graduated tokens ─────────────────────────

func (d *Daemon) scopeResponse(args []string) string {
	client, err := d.trackerClient()
	if err != nil {
		return "🌐 Set `SOLANA_TRACKER_API_KEY` to enable memescope."
	}

	sub := "all"
	if len(args) > 0 {
		sub = strings.ToLower(strings.TrimSpace(args[0]))
	}
	limit := parseTrackerIntArg(args, 1, 8)

	switch sub {
	case "graduating", "grad":
		resp, err := client.GetGraduatingTokens(limit)
		if err != nil {
			return fmt.Sprintf("❌ Graduating lookup failed: %v", err)
		}
		return renderScopeList("🌱 **Graduating** — Tokens approaching bonding curve graduation", resp, limit)

	case "graduated", "done":
		resp, err := client.GetGraduatedTokens(limit)
		if err != nil {
			return fmt.Sprintf("❌ Graduated lookup failed: %v", err)
		}
		return renderScopeList("🎓 **Graduated** — Recently graduated to DEX", resp, limit)

	default: // "all" or empty
		graduating, err1 := client.GetGraduatingTokens(5)
		graduated, err2 := client.GetGraduatedTokens(5)
		if err1 != nil && err2 != nil {
			return fmt.Sprintf("❌ Memescope failed: %v / %v", err1, err2)
		}

		var b strings.Builder
		b.WriteString("🔬 **Memescope**\n\n")

		if err1 == nil && len(graduating) > 0 {
			b.WriteString("**🌱 Graduating:**\n")
			for i, item := range graduating {
				if i >= 5 {
					break
				}
				pool := trackerBestPoolLocal(&item)
				b.WriteString(fmt.Sprintf("• `%s` — $%.8f · MC $%.0f · Liq $%.0f · %d holders\n",
					trackerSymbolLocal(&item), pool.Price.USD, pool.MarketCap.USD, pool.Liquidity.USD, item.Holders))
			}
		}

		b.WriteString("\n")

		if err2 == nil && len(graduated) > 0 {
			b.WriteString("**🎓 Graduated:**\n")
			for i, item := range graduated {
				if i >= 5 {
					break
				}
				pool := trackerBestPoolLocal(&item)
				change := trackerEventChangeLocal(&item, "24h")
				b.WriteString(fmt.Sprintf("• `%s` — $%.8f (%+.2f%%) · MC $%.0f · Liq $%.0f\n",
					trackerSymbolLocal(&item), pool.Price.USD, change, pool.MarketCap.USD, pool.Liquidity.USD))
			}
		}

		b.WriteString("\n📊 [View Memescope](https://seeker.solanaos.net/dex)")
		return strings.TrimSpace(b.String())
	}
}

func renderScopeList(title string, items []solana.TrackerTokenFull, limit int) string {
	if len(items) == 0 {
		return title + "\n\nNo tokens found."
	}
	var b strings.Builder
	b.WriteString(title + "\n\n")
	for i, item := range items {
		if i >= limit {
			break
		}
		pool := trackerBestPoolLocal(&item)
		change := trackerEventChangeLocal(&item, "24h")
		b.WriteString(fmt.Sprintf("%d. **%s** (%s)\n   $%.8f (%+.2f%%) · MC $%.0f · Liq $%.0f · %d holders\n",
			i+1, item.Token.Name, item.Token.Symbol,
			pool.Price.USD, change, pool.MarketCap.USD, pool.Liquidity.USD, item.Holders))
		if item.Risk.Score > 0 {
			b.WriteString(fmt.Sprintf("   Risk: %.0f · Top10: %.1f%% · Dev: %.2f%%\n", item.Risk.Score, item.Risk.Top10, item.Risk.Dev.Percentage))
		}
		b.WriteString(fmt.Sprintf("   `%s`\n\n", item.Token.Mint))
	}
	b.WriteString("📊 [View Memescope](https://seeker.solanaos.net/dex)")
	return strings.TrimSpace(b.String())
}

// ─── Enhanced /chart — adds Hub link and mini sparkline ─────────────────────────

func (d *Daemon) enhancedChartResponse(args []string) string {
	if len(args) < 1 {
		return "Usage: `/chart <mint> [1m|5m|15m|30m|1h|4h|1d]`\n\n📊 [Open Memescope](https://seeker.solanaos.net/dex)"
	}
	client, err := d.trackerClient()
	if err != nil {
		return "🌐 Set `SOLANA_TRACKER_API_KEY` to enable charts."
	}
	mint := strings.TrimSpace(args[0])
	tf := "1h"
	if len(args) > 1 {
		tf = strings.TrimSpace(args[1])
	}

	query := url.Values{}
	query.Set("currency", "usd")
	query.Set("removeOutliers", "true")
	query.Set("dynamicPools", "true")
	query.Set("type", tf)
	resp, err := client.GetTokenChart(mint, query)
	if err != nil {
		return fmt.Sprintf("❌ Chart lookup failed: %v", err)
	}
	if resp == nil || len(resp.OCLHV) == 0 {
		return "❌ No chart data returned."
	}

	// Get token name if possible
	tokenName := mint
	if info, err := client.GetToken(mint); err == nil && info != nil {
		tokenName = fmt.Sprintf("%s (%s)", info.Token.Name, info.Token.Symbol)
	}

	var b strings.Builder
	b.WriteString(fmt.Sprintf("📊 **%s** — %s chart\n\n", tokenName, tf))

	// Mini ASCII sparkline from close prices
	bars := resp.OCLHV
	if len(bars) > 20 {
		bars = bars[len(bars)-20:]
	}
	sparkline := asciiSparkline(bars)
	b.WriteString(sparkline + "\n\n")

	// Last 6 OHLCV bars
	showBars := resp.OCLHV
	if len(showBars) > 6 {
		showBars = showBars[len(showBars)-6:]
	}
	for _, bar := range showBars {
		b.WriteString(fmt.Sprintf("• %s · O %.8f H %.8f L %.8f C %.8f V $%.0f\n",
			unixMilliShort(bar.Time), bar.Open, bar.High, bar.Low, bar.Close, bar.Volume))
	}

	// Links
	b.WriteString(fmt.Sprintf("\n📊 [Interactive Chart](https://seeker.solanaos.net/dex?token=%s)", mint))
	b.WriteString(fmt.Sprintf(" · [SolanaTracker](https://www.solanatracker.io/token/%s)", mint))

	return strings.TrimSpace(b.String())
}

// asciiSparkline generates a simple sparkline from OHLCV close prices.
func asciiSparkline(bars []solana.TrackerOHLCVBar) string {
	if len(bars) == 0 {
		return ""
	}
	chars := []rune("▁▂▃▄▅▆▇█")
	closes := make([]float64, len(bars))
	min, max := bars[0].Close, bars[0].Close
	for i, bar := range bars {
		closes[i] = bar.Close
		if bar.Close < min {
			min = bar.Close
		}
		if bar.Close > max {
			max = bar.Close
		}
	}
	spread := max - min
	if spread == 0 {
		spread = 1
	}

	var sb strings.Builder
	for _, c := range closes {
		idx := int((c - min) / spread * float64(len(chars)-1))
		if idx < 0 {
			idx = 0
		}
		if idx >= len(chars) {
			idx = len(chars) - 1
		}
		sb.WriteRune(chars[idx])
	}

	// Add direction arrow
	if len(closes) >= 2 {
		last := closes[len(closes)-1]
		prev := closes[len(closes)-2]
		if last > prev {
			sb.WriteString(" ↑")
		} else if last < prev {
			sb.WriteString(" ↓")
		} else {
			sb.WriteString(" →")
		}
	}

	return sb.String()
}

// ─── Natural language detection for chart/rug/scope ───────────────────────────

var chartNLPrefixes = []string{
	"chart ", "chart for ", "show chart ", "show me the chart ",
	"show me chart ", "candles ", "candles for ", "ohlcv ",
	"candlestick ", "candlestick for ",
}

var rugNLPrefixes = []string{
	"rug check ", "rugcheck ", "rug ", "is it safe ",
	"is this safe ", "is this a rug ", "check if rug ",
	"safety check ", "risk check ", "risk of ",
	"safe to buy ", "is it a scam ",
}

var scopeNLPrefixes = []string{
	"memescope", "meme scope", "graduating tokens", "graduated tokens",
	"whats graduating", "what's graduating", "what is graduating",
	"new launches", "new tokens launching", "bonding curve",
}

func (d *Daemon) maybeHandleChartRugScopeText(msg bus.InboundMessage, content string) (string, bool) {
	lower := strings.ToLower(strings.TrimSpace(content))

	// Chart detection
	for _, prefix := range chartNLPrefixes {
		if strings.HasPrefix(lower, prefix) {
			query := strings.TrimSpace(content[len(prefix):])
			query = strings.TrimRight(query, "? .!,")
			if query != "" {
				return d.enhancedChartResponse(strings.Fields(query)), true
			}
		}
	}

	// Rug check detection
	for _, prefix := range rugNLPrefixes {
		if strings.HasPrefix(lower, prefix) {
			query := strings.TrimSpace(content[len(prefix):])
			query = strings.TrimRight(query, "? .!,")
			if query != "" {
				fields := strings.Fields(query)
				if len(fields) > 0 {
					return d.rugCheckResponse(fields[:1]), true
				}
			}
		}
	}

	// Scope detection
	for _, prefix := range scopeNLPrefixes {
		if strings.Contains(lower, prefix) {
			return d.scopeResponse(nil), true
		}
	}

	return "", false
}
