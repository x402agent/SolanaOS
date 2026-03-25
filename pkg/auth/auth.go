// Package auth provides OAuth/token management for MawdBot.
// Adapted from PicoClaw — API key store, PKCE auth flow.
package auth

import (
	"encoding/json"
	"os"
	"sync"
	"time"
)

// Token represents a stored API credential.
type Token struct {
	Provider    string    `json:"provider"`
	AccessToken string    `json:"access_token"`
	ExpiresAt   time.Time `json:"expires_at,omitempty"`
	Scopes      []string  `json:"scopes,omitempty"`
}

func (t Token) IsExpired() bool {
	if t.ExpiresAt.IsZero() {
		return false
	}
	return time.Now().After(t.ExpiresAt)
}

// Store manages API tokens for MawdBot providers.
type Store struct {
	mu     sync.RWMutex
	tokens map[string]Token
	path   string
}

func NewStore(path string) *Store {
	s := &Store{
		tokens: make(map[string]Token),
		path:   path,
	}
	s.load()
	return s
}

func (s *Store) load() {
	data, err := os.ReadFile(s.path)
	if err != nil {
		return
	}
	json.Unmarshal(data, &s.tokens)
}

func (s *Store) save() error {
	data, err := json.MarshalIndent(s.tokens, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.path, data, 0600) // restrictive permissions
}

func (s *Store) Set(provider string, token Token) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	token.Provider = provider
	s.tokens[provider] = token
	return s.save()
}

func (s *Store) Get(provider string) (Token, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	t, ok := s.tokens[provider]
	return t, ok
}

func (s *Store) GetValid(provider string) (Token, bool) {
	t, ok := s.Get(provider)
	if !ok || t.IsExpired() {
		return Token{}, false
	}
	return t, true
}

func (s *Store) Delete(provider string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.tokens, provider)
	return s.save()
}

func (s *Store) List() []string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	providers := make([]string, 0, len(s.tokens))
	for k := range s.tokens {
		providers = append(providers, k)
	}
	return providers
}
