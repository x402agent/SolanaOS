package daemon

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/x402agent/Solana-Os-Go/pkg/solana"
)

type pairWatchOptions struct {
	chain     string
	chartType string
	maxEvents int
	timeout   time.Duration
	listPath  string
}

func defaultPairWatchOptions() pairWatchOptions {
	return pairWatchOptions{
		chain:     "solana",
		chartType: "1m",
		maxEvents: 3,
		timeout:   20 * time.Second,
	}
}

func parsePairWatchArgs(args []string) (pairWatchOptions, []string) {
	opts := defaultPairWatchOptions()
	positionals := make([]string, 0, len(args))

	for _, raw := range args {
		token := strings.TrimSpace(raw)
		if token == "" {
			continue
		}

		key, value, hasKV := strings.Cut(token, "=")
		if !hasKV {
			positionals = append(positionals, token)
			continue
		}

		k := strings.TrimLeft(strings.ToLower(strings.TrimSpace(key)), "-")
		v := strings.TrimSpace(value)
		switch k {
		case "chain", "network":
			if v != "" {
				opts.chain = v
			}
		case "chart", "charttype", "chart_type":
			if v != "" {
				opts.chartType = v
			}
		case "events", "max", "maxevents", "max_events", "n":
			if parsed, err := strconv.Atoi(v); err == nil && parsed > 0 {
				opts.maxEvents = parsed
			}
		case "timeout", "timeoutsec", "timeout_sec", "timeoutseconds", "timeout_seconds":
			if parsed := parsePairTimeout(v, opts.timeout); parsed > 0 {
				opts.timeout = parsed
			}
		case "list", "path", "file", "listpath", "list_path":
			opts.listPath = v
		default:
			positionals = append(positionals, token)
		}
	}

	if opts.maxEvents <= 0 {
		opts.maxEvents = 1
	}
	if opts.timeout <= 0 {
		opts.timeout = 20 * time.Second
	}
	if strings.TrimSpace(opts.chain) == "" {
		opts.chain = "solana"
	}
	if strings.TrimSpace(opts.chartType) == "" {
		opts.chartType = "1m"
	}

	return opts, positionals
}

func parsePairTimeout(raw string, fallback time.Duration) time.Duration {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return fallback
	}
	if strings.IndexFunc(trimmed, func(r rune) bool { return r < '0' || r > '9' }) == -1 {
		if sec, err := strconv.Atoi(trimmed); err == nil && sec > 0 {
			return time.Duration(sec) * time.Second
		}
	}
	if dur, err := time.ParseDuration(trimmed); err == nil && dur > 0 {
		return dur
	}
	return fallback
}

func (d *Daemon) pairHelpResponse() string {
	return "📡 **Birdeye Pair Streaming**\n\n" +
		"`/pair_new` — stream newly created pairs\n" +
		"`/pair_price <pairAddress>` — stream live pair candles (`currency=pair`)\n" +
		"`/pair_txs <pairAddress>` — stream live pair transactions\n" +
		"`/pair_list_price [listPath]` — stream pair price updates from list.json\n" +
		"`/pair_list_txs [listPath]` — stream pair tx updates from list.json\n\n" +
		"Optional args on every command: `events=5 timeout=30s chain=solana`\n" +
		"Price stream also accepts: `chart=1m`\n\n" +
		"Examples:\n" +
		"`/pair_new events=3 timeout=20s`\n" +
		"`/pair_price JCt2VNnh4jtEceWcCJQJwgTnL6DZyPniqgii8Ur4g272 chart=1m events=4`\n" +
		"`/pair_list_price bds-public-main/list.json events=5`"
}

func (d *Daemon) pairNewResponse(args []string) string {
	opts, _ := parsePairWatchArgs(args)
	events, err := d.collectPairEvents(opts, solana.NewBirdeyeNewPairSubscription(), "NEW_PAIR_DATA")
	if err != nil {
		return fmt.Sprintf("❌ Pair stream failed: %v", err)
	}
	if len(events) == 0 {
		return fmt.Sprintf("📡 No new pair events received within `%s`.", opts.timeout)
	}

	var b strings.Builder
	b.WriteString(fmt.Sprintf("📡 **New Pair Stream** (`%s`)\n\n", opts.chain))
	for i, event := range events {
		data := solana.ParseBirdeyeEventMap(event)
		pair := firstNonEmpty(
			solana.BirdeyeMapString(data, "pairAddress", "address", "pair.address"),
			solana.BirdeyeMapString(data, "pool", "poolAddress"),
		)
		base := firstNonEmpty(
			solana.BirdeyeMapString(data, "baseAddress", "base.address", "baseToken.address"),
			solana.BirdeyeMapString(data, "base.symbol", "baseSymbol", "baseToken.symbol"),
		)
		quote := firstNonEmpty(
			solana.BirdeyeMapString(data, "quoteAddress", "quote.address", "quoteToken.address"),
			solana.BirdeyeMapString(data, "quote.symbol", "quoteSymbol", "quoteToken.symbol"),
		)
		liq := solana.BirdeyeMapFloat(data, "liquidity", "initialLiquidity", "liquidityUsd")
		source := solana.BirdeyeMapString(data, "source", "dex", "market")

		eventTime := solana.BirdeyeEventTimeUTC(data)
		if eventTime.IsZero() {
			eventTime = event.ReceivedAt
		}

		b.WriteString(fmt.Sprintf("%d. `%s`", i+1, emptyDash(pair)))
		if base != "" || quote != "" {
			b.WriteString(fmt.Sprintf(" · %s/%s", emptyDash(base), emptyDash(quote)))
		}
		if source != "" {
			b.WriteString(fmt.Sprintf(" · source `%s`", source))
		}
		if liq > 0 {
			b.WriteString(fmt.Sprintf(" · liq `$%.0f`", liq))
		}
		b.WriteString(fmt.Sprintf(" · %s\n", eventTime.Format(time.RFC3339)))
	}
	return strings.TrimSpace(b.String())
}

func (d *Daemon) pairPriceResponse(args []string) string {
	opts, positional := parsePairWatchArgs(args)
	if len(positional) == 0 {
		return "Usage: `/pair_price <pairAddress> [chart=1m events=3 timeout=20s chain=solana]`"
	}
	pairAddress := strings.TrimSpace(positional[0])
	sub := solana.NewBirdeyePairPriceSubscription(pairAddress, opts.chartType)
	events, err := d.collectPairEvents(opts, sub, "PRICE_DATA")
	if err != nil {
		return fmt.Sprintf("❌ Pair price stream failed: %v", err)
	}
	if len(events) == 0 {
		return fmt.Sprintf("📡 No pair price events received for `%s` within `%s`.", pairAddress, opts.timeout)
	}

	var b strings.Builder
	b.WriteString(fmt.Sprintf("📡 **Pair Price Stream** `%s` (%s, %s)\n\n", pairAddress, opts.chain, opts.chartType))
	for i, event := range events {
		data := solana.ParseBirdeyeEventMap(event)
		open := solana.BirdeyeMapFloat(data, "o", "open")
		high := solana.BirdeyeMapFloat(data, "h", "high")
		low := solana.BirdeyeMapFloat(data, "l", "low")
		close := solana.BirdeyeMapFloat(data, "c", "close", "price")
		volume := solana.BirdeyeMapFloat(data, "v", "volume")
		symbol := firstNonEmpty(
			solana.BirdeyeMapString(data, "symbol"),
			solana.BirdeyeMapString(data, "base.symbol"),
		)
		eventTime := solana.BirdeyeEventTimeUTC(data)
		if eventTime.IsZero() {
			eventTime = event.ReceivedAt
		}

		b.WriteString(fmt.Sprintf("%d. %s · O `%.8f` H `%.8f` L `%.8f` C `%.8f` V `%.2f` · %s\n",
			i+1,
			emptyDash(symbol),
			open,
			high,
			low,
			close,
			volume,
			eventTime.Format(time.RFC3339),
		))
	}
	return strings.TrimSpace(b.String())
}

func (d *Daemon) pairTxsResponse(args []string) string {
	opts, positional := parsePairWatchArgs(args)
	if len(positional) == 0 {
		return "Usage: `/pair_txs <pairAddress> [events=3 timeout=20s chain=solana]`"
	}
	pairAddress := strings.TrimSpace(positional[0])
	sub := solana.NewBirdeyePairTxSubscription(pairAddress)
	events, err := d.collectPairEvents(opts, sub, "TXS_DATA")
	if err != nil {
		return fmt.Sprintf("❌ Pair tx stream failed: %v", err)
	}
	if len(events) == 0 {
		return fmt.Sprintf("📡 No pair tx events received for `%s` within `%s`.", pairAddress, opts.timeout)
	}

	var b strings.Builder
	b.WriteString(fmt.Sprintf("📡 **Pair TX Stream** `%s` (%s)\n\n", pairAddress, opts.chain))
	for i, event := range events {
		data := solana.ParseBirdeyeEventMap(event)
		hash := firstNonEmpty(
			solana.BirdeyeMapString(data, "txHash", "signature", "hash"),
			solana.BirdeyeMapString(data, "tx_hash"),
		)
		side := solana.BirdeyeMapString(data, "side", "txType", "tx_type")
		owner := solana.BirdeyeMapString(data, "owner", "wallet", "signer")
		volume := solana.BirdeyeMapFloat(data, "volumeUsd", "volume_usd", "volume", "amountUsd")
		eventTime := solana.BirdeyeEventTimeUTC(data)
		if eventTime.IsZero() {
			eventTime = event.ReceivedAt
		}

		b.WriteString(fmt.Sprintf("%d. `%s`", i+1, emptyDash(hash)))
		if side != "" {
			b.WriteString(fmt.Sprintf(" · %s", strings.ToUpper(side)))
		}
		if volume > 0 {
			b.WriteString(fmt.Sprintf(" · `$%.2f`", volume))
		}
		if owner != "" {
			b.WriteString(fmt.Sprintf(" · %s", shortenAddress(owner)))
		}
		b.WriteString(fmt.Sprintf(" · %s\n", eventTime.Format(time.RFC3339)))
	}
	return strings.TrimSpace(b.String())
}

func (d *Daemon) pairListPriceResponse(args []string) string {
	opts, positional := parsePairWatchArgs(args)
	if len(positional) > 0 && strings.TrimSpace(opts.listPath) == "" {
		opts.listPath = strings.TrimSpace(positional[0])
	}
	resolved := resolvePairListPath(opts.listPath)
	tokens, err := solana.LoadBirdeyePairList(resolved)
	if err != nil {
		return fmt.Sprintf("❌ Pair list load failed: %v", err)
	}

	query := solana.BuildBirdeyePairPriceComplexQuery(tokens, opts.chartType, "pair")
	if strings.TrimSpace(query) == "" {
		return "❌ Pair list query is empty."
	}

	sub := solana.NewBirdeyePairPriceComplexSubscription(query)
	events, err := d.collectPairEvents(opts, sub, "PRICE_DATA")
	if err != nil {
		return fmt.Sprintf("❌ Pair list price stream failed: %v", err)
	}
	if len(events) == 0 {
		return fmt.Sprintf("📡 No pair price events received from `%s` within `%s`.", resolved, opts.timeout)
	}

	var b strings.Builder
	b.WriteString(fmt.Sprintf("📡 **Pair List Price Stream** (%d pairs, %s)\n", len(tokens), opts.chartType))
	b.WriteString(fmt.Sprintf("List: `%s`\n\n", resolved))

	for i, event := range events {
		data := solana.ParseBirdeyeEventMap(event)
		address := firstNonEmpty(
			solana.BirdeyeMapString(data, "address", "pairAddress"),
			solana.BirdeyeMapString(data, "baseAddress"),
		)
		close := solana.BirdeyeMapFloat(data, "c", "close", "price")
		volume := solana.BirdeyeMapFloat(data, "v", "volume")
		tm := solana.BirdeyeEventTimeUTC(data)
		if tm.IsZero() {
			tm = event.ReceivedAt
		}
		b.WriteString(fmt.Sprintf("%d. `%s` · close `%.8f` · vol `%.2f` · %s\n", i+1, emptyDash(address), close, volume, tm.Format(time.RFC3339)))
	}

	return strings.TrimSpace(b.String())
}

func (d *Daemon) pairListTxsResponse(args []string) string {
	opts, positional := parsePairWatchArgs(args)
	if len(positional) > 0 && strings.TrimSpace(opts.listPath) == "" {
		opts.listPath = strings.TrimSpace(positional[0])
	}
	resolved := resolvePairListPath(opts.listPath)
	tokens, err := solana.LoadBirdeyePairList(resolved)
	if err != nil {
		return fmt.Sprintf("❌ Pair list load failed: %v", err)
	}

	query := solana.BuildBirdeyePairTxComplexQuery(tokens)
	if strings.TrimSpace(query) == "" {
		return "❌ Pair list query is empty."
	}

	sub := solana.NewBirdeyePairTxComplexSubscription(query)
	events, err := d.collectPairEvents(opts, sub, "TXS_DATA")
	if err != nil {
		return fmt.Sprintf("❌ Pair list tx stream failed: %v", err)
	}
	if len(events) == 0 {
		return fmt.Sprintf("📡 No pair tx events received from `%s` within `%s`.", resolved, opts.timeout)
	}

	var b strings.Builder
	b.WriteString(fmt.Sprintf("📡 **Pair List TX Stream** (%d pairs)\n", len(tokens)))
	b.WriteString(fmt.Sprintf("List: `%s`\n\n", resolved))

	for i, event := range events {
		data := solana.ParseBirdeyeEventMap(event)
		address := firstNonEmpty(
			solana.BirdeyeMapString(data, "address", "pairAddress"),
			solana.BirdeyeMapString(data, "tokenAddress"),
		)
		hash := solana.BirdeyeMapString(data, "txHash", "signature", "hash")
		volume := solana.BirdeyeMapFloat(data, "volumeUsd", "volume_usd", "volume")
		tm := solana.BirdeyeEventTimeUTC(data)
		if tm.IsZero() {
			tm = event.ReceivedAt
		}
		b.WriteString(fmt.Sprintf("%d. `%s` · tx `%s` · vol `$%.2f` · %s\n", i+1, emptyDash(address), emptyDash(hash), volume, tm.Format(time.RFC3339)))
	}

	return strings.TrimSpace(b.String())
}

func (d *Daemon) collectPairEvents(opts pairWatchOptions, sub solana.BirdeyeWSSubscription, filterTypes ...string) ([]solana.BirdeyeWSEvent, error) {
	client, err := d.birdeyeWSClient()
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(d.ctx, opts.timeout)
	defer cancel()

	events, err := client.SubscribeAndCollect(ctx, opts.chain, sub, opts.maxEvents, filterTypes...)
	if err != nil {
		return nil, err
	}
	return events, nil
}

func (d *Daemon) birdeyeWSClient() (*solana.BirdeyeWSClient, error) {
	if d == nil || d.cfg == nil {
		return nil, fmt.Errorf("daemon config unavailable")
	}
	apiKey := strings.TrimSpace(d.cfg.Solana.BirdeyeAPIKey)
	if apiKey == "" {
		return nil, fmt.Errorf("BIRDEYE_API_KEY not configured")
	}
	return solana.NewBirdeyeWSClient(apiKey, strings.TrimSpace(d.cfg.Solana.BirdeyeWSSURL)), nil
}

func resolvePairListPath(path string) string {
	trimmed := strings.TrimSpace(path)
	candidates := make([]string, 0, 4)
	if trimmed != "" {
		candidates = append(candidates, trimmed)
	}
	if envPath := strings.TrimSpace(os.Getenv("BIRDEYE_PAIR_LIST_PATH")); envPath != "" {
		candidates = append(candidates, envPath)
	}
	candidates = append(candidates,
		"bds-public-main/list.json",
		"list.json",
		"bds-public-main/tokenlist.json",
	)

	for _, candidate := range candidates {
		if candidate == "" {
			continue
		}
		if filepath.IsAbs(candidate) {
			if _, err := os.Stat(candidate); err == nil {
				return candidate
			}
			continue
		}
		if _, err := os.Stat(candidate); err == nil {
			return candidate
		}
	}

	if trimmed != "" {
		return trimmed
	}
	return "bds-public-main/list.json"
}
