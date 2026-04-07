// Package skills provides skill discovery, installation, and local parsing
// for MawdBot/Seeker-style skill bundles.
package skills

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

type SkillRequires struct {
	Bins   []string `json:"bins,omitempty"`
	Env    []string `json:"env,omitempty"`
	Config []string `json:"config,omitempty"`
}

type Skill struct {
	Name         string        `json:"name"`
	Description  string        `json:"description"`
	Version      string        `json:"version"`
	Author       string        `json:"author,omitempty"`
	URL          string        `json:"url,omitempty"`
	Tags         []string      `json:"tags,omitempty"`
	Emoji        string        `json:"emoji,omitempty"`
	Requires     SkillRequires `json:"requires,omitempty"`
	AllowedTools []string      `json:"allowed_tools,omitempty"`
	Body         string        `json:"body,omitempty"`
	Source       string        `json:"source,omitempty"`
}

type AgentSkillsManifest struct {
	Schema       string `json:"$schema,omitempty"`
	OpenStandard string `json:"open_standard"`
	Skill        Skill  `json:"skill"`
}

// SearchResult from a skill registry search.
type SearchResult struct {
	Skills   []Skill   `json:"skills"`
	Source   string    `json:"source"`
	CachedAt time.Time `json:"cached_at"`
}

// SearchCache provides TTL-based caching for skill searches.
type SearchCache struct {
	mu      sync.RWMutex
	entries map[string]SearchResult
	maxSize int
	ttl     time.Duration
}

func NewSearchCache(maxSize int, ttl time.Duration) *SearchCache {
	if maxSize <= 0 {
		maxSize = 100
	}
	if ttl <= 0 {
		ttl = 5 * time.Minute
	}
	return &SearchCache{
		entries: make(map[string]SearchResult),
		maxSize: maxSize,
		ttl:     ttl,
	}
}

func (c *SearchCache) Get(query string) (SearchResult, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	sr, ok := c.entries[query]
	if !ok || time.Since(sr.CachedAt) > c.ttl {
		return SearchResult{}, false
	}
	return sr, true
}

func (c *SearchCache) Set(query string, result SearchResult) {
	c.mu.Lock()
	defer c.mu.Unlock()
	result.CachedAt = time.Now()
	c.entries[query] = result

	if len(c.entries) > c.maxSize {
		var oldest string
		var oldestTime time.Time
		for k, v := range c.entries {
			if oldest == "" || v.CachedAt.Before(oldestTime) {
				oldest = k
				oldestTime = v.CachedAt
			}
		}
		delete(c.entries, oldest)
	}
}

// RegistryConfig for skill registries.
type RegistryConfig struct {
	MaxConcurrentSearches int `json:"max_concurrent_searches"`
}

// RegistryManager handles skill discovery across registries.
type RegistryManager struct {
	cfg RegistryConfig
}

func NewRegistryManager(cfg RegistryConfig) *RegistryManager {
	if cfg.MaxConcurrentSearches <= 0 {
		cfg.MaxConcurrentSearches = 3
	}
	return &RegistryManager{cfg: cfg}
}

func (rm *RegistryManager) Search(ctx context.Context, query string) ([]Skill, error) {
	_ = ctx
	_ = query
	// Placeholder: in production, search MawdBot skill registry.
	return nil, nil
}

// InstallSkill installs a skill into workspace/skills/<skill-name>, writing both
// legacy skill.json and SKILL.md format.
func InstallSkill(workspace string, skill Skill) error {
	skill.Name = strings.TrimSpace(skill.Name)
	if skill.Name == "" {
		return fmt.Errorf("skill name is required")
	}
	if strings.TrimSpace(skill.Version) == "" {
		skill.Version = "1.0.0"
	}

	skillDir := filepath.Join(workspace, "skills", skill.Name)
	if err := os.MkdirAll(skillDir, 0o755); err != nil {
		return err
	}

	manifest, err := json.MarshalIndent(skill, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal skill: %w", err)
	}
	if err := os.WriteFile(filepath.Join(skillDir, "skill.json"), manifest, 0o644); err != nil {
		return err
	}
	agentManifest, err := json.MarshalIndent(AgentSkillsManifest{
		Schema:       "https://agentskills.io/schema/v1.json",
		OpenStandard: "agentskills.io/v1",
		Skill:        skill,
	}, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal agent skill manifest: %w", err)
	}
	if err := os.WriteFile(filepath.Join(skillDir, "agentskills.json"), agentManifest, 0o644); err != nil {
		return err
	}

	skillMD := buildSkillMarkdown(skill)
	if err := os.WriteFile(filepath.Join(skillDir, "SKILL.md"), []byte(skillMD), 0o644); err != nil {
		return err
	}

	return nil
}

// ListInstalled returns skills installed in the workspace.
// Backward compatibility:
//   - directory skill with skill.json
//   - directory skill with SKILL.md
//   - flat skills/*.md format
func ListInstalled(workspace string) ([]Skill, error) {
	skillsDir := filepath.Join(workspace, "skills")
	entries, err := os.ReadDir(skillsDir)
	if err != nil {
		if os.IsNotExist(err) {
			return []Skill{}, nil
		}
		return nil, err
	}

	var skills []Skill
	for _, e := range entries {
		entryPath := filepath.Join(skillsDir, e.Name())

		if e.IsDir() {
			s, err := loadSkillFromDir(entryPath)
			if err == nil {
				skills = append(skills, s)
			}
			continue
		}

		if strings.EqualFold(filepath.Ext(e.Name()), ".md") {
			s, err := loadSkillFromMarkdownFile(entryPath)
			if err == nil {
				skills = append(skills, s)
			}
		}
	}

	sort.Slice(skills, func(i, j int) bool {
		return skills[i].Name < skills[j].Name
	})

	return skills, nil
}

func loadSkillFromDir(skillDir string) (Skill, error) {
	jsonPath := filepath.Join(skillDir, "skill.json")
	agentJSONPath := filepath.Join(skillDir, "agentskills.json")
	mdPath := filepath.Join(skillDir, "SKILL.md")

	var fromJSON Skill
	if data, err := os.ReadFile(jsonPath); err == nil {
		if err := json.Unmarshal(data, &fromJSON); err == nil {
			fromJSON.Source = "skill.json"
		}
	} else if data, err := os.ReadFile(agentJSONPath); err == nil {
		var wrapper AgentSkillsManifest
		if err := json.Unmarshal(data, &wrapper); err == nil {
			fromJSON = wrapper.Skill
			fromJSON.Source = "agentskills.json"
		}
	}

	if _, err := os.Stat(mdPath); err == nil {
		fromMD, err := loadSkillFromMarkdownFile(mdPath)
		if err == nil {
			merged := mergeSkill(fromJSON, fromMD)
			if strings.TrimSpace(merged.Name) == "" {
				merged.Name = filepath.Base(skillDir)
			}
			if strings.TrimSpace(merged.Version) == "" {
				merged.Version = "1.0.0"
			}
			return merged, nil
		}
	}

	if strings.TrimSpace(fromJSON.Name) != "" {
		if strings.TrimSpace(fromJSON.Version) == "" {
			fromJSON.Version = "1.0.0"
		}
		if strings.TrimSpace(fromJSON.Description) == "" {
			fromJSON.Description = "Installed skill"
		}
		return fromJSON, nil
	}

	return Skill{}, fmt.Errorf("no readable skill manifest in %s", skillDir)
}

func mergeSkill(primary Skill, secondary Skill) Skill {
	out := primary
	if strings.TrimSpace(out.Name) == "" {
		out.Name = secondary.Name
	}
	if strings.TrimSpace(out.Description) == "" {
		out.Description = secondary.Description
	}
	if strings.TrimSpace(out.Version) == "" {
		out.Version = secondary.Version
	}
	if strings.TrimSpace(out.Author) == "" {
		out.Author = secondary.Author
	}
	if strings.TrimSpace(out.URL) == "" {
		out.URL = secondary.URL
	}
	if len(out.Tags) == 0 {
		out.Tags = append([]string{}, secondary.Tags...)
	}
	if strings.TrimSpace(out.Emoji) == "" {
		out.Emoji = secondary.Emoji
	}
	if len(out.Requires.Bins) == 0 {
		out.Requires.Bins = append([]string{}, secondary.Requires.Bins...)
	}
	if len(out.Requires.Env) == 0 {
		out.Requires.Env = append([]string{}, secondary.Requires.Env...)
	}
	if len(out.Requires.Config) == 0 {
		out.Requires.Config = append([]string{}, secondary.Requires.Config...)
	}
	if len(out.AllowedTools) == 0 {
		out.AllowedTools = append([]string{}, secondary.AllowedTools...)
	}
	if strings.TrimSpace(out.Body) == "" {
		out.Body = secondary.Body
	}
	if strings.TrimSpace(out.Source) == "" {
		out.Source = secondary.Source
	}
	return out
}

func loadSkillFromMarkdownFile(path string) (Skill, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return Skill{}, err
	}

	skill, err := parseSkillMarkdown(string(data))
	if err != nil {
		return Skill{}, err
	}

	if strings.TrimSpace(skill.Name) == "" {
		base := strings.TrimSuffix(filepath.Base(path), filepath.Ext(path))
		skill.Name = strings.TrimSpace(base)
	}
	if strings.TrimSpace(skill.Version) == "" {
		skill.Version = "1.0.0"
	}
	if strings.TrimSpace(skill.Description) == "" {
		skill.Description = "Installed skill"
	}
	skill.Source = filepath.Base(path)

	return skill, nil
}

func parseSkillMarkdown(raw string) (Skill, error) {
	raw = strings.ReplaceAll(raw, "\r\n", "\n")
	frontmatter, body, ok := splitFrontmatter(raw)
	if !ok {
		return parseLegacySkill(raw), nil
	}

	scalar, lists := parseSimpleYAML(frontmatter)

	getList := func(key string) []string {
		if v := lists[key]; len(v) > 0 {
			return uniqueAndClean(v)
		}
		if v := scalar[key]; strings.TrimSpace(v) != "" {
			return uniqueAndClean(splitCSV(v))
		}
		return nil
	}

	skill := Skill{
		Name:        cleanScalar(scalar["name"]),
		Description: cleanScalar(scalar["description"]),
		Version:     cleanScalar(scalar["version"]),
		Author:      cleanScalar(scalar["author"]),
		URL:         cleanScalar(scalar["url"]),
		Body:        strings.TrimSpace(body),
	}

	skill.Tags = getList("tags")
	skill.AllowedTools = getList("allowed-tools")
	if len(skill.AllowedTools) == 0 {
		skill.AllowedTools = getList("allowed_tools")
	}

	skill.Emoji = cleanScalar(scalar["emoji"])
	if skill.Emoji == "" {
		skill.Emoji = cleanScalar(scalar["metadata.solanaos.emoji"])
	}

	skill.Requires = SkillRequires{
		Bins:   getList("requires.bins"),
		Env:    getList("requires.env"),
		Config: getList("requires.config"),
	}

	if len(skill.Requires.Bins) == 0 {
		skill.Requires.Bins = getList("metadata.solanaos.requires.bins")
	}
	if len(skill.Requires.Env) == 0 {
		skill.Requires.Env = getList("metadata.solanaos.requires.env")
	}
	if len(skill.Requires.Config) == 0 {
		skill.Requires.Config = getList("metadata.solanaos.requires.config")
	}

	return skill, nil
}

func splitFrontmatter(raw string) (frontmatter, body string, ok bool) {
	raw = strings.TrimSpace(raw)
	if !strings.HasPrefix(raw, "---\n") {
		return "", raw, false
	}

	rest := raw[len("---\n"):]
	idx := strings.Index(rest, "\n---\n")
	if idx < 0 {
		return "", raw, false
	}

	frontmatter = strings.TrimSpace(rest[:idx])
	body = strings.TrimSpace(rest[idx+len("\n---\n"):])
	return frontmatter, body, true
}

func parseSimpleYAML(raw string) (map[string]string, map[string][]string) {
	type stackEntry struct {
		key    string
		indent int
	}

	scalar := map[string]string{}
	lists := map[string][]string{}
	lastKeyByIndent := map[int]string{}
	var stack []stackEntry

	lines := strings.Split(raw, "\n")
	for _, line := range lines {
		if strings.TrimSpace(line) == "" {
			continue
		}

		indent := leadingSpaces(line)
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "#") {
			continue
		}

		for len(stack) > 0 && indent <= stack[len(stack)-1].indent {
			delete(lastKeyByIndent, stack[len(stack)-1].indent)
			stack = stack[:len(stack)-1]
		}

		if strings.HasPrefix(trimmed, "- ") {
			target := ""
			for i := indent; i >= 0; i-- {
				if k := lastKeyByIndent[i]; k != "" {
					target = k
					break
				}
			}
			if target != "" {
				item := cleanScalar(strings.TrimSpace(strings.TrimPrefix(trimmed, "- ")))
				if item != "" {
					lists[target] = append(lists[target], item)
				}
			}
			continue
		}

		idx := strings.Index(trimmed, ":")
		if idx < 0 {
			continue
		}

		key := strings.TrimSpace(trimmed[:idx])
		value := strings.TrimSpace(trimmed[idx+1:])

		prefix := ""
		if len(stack) > 0 {
			parts := make([]string, 0, len(stack))
			for _, s := range stack {
				parts = append(parts, s.key)
			}
			prefix = strings.Join(parts, ".") + "."
		}
		fullKey := prefix + key

		if value == "" {
			stack = append(stack, stackEntry{key: key, indent: indent})
			lastKeyByIndent[indent] = fullKey
			continue
		}

		if strings.HasPrefix(value, "[") && strings.HasSuffix(value, "]") {
			lists[fullKey] = append(lists[fullKey], parseInlineList(value)...)
		} else {
			scalar[fullKey] = cleanScalar(value)
		}

		lastKeyByIndent[indent] = fullKey
	}

	for k, v := range lists {
		lists[k] = uniqueAndClean(v)
	}

	return scalar, lists
}

func parseInlineList(value string) []string {
	value = strings.TrimSpace(value)
	if strings.HasPrefix(value, "[") && strings.HasSuffix(value, "]") {
		value = strings.TrimSpace(value[1 : len(value)-1])
	}
	if value == "" {
		return nil
	}
	parts := strings.Split(value, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = cleanScalar(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

func splitCSV(v string) []string {
	v = strings.TrimSpace(v)
	if v == "" {
		return nil
	}
	parts := strings.Split(v, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = cleanScalar(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

func cleanScalar(v string) string {
	v = strings.TrimSpace(v)
	if strings.HasPrefix(v, "\"") && strings.HasSuffix(v, "\"") && len(v) >= 2 {
		v = v[1 : len(v)-1]
	}
	if strings.HasPrefix(v, "'") && strings.HasSuffix(v, "'") && len(v) >= 2 {
		v = v[1 : len(v)-1]
	}
	return strings.TrimSpace(v)
}

func uniqueAndClean(items []string) []string {
	seen := map[string]struct{}{}
	out := make([]string, 0, len(items))
	for _, item := range items {
		item = cleanScalar(item)
		if item == "" {
			continue
		}
		if _, ok := seen[item]; ok {
			continue
		}
		seen[item] = struct{}{}
		out = append(out, item)
	}
	return out
}

func leadingSpaces(s string) int {
	n := 0
	for n < len(s) && s[n] == ' ' {
		n++
	}
	return n
}

func parseLegacySkill(raw string) Skill {
	raw = strings.ReplaceAll(raw, "\r\n", "\n")
	lines := strings.Split(raw, "\n")

	skill := Skill{
		Version:     "0.1.0",
		Description: "Legacy skill format",
		Body:        strings.TrimSpace(raw),
	}

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "# ") && skill.Name == "" {
			skill.Name = strings.TrimSpace(strings.TrimPrefix(line, "# "))
		}
		if strings.HasPrefix(strings.ToLower(line), "trigger:") {
			tags := strings.TrimSpace(strings.TrimPrefix(line, "Trigger:"))
			skill.Tags = uniqueAndClean(splitCSV(tags))
		}
	}

	if skill.Name == "" {
		skill.Name = "legacy-skill"
	}

	return skill
}

func buildSkillMarkdown(skill Skill) string {
	body := strings.TrimSpace(skill.Body)
	if body == "" {
		body = fmt.Sprintf("# %s\n\nFollow these instructions when this skill is selected.", skill.Name)
	}

	version := strings.TrimSpace(skill.Version)
	if version == "" {
		version = "1.0.0"
	}

	description := strings.TrimSpace(skill.Description)
	if description == "" {
		description = "Installed skill"
	}

	emoji := strings.TrimSpace(skill.Emoji)
	if emoji == "" {
		emoji = "🔧"
	}

	bins := formatYAMLList(skill.Requires.Bins)
	env := formatYAMLList(skill.Requires.Env)
	cfg := formatYAMLList(skill.Requires.Config)
	allowed := formatYAMLList(skill.AllowedTools)

	return fmt.Sprintf(`---
name: %s
description: "%s"
version: "%s"
emoji: "%s"
requires:
  bins: %s
  env: %s
  config: %s
allowed-tools: %s
---

%s
`, skill.Name, escapeDoubleQuotes(description), version, emoji, bins, env, cfg, allowed, body)
}

func formatYAMLList(items []string) string {
	items = uniqueAndClean(items)
	if len(items) == 0 {
		return "[]"
	}
	parts := make([]string, 0, len(items))
	for _, item := range items {
		parts = append(parts, fmt.Sprintf("\"%s\"", escapeDoubleQuotes(item)))
	}
	return "[" + strings.Join(parts, ", ") + "]"
}

func escapeDoubleQuotes(s string) string {
	return strings.ReplaceAll(s, "\"", "\\\"")
}

// FormatSkillList formats a slice of skills for display.
func FormatSkillList(skills []Skill) string {
	if len(skills) == 0 {
		return "No skills found."
	}

	var b strings.Builder
	for _, s := range skills {
		emoji := ""
		if strings.TrimSpace(s.Emoji) != "" {
			emoji = s.Emoji + " "
		}
		b.WriteString(fmt.Sprintf("  %s%s v%s — %s\n", emoji, s.Name, s.Version, s.Description))
	}
	return strings.TrimRight(b.String(), "\n")
}
