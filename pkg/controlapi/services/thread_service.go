package services

import (
	"fmt"
	"sync"
	"time"

	"github.com/x402agent/Solana-Os-Go/pkg/controlapi/types"
)

type ThreadService struct {
	mu      sync.RWMutex
	threads []types.ThreadItem
}

func NewThreadService() *ThreadService {
	now := time.Now().UTC()
	return &ThreadService{
		threads: []types.ThreadItem{
			{
				ID:        "thread-1",
				Author:    "nano.sol",
				Headline:  "Seeker launch watch",
				Body:      "Pump.fun, Token Mill, and Grok vision can share one control surface once the app is backed by a single server API.",
				Kind:      "market",
				Stats:     "seeded",
				CreatedAt: now,
			},
			{
				ID:        "thread-2",
				Author:    "grok.vision",
				Headline:  "Vision remains additive",
				Body:      "OpenRouter live camera commentary stays available as its own feature and does not get disabled by Solana trading or social surfaces.",
				Kind:      "quote",
				Stats:     "seeded",
				CreatedAt: now.Add(1 * time.Second),
			},
		},
	}
}

func (s *ThreadService) List() []types.ThreadItem {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]types.ThreadItem, len(s.threads))
	copy(out, s.threads)
	return out
}

func (s *ThreadService) Count() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.threads)
}

func (s *ThreadService) Create(req types.CreateThreadRequest) types.ThreadItem {
	s.mu.Lock()
	defer s.mu.Unlock()
	item := types.ThreadItem{
		ID:        fmt.Sprintf("thread-%d", len(s.threads)+1),
		Author:    defaultString(req.Author, "anonymous"),
		Headline:  req.Headline,
		Body:      req.Body,
		Kind:      defaultString(req.Kind, "thread"),
		Stats:     defaultString(req.Stats, "just now"),
		CreatedAt: time.Now().UTC(),
	}
	s.threads = append([]types.ThreadItem{item}, s.threads...)
	return item
}

func defaultString(value string, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}
