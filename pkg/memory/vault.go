// Package memory :: vault.go
// ClawVault — Persistent Markdown Memory System for MawdBot.
// Ported from ClawVault TypeScript.
//
// Architecture: Session → Observe → Score → Route → Store → Reflect → Promote
//
// Vault structure:
//   vault/decisions/   — trade decisions with rationale
//   vault/lessons/     — learned patterns and insights
//   vault/trades/      — trade outcomes and P&L
//   vault/research/    — auto-research experiment logs
//   vault/tasks/       — pending agent tasks
//   vault/backlog/     — deferred items
//   vault/inbox/       — raw incoming observations
//
// Internal state (.clawvault/):
//   graph-index.json   — cross-document link graph
//   last-checkpoint.json — wake/sleep state
//   config.json        — vault configuration
package memory

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// ── Vault Categories ─────────────────────────────────────────────────

type VaultCategory string

const (
	CatDecisions VaultCategory = "decisions"
	CatLessons   VaultCategory = "lessons"
	CatTrades    VaultCategory = "trades"
	CatResearch  VaultCategory = "research"
	CatTasks     VaultCategory = "tasks"
	CatBacklog   VaultCategory = "backlog"
	CatInbox     VaultCategory = "inbox"
)

var allCategories = []VaultCategory{
	CatDecisions, CatLessons, CatTrades, CatResearch, CatTasks, CatBacklog, CatInbox,
}

// ── Auto-routing keyword map ─────────────────────────────────────────

var categoryKeywords = map[VaultCategory][]string{
	CatDecisions: {"decided", "chose", "selected", "bought", "sold", "entered", "exited"},
	CatLessons:   {"learned", "realized", "insight", "pattern", "mistake", "always", "never"},
	CatTrades:    {"pnl", "profit", "loss", "position", "entry", "exit", "size", "fee"},
	CatResearch:  {"hypothesis", "experiment", "result", "metric", "strategy", "backtest"},
	CatTasks:     {"todo", "need to", "should", "must", "action", "implement", "fix"},
	CatBacklog:   {"later", "eventually", "someday", "consider", "idea"},
	CatInbox:     {},
}

// ── VaultEntry ───────────────────────────────────────────────────────

type VaultEntry struct {
	ID        string        `json:"id"`
	Category  VaultCategory `json:"category"`
	Title     string        `json:"title"`
	Content   string        `json:"content"`
	Tags      []string      `json:"tags"`
	Links     []string      `json:"links"`
	Score     float64       `json:"score"`
	CreatedAt string        `json:"created_at"`
	UpdatedAt string        `json:"updated_at"`
	Metadata  map[string]any `json:"metadata,omitempty"`
}

// ── GraphNode / GraphIndex ───────────────────────────────────────────

type GraphNode struct {
	ID       string        `json:"id"`
	Category VaultCategory `json:"category"`
	Title    string        `json:"title"`
	Tags     []string      `json:"tags"`
	Score    float64       `json:"score"`
	Links    []string      `json:"links"`
	Path     string        `json:"path"`
}

type GraphEdge struct {
	From   string  `json:"from"`
	To     string  `json:"to"`
	Weight float64 `json:"weight"`
}

type GraphIndex struct {
	Nodes       map[string]*GraphNode `json:"nodes"`
	Edges       []GraphEdge           `json:"edges"`
	LastUpdated string                `json:"last_updated"`
}

// ── Checkpoint ───────────────────────────────────────────────────────

type Checkpoint struct {
	SessionID       string         `json:"session_id"`
	AgentState      map[string]any `json:"agent_state"`
	ActivePositions []any          `json:"active_positions"`
	PendingResearch []string       `json:"pending_research"`
	LastObservation string         `json:"last_observation"`
	Memory          struct {
		ShortTerm   []string `json:"short_term"`
		PromotedIDs []string `json:"promoted_ids"`
	} `json:"memory"`
	CreatedAt string `json:"created_at"`
}

// ── ClawVault ────────────────────────────────────────────────────────

type ClawVault struct {
	mu              sync.RWMutex
	vaultPath       string
	clawvaultPath   string
	graphIndex      GraphIndex
	shortTermBuffer []VaultEntry
	shortTermMax    int
}

func NewClawVault(vaultPath string) *ClawVault {
	abs, _ := filepath.Abs(vaultPath)
	return &ClawVault{
		vaultPath:     abs,
		clawvaultPath: filepath.Join(filepath.Dir(abs), ".clawvault"),
		graphIndex: GraphIndex{
			Nodes:       make(map[string]*GraphNode),
			LastUpdated: time.Now().Format(time.RFC3339),
		},
		shortTermMax: 50,
	}
}

func (v *ClawVault) Init() error {
	for _, cat := range allCategories {
		dir := filepath.Join(v.vaultPath, string(cat))
		if err := os.MkdirAll(dir, 0755); err != nil {
			return err
		}
	}
	os.MkdirAll(v.clawvaultPath, 0755)

	// Load or create graph index
	graphPath := filepath.Join(v.clawvaultPath, "graph-index.json")
	data, err := os.ReadFile(graphPath)
	if err == nil {
		json.Unmarshal(data, &v.graphIndex)
		if v.graphIndex.Nodes == nil {
			v.graphIndex.Nodes = make(map[string]*GraphNode)
		}
	} else {
		v.saveGraphIndex()
	}

	return nil
}

// ── Remember — store knowledge in vault ──────────────────────────────

type RememberOpts struct {
	Category VaultCategory
	Title    string
	Tags     []string
	Metadata map[string]any
	Score    float64
}

func (v *ClawVault) Remember(content string, opts RememberOpts) (*VaultEntry, error) {
	v.mu.Lock()
	defer v.mu.Unlock()

	category := opts.Category
	if category == "" {
		category = v.autoRoute(content)
	}

	id := v.generateID(category)
	now := time.Now().Format(time.RFC3339)

	entry := &VaultEntry{
		ID:        id,
		Category:  category,
		Title:     opts.Title,
		Content:   content,
		Tags:      opts.Tags,
		Links:     []string{},
		Score:     opts.Score,
		CreatedAt: now,
		UpdatedAt: now,
		Metadata:  opts.Metadata,
	}

	if entry.Title == "" {
		entry.Title = v.extractTitle(content)
	}
	if len(entry.Tags) == 0 {
		entry.Tags = v.extractTags(content)
	}
	if entry.Score == 0 {
		entry.Score = v.scoreContent(content)
	}

	// Write markdown file
	filePath := v.entryPath(entry)
	md := fmt.Sprintf("---\nid: %s\ncategory: %s\ntitle: %s\nscore: %.2f\ncreated_at: %s\ntags: [%s]\n---\n\n%s\n",
		id, category, entry.Title, entry.Score, now,
		strings.Join(entry.Tags, ", "), content)

	if err := os.WriteFile(filePath, []byte(md), 0644); err != nil {
		return nil, err
	}

	// Update graph index
	v.graphIndex.Nodes[id] = &GraphNode{
		ID:       id,
		Category: category,
		Title:    entry.Title,
		Tags:     entry.Tags,
		Score:    entry.Score,
		Links:    []string{},
		Path:     filePath,
	}
	v.saveGraphIndex()

	// Short-term buffer
	v.shortTermBuffer = append(v.shortTermBuffer, *entry)
	if len(v.shortTermBuffer) > v.shortTermMax {
		v.shortTermBuffer = v.shortTermBuffer[1:]
	}

	return entry, nil
}

// ── Recall — search vault ────────────────────────────────────────────

type RecallOpts struct {
	Category VaultCategory
	Limit    int
	MinScore float64
}

func (v *ClawVault) Recall(query string, opts RecallOpts) []VaultEntry {
	v.mu.RLock()
	defer v.mu.RUnlock()

	limit := opts.Limit
	if limit <= 0 {
		limit = 10
	}

	entries := v.loadAllEntries(opts.Category)

	// Score entries against query
	type scored struct {
		entry     VaultEntry
		relevance float64
	}
	var results []scored
	for _, e := range entries {
		rel := v.computeRelevance(query, e)
		if rel > opts.MinScore || opts.MinScore == 0 && rel > 0.1 {
			results = append(results, scored{e, rel})
		}
	}

	// Sort by relevance × score (descending)
	for i := 0; i < len(results); i++ {
		for j := i + 1; j < len(results); j++ {
			if results[j].relevance*results[j].entry.Score > results[i].relevance*results[i].entry.Score {
				results[i], results[j] = results[j], results[i]
			}
		}
	}

	out := make([]VaultEntry, 0, limit)
	for i, r := range results {
		if i >= limit {
			break
		}
		out = append(out, r.entry)
	}
	return out
}

// GetShortTermContext returns recent entries from the in-memory buffer.
func (v *ClawVault) GetShortTermContext(limit int) []VaultEntry {
	v.mu.RLock()
	defer v.mu.RUnlock()
	if limit <= 0 {
		limit = 10
	}
	start := len(v.shortTermBuffer) - limit
	if start < 0 {
		start = 0
	}
	result := make([]VaultEntry, len(v.shortTermBuffer[start:]))
	copy(result, v.shortTermBuffer[start:])
	return result
}

// ── Graph Traversal ──────────────────────────────────────────────────

func (v *ClawVault) LinkEntries(fromID, toID string, weight float64) error {
	v.mu.Lock()
	defer v.mu.Unlock()

	fromNode := v.graphIndex.Nodes[fromID]
	toNode := v.graphIndex.Nodes[toID]
	if fromNode == nil || toNode == nil {
		return fmt.Errorf("node not found")
	}

	// Add link if not present
	for _, l := range fromNode.Links {
		if l == toID {
			return nil
		}
	}
	fromNode.Links = append(fromNode.Links, toID)
	v.graphIndex.Edges = append(v.graphIndex.Edges, GraphEdge{From: fromID, To: toID, Weight: weight})
	return v.saveGraphIndex()
}

func (v *ClawVault) TraverseGraph(startID string, depth int) []VaultEntry {
	v.mu.RLock()
	defer v.mu.RUnlock()

	visited := make(map[string]bool)
	var results []VaultEntry

	var traverse func(id string, d int)
	traverse = func(id string, d int) {
		if visited[id] || d < 0 {
			return
		}
		visited[id] = true

		node := v.graphIndex.Nodes[id]
		if node == nil {
			return
		}

		entry := v.loadEntry(node.Path)
		if entry != nil {
			results = append(results, *entry)
		}

		for _, linkedID := range node.Links {
			traverse(linkedID, d-1)
		}
	}

	traverse(startID, depth)
	return results
}

// ── Checkpoint (Wake/Sleep) ──────────────────────────────────────────

func (v *ClawVault) SaveCheckpoint(sessionID string, agentState map[string]any, activePositions []any, pendingResearch []string) error {
	v.mu.Lock()
	defer v.mu.Unlock()

	shortTermIDs := make([]string, len(v.shortTermBuffer))
	for i, e := range v.shortTermBuffer {
		shortTermIDs[i] = e.ID
	}

	cp := Checkpoint{
		SessionID:       sessionID,
		AgentState:      agentState,
		ActivePositions: activePositions,
		PendingResearch: pendingResearch,
		CreatedAt:       time.Now().Format(time.RFC3339),
	}
	cp.Memory.ShortTerm = shortTermIDs

	data, err := json.MarshalIndent(cp, "", "  ")
	if err != nil {
		return err
	}
	cpPath := filepath.Join(v.clawvaultPath, "last-checkpoint.json")
	return os.WriteFile(cpPath, data, 0644)
}

func (v *ClawVault) LoadCheckpoint() (*Checkpoint, error) {
	cpPath := filepath.Join(v.clawvaultPath, "last-checkpoint.json")
	data, err := os.ReadFile(cpPath)
	if err != nil {
		return nil, err
	}
	var cp Checkpoint
	if err := json.Unmarshal(data, &cp); err != nil {
		return nil, err
	}
	return &cp, nil
}

// ── Trade Memory ─────────────────────────────────────────────────────

type TradeRecordInput struct {
	Token      string
	Mint       string
	Side       string // "long", "short", "buy", "sell"
	Size       float64
	EntryPrice float64
	ExitPrice  float64
	PnlUSD     float64
	PnlPct     float64
	Rationale  string
	Signals    map[string]any
	Outcome    string // "win", "loss", "neutral", ""
}

func (v *ClawVault) RecordTrade(trade TradeRecordInput) (*VaultEntry, error) {
	pnlStr := "Position open"
	if trade.ExitPrice > 0 {
		pnlStr = fmt.Sprintf("PnL: $%.2f (%.2f%%)", trade.PnlUSD, trade.PnlPct)
	}

	exitStr := "Open"
	if trade.ExitPrice > 0 {
		exitStr = fmt.Sprintf("$%.4f", trade.ExitPrice)
	}

	signalsJSON, _ := json.MarshalIndent(trade.Signals, "", "  ")

	content := fmt.Sprintf(`## Trade: %s %s

**Token:** %s (%s)
**Side:** %s
**Size:** %.4f
**Entry:** $%.4f
**Exit:** %s
**%s**
**Outcome:** %s

### Rationale
%s

### Signals at Entry
`+"```json\n%s\n```",
		strings.ToUpper(trade.Side), trade.Token,
		trade.Token, trade.Mint,
		trade.Side, trade.Size, trade.EntryPrice, exitStr,
		pnlStr,
		coalesce(trade.Outcome, "Pending"),
		trade.Rationale,
		string(signalsJSON))

	score := 0.5
	if trade.Outcome == "win" {
		score = 0.9
	} else if trade.Outcome == "loss" {
		score = 0.7
	}

	return v.Remember(content, RememberOpts{
		Category: CatTrades,
		Title:    fmt.Sprintf("%s %s @ $%.4f", trade.Side, trade.Token, trade.EntryPrice),
		Tags:     []string{trade.Token, trade.Side, coalesce(trade.Outcome, "open")},
		Score:    score,
		Metadata: map[string]any{
			"mint":        trade.Mint,
			"entry_price": trade.EntryPrice,
			"exit_price":  trade.ExitPrice,
			"pnl_usd":     trade.PnlUSD,
			"outcome":     trade.Outcome,
		},
	})
}

func (v *ClawVault) GetTradeHistory(token string, limit int) []VaultEntry {
	q := token
	if q == "" {
		q = "trade"
	}
	return v.Recall(q, RecallOpts{Category: CatTrades, Limit: limit})
}

// ── Reflect (overnight consolidation) ────────────────────────────────
// Promotes high-value inbox entries to proper categories.

type ReflectResult struct {
	Promoted int
	Archived int
}

func (v *ClawVault) Reflect() ReflectResult {
	inbox := v.loadAllEntries(CatInbox)
	var result ReflectResult

	for _, entry := range inbox {
		if entry.Score >= 0.6 {
			newCat := v.autoRoute(entry.Content)
			if newCat != CatInbox {
				v.Remember(entry.Content, RememberOpts{
					Category: newCat,
					Title:    entry.Title,
					Tags:     entry.Tags,
					Metadata: entry.Metadata,
					Score:    entry.Score,
				})
				os.Remove(v.entryPath(&entry))
				result.Promoted++
			}
		} else if entry.Score < 0.2 {
			os.Remove(v.entryPath(&entry))
			result.Archived++
		}
	}

	return result
}

// ── Context Profile (for agent injection) ────────────────────────────

func (v *ClawVault) BuildContextProfile(query string) string {
	memories := v.Recall(query, RecallOpts{Limit: 5})
	recent := v.GetShortTermContext(5)
	trades := v.GetTradeHistory("", 3)

	var sb strings.Builder

	if len(recent) > 0 {
		sb.WriteString("## Recent Memory (Short-Term)\n\n")
		for _, e := range recent {
			sb.WriteString(fmt.Sprintf("- **%s**: %s\n", e.Title, truncateStr(e.Content, 100)))
		}
		sb.WriteString("\n")
	}

	if len(memories) > 0 {
		sb.WriteString("## Relevant Knowledge\n\n")
		for _, e := range memories {
			sb.WriteString(fmt.Sprintf("### %s\n%s\n\n", e.Title, truncateStr(e.Content, 200)))
		}
	}

	if len(trades) > 0 {
		sb.WriteString("## Recent Trades\n\n")
		for _, t := range trades {
			sb.WriteString(fmt.Sprintf("- %s\n", t.Title))
		}
	}

	return sb.String()
}

// ── Internal Utilities ───────────────────────────────────────────────

func (v *ClawVault) autoRoute(content string) VaultCategory {
	lower := strings.ToLower(content)
	scores := make(map[VaultCategory]int)

	for cat, keywords := range categoryKeywords {
		for _, kw := range keywords {
			if strings.Contains(lower, kw) {
				scores[cat]++
			}
		}
	}

	bestCat := CatInbox
	bestScore := 0
	for cat, score := range scores {
		if score > bestScore {
			bestCat = cat
			bestScore = score
		}
	}
	return bestCat
}

func (v *ClawVault) scoreContent(content string) float64 {
	lower := strings.ToLower(content)
	score := 0.3

	if strings.Contains(lower, "critical") || strings.Contains(lower, "important") {
		score += 0.2
	}
	if strings.Contains(lower, "pnl") || strings.Contains(lower, "profit") || strings.Contains(lower, "loss") {
		score += 0.15
	}
	if strings.Contains(lower, "pattern") || strings.Contains(lower, "insight") {
		score += 0.15
	}
	if strings.Contains(lower, "learned") || strings.Contains(lower, "mistake") {
		score += 0.2
	}
	if strings.Contains(content, "```") {
		score += 0.1
	}
	if len(content) > 500 {
		score += 0.1
	}

	if score > 1.0 {
		score = 1.0
	}
	return score
}

func (v *ClawVault) computeRelevance(query string, entry VaultEntry) float64 {
	queryWords := strings.Fields(strings.ToLower(query))
	contentWords := make(map[string]bool)
	for _, w := range strings.Fields(strings.ToLower(entry.Content)) {
		contentWords[w] = true
	}
	titleWords := make(map[string]bool)
	for _, w := range strings.Fields(strings.ToLower(entry.Title)) {
		titleWords[w] = true
	}

	matches := 0.0
	for _, word := range queryWords {
		if len(word) < 3 {
			continue
		}
		if contentWords[word] {
			matches += 1
		}
		if titleWords[word] {
			matches += 2
		}
		for _, tag := range entry.Tags {
			if strings.Contains(strings.ToLower(tag), word) {
				matches += 1.5
			}
		}
	}

	denom := float64(len(queryWords)) * 4
	if denom == 0 {
		return 0
	}
	rel := matches / denom
	if rel > 1 {
		rel = 1
	}
	return rel
}

func (v *ClawVault) extractTitle(content string) string {
	lines := strings.SplitN(content, "\n", 3)
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "#") {
			return strings.TrimLeft(line, "# ")
		}
		if line != "" {
			if len(line) > 60 {
				return line[:60] + "..."
			}
			return line
		}
	}
	return "Untitled"
}

func (v *ClawVault) extractTags(content string) []string {
	tags := make(map[string]bool)

	// $TOKEN tags
	for i := 0; i < len(content)-1; i++ {
		if content[i] == '$' {
			j := i + 1
			for j < len(content) && ((content[j] >= 'A' && content[j] <= 'Z') || (content[j] >= '0' && content[j] <= '9')) {
				j++
			}
			if j-i > 2 && j-i <= 11 {
				tags[strings.ToLower(content[i+1:j])] = true
			}
		}
	}

	// #tag tags
	for i := 0; i < len(content)-1; i++ {
		if content[i] == '#' && i > 0 && content[i-1] == ' ' {
			j := i + 1
			for j < len(content) && content[j] != ' ' && content[j] != '\n' {
				j++
			}
			if j-i > 2 {
				tags[strings.ToLower(content[i+1:j])] = true
			}
		}
	}

	result := make([]string, 0, len(tags))
	for t := range tags {
		result = append(result, t)
		if len(result) >= 10 {
			break
		}
	}
	return result
}

func (v *ClawVault) generateID(category VaultCategory) string {
	date := time.Now().Format("20060102")
	chars := "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, 5)
	for i := range b {
		b[i] = chars[rand.Intn(len(chars))]
	}
	return fmt.Sprintf("%s-%s-%s", category, date, string(b))
}

func (v *ClawVault) entryPath(entry *VaultEntry) string {
	return filepath.Join(v.vaultPath, string(entry.Category), entry.ID+".md")
}

func (v *ClawVault) loadEntry(filePath string) *VaultEntry {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil
	}

	content := string(data)
	entry := &VaultEntry{
		ID:       strings.TrimSuffix(filepath.Base(filePath), ".md"),
		Category: CatInbox,
		Score:    0.5,
	}

	// Parse frontmatter
	if strings.HasPrefix(content, "---\n") {
		parts := strings.SplitN(content[4:], "\n---\n", 2)
		if len(parts) == 2 {
			entry.Content = strings.TrimSpace(parts[1])
			for _, line := range strings.Split(parts[0], "\n") {
				kv := strings.SplitN(line, ":", 2)
				if len(kv) != 2 {
					continue
				}
				key := strings.TrimSpace(kv[0])
				val := strings.TrimSpace(kv[1])
				switch key {
				case "id":
					entry.ID = val
				case "category":
					entry.Category = VaultCategory(val)
				case "title":
					entry.Title = val
				case "created_at":
					entry.CreatedAt = val
				case "updated_at":
					entry.UpdatedAt = val
				}
			}
		}
	} else {
		entry.Content = content
	}

	if entry.Title == "" {
		entry.Title = v.extractTitle(entry.Content)
	}

	return entry
}

func (v *ClawVault) loadAllEntries(category VaultCategory) []VaultEntry {
	categories := allCategories
	if category != "" {
		categories = []VaultCategory{category}
	}

	var entries []VaultEntry
	for _, cat := range categories {
		dir := filepath.Join(v.vaultPath, string(cat))
		files, err := os.ReadDir(dir)
		if err != nil {
			continue
		}
		for _, f := range files {
			if !f.IsDir() && strings.HasSuffix(f.Name(), ".md") {
				entry := v.loadEntry(filepath.Join(dir, f.Name()))
				if entry != nil {
					entries = append(entries, *entry)
				}
			}
		}
	}
	return entries
}

func (v *ClawVault) saveGraphIndex() error {
	v.graphIndex.LastUpdated = time.Now().Format(time.RFC3339)
	data, err := json.MarshalIndent(v.graphIndex, "", "  ")
	if err != nil {
		return err
	}
	graphPath := filepath.Join(v.clawvaultPath, "graph-index.json")
	return os.WriteFile(graphPath, data, 0644)
}

func coalesce(values ...string) string {
	for _, v := range values {
		if v != "" {
			return v
		}
	}
	return ""
}

func truncateStr(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}
