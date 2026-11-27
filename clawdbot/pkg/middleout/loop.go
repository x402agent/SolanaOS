package middleout

import (
	"context"
	"strings"
	"time"
)

// ── Ralph loop ────────────────────────────────────────────────────────
// A "Ralph loop" runs a step function repeatedly toward a goal, feeding each
// step's output back as the next step's input, until the goal predicate holds,
// the step converges (produces the same output twice — detected via the content
// cache), the iteration budget is exhausted, or the context is cancelled. Every
// step output is content-cached and compressed in realtime.

// Step transforms the current state into the next. iter is 0-based. It may read
// or write the shared cache. Returning an error stops the loop.
type Step func(ctx context.Context, iter int, state string, cache *Cache) (string, error)

// Goal reports whether the loop has reached its objective given the latest state.
type Goal func(state string) bool

// LoopConfig configures a Ralph loop run.
type LoopConfig struct {
	Input    string        // initial state fed to the first step
	MaxIters int           // hard cap on iterations (default 32)
	Delay    time.Duration // optional pause between steps
	Cache    *Cache        // content cache; created if nil
}

// LoopResult summarizes a completed run.
type LoopResult struct {
	Iterations int    `json:"iterations"`
	Final      string `json:"final"`
	Reason     string `json:"reason"` // "goal" | "converged" | "max_iters" | "cancelled" | "error"
	GoalMet    bool   `json:"goalMet"`
	Err        string `json:"err,omitempty"`
	Cache      Stats  `json:"cache"`
}

// RunLoop executes the Ralph loop. It stops when goal(state) holds, when a step
// reproduces a previous state (convergence — the content key was already seen),
// at MaxIters, on context cancellation, or on a step error.
func RunLoop(ctx context.Context, cfg LoopConfig, step Step, goal Goal) LoopResult {
	if cfg.MaxIters <= 0 {
		cfg.MaxIters = 32
	}
	cache := cfg.Cache
	if cache == nil {
		cache = NewCache(0)
	}
	state := cfg.Input
	seen := make(map[string]bool)

	res := LoopResult{Final: state, Reason: "max_iters"}

	// A goal already satisfied by the input needs no iterations.
	if goal != nil && goal(state) {
		res.GoalMet = true
		res.Reason = "goal"
		res.Cache = cache.Stats()
		return res
	}

	for i := 0; i < cfg.MaxIters; i++ {
		select {
		case <-ctx.Done():
			res.Reason = "cancelled"
			res.Iterations = i
			res.Final = state
			res.Cache = cache.Stats()
			return res
		default:
		}

		next, err := step(ctx, i, state, cache)
		res.Iterations = i + 1
		if err != nil {
			res.Reason = "error"
			res.Err = err.Error()
			res.Final = state
			res.Cache = cache.Stats()
			return res
		}

		// Cache the output and detect convergence via its content key.
		key := cache.PutContent([]byte(next))
		state = next
		res.Final = next

		if goal != nil && goal(state) {
			res.GoalMet = true
			res.Reason = "goal"
			res.Cache = cache.Stats()
			return res
		}
		if seen[key] {
			res.Reason = "converged"
			res.Cache = cache.Stats()
			return res
		}
		seen[key] = true

		if cfg.Delay > 0 {
			select {
			case <-ctx.Done():
				res.Reason = "cancelled"
				res.Cache = cache.Stats()
				return res
			case <-time.After(cfg.Delay):
			}
		}
	}
	res.Cache = cache.Stats()
	return res
}

// GoalContains returns a Goal satisfied when the state contains substr.
func GoalContains(substr string) Goal {
	return func(state string) bool { return strings.Contains(state, substr) }
}

// ── Content router ────────────────────────────────────────────────────
// Auto-routes a payload to the best-scoring named route, with results served
// from the content cache when the same payload was routed before.

// Route is one named destination with a scorer; the highest score wins.
type Route struct {
	Name  string
	Score func(payload []byte) float64
}

// Router picks among routes by score and memoizes decisions by content key.
type Router struct {
	routes []Route
	cache  *Cache
}

// NewRouter builds a router over the given routes, backed by cache (created if nil).
func NewRouter(cache *Cache, routes ...Route) *Router {
	if cache == nil {
		cache = NewCache(0)
	}
	return &Router{routes: routes, cache: cache}
}

// Route returns the winning route name for payload. Ties break toward the
// earlier-registered route. The decision is cached by content key so identical
// payloads route consistently and cheaply.
func (r *Router) Route(payload []byte) (string, bool) {
	if len(r.routes) == 0 {
		return "", false
	}
	key := "route:" + ContentKey(payload)
	if cached, ok := r.cache.Get(key); ok {
		return string(cached), true
	}
	best := r.routes[0].Name
	bestScore := r.routes[0].Score(payload)
	for _, rt := range r.routes[1:] {
		if s := rt.Score(payload); s > bestScore {
			bestScore = s
			best = rt.Name
		}
	}
	r.cache.Put(key, []byte(best))
	return best, true
}

// Routes returns the registered route names, in priority order.
func (r *Router) Routes() []string {
	names := make([]string, len(r.routes))
	for i, rt := range r.routes {
		names[i] = rt.Name
	}
	return names
}

// SizeRoute scores high for payloads at or below maxBytes — a lane for small
// payloads. Pair two of these to split traffic by size.
func SizeRoute(name string, maxBytes int) Route {
	return Route{
		Name: name,
		Score: func(p []byte) float64 {
			if len(p) <= maxBytes {
				return 1
			}
			return 0
		},
	}
}
