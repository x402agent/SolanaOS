package trading

import "testing"

func baseLimits() PortfolioLimits {
	return PortfolioLimits{
		MaxConcurrent:     3,
		MaxTotalExposure:  1.0,
		MaxPerAsset:       0.5,
		MaxDrawdownPct:    0.25,
		DailyLossLimitPct: 0.10,
	}
}

func healthyExposure() OpenExposure {
	return OpenExposure{
		Count:              1,
		TotalSOL:           0.2,
		PerAssetSOL:        map[string]float64{"SOL": 0.2},
		PeakEquity:         10,
		Equity:             10,
		SessionStartEquity: 10,
		SessionPnLSOL:      0,
	}
}

func TestGuardAllowsHealthyEntry(t *testing.T) {
	got := baseLimits().CheckEntry("BONK", 0.1, healthyExposure())
	if !got.Allowed {
		t.Fatalf("expected allowed, got blocked: %v", got.Reasons)
	}
}

func TestGuardBlocksOnMaxConcurrent(t *testing.T) {
	exp := healthyExposure()
	exp.Count = 3
	if got := baseLimits().CheckEntry("BONK", 0.1, exp); got.Allowed {
		t.Fatal("expected block at max concurrent positions")
	}
}

func TestGuardBlocksOnTotalExposure(t *testing.T) {
	exp := healthyExposure()
	exp.TotalSOL = 0.95
	if got := baseLimits().CheckEntry("BONK", 0.1, exp); got.Allowed {
		t.Fatal("expected block: 0.95 + 0.1 > 1.0 cap")
	}
}

func TestGuardBlocksOnPerAsset(t *testing.T) {
	exp := healthyExposure()
	exp.PerAssetSOL = map[string]float64{"SOL": 0.45}
	if got := baseLimits().CheckEntry("SOL", 0.1, exp); got.Allowed {
		t.Fatal("expected block: SOL 0.45 + 0.1 > 0.5 per-asset cap")
	}
}

func TestGuardDrawdownCircuitBreaker(t *testing.T) {
	exp := healthyExposure()
	exp.PeakEquity = 10
	exp.Equity = 7 // 30% drawdown > 25% limit
	got := baseLimits().CheckEntry("BONK", 0.1, exp)
	if got.Allowed {
		t.Fatal("expected drawdown circuit breaker to block")
	}
	if exp.Drawdown() < 0.29 || exp.Drawdown() > 0.31 {
		t.Fatalf("Drawdown = %.4f, want ~0.30", exp.Drawdown())
	}
}

func TestGuardDailyLossLimit(t *testing.T) {
	exp := healthyExposure()
	exp.SessionStartEquity = 10
	exp.SessionPnLSOL = -1.5 // 15% session loss > 10% limit
	if got := baseLimits().CheckEntry("BONK", 0.1, exp); got.Allowed {
		t.Fatal("expected daily loss limit to block")
	}
}

func TestGuardZeroMaxConcurrentHalts(t *testing.T) {
	l := baseLimits()
	l.MaxConcurrent = 0
	if got := l.CheckEntry("BONK", 0.1, healthyExposure()); got.Allowed {
		t.Fatal("expected halt when MaxConcurrent is 0")
	}
}

func TestGuardCollectsAllViolations(t *testing.T) {
	exp := healthyExposure()
	exp.Count = 5
	exp.TotalSOL = 2.0
	got := baseLimits().CheckEntry("BONK", 0.1, exp)
	if got.Allowed {
		t.Fatal("expected block")
	}
	if len(got.Reasons) < 2 {
		t.Fatalf("expected multiple reasons, got %v", got.Reasons)
	}
}
