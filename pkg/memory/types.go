// Package memory :: types.go
// Shared types for the MawdBot memory system.
package memory

import (
	"encoding/json"
	"time"
)

// ── Memory Types (Epistemological Tiers) ─────────────────────────────

type MemoryType string

const (
	TypeKnown    MemoryType = "known"
	TypeLearned  MemoryType = "learned"
	TypeInferred MemoryType = "inferred"
)

// ── Memory ───────────────────────────────────────────────────────────

type Memory struct {
	ID         string            `json:"id"`
	CreatedAt  time.Time         `json:"created_at"`
	Type       MemoryType        `json:"memory_type"`
	Source     string            `json:"source"`
	Topic      string            `json:"topic"`
	Asset      string            `json:"asset,omitempty"`
	AssetClass string            `json:"asset_class,omitempty"`
	Timeframe  string            `json:"timeframe,omitempty"`
	Content    string            `json:"content"`
	RawData    json.RawMessage   `json:"raw_data,omitempty"`
	Metadata   map[string]any    `json:"metadata,omitempty"`
	Confidence float64           `json:"confidence"`
	Reinforced int               `json:"reinforcement"`
	ExpiresAt  *time.Time        `json:"expires_at,omitempty"`
	Tags       []string          `json:"tags,omitempty"`
}

// ── Epistemological State ────────────────────────────────────────────

type EpistemologicalState struct {
	Asset      string   `json:"asset"`
	Known      []Memory `json:"known_facts"`
	Learned    []Memory `json:"learned_insights"`
	Inferred   []Memory `json:"inferred_connections"`
	Gaps       []string `json:"knowledge_gaps"`
	Confidence struct {
		Overall   float64 `json:"overall"`
		OnKnown   float64 `json:"on_known"`
		OnLearned float64 `json:"on_learned"`
	} `json:"confidence_summary"`
}
