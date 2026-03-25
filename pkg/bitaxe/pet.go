// Package bitaxe — TamaGOchi virtual pet that evolves based on mining performance.
// Ported from the Bitaxe companion package for inline use in the SolanaOS daemon.
package bitaxe

import (
	"encoding/json"
	"fmt"
	"os"
	"sync"
	"time"
)

// ───────────────────── Evolution Stages ──────────────────────

type PetStage string

const (
	StageEgg      PetStage = "egg"
	StageLarva    PetStage = "larva"
	StageJuvenile PetStage = "juvenile"
	StageAdult    PetStage = "adult"
	StageAlpha    PetStage = "alpha"
	StageGhost    PetStage = "ghost"
)

func (s PetStage) Emoji() string {
	switch s {
	case StageEgg:
		return "🥚"
	case StageLarva:
		return "🦐"
	case StageJuvenile:
		return "🦞"
	case StageAdult:
		return "🦞"
	case StageAlpha:
		return "👑"
	case StageGhost:
		return "💀"
	default:
		return "❓"
	}
}

// ───────────────────── Mood System ──────────────────────────

type PetMood string

const (
	MoodEcstatic PetMood = "ecstatic"
	MoodHappy    PetMood = "happy"
	MoodNeutral  PetMood = "neutral"
	MoodAnxious  PetMood = "anxious"
	MoodSad      PetMood = "sad"
	MoodHot      PetMood = "hot"
)

// PetState is the full serializable pet state.
type PetState struct {
	Name           string    `json:"name"`
	Stage          PetStage  `json:"stage"`
	Mood           PetMood   `json:"mood"`
	MoodScore      float64   `json:"moodScore"`
	TotalShares    int       `json:"totalShares"`
	TotalRejected  int       `json:"totalRejected"`
	AcceptRate     float64   `json:"acceptRate"`
	AvgHashRate    float64   `json:"avgHashRate"`
	AvgTemp        float64   `json:"avgTemp"`
	TotalUptimeSec int       `json:"totalUptimeSec"`
	BornAt         time.Time `json:"bornAt"`
	LastFed        time.Time `json:"lastFed"`
	EvolvedAt      time.Time `json:"evolvedAt"`
	FeedCount      int64     `json:"feedCount"`
}

// Pet is the TamaGOchi virtual pet tied to a miner.
type Pet struct {
	state PetState
	mu    sync.RWMutex
}

// NewPet creates a new pet in egg stage.
func NewPet(name string) *Pet {
	return &Pet{
		state: PetState{
			Name:      name,
			Stage:     StageEgg,
			Mood:      MoodNeutral,
			MoodScore: 0,
			BornAt:    time.Now(),
		},
	}
}

// Feed processes a mining stats snapshot and updates pet state.
func (p *Pet) Feed(s *Stats) {
	if s == nil || !s.Online {
		return
	}

	p.mu.Lock()
	defer p.mu.Unlock()

	p.state.FeedCount++
	p.state.LastFed = time.Now()
	p.state.TotalShares = s.SharesAccepted
	p.state.TotalRejected = s.SharesRejected
	p.state.TotalUptimeSec = s.UptimeSeconds

	// Running averages
	n := float64(p.state.FeedCount)
	p.state.AvgHashRate = (p.state.AvgHashRate*(n-1) + s.HashRate) / n
	p.state.AvgTemp = (p.state.AvgTemp*(n-1) + s.Temp) / n

	// Accept rate
	total := p.state.TotalShares + p.state.TotalRejected
	if total > 0 {
		p.state.AcceptRate = float64(p.state.TotalShares) / float64(total)
	}

	p.updateMood(s)
	p.checkEvolution()
}

func (p *Pet) updateMood(s *Stats) {
	score := p.state.MoodScore

	if s.HashRate > 0 {
		score += 0.05
	} else {
		score -= 0.2
	}

	switch {
	case s.Temp > 75:
		score -= 0.3
	case s.Temp > 65:
		score -= 0.1
	case s.Temp < 55:
		score += 0.05
	}

	total := s.SharesAccepted + s.SharesRejected
	if total > 0 {
		ratio := float64(s.SharesRejected) / float64(total)
		if ratio > 0.1 {
			score -= 0.15
		} else if ratio < 0.02 {
			score += 0.05
		}
	}

	if score > 1.0 {
		score = 1.0
	}
	if score < -1.0 {
		score = -1.0
	}
	p.state.MoodScore = score

	switch {
	case score > 0.7:
		p.state.Mood = MoodEcstatic
	case score > 0.3:
		p.state.Mood = MoodHappy
	case score > -0.1:
		p.state.Mood = MoodNeutral
	case score > -0.4:
		p.state.Mood = MoodAnxious
	case s.Temp > 70:
		p.state.Mood = MoodHot
	default:
		p.state.Mood = MoodSad
	}
}

func (p *Pet) checkEvolution() {
	prev := p.state.Stage

	switch {
	case time.Since(p.state.LastFed) > 24*time.Hour:
		p.state.Stage = StageGhost
	case p.state.TotalShares >= 200 && p.state.AcceptRate > 0.95:
		p.state.Stage = StageAlpha
	case p.state.TotalShares >= 50 && p.state.AcceptRate > 0.90:
		p.state.Stage = StageAdult
	case p.state.TotalShares >= 10:
		p.state.Stage = StageJuvenile
	case p.state.TotalShares > 0:
		p.state.Stage = StageLarva
	default:
		p.state.Stage = StageEgg
	}

	if p.state.Stage != prev {
		p.state.EvolvedAt = time.Now()
	}
}

// GetState returns a copy of the pet state.
func (p *Pet) GetState() PetState {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.state
}

// Save persists pet state to disk.
func (p *Pet) Save(path string) error {
	p.mu.RLock()
	defer p.mu.RUnlock()
	data, err := json.MarshalIndent(p.state, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0600)
}

// Load restores pet state from disk.
func (p *Pet) Load(path string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	return json.Unmarshal(data, &p.state)
}

// FormatStatus returns a Telegram-friendly status string.
func (p *Pet) FormatStatus() string {
	p.mu.RLock()
	defer p.mu.RUnlock()
	s := p.state

	moodBar := ""
	pct := int(((s.MoodScore + 1) / 2) * 10)
	for i := 0; i < 10; i++ {
		if i < pct {
			moodBar += "█"
		} else {
			moodBar += "░"
		}
	}

	age := time.Since(s.BornAt)
	ageStr := fmt.Sprintf("%dd %dh", int(age.Hours())/24, int(age.Hours())%24)

	return fmt.Sprintf(
		"%s **%s** — %s %s\n\n"+
			"Stage:   `%s`\n"+
			"Mood:    `%s` [%s] (%.2f)\n"+
			"Shares:  `%d` accepted · `%d` rejected (%.1f%%)\n"+
			"Avg HR:  `%.1f GH/s`\n"+
			"Avg Temp:`%.1f°C`\n"+
			"Age:     `%s`\n"+
			"Feeds:   `%d`",
		s.Stage.Emoji(), s.Name, string(s.Stage), string(s.Mood),
		string(s.Stage),
		string(s.Mood), moodBar, s.MoodScore,
		s.TotalShares, s.TotalRejected, s.AcceptRate*100,
		s.AvgHashRate,
		s.AvgTemp,
		ageStr,
		s.FeedCount,
	)
}
