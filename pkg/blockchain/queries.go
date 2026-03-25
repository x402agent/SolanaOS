package blockchain

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/x402agent/Solana-Os-Go/pkg/memory"
)

// ---------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------

// WalletPortfolio holds the full wallet state with USD pricing.
type WalletPortfolio struct {
	Address     string         `json:"address"`
	SOLBalance  float64        `json:"sol_balance"`
	SOLPriceUSD float64        `json:"sol_price_usd"`
	SOLValueUSD float64        `json:"sol_value_usd"`
	Tokens      []TokenBalance `json:"tokens"`
	NFTCount    int            `json:"nft_count"`
	TotalUSD    float64        `json:"total_usd"`
	FetchedAt   time.Time      `json:"fetched_at"`
	Tier        string         `json:"tier"` // always KNOWN
}

// TokenBalance represents a single SPL token holding.
type TokenBalance struct {
	Mint     string  `json:"mint"`
	Symbol   string  `json:"symbol"`
	Name     string  `json:"name"`
	Amount   float64 `json:"amount"`
	Decimals int     `json:"decimals"`
	PriceUSD float64 `json:"price_usd"`
	ValueUSD float64 `json:"value_usd"`
}

// TokenResearch holds deep research output for a token.
type TokenResearch struct {
	Mint                string       `json:"mint"`
	Name                string       `json:"name"`
	Symbol              string       `json:"symbol"`
	Decimals            int          `json:"decimals"`
	TotalSupply         float64      `json:"total_supply"`
	PriceUSD            float64      `json:"price_usd"`
	Volume24h           float64      `json:"volume_24h"`
	MarketCapUSD        float64      `json:"market_cap_usd"`
	LiquidityUSD        float64      `json:"liquidity_usd"`
	TopHolders          []HolderInfo `json:"top_holders"`
	HolderConcentration float64      `json:"holder_concentration"` // top 10 as fraction
	DevWalletPct        float64      `json:"dev_wallet_pct"`
	MintAuthority       string       `json:"mint_authority"`
	FreezeAuthority     string       `json:"freeze_authority"`
	RiskFlags           []string     `json:"risk_flags"`
	RiskScore           float64      `json:"risk_score"` // 0.0 (safe) to 1.0 (dangerous)
	FetchedAt           time.Time    `json:"fetched_at"`
	Tier                string       `json:"tier"`
}

// HolderInfo represents a top holder.
type HolderInfo struct {
	Address    string  `json:"address"`
	Amount     float64 `json:"amount"`
	Percentage float64 `json:"percentage"`
}

// NetworkStats holds Solana network health data.
type NetworkStats struct {
	CurrentSlot       uint64    `json:"current_slot"`
	Epoch             uint64    `json:"epoch"`
	TPS               float64   `json:"tps"`
	SOLPriceUSD       float64   `json:"sol_price_usd"`
	SOLMarketCapUSD   float64   `json:"sol_market_cap_usd"`
	TotalSupply       float64   `json:"total_supply"`
	CirculatingSupply float64   `json:"circulating_supply"`
	FetchedAt         time.Time `json:"fetched_at"`
	Tier              string    `json:"tier"`
}

// TrendingToken represents a trending token from SolanaTracker.
type TrendingToken struct {
	Mint      string  `json:"mint"`
	Symbol    string  `json:"symbol"`
	Name      string  `json:"name"`
	PriceUSD  float64 `json:"price_usd"`
	Change24h float64 `json:"change_24h"`
	Volume24h float64 `json:"volume_24h"`
	MarketCap float64 `json:"market_cap"`
	Liquidity float64 `json:"liquidity"`
}

// WhaleTransfer represents a large SOL transfer.
type WhaleTransfer struct {
	Signature string    `json:"signature"`
	From      string    `json:"from"`
	To        string    `json:"to"`
	AmountSOL float64   `json:"amount_sol"`
	AmountUSD float64   `json:"amount_usd"`
	Slot      uint64    `json:"slot"`
	Timestamp time.Time `json:"timestamp"`
}

// PriceResult holds a price lookup result.
type PriceResult struct {
	Symbol    string    `json:"symbol"`
	Mint      string    `json:"mint"`
	PriceUSD  float64   `json:"price_usd"`
	Change24h float64   `json:"change_24h"`
	Volume24h float64   `json:"volume_24h"`
	MarketCap float64   `json:"market_cap"`
	Source    string    `json:"source"`
	FetchedAt time.Time `json:"fetched_at"`
	Tier      string    `json:"tier"`
}

// ---------------------------------------------------------------------
// Known token registry
// ---------------------------------------------------------------------

var knownTokens = map[string]struct{ Symbol, Name, CoinGeckoID string }{
	"So11111111111111111111111111111111111111112":  {"SOL", "Solana", "solana"},
	"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": {"USDC", "USD Coin", "usd-coin"},
	"Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB": {"USDT", "Tether", "tether"},
	"DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263": {"BONK", "Bonk", "bonk"},
	"JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN":  {"JUP", "Jupiter", "jupiter-exchange-solana"},
	"EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm": {"WIF", "dogwifhat", "dogwifcoin"},
	"7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr": {"POPCAT", "Popcat", "popcat"},
	"ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82":  {"BOME", "Book of Meme", "book-of-meme"},
	"A8C3xuqscfmyLrte3VwXxhP2cNFRzv9tfPFWEFzahRGm": {"PENGU", "Pudgy Penguins", "pudgy-penguins"},
	"7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs": {"WETH", "Wrapped Ether", "weth"},
	"jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL":  {"JTO", "Jito", "jito-governance-token"},
	"mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So":  {"mSOL", "Marinade Staked SOL", "msol"},
	"HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3": {"PYTH", "Pyth Network", "pyth-network"},
	"hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux":  {"HNT", "Helium", "helium"},
	"rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof":  {"RNDR", "Render Token", "render-token"},
	"EchesyfXePKdLtoiZSL8pBe8Myagyy8ZRqsACNCFGnvp": {"DRIFT", "Drift Protocol", "drift-protocol"},
}

var symbolToMint = func() map[string]string {
	m := make(map[string]string, len(knownTokens))
	for mint, info := range knownTokens {
		m[strings.ToUpper(info.Symbol)] = mint
	}
	return m
}()

// ---------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------

// Client provides blockchain data queries with memory persistence.
type Client struct {
	trackerAPIKey string
	trackerRPCURL string
	heliusAPIKey  string
	heliusRPCURL  string
	vault         memory.Vault
	logger        *slog.Logger
	httpClient    *http.Client
}

// NewClient creates a blockchain query client.
func NewClient(
	trackerAPIKey, trackerRPCURL,
	heliusAPIKey, heliusRPCURL string,
	vault memory.Vault,
	logger *slog.Logger,
) *Client {
	return &Client{
		trackerAPIKey: trackerAPIKey,
		trackerRPCURL: trackerRPCURL,
		heliusAPIKey:  heliusAPIKey,
		heliusRPCURL:  heliusRPCURL,
		vault:         vault,
		logger:        logger,
		httpClient:    &http.Client{Timeout: 15 * time.Second},
	}
}

// ---------------------------------------------------------------------
// Wallet Portfolio
// ---------------------------------------------------------------------

// GetWalletPortfolio returns the full wallet state with USD pricing.
func (c *Client) GetWalletPortfolio(ctx context.Context, address string) (*WalletPortfolio, error) {
	portfolio := &WalletPortfolio{
		Address:   address,
		FetchedAt: time.Now(),
		Tier:      "KNOWN",
	}

	// Get SOL balance via RPC
	solBalance, err := c.getSOLBalance(ctx, address)
	if err != nil {
		return nil, fmt.Errorf("get_sol_balance: %w", err)
	}
	portfolio.SOLBalance = solBalance

	// Get SOL price
	solPrice, _ := c.getTokenPrice(ctx, "So11111111111111111111111111111111111111112")
	portfolio.SOLPriceUSD = solPrice
	portfolio.SOLValueUSD = solBalance * solPrice

	// Get token accounts
	tokens, err := c.getTokenAccounts(ctx, address)
	if err != nil {
		c.logger.Warn("token_accounts_partial", "error", err)
	}

	// Enrich with prices and sort by value
	for i := range tokens {
		if tokens[i].PriceUSD == 0 {
			price, _ := c.getTokenPrice(ctx, tokens[i].Mint)
			tokens[i].PriceUSD = price
		}
		tokens[i].ValueUSD = tokens[i].Amount * tokens[i].PriceUSD
	}
	sort.Slice(tokens, func(i, j int) bool {
		return tokens[i].ValueUSD > tokens[j].ValueUSD
	})

	// Filter dust (< $0.01)
	var filtered []TokenBalance
	nftCount := 0
	for _, t := range tokens {
		if t.Decimals == 0 && t.Amount == 1 {
			nftCount++
			continue
		}
		if t.ValueUSD >= 0.01 || t.PriceUSD == 0 {
			filtered = append(filtered, t)
		}
	}
	portfolio.Tokens = filtered
	portfolio.NFTCount = nftCount

	// Total
	total := portfolio.SOLValueUSD
	for _, t := range portfolio.Tokens {
		total += t.ValueUSD
	}
	portfolio.TotalUSD = total

	return portfolio, nil
}

// ---------------------------------------------------------------------
// Token Research
// ---------------------------------------------------------------------

// ResearchToken performs deep analysis on a token.
func (c *Client) ResearchToken(ctx context.Context, mint string) (*TokenResearch, error) {
	research := &TokenResearch{
		Mint:      mint,
		FetchedAt: time.Now(),
		Tier:      "KNOWN",
	}

	// Resolve known token info
	if info, ok := knownTokens[mint]; ok {
		research.Symbol = info.Symbol
		research.Name = info.Name
	}

	// Get price data
	price, _ := c.getTokenPrice(ctx, mint)
	research.PriceUSD = price

	// Get token supply and metadata via RPC
	supply, decimals, err := c.getTokenSupply(ctx, mint)
	if err == nil {
		research.TotalSupply = supply
		research.Decimals = decimals
	}

	// Get top holders
	holders, err := c.getTopHolders(ctx, mint, 10)
	if err == nil {
		research.TopHolders = holders
		var concentration float64
		for _, h := range holders {
			concentration += h.Percentage
		}
		research.HolderConcentration = concentration / 100.0
	}

	// Get mint/freeze authority
	mintAuth, freezeAuth, _ := c.getMintAuthority(ctx, mint)
	research.MintAuthority = mintAuth
	research.FreezeAuthority = freezeAuth

	// Risk assessment
	research.RiskFlags, research.RiskScore = assessRisk(research)

	return research, nil
}

// assessRisk evaluates risk flags and produces a 0.0-1.0 score.
func assessRisk(r *TokenResearch) ([]string, float64) {
	var flags []string
	score := 0.0

	if r.HolderConcentration > 0.50 {
		flags = append(flags, "CRITICAL: top 10 holders control >50% of supply")
		score += 0.4
	} else if r.HolderConcentration > 0.30 {
		flags = append(flags, "WARNING: top 10 holders control >30% of supply")
		score += 0.2
	}

	if r.DevWalletPct > 0.10 {
		flags = append(flags, "WARNING: dev wallet holds >10% of supply")
		score += 0.2
	}

	if r.MintAuthority != "" && r.MintAuthority != "disabled" {
		flags = append(flags, "CAUTION: mint authority is not disabled")
		score += 0.1
	}

	if r.FreezeAuthority != "" && r.FreezeAuthority != "disabled" {
		flags = append(flags, "CAUTION: freeze authority is not disabled")
		score += 0.1
	}

	if r.LiquidityUSD > 0 && r.LiquidityUSD < 50000 {
		flags = append(flags, "WARNING: liquidity below $50,000")
		score += 0.15
	}

	if r.Volume24h > 0 && r.Volume24h < 100000 {
		flags = append(flags, "CAUTION: 24h volume below $100,000")
		score += 0.05
	}

	if score > 1.0 {
		score = 1.0
	}
	if len(flags) == 0 {
		flags = append(flags, "No significant risk flags detected")
	}
	return flags, score
}

// ---------------------------------------------------------------------
// Network Stats
// ---------------------------------------------------------------------

// GetNetworkStats returns Solana network health.
func (c *Client) GetNetworkStats(ctx context.Context) (*NetworkStats, error) {
	stats := &NetworkStats{
		FetchedAt: time.Now(),
		Tier:      "KNOWN",
	}

	// Get slot
	slot, err := c.rpcCall(ctx, "getSlot", nil)
	if err == nil {
		if f, ok := slot.(float64); ok {
			stats.CurrentSlot = uint64(f)
		}
	}

	// Get epoch info
	epochInfo, err := c.rpcCall(ctx, "getEpochInfo", nil)
	if err == nil {
		if m, ok := epochInfo.(map[string]any); ok {
			if e, ok := m["epoch"].(float64); ok {
				stats.Epoch = uint64(e)
			}
		}
	}

	// Get recent performance (TPS)
	perfSamples, err := c.rpcCall(ctx, "getRecentPerformanceSamples", []any{1})
	if err == nil {
		if arr, ok := perfSamples.([]any); ok && len(arr) > 0 {
			if sample, ok := arr[0].(map[string]any); ok {
				txCount, _ := sample["numTransactions"].(float64)
				samplePeriod, _ := sample["samplePeriodSecs"].(float64)
				if samplePeriod > 0 {
					stats.TPS = txCount / samplePeriod
				}
			}
		}
	}

	// SOL price
	solPrice, _ := c.getTokenPrice(ctx, "So11111111111111111111111111111111111111112")
	stats.SOLPriceUSD = solPrice

	return stats, nil
}

// ---------------------------------------------------------------------
// Trending
// ---------------------------------------------------------------------

// GetTrending returns trending tokens from SolanaTracker.
func (c *Client) GetTrending(ctx context.Context, limit int) ([]TrendingToken, error) {
	if limit == 0 {
		limit = 10
	}

	url := fmt.Sprintf("https://data.solanatracker.io/tokens/trending?limit=%d", limit)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("x-api-key", c.trackerAPIKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("solanatracker trending: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("solanatracker trending %d: %s", resp.StatusCode, string(body))
	}

	var raw []map[string]any
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, fmt.Errorf("parse trending: %w", err)
	}

	var tokens []TrendingToken
	for _, item := range raw {
		t := TrendingToken{}
		if v, ok := item["token"].(map[string]any); ok {
			t.Mint, _ = v["mint"].(string)
			t.Symbol, _ = v["symbol"].(string)
			t.Name, _ = v["name"].(string)
		}
		if v, ok := item["pools"].([]any); ok && len(v) > 0 {
			if pool, ok := v[0].(map[string]any); ok {
				if price, ok := pool["price"].(map[string]any); ok {
					t.PriceUSD, _ = price["usd"].(float64)
				}
				t.Liquidity, _ = pool["liquidity"].(float64)
				t.Volume24h, _ = pool["volume24h"].(float64)
			}
		}
		if t.Mint != "" {
			tokens = append(tokens, t)
		}
	}
	return tokens, nil
}

// ---------------------------------------------------------------------
// Price Lookup
// ---------------------------------------------------------------------

// GetPrice looks up a token price by mint address or known symbol.
func (c *Client) GetPrice(ctx context.Context, mintOrSymbol string) (*PriceResult, error) {
	mint := mintOrSymbol
	symbol := mintOrSymbol

	// Resolve symbol to mint
	if m, ok := symbolToMint[strings.ToUpper(mintOrSymbol)]; ok {
		mint = m
		if info, ok := knownTokens[m]; ok {
			symbol = info.Symbol
		}
	} else if info, ok := knownTokens[mint]; ok {
		symbol = info.Symbol
	}

	price, err := c.getTokenPrice(ctx, mint)
	if err != nil {
		return nil, err
	}

	return &PriceResult{
		Symbol:    symbol,
		Mint:      mint,
		PriceUSD:  price,
		Source:    "solanatracker+coingecko",
		FetchedAt: time.Now(),
		Tier:      "KNOWN",
	}, nil
}

// ---------------------------------------------------------------------
// Memory Persistence
// ---------------------------------------------------------------------

// PersistResearch stores a research result to Honcho memory.
func (c *Client) PersistResearch(ctx context.Context, cs *memory.ChannelSession, research *TokenResearch) error {
	if c.vault == nil {
		return nil
	}

	content := fmt.Sprintf(
		"[RESEARCH] %s (%s) — Price: $%.6f | MCap: $%.0f | Vol24h: $%.0f | "+
			"Liquidity: $%.0f | Top10 Concentration: %.1f%% | Risk: %.2f | Flags: %s",
		research.Name, research.Symbol,
		research.PriceUSD, research.MarketCapUSD, research.Volume24h,
		research.LiquidityUSD, research.HolderConcentration*100,
		research.RiskScore, strings.Join(research.RiskFlags, "; "),
	)

	return c.vault.StoreUserMessage(ctx, cs, content, map[string]any{
		"event_type":    "research",
		"mint":          research.Mint,
		"symbol":        research.Symbol,
		"price_usd":     research.PriceUSD,
		"risk_score":    research.RiskScore,
		"concentration": research.HolderConcentration,
		"liquidity_usd": research.LiquidityUSD,
		"volume_24h":    research.Volume24h,
		"tier":          "KNOWN",
		"timestamp":     research.FetchedAt.UTC().Format(time.RFC3339),
	})
}

// PersistPortfolio stores a portfolio snapshot to Honcho memory.
func (c *Client) PersistPortfolio(ctx context.Context, cs *memory.ChannelSession, portfolio *WalletPortfolio) error {
	if c.vault == nil {
		return nil
	}

	tokenSummary := make([]string, 0, len(portfolio.Tokens))
	for _, t := range portfolio.Tokens {
		if t.ValueUSD >= 1.0 {
			tokenSummary = append(tokenSummary, fmt.Sprintf("%s=$%.2f", t.Symbol, t.ValueUSD))
		}
	}

	content := fmt.Sprintf(
		"[PORTFOLIO] %s — SOL: %.4f ($%.2f) | Tokens: %s | NFTs: %d | Total: $%.2f",
		portfolio.Address[:8]+"...",
		portfolio.SOLBalance, portfolio.SOLValueUSD,
		strings.Join(tokenSummary, ", "),
		portfolio.NFTCount,
		portfolio.TotalUSD,
	)

	return c.vault.StoreUserMessage(ctx, cs, content, map[string]any{
		"event_type":  "portfolio_snapshot",
		"address":     portfolio.Address,
		"sol_balance": portfolio.SOLBalance,
		"total_usd":   portfolio.TotalUSD,
		"token_count": len(portfolio.Tokens),
		"nft_count":   portfolio.NFTCount,
		"tier":        "KNOWN",
		"timestamp":   portfolio.FetchedAt.UTC().Format(time.RFC3339),
	})
}

// ---------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------

// FormatPortfolio returns a human-readable portfolio string.
func FormatPortfolio(p *WalletPortfolio) string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("💰 Wallet: %s\n\n", p.Address))
	sb.WriteString(fmt.Sprintf("SOL: %.4f ($%.2f)\n", p.SOLBalance, p.SOLValueUSD))

	if len(p.Tokens) > 0 {
		sb.WriteString("\nTokens:\n")
		for i, t := range p.Tokens {
			if i >= 20 {
				sb.WriteString(fmt.Sprintf("  ... and %d more\n", len(p.Tokens)-20))
				break
			}
			name := t.Symbol
			if name == "" {
				name = t.Mint[:8] + "..."
			}
			if t.ValueUSD > 0 {
				sb.WriteString(fmt.Sprintf("  %s: %.4f ($%.2f)\n", name, t.Amount, t.ValueUSD))
			} else {
				sb.WriteString(fmt.Sprintf("  %s: %.4f\n", name, t.Amount))
			}
		}
	}

	if p.NFTCount > 0 {
		sb.WriteString(fmt.Sprintf("\nNFTs: %d\n", p.NFTCount))
	}
	sb.WriteString(fmt.Sprintf("\n📊 Total Portfolio: $%.2f\n", p.TotalUSD))
	sb.WriteString(fmt.Sprintf("⏱️ Fetched: %s [KNOWN]", p.FetchedAt.Format("15:04:05")))
	return sb.String()
}

// FormatResearch returns a human-readable research string.
func FormatResearch(r *TokenResearch) string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("🔬 %s (%s)\n", r.Name, r.Symbol))
	sb.WriteString(fmt.Sprintf("Mint: %s\n\n", r.Mint))
	sb.WriteString(fmt.Sprintf("Price: $%.8f\n", r.PriceUSD))
	if r.Volume24h > 0 {
		sb.WriteString(fmt.Sprintf("24h Volume: $%.0f\n", r.Volume24h))
	}
	if r.MarketCapUSD > 0 {
		sb.WriteString(fmt.Sprintf("Market Cap: $%.0f\n", r.MarketCapUSD))
	}
	if r.LiquidityUSD > 0 {
		sb.WriteString(fmt.Sprintf("Liquidity: $%.0f\n", r.LiquidityUSD))
	}
	sb.WriteString(fmt.Sprintf("Decimals: %d\n", r.Decimals))
	if r.TotalSupply > 0 {
		sb.WriteString(fmt.Sprintf("Supply: %.0f\n", r.TotalSupply))
	}

	if len(r.TopHolders) > 0 {
		sb.WriteString("\nTop Holders:\n")
		for i, h := range r.TopHolders {
			if i >= 5 {
				break
			}
			sb.WriteString(fmt.Sprintf("  %s... %.2f%%\n", h.Address[:8], h.Percentage))
		}
		sb.WriteString(fmt.Sprintf("  Top 10 concentration: %.1f%%\n", r.HolderConcentration*100))
	}

	if r.MintAuthority != "" {
		sb.WriteString(fmt.Sprintf("\nMint authority: %s\n", r.MintAuthority))
	}
	if r.FreezeAuthority != "" {
		sb.WriteString(fmt.Sprintf("Freeze authority: %s\n", r.FreezeAuthority))
	}

	sb.WriteString(fmt.Sprintf("\n⚠️ Risk Score: %.2f/1.00\n", r.RiskScore))
	for _, flag := range r.RiskFlags {
		sb.WriteString(fmt.Sprintf("  • %s\n", flag))
	}
	sb.WriteString(fmt.Sprintf("\n⏱️ Fetched: %s [KNOWN]", r.FetchedAt.Format("15:04:05")))
	return sb.String()
}

// FormatNetworkStats returns a human-readable network stats string.
func FormatNetworkStats(s *NetworkStats) string {
	var sb strings.Builder
	sb.WriteString("🌐 Solana Network\n\n")
	sb.WriteString(fmt.Sprintf("Slot: %d\n", s.CurrentSlot))
	sb.WriteString(fmt.Sprintf("Epoch: %d\n", s.Epoch))
	sb.WriteString(fmt.Sprintf("TPS: %.0f\n", s.TPS))
	sb.WriteString(fmt.Sprintf("SOL Price: $%.2f\n", s.SOLPriceUSD))
	sb.WriteString(fmt.Sprintf("\n⏱️ %s [KNOWN]", s.FetchedAt.Format("15:04:05")))
	return sb.String()
}

// FormatTrending returns a human-readable trending tokens string.
func FormatTrending(tokens []TrendingToken) string {
	var sb strings.Builder
	sb.WriteString("🔥 Trending on Solana\n\n")
	for i, t := range tokens {
		if i >= 15 {
			break
		}
		name := t.Symbol
		if name == "" {
			name = t.Name
		}
		sb.WriteString(fmt.Sprintf("%d. %s — $%.6f", i+1, name, t.PriceUSD))
		if t.Volume24h > 0 {
			sb.WriteString(fmt.Sprintf(" | Vol: $%.0f", t.Volume24h))
		}
		sb.WriteString("\n")
	}
	return sb.String()
}

// ---------------------------------------------------------------------
// RPC helpers
// ---------------------------------------------------------------------

func (c *Client) rpcCall(ctx context.Context, method string, params any) (any, error) {
	rpcURL := c.trackerRPCURL
	if rpcURL == "" {
		rpcURL = c.heliusRPCURL
	}
	if rpcURL == "" {
		return nil, fmt.Errorf("no RPC URL configured")
	}

	body := map[string]any{
		"jsonrpc": "2.0",
		"id":      1,
		"method":  method,
	}
	if params != nil {
		body["params"] = params
	}

	data, _ := json.Marshal(body)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, rpcURL, strings.NewReader(string(data)))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)

	var result struct {
		Result any `json:"result"`
		Error  *struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("rpc parse: %w", err)
	}
	if result.Error != nil {
		return nil, fmt.Errorf("rpc error: %s", result.Error.Message)
	}
	return result.Result, nil
}

func (c *Client) getSOLBalance(ctx context.Context, address string) (float64, error) {
	result, err := c.rpcCall(ctx, "getBalance", []any{address})
	if err != nil {
		return 0, err
	}
	if m, ok := result.(map[string]any); ok {
		if v, ok := m["value"].(float64); ok {
			return v / 1e9, nil // lamports to SOL
		}
	}
	return 0, fmt.Errorf("unexpected balance format")
}

func (c *Client) getTokenAccounts(ctx context.Context, address string) ([]TokenBalance, error) {
	result, err := c.rpcCall(ctx, "getTokenAccountsByOwner", []any{
		address,
		map[string]string{"programId": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"},
		map[string]string{"encoding": "jsonParsed"},
	})
	if err != nil {
		return nil, err
	}

	var tokens []TokenBalance
	if m, ok := result.(map[string]any); ok {
		if v, ok := m["value"].([]any); ok {
			for _, item := range v {
				acct, ok := item.(map[string]any)
				if !ok {
					continue
				}
				acctData, _ := acct["account"].(map[string]any)
				data, _ := acctData["data"].(map[string]any)
				parsed, _ := data["parsed"].(map[string]any)
				info, _ := parsed["info"].(map[string]any)
				tokenAmount, _ := info["tokenAmount"].(map[string]any)

				mint, _ := info["mint"].(string)
				amountStr, _ := tokenAmount["uiAmountString"].(string)
				decimals, _ := tokenAmount["decimals"].(float64)

				var amount float64
				fmt.Sscanf(amountStr, "%f", &amount)
				if amount == 0 {
					continue
				}

				tb := TokenBalance{
					Mint:     mint,
					Amount:   amount,
					Decimals: int(decimals),
				}
				if info, ok := knownTokens[mint]; ok {
					tb.Symbol = info.Symbol
					tb.Name = info.Name
				}
				tokens = append(tokens, tb)
			}
		}
	}
	return tokens, nil
}

func (c *Client) getTokenSupply(ctx context.Context, mint string) (float64, int, error) {
	result, err := c.rpcCall(ctx, "getTokenSupply", []any{mint})
	if err != nil {
		return 0, 0, err
	}
	if m, ok := result.(map[string]any); ok {
		if v, ok := m["value"].(map[string]any); ok {
			amountStr, _ := v["uiAmountString"].(string)
			decimals, _ := v["decimals"].(float64)
			var amount float64
			fmt.Sscanf(amountStr, "%f", &amount)
			return amount, int(decimals), nil
		}
	}
	return 0, 0, fmt.Errorf("unexpected supply format")
}

func (c *Client) getTopHolders(ctx context.Context, mint string, limit int) ([]HolderInfo, error) {
	result, err := c.rpcCall(ctx, "getTokenLargestAccounts", []any{mint})
	if err != nil {
		return nil, err
	}
	if m, ok := result.(map[string]any); ok {
		if v, ok := m["value"].([]any); ok {
			var holders []HolderInfo
			for _, item := range v {
				h, ok := item.(map[string]any)
				if !ok {
					continue
				}
				addr, _ := h["address"].(string)
				amountStr, _ := h["uiAmountString"].(string)
				var amount float64
				fmt.Sscanf(amountStr, "%f", &amount)
				holders = append(holders, HolderInfo{
					Address: addr,
					Amount:  amount,
				})
			}

			// Calculate percentages
			var total float64
			for _, h := range holders {
				total += h.Amount
			}
			if total > 0 {
				for i := range holders {
					holders[i].Percentage = (holders[i].Amount / total) * 100
				}
			}

			if len(holders) > limit {
				holders = holders[:limit]
			}
			return holders, nil
		}
	}
	return nil, fmt.Errorf("unexpected holders format")
}

func (c *Client) getMintAuthority(ctx context.Context, mint string) (string, string, error) {
	result, err := c.rpcCall(ctx, "getAccountInfo", []any{
		mint,
		map[string]string{"encoding": "jsonParsed"},
	})
	if err != nil {
		return "", "", err
	}
	if m, ok := result.(map[string]any); ok {
		if v, ok := m["value"].(map[string]any); ok {
			data, _ := v["data"].(map[string]any)
			parsed, _ := data["parsed"].(map[string]any)
			info, _ := parsed["info"].(map[string]any)
			mintAuth, _ := info["mintAuthority"].(string)
			freezeAuth, _ := info["freezeAuthority"].(string)
			if mintAuth == "" {
				mintAuth = "disabled"
			}
			if freezeAuth == "" {
				freezeAuth = "disabled"
			}
			return mintAuth, freezeAuth, nil
		}
	}
	return "", "", fmt.Errorf("unexpected account format")
}

func (c *Client) getTokenPrice(ctx context.Context, mint string) (float64, error) {
	// Try SolanaTracker first
	if c.trackerAPIKey != "" {
		url := fmt.Sprintf("https://data.solanatracker.io/price?token=%s", mint)
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
		if err == nil {
			req.Header.Set("x-api-key", c.trackerAPIKey)
			resp, err := c.httpClient.Do(req)
			if err == nil {
				defer resp.Body.Close()
				if resp.StatusCode == 200 {
					body, _ := io.ReadAll(resp.Body)
					var result map[string]any
					if json.Unmarshal(body, &result) == nil {
						if price, ok := result["price"].(float64); ok && price > 0 {
							return price, nil
						}
					}
				}
			}
		}
	}

	// Fallback to CoinGecko
	if info, ok := knownTokens[mint]; ok && info.CoinGeckoID != "" {
		url := fmt.Sprintf("https://api.coingecko.com/api/v3/simple/price?ids=%s&vs_currencies=usd", info.CoinGeckoID)
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
		if err == nil {
			resp, err := c.httpClient.Do(req)
			if err == nil {
				defer resp.Body.Close()
				body, _ := io.ReadAll(resp.Body)
				var result map[string]map[string]float64
				if json.Unmarshal(body, &result) == nil {
					if prices, ok := result[info.CoinGeckoID]; ok {
						return prices["usd"], nil
					}
				}
			}
		}
	}

	return 0, fmt.Errorf("price not found for %s", mint)
}
