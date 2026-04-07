package skills

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
)

// Manager holds all built-in skills and supports search, lookup, and creation.
type Manager struct {
	mu      sync.RWMutex
	skills  map[string]Skill // keyed by lowercase name
	baseDir string           // skills/ source directory
}

// NewManager creates a Manager and eagerly loads all skill metadata from baseDir.
// Only frontmatter is loaded at start; bodies are loaded on first access.
func NewManager(baseDir string) (*Manager, error) {
	m := &Manager{
		skills:  make(map[string]Skill),
		baseDir: baseDir,
	}
	if err := m.reload(); err != nil {
		return nil, err
	}
	return m, nil
}

// ResolveSkillsDir returns the first existing skills/ directory from candidates:
// env override → CWD/skills → exe-dir/../skills → common install paths.
func ResolveSkillsDir() string {
	if v := strings.TrimSpace(firstNonEmptyEnv("SOLANAOS_SKILLS_DIR", "SOLANAOS_SKILLS_DIR")); v != "" {
		return v
	}
	candidates := []string{}
	if cwd, err := os.Getwd(); err == nil {
		candidates = append(candidates, filepath.Join(cwd, "skills"))
	}
	if exe, err := os.Executable(); err == nil {
		base := filepath.Dir(exe)
		candidates = append(candidates,
			filepath.Join(base, "skills"),
			filepath.Join(filepath.Dir(base), "skills"),
		)
	}
	for _, extra := range []string{
		"/app/skills",
		"/workspace/skills",
		filepath.Join(os.Getenv("HOME"), "solanaos", "skills"),
	} {
		candidates = append(candidates, extra)
	}
	for _, c := range candidates {
		if info, err := os.Stat(c); err == nil && info.IsDir() {
			return c
		}
	}
	return ""
}

func firstNonEmptyEnv(keys ...string) string {
	for _, key := range keys {
		if value := strings.TrimSpace(os.Getenv(key)); value != "" {
			return value
		}
	}
	return ""
}

// reload scans baseDir and loads skill frontmatter (not bodies) for every subdirectory.
func (m *Manager) reload() error {
	if m.baseDir == "" {
		return nil
	}
	entries, err := os.ReadDir(m.baseDir)
	if err != nil {
		return fmt.Errorf("skills dir: %w", err)
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		skillDir := filepath.Join(m.baseDir, e.Name())
		sk, err := loadSkillFromDir(skillDir)
		if err != nil {
			continue
		}
		if sk.Name == "" {
			sk.Name = e.Name()
		}
		m.skills[strings.ToLower(sk.Name)] = sk
	}
	return nil
}

// All returns every loaded skill sorted by name.
func (m *Manager) All() []*Skill {
	m.mu.RLock()
	defer m.mu.RUnlock()
	out := make([]*Skill, 0, len(m.skills))
	for i := range m.skills {
		sk := m.skills[i]
		out = append(out, &sk)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}

// Count returns how many skills are loaded.
func (m *Manager) Count() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return len(m.skills)
}

// Get returns a skill by exact name (case-insensitive). Body is loaded on demand.
func (m *Manager) Get(name string) *Skill {
	key := strings.ToLower(strings.TrimSpace(name))
	m.mu.RLock()
	sk, ok := m.skills[key]
	m.mu.RUnlock()
	if !ok {
		return nil
	}
	// Lazy-load body if not yet populated.
	if sk.Body == "" && m.baseDir != "" {
		full, err := loadSkillFromDir(filepath.Join(m.baseDir, sk.Name))
		if err == nil {
			m.mu.Lock()
			sk.Body = full.Body
			m.skills[key] = sk
			m.mu.Unlock()
		}
	}
	result := sk
	return &result
}

// Search returns skills whose name or description contain any of the query words.
func (m *Manager) Search(query string) []*Skill {
	words := strings.Fields(strings.ToLower(query))
	if len(words) == 0 {
		return m.All()
	}
	m.mu.RLock()
	defer m.mu.RUnlock()
	var out []*Skill
	for i := range m.skills {
		sk := m.skills[i]
		hay := strings.ToLower(sk.Name + " " + sk.Description)
		for _, w := range words {
			if strings.Contains(hay, w) {
				copy := sk
				out = append(out, &copy)
				break
			}
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}

// MatchMessage returns the best skill for a natural-language message, or nil if
// no strong match is found. Uses simple term-frequency scoring.
func (m *Manager) MatchMessage(msg string) *Skill {
	words := strings.Fields(strings.ToLower(msg))
	if len(words) == 0 {
		return nil
	}
	// Ignore very short messages — not enough signal.
	if len(words) < 3 {
		return nil
	}
	m.mu.RLock()
	defer m.mu.RUnlock()

	var best *Skill
	bestScore := 0
	for i := range m.skills {
		sk := m.skills[i]
		hay := strings.ToLower(sk.Name + " " + strings.Join(sk.Tags, " ") + " " + sk.Description)
		score := 0
		for _, w := range words {
			if len(w) < 4 {
				continue // skip stop words
			}
			if strings.Contains(hay, w) {
				score++
			}
		}
		if score > bestScore {
			copy := sk
			best, bestScore = &copy, score
		}
	}
	// Require at least 2 matching terms to avoid false positives.
	if bestScore < 2 {
		return nil
	}
	return best
}

// SkillsForContext returns skills whose tags or names match contextual keywords
// (e.g. "solana", "github", "pump"). Used to enrich LLM context.
func (m *Manager) SkillsForContext(keywords []string) []*Skill {
	m.mu.RLock()
	defer m.mu.RUnlock()
	var out []*Skill
	for i := range m.skills {
		sk := m.skills[i]
		hay := strings.ToLower(sk.Name + " " + strings.Join(sk.Tags, " "))
		for _, kw := range keywords {
			if strings.Contains(hay, strings.ToLower(kw)) {
				copy := sk
				out = append(out, &copy)
				break
			}
		}
	}
	return out
}

// Create scaffolds a new SKILL.md in the workspace skills directory and
// registers it in memory.
func (m *Manager) Create(workspacePath, name, description, body string) (string, error) {
	name = strings.ToLower(strings.TrimSpace(strings.ReplaceAll(name, " ", "-")))
	if name == "" {
		return "", fmt.Errorf("skill name is required")
	}
	if description == "" {
		return "", fmt.Errorf("skill description is required")
	}
	if body == "" {
		body = fmt.Sprintf("# %s\n\n_Describe how to use this skill._\n", name)
	}

	sk := Skill{
		Name:        name,
		Description: description,
		Version:     "1.0.0",
		Body:        body,
	}

	// Write to workspace skills directory.
	// InstallSkill appends "skills/<name>" to the workspace path itself.
	if err := InstallSkill(workspacePath, sk); err != nil {
		return "", fmt.Errorf("create skill: %w", err)
	}
	skillDir := filepath.Join(workspacePath, "skills", name)

	// Register in memory.
	m.mu.Lock()
	m.skills[strings.ToLower(name)] = sk
	m.mu.Unlock()

	return skillDir, nil
}

// CategoryGroups returns skills grouped into broad categories for display.
func (m *Manager) CategoryGroups() map[string][]*Skill {
	groups := map[string][]*Skill{
		"🌞  Solana / Crypto": {},
		"🧠  AI / LLM":        {},
		"🐙  Dev Tools":       {},
		"📝  Productivity":    {},
		"💬  Communication":   {},
		"🎵  Media":           {},
		"🔧  System / Ops":    {},
		"🤖  SolanaOS":        {},
		"📦  Other":           {},
	}
	category := func(sk Skill) string {
		n := strings.ToLower(sk.Name)
		desc := strings.ToLower(sk.Description)
		switch {
		case hasAny(n, "pump", "pumpfun", "solana", "swarm", "bonding", "token", "fee-shar", "fee-sys", "fee-claim"):
			return "🌞  Solana / Crypto"
		case hasAny(n, "gemini", "oracle", "openai", "model-usage", "summarize", "coding-agent", "skill-creator"):
			return "🧠  AI / LLM"
		case hasAny(n, "github", "gh-issues", "tmux", "eightctl", "gog", "sag", "mcporter", "blucli", "e2b", "sandbox", "desktop", "browseruse", "cua", "steel", "computer-use"):
			return "🐙  Dev Tools"
		case hasAny(n, "notion", "obsidian", "trello", "things", "bear", "apple-notes", "apple-reminders", "himalaya", "session-logs", "nano-pdf"):
			return "📝  Productivity"
		case hasAny(n, "discord", "slack", "imsg", "bluebubbles", "wacli", "voice-call"):
			return "💬  Communication"
		case hasAny(n, "spotify", "sonos", "songsee", "video", "camsnap", "openai-image", "openai-whisper", "gifgrep", "peekaboo"):
			return "🎵  Media"
		case hasAny(n, "healthcheck", "weather", "openhue", "goplaces", "ordercli", "xurl", "blogwatcher"):
			return "🔧  System / Ops"
		case hasAny(n, "solanaos", "nano-banana", "clawhub", "gateway-node", "seeker-daemon", "canvas", "1password"):
			return "🤖  SolanaOS"
		case strings.Contains(desc, "solanaos") || strings.Contains(desc, "seeker"):
			return "🤖  SolanaOS"
		default:
			return "📦  Other"
		}
	}

	m.mu.RLock()
	defer m.mu.RUnlock()
	for i := range m.skills {
		sk := m.skills[i]
		cat := category(sk)
		copy := sk
		groups[cat] = append(groups[cat], &copy)
	}
	// Sort within each group.
	for k := range groups {
		sort.Slice(groups[k], func(i, j int) bool {
			return groups[k][i].Name < groups[k][j].Name
		})
	}
	return groups
}

func hasAny(s string, subs ...string) bool {
	for _, sub := range subs {
		if strings.Contains(s, sub) {
			return true
		}
	}
	return false
}
