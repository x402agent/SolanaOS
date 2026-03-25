package session

import (
	"strings"
	"time"

	"github.com/x402agent/Solana-Os-Go/pkg/routing"
)

type SessionSummary struct {
	Key          string    `json:"key"`
	DisplayName  string    `json:"display_name,omitempty"`
	Label        string    `json:"label,omitempty"`
	Kind         string    `json:"kind,omitempty"`
	AgentID      string    `json:"agent_id,omitempty"`
	Model        string    `json:"model,omitempty"`
	Channel      string    `json:"channel,omitempty"`
	Provider     string    `json:"provider,omitempty"`
	CreatedAt    time.Time `json:"created_at,omitempty"`
	UpdatedAt    time.Time `json:"updated_at,omitempty"`
	MessageCount int       `json:"message_count,omitempty"`
	TokenCount   int       `json:"token_count,omitempty"`
	TotalCost    float64   `json:"total_cost,omitempty"`
	Status       string    `json:"status,omitempty"`
}

type SessionListEntry struct {
	SessionSummary
	IsGlobal bool `json:"is_global,omitempty"`
}

type SessionsListResult struct {
	Sessions []SessionListEntry `json:"sessions"`
	Count    int                `json:"count"`
}

func BuildAgentSessionKey(agentID, sessionKey string) string {
	agentID = strings.TrimSpace(agentID)
	sessionKey = strings.TrimSpace(sessionKey)
	if agentID == "" {
		return sessionKey
	}
	if sessionKey == "" {
		return routing.BuildAgentMainSessionKey(agentID)
	}
	return agentID + ":" + sessionKey
}

func (s *Store) Summaries() SessionsListResult {
	s.mu.RLock()
	defer s.mu.RUnlock()

	sessions := make([]SessionListEntry, 0, len(s.sessions))
	for key, history := range s.sessions {
		parts := routing.ParseSessionKey(key)
		entry := SessionListEntry{
			SessionSummary: SessionSummary{
				Key:          key,
				DisplayName:  routing.FormatSessionKey(key),
				Label:        parts.Label,
				Kind:         parts.Kind,
				AgentID:      parts.AgentID,
				MessageCount: len(history),
				Status:       "active",
			},
			IsGlobal: strings.TrimSpace(parts.Label) == routing.DefaultMainKey,
		}
		sessions = append(sessions, entry)
	}

	return SessionsListResult{
		Sessions: sessions,
		Count:    len(sessions),
	}
}
