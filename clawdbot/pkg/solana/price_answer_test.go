package solana

import (
	"strings"
	"testing"
)

func TestLooksLikePriceQuery(t *testing.T) {
	t.Parallel()
	cases := []struct {
		q    string
		want bool
	}{
		{q: "What is SOL price?", want: true},
		{q: "sol price", want: true},
		{q: "how much is jup worth", want: true},
		{q: "hello there", want: false},
		{q: "", want: false},
	}
	for _, tc := range cases {
		t.Run(tc.q, func(t *testing.T) {
			t.Parallel()
			if got := LooksLikePriceQuery(tc.q); got != tc.want {
				t.Fatalf("LooksLikePriceQuery(%q) = %v, want %v", tc.q, got, tc.want)
			}
		})
	}
}

func TestFormatPriceAnswerRendersSnapshot(t *testing.T) {
	t.Parallel()
	prices := map[string]JupiterPrice{
		SOLMint: {Mint: SOLMint, USDPrice: 181.25, PriceChange24h: 2.5},
	}
	got := FormatPriceAnswer("What is SOL price?", prices)
	for _, need := range []string{"SOL", "181.2500", "zkrouter"} {
		if !strings.Contains(got, need) {
			t.Fatalf("FormatPriceAnswer missing %q in %q", need, got)
		}
	}
}

func TestLivePriceAnswerSOL(t *testing.T) {
	got, err := LivePriceAnswer("What is SOL price?")
	if err != nil {
		t.Fatalf("LivePriceAnswer: %v", err)
	}
	if !strings.Contains(got, "SOL") {
		t.Fatalf("answer missing SOL: %q", got)
	}
	if !strings.Contains(got, "$") {
		t.Fatalf("answer missing price: %q", got)
	}
}
