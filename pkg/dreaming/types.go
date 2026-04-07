// Package dreaming implements background memory consolidation for SolanaOS agents.
package dreaming

import "time"

// DreamPhase names the three cooperative phases of a sweep.
type DreamPhase string

const (
	PhaseLight DreamPhase = "light"
	PhaseREM   DreamPhase = "rem"
	PhaseDeep  DreamPhase = "deep"
)

// Candidate is a vault entry staged during the light phase for potential deep promotion.
type Candidate struct {
	ID             string     `json:"id"`
	Category       string     `json:"category"`
	Title          string     `json:"title"`
	Content        string     `json:"content"`
	Tags           []string   `json:"tags"`
	Links          []string   `json:"links"`
	BaseScore      float64    `json:"base_score"`
	RecallCount    int        `json:"recall_count"`    // approximated from link count
	UniqueContexts int        `json:"unique_contexts"` // approximated from tag diversity
	TradeLinked    bool       `json:"trade_linked"`
	LastSeen       time.Time  `json:"last_seen"`
	FirstSeen      time.Time  `json:"first_seen"`
}

// PhaseSignal is a recency-decayed reinforcement boost from the light or REM phase.
type PhaseSignal struct {
	EntryID    string     `json:"entry_id"`
	Phase      DreamPhase `json:"phase"`
	Boost      float64    `json:"boost"`
	RecordedAt time.Time  `json:"recorded_at"`
}

// PhaseSignals is persisted to .clawvault/dreams/phase-signals.json.
type PhaseSignals struct {
	Signals []PhaseSignal `json:"signals"`
}

// SweepCheckpoint records the outcome of the most recent sweep.
type SweepCheckpoint struct {
	LastSweep  time.Time  `json:"last_sweep"`
	Phase      DreamPhase `json:"phase"`
	Promoted   int        `json:"promoted"`
	Reflected  int        `json:"reflected"`
	DiaryEntry string     `json:"diary_entry"`
}

// SweepResult is returned by RunSweep.
type SweepResult struct {
	LightStaged  int
	REMThemes    []string
	DeepPromoted int
	DiaryEntry   string
	ArtifactPath string
}
