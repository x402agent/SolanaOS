package vulcan

import (
	"reflect"
	"testing"
)

func TestOrderArgsPaperMarket(t *testing.T) {
	r := New(Config{})
	args, err := r.OrderArgs(OrderSpec{
		Symbol:       "sol",
		Side:         "buy",
		OrderType:    "market",
		NotionalUSDC: 25,
	})
	if err != nil {
		t.Fatal(err)
	}
	want := []string{"paper", "buy", "SOL", "--type", "market", "--notional-usdc", "25", "-o", "json"}
	if !reflect.DeepEqual(args, want) {
		t.Fatalf("args = %#v, want %#v", args, want)
	}
}

func TestOrderArgsLiveRequiresAck(t *testing.T) {
	r := New(Config{})
	_, err := r.OrderArgs(OrderSpec{
		Mode:         ModeLive,
		Symbol:       "SOL",
		Side:         "buy",
		OrderType:    "market",
		NotionalUSDC: 25,
	})
	if err == nil {
		t.Fatal("expected live ack error")
	}
}

func TestOrderArgsLiveMarket(t *testing.T) {
	r := New(Config{})
	args, err := r.OrderArgs(OrderSpec{
		Mode:         ModeLive,
		Symbol:       "SOL",
		Side:         "sell",
		OrderType:    "market",
		NotionalUSDC: 25,
		ReduceOnly:   true,
		Wallet:       "bot-wallet",
		Yes:          true,
	})
	if err != nil {
		t.Fatal(err)
	}
	want := []string{"trade", "market-sell", "SOL", "--yes", "-w", "bot-wallet", "--notional-usdc", "25", "--reduce-only", "-o", "json"}
	if !reflect.DeepEqual(args, want) {
		t.Fatalf("args = %#v, want %#v", args, want)
	}
}

func TestOrderArgsLiveMarketSizeIsPositional(t *testing.T) {
	r := New(Config{})
	args, err := r.OrderArgs(OrderSpec{
		Mode:      ModeLive,
		Symbol:    "SOL",
		Side:      "buy",
		OrderType: "market",
		Size:      2,
		Yes:       true,
	})
	if err != nil {
		t.Fatal(err)
	}
	want := []string{"trade", "market-buy", "SOL", "--yes", "2", "-o", "json"}
	if !reflect.DeepEqual(args, want) {
		t.Fatalf("args = %#v, want %#v", args, want)
	}
}

func TestOrderArgsLimitLiveRequiresBaseLots(t *testing.T) {
	r := New(Config{})
	_, err := r.OrderArgs(OrderSpec{
		Mode:      ModeLive,
		Symbol:    "SOL",
		Side:      "buy",
		OrderType: "limit",
		Tokens:    0.1,
		Price:     200,
		Yes:       true,
	})
	if err == nil {
		t.Fatal("expected base-lots error")
	}
}

func TestTWAPArgsDefaultGuardrails(t *testing.T) {
	r := New(Config{MaxStepNotionalUSDC: 5, MaxTotalNotionalUSDC: 20, MaxPriceDriftBPS: 50, MaxExposureRatio: 1.5})
	args, err := r.TWAPArgs(TWAPSpec{
		Symbol:       "sol",
		Side:         "buy",
		NotionalUSDC: 100,
		Slices:       4,
		Detached:     true,
	})
	if err != nil {
		t.Fatal(err)
	}
	want := []string{
		"strategy", "twap", "start",
		"--symbol", "SOL",
		"--side", "buy",
		"--slices", "4",
		"--interval-seconds", "60",
		"--mode", "paper",
		"--notional-usdc", "100",
		"--max-step-notional-usdc", "5",
		"--max-total-notional-usdc", "20",
		"--max-price-drift-bps", "50",
		"--max-exposure-ratio", "1.5",
		"--detached",
		"-o", "json",
	}
	if !reflect.DeepEqual(args, want) {
		t.Fatalf("args = %#v, want %#v", args, want)
	}
}

func TestGridArgsCenterOnMark(t *testing.T) {
	r := New(Config{})
	args, err := r.GridArgs(GridSpec{
		Symbol:         "SOL",
		CenterOnMark:   true,
		WidthPct:       2.5,
		LevelsPerSide:  3,
		TokensPerLevel: 0.1,
	})
	if err != nil {
		t.Fatal(err)
	}
	for _, token := range []string{"strategy", "grid", "start", "--center-on-mark", "--width-pct", "2.5", "--tokens-per-level", "0.1"} {
		if !contains(args, token) {
			t.Fatalf("args missing %q: %#v", token, args)
		}
	}
}

func contains(values []string, want string) bool {
	for _, value := range values {
		if value == want {
			return true
		}
	}
	return false
}
