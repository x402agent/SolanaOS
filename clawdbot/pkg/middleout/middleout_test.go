package middleout

import (
	"context"
	"fmt"
	"strings"
	"testing"
)

func TestCompressRoundTrip(t *testing.T) {
	orig := []byte(strings.Repeat("middle-out compression works\n", 200))
	comp := Compress(orig)
	if len(comp) >= len(orig) {
		t.Fatalf("compressed size %d not smaller than raw %d", len(comp), len(orig))
	}
	back, err := Decompress(comp)
	if err != nil {
		t.Fatal(err)
	}
	if string(back) != string(orig) {
		t.Fatal("decompressed payload does not match original")
	}
}

func TestCachePutGetAndHitRate(t *testing.T) {
	c := NewCache(1 << 20)
	payload := []byte(strings.Repeat("clawd", 1000))
	key := c.PutContent(payload)

	got, ok := c.Get(key)
	if !ok || string(got) != string(payload) {
		t.Fatal("expected cache hit with matching payload")
	}
	if _, ok := c.Get("nonexistent"); ok {
		t.Fatal("expected miss for unknown key")
	}
	s := c.Stats()
	if s.Hits != 1 || s.Misses != 1 {
		t.Fatalf("hits=%d misses=%d, want 1/1", s.Hits, s.Misses)
	}
	if s.HitRate != 0.5 {
		t.Fatalf("hitRate=%.2f, want 0.5", s.HitRate)
	}
	if s.CompressionRatio <= 1 {
		t.Fatalf("expected compression ratio > 1, got %.2f", s.CompressionRatio)
	}
}

func TestCacheDedupe(t *testing.T) {
	c := NewCache(1 << 20)
	payload := []byte("same content")
	k1 := c.PutContent(payload)
	k2 := c.PutContent(payload) // identical → same key, dedupe
	if k1 != k2 {
		t.Fatal("identical content produced different keys")
	}
	s := c.Stats()
	if s.Entries != 1 {
		t.Fatalf("entries=%d, want 1 (deduped)", s.Entries)
	}
	if s.Dedupes != 1 {
		t.Fatalf("dedupes=%d, want 1", s.Dedupes)
	}
}

func TestCacheLRUEviction(t *testing.T) {
	// Tiny budget forces eviction; distinct incompressible-ish payloads.
	c := NewCache(400)
	keys := make([]string, 0, 20)
	for i := 0; i < 20; i++ {
		p := []byte(fmt.Sprintf("payload-number-%d-with-some-padding-xxxxxxxxxxxxxxxxxxxx", i))
		keys = append(keys, c.PutContent(p))
	}
	s := c.Stats()
	if s.CompressedBytes > s.MaxBytes {
		t.Fatalf("cache over budget: %d > %d", s.CompressedBytes, s.MaxBytes)
	}
	if s.Evictions == 0 {
		t.Fatal("expected evictions under a tiny budget")
	}
	// The most-recently inserted key should still be present.
	if !c.Has(keys[len(keys)-1]) {
		t.Fatal("most-recent key was evicted")
	}
}

func TestRalphLoopReachesGoal(t *testing.T) {
	// Step appends a '#'; goal is 3 of them.
	step := func(ctx context.Context, iter int, state string, cache *Cache) (string, error) {
		return state + "#", nil
	}
	res := RunLoop(context.Background(), LoopConfig{Input: "", MaxIters: 10}, step, GoalContains("###"))
	if !res.GoalMet {
		t.Fatalf("goal not met: %+v", res)
	}
	if res.Reason != "goal" {
		t.Fatalf("reason=%q, want goal", res.Reason)
	}
	if res.Iterations != 3 {
		t.Fatalf("iterations=%d, want 3", res.Iterations)
	}
}

func TestRalphLoopConverges(t *testing.T) {
	// Idempotent step: output equals input after the first application, so the
	// loop must detect convergence rather than spin to MaxIters.
	step := func(ctx context.Context, iter int, state string, cache *Cache) (string, error) {
		return "fixed", nil
	}
	res := RunLoop(context.Background(), LoopConfig{Input: "start", MaxIters: 50}, step, GoalContains("never"))
	if res.Reason != "converged" {
		t.Fatalf("reason=%q, want converged", res.Reason)
	}
	if res.Iterations > 2 {
		t.Fatalf("iterations=%d, want convergence within 2", res.Iterations)
	}
}

func TestRalphLoopHitsMaxIters(t *testing.T) {
	step := func(ctx context.Context, iter int, state string, cache *Cache) (string, error) {
		return fmt.Sprintf("%s-%d", state, iter), nil // always novel
	}
	res := RunLoop(context.Background(), LoopConfig{Input: "x", MaxIters: 5}, step, GoalContains("never"))
	if res.Reason != "max_iters" || res.Iterations != 5 {
		t.Fatalf("reason=%q iters=%d, want max_iters/5", res.Reason, res.Iterations)
	}
}

func TestRalphLoopCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel() // cancel immediately
	step := func(ctx context.Context, iter int, state string, cache *Cache) (string, error) {
		return state + "x", nil
	}
	res := RunLoop(ctx, LoopConfig{Input: "x", MaxIters: 100}, step, GoalContains("never"))
	if res.Reason != "cancelled" {
		t.Fatalf("reason=%q, want cancelled", res.Reason)
	}
}

func TestRouterRoutesBySize(t *testing.T) {
	r := NewRouter(nil, SizeRoute("small", 16), SizeRoute("large", 1<<30))
	small, _ := r.Route([]byte("tiny"))
	if small != "small" {
		t.Fatalf("small payload routed to %q, want small", small)
	}
	big, _ := r.Route([]byte(strings.Repeat("z", 100)))
	if big != "large" {
		t.Fatalf("large payload routed to %q, want large", big)
	}
	// Second identical route is served from cache and stays consistent.
	again, _ := r.Route([]byte("tiny"))
	if again != "small" {
		t.Fatalf("cached route changed to %q", again)
	}
}
