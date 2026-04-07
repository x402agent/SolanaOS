// Package dreaming implements background memory consolidation for SolanaOS agents.
//
// It runs in three cooperative phases during low-activity windows (default 3 AM):
//
//	Light  → score and stage recent vault signals as candidates
//	REM    → extract trading themes and add reinforcement boosts
//	Deep   → rank candidates, promote durable insights to vault/lessons
//
// Human-readable output is appended to vault/.dreams/DREAMS.md after each sweep.
// Machine state lives in .clawvault/dreams/ (phase signals, candidates, checkpoint).
package dreaming

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/x402agent/Solana-Os-Go/pkg/logger"
	"github.com/x402agent/Solana-Os-Go/pkg/memory"
)

const (
	defaultMinScore       = 0.55
	defaultMinRecallCount = 1
	maxCandidates         = 150
	lightWindowHours      = 48 // look back 48h for recent signals
	signalDecayHalfLife   = 12 // phase signal half-life in hours
)

// Config configures the Dreamer.
type Config struct {
	// MinScore is the minimum weighted score for deep promotion (default 0.55).
	MinScore float64
	// MinRecallCount is the minimum estimated recall count for promotion (default 1).
	MinRecallCount int
	// DiaryFunc, if set, is called to generate a narrative diary entry via LLM.
	// The prompt contains the sweep summary. Returns markdown text.
	DiaryFunc func(ctx context.Context, prompt string) (string, error)
}

// Dreamer runs background memory consolidation sweeps over a ClawVault.
type Dreamer struct {
	vault      *memory.ClawVault
	dreamsDir  string // .clawvault/dreams/
	diaryPath  string // vault/.dreams/DREAMS.md
	cfg        Config
}

// New creates a Dreamer backed by the vault at vaultPath.
func New(vaultPath string, cfg Config) (*Dreamer, error) {
	if cfg.MinScore <= 0 {
		cfg.MinScore = defaultMinScore
	}
	if cfg.MinRecallCount <= 0 {
		cfg.MinRecallCount = defaultMinRecallCount
	}

	vault := memory.NewClawVault(vaultPath)
	if err := vault.Init(); err != nil {
		return nil, fmt.Errorf("dreaming: vault init: %w", err)
	}

	abs, _ := filepath.Abs(vaultPath)
	dreamsDir := filepath.Join(filepath.Dir(abs), ".clawvault", "dreams")
	if err := os.MkdirAll(dreamsDir, 0o755); err != nil {
		return nil, fmt.Errorf("dreaming: mkdir dreams state: %w", err)
	}

	diaryDir := filepath.Join(abs, ".dreams")
	if err := os.MkdirAll(diaryDir, 0o755); err != nil {
		return nil, fmt.Errorf("dreaming: mkdir diary: %w", err)
	}

	return &Dreamer{
		vault:     vault,
		dreamsDir: dreamsDir,
		diaryPath: filepath.Join(diaryDir, "DREAMS.md"),
		cfg:       cfg,
	}, nil
}

// RunSweep executes a full light → REM → deep sweep and returns the result.
func (dr *Dreamer) RunSweep(ctx context.Context) (*SweepResult, error) {
	logger.InfoCF("dreaming", "Sweep started", nil)
	result := &SweepResult{}

	// ── Phase 1: Light ────────────────────────────────────────────────
	candidates, err := dr.lightPhase()
	if err != nil {
		return nil, fmt.Errorf("light phase: %w", err)
	}
	result.LightStaged = len(candidates)
	logger.InfoCF("dreaming", "Light phase complete", map[string]any{"staged": len(candidates)})

	if len(candidates) == 0 {
		result.DiaryEntry = dr.writeDiaryEntry(ctx, result)
		dr.saveCheckpoint(result)
		return result, nil
	}

	// ── Phase 2: REM ──────────────────────────────────────────────────
	themes := dr.remPhase(candidates)
	result.REMThemes = themes
	logger.InfoCF("dreaming", "REM phase complete", map[string]any{"themes": len(themes)})

	// ── Phase 3: Deep ─────────────────────────────────────────────────
	promoted, err := dr.deepPhase(candidates, themes)
	if err != nil {
		return nil, fmt.Errorf("deep phase: %w", err)
	}
	result.DeepPromoted = promoted
	logger.InfoCF("dreaming", "Deep phase complete", map[string]any{"promoted": promoted})

	// ── Dream Diary ───────────────────────────────────────────────────
	result.DiaryEntry = dr.writeDiaryEntry(ctx, result)
	dr.saveCheckpoint(result)

	logger.InfoCF("dreaming", "Sweep complete", map[string]any{
		"staged":   result.LightStaged,
		"promoted": result.DeepPromoted,
		"themes":   len(result.REMThemes),
	})
	return result, nil
}

// LastSweep returns the checkpoint from the most recent sweep, or nil if none.
func (dr *Dreamer) LastSweep() *SweepCheckpoint {
	data, err := os.ReadFile(filepath.Join(dr.dreamsDir, "last-sweep.json"))
	if err != nil {
		return nil
	}
	var cp SweepCheckpoint
	if err := json.Unmarshal(data, &cp); err != nil {
		return nil
	}
	return &cp
}

// ── Light Phase ───────────────────────────────────────────────────────────────

// lightPhase ingests recent vault signals, deduplicates, scores, and stages candidates.
// It does NOT write to lessons (MEMORY equivalent) — that is deep's job.
func (dr *Dreamer) lightPhase() ([]Candidate, error) {
	since := time.Now().UTC().Add(-lightWindowHours * time.Hour)
	recent := dr.vault.ListEntries("", since)

	// Also grab the short-term buffer from vault (in-memory is empty for a new instance,
	// but persisted entries with recent timestamps are what we need for file-backed vault).
	// Merge and deduplicate by ID.
	seen := make(map[string]bool)
	var raw []memory.VaultEntry
	for _, e := range recent {
		if !seen[e.ID] {
			seen[e.ID] = true
			raw = append(raw, e)
		}
	}

	// Build phase signals map for boost lookup.
	signals := dr.loadPhaseSignals()
	boostMap := buildBoostMap(signals, PhaseLight)

	var candidates []Candidate
	for _, e := range raw {
		if string(e.Category) == "lessons" {
			// Already long-term memory — skip.
			continue
		}
		c := entryToCandidate(e)
		if b, ok := boostMap[e.ID]; ok {
			c.BaseScore = math.Min(c.BaseScore+b, 1.0)
		}
		candidates = append(candidates, c)
	}

	// Sort by BaseScore descending and cap.
	sort.Slice(candidates, func(i, j int) bool {
		return candidates[i].BaseScore > candidates[j].BaseScore
	})
	if len(candidates) > maxCandidates {
		candidates = candidates[:maxCandidates]
	}

	// Record light reinforcement signals for the top half.
	mid := len(candidates) / 2
	if mid > 0 {
		var newSignals []PhaseSignal
		for _, c := range candidates[:mid] {
			newSignals = append(newSignals, PhaseSignal{
				EntryID:    c.ID,
				Phase:      PhaseLight,
				Boost:      0.05,
				RecordedAt: time.Now().UTC(),
			})
		}
		dr.appendPhaseSignals(newSignals)
	}

	dr.saveCandidates(candidates)
	return candidates, nil
}

// ── REM Phase ─────────────────────────────────────────────────────────────────

// remPhase extracts trading themes and recurring signals from candidates.
// It adds REM reinforcement boosts to thematic entries but never writes to lessons.
func (dr *Dreamer) remPhase(candidates []Candidate) []string {
	// Count keyword frequency across all candidate content + titles.
	freq := make(map[string]int)
	tradeKeywords := []string{
		"sol", "pump", "token", "perp", "long", "short", "entry", "exit",
		"pnl", "profit", "loss", "pattern", "insight", "liquidity", "fee",
		"rug", "launch", "bonding", "jupiter", "hyperliquid", "aster",
		"funding", "leverage", "stop", "take", "ooda", "strategy", "rsi",
		"ema", "atr", "resistance", "support", "breakout", "degen",
	}
	for _, c := range candidates {
		lower := strings.ToLower(c.Title + " " + c.Content)
		for _, kw := range tradeKeywords {
			if strings.Contains(lower, kw) {
				freq[kw]++
			}
		}
	}

	// Extract top themes (keywords appearing in > 10% of candidates).
	threshold := len(candidates) / 10
	if threshold < 1 {
		threshold = 1
	}
	var themes []string
	for kw, count := range freq {
		if count >= threshold {
			themes = append(themes, kw)
		}
	}
	sort.Slice(themes, func(i, j int) bool {
		return freq[themes[i]] > freq[themes[j]]
	})
	if len(themes) > 10 {
		themes = themes[:10]
	}

	// Apply REM boost to entries that match themes.
	themeSet := make(map[string]bool)
	for _, t := range themes {
		themeSet[t] = true
	}
	var remSignals []PhaseSignal
	for _, c := range candidates {
		lower := strings.ToLower(c.Title + " " + c.Content)
		matched := 0
		for t := range themeSet {
			if strings.Contains(lower, t) {
				matched++
			}
		}
		if matched >= 2 {
			remSignals = append(remSignals, PhaseSignal{
				EntryID:    c.ID,
				Phase:      PhaseREM,
				Boost:      float64(matched) * 0.02,
				RecordedAt: time.Now().UTC(),
			})
		}
	}
	dr.appendPhaseSignals(remSignals)

	return themes
}

// ── Deep Phase ────────────────────────────────────────────────────────────────

// Deep ranking weights.
const (
	wRelevance    = 0.30
	wFrequency    = 0.24
	wTradeSignal  = 0.15
	wRecency      = 0.15
	wDiversity    = 0.10
	wTagRichness  = 0.06
)

// deepPhase ranks candidates using weighted signals and promotes qualifying entries
// to vault/lessons (the durable long-term memory layer).
func (dr *Dreamer) deepPhase(candidates []Candidate, themes []string) (int, error) {
	signals := dr.loadPhaseSignals()
	boostMap := buildBoostMap(signals, "") // all phases

	promoted := 0
	now := time.Now().UTC()

	for _, c := range candidates {
		score := dr.deepScore(c, boostMap, now)
		if score < dr.cfg.MinScore || c.RecallCount < dr.cfg.MinRecallCount {
			continue
		}

		// Rehydrate content from vault to avoid stale data.
		live := dr.vault.ListEntries(memory.VaultCategory(c.Category), time.Time{})
		var liveContent string
		for _, e := range live {
			if e.ID == c.ID {
				liveContent = e.Content
				break
			}
		}
		if liveContent == "" {
			continue // entry was deleted since light phase — skip
		}

		// Promote: write a lessons entry tagged [dream-promoted].
		tags := append([]string{"dream-promoted"}, c.Tags...)
		tags = append(tags, fmt.Sprintf("dream-score:%.2f", score))
		if len(themes) > 0 {
			tags = append(tags, fmt.Sprintf("themes:%s", strings.Join(themes[:min(3, len(themes))], ",")))
		}

		_, err := dr.vault.Remember(liveContent, memory.RememberOpts{
			Category: memory.CatLessons,
			Title:    fmt.Sprintf("[DREAM] %s", c.Title),
			Tags:     tags,
			Score:    score,
		})
		if err != nil {
			logger.WarnCF("dreaming", "Failed to promote candidate", map[string]any{
				"id":    c.ID,
				"error": err.Error(),
			})
			continue
		}
		promoted++
	}

	// Clear phase signals after deep phase to keep the file lean.
	dr.clearPhaseSignals()

	return promoted, nil
}

// deepScore computes the weighted deep-ranking score for a candidate.
func (dr *Dreamer) deepScore(c Candidate, boostMap map[string]float64, now time.Time) float64 {
	// Relevance: vault's own quality score.
	sRelevance := c.BaseScore

	// Frequency: recall count normalised to [0,1] over an expected max of 10.
	sFrequency := math.Min(float64(c.RecallCount)/10.0, 1.0)

	// Trade signal: binary — directly tied to trading activity.
	sTradeSignal := 0.0
	if c.TradeLinked {
		sTradeSignal = 1.0
	}

	// Recency: exponential decay, half-life = 24h.
	hoursOld := now.Sub(c.LastSeen).Hours()
	sRecency := math.Exp(-0.693 / 24.0 * hoursOld)

	// Diversity: unique contexts normalised over expected max of 5.
	sDiversity := math.Min(float64(c.UniqueContexts)/5.0, 1.0)

	// Tag richness: tag count normalised over expected max of 8.
	sTagRichness := math.Min(float64(len(c.Tags))/8.0, 1.0)

	base := wRelevance*sRelevance +
		wFrequency*sFrequency +
		wTradeSignal*sTradeSignal +
		wRecency*sRecency +
		wDiversity*sDiversity +
		wTagRichness*sTagRichness

	// Phase signal boost (recency-decayed).
	if boost, ok := boostMap[c.ID]; ok {
		base = math.Min(base+boost, 1.0)
	}

	return base
}

// ── Dream Diary ───────────────────────────────────────────────────────────────

// writeDiaryEntry generates and appends a narrative entry to DREAMS.md.
func (dr *Dreamer) writeDiaryEntry(ctx context.Context, result *SweepResult) string {
	date := time.Now().UTC().Format("2006-01-02 15:04 UTC")

	var entry string
	if dr.cfg.DiaryFunc != nil && (result.LightStaged > 0 || result.DeepPromoted > 0) {
		prompt := dr.buildDiaryPrompt(result)
		if text, err := dr.cfg.DiaryFunc(ctx, prompt); err == nil && strings.TrimSpace(text) != "" {
			entry = strings.TrimSpace(text)
		}
	}
	if entry == "" {
		entry = dr.defaultDiaryEntry(result)
	}

	block := fmt.Sprintf("\n## %s\n\n%s\n", date, entry)
	f, err := os.OpenFile(dr.diaryPath, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err == nil {
		_, _ = f.WriteString(block)
		f.Close()
	}

	return entry
}

func (dr *Dreamer) buildDiaryPrompt(result *SweepResult) string {
	themes := "none"
	if len(result.REMThemes) > 0 {
		themes = strings.Join(result.REMThemes, ", ")
	}
	return fmt.Sprintf(
		"You are the SolanaOS dream journal. Write a short (2-4 sentence) reflective diary entry "+
			"summarising tonight's memory consolidation sweep for our Solana trading and dev agents. "+
			"Be insightful and forward-looking. Tone: calm, thoughtful, slightly poetic.\n\n"+
			"Sweep data:\n- Signals staged (light phase): %d\n- Recurring themes (REM): %s\n"+
			"- Insights promoted to long-term memory (deep): %d\n\n"+
			"Write only the diary entry text, no headers.",
		result.LightStaged,
		themes,
		result.DeepPromoted,
	)
}

func (dr *Dreamer) defaultDiaryEntry(result *SweepResult) string {
	if result.LightStaged == 0 {
		return "The agents rested quietly tonight. No new signals to consolidate."
	}
	themes := "none"
	if len(result.REMThemes) > 0 {
		themes = strings.Join(result.REMThemes[:min(5, len(result.REMThemes))], ", ")
	}
	return fmt.Sprintf(
		"Scanned %d recent signals. Recurring themes: %s. "+
			"Promoted %d insights to long-term memory.",
		result.LightStaged, themes, result.DeepPromoted,
	)
}

// ── State I/O ─────────────────────────────────────────────────────────────────

func (dr *Dreamer) loadPhaseSignals() PhaseSignals {
	data, err := os.ReadFile(filepath.Join(dr.dreamsDir, "phase-signals.json"))
	if err != nil {
		return PhaseSignals{}
	}
	var ps PhaseSignals
	_ = json.Unmarshal(data, &ps)
	return ps
}

func (dr *Dreamer) appendPhaseSignals(newSignals []PhaseSignal) {
	if len(newSignals) == 0 {
		return
	}
	ps := dr.loadPhaseSignals()
	ps.Signals = append(ps.Signals, newSignals...)
	dr.savePhaseSignals(ps)
}

func (dr *Dreamer) savePhaseSignals(ps PhaseSignals) {
	data, err := json.MarshalIndent(ps, "", "  ")
	if err != nil {
		return
	}
	_ = os.WriteFile(filepath.Join(dr.dreamsDir, "phase-signals.json"), data, 0o644)
}

func (dr *Dreamer) clearPhaseSignals() {
	_ = os.WriteFile(filepath.Join(dr.dreamsDir, "phase-signals.json"), []byte(`{"signals":[]}`), 0o644)
}

func (dr *Dreamer) saveCandidates(candidates []Candidate) {
	data, err := json.MarshalIndent(candidates, "", "  ")
	if err != nil {
		return
	}
	_ = os.WriteFile(filepath.Join(dr.dreamsDir, "candidates.json"), data, 0o644)
}

func (dr *Dreamer) saveCheckpoint(result *SweepResult) {
	cp := SweepCheckpoint{
		LastSweep:  time.Now().UTC(),
		Phase:      PhaseDeep,
		Promoted:   result.DeepPromoted,
		Reflected:  result.LightStaged,
		DiaryEntry: result.DiaryEntry,
	}
	data, err := json.MarshalIndent(cp, "", "  ")
	if err != nil {
		return
	}
	_ = os.WriteFile(filepath.Join(dr.dreamsDir, "last-sweep.json"), data, 0o644)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// entryToCandidate converts a VaultEntry to a Candidate with heuristic signal fields.
func entryToCandidate(e memory.VaultEntry) Candidate {
	now := time.Now().UTC()

	lastSeen := now
	if t, err := time.Parse(time.RFC3339, e.UpdatedAt); err == nil {
		lastSeen = t
	}
	firstSeen := lastSeen
	if t, err := time.Parse(time.RFC3339, e.CreatedAt); err == nil {
		firstSeen = t
	}

	// RecallCount: links to this entry from others, +1 for self.
	recallCount := len(e.Links) + 1

	// UniqueContexts: distinct tag namespaces (simplified as unique tag count / 2 + 1).
	uniqueContexts := len(e.Tags)/2 + 1

	// TradeLinked: category is trades or title/tags mention trading keywords.
	tradeLinked := string(e.Category) == "trades"
	if !tradeLinked {
		lower := strings.ToLower(e.Title + " " + strings.Join(e.Tags, " "))
		for _, kw := range []string{"pnl", "trade", "profit", "loss", "entry", "exit", "perp", "swap"} {
			if strings.Contains(lower, kw) {
				tradeLinked = true
				break
			}
		}
	}

	return Candidate{
		ID:             e.ID,
		Category:       string(e.Category),
		Title:          e.Title,
		Content:        e.Content,
		Tags:           e.Tags,
		Links:          e.Links,
		BaseScore:      e.Score,
		RecallCount:    recallCount,
		UniqueContexts: uniqueContexts,
		TradeLinked:    tradeLinked,
		LastSeen:       lastSeen,
		FirstSeen:      firstSeen,
	}
}

// buildBoostMap aggregates recency-decayed phase boosts per entry ID.
// Pass empty string for phase to aggregate all phases.
func buildBoostMap(ps PhaseSignals, phase DreamPhase) map[string]float64 {
	m := make(map[string]float64)
	now := time.Now().UTC()
	for _, s := range ps.Signals {
		if phase != "" && s.Phase != phase {
			continue
		}
		hoursOld := now.Sub(s.RecordedAt).Hours()
		decayed := s.Boost * math.Exp(-0.693/float64(signalDecayHalfLife)*hoursOld)
		m[s.EntryID] += decayed
	}
	return m
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
