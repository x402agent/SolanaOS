package trading

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"math"
	"testing"

	"github.com/x402agent/Solana-Os-Go/pkg/memory"
)

type fakeExchange struct {
	placed  int
	mark    float64
	markErr error
	candles []Candle
}

func (f *fakeExchange) Name() string                                     { return "fake" }
func (f *fakeExchange) GetAccount(context.Context) (*AccountInfo, error) { return nil, nil }
func (f *fakeExchange) GetPositions(context.Context) ([]Position, error) { return nil, nil }
func (f *fakeExchange) ClosePosition(context.Context, string) (*OrderResult, error) {
	return nil, nil
}
func (f *fakeExchange) GetCandles(context.Context, string, string, int) ([]Candle, error) {
	return f.candles, nil
}
func (f *fakeExchange) PlaceOrder(_ context.Context, r OrderRequest) (*OrderResult, error) {
	f.placed++
	return &OrderResult{Symbol: r.Symbol, Size: r.Size}, nil
}

type quotingExchange struct{ fakeExchange }

func (q *quotingExchange) MarkPrice(context.Context, string) (float64, error) {
	return q.mark, q.markErr
}

func newEngine(ex Exchange, limits RiskLimits) *TradingEngine {
	te := NewTradingEngine(memory.NoopVault{}, limits, slog.New(slog.NewTextHandler(io.Discard, nil)))
	te.RegisterExchange(ex)
	return te
}

var limits = RiskLimits{MaxPositionUSD: 1000, MaxLeverage: 5}

func TestExecuteOrderRiskGate(t *testing.T) {
	cases := []struct {
		name   string
		ex     func() Exchange
		req    OrderRequest
		accept bool
	}{
		{"limit within caps", plain, OrderRequest{Symbol: "SOL", Size: 1, Price: 100, Leverage: 2, OrderType: OrderLimit}, true},
		{"limit over notional cap", plain, OrderRequest{Symbol: "SOL", Size: 1000, Price: 100, Leverage: 2, OrderType: OrderLimit}, false},
		{"leverage over cap", plain, OrderRequest{Symbol: "SOL", Size: 1, Price: 100, Leverage: 6, OrderType: OrderLimit}, false},
		// Regressions: these were all accepted before.
		{"market huge, mark price quoted", quoting(100), OrderRequest{Symbol: "SOL", Size: 1e9, Leverage: 2, OrderType: OrderMarket}, false},
		{"market huge, candle fallback", candle(100), OrderRequest{Symbol: "SOL", Size: 1e9, Leverage: 2, OrderType: OrderMarket}, false},
		{"market without any reference price", plain, OrderRequest{Symbol: "SOL", Size: 1, Leverage: 2, OrderType: OrderMarket}, false},
		{"market small, mark price quoted", quoting(100), OrderRequest{Symbol: "SOL", Size: 1, Leverage: 2, OrderType: OrderMarket}, true},
		{"market small, candle fallback", candle(100), OrderRequest{Symbol: "SOL", Size: 1, Leverage: 2, OrderType: OrderMarket}, true},
		{"limit without price", plain, OrderRequest{Symbol: "SOL", Size: 1, Leverage: 2, OrderType: OrderLimit}, false},
		{"NaN size", plain, OrderRequest{Symbol: "SOL", Size: math.NaN(), Price: 100, Leverage: 2}, false},
		{"Inf size", plain, OrderRequest{Symbol: "SOL", Size: math.Inf(1), Price: 100, Leverage: 2}, false},
		{"NaN leverage", plain, OrderRequest{Symbol: "SOL", Size: 1, Price: 100, Leverage: math.NaN()}, false},
		{"NaN price", plain, OrderRequest{Symbol: "SOL", Size: 1, Price: math.NaN(), Leverage: 2}, false},
		{"negative size", plain, OrderRequest{Symbol: "SOL", Size: -1e9, Price: 100, Leverage: 2}, false},
		{"zero size", plain, OrderRequest{Symbol: "SOL", Size: 0, Price: 100, Leverage: 2}, false},
		{"zero leverage", plain, OrderRequest{Symbol: "SOL", Size: 1, Price: 100, Leverage: 0}, false},
		{"negative leverage", plain, OrderRequest{Symbol: "SOL", Size: 1, Price: 100, Leverage: -3}, false},
		{"negative price", plain, OrderRequest{Symbol: "SOL", Size: 1, Price: -100, Leverage: 2}, false},
		{"bad mark price falls through to rejection", quotingErr, OrderRequest{Symbol: "SOL", Size: 1, Leverage: 2, OrderType: OrderMarket}, false},
	}
	for _, c := range cases {
		ex := c.ex()
		te := newEngine(ex, limits)
		_, err := te.ExecuteOrder(context.Background(), nil, ex.Name(), c.req)
		placed := placedOf(ex)
		if c.accept && (err != nil || placed != 1) {
			t.Errorf("%s: want accepted, got err=%v placed=%d", c.name, err, placed)
		}
		if !c.accept && (err == nil || placed != 0) {
			t.Errorf("%s: want rejected before PlaceOrder, got err=%v placed=%d", c.name, err, placed)
		}
	}
}

func TestExecuteOrderFailsClosedWithoutLimits(t *testing.T) {
	for _, l := range []RiskLimits{{}, {MaxPositionUSD: 1000}, {MaxLeverage: 5}, {MaxPositionUSD: math.NaN(), MaxLeverage: 5}} {
		ex := &fakeExchange{}
		te := newEngine(ex, l)
		if _, err := te.ExecuteOrder(context.Background(), nil, "fake", OrderRequest{Symbol: "SOL", Size: 1, Price: 1, Leverage: 1}); err == nil || ex.placed != 0 {
			t.Errorf("limits %+v: want rejection, got err=%v placed=%d", l, err, ex.placed)
		}
	}
}

func plain() Exchange { return &fakeExchange{} }
func quoting(p float64) func() Exchange {
	return func() Exchange { return &quotingExchange{fakeExchange{mark: p}} }
}
func quotingErr() Exchange {
	return &quotingExchange{fakeExchange{markErr: errors.New("down")}}
}
func candle(p float64) func() Exchange {
	return func() Exchange { return &fakeExchange{candles: []Candle{{Close: p}}} }
}
func placedOf(ex Exchange) int {
	switch e := ex.(type) {
	case *fakeExchange:
		return e.placed
	case *quotingExchange:
		return e.placed
	}
	return -1
}
