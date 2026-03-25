// Package session manages chat session history for MawdBot.
// Adapted from PicoClaw — per-session message history with summarization trigger.
package session

import (
	"sync"

	"github.com/x402agent/Solana-Os-Go/pkg/providers"
)

// Store holds message history for multiple sessions.
type Store struct {
	mu       sync.RWMutex
	sessions map[string][]providers.Message
	maxHist  int
}

func NewStore(maxHistory int) *Store {
	if maxHistory <= 0 {
		maxHistory = 100
	}
	return &Store{
		sessions: make(map[string][]providers.Message),
		maxHist:  maxHistory,
	}
}

func (s *Store) GetHistory(key string) []providers.Message {
	s.mu.RLock()
	defer s.mu.RUnlock()
	h := s.sessions[key]
	result := make([]providers.Message, len(h))
	copy(result, h)
	return result
}

func (s *Store) AddMessage(key string, msg providers.Message) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.sessions[key] = append(s.sessions[key], msg)
	if len(s.sessions[key]) > s.maxHist {
		s.sessions[key] = s.sessions[key][len(s.sessions[key])-s.maxHist:]
	}
}

func (s *Store) SetHistory(key string, messages []providers.Message) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.sessions[key] = messages
}

func (s *Store) Clear(key string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.sessions, key)
}

func (s *Store) Count(key string) int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.sessions[key])
}

func (s *Store) ShouldSummarize(key string, threshold int) bool {
	return s.Count(key) >= threshold
}

// Close releases all session data.
func (s *Store) Close() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.sessions = make(map[string][]providers.Message)
}
