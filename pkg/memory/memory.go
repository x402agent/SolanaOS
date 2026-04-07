// Package memory :: engine.go
// MemoryEngine — The epistemological core of MawdBot.
// Ported from MemoryEngine.ts.
//
// Three tiers:
//   KNOWN    — facts fetched from APIs. Expires. Ground truth while fresh.
//   LEARNED  — insights from trading and analysis. Persistent.
//   INFERRED — cross-domain synthesis. Agent-reasoned connections.
//
// Dual storage: Supabase (source of truth when available) + ClawVault (local markdown).
package memory

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/x402agent/Solana-Os-Go/pkg/logger"
)

// ── Known Fact TTLs ──────────────────────────────────────────────────

var knownFactTTLSeconds = map[string]int{
	"price":             60,
	"ohlcv":             300,
	"on_chain_stats":    120,
	"orderbook":         30,
	"news":              3600,
	"sentiment":         1800,
	"financial_metrics": 86400,
	"earnings":          604800,
	"funding_rate":      300,
}

// ── MemoryEngine ─────────────────────────────────────────────────────

type MemoryEngine struct {
	supabaseURL  string
	supabaseKey  string
	openaiKey    string
	vault        *ClawVault
	sessionID    string
	useSupabase  bool
	httpClient   *http.Client
}

type EngineOpts struct {
	SupabaseURL        string
	SupabaseServiceKey string
	OpenAIAPIKey       string
	VaultPath          string
	SessionID          string
	Embedder           Embedder // optional; enables semantic Recall
}

func NewMemoryEngine(opts EngineOpts) *MemoryEngine {
	vault := NewClawVault(opts.VaultPath)
	if opts.VaultPath == "" {
		vault = NewClawVault("./vault")
	}

	sessionID := opts.SessionID
	if sessionID == "" {
		sessionID = fmt.Sprintf("session-%d", time.Now().UnixMilli())
	}

	me := &MemoryEngine{
		supabaseURL:  opts.SupabaseURL,
		supabaseKey:  opts.SupabaseServiceKey,
		openaiKey:    opts.OpenAIAPIKey,
		vault:        vault,
		sessionID:    sessionID,
		useSupabase:  opts.SupabaseURL != "" && opts.SupabaseServiceKey != "",
		httpClient:   &http.Client{Timeout: 15 * time.Second},
	}
	if opts.Embedder != nil {
		vault.SetEmbedder(opts.Embedder)
	}
	return me
}

// SetEmbedder injects a semantic embedding client into the vault.
// Safe to call after construction; takes effect on the next Recall.
func (me *MemoryEngine) SetEmbedder(e Embedder) {
	me.vault.SetEmbedder(e)
}

func (me *MemoryEngine) Init() error {
	if err := me.vault.Init(); err != nil {
		return err
	}
	mode := "Vault-only"
	if me.useSupabase {
		mode = "Supabase+Vault"
	}
	logger.InfoCF("memory", fmt.Sprintf("MemoryEngine ready [%s]", mode), nil)
	return nil
}

// ── RememberInput ────────────────────────────────────────────────────

type RememberInput struct {
	MemoryType MemoryType     `json:"memory_type"`
	Source     string         `json:"source"`
	Topic      string        `json:"topic"`
	Asset      string         `json:"asset,omitempty"`
	AssetClass string         `json:"asset_class,omitempty"`
	Timeframe  string         `json:"timeframe,omitempty"`
	Content    string         `json:"content"`
	RawData    map[string]any `json:"raw_data,omitempty"`
	Confidence float64        `json:"confidence"`
	ExpiresAt  string         `json:"expires_at,omitempty"`
	TradeIDs   []string       `json:"trade_ids,omitempty"`
	Metadata   map[string]any `json:"metadata,omitempty"`
}

// ── Remember — store memory ──────────────────────────────────────────

func (me *MemoryEngine) Remember(mem RememberInput) (string, error) {
	// Compute expiry for known facts
	if mem.MemoryType == TypeKnown && mem.ExpiresAt == "" {
		snapshotType := "price"
		if st, ok := mem.Metadata["snapshot_type"].(string); ok {
			snapshotType = st
		}
		ttl := knownFactTTLSeconds[snapshotType]
		if ttl == 0 {
			ttl = 300
		}
		mem.ExpiresAt = time.Now().Add(time.Duration(ttl) * time.Second).Format(time.RFC3339)
	}

	// Mirror to ClawVault
	vaultCat := memTypeToVaultCategory(mem.MemoryType)
	score := mem.Confidence
	if score == 0 {
		if mem.MemoryType == TypeKnown {
			score = 0.9
		} else {
			score = 0.7
		}
	}

	tags := []string{}
	if mem.Asset != "" {
		tags = append(tags, mem.Asset)
	}
	tags = append(tags, string(mem.MemoryType), mem.Source)

	vaultEntry, err := me.vault.Remember(
		fmt.Sprintf("[%s] %s", mem.Source, mem.Content),
		RememberOpts{
			Category: vaultCat,
			Title:    mem.Topic,
			Tags:     tags,
			Score:    score,
			Metadata: mergeMaps(mem.Metadata, map[string]any{
				"asset":       mem.Asset,
				"asset_class": mem.AssetClass,
			}),
		},
	)
	if err != nil {
		return "", err
	}

	// Supabase path
	if me.useSupabase {
		id, sErr := me.supabaseInsertMemory(mem)
		if sErr != nil {
			logger.WarnCF("memory", "Supabase store failed, vault-only", map[string]any{"error": sErr.Error()})
			return vaultEntry.ID, nil
		}
		return id, nil
	}

	return vaultEntry.ID, nil
}

// ── Learn — record learned insight ───────────────────────────────────

func (me *MemoryEngine) Learn(topic, asset, insight string, evidence map[string]any, confidence float64) (string, error) {
	return me.Remember(RememberInput{
		MemoryType: TypeLearned,
		Source:     "trade_outcome",
		Topic:      topic,
		Asset:      asset,
		Content:    insight,
		RawData:    evidence,
		Confidence: confidence,
		Metadata:   map[string]any{"evidence_summary": truncateStr(fmt.Sprintf("%v", evidence), 500)},
	})
}

// ── Infer — record cross-domain inference ────────────────────────────

func (me *MemoryEngine) Infer(topic string, assets []string, connection string, confidence float64) (string, error) {
	return me.Remember(RememberInput{
		MemoryType: TypeInferred,
		Source:     "cross_asset_correlation",
		Topic:      topic,
		Asset:      strings.Join(assets, "/"),
		Content:    connection,
		Confidence: confidence,
		Metadata:   map[string]any{"assets": assets},
	})
}

// ── Recall — semantic search ─────────────────────────────────────────

type RecallInput struct {
	Query     string
	Limit     int
	Type      MemoryType
	Asset     string
	Threshold float64
}

type MemorySearchResult struct {
	ID         string     `json:"id"`
	MemoryType MemoryType `json:"memory_type"`
	Source     string     `json:"source"`
	Topic      string    `json:"topic"`
	Content    string     `json:"content"`
	Asset      string    `json:"asset"`
	Confidence float64   `json:"confidence"`
	Similarity float64   `json:"similarity"`
}

func (me *MemoryEngine) RecallMemories(opts RecallInput) []MemorySearchResult {
	// ClawVault search
	vCategory := VaultCategory("")
	if opts.Type == TypeLearned {
		vCategory = CatLessons
	} else if opts.Type == TypeInferred {
		vCategory = CatResearch
	}

	limit := opts.Limit
	if limit <= 0 {
		limit = 10
	}

	entries := me.vault.Recall(opts.Query, RecallOpts{Category: vCategory, Limit: limit})

	results := make([]MemorySearchResult, len(entries))
	for i, e := range entries {
		mt := TypeKnown
		if e.Category == CatLessons {
			mt = TypeLearned
		} else if e.Category == CatResearch {
			mt = TypeInferred
		} else if e.Category == CatTrades {
			mt = TypeLearned
		}

		asset := ""
		if len(e.Tags) > 0 {
			asset = e.Tags[0]
		}

		results[i] = MemorySearchResult{
			ID:         e.ID,
			MemoryType: mt,
			Source:     "vault",
			Topic:      e.Title,
			Content:    e.Content,
			Asset:      asset,
			Confidence: e.Score,
			Similarity: e.Score,
		}
	}
	return results
}

// ── WhatDoIKnow — full epistemological breakdown ─────────────────────

func (me *MemoryEngine) WhatDoIKnow(asset string) EpistemologicalState {
	known := me.RecallMemories(RecallInput{Query: asset + " price data market", Type: TypeKnown, Asset: asset, Limit: 20})
	learned := me.RecallMemories(RecallInput{Query: asset + " trading patterns insights", Type: TypeLearned, Asset: asset, Limit: 20})
	inferred := me.RecallMemories(RecallInput{Query: asset + " correlation synthesis", Type: TypeInferred, Limit: 10})

	// Convert to Memory for EpistemologicalState
	toMem := func(results []MemorySearchResult) []Memory {
		mems := make([]Memory, len(results))
		for i, r := range results {
			mems[i] = Memory{
				ID:         r.ID,
				Type:       r.MemoryType,
				Source:     r.Source,
				Topic:      r.Topic,
				Content:    r.Content,
				Asset:      r.Asset,
				Confidence: r.Confidence,
			}
		}
		return mems
	}

	knownMems := toMem(known)
	learnedMems := toMem(learned)
	inferredMems := toMem(inferred)

	// Identify gaps
	var gaps []string
	hasPrice := false
	hasOHLCV := false
	for _, m := range knownMems {
		if st, ok := m.Metadata["snapshot_type"].(string); ok {
			if st == "price" {
				hasPrice = true
			}
			if st == "ohlcv" {
				hasOHLCV = true
			}
		}
	}
	if !hasPrice {
		gaps = append(gaps, asset+": no current price data")
	}
	if !hasOHLCV {
		gaps = append(gaps, asset+": no OHLCV history")
	}

	avgConf := func(mems []Memory) float64 {
		if len(mems) == 0 {
			return 0
		}
		sum := 0.0
		for _, m := range mems {
			sum += m.Confidence
		}
		return sum / float64(len(mems))
	}

	all := append(append(knownMems, learnedMems...), inferredMems...)

	state := EpistemologicalState{
		Asset:    asset,
		Known:    knownMems,
		Learned:  learnedMems,
		Inferred: inferredMems,
		Gaps:     gaps,
	}
	state.Confidence.Overall = avgConf(all)
	state.Confidence.OnKnown = avgConf(knownMems)
	state.Confidence.OnLearned = avgConf(learnedMems)

	return state
}

// ── RecordTrade ──────────────────────────────────────────────────────

func (me *MemoryEngine) RecordTrade(trade TradeRecordInput) (string, error) {
	entry, err := me.vault.RecordTrade(trade)
	if err != nil {
		return "", err
	}
	return entry.ID, nil
}

// ── BuildContext (for agent injection) ───────────────────────────────

func (me *MemoryEngine) BuildContext(query string, asset string) string {
	recalled := me.RecallMemories(RecallInput{Query: query, Limit: 5, Asset: asset})
	vaultContext := me.vault.BuildContextProfile(query)

	var sb strings.Builder
	sb.WriteString(vaultContext)

	known := filterByType(recalled, TypeKnown)
	learned := filterByType(recalled, TypeLearned)
	inferred := filterByType(recalled, TypeInferred)

	if len(known) > 0 {
		sb.WriteString("\n\n## Known Facts (fresh API data)\n\n")
		for _, m := range known {
			sb.WriteString(fmt.Sprintf("- [%s] %s\n", m.Source, truncateStr(m.Content, 120)))
		}
	}

	if len(learned) > 0 {
		sb.WriteString("\n\n## Learned Insights (from trade outcomes)\n\n")
		for _, m := range learned {
			sb.WriteString(fmt.Sprintf("- [conf:%.2f] %s\n", m.Confidence, truncateStr(m.Content, 120)))
		}
	}

	if len(inferred) > 0 {
		sb.WriteString("\n\n## Inferred Connections (cross-domain)\n\n")
		for _, m := range inferred {
			sb.WriteString(fmt.Sprintf("- %s\n", truncateStr(m.Content, 120)))
		}
	}

	return sb.String()
}

// ── Vault reference ──────────────────────────────────────────────────

func (me *MemoryEngine) Vault() *ClawVault {
	return me.vault
}

// ── Supabase helpers ─────────────────────────────────────────────────

func (me *MemoryEngine) supabaseInsertMemory(mem RememberInput) (string, error) {
	row := map[string]any{
		"memory_type": mem.MemoryType,
		"source":      mem.Source,
		"topic":       mem.Topic,
		"asset":       mem.Asset,
		"asset_class": mem.AssetClass,
		"timeframe":   mem.Timeframe,
		"content":     mem.Content,
		"raw_data":    mem.RawData,
		"confidence":  mem.Confidence,
		"expires_at":  nilIfEmpty(mem.ExpiresAt),
		"session_id":  me.sessionID,
		"metadata":    mem.Metadata,
	}

	data, err := json.Marshal(row)
	if err != nil {
		return "", err
	}

	req, err := http.NewRequest("POST", me.supabaseURL+"/rest/v1/agent_memories", bytes.NewReader(data))
	if err != nil {
		return "", err
	}
	req.Header.Set("apikey", me.supabaseKey)
	req.Header.Set("Authorization", "Bearer "+me.supabaseKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "return=representation")

	resp, err := me.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode >= 400 {
		return "", fmt.Errorf("supabase %d: %s", resp.StatusCode, string(body[:minInt(200, len(body))]))
	}

	var result []map[string]any
	json.Unmarshal(body, &result)
	if len(result) > 0 {
		if id, ok := result[0]["id"].(string); ok {
			return id, nil
		}
	}

	return "", nil
}

// ── Helpers ──────────────────────────────────────────────────────────

func memTypeToVaultCategory(mt MemoryType) VaultCategory {
	switch mt {
	case TypeLearned:
		return CatLessons
	case TypeInferred:
		return CatResearch
	default:
		return CatInbox
	}
}

func filterByType(results []MemorySearchResult, t MemoryType) []MemorySearchResult {
	var filtered []MemorySearchResult
	for _, r := range results {
		if r.MemoryType == t {
			filtered = append(filtered, r)
		}
	}
	return filtered
}

func mergeMaps(a, b map[string]any) map[string]any {
	result := make(map[string]any)
	for k, v := range a {
		result[k] = v
	}
	for k, v := range b {
		result[k] = v
	}
	return result
}

func nilIfEmpty(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}
