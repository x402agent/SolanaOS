// Package solana :: birdeye_tools.go
// Agent tool definitions for Birdeye API — registered with the MawdBot tool registry.
// These tools give the LLM direct access to Solana token data, search, security, and wallet analytics.
package solana

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/x402agent/Solana-Os-Go/pkg/tools"
)

// RegisterBirdeyeTools adds all Birdeye data tools to the agent's tool registry.
func RegisterBirdeyeTools(registry *tools.Registry, client *BirdeyeClient) {
	// ── Token Data ───────────────────────────────────────────────

	registry.Register(&tools.ToolDef{
		ToolName: "birdeye_token_overview",
		Desc:     "Get comprehensive Solana token overview — price, multi-timeframe changes, volume, liquidity, market cap, wallet counts. Args: address (token mint)",
		ExecuteFn: func(ctx context.Context, args map[string]any) (string, error) {
			addr := bGetStr(args, "address")
			if addr == "" {
				return "", fmt.Errorf("address required")
			}
			ov, err := client.GetTokenOverviewV3(addr)
			if err != nil {
				return "", err
			}
			return fmt.Sprintf(`## %s (%s)
**Price:** $%.8f
**Market Cap:** $%.0f | **FDV:** $%.0f
**Liquidity:** $%.0f
**24h Holders:** %d

### Price Changes
| 1m | 5m | 30m | 1h | 4h | 24h |
|----|----|-----|----|----|-----|
| %.2f%% | %.2f%% | %.2f%% | %.2f%% | %.2f%% | %.2f%% |

### Unique Wallets
| 30m | 1h | 4h | 24h |
|-----|----|----|-----|
| %d | %d | %d | %d |`,
				ov.Name, ov.Symbol, ov.Price,
				ov.MarketCap, ov.FDV, ov.Liquidity,
				ov.UniqueWallet24h,
				ov.PriceChange1mPct, ov.PriceChange5mPct, ov.PriceChange30mPct,
				ov.PriceChange1hPct, ov.PriceChange4hPct, ov.PriceChange24hPct,
				ov.UniqueWallet30m, ov.UniqueWallet1h, ov.UniqueWallet4h, ov.UniqueWallet24h,
			), nil
		},
	})

	registry.Register(&tools.ToolDef{
		ToolName: "birdeye_token_metadata",
		Desc:     "Get token metadata — symbol, name, decimals, website, twitter, discord, logo. Args: address",
		ExecuteFn: func(ctx context.Context, args map[string]any) (string, error) {
			addr := bGetStr(args, "address")
			if addr == "" {
				return "", fmt.Errorf("address required")
			}
			meta, err := client.GetTokenMetadata(addr)
			if err != nil {
				return "", err
			}
			return fmt.Sprintf("**%s** (%s)\nDecimals: %d\nWebsite: %s\nTwitter: %s\nDiscord: %s\nLogo: %s",
				meta.Name, meta.Symbol, meta.Decimals,
				meta.Extensions.Website, meta.Extensions.Twitter,
				meta.Extensions.Discord, meta.LogoURI), nil
		},
	})

	registry.Register(&tools.ToolDef{
		ToolName: "birdeye_token_market_data",
		Desc:     "Get token market data — price, mcap, fdv, liquidity, supply, holders. Args: address",
		ExecuteFn: func(ctx context.Context, args map[string]any) (string, error) {
			addr := bGetStr(args, "address")
			if addr == "" {
				return "", fmt.Errorf("address required")
			}
			md, err := client.GetTokenMarketData(addr)
			if err != nil {
				return "", err
			}
			return fmt.Sprintf(`**%s**
Price: $%.8f
Market Cap: $%.0f
FDV: $%.0f
Liquidity: $%.0f
Total Supply: %.0f
Circulating: %.0f
Holders: %d`,
				md.Address, md.Price, md.MarketCap, md.FDV,
				md.Liquidity, md.TotalSupply, md.CirculatingSupply, md.Holder), nil
		},
	})

	registry.Register(&tools.ToolDef{
		ToolName: "birdeye_token_trade_data",
		Desc:     "Get token trade data — buy/sell volume, trade counts, unique wallets across timeframes. Args: address",
		ExecuteFn: func(ctx context.Context, args map[string]any) (string, error) {
			addr := bGetStr(args, "address")
			if addr == "" {
				return "", fmt.Errorf("address required")
			}
			td, err := client.GetTokenTradeData(addr)
			if err != nil {
				return "", err
			}
			return fmt.Sprintf(`## Trade Data — %s
**Price:** $%.8f (24h: %.2f%%)
**Volume 24h:** $%.0f (buy: $%.0f / sell: $%.0f)
**Volume 1h:** $%.0f | **Volume 30m:** $%.0f
**Trades 24h:** %d (buy: %d / sell: %d)
**Trades 1h:** %d | **Trades 30m:** %d
**Unique Wallets 24h:** %d | **1h:** %d | **30m:** %d`,
				td.Address, td.Price, td.PriceChange24hPct,
				td.Volume24hUSD, td.VolumeBuy24hUSD, td.VolumeSell24hUSD,
				td.Volume1hUSD, td.Volume30mUSD,
				td.Trade24h, td.Buy24h, td.Sell24h,
				td.Trade1h, td.Trade30m,
				td.UniqueWallet24h, td.UniqueWallet1h, td.UniqueWallet30m), nil
		},
	})

	// ── Price Stats ──────────────────────────────────────────────

	registry.Register(&tools.ToolDef{
		ToolName: "birdeye_price_stats",
		Desc:     "Get price stats (high/low/change) across timeframes. Args: address, timeframes (optional, e.g. '1h,4h,24h,7d')",
		ExecuteFn: func(ctx context.Context, args map[string]any) (string, error) {
			addr := bGetStr(args, "address")
			if addr == "" {
				return "", fmt.Errorf("address required")
			}
			frames := bGetStr(args, "timeframes")
			stats, err := client.GetPriceStats(addr, frames)
			if err != nil {
				return "", err
			}
			var sb strings.Builder
			sb.WriteString("## Price Stats\n\n")
			sb.WriteString("| Timeframe | Price | Change% | High | Low |\n")
			sb.WriteString("|-----------|-------|---------|------|-----|\n")
			for _, item := range stats {
				for _, d := range item.Data {
					sb.WriteString(fmt.Sprintf("| %s | $%.8f | %.2f%% | $%.8f | $%.8f |\n",
						d.TimeFrame, d.Price, d.PriceChangePct, d.High, d.Low))
				}
			}
			return sb.String(), nil
		},
	})

	registry.Register(&tools.ToolDef{
		ToolName: "birdeye_price_stats_multiple",
		Desc:     "Get price stats for multiple tokens (max 20). Args: addresses (comma-separated), timeframes (optional)",
		ExecuteFn: func(ctx context.Context, args map[string]any) (string, error) {
			list := splitListArg(args, "addresses")
			if len(list) == 0 {
				return "", fmt.Errorf("addresses required")
			}
			frames := bGetStr(args, "timeframes")
			stats, err := client.GetPriceStatsMultiple(list, frames)
			if err != nil {
				return "", err
			}
			var sb strings.Builder
			sb.WriteString("## Price Stats (Multiple)\n\n")
			sb.WriteString("| Token | Timeframe | Price | Change% | High | Low |\n")
			sb.WriteString("|-------|-----------|-------|---------|------|-----|\n")
			for _, item := range stats {
				for _, d := range item.Data {
					sb.WriteString(fmt.Sprintf("| %s | %s | $%.8f | %.2f%% | $%.8f | $%.8f |\n",
						item.Address, d.TimeFrame, d.Price, d.PriceChangePct, d.High, d.Low))
				}
			}
			return sb.String(), nil
		},
	})

	// ── Token List & Discovery ───────────────────────────────────

	registry.Register(&tools.ToolDef{
		ToolName: "birdeye_token_list",
		Desc:     "Get sorted/filtered list of Solana tokens. Args: sort_by (liquidity/volume_24h_usd/price_change_24h_percent), limit (1-100), min_liquidity, min_volume_24h, min_market_cap",
		ExecuteFn: func(ctx context.Context, args map[string]any) (string, error) {
			opts := TokenListOpts{
				SortBy:       bGetStr(args, "sort_by"),
				Limit:        bGetInt(args, "limit", 20),
				MinLiquidity: bGetFloat(args, "min_liquidity", 0),
				MinMarketCap: bGetFloat(args, "min_market_cap", 0),
				MinVolume24h: bGetFloat(args, "min_volume_24h", 0),
				MinHolder:    bGetInt(args, "min_holder", 0),
			}
			items, err := client.GetTokenList(opts)
			if err != nil {
				return "", err
			}
			var sb strings.Builder
			sb.WriteString(fmt.Sprintf("## Token List (%d tokens)\n\n", len(items)))
			sb.WriteString("| Symbol | Price | MCap | Liq | Vol24h | Chg24h | Holders |\n")
			sb.WriteString("|--------|-------|------|-----|--------|--------|--------|\n")
			for _, t := range items {
				sb.WriteString(fmt.Sprintf("| %s | $%.6f | $%.0f | $%.0f | $%.0f | %.2f%% | %d |\n",
					t.Symbol, t.Price, t.MarketCap, t.Liquidity,
					t.Volume24hUSD, t.PriceChange24hPct, t.Holder))
			}
			return sb.String(), nil
		},
	})

	registry.Register(&tools.ToolDef{
		ToolName: "birdeye_trending",
		Desc:     "Get trending Solana tokens by rank. Args: limit (default 20)",
		ExecuteFn: func(ctx context.Context, args map[string]any) (string, error) {
			limit := bGetInt(args, "limit", 20)
			tokens, err := client.GetTrendingV3(limit)
			if err != nil {
				return "", err
			}
			var sb strings.Builder
			sb.WriteString(fmt.Sprintf("## Trending Tokens (%d)\n\n", len(tokens)))
			for i, t := range tokens {
				sb.WriteString(fmt.Sprintf("%d. **%s** ($%.6f) MCap: $%.0f Vol24h: $%.0f Chg: %.2f%%\n",
					i+1, t.Symbol, t.Price, t.MarketCap, t.Volume24hUSD, t.PriceChange24hPct))
			}
			return sb.String(), nil
		},
	})

	registry.Register(&tools.ToolDef{
		ToolName: "birdeye_new_listings",
		Desc:     "Get recently listed Solana tokens. Args: limit (default 20)",
		ExecuteFn: func(ctx context.Context, args map[string]any) (string, error) {
			limit := bGetInt(args, "limit", 20)
			items, err := client.GetNewListingTokens(limit)
			if err != nil {
				return "", err
			}
			var sb strings.Builder
			sb.WriteString(fmt.Sprintf("## New Listings (%d)\n\n", len(items)))
			for _, t := range items {
				sb.WriteString(fmt.Sprintf("- **%s** (%s) $%.8f Liq: $%.0f MCap: $%.0f\n",
					t.Name, t.Symbol, t.Price, t.Liquidity, t.MarketCap))
			}
			return sb.String(), nil
		},
	})

	registry.Register(&tools.ToolDef{
		ToolName: "birdeye_token_list_scroll",
		Desc:     "Get up to 5000 tokens via v3 scroll API. Args: limit (default 5000), scroll_id (optional), sort_by, sort_type, min_liquidity",
		ExecuteFn: func(ctx context.Context, args map[string]any) (string, error) {
			opts := TokenListOpts{
				SortBy:       bGetStr(args, "sort_by"),
				SortType:     bGetStr(args, "sort_type"),
				MinLiquidity: bGetFloat(args, "min_liquidity", 0),
				MinMarketCap: bGetFloat(args, "min_market_cap", 0),
				MinVolume24h: bGetFloat(args, "min_volume_24h", 0),
				MinHolder:    bGetInt(args, "min_holder", 0),
			}
			limit := bGetInt(args, "limit", 5000)
			scrollID := bGetStr(args, "scroll_id")
			page, err := client.GetTokenListScroll(opts, scrollID, limit)
			if err != nil {
				return "", err
			}
			var sb strings.Builder
			sb.WriteString(fmt.Sprintf("## Token List Scroll (%d tokens)\n", len(page.Items)))
			if strings.TrimSpace(page.NextScrollID) != "" {
				sb.WriteString(fmt.Sprintf("next_scroll_id: `%s`\n", page.NextScrollID))
			}
			sb.WriteString("\n")
			for i, t := range page.Items {
				if i >= 25 {
					break
				}
				sb.WriteString(fmt.Sprintf("%d. **%s** $%.6f Liq:$%.0f Vol24h:$%.0f\n", i+1, t.Symbol, t.Price, t.Liquidity, t.Volume24hUSD))
			}
			if len(page.Items) > 25 {
				sb.WriteString("\n...truncated to 25 rows in preview")
			}
			return sb.String(), nil
		},
	})

	registry.Register(&tools.ToolDef{
		ToolName: "birdeye_token_list_v1",
		Desc:     "Get legacy token list v1. Args: sort_by (mc/v24hUSD/v24hChangePercent/liquidity), sort_type, offset, limit, min_liquidity",
		ExecuteFn: func(ctx context.Context, args map[string]any) (string, error) {
			items, total, err := client.GetTokenListV1(
				bGetStr(args, "sort_by"),
				bGetStr(args, "sort_type"),
				bGetInt(args, "offset", 0),
				bGetInt(args, "limit", 50),
				bGetFloat(args, "min_liquidity", 0),
			)
			if err != nil {
				return "", err
			}
			var sb strings.Builder
			sb.WriteString(fmt.Sprintf("## Token List V1 (%d returned / total %d)\n\n", len(items), total))
			for i, t := range items {
				sb.WriteString(fmt.Sprintf("%d. **%s** $%.6f MC:$%.0f Liq:$%.0f Vol24h:$%.0f\n", i+1, t.Symbol, t.Price, t.MC, t.Liquidity, t.V24hUSD))
			}
			return sb.String(), nil
		},
	})

	registry.Register(&tools.ToolDef{
		ToolName: "birdeye_token_all_markets",
		Desc:     "Get all markets for a token. Args: address, time_frame (24h), sort_by (liquidity/volume24h), sort_type, offset, limit",
		ExecuteFn: func(ctx context.Context, args map[string]any) (string, error) {
			addr := bGetStr(args, "address")
			if addr == "" {
				return "", fmt.Errorf("address required")
			}
			items, total, err := client.GetTokenAllMarkets(
				addr,
				bGetStr(args, "time_frame"),
				bGetStr(args, "sort_by"),
				bGetStr(args, "sort_type"),
				bGetInt(args, "offset", 0),
				bGetInt(args, "limit", 10),
			)
			if err != nil {
				return "", err
			}
			var sb strings.Builder
			sb.WriteString(fmt.Sprintf("## Token Markets (%d returned / total %d)\n\n", len(items), total))
			for i, m := range items {
				sb.WriteString(fmt.Sprintf("%d. **%s** %s/%s Liq:$%.0f Vol24h:$%.0f Trades24h:%d\n", i+1, m.Source, m.Base.Symbol, m.Quote.Symbol, m.Liquidity, m.Volume24h, m.Trade24h))
			}
			return sb.String(), nil
		},
	})

	// ── Search ───────────────────────────────────────────────────

	registry.Register(&tools.ToolDef{
		ToolName: "birdeye_search",
		Desc:     "Search for Solana tokens by keyword (name or symbol). Args: keyword, limit (default 10)",
		ExecuteFn: func(ctx context.Context, args map[string]any) (string, error) {
			keyword := bGetStr(args, "keyword")
			if keyword == "" {
				return "", fmt.Errorf("keyword required")
			}
			limit := bGetInt(args, "limit", 10)
			results, err := client.SearchToken(keyword, limit)
			if err != nil {
				return "", err
			}
			var sb strings.Builder
			sb.WriteString(fmt.Sprintf("## Search: '%s' (%d results)\n\n", keyword, len(results)))
			for _, r := range results {
				sb.WriteString(fmt.Sprintf("- **%s** (%s) $%.8f Liq: $%.0f Vol24h: $%.0f\n  `%s`\n",
					r.Name, r.Symbol, r.Price, r.Liquidity, r.Volume24h, r.Address))
			}
			return sb.String(), nil
		},
	})

	// ── Transactions ─────────────────────────────────────────────

	registry.Register(&tools.ToolDef{
		ToolName: "birdeye_token_trades",
		Desc:     "Get recent trades for a token. Args: address, limit (default 20), tx_type (swap/buy/sell/all)",
		ExecuteFn: func(ctx context.Context, args map[string]any) (string, error) {
			addr := bGetStr(args, "address")
			if addr == "" {
				return "", fmt.Errorf("address required")
			}
			limit := bGetInt(args, "limit", 20)
			txType := bGetStr(args, "tx_type")
			if txType == "" {
				txType = "swap"
			}
			trades, hasNext, err := client.GetTokenTrades(addr, limit, txType)
			if err != nil {
				return "", err
			}
			var sb strings.Builder
			sb.WriteString(fmt.Sprintf("## Recent Trades (%d, more: %v)\n\n", len(trades), hasNext))
			for _, t := range trades {
				fromSym, toSym := "", ""
				if t.From != nil {
					fromSym = t.From.Symbol
				}
				if t.To != nil {
					toSym = t.To.Symbol
				}
				sb.WriteString(fmt.Sprintf("  %s %s→%s $%.2f (%s) via %s\n",
					t.TxType, fromSym, toSym, t.VolumeUSD, t.Owner[:8]+"...", t.Source))
			}
			return sb.String(), nil
		},
	})

	registry.Register(&tools.ToolDef{
		ToolName: "birdeye_pair_trades",
		Desc:     "Get recent trades for a pair. Args: address (pair address), limit, tx_type (swap/add/remove/all), sort_type",
		ExecuteFn: func(ctx context.Context, args map[string]any) (string, error) {
			addr := bGetStr(args, "address")
			if addr == "" {
				return "", fmt.Errorf("address required")
			}
			trades, hasNext, err := client.GetPairTrades(
				addr,
				bGetInt(args, "limit", 50),
				bGetStr(args, "tx_type"),
				bGetStr(args, "sort_type"),
			)
			if err != nil {
				return "", err
			}
			var sb strings.Builder
			sb.WriteString(fmt.Sprintf("## Pair Trades (%d, more: %v)\n\n", len(trades), hasNext))
			for _, t := range trades {
				sb.WriteString(fmt.Sprintf("- %s %s→%s owner:%s source:%s\n", t.TxType, t.From.Symbol, t.To.Symbol, shortenAddrSafe(t.Owner), t.Source))
			}
			return sb.String(), nil
		},
	})

	registry.Register(&tools.ToolDef{
		ToolName: "birdeye_whale_trades",
		Desc:     "Get large trades for a token filtered by volume. Args: address, min_volume (USD), max_volume (optional), limit",
		ExecuteFn: func(ctx context.Context, args map[string]any) (string, error) {
			addr := bGetStr(args, "address")
			if addr == "" {
				return "", fmt.Errorf("address required")
			}
			minVol := bGetFloat(args, "min_volume", 10000)
			maxVol := bGetFloat(args, "max_volume", 0)
			limit := bGetInt(args, "limit", 20)
			trades, err := client.GetTokenTradesByVolume(addr, minVol, maxVol, limit)
			if err != nil {
				return "", err
			}
			var sb strings.Builder
			sb.WriteString(fmt.Sprintf("## Whale Trades (>$%.0f, %d found)\n\n", minVol, len(trades)))
			for _, t := range trades {
				sb.WriteString(fmt.Sprintf("  $%.0f — %s by %s via %s\n",
					t.VolumeUSD, t.TxType, t.Owner[:8]+"...", t.Source))
			}
			return sb.String(), nil
		},
	})

	// ── Security ─────────────────────────────────────────────────

	registry.Register(&tools.ToolDef{
		ToolName: "birdeye_token_security",
		Desc:     "Get security analysis for a token — owner balance, top10 holder %, freeze/mint authority, mutability. Args: address",
		ExecuteFn: func(ctx context.Context, args map[string]any) (string, error) {
			addr := bGetStr(args, "address")
			if addr == "" {
				return "", fmt.Errorf("address required")
			}
			sec, err := client.GetTokenSecurity(addr)
			if err != nil {
				return "", err
			}
			return fmt.Sprintf(`## Security: %s
Owner: %s (%.2f%%)
Creator: %s (balance: %.2f)
Top 10 Holders: %.2f%%
Mutable: %v
Mint Authority: %s
Freeze Authority: %s`,
				addr,
				sec.OwnerAddress, sec.OwnerPercentage,
				sec.CreatorAddress, sec.CreatorBalance,
				sec.Top10Percentage,
				sec.IsMutable,
				sec.HasMintAuth, sec.HasFreezeAuth), nil
		},
	})

	// ── Token Creation ───────────────────────────────────────────

	registry.Register(&tools.ToolDef{
		ToolName: "birdeye_token_creation",
		Desc:     "Get creation transaction info for a token — deployer wallet, tx hash, time. Args: address",
		ExecuteFn: func(ctx context.Context, args map[string]any) (string, error) {
			addr := bGetStr(args, "address")
			if addr == "" {
				return "", fmt.Errorf("address required")
			}
			info, err := client.GetTokenCreationInfo(addr)
			if err != nil {
				return "", err
			}
			return fmt.Sprintf("**%s** (%s)\nDeployer: %s\nTx: %s\nSlot: %d\nTime: %s",
				info.Name, info.Symbol, info.Owner, info.TxHash, info.Slot, info.BlockHumanTime), nil
		},
	})

	// ── Pair ─────────────────────────────────────────────────────

	registry.Register(&tools.ToolDef{
		ToolName: "birdeye_pair_overview",
		Desc:     "Get pair/pool overview — liquidity, volume, trades, price. Args: address (pair contract address)",
		ExecuteFn: func(ctx context.Context, args map[string]any) (string, error) {
			addr := bGetStr(args, "address")
			if addr == "" {
				return "", fmt.Errorf("address required")
			}
			pair, err := client.GetPairOverview(addr)
			if err != nil {
				return "", err
			}
			return fmt.Sprintf(`## Pair: %s (%s)
**Base:** %s | **Quote:** %s
**Price:** $%.8f
**Liquidity:** $%.0f
**Volume 24h:** $%.0f | **1h:** $%.0f
**Trades 24h:** %d
**Unique Wallets 24h:** %d
**Source:** %s | **Created:** %s`,
				pair.Name, pair.Address,
				pair.Base.Symbol, pair.Quote.Symbol,
				pair.Price, pair.Liquidity,
				pair.Volume24h, pair.Volume1h,
				pair.Trade24h, pair.UniqueWallet24h,
				pair.Source, pair.CreatedAt), nil
		},
	})

	// ── Wallet ───────────────────────────────────────────────────

	registry.Register(&tools.ToolDef{
		ToolName: "birdeye_wallet_balance",
		Desc:     "Get a single token balance in a wallet. Args: wallet (wallet address), token_address",
		ExecuteFn: func(ctx context.Context, args map[string]any) (string, error) {
			wallet := bGetStr(args, "wallet")
			tokenAddr := bGetStr(args, "token_address")
			if wallet == "" || tokenAddr == "" {
				return "", fmt.Errorf("wallet and token_address required")
			}
			bal, err := client.GetWalletSingleTokenBalance(wallet, tokenAddr)
			if err != nil {
				return "", err
			}
			return fmt.Sprintf("**%s** (%s)\nBalance: %.6f\nPrice: $%.8f\nValue: $%s",
				bal.Name, bal.Symbol, bal.Amount, bal.Price, bal.Value), nil
		},
	})

	registry.Register(&tools.ToolDef{
		ToolName: "birdeye_wallet_changes",
		Desc:     "Get balance change history for a wallet. Args: wallet (wallet address), limit (default 20)",
		ExecuteFn: func(ctx context.Context, args map[string]any) (string, error) {
			wallet := bGetStr(args, "wallet")
			if wallet == "" {
				return "", fmt.Errorf("wallet required")
			}
			limit := bGetInt(args, "limit", 20)
			changes, err := client.GetWalletBalanceChanges(wallet, limit)
			if err != nil {
				return "", err
			}
			var sb strings.Builder
			sb.WriteString(fmt.Sprintf("## Balance Changes (%d)\n\n", len(changes)))
			for _, c := range changes {
				sym := ""
				if c.TokenInfo != nil {
					sym = c.TokenInfo.Symbol
				}
				sb.WriteString(fmt.Sprintf("  %s %s %s %s (%s)\n",
					c.Time, sym, c.ChangeTypeText, c.Amount, c.TxHash[:12]+"..."))
			}
			return sb.String(), nil
		},
	})

	registry.Register(&tools.ToolDef{
		ToolName: "birdeye_wallet_networth",
		Desc:     "Get wallet current net worth and holdings. Args: wallet, limit",
		ExecuteFn: func(ctx context.Context, args map[string]any) (string, error) {
			wallet := bGetStr(args, "wallet")
			if wallet == "" {
				return "", fmt.Errorf("wallet required")
			}
			data, err := client.GetWalletCurrentNetWorth(wallet, bGetInt(args, "limit", 20))
			if err != nil {
				return "", err
			}
			var sb strings.Builder
			sb.WriteString(fmt.Sprintf("## Wallet Net Worth\nWallet: `%s`\nTotal: **%s %s**\n\n", data.WalletAddress, data.TotalValue, strings.ToUpper(data.Currency)))
			for i, item := range data.Items {
				if i >= 15 {
					break
				}
				sb.WriteString(fmt.Sprintf("%d. %s %.6f (value %s)\n", i+1, item.Symbol, item.Amount, item.Value))
			}
			return sb.String(), nil
		},
	})

	registry.Register(&tools.ToolDef{
		ToolName: "birdeye_wallet_pnl_summary",
		Desc:     "Get wallet PnL summary. Args: wallet, duration (all/90d/30d/7d/24h)",
		ExecuteFn: func(ctx context.Context, args map[string]any) (string, error) {
			wallet := bGetStr(args, "wallet")
			if wallet == "" {
				return "", fmt.Errorf("wallet required")
			}
			pnl, err := client.GetWalletPnLSummary(wallet, bGetStr(args, "duration"))
			if err != nil {
				return "", err
			}
			s := pnl.Summary
			return fmt.Sprintf("## Wallet PnL Summary\nUnique tokens: %d\nTrades: %d (buy %d / sell %d)\nWin rate: %.2f%%\nInvested: $%.2f\nSold: $%.2f\nRealized: $%.2f\nUnrealized: $%.2f\nTotal: $%.2f",
				s.UniqueTokens,
				s.Counts.TotalTrade, s.Counts.TotalBuy, s.Counts.TotalSell,
				s.Counts.WinRate,
				s.CashflowUSD.TotalInvested, s.CashflowUSD.TotalSold,
				s.PnL.RealizedProfitUSD, s.PnL.UnrealizedUSD, s.PnL.TotalUSD,
			), nil
		},
	})

	registry.Register(&tools.ToolDef{
		ToolName: "birdeye_wallet_pnl_details",
		Desc:     "Get wallet PnL details by token. Args: wallet, duration, token_addresses (optional comma list), limit",
		ExecuteFn: func(ctx context.Context, args map[string]any) (string, error) {
			wallet := bGetStr(args, "wallet")
			if wallet == "" {
				return "", fmt.Errorf("wallet required")
			}
			details, err := client.GetWalletPnLDetails(
				wallet,
				splitListArg(args, "token_addresses"),
				bGetStr(args, "duration"),
				bGetInt(args, "limit", 10),
				bGetInt(args, "offset", 0),
			)
			if err != nil {
				return "", err
			}
			var sb strings.Builder
			sb.WriteString("## Wallet PnL Details\n\n")
			for i, t := range details.Tokens {
				sb.WriteString(fmt.Sprintf("%d. %s total:$%.2f realized:$%.2f unrealized:$%.2f trades:%d\n", i+1, t.Symbol, t.PnL.TotalUSD, t.PnL.RealizedProfitUSD, t.PnL.UnrealizedUSD, t.Counts.TotalTrade))
			}
			return sb.String(), nil
		},
	})

	registry.Register(&tools.ToolDef{
		ToolName: "birdeye_wallet_tx_history",
		Desc:     "Get wallet transaction history (beta). Args: wallet, limit, before",
		ExecuteFn: func(ctx context.Context, args map[string]any) (string, error) {
			wallet := bGetStr(args, "wallet")
			if wallet == "" {
				return "", fmt.Errorf("wallet required")
			}
			rows, err := client.GetWalletTransactionHistory(wallet, bGetInt(args, "limit", 100), bGetStr(args, "before"))
			if err != nil {
				return "", err
			}
			var sb strings.Builder
			sb.WriteString(fmt.Sprintf("## Wallet TX History (%d)\n\n", len(rows)))
			for i, row := range rows {
				if i >= 20 {
					break
				}
				txHash := fmt.Sprintf("%v", row["txHash"])
				action := fmt.Sprintf("%v", row["mainAction"])
				time := fmt.Sprintf("%v", row["blockTime"])
				sb.WriteString(fmt.Sprintf("%d. %s %s %s\n", i+1, action, shortenAddrSafe(txHash), time))
			}
			return sb.String(), nil
		},
	})

	registry.Register(&tools.ToolDef{
		ToolName: "birdeye_transfer_totals",
		Desc:     "Get transfer totals for token and wallet filters. Args: token_address (optional), wallet (optional)",
		ExecuteFn: func(ctx context.Context, args map[string]any) (string, error) {
			tokenAddr := bGetStr(args, "token_address")
			wallet := bGetStr(args, "wallet")
			var out []string
			if tokenAddr != "" {
				total, err := client.GetTokenTransferTotal(tokenAddr)
				if err != nil {
					return "", err
				}
				out = append(out, fmt.Sprintf("Token transfer total: %d", total))
			}
			if wallet != "" {
				total, err := client.GetWalletTransferTotal(wallet)
				if err != nil {
					return "", err
				}
				out = append(out, fmt.Sprintf("Wallet transfer total: %d", total))
			}
			if len(out) == 0 {
				return "", fmt.Errorf("token_address and/or wallet required")
			}
			return strings.Join(out, "\n"), nil
		},
	})

	registry.Register(&tools.ToolDef{
		ToolName: "birdeye_smart_money_tokens",
		Desc:     "Get smart-money token list. Args: interval (1d/7d/30d), trader_style, sort_by, sort_type, limit",
		ExecuteFn: func(ctx context.Context, args map[string]any) (string, error) {
			items, err := client.GetSmartMoneyTokenList(
				bGetStr(args, "interval"),
				bGetStr(args, "trader_style"),
				bGetStr(args, "sort_by"),
				bGetStr(args, "sort_type"),
				bGetInt(args, "offset", 0),
				bGetInt(args, "limit", 20),
			)
			if err != nil {
				return "", err
			}
			var sb strings.Builder
			sb.WriteString(fmt.Sprintf("## Smart Money Tokens (%d)\n\n", len(items)))
			for i, t := range items {
				sb.WriteString(fmt.Sprintf("%d. %s (%s) netFlow:$%.0f smartTraders:%d chg:%.2f%%\n", i+1, t.Name, t.Symbol, t.NetFlow, t.SmartTradersNo, t.PriceChangePct))
			}
			return sb.String(), nil
		},
	})

	registry.Register(&tools.ToolDef{
		ToolName: "birdeye_alltime_trades",
		Desc:     "Get all-time/duration trade aggregates. Args: address (single) or addresses (comma list), time_frame",
		ExecuteFn: func(ctx context.Context, args map[string]any) (string, error) {
			tf := bGetStr(args, "time_frame")
			addr := bGetStr(args, "address")
			list := splitListArg(args, "addresses")
			var rows []AllTimeTradesItem
			var err error
			if addr != "" {
				rows, err = client.GetAllTimeTradesSingle(addr, tf)
			} else {
				if len(list) == 0 {
					return "", fmt.Errorf("address or addresses required")
				}
				rows, err = client.GetAllTimeTradesMultiple(list, tf)
			}
			if err != nil {
				return "", err
			}
			var sb strings.Builder
			sb.WriteString(fmt.Sprintf("## All-time Trades (%d)\n\n", len(rows)))
			for _, r := range rows {
				sb.WriteString(fmt.Sprintf("- %s trades:%d buy:%d sell:%d volUSD:$%.0f\n", r.Address, r.TotalTrade, r.Buy, r.Sell, r.TotalVolumeUSD))
			}
			return sb.String(), nil
		},
	})

	registry.Register(&tools.ToolDef{
		ToolName: "birdeye_meme_detail",
		Desc:     "Get meme token detail for one token. Args: address",
		ExecuteFn: func(ctx context.Context, args map[string]any) (string, error) {
			addr := bGetStr(args, "address")
			if addr == "" {
				return "", fmt.Errorf("address required")
			}
			d, err := client.GetMemeTokenDetail(addr)
			if err != nil {
				return "", err
			}
			return fmt.Sprintf("## Meme Token\n%s (%s)\nPrice:$%.8f MC:$%.0f Liq:$%.0f\nAddress:%s", d.Name, d.Symbol, d.Price, d.MarketCap, d.Liquidity, d.Address), nil
		},
	})

	registry.Register(&tools.ToolDef{
		ToolName: "birdeye_meme_list",
		Desc:     "Get meme token list. Args: sort_by, sort_type, source, offset, limit",
		ExecuteFn: func(ctx context.Context, args map[string]any) (string, error) {
			items, hasNext, err := client.GetMemeTokenList(
				bGetStr(args, "sort_by"),
				bGetStr(args, "sort_type"),
				bGetStr(args, "source"),
				bGetInt(args, "offset", 0),
				bGetInt(args, "limit", 20),
			)
			if err != nil {
				return "", err
			}
			var sb strings.Builder
			sb.WriteString(fmt.Sprintf("## Meme Token List (%d, more:%v)\n\n", len(items), hasNext))
			for i, m := range items {
				sb.WriteString(fmt.Sprintf("%d. %s (%s) progress:%.2f%% MC:$%.0f Vol24h:$%.0f\n", i+1, m.Name, m.Symbol, m.ProgressPercent, m.MarketCap, m.Volume24hUSD))
			}
			return sb.String(), nil
		},
	})

	registry.Register(&tools.ToolDef{
		ToolName: "birdeye_exit_liquidity",
		Desc:     "Get exit liquidity (base chain endpoint). Args: address",
		ExecuteFn: func(ctx context.Context, args map[string]any) (string, error) {
			addr := bGetStr(args, "address")
			if addr == "" {
				return "", fmt.Errorf("address required")
			}
			x, err := client.GetTokenExitLiquidity(addr)
			if err != nil {
				return "", err
			}
			return fmt.Sprintf("## Exit Liquidity\n%s (%s)\nPrice:%s %.6f\nLiquidity:$%.0f\nExit Liquidity:$%.0f", x.Name, x.Symbol, x.Currency, x.Price.Value, x.Liquidity, x.ExitLiquidity), nil
		},
	})

	// ── Mint/Burn ────────────────────────────────────────────────

	registry.Register(&tools.ToolDef{
		ToolName: "birdeye_mint_burn",
		Desc:     "Get mint/burn transactions for a token. Args: address, type (all/mint/burn), limit (default 20)",
		ExecuteFn: func(ctx context.Context, args map[string]any) (string, error) {
			addr := bGetStr(args, "address")
			if addr == "" {
				return "", fmt.Errorf("address required")
			}
			mbType := bGetStr(args, "type")
			limit := bGetInt(args, "limit", 20)
			txs, err := client.GetMintBurnTxs(addr, mbType, limit)
			if err != nil {
				return "", err
			}
			var sb strings.Builder
			sb.WriteString(fmt.Sprintf("## Mint/Burn Txs (%d)\n\n", len(txs)))
			for _, t := range txs {
				sb.WriteString(fmt.Sprintf("  %s — %s %.4f @ slot %d (%s)\n",
					t.CommonType, t.Amount, t.UIAmount, t.Slot, t.BlockHumanTime))
			}
			return sb.String(), nil
		},
	})

	// ── Blockchain ───────────────────────────────────────────────

	registry.Register(&tools.ToolDef{
		ToolName: "birdeye_latest_block",
		Desc:     "Get the latest Solana block number from Birdeye",
		ExecuteFn: func(ctx context.Context, args map[string]any) (string, error) {
			block, err := client.GetLatestBlockNumber()
			if err != nil {
				return "", err
			}
			return fmt.Sprintf("Latest Solana block: %d", block), nil
		},
	})

	// ── OHLCV V3 ────────────────────────────────────────────────

	registry.Register(&tools.ToolDef{
		ToolName: "birdeye_ohlcv",
		Desc:     "Get OHLCV candlestick data for a Solana token via Birdeye V3 API. Args: address (token mint), resolution (1s/1m/5m/15m/1H/4H/1D, default 1H), bars (number of bars, default 100)",
		ExecuteFn: func(ctx context.Context, args map[string]any) (string, error) {
			addr := bGetStr(args, "address")
			if addr == "" {
				return "", fmt.Errorf("address required")
			}
			resolution := bGetStr(args, "resolution")
			if resolution == "" {
				resolution = "1H"
			}
			bars := bGetInt(args, "bars", 100)

			barSecMap := map[string]int64{
				"1s": 1, "15s": 15, "30s": 30,
				"1m": 60, "3m": 180, "5m": 300, "15m": 900, "30m": 1800,
				"1H": 3600, "2H": 7200, "4H": 14400, "6H": 21600, "8H": 28800, "12H": 43200,
				"1D": 86400, "3D": 259200, "1W": 604800, "1M": 2592000,
			}
			barSec := barSecMap[resolution]
			if barSec == 0 {
				barSec = 3600
			}

			now := time.Now().Unix()
			timeFrom := now - barSec*int64(bars)

			ohlcv, err := client.GetOHLCVV3(addr, resolution, timeFrom, now)
			if err != nil {
				return "", err
			}
			if ohlcv == nil || len(ohlcv.Items) == 0 {
				return "No OHLCV data returned.", nil
			}

			var sb strings.Builder
			sb.WriteString(fmt.Sprintf("## OHLCV %s — %d bars\n\n", resolution, len(ohlcv.Items)))
			sb.WriteString("| Time | Open | High | Low | Close | Vol USD |\n")
			sb.WriteString("|------|------|------|-----|-------|--------|\n")

			items := ohlcv.Items
			if len(items) > 20 {
				items = items[len(items)-20:]
			}
			for _, bar := range items {
				sb.WriteString(fmt.Sprintf("| %s | %.8f | %.8f | %.8f | %.8f | $%.0f |\n",
					time.Unix(bar.UnixTime, 0).UTC().Format("01-02 15:04"),
					bar.O, bar.H, bar.L, bar.C, bar.VUSD))
			}

			if len(ohlcv.Items) >= 2 {
				first := ohlcv.Items[0]
				last := ohlcv.Items[len(ohlcv.Items)-1]
				change := 0.0
				if first.C > 0 {
					change = ((last.C - first.C) / first.C) * 100
				}
				sb.WriteString(fmt.Sprintf("\n**Change:** %.2f%% over %d bars", change, len(ohlcv.Items)))
			}

			return sb.String(), nil
		},
	})

	// ── Historical Price ────────────────────────────────────────

	registry.Register(&tools.ToolDef{
		ToolName: "birdeye_history_price",
		Desc:     "Get historical price line chart for a Solana token. Args: address (token mint), resolution (1m/5m/15m/1H/4H/1D, default 1H), bars (number of data points, default 100)",
		ExecuteFn: func(ctx context.Context, args map[string]any) (string, error) {
			addr := bGetStr(args, "address")
			if addr == "" {
				return "", fmt.Errorf("address required")
			}
			resolution := bGetStr(args, "resolution")
			if resolution == "" {
				resolution = "1H"
			}
			bars := bGetInt(args, "bars", 100)

			barSecMap := map[string]int64{
				"1m": 60, "5m": 300, "15m": 900, "30m": 1800,
				"1H": 3600, "4H": 14400, "1D": 86400,
			}
			barSec := barSecMap[resolution]
			if barSec == 0 {
				barSec = 3600
			}

			now := time.Now().Unix()
			timeFrom := now - barSec*int64(bars)

			history, err := client.GetHistoryPrice(addr, resolution, timeFrom, now)
			if err != nil {
				return "", err
			}
			if history == nil || len(history.Items) == 0 {
				return "No historical price data returned.", nil
			}

			var sb strings.Builder
			sb.WriteString(fmt.Sprintf("## Price History %s — %d points\n\n", resolution, len(history.Items)))

			items := history.Items
			if len(items) > 30 {
				items = items[len(items)-30:]
			}
			for _, pt := range items {
				sb.WriteString(fmt.Sprintf("  %s — $%.8f\n",
					time.Unix(pt.UnixTime, 0).UTC().Format("01-02 15:04"), pt.Value))
			}

			if len(history.Items) >= 2 {
				first := history.Items[0]
				last := history.Items[len(history.Items)-1]
				change := 0.0
				if first.Value > 0 {
					change = ((last.Value - first.Value) / first.Value) * 100
				}
				sb.WriteString(fmt.Sprintf("\n**Change:** %.2f%%", change))
			}

			return sb.String(), nil
		},
	})

	// ── Multi-Price ─────────────────────────────────────────────

	registry.Register(&tools.ToolDef{
		ToolName: "birdeye_multi_price",
		Desc:     "Get current prices for multiple Solana tokens in one request (max 100). Args: addresses (comma-separated token mints)",
		ExecuteFn: func(ctx context.Context, args map[string]any) (string, error) {
			addrs := splitListArg(args, "addresses")
			if len(addrs) == 0 {
				return "", fmt.Errorf("addresses required (comma-separated)")
			}

			prices, err := client.GetMultiPrice(addrs, true)
			if err != nil {
				return "", err
			}
			if len(prices) == 0 {
				return "No price data returned.", nil
			}

			var sb strings.Builder
			sb.WriteString(fmt.Sprintf("## Prices (%d tokens)\n\n", len(prices)))
			sb.WriteString("| Token | Price | 24h Change | Liquidity |\n")
			sb.WriteString("|-------|-------|-----------|----------|\n")

			for addr, p := range prices {
				sb.WriteString(fmt.Sprintf("| %s | $%.8f | %.2f%% | $%.0f |\n",
					shortenAddrSafe(addr), p.Value, p.PriceChange24h, p.Liquidity))
			}

			return sb.String(), nil
		},
	})
}

// ── Arg helpers ──────────────────────────────────────────────────────

func bGetStr(args map[string]any, key string) string {
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

func bGetFloat(args map[string]any, key string, dflt float64) float64 {
	v, ok := args[key]
	if !ok {
		return dflt
	}
	if f, ok := v.(float64); ok {
		return f
	}
	return dflt
}

func bGetInt(args map[string]any, key string, dflt int) int {
	v, ok := args[key]
	if !ok {
		return dflt
	}
	if f, ok := v.(float64); ok {
		return int(f)
	}
	if i, ok := v.(int); ok {
		return i
	}
	return dflt
}

func splitListArg(args map[string]any, key string) []string {
	raw := strings.TrimSpace(bGetStr(args, key))
	if raw == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		item := strings.TrimSpace(p)
		if item != "" {
			out = append(out, item)
		}
	}
	return out
}

func shortenAddrSafe(addr string) string {
	raw := strings.TrimSpace(addr)
	if len(raw) <= 12 {
		return raw
	}
	return raw[:4] + "..." + raw[len(raw)-4:]
}
