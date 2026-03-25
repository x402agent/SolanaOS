package services

import (
	"fmt"
	"sync"
	"time"

	"github.com/x402agent/Solana-Os-Go/pkg/controlapi/types"
)

type ExecutionService struct {
	mu      sync.RWMutex
	intents []types.StagedIntent
}

func NewExecutionService() *ExecutionService {
	return &ExecutionService{}
}

func (s *ExecutionService) Count() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.intents)
}

func (s *ExecutionService) List() []types.StagedIntent {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]types.StagedIntent, len(s.intents))
	copy(out, s.intents)
	return out
}

func (s *ExecutionService) Stage(kind string, summary string, payload map[string]any) types.StagedIntent {
	s.mu.Lock()
	defer s.mu.Unlock()
	intent := types.StagedIntent{
		ID:        fmt.Sprintf("%s-%d", kind, len(s.intents)+1),
		Kind:      kind,
		Status:    "staged",
		Summary:   summary,
		Payload:   payload,
		CreatedAt: time.Now().UTC(),
	}
	s.intents = append([]types.StagedIntent{intent}, s.intents...)
	return intent
}
