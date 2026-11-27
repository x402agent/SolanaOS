package aster

import (
	"bufio"
	"fmt"
	"math/rand"
	"os"
	"testing"
)

// TestWriteParityVectors emits differential vectors from the real Go gate and
// sizing code (preTradeGate + sizePosition) for the Rust port and the Lean
// executable spec (formal/risk-gate). It only runs when
// SOLANAOS_PARITY_VECTORS is set to an output path.
//
// Integer inputs are scaled exactly as the Rust/Lean side expects:
// confidence and percentages in bps, money in cents (Rust/Lean use micro-USD).
func TestWriteParityVectors(t *testing.T) {
	out := os.Getenv("SOLANAOS_PARITY_VECTORS")
	if out == "" {
		t.Skip("set SOLANAOS_PARITY_VECTORS=<path> to write vectors")
	}
	f, err := os.Create(out)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	w := bufio.NewWriter(f)
	defer w.Flush()
	fmt.Fprintln(w, "conf_bps,active,max_pos,has_pos,sig_pct_bps,max_pct_bps,sig_lev,def_lev,max_lev,balance_cents,min_notional_cents,go_status,go_notional_micro")

	r := rand.New(rand.NewSource(42))
	pick := func(edges []int, hi int) int {
		if r.Intn(3) == 0 {
			return edges[r.Intn(len(edges))]
		}
		return r.Intn(hi + 1)
	}
	for i := 0; i < 20000; i++ {
		conf := pick([]int{0, 5999, 6000, 6001, 10000}, 10000)
		maxPos := 1 + pick([]int{0, 4}, 5)
		active := pick([]int{0, 1, maxPos - 1, maxPos}, 6)
		hasPos := r.Intn(4) == 3
		sigPct := pick([]int{0, 1, 999, 1000, 1001, 10000}, 12000)
		maxPct := 1 + pick([]int{99, 999}, 9999)
		sigLev := pick([]int{0, 1, 5, 10, 11, 125, 126, 1000}, 200)
		defLev := 1 + pick([]int{0, 4}, 19)
		maxLev := defLev + pick([]int{0, 5}, 50)
		balance := pick([]int{0, 1, 499, 500, 100000000}, 10000000)
		minNotional := 1 + pick([]int{0, 499}, 99999)

		tr := NewPerpTrader(TraderConfig{
			DefaultLeverage: defLev, MaxLeverage: maxLev, MaxPositions: maxPos,
			MaxPositionPct: float64(maxPct) / 10000, MinNotional: float64(minNotional) / 100,
		})
		for j := 0; j < active; j++ {
			tr.activePositions[fmt.Sprintf("OTHER%d", j)] = &ManagedPosition{}
		}
		if hasPos {
			tr.activePositions["SOLUSDT"] = &ManagedPosition{}
		}
		sig := TradeSignal{Symbol: "SOLUSDT", Confidence: float64(conf) / 10000, SizePct: float64(sigPct) / 10000, Leverage: sigLev}

		status, notional := "accepted", 0.0
		if err := tr.preTradeGate(sig); err != nil {
			status = gateStatus(tr, sig)
		} else if _, _, n, err := tr.sizePosition(sig, float64(balance)/100); err != nil {
			status = "below_min_notional"
		} else {
			notional = n
		}
		// active column is the full open-position count, including SOLUSDT.
		fmt.Fprintf(w, "%d,%d,%d,%d,%d,%d,%d,%d,%d,%d,%d,%s,%.0f\n", conf, len(tr.activePositions), maxPos, b2i(hasPos),
			sigPct, maxPct, sigLev, defLev, tr.maxLeverage, balance, minNotional, status, notional*1e6)
	}
}

func gateStatus(tr *PerpTrader, s TradeSignal) string {
	switch {
	case s.Confidence < MinSignalConfidence:
		return "low_confidence"
	case len(tr.activePositions) >= tr.maxPositions:
		return "max_positions"
	default:
		return "already_open"
	}
}

func b2i(b bool) int {
	if b {
		return 1
	}
	return 0
}
