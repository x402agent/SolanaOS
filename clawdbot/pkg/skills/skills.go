// Package skills provides skill discovery and installation for ClawdBot.
// ClawdBot Go registry-based skill search and install.
package skills

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type Skill struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Version     string   `json:"version"`
	Author      string   `json:"author"`
	URL         string   `json:"url"`
	Tags        []string `json:"tags"`
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
	// Evict oldest if over capacity
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
	// Placeholder: in production, search ClawdBot skill registry
	return nil, nil
}

// InstallSkill downloads and installs a skill to the workspace.
func InstallSkill(workspace string, skill Skill) error {
	skillDir := filepath.Join(workspace, "skills", skill.Name)
	if err := os.MkdirAll(skillDir, 0755); err != nil {
		return err
	}

	manifest, _ := json.MarshalIndent(skill, "", "  ")
	return os.WriteFile(filepath.Join(skillDir, "skill.json"), manifest, 0644)
}

// ListInstalled returns skills installed in the workspace.
func ListInstalled(workspace string) ([]Skill, error) {
	skillsDir := filepath.Join(workspace, "skills")
	entries, err := os.ReadDir(skillsDir)
	if err != nil {
		return nil, err
	}

	var skills []Skill
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		data, err := os.ReadFile(filepath.Join(skillsDir, e.Name(), "skill.json"))
		if err != nil {
			continue
		}
		var s Skill
		if json.Unmarshal(data, &s) == nil {
			skills = append(skills, s)
		}
	}
	return skills, nil
}

// FormatSkillList formats a slice of skills for display.
func FormatSkillList(skills []Skill) string {
	if len(skills) == 0 {
		return "No skills found."
	}
	result := ""
	for _, s := range skills {
		result += fmt.Sprintf("  %s v%s — %s\n", s.Name, s.Version, s.Description)
	}
	return result
}
