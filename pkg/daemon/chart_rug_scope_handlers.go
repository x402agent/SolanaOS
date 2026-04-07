package daemon

import (
	"context"
	"fmt"
	"net/url"
	"strings"
	"time"

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

// ─── Enhanced /chart — Birdeye OHLCV V3 primary, SolanaTracker fallback ─────────

// birdeyeResolutionMap maps user-friendly timeframes to Birdeye V3 resolution codes.
var birdeyeResolutionMap = map[string]string{
	"1s": "1s", "15s": "15s", "30s": "30s",
	"1m": "1m", "3m": "3m", "5m": "5m", "15m": "15m", "30m": "30m",
	"1h": "1H", "2h": "2H", "4h": "4H", "6h": "6H", "8h": "8H", "12h": "12H",
	"1d": "1D", "3d": "3D", "1w": "1W", "1M": "1M",
}

// birdeyeBarSeconds maps resolution to seconds for time range calculation.
var birdeyeBarSeconds = map[string]int64{
	"1s": 1, "15s": 15, "30s": 30,
	"1m": 60, "3m": 180, "5m": 300, "15m": 900, "30m": 1800,
	"1h": 3600, "2h": 7200, "4h": 14400, "6h": 21600, "8h": 28800, "12h": 43200,
	"1d": 86400, "3d": 259200, "1w": 604800, "1M": 2592000,
}

func (d *Daemon) birdeyeClient() *solana.BirdeyeClient {
	apiKey := strings.TrimSpace(d.cfg.Solana.BirdeyeAPIKey)
	if apiKey == "" {
		return nil
	}
	return solana.NewBirdeyeClient(apiKey)
}

func (d *Daemon) enhancedChartResponse(args []string) string {
	if len(args) < 1 {
		return "Usage: `/chart <mint> [1s|1m|5m|15m|30m|1h|4h|1d]`\n\n📊 [Open Memescope](https://seeker.solanaos.net/dex)"
	}
	mint := strings.TrimSpace(args[0])
	tf := "1h"
	if len(args) > 1 {
		tf = strings.ToLower(strings.TrimSpace(args[1]))
	}

	// Try Birdeye OHLCV V3 first
	if bc := d.birdeyeClient(); bc != nil {
		result := d.chartFromBirdeye(bc, mint, tf)
		if result != "" {
			return result
		}
	}

	// Fallback to SolanaTracker
	client, err := d.trackerClient()
	if err != nil {
		return "🌐 Set `BIRDEYE_API_KEY` or `SOLANA_TRACKER_API_KEY` to enable charts."
	}
	return d.chartFromTracker(client, mint, tf)
}

func (d *Daemon) chartFromBirdeye(bc *solana.BirdeyeClient, mint, tf string) string {
	resolution := birdeyeResolutionMap[tf]
	if resolution == "" {
		resolution = "1H"
	}
	barSec := birdeyeBarSeconds[tf]
	if barSec == 0 {
		barSec = 3600
	}

	timeTo := time.Now().Unix()
	timeFrom := timeTo - barSec*300 // ~300 bars

	ohlcv, err := bc.GetOHLCVV3(mint, resolution, timeFrom, timeTo)
	if err != nil || ohlcv == nil || len(ohlcv.Items) == 0 {
		return "" // Fall through to tracker
	}

	// Get token name
	tokenName := mint
	if ov, err := bc.GetTokenOverviewV3(mint); err == nil && ov != nil {
		tokenName = fmt.Sprintf("%s (%s)", ov.Name, ov.Symbol)
	}

	var b strings.Builder
	b.WriteString(fmt.Sprintf("📊 **%s** — %s chart (Birdeye)\n\n", tokenName, tf))

	// Sparkline from last 20 bars
	items := ohlcv.Items
	sparkItems := items
	if len(sparkItems) > 20 {
		sparkItems = sparkItems[len(sparkItems)-20:]
	}
	b.WriteString(asciiSparklineBirdeye(sparkItems) + "\n\n")

	// Last 6 bars
	showItems := items
	if len(showItems) > 6 {
		showItems = showItems[len(showItems)-6:]
	}
	for _, bar := range showItems {
		b.WriteString(fmt.Sprintf("• %s · O %.8f H %.8f L %.8f C %.8f V $%.0f\n",
			unixSecShort(bar.UnixTime), bar.O, bar.H, bar.L, bar.C, bar.VUSD))
	}

	// Price summary
	if len(items) >= 2 {
		first := items[0]
		last := items[len(items)-1]
		change := 0.0
		if first.C > 0 {
			change = ((last.C - first.C) / first.C) * 100
		}
		arrow := "→"
		if change > 0 {
			arrow = "↑"
		} else if change < 0 {
			arrow = "↓"
		}
		b.WriteString(fmt.Sprintf("\n%s **%.2f%%** over %d bars\n", arrow, change, len(items)))
	}

	b.WriteString(fmt.Sprintf("\n📊 [Interactive Chart](https://seeker.solanaos.net/chart/%s)", mint))
	b.WriteString(fmt.Sprintf(" · [Birdeye](https://birdeye.so/token/%s?chain=solana)", mint))

	return strings.TrimSpace(b.String())
}

func (d *Daemon) chartFromTracker(client *solana.SolanaTrackerClient, mint, tf string) string {
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

	tokenName := mint
	if info, err := client.GetToken(mint); err == nil && info != nil {
		tokenName = fmt.Sprintf("%s (%s)", info.Token.Name, info.Token.Symbol)
	}

	var b strings.Builder
	b.WriteString(fmt.Sprintf("📊 **%s** — %s chart (SolanaTracker)\n\n", tokenName, tf))

	bars := resp.OCLHV
	if len(bars) > 20 {
		bars = bars[len(bars)-20:]
	}
	sparkline := asciiSparkline(bars)
	b.WriteString(sparkline + "\n\n")

	showBars := resp.OCLHV
	if len(showBars) > 6 {
		showBars = showBars[len(showBars)-6:]
	}
	for _, bar := range showBars {
		b.WriteString(fmt.Sprintf("• %s · O %.8f H %.8f L %.8f C %.8f V $%.0f\n",
			unixMilliShort(bar.Time), bar.Open, bar.High, bar.Low, bar.Close, bar.Volume))
	}

	b.WriteString(fmt.Sprintf("\n📊 [Interactive Chart](https://seeker.solanaos.net/chart/%s)", mint))
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

// asciiSparklineBirdeye generates a sparkline from Birdeye OHLCV V3 items.
func asciiSparklineBirdeye(items []solana.BirdeyeOHLCVV3Item) string {
	if len(items) == 0 {
		return ""
	}
	chars := []rune("▁▂▃▄▅▆▇█")
	closes := make([]float64, len(items))
	min, max := items[0].C, items[0].C
	for i, bar := range items {
		closes[i] = bar.C
		if bar.C < min {
			min = bar.C
		}
		if bar.C > max {
			max = bar.C
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

// unixSecShort formats a unix timestamp in seconds to a short datetime string.
func unixSecShort(ts int64) string {
	if ts <= 0 {
		return ""
	}
	return time.Unix(ts, 0).UTC().Format("2006-01-02 15:04")
}

// ─── /be — Birdeye help ──────────────────────────────────────────────────────

func (d *Daemon) birdeyeHelpResponse() string {
	return "🦅 **Birdeye Commands**\n\n" +
		"**Charts & Price:**\n" +
		"`/be_chart <mint> [1m|5m|15m|1h|4h|1d]` — OHLCV candlestick chart\n" +
		"`/be_price <mint>` — Current price + multi-timeframe changes\n" +
		"`/be_prices <mint1> <mint2> ...` — Compare prices (max 100)\n" +
		"`/be_token <mint>` — Full token overview (price, mcap, wallets, socials)\n" +
		"`/be_stream <mint> [chart=1m events=10 timeout=30s]` — Live OHLCV stream\n\n" +
		"**Pair Streaming:**\n" +
		"`/pair_new` — Stream newly created pairs\n" +
		"`/pair_price <pairAddr>` — Stream live pair candles\n" +
		"`/pair_txs <pairAddr>` — Stream live pair transactions\n" +
		"`/pair_list_price [list.json]` — Multi-pair price stream\n" +
		"`/pair_list_txs [list.json]` — Multi-pair tx stream\n\n" +
		"`/chart <mint> [tf]` — Chart (Birdeye primary, SolanaTracker fallback)\n\n" +
		"All pair commands accept: `events=N timeout=Xs chain=solana chart=1m`"
}

// ─── /be_chart — Birdeye-only chart command ──────────────────────────────────

func (d *Daemon) birdeyeChartResponse(args []string) string {
	if len(args) < 1 {
		return "Usage: `/be_chart <mint> [1s|1m|5m|15m|1h|4h|1d]`\n\nFetches OHLCV V3 candlestick data from Birdeye."
	}
	bc := d.birdeyeClient()
	if bc == nil {
		return "Set `BIRDEYE_API_KEY` to enable Birdeye charts."
	}
	mint := strings.TrimSpace(args[0])
	tf := "1h"
	if len(args) > 1 {
		tf = strings.ToLower(strings.TrimSpace(args[1]))
	}
	result := d.chartFromBirdeye(bc, mint, tf)
	if result == "" {
		return "No OHLCV data returned from Birdeye for this token."
	}
	return result
}

// ─── /be_price — Current token price from Birdeye ────────────────────────────

func (d *Daemon) birdeyePriceResponse(args []string) string {
	if len(args) < 1 {
		return "Usage: `/be_price <mint>`\n\nFetches current price + 24h change from Birdeye."
	}
	bc := d.birdeyeClient()
	if bc == nil {
		return "Set `BIRDEYE_API_KEY` to enable Birdeye price data."
	}
	mint := strings.TrimSpace(args[0])
	ov, err := bc.GetTokenOverviewV3(mint)
	if err != nil {
		return fmt.Sprintf("Price lookup failed: %v", err)
	}
	if ov == nil {
		return "No data returned."
	}

	var b strings.Builder
	b.WriteString(fmt.Sprintf("**%s (%s)**\n\n", ov.Name, ov.Symbol))
	b.WriteString(fmt.Sprintf("Price: **$%.8f**\n", ov.Price))
	b.WriteString(fmt.Sprintf("MC: $%.0f · FDV: $%.0f · Liq: $%.0f\n", ov.MarketCap, ov.FDV, ov.Liquidity))
	b.WriteString(fmt.Sprintf("\n**Price Changes:**\n"))
	b.WriteString(fmt.Sprintf("• 1m: %+.2f%% · 5m: %+.2f%% · 30m: %+.2f%%\n", ov.PriceChange1mPct, ov.PriceChange5mPct, ov.PriceChange30mPct))
	b.WriteString(fmt.Sprintf("• 1h: %+.2f%% · 4h: %+.2f%% · 24h: %+.2f%%\n", ov.PriceChange1hPct, ov.PriceChange4hPct, ov.PriceChange24hPct))
	b.WriteString(fmt.Sprintf("\n**Wallets (24h):** %d\n", ov.UniqueWallet24h))
	b.WriteString(fmt.Sprintf("\n[Birdeye](https://birdeye.so/token/%s?chain=solana) · [Chart](https://seeker.solanaos.net/chart/%s)", mint, mint))
	return strings.TrimSpace(b.String())
}

// ─── /be_prices — Multi-token price comparison ───────────────────────────────

func (d *Daemon) birdeyeMultiPriceResponse(args []string) string {
	if len(args) < 1 {
		return "Usage: `/be_prices <mint1> <mint2> ...`\n\nFetches prices for multiple tokens (max 100) in one call."
	}
	bc := d.birdeyeClient()
	if bc == nil {
		return "Set `BIRDEYE_API_KEY` to enable Birdeye multi-price."
	}
	addresses := make([]string, 0, len(args))
	for _, a := range args {
		trimmed := strings.TrimSpace(a)
		if trimmed != "" {
			addresses = append(addresses, trimmed)
		}
	}
	if len(addresses) == 0 {
		return "Provide at least one token address."
	}

	prices, err := bc.GetMultiPrice(addresses, true)
	if err != nil {
		return fmt.Sprintf("Multi-price lookup failed: %v", err)
	}
	if len(prices) == 0 {
		return "No price data returned."
	}

	var b strings.Builder
	b.WriteString(fmt.Sprintf("**Multi-Price** (%d tokens)\n\n", len(prices)))
	for addr, p := range prices {
		short := addr
		if len(addr) > 12 {
			short = addr[:4] + "..." + addr[len(addr)-4:]
		}
		arrow := "→"
		if p.PriceChange24h > 0 {
			arrow = "↑"
		} else if p.PriceChange24h < 0 {
			arrow = "↓"
		}
		b.WriteString(fmt.Sprintf("• `%s` — $%.8f %s %+.2f%% · Liq $%.0f\n",
			short, p.Value, arrow, p.PriceChange24h, p.Liquidity))
	}
	return strings.TrimSpace(b.String())
}

// ─── /be_token — Full Birdeye token overview ─────────────────────────────────

func (d *Daemon) birdeyeTokenResponse(args []string) string {
	if len(args) < 1 {
		return "Usage: `/be_token <mint>`\n\nFull token overview from Birdeye: price, market data, trade data, metadata."
	}
	bc := d.birdeyeClient()
	if bc == nil {
		return "Set `BIRDEYE_API_KEY` to enable Birdeye token data."
	}
	mint := strings.TrimSpace(args[0])

	ov, err := bc.GetTokenOverviewV3(mint)
	if err != nil {
		return fmt.Sprintf("Token lookup failed: %v", err)
	}
	if ov == nil {
		return "No data returned."
	}

	var b strings.Builder
	b.WriteString(fmt.Sprintf("**%s (%s)**\n", ov.Name, ov.Symbol))
	b.WriteString(fmt.Sprintf("`%s`\n\n", ov.Address))

	b.WriteString(fmt.Sprintf("**Price:** $%.8f\n", ov.Price))
	b.WriteString(fmt.Sprintf("**Market Cap:** $%.0f\n", ov.MarketCap))
	b.WriteString(fmt.Sprintf("**FDV:** $%.0f\n", ov.FDV))
	b.WriteString(fmt.Sprintf("**Liquidity:** $%.0f\n", ov.Liquidity))
	b.WriteString(fmt.Sprintf("**Holders (24h):** %d\n\n", ov.UniqueWallet24h))

	b.WriteString("**Price Changes:**\n")
	b.WriteString(fmt.Sprintf("• 1m %+.2f%% · 5m %+.2f%% · 30m %+.2f%%\n",
		ov.PriceChange1mPct, ov.PriceChange5mPct, ov.PriceChange30mPct))
	b.WriteString(fmt.Sprintf("• 1h %+.2f%% · 2h %+.2f%% · 4h %+.2f%%\n",
		ov.PriceChange1hPct, ov.PriceChange2hPct, ov.PriceChange4hPct))
	b.WriteString(fmt.Sprintf("• 8h %+.2f%% · 12h %+.2f%% · 24h %+.2f%%\n\n",
		ov.PriceChange8hPct, ov.PriceChange12hPct, ov.PriceChange24hPct))

	b.WriteString("**Unique Wallets:**\n")
	b.WriteString(fmt.Sprintf("• 30m: %d · 1h: %d · 4h: %d · 24h: %d\n\n",
		ov.UniqueWallet30m, ov.UniqueWallet1h, ov.UniqueWallet4h, ov.UniqueWallet24h))

	if ov.Extensions.Website != "" {
		b.WriteString(fmt.Sprintf("Website: %s\n", ov.Extensions.Website))
	}
	if ov.Extensions.Twitter != "" {
		b.WriteString(fmt.Sprintf("Twitter: %s\n", ov.Extensions.Twitter))
	}

	b.WriteString(fmt.Sprintf("\n[Birdeye](https://birdeye.so/token/%s?chain=solana)", mint))
	b.WriteString(fmt.Sprintf(" · [Chart](https://seeker.solanaos.net/chart/%s)", mint))
	return strings.TrimSpace(b.String())
}

// ─── /be_stream — Real-time Birdeye WS price stream for a token ──────────────

func (d *Daemon) birdeyeStreamResponse(args []string) string {
	if len(args) < 1 {
		return "Usage: `/be_stream <mint> [chart=1m] [events=10] [timeout=30s]`\n\nStreams real-time OHLCV price data from Birdeye WebSocket."
	}
	wsClient, err := d.birdeyeWSClient()
	if err != nil {
		return fmt.Sprintf("Set `BIRDEYE_API_KEY` to enable Birdeye streaming: %v", err)
	}

	tokenAddr := strings.TrimSpace(args[0])
	chartType := "1m"
	maxEvents := 10
	timeout := 30 * time.Second

	for _, a := range args[1:] {
		parts := strings.SplitN(a, "=", 2)
		if len(parts) != 2 {
			continue
		}
		switch strings.ToLower(parts[0]) {
		case "chart":
			chartType = parts[1]
		case "events":
			if n := parseInt(parts[1]); n > 0 {
				maxEvents = n
			}
		case "timeout":
			if d, parseErr := time.ParseDuration(parts[1]); parseErr == nil {
				timeout = d
			}
		}
	}

	sub := solana.NewBirdeyeTokenPriceSubscription(tokenAddr, chartType, "usd")

	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	events, err := wsClient.SubscribeAndCollect(ctx, "solana", sub, maxEvents, "PRICE_DATA")
	if err != nil {
		return fmt.Sprintf("Stream error: %v", err)
	}
	if len(events) == 0 {
		return "No price updates received within timeout."
	}

	var b strings.Builder
	b.WriteString(fmt.Sprintf("**Birdeye Stream** — %s (%s, %d events)\n\n", tokenAddr[:8]+"...", chartType, len(events)))

	for _, ev := range events {
		m := solana.ParseBirdeyeEventMap(ev)
		o := solana.BirdeyeMapFloat(m, "o")
		h := solana.BirdeyeMapFloat(m, "h")
		l := solana.BirdeyeMapFloat(m, "l")
		c := solana.BirdeyeMapFloat(m, "c")
		v := solana.BirdeyeMapFloat(m, "v")
		t := solana.BirdeyeMapInt64(m, "unixTime")
		b.WriteString(fmt.Sprintf("• %s O:%.8f H:%.8f L:%.8f C:%.8f V:%.2f\n",
			unixSecShort(t), o, h, l, c, v))
	}

	return strings.TrimSpace(b.String())
}

// parseInt parses a string to int, returning 0 on failure.
func parseInt(s string) int {
	n := 0
	for _, c := range s {
		if c >= '0' && c <= '9' {
			n = n*10 + int(c-'0')
		} else {
			break
		}
	}
	return n
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
