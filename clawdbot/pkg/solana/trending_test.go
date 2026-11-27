package solana

import (
	"strings"
	"testing"
)

func TestSelectTrendingSource(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name string
		key  string
		want string
	}{
		{name: "empty uses jupiter", key: "", want: "jupiter"},
		{name: "whitespace uses jupiter", key: "  ", want: "jupiter"},
		{name: "key uses birdeye", key: "abc", want: "birdeye"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			got := SelectTrendingSource(tc.key)
			if got != tc.want {
				t.Fatalf("SelectTrendingSource(%q) = %q, want %q", tc.key, got, tc.want)
			}
		})
	}
}

func TestRowsFromJupiterPricesPreservesWatchlist(t *testing.T) {
	t.Parallel()
	watch := DefaultWatchlist()[:3]
	prices := map[string]JupiterPrice{
		watch[0].Mint: {Mint: watch[0].Mint, USDPrice: 180.25, PriceChange24h: 1.5},
		watch[2].Mint: {Mint: watch[2].Mint, USDPrice: 0.000012, PriceChange24h: -2.2},
	}
	rows := RowsFromJupiterPrices(watch, prices)
	if len(rows) != 2 {
		t.Fatalf("got %d rows, want 2 (skip unpriced)", len(rows))
	}
	if rows[0].Symbol != watch[0].Symbol || rows[0].Price != 180.25 {
		t.Fatalf("first row = %+v, want %s @ 180.25", rows[0], watch[0].Symbol)
	}
	if rows[0].Source != "jupiter" {
		t.Fatalf("source = %q, want jupiter", rows[0].Source)
	}
	if rows[1].Symbol != watch[2].Symbol {
		t.Fatalf("second row symbol = %q, want %s", rows[1].Symbol, watch[2].Symbol)
	}
}

func TestFormatTrendingIncludesSymbolsAndPrices(t *testing.T) {
	t.Parallel()
	rows := []MarketRow{
		{Symbol: "SOL", Price: 180.25, Change24h: 1.5, MarketCap: 1e9, Volume24h: 2e8, Source: "jupiter"},
		{Symbol: "JUP", Price: 0.75, Change24h: -0.4, MarketCap: 1e8, Volume24h: 3e7, Source: "jupiter"},
	}
	got := FormatTrending(rows)
	for _, need := range []string{"SOL", "JUP", "180.250000", "0.750000", "jupiter"} {
		if !strings.Contains(got, need) {
			t.Fatalf("FormatTrending missing %q in:\n%s", need, got)
		}
	}
}

func TestDefaultWatchlistHasSOL(t *testing.T) {
	t.Parallel()
	found := false
	for _, tok := range DefaultWatchlist() {
		if tok.Symbol == "SOL" && tok.Mint == SOLMint {
			found = true
			break
		}
	}
	if !found {
		t.Fatal("DefaultWatchlist missing SOL mint")
	}
}

func TestFetchTrendingJupiterFallback(t *testing.T) {
	rows, err := FetchTrending(TrendingRequest{Limit: 4})
	if err != nil {
		t.Fatalf("FetchTrending: %v", err)
	}
	if len(rows) == 0 {
		t.Fatal("FetchTrending returned no rows")
	}
	if rows[0].Symbol == "" {
		t.Fatal("first row has empty symbol")
	}
	if rows[0].Price <= 0 {
		t.Fatalf("first row has non-positive price: %+v", rows[0])
	}
	if rows[0].Source != "jupiter" {
		t.Fatalf("source = %q, want jupiter for keyless fetch", rows[0].Source)
	}
}
