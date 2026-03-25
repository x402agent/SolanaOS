// Package solana :: birdeye_tools.go
// Agent tool definitions for Birdeye API — registered with the MawdBot tool registry.
// These tools give the LLM direct access to Solana token data, search, security, and wallet analytics.
package solana

import (
	"context"
	"fmt"
	"strings"

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
