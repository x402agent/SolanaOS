// Package health provides system health checks for MawdBot.
// Adapted from PicoClaw — reports status of all connectors and subsystems.
package health

import (
	"context"
	"sync"
	"time"
)

type Status string

const (
	StatusOK       Status = "ok"
	StatusDegraded Status = "degraded"
	StatusDown     Status = "down"
	StatusUnknown  Status = "unknown"
)

type CheckResult struct {
	Name     string        `json:"name"`
	Status   Status        `json:"status"`
	Latency  time.Duration `json:"latency"`
	Message  string        `json:"message,omitempty"`
	LastCheck time.Time    `json:"last_check"`
}

type CheckFunc func(ctx context.Context) CheckResult

type Checker struct {
	mu     sync.RWMutex
	checks map[string]CheckFunc
	cache  map[string]CheckResult
}

func NewChecker() *Checker {
	return &Checker{
		checks: make(map[string]CheckFunc),
		cache:  make(map[string]CheckResult),
	}
}

func (c *Checker) Register(name string, fn CheckFunc) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.checks[name] = fn
}

func (c *Checker) RunAll(ctx context.Context) map[string]CheckResult {
	c.mu.RLock()
	checks := make(map[string]CheckFunc, len(c.checks))
	for k, v := range c.checks {
		checks[k] = v
	}
	c.mu.RUnlock()

	results := make(map[string]CheckResult, len(checks))
	var wg sync.WaitGroup
	var mu sync.Mutex

	for name, fn := range checks {
		wg.Add(1)
		go func(n string, f CheckFunc) {
			defer wg.Done()
			r := f(ctx)
			r.Name = n
			r.LastCheck = time.Now()
			mu.Lock()
			results[n] = r
			mu.Unlock()
		}(name, fn)
	}

	wg.Wait()

	// Cache results
	c.mu.Lock()
	c.cache = results
	c.mu.Unlock()

	return results
}

func (c *Checker) GetCached() map[string]CheckResult {
	c.mu.RLock()
	defer c.mu.RUnlock()
	result := make(map[string]CheckResult, len(c.cache))
	for k, v := range c.cache {
		result[k] = v
	}
	return result
}

func (c *Checker) Overall() Status {
	c.mu.RLock()
	defer c.mu.RUnlock()
	if len(c.cache) == 0 {
		return StatusUnknown
	}
	hasDown := false
	hasDegraded := false
	for _, r := range c.cache {
		switch r.Status {
		case StatusDown:
			hasDown = true
		case StatusDegraded:
			hasDegraded = true
		}
	}
	if hasDown {
		return StatusDown
	}
	if hasDegraded {
		return StatusDegraded
	}
	return StatusOK
}
