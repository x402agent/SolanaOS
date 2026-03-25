package learning

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

type UserObservation struct {
	UserID    string
	UserName  string
	Channel   string
	Content   string
	CreatedAt time.Time
}

type IntentStat struct {
	Name  string `json:"name"`
	Count int    `json:"count"`
}

type DialecticModel struct {
	Thesis     []string `json:"thesis,omitempty"`
	Antithesis []string `json:"antithesis,omitempty"`
	Synthesis  []string `json:"synthesis,omitempty"`
}

type UserModel struct {
	UserID           string         `json:"user_id"`
	UserName         string         `json:"user_name"`
	Channels         []string       `json:"channels"`
	Preferences      []string       `json:"preferences"`
	WorkStyle        []string       `json:"work_style"`
	DomainKnowledge  []string       `json:"domain_knowledge"`
	RecurringIntents []IntentStat   `json:"recurring_intents"`
	NotableFacts     []string       `json:"notable_facts"`
	Evidence         []string       `json:"evidence"`
	Dialectic        DialecticModel `json:"dialectic"`
	LastUpdated      time.Time      `json:"last_updated"`
}

type UserModelStore struct {
	root        string
	maxEvidence int
}

func NewUserModelStore(root string, maxEvidence int) *UserModelStore {
	if maxEvidence <= 0 {
		maxEvidence = 12
	}
	return &UserModelStore{
		root:        root,
		maxEvidence: maxEvidence,
	}
}

func (s *UserModelStore) Init() error {
	if s == nil {
		return nil
	}
	return os.MkdirAll(s.root, 0o755)
}

func (s *UserModelStore) Observe(obs UserObservation) (*UserModel, error) {
	if s == nil {
		return nil, nil
	}
	model, err := s.Load(obs.UserID)
	if err != nil {
		return nil, err
	}
	if model.UserID == "" {
		model.UserID = obs.UserID
	}
	if strings.TrimSpace(obs.UserName) != "" {
		model.UserName = strings.TrimSpace(obs.UserName)
	}
	if strings.TrimSpace(obs.Channel) != "" {
		model.Channels = appendUnique(model.Channels, obs.Channel)
	}

	intent := inferIntent(obs.Content)
	model.RecurringIntents = mergeIntents(model.RecurringIntents, intent)
	model.Preferences = uniqueNonEmpty(append(model.Preferences, extractPreferences(obs.Content)...))
	model.WorkStyle = uniqueNonEmpty(append(model.WorkStyle, inferWorkStyle(obs.Content)...))
	model.DomainKnowledge = uniqueNonEmpty(append(model.DomainKnowledge, inferDomains(obs.Content)...))
	model.NotableFacts = uniqueNonEmpty(append(model.NotableFacts, extractNotableFacts(obs.Content)...))
	model.Evidence = appendEvidence(model.Evidence, HeuristicSummary(obs.Content), s.maxEvidence)
	model.Dialectic = buildDialectic(model)
	if obs.CreatedAt.IsZero() {
		obs.CreatedAt = time.Now().UTC()
	}
	model.LastUpdated = obs.CreatedAt.UTC()

	if err := s.Save(model); err != nil {
		return nil, err
	}
	return model, nil
}

func (s *UserModelStore) Load(userID string) (*UserModel, error) {
	if s == nil {
		return nil, nil
	}
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return &UserModel{}, nil
	}
	path := s.modelPath(userID)
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return &UserModel{UserID: userID}, nil
		}
		return nil, err
	}
	var model UserModel
	if err := json.Unmarshal(data, &model); err != nil {
		return nil, err
	}
	if model.UserID == "" {
		model.UserID = userID
	}
	return &model, nil
}

func (s *UserModelStore) Save(model *UserModel) error {
	if s == nil || model == nil || strings.TrimSpace(model.UserID) == "" {
		return nil
	}
	if err := os.MkdirAll(s.root, 0o755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(model, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.modelPath(model.UserID), data, 0o644)
}

func (s *UserModelStore) List() ([]*UserModel, error) {
	if s == nil {
		return nil, nil
	}
	entries, err := os.ReadDir(s.root)
	if err != nil {
		if os.IsNotExist(err) {
			return []*UserModel{}, nil
		}
		return nil, err
	}
	models := make([]*UserModel, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}
		data, err := os.ReadFile(filepath.Join(s.root, entry.Name()))
		if err != nil {
			continue
		}
		var model UserModel
		if err := json.Unmarshal(data, &model); err == nil && strings.TrimSpace(model.UserID) != "" {
			models = append(models, &model)
		}
	}
	sort.Slice(models, func(i, j int) bool { return models[i].UserID < models[j].UserID })
	return models, nil
}

func (s *UserModelStore) modelPath(userID string) string {
	return filepath.Join(s.root, safeSlug(userID)+".json")
}

func (m *UserModel) FormatPromptContext() string {
	if m == nil || strings.TrimSpace(m.UserID) == "" {
		return ""
	}
	var lines []string
	if len(m.Preferences) > 0 {
		lines = append(lines, "Preferences: "+strings.Join(limitStrings(m.Preferences, 6), ", "))
	}
	if len(m.WorkStyle) > 0 {
		lines = append(lines, "Work style: "+strings.Join(limitStrings(m.WorkStyle, 6), ", "))
	}
	if len(m.DomainKnowledge) > 0 {
		lines = append(lines, "Known domains: "+strings.Join(limitStrings(m.DomainKnowledge, 8), ", "))
	}
	if len(m.RecurringIntents) > 0 {
		intents := make([]string, 0, min(len(m.RecurringIntents), 5))
		for _, stat := range limitIntents(m.RecurringIntents, 5) {
			intents = append(intents, fmt.Sprintf("%s(%d)", stat.Name, stat.Count))
		}
		lines = append(lines, "Recurring intents: "+strings.Join(intents, ", "))
	}
	if len(m.NotableFacts) > 0 {
		lines = append(lines, "Notable facts: "+strings.Join(limitStrings(m.NotableFacts, 4), " | "))
	}
	if len(m.Dialectic.Synthesis) > 0 {
		lines = append(lines, "Dialectic synthesis: "+strings.Join(limitStrings(m.Dialectic.Synthesis, 3), " | "))
	}
	return strings.Join(lines, "\n")
}

func buildDialectic(m *UserModel) DialecticModel {
	if m == nil {
		return DialecticModel{}
	}
	out := DialecticModel{}
	if len(m.Preferences) > 0 {
		out.Thesis = limitStrings(m.Preferences, 3)
	}
	if len(m.WorkStyle) > 0 {
		out.Antithesis = limitStrings(m.WorkStyle, 3)
	}
	if len(m.Preferences) > 0 || len(m.WorkStyle) > 0 {
		out.Synthesis = append(out.Synthesis, buildSynthesisLine(m.Preferences, m.WorkStyle))
	}
	if len(m.DomainKnowledge) > 0 {
		out.Synthesis = append(out.Synthesis, "Operate with domain context: "+strings.Join(limitStrings(m.DomainKnowledge, 3), ", "))
	}
	out.Synthesis = uniqueNonEmpty(out.Synthesis)
	return out
}

func buildSynthesisLine(preferences, workStyle []string) string {
	pref := "clear outputs"
	style := "systems-aware execution"
	if len(preferences) > 0 {
		pref = preferences[0]
	}
	if len(workStyle) > 0 {
		style = workStyle[0]
	}
	return fmt.Sprintf("Balance %s with %s.", pref, style)
}

func limitIntents(intents []IntentStat, n int) []IntentStat {
	if len(intents) == 0 {
		return nil
	}
	out := append([]IntentStat(nil), intents...)
	sort.Slice(out, func(i, j int) bool {
		if out[i].Count == out[j].Count {
			return out[i].Name < out[j].Name
		}
		return out[i].Count > out[j].Count
	})
	if n > 0 && len(out) > n {
		out = out[:n]
	}
	return out
}

func mergeIntents(intents []IntentStat, intent string) []IntentStat {
	intent = strings.TrimSpace(intent)
	if intent == "" {
		return intents
	}
	for i := range intents {
		if intents[i].Name == intent {
			intents[i].Count++
			return intents
		}
	}
	return append(intents, IntentStat{Name: intent, Count: 1})
}

func extractPreferences(content string) []string {
	lower := strings.ToLower(content)
	var out []string
	if strings.Contains(lower, "short") || strings.Contains(lower, "concise") || strings.Contains(lower, "terse") {
		out = append(out, "prefers concise responses")
	}
	if strings.Contains(lower, "deep") || strings.Contains(lower, "detailed") {
		out = append(out, "asks for deep analysis when needed")
	}
	if strings.Contains(lower, "command") || strings.Contains(lower, "cli") {
		out = append(out, "comfortable with command-line workflows")
	}
	if strings.Contains(lower, "telegram") || strings.Contains(lower, "discord") {
		out = append(out, "prefers messaging-native interfaces")
	}
	return out
}

func inferWorkStyle(content string) []string {
	lower := strings.ToLower(content)
	var out []string
	if strings.Contains(lower, "automate") || strings.Contains(lower, "continuous") {
		out = append(out, "automation-oriented")
	}
	if strings.Contains(lower, "integrate") || strings.Contains(lower, "system") || strings.Contains(lower, "architecture") {
		out = append(out, "systems thinker")
	}
	if strings.Contains(lower, "restart") || strings.Contains(lower, "verify") || strings.Contains(lower, "logs") {
		out = append(out, "operational and verification-focused")
	}
	if strings.Contains(lower, "build") || strings.Contains(lower, "implement") {
		out = append(out, "implementation-driven")
	}
	return out
}

func inferDomains(content string) []string {
	lower := strings.ToLower(content)
	var out []string
	pairs := map[string]string{
		"solana":     "solana trading",
		"telegram":   "telegram bots",
		"discord":    "discord automation",
		"pump":       "token launch workflows",
		"trade":      "trading systems",
		"wallet":     "wallet analytics",
		"skill":      "agent skill systems",
		"memory":     "agent memory systems",
		"llm":        "llm orchestration",
		"openrouter": "openrouter operations",
	}
	for needle, label := range pairs {
		if strings.Contains(lower, needle) {
			out = append(out, label)
		}
	}
	return out
}

func inferIntent(content string) string {
	lower := strings.ToLower(strings.TrimSpace(content))
	switch {
	case strings.HasPrefix(lower, "/research") || strings.Contains(lower, "research"):
		return "token_research"
	case strings.Contains(lower, "buy") || strings.Contains(lower, "sell") || strings.Contains(lower, "trade"):
		return "trade_execution"
	case strings.Contains(lower, "chart") || strings.Contains(lower, "price") || strings.Contains(lower, "holders") || strings.Contains(lower, "trending"):
		return "market_analysis"
	case strings.Contains(lower, "wallet") || strings.Contains(lower, "portfolio") || strings.Contains(lower, "pnl"):
		return "portfolio_review"
	case strings.Contains(lower, "build") || strings.Contains(lower, "integrate") || strings.Contains(lower, "feature") || strings.Contains(lower, "capability"):
		return "system_design"
	case strings.Contains(lower, "skill") || strings.Contains(lower, "function"):
		return "skill_creation"
	default:
		return "general_assistance"
	}
}

func extractNotableFacts(content string) []string {
	lower := strings.ToLower(strings.TrimSpace(content))
	var out []string
	switch {
	case strings.Contains(lower, "i want"):
		out = append(out, HeuristicSummary(content))
	case strings.Contains(lower, "my "):
		out = append(out, HeuristicSummary(content))
	case strings.Contains(lower, "we "):
		out = append(out, HeuristicSummary(content))
	}
	return out
}

func appendEvidence(evidence []string, item string, max int) []string {
	item = strings.TrimSpace(item)
	if item == "" {
		return evidence
	}
	if len(evidence) > 0 && evidence[len(evidence)-1] == item {
		return evidence
	}
	evidence = append(evidence, item)
	if max > 0 && len(evidence) > max {
		evidence = evidence[len(evidence)-max:]
	}
	return evidence
}

func appendUnique(items []string, item string) []string {
	item = strings.TrimSpace(item)
	if item == "" {
		return items
	}
	for _, existing := range items {
		if strings.EqualFold(existing, item) {
			return items
		}
	}
	return append(items, item)
}

func uniqueNonEmpty(items []string) []string {
	out := make([]string, 0, len(items))
	seen := make(map[string]struct{}, len(items))
	for _, item := range items {
		item = strings.TrimSpace(item)
		if item == "" {
			continue
		}
		key := strings.ToLower(item)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		out = append(out, item)
	}
	return out
}
