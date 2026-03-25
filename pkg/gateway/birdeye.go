package gateway

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"regexp"
	"strings"
	"sync"
	"time"
)

// solanaAddrRe matches base58-encoded Solana addresses (32-44 characters).
var solanaAddrRe = regexp.MustCompile(`\b[1-9A-HJ-NP-Za-km-z]{32,44}\b`)

// birdeyeCache stores recent token lookup results keyed by address.
var birdeyeCache sync.Map

type birdeyeCacheEntry struct {
	result    string
	fetchedAt time.Time
}

const birdeyeCacheTTL = 60 * time.Second

// detectSolanaAddress returns the first base58 Solana address found in message,
// or an empty string if none is present.
func detectSolanaAddress(message string) string {
	match := solanaAddrRe.FindString(message)
	return match
}

// fetchBirdeyeTokenData fetches token overview and security data from Birdeye
// for the given Solana address. Results are cached for 60 seconds.
// If apiKey is empty, it falls back to the BIRDEYE_API_KEY environment variable.
func fetchBirdeyeTokenData(ctx context.Context, address, apiKey string) (string, error) {
	if apiKey == "" {
		apiKey = os.Getenv("BIRDEYE_API_KEY")
	}
	if apiKey == "" {
		return "", fmt.Errorf("birdeye: no API key provided and BIRDEYE_API_KEY is not set")
	}

	// Check cache.
	if cached, ok := birdeyeCache.Load(address); ok {
		entry := cached.(birdeyeCacheEntry)
		if time.Since(entry.fetchedAt) < birdeyeCacheTTL {
			return entry.result, nil
		}
		birdeyeCache.Delete(address)
	}

	overviewURL := fmt.Sprintf("https://public-api.birdeye.so/defi/token_overview?address=%s", address)
	securityURL := fmt.Sprintf("https://public-api.birdeye.so/defi/token_security?address=%s", address)

	type apiResult struct {
		data []byte
		err  error
	}

	overviewCh := make(chan apiResult, 1)
	securityCh := make(chan apiResult, 1)

	doRequest := func(ctx context.Context, url string, ch chan<- apiResult) {
		reqCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
		defer cancel()

		req, err := http.NewRequestWithContext(reqCtx, http.MethodGet, url, nil)
		if err != nil {
			ch <- apiResult{err: err}
			return
		}
		req.Header.Set("X-API-KEY", apiKey)
		req.Header.Set("accept", "application/json")
		req.Header.Set("x-chain", "solana")

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			ch <- apiResult{err: err}
			return
		}
		defer resp.Body.Close()

		body, err := io.ReadAll(resp.Body)
		if err != nil {
			ch <- apiResult{err: err}
			return
		}
		if resp.StatusCode != http.StatusOK {
			ch <- apiResult{err: fmt.Errorf("birdeye returned status %d: %s", resp.StatusCode, string(body))}
			return
		}
		ch <- apiResult{data: body}
	}

	go doRequest(ctx, overviewURL, overviewCh)
	go doRequest(ctx, securityURL, securityCh)

	overviewRes := <-overviewCh
	securityRes := <-securityCh

	if overviewRes.err != nil && securityRes.err != nil {
		return fmt.Sprintf("Failed to fetch Birdeye data for `%s`: %v", address, overviewRes.err), nil
	}

	var overview map[string]interface{}
	var security map[string]interface{}

	if overviewRes.err == nil {
		var raw map[string]interface{}
		if err := json.Unmarshal(overviewRes.data, &raw); err == nil {
			if d, ok := raw["data"].(map[string]interface{}); ok {
				overview = d
			}
		}
	}

	if securityRes.err == nil {
		var raw map[string]interface{}
		if err := json.Unmarshal(securityRes.data, &raw); err == nil {
			if d, ok := raw["data"].(map[string]interface{}); ok {
				security = d
			}
		}
	}

	result := formatBirdeyeResult(address, overview, security)

	birdeyeCache.Store(address, birdeyeCacheEntry{
		result:    result,
		fetchedAt: time.Now(),
	})

	return result, nil
}

// formatBirdeyeResult builds a markdown summary from the Birdeye API responses.
func formatBirdeyeResult(address string, overview, security map[string]interface{}) string {
	var b strings.Builder

	name := jsonStr(overview, "name")
	symbol := jsonStr(overview, "symbol")
	if name == "" {
		name = "Unknown Token"
	}
	if symbol == "" {
		symbol = "???"
	}

	b.WriteString(fmt.Sprintf("## %s (%s)\n", name, symbol))
	b.WriteString(fmt.Sprintf("`%s`\n\n", address))

	// Price and market data.
	if overview != nil {
		b.WriteString("### Market Data\n")
		if v, ok := jsonNum(overview, "price"); ok {
			b.WriteString(fmt.Sprintf("- **Price:** $%.10g\n", v))
		}
		if v, ok := jsonNum(overview, "mc"); ok {
			b.WriteString(fmt.Sprintf("- **Market Cap:** $%s\n", formatLargeNumber(v)))
		}
		if v, ok := jsonNum(overview, "realMc"); ok {
			b.WriteString(fmt.Sprintf("- **FDV:** $%s\n", formatLargeNumber(v)))
		}
		if v, ok := jsonNum(overview, "liquidity"); ok {
			b.WriteString(fmt.Sprintf("- **Liquidity:** $%s\n", formatLargeNumber(v)))
		}

		b.WriteString("\n### Price Changes\n")
		if v, ok := jsonNum(overview, "priceChange5mPercent"); ok {
			b.WriteString(fmt.Sprintf("- **5m:** %.2f%%\n", v))
		}
		if v, ok := jsonNum(overview, "priceChange1hPercent"); ok {
			b.WriteString(fmt.Sprintf("- **1h:** %.2f%%\n", v))
		}
		if v, ok := jsonNum(overview, "priceChange24hPercent"); ok {
			b.WriteString(fmt.Sprintf("- **24h:** %.2f%%\n", v))
		}

		b.WriteString("\n### Volume & Holders\n")
		if v, ok := jsonNum(overview, "v24hUSD"); ok {
			b.WriteString(fmt.Sprintf("- **24h Volume:** $%s\n", formatLargeNumber(v)))
		}
		if v, ok := jsonNum(overview, "holder"); ok {
			b.WriteString(fmt.Sprintf("- **Holders:** %s\n", formatLargeNumber(v)))
		}
		if v, ok := jsonNum(overview, "uniqueWallet24h"); ok {
			b.WriteString(fmt.Sprintf("- **Unique Wallets (24h):** %s\n", formatLargeNumber(v)))
		}
	}

	// Security info.
	if security != nil {
		b.WriteString("\n### Security\n")
		if v := jsonStr(security, "creatorAddress"); v != "" {
			b.WriteString(fmt.Sprintf("- **Creator:** `%s`\n", v))
		}
		if v, ok := jsonNum(security, "top10HolderPercent"); ok {
			b.WriteString(fmt.Sprintf("- **Top 10 Holder %%:** %.2f%%\n", v*100))
		}
		writeBool(&b, security, "isMintable", "Mintable")
		writeBool(&b, security, "isFreezable", "Freezable")
		writeBool(&b, security, "isMutable", "Mutable")
		if v := jsonStr(security, "metaplexUpdateAuthority"); v != "" {
			b.WriteString(fmt.Sprintf("- **Update Authority:** `%s`\n", v))
		}
	}

	return b.String()
}

// writeBool appends a boolean security field to the builder if present.
func writeBool(b *strings.Builder, m map[string]interface{}, key, label string) {
	if v, ok := m[key]; ok {
		switch val := v.(type) {
		case bool:
			b.WriteString(fmt.Sprintf("- **%s:** %v\n", label, val))
		case string:
			b.WriteString(fmt.Sprintf("- **%s:** %s\n", label, val))
		}
	}
}

// jsonStr extracts a string value from a map, returning "" if missing or not a string.
func jsonStr(m map[string]interface{}, key string) string {
	if m == nil {
		return ""
	}
	if v, ok := m[key]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}

// jsonNum extracts a float64 value from a map. JSON numbers unmarshal as float64.
func jsonNum(m map[string]interface{}, key string) (float64, bool) {
	if m == nil {
		return 0, false
	}
	if v, ok := m[key]; ok {
		if f, ok := v.(float64); ok {
			return f, true
		}
	}
	return 0, false
}

// formatLargeNumber formats a number with commas or abbreviations for readability.
func formatLargeNumber(n float64) string {
	abs := n
	if abs < 0 {
		abs = -abs
	}
	switch {
	case abs >= 1_000_000_000:
		return fmt.Sprintf("%.2fB", n/1_000_000_000)
	case abs >= 1_000_000:
		return fmt.Sprintf("%.2fM", n/1_000_000)
	case abs >= 1_000:
		return fmt.Sprintf("%.2fK", n/1_000)
	default:
		return fmt.Sprintf("%.2f", n)
	}
}
